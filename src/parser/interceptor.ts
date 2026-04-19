import { sysLogger, LogLevel } from '../core/logger.js';

export interface InterceptorResult {
    cleanFeedbacks: string[];
    needsRestartSession: boolean;
    restartAction: string;
    restartKeepLast: number;
    switchModel: string | null;
}

export class SystemInterceptor {
    static intercept(feedbacks: string[], currentDepth: number): InterceptorResult {
        const result: InterceptorResult = {
            cleanFeedbacks: [],
            needsRestartSession: false,
            restartAction: '',
            restartKeepLast: 0,
            switchModel: null
        };

        for (let fb of feedbacks) {
            const contextMatch = fb.match(/【SYSTEM_INSTRUCTION:CONTEXT_MANAGE】 action=(.*?), keep_last=(\d+)/);
            if (contextMatch) {
                if (currentDepth > 1) {
                    sysLogger.log(LogLevel.WARN, '检测到 AI 在自循环执行动作中试图清理上下文，已拦截。');
                    result.cleanFeedbacks.push('【系统自动反馈：动作拦截】子任务执行中禁止使用 <context> 标签，请继续当前任务或输出纯文本总结。');
                } else {
                    result.needsRestartSession = true;
                    result.restartAction = contextMatch[1]!;
                    result.restartKeepLast = parseInt(contextMatch[2]!, 10);
                }
                continue;
            }

            const switchMatch = fb.match(/【SYSTEM_INSTRUCTION:MODEL_SWITCH】\s*provider=(.*?)(?:,|$)/i);
            if (switchMatch) {
                result.switchModel = switchMatch[1].trim().toLowerCase();
                continue;
            }

            result.cleanFeedbacks.push(fb);
        }

        return result;
    }
}