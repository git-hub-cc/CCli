import { sysLogger, LogLevel } from '../core/logger.js';
import type { ActionResult } from '../actions/base.js';

export interface InterceptorResult {
    cleanFeedbacks: string[];
    needsRestartSession: boolean;
    restartAction: string;
    restartKeepLast: number;
}

export class SystemInterceptor {
    static intercept(feedbacks: ActionResult[], currentDepth: number): InterceptorResult {
        const result: InterceptorResult = {
            cleanFeedbacks: [],
            needsRestartSession: false,
            restartAction: '',
            restartKeepLast: 0
        };

        for (let fb of feedbacks) {
            // 通过强类型标识处理特殊的系统指令
            if (fb.type === 'context_manage' && fb.payload) {
                if (currentDepth > 1) {
                    sysLogger.log(LogLevel.WARN, '检测到 AI 在自循环执行动作中试图清理上下文，已拦截。');
                    result.cleanFeedbacks.push('【系统自动反馈：动作拦截】子任务执行中禁止使用 <context> 标签，请继续当前任务或输出纯文本总结。');
                } else {
                    result.needsRestartSession = true;
                    result.restartAction = fb.payload.action;
                    result.restartKeepLast = fb.payload.keepLast;
                }
                continue;
            }

            // 处理询问动作产生的强行中断信号
            if (fb.type === 'interrupt') {
                throw new Error('USER_INTERRUPT');
            }

            // 提取常规的显示文本
            if (fb.content) {
                // 防御性监控：如果底层脚本抛出了明确的动作拒绝状态，打印警告日志提醒用户
                if (fb.content.includes('【动作被拒绝】')) {
                    sysLogger.log(LogLevel.WARN, '触发系统防御拦截：AI 执行的动作由于前置状态不满足被底层拒绝。');
                }
                result.cleanFeedbacks.push(fb.content);
            }
        }

        return result;
    }
}