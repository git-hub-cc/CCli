import { sysLogger, LogLevel } from '../core/logger.js';
import type { ActionResult } from '../actions/base.js';

export interface InterceptorResult {
    cleanFeedbacks: string[];
    logFeedbacks: string[];
    needsRestartSession: boolean;
    restartAction: string;
    restartKeepLast: number;
    pruneTag?: string;
}

export class SystemInterceptor {
    static intercept(feedbacks: ActionResult[], currentDepth: number): InterceptorResult {
        const result: InterceptorResult = {
            cleanFeedbacks: [],
            logFeedbacks: [],
            needsRestartSession: false,
            restartAction: '',
            restartKeepLast: 0,
            pruneTag: undefined
        };

        if (feedbacks.length > 0) {
            sysLogger.appendActionTrace(`[INTERCEPTOR-START] 开始分析 ${feedbacks.length} 个动作反馈结果 (深度: ${currentDepth})`);
        }

        for (let fb of feedbacks) {
            if (fb.type === 'context_manage' && fb.payload) {
                if (currentDepth > 1) {
                    sysLogger.log(LogLevel.WARN, '检测到 AI 在自循环执行动作中试图清理上下文，已拦截。');
                    sysLogger.appendActionTrace(`[INTERCEPTOR-WARN] 拒绝深层自循环中的 context 清理请求`);
                    result.cleanFeedbacks.push('【系统自动反馈：动作拦截】子任务执行中禁止使用 <context> 标签，请继续当前任务或输出纯文本总结。');
                    result.logFeedbacks.push('【系统自动反馈：动作拦截】子任务执行中禁止使用 <context> 标签，请继续当前任务或输出纯文本总结。');
                } else {
                    sysLogger.appendActionTrace(`[INTERCEPTOR-SIGNAL] 捕获到上下文重组请求: ${fb.payload.action}`);
                    result.needsRestartSession = true;
                    result.restartAction = fb.payload.action;
                    result.restartKeepLast = fb.payload.keepLast;
                }
                continue;
            }

            if (fb.type === 'interrupt') {
                sysLogger.appendActionTrace(`[INTERCEPTOR-SIGNAL] 捕获到用户强制中断信号`);
                throw new Error('USER_INTERRUPT');
            }

            if (fb.content) {
                if (fb.content.includes('【动作被拒绝】')) {
                    sysLogger.log(LogLevel.WARN, '触发系统防御拦截：AI 执行的动作由于前置状态不满足被底层拒绝。');
                    sysLogger.appendActionTrace(`[INTERCEPTOR-WARN] 动作被拒绝: ${fb.content.substring(0, 50).replace(/\n/g, ' ')}...`);
                } else {
                    sysLogger.appendActionTrace(`[INTERCEPTOR-PASS] 收集有效反馈: ${fb.type}`);
                }
                
                if (fb.payload && fb.payload.fullContent) {
                    if (fb.payload.isStatefulOverwrite) {
                        result.pruneTag = fb.payload.isStatefulOverwrite;
                    }
                    result.logFeedbacks.push(fb.content);
                    result.cleanFeedbacks.push(fb.payload.fullContent);
                } else {
                    result.logFeedbacks.push(fb.content);
                    result.cleanFeedbacks.push(fb.content);
                }
            }
        }

        if (feedbacks.length > 0) {
            sysLogger.appendActionTrace(`[INTERCEPTOR-END] 分析完毕，生成 ${result.cleanFeedbacks.length} 条清洗后反馈`);
        }

        return result;
    }
}