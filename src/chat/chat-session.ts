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
import { ListenAction } from '../actions/listen.action.js';

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
    private pendingExternalEvent: string = '';
    private pendingFiles: string[] = [];
    private isProcessing: boolean = false;

    constructor(options: ChatSessionOptions) {
        this.options = options;
        const providerName = options.provider || localConfig.defaultProvider || 'gemini';
        this.provider = LLMProviderFactory.create(providerName);
        this.contextManager = new ContextManager();
        this.sessionContext = new SessionContext(this.contextManager, providerName);
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

            this.sessionContext.initialize();
            sysLogger.appendSystemPrompt(this.sessionContext.systemPrompt);
            sysLogger.appendChat('Prompt_Context', '> 💾 已归档至: [prompts.md](prompts.md)');

            if (localConfig.autoListenWebhook) {
                ListenAction.startWebhookServer();
            }

            this.contextManager.on('external_message', (payload: any) => {
                let msg = '';
                let files: string[] = [];
                
                if (typeof payload === 'string') {
                    msg = payload;
                } else if (payload && payload.prompt) {
                    msg = payload.prompt;
                    if (Array.isArray(payload.files)) {
                        files = payload.files;
                    }
                }

                this.pendingExternalEvent += msg + '\n\n';
                if (files.length > 0) {
                    this.pendingFiles.push(...files);
                }

                if (!this.isProcessing) {
                    sysLogger.log(LogLevel.WARN, `\n[📥 异步事件挂载] 收到外部事件，正在唤醒主线程...`);
                    process.stdin.emit('keypress', '', { name: 'return' });
                } else {
                    sysLogger.log(LogLevel.INFO, `\n[📥 异步事件挂载] 收到外部事件，AI正忙，已加入执行队列...`);
                }
            });

            while (true) {
                let text = '';
                let currentFiles: string[] = [];

                if (this.pendingExternalEvent) {
                    text = this.pendingExternalEvent.trim();
                    this.pendingExternalEvent = '';
                    currentFiles = [...this.pendingFiles];
                    this.pendingFiles = [];
                } else {
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

                    text = userInput.trim();

                    if (this.pendingExternalEvent) {
                        text = (this.pendingExternalEvent + text).trim();
                        this.pendingExternalEvent = '';
                        currentFiles = [...this.pendingFiles];
                        this.pendingFiles = [];
                    } else if (!text) {
                        continue;
                    }
                }

                const dispatchResult = CommandDispatcher.handle(text, this.contextManager, this.options.provider);
                if (dispatchResult === 'exit') break;
                if (dispatchResult === 'continue') continue;

                for (const file of currentFiles) {
                    try {
                        await this.provider.uploadFile(file, false);
                        sysLogger.log(LogLevel.SUCCESS, `外部事件附带文件已自动挂载: ${file}`);
                    } catch (e: any) {
                        sysLogger.log(LogLevel.ERROR, `自动挂载外部文件失败: ${e.message}`);
                    }
                }

                const promptWithHint = this.contextManager.getPromptWithHints(text);
                this.contextManager.addMessage('User', text);

                const finalPrompt = this.sessionContext.isFirstTurn 
                    ? `${this.sessionContext.systemPrompt}\n\n${promptWithHint}` 
                    : promptWithHint;

                sysLogger.appendChat('Raw_User', text);
                if (!this.sessionContext.isFirstTurn) {
                    if (this.provider.name !== 'LMStudioAPI' || promptWithHint !== text) {
                        sysLogger.appendChat('Prompt_Context', promptWithHint);
                    }
                }

                this.sessionContext.isFirstTurn = false;
                this.isProcessing = true;

                try {
                    await AgentExecutor.execute(
                        this.provider,
                        this.contextManager,
                        this.sessionContext,
                        finalPrompt,
                        text
                    );
                } finally {
                    this.isProcessing = false;
                }
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