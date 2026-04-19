import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

/**
 * 处理 <continue> 标签：流式续传，突破输出限制
 */
export class ContinueAction extends BaseAction {
    tag = 'continue';

    async execute(attributes: Record<string, string>, content: string): Promise<string> {
        // 提取自定义回复属性，兼容 reply 或 message 命名，默认回退为 "继续"
        const replyMessage = attributes['reply'] || attributes['message'] || '继续';

        sysLogger.log(LogLevel.ACTION, `检测到分批输出标记，准备发送续传指令: ${replyMessage}`);

        // 向大模型发送约定的触发词或自定义唤醒词
        return replyMessage;
    }
}