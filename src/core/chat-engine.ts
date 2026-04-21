import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import fs from 'fs';
import path from 'path';
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
import { spawnDetachedWindow } from './utils.js';

export interface ChatEngineOptions {
    provider: string;
    headless: boolean;
    recapMode?: string;
    historyFile?: string;
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
            if (this.options.recapMode && this.options.historyFile) {
                await this.runRecapMode();
                return;
            }

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
                    
                    const history = this.contextManager.getHistory();
                    const timestamp = Date.now();
                    const tempFile = path.resolve(process.cwd(), '.ccli', 'data', `temp_history_${timestamp}.json`);
                    
                    if (!fs.existsSync(path.dirname(tempFile))) {
                        fs.mkdirSync(path.dirname(tempFile), { recursive: true });
                    }
                    fs.writeFileSync(tempFile, JSON.stringify(history, null, 2), 'utf-8');

                    let mode = 'macros';
                    if (text.toLowerCase().includes('data')) mode = 'data';
                    if (text.toLowerCase().includes('prompts')) mode = 'prompts';

                    const providerOpt = this.options.provider ? `-p ${this.options.provider}` : '';
                    const cmd = `ccli chat --recap-mode ${mode} --history-file "${tempFile}" ${providerOpt}`;
                    
                    sysLogger.log(LogLevel.INFO, `正在独立窗口启动复盘进程...`);
                    try {
                        spawnDetachedWindow(cmd);
                        sysLogger.log(LogLevel.SUCCESS, `复盘进程已分离启动，您可以继续在当前窗口交互。`);
                    } catch (e: any) {
                        sysLogger.log(LogLevel.ERROR, `分离启动失败: ${e.message}`);
                    }
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
                        
                        const displayFeedbacks = interceptResult.cleanFeedbacks.map(fb => {
                            if (fb.includes('全量日志归档：')) {
                                const match = fb.match(/((?:全量)?日志归档：.*(?:\n|$))+/);
                                return match ? match[0].trim() : fb;
                            }
                            return fb;
                        });

                        sysLogger.appendChat('Tool_Feedback', displayFeedbacks.join('\n\n'));
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
            if (error.message === 'USER_INTERRUPT') {
                sysLogger.log(LogLevel.INFO, '接收到内部交互中断信号，准备安全退出...');
            } else {
                sysLogger.log(LogLevel.ERROR, `系统异常: ${error.message}`);
            }
        } finally {
            await this.gracefulExit();
        }
    }

    private async runRecapMode() {
        try {
            sysLogger.log(LogLevel.INFO, `正在初始化复盘专享驱动...`);
            await this.provider.init(this.options.headless);

            let history = [];
            if (fs.existsSync(this.options.historyFile!)) {
                history = JSON.parse(fs.readFileSync(this.options.historyFile!, 'utf-8'));
                fs.unlinkSync(this.options.historyFile!);
            }

            const { BaseRecapMode } = await import('../recap/base.js');
            await new BaseRecapMode(this.options.recapMode as any).execute(this.provider, history);
            
            await input({ message: chalk.yellow('复盘执行完毕，按回车键关闭窗口...') });
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `复盘模式执行失败: ${err.message}`);
            const crashLogPath = path.resolve(process.cwd(), '.ccli', 'logs', 'recap-crash.log');
            fs.appendFileSync(crashLogPath, `[${new Date().toISOString()}] ${err.stack || err.message}\n`);
            await input({ message: chalk.red('复盘执行发生异常，请查阅日志。按回车键退出...') });
        }
    }
}