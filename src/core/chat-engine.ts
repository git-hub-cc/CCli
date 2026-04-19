import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { sysLogger, LogLevel } from './logger.js';
import { refreshSystemProbe } from './probe.js';
import { PromptBuilder } from '../prompt/builder.js';
import { AIMLParser } from '../parser/aiml-parser.js';
import { RecapDispatcher } from '../recap/dispatcher.js';
import { LLMProviderFactory } from '../llm/factory.js';
import { ContextManager } from './context-manager.js';
import { SystemInterceptor } from '../parser/interceptor.js';
import { localConfig } from './config.js';
import type { ILLMProvider } from '../llm/interface.js';

export interface ChatEngineOptions {
    provider: string;
    headless: boolean;
}

export class ChatEngine {
    private provider: ILLMProvider;
    private contextManager: ContextManager;
    private options: ChatEngineOptions;
    private isClosing = false;

    constructor(options: ChatEngineOptions) {
        this.options = options;
        this.provider = LLMProviderFactory.create(options.provider || localConfig.defaultProvider || 'gemini');
        this.contextManager = new ContextManager();
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
            const builder = new PromptBuilder();
            let systemPrompt = builder.build();

            sysLogger.log(LogLevel.INFO, `正在初始化 ${this.provider.name} 驱动... (后台模式: ${this.options.headless})`);
            await this.provider.init(this.options.headless);
            sysLogger.log(LogLevel.SUCCESS, '驱动已就绪！进入交互模式。\n');

            let isFirstTurn = true;
            const maxAgentDepth = 15;

            while (true) {
                let userInput = '';
                try {
                    userInput = await input({
                        message: chalk.cyan('You >'),
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

                if (text.toLowerCase().startsWith('/recap')) {
                    sysLogger.appendChat('Raw_User', text);
                    await RecapDispatcher.dispatch(text, this.provider, this.contextManager.getHistory());
                    continue;
                }

                if (['exit', 'quit', 'q'].includes(text.toLowerCase())) {
                    sysLogger.appendChat('Raw_User', text);
                    sysLogger.log(LogLevel.INFO, '正在退出...');
                    break;
                }
                if (!text) continue;

                const promptWithHint = this.contextManager.getPromptWithHints(text);
                this.contextManager.addMessage('User', text);

                const finalPrompt = isFirstTurn ? `${systemPrompt}\n\n${promptWithHint}` : promptWithHint;

                if (isFirstTurn) {
                    sysLogger.appendSystemPrompt(systemPrompt);
                    sysLogger.appendChat('Prompt_Context', '> 💾 已归档至: [prompts.md](prompts.md)');
                }
                sysLogger.appendChat('Raw_User', text);
                if (!isFirstTurn) {
                    sysLogger.appendChat('Prompt_Context', promptWithHint);
                }

                isFirstTurn = false;
                let currentDepth = 0;
                let currentAskPrompt = finalPrompt;

                while (currentDepth < maxAgentDepth) {
                    currentDepth++;
                    const response = await this.provider.ask(currentAskPrompt);

                    sysLogger.appendChat('AI', response);
                    this.contextManager.addMessage('AI', response);

                    const parsedNodes = AIMLParser.parse(response);
                    const feedbacks = await AIMLParser.executeNodes(parsedNodes, this.provider);

                    const interceptResult = SystemInterceptor.intercept(feedbacks, currentDepth);

                    if (interceptResult.switchModel) {
                        sysLogger.log(LogLevel.WARN, `接收到模型切换指令，正在尝试切换至 ${interceptResult.switchModel}...`);
                        try {
                            await this.provider.close();
                            this.provider = LLMProviderFactory.create(interceptResult.switchModel);
                            await this.provider.init(this.options.headless);
                            sysLogger.log(LogLevel.SUCCESS, `底层驱动已成功动态切换为: ${interceptResult.switchModel}`);
                            interceptResult.cleanFeedbacks.push(`【系统自动反馈：动作成功】底层驱动已成功切换为 ${interceptResult.switchModel}。`);
                        } catch (e: any) {
                            sysLogger.log(LogLevel.ERROR, `模型切换失败: ${e.message}`);
                            interceptResult.cleanFeedbacks.push(`【系统自动反馈：动作失败】模型切换异常: ${e.message}`);
                        }
                    }

                    if (interceptResult.needsRestartSession) {
                        sysLogger.log(LogLevel.INFO, `执行上下文重组 (动作: ${interceptResult.restartAction}, 保留: ${interceptResult.restartKeepLast} 轮)...`);
                        this.contextManager.popMessage();
                        
                        this.contextManager.executeAction(interceptResult.restartAction, interceptResult.restartKeepLast);

                        await this.provider.resetSession();
                        systemPrompt = builder.build();

                        sysLogger.appendSystemPrompt(systemPrompt);
                        sysLogger.appendChat('Prompt_Context', '> 💾 已归档至: [prompts.md](prompts.md)');

                        const historyStr = this.contextManager.formatHistoryString();
                        const lastUserContent = this.contextManager.getLastMessage()?.content || text;

                        currentAskPrompt = `${systemPrompt}\n\n【系统提示：以下是上下文修剪后为你保留的最近历史记录】\n${historyStr}\n\n【当前用户最新输入】\n${lastUserContent}`;
                        sysLogger.appendChat('System_Feedback', '【系统已执行上下文清理并重置会话状态】');

                        currentDepth--;
                        continue;
                    }

                    if (interceptResult.cleanFeedbacks.length > 0) {
                        const feedbackStr = interceptResult.cleanFeedbacks.join('\n\n');
                        currentAskPrompt = `${feedbackStr}\n\n请根据上述执行结果继续思考或操作。若任务完成，请直接输出纯文本回答。`;
                        sysLogger.appendChat('Tool_Feedback', currentAskPrompt);
                        this.contextManager.addMessage('System_Feedback', feedbackStr);
                        sysLogger.log(LogLevel.INFO, `将系统反馈交还给大模型 (循环深度: ${currentDepth})...`);
                    } else {
                        break;
                    }
                }

                if (currentDepth >= maxAgentDepth) {
                    sysLogger.log(LogLevel.WARN, '大模型连续动作循环达到最大深度，已强制截断以保护系统安全。');
                }
            }
        } catch (error: any) {
            sysLogger.log(LogLevel.ERROR, `系统异常: ${error.message}`);
        } finally {
            await this.gracefulExit();
        }
    }
}