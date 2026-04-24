import clipboard from 'clipboardy';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { execa } from 'execa';

/**
 * 处理 <clipboard> 标签：读写系统剪贴板，支持文本与文件
 */
export class ClipboardAction extends BaseAction {
    tag = 'clipboard';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];

        if (!action || !['read', 'write', 'write_file'].includes(action.toLowerCase())) {
            throw new Error('<clipboard> 标签缺少合法的 action 属性 (read 或 write 或 write_file)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行剪贴板操作: ${action}`);

        try {
            if (action.toLowerCase() === 'read') {
                const text = await clipboard.read();
                if (!text) {
                    sysLogger.log(LogLevel.INFO, '剪贴板当前为空或非文本内容');
                    return {
                        type: 'clipboard',
                        content: `【系统自动反馈：剪贴板内容】\n剪贴板当前为空或非文本内容。`
                    };
                } else {
                    sysLogger.log(LogLevel.SUCCESS, '已成功读取剪贴板内容');
                    return {
                        type: 'clipboard',
                        content: `【系统自动反馈：剪贴板内容】\n${text}`
                    };
                }
            } else if (action.toLowerCase() === 'write_file') {
                if (!content) throw new Error('写入文件操作需要提供文件绝对路径');
                if (process.platform === 'win32') {
                    let cleanPath = content.trim();
                    if ((cleanPath.startsWith('"') && cleanPath.endsWith('"')) || (cleanPath.startsWith("'") && cleanPath.endsWith("'"))) {
                        cleanPath = cleanPath.slice(1, -1);
                    }
                    await execa('powershell', ['-NoProfile', '-Command', `Set-Clipboard -Path "${cleanPath}"`]);
                    sysLogger.log(LogLevel.SUCCESS, '已将文件写入系统剪贴板');
                    return {
                        type: 'clipboard',
                        content: `【系统自动反馈】已成功将物理文件写入系统剪贴板。`
                    };
                } else {
                    throw new Error('写文件到剪贴板暂仅支持 Windows 平台');
                }
            } else {
                if (content === undefined || content === null) {
                    throw new Error('写入操作需要提供文本内容');
                }
                await clipboard.write(content);
                sysLogger.log(LogLevel.SUCCESS, '已将指定文本写入系统剪贴板');
                return {
                    type: 'clipboard',
                    content: `【系统自动反馈】已成功将文本写入系统剪贴板。`
                };
            }
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `剪贴板操作失败: ${err.message}`);
            throw new Error(`剪贴板操作异常: ${err.message}`);
        }
    }
}