import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class WaitAction extends BaseAction {
    tag = 'wait';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const timeout = parseInt(attributes['timeout'] || '5000', 10);

        sysLogger.log(LogLevel.ACTION, `准备执行等待操作: (${timeout}ms)`);

        try {
            await new Promise(r => setTimeout(r, timeout));
            return { type: 'wait', content: `【系统自动反馈】已完成 ${timeout}ms 的休眠等待。` };
        } catch (err: any) {
            throw new Error(`等待执行异常: ${err.message}`);
        }
    }
}