import { sysLogger, LogLevel } from '../core/logger.js';
import { AIMLParser } from '../parser/aiml-parser.js';
import { SystemInterceptor } from '../parser/interceptor.js';
import { ContextManager } from '../core/context-manager.js';
import type { ILLMProvider } from '../llm/interface.js';
import { SessionContext } from './session-context.js';

export class AgentExecutor {
    /**
     * 专门负责大模型思考与动作执行的内层调度循环
     */
    static async execute(
        provider: ILLMProvider,
        contextManager: ContextManager,
        sessionContext: SessionContext,
        initialPrompt: string,
        originalUserInput: string
    ): Promise<void> {
        const maxAgentDepth = 15;
        let currentDepth = 0;
        let currentAskPrompt = initialPrompt;

        while (currentDepth < maxAgentDepth) {
            currentDepth++;
            const response = await provider.ask(currentAskPrompt);

            sysLogger.appendChat('AI', response);
            contextManager.addMessage('AI', response);

            // 解析并执行动作技能树
            const parsedNodes = AIMLParser.parse(response);
            const feedbacks = await AIMLParser.executeNodes(parsedNodes, provider);

            // 让拦截器统一分析执行结果状态
            const interceptResult = SystemInterceptor.intercept(feedbacks, currentDepth);

            // 遇到主动请求的记忆修剪动作
            if (interceptResult.needsRestartSession) {
                sysLogger.log(LogLevel.INFO, `执行上下文重组 (动作: ${interceptResult.restartAction}, 保留: ${interceptResult.restartKeepLast} 轮)...`);
                
                // 将导致清理动作的当前回答先弹出，不污染历史
                contextManager.popMessage();
                contextManager.executeAction(interceptResult.restartAction, interceptResult.restartKeepLast);

                await provider.resetSession();
                sessionContext.reset();

                sysLogger.appendSystemPrompt(sessionContext.systemPrompt);
                sysLogger.appendChat('Prompt_Context', '> 💾 已归档至: [prompts.md](prompts.md)');

                const historyStr = contextManager.formatHistoryString();
                const lastUserContent = contextManager.getLastMessage()?.content || originalUserInput;

                currentAskPrompt = `${sessionContext.systemPrompt}\n\n【系统提示：以下是上下文修剪后为你保留的最近历史记录】\n${historyStr}\n\n【当前用户最新输入】\n${lastUserContent}`;
                sysLogger.appendChat('System_Feedback', '【系统已执行上下文清理并重置会话状态】');

                currentDepth--; // 重组回合不消耗循环深度计数
                continue;
            }

            // 处理普通工具执行反馈并交还给大模型
            if (interceptResult.cleanFeedbacks.length > 0 || interceptResult.logFeedbacks.length > 0) {
                // 用于写入硬盘的富文本日志（含链接等）
                const rawFeedbackStr = interceptResult.logFeedbacks.join('\n\n');

                // 清洗掉路径等无用噪声，作为纯净反馈注入给 AI
                const cleanedFeedbacks = interceptResult.cleanFeedbacks.map(fb => {
                    return fb.replace(/\n?- 💾 (?:全量)?日志归档：.*/g, '').trim();
                });
                const cleanedFeedbackStr = cleanedFeedbacks.join('\n\n');

                currentAskPrompt = `${cleanedFeedbackStr}\n\n请根据上述执行结果继续思考或操作。若任务完成，请直接输出纯文本回答。`;

                sysLogger.appendChat('Tool_Feedback', rawFeedbackStr);
                contextManager.addMessage('System_Feedback', cleanedFeedbackStr);

                sysLogger.log(LogLevel.INFO, `将系统反馈交还给大模型 (循环深度: ${currentDepth})...`);
            } else {
                // 没有反馈说明任务闭环结束，跳出内层思考循环
                break;
            }
        }

        if (currentDepth >= maxAgentDepth) {
            sysLogger.log(LogLevel.WARN, '大模型连续动作循环达到最大深度，已强制截断以保护系统安全。');
        }
    }
}