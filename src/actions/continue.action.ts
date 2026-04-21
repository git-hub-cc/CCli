import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class ContinueAction extends BaseAction {
    tag = 'continue';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const replyMessage = attributes['reply'] || attributes['message'] || '继续';

        sysLogger.log(LogLevel.ACTION, `检测到分批输出标记，准备发送续传指令: ${replyMessage}`);

        return {
            type: 'text',
            content: replyMessage
        };
    }
}