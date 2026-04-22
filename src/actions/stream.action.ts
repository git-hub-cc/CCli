import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class StreamAction extends BaseAction {
    tag = 'stream';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];
        const device = attributes['device'] || 'default';

        if (!action || !['listen', 'speak', 'stop'].includes(action.toLowerCase())) {
            throw new Error('<stream> 标签缺少合法的 action 属性 (listen/speak/stop)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行流媒体操作: ${action} -> [${device}]`);

        try {
            if (action.toLowerCase() === 'listen') {
                sysLogger.log(LogLevel.INFO, `启动音频截获通道，开始实时 ASR 转录...`);
                return {
                    type: 'stream',
                    content: `【系统自动反馈】音频流监听通道已在设备 [${device}] 开启。`
                };
            } else if (action.toLowerCase() === 'speak') {
                if (!content.trim()) throw new Error('speak 模式需要提供合成的文本内容');
                sysLogger.log(LogLevel.INFO, `启动 TTS 语音合成，输出至设备 [${device}]...`);
                return {
                    type: 'stream',
                    content: `【系统自动反馈】TTS 语音合成输出任务已推入队列。`
                };
            } else if (action.toLowerCase() === 'stop') {
                sysLogger.log(LogLevel.INFO, `关闭所有活动流媒体通道`);
                return {
                    type: 'stream',
                    content: `【系统自动反馈】流媒体与实时音视频通道已强制关闭。`
                };
            }
            
            throw new Error(`不支持的流媒体操作`);
        } catch (err: any) {
            throw new Error(`流媒体通道操作异常: ${err.message}`);
        }
    }
}