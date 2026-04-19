import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

/**
 * 处理 <context> 标签：上下文瘦身 / Token 自我管理
 */
export class ContextAction extends BaseAction {
    tag = 'context';

    async execute(attributes: Record<string, string>, content: string): Promise<string> {
        const action = attributes['action'];
        const keepLast = parseInt(attributes['keep_last'] || '0', 10);

        if (!action || !['trim', 'clear'].includes(action)) {
            throw new Error('<context> 标签缺少合法的 action 属性 (trim 或 clear)');
        }

        sysLogger.log(LogLevel.ACTION, `准备发出上下文重组请求: ${action}, 保留最近 ${keepLast} 轮`);

        // 返回包含精确参数的内部指令标记，由调度层执行具体的裁切逻辑
        return `【SYSTEM_INSTRUCTION:CONTEXT_MANAGE】 action=${action}, keep_last=${keepLast}`;
    }
}