import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class ContextAction extends BaseAction {
    tag = 'context';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];
        const keepLast = parseInt(attributes['keep_last'] || '0', 10);

        if (!action || !['trim', 'clear'].includes(action)) {
            throw new Error('<context> 标签缺少合法的 action 属性 (trim 或 clear)');
        }

        sysLogger.log(LogLevel.ACTION, `准备发出上下文重组请求: ${action}, 保留最近 ${keepLast} 轮`);

        return {
            type: 'context_manage',
            payload: {
                action,
                keepLast
            }
        };
    }
}