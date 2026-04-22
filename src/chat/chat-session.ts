import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { sysLogger, LogLevel } from '../core/logger.js';
import { refreshSystemProbe } from '../core/probe.js';
import { LLMProviderFactory } from '../llm/factory.js';
import { ContextManager } from '../core/context-manager.js';
import { localConfig } from '../core/config.js';
import type { ILLMProvider } from '../llm/interface.js';
import { SessionContext } from './session-context.js';
import { CommandDispatcher } from './command-dispatcher.js';
import { AgentExecutor } from './agent-executor.js';

export interface ChatSessionOptions {
    provider: string;
    headless: boolean;
}

export class ChatSession {
    private provider: ILLMProvider;
    private contextManager: ContextManager;
    private sessionContext: SessionContext;
    private options: ChatSessionOptions;
    private isClosing = false;

    constructor(options: ChatSessionOptions) {
        this.options = options;
        this.provider = LLMProviderFactory.create(options.provider || localConfig.defaultProvider || 'gemini');
        this.contextManager = new ContextManager();
        this.sessionContext = new SessionContext(this.contextManager);
    }

    private async gracefulExit() {
        if (this.isClosing) return;
        this.isClosing = true;
        sysLogger.log(LogLevel.WARN, '\n收到中断信号，正在安全退出...');
        await this.provider.close();
        process.exit(0);
    }

    async start() {
        process.on('SIGINT', () => this.gracefulExit());

        try {
            await refreshSystemProbe();

            sysLogger.log(LogLevel.INFO, `正在初始化 ${this.provider.name} 驱动... (后台模式: ${this.options.headless})`);
            await this.provider.init(this.options.headless);
            sysLogger.log(LogLevel.SUCCESS, '驱动已就绪！进入交互模式。\n');

            // 1. 初始化系统提示词与状态机
            this.sessionContext.initialize();
            sysLogger.appendSystemPrompt(this.sessionContext.systemPrompt);
            sysLogger.appendChat('Prompt_Context', '> 💾 已归档至: [prompts.md](prompts.md)');

            while (true) {
                // 2. 统筹 Token 用量预警
                const tokens = this.contextManager.currentTotalTokens;
                const max = localConfig.modelMaxTokens;
                const ratio = tokens / max;
                const kTokens = (tokens / 1000).toFixed(1) + 'k';
                const kMax = (max / 1000).toFixed(0) + 'k';

                let tokenPrefix = `[${kTokens}/${kMax}]`;
                if (ratio >= localConfig.tokenThresholdPercent) {
                    tokenPrefix = chalk.red(`${tokenPrefix} ⚠ 阈值预警`);
                } else if (ratio >= localConfig.tokenThresholdPercent * 0.75) {
                    tokenPrefix = chalk.yellow(tokenPrefix);
                } else {
                    tokenPrefix = chalk.green(tokenPrefix);
                }

                // 3. UI 层捕获用户输入
                let userInput = '';
                try {
                    userInput = await input({
                        message: `${tokenPrefix} ${chalk.cyan('You >')}`,
                        theme: { prefix: '' }
                    });
                } catch (err: any) {
                    if (err.name === 'ExitPromptError') {
                        sysLogger.log(LogLevel.INFO, '正在退出...');
                        break;
                    }
                    throw err;
                }

                const text = userInput.trim();
                if (!text) continue;

                // 4. 交给拦截器处理系统级本地指令 (/recap, exit 等)
                const dispatchResult = CommandDispatcher.handle(text, this.contextManager, this.options.provider);
                if (dispatchResult === 'exit') break;
                if (dispatchResult === 'continue') continue;

                // 5. 组合动态上下文提示，更新历史记忆
                const promptWithHint = this.contextManager.getPromptWithHints(text);
                this.contextManager.addMessage('User', text);

                const finalPrompt = this.sessionContext.isFirstTurn 
                    ? `${this.sessionContext.systemPrompt}\n\n${promptWithHint}` 
                    : promptWithHint;

                sysLogger.appendChat('Raw_User', text);
                if (!this.sessionContext.isFirstTurn) {
                    sysLogger.appendChat('Prompt_Context', promptWithHint);
                }

                this.sessionContext.isFirstTurn = false;

                // 6. 下沉到 Agent 执行引擎，屏蔽工具调用的底层细节
                await AgentExecutor.execute(
                    this.provider,
                    this.contextManager,
                    this.sessionContext,
                    finalPrompt,
                    text
                );
            }
        } catch (error: any) {
            if (error.message === 'USER_INTERRUPT') {
                sysLogger.log(LogLevel.INFO, '接收到内部交互中断信号，准备安全退出...');
            } else {
                sysLogger.log(LogLevel.ERROR, `系统异常: ${error.message}`);
            }
        } finally {
            await this.gracefulExit();
        }
    }
}