import path from 'path';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { CloudAction } from './cloud.action.js';
import { localConfig } from '../core/config.js';

export class WeixinAction extends BaseAction {
    tag = 'weixin';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        const apiUrl = 'http://127.0.0.1:9800/bot/v1/message/send';
        const token = localConfig.openilinkToken || 'app_f96d3bd34a3d604d3f5e33419f230f886a3f990604508dfd2e89ac63e99ac7ee';

        if (action === 'send_image') {
            const filePath = attributes['path'];
            if (!filePath) throw new Error('<weixin> 发送图片缺少必填属性 path');

            sysLogger.log(LogLevel.ACTION, `准备上传图片并推送微信: ${filePath}`);

            try {
                const url = await CloudAction.uploadToCloud(filePath);
                const filename = attributes['filename'] || path.basename(filePath);

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        type: 'image',
                        url: url,
                        filename: filename,
                        content: content.trim()
                    })
                });

                if (!response.ok) {
                    throw new Error(`网络响应异常: ${response.status}`);
                }

                sysLogger.log(LogLevel.SUCCESS, `微信图片发送成功。`);
                return {
                    type: 'weixin',
                    content: `【系统自动反馈】微信图片已成功发送，外链 URL: ${url}`
                };
            } catch (err: any) {
                sysLogger.log(LogLevel.ERROR, `发送微信图片失败: ${err.message}`);
                throw new Error(`微信发送图片异常: ${err.message}`);
            }
        } else if (action === 'send') {
            sysLogger.log(LogLevel.ACTION, `准备推送微信文本消息`);

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        content: content.trim()
                    })
                });

                if (!response.ok) {
                    throw new Error(`网络响应异常: ${response.status}`);
                }

                sysLogger.log(LogLevel.SUCCESS, `微信消息发送成功。`);
                return {
                    type: 'weixin',
                    content: `【系统自动反馈】微信消息已成功发送。`
                };
            } catch (err: any) {
                sysLogger.log(LogLevel.ERROR, `发送微信消息失败: ${err.message}`);
                throw new Error(`微信发送消息异常: ${err.message}`);
            }
        }

        throw new Error('<weixin> 标签缺少或包含不支持的 action 属性 (目前仅支持 send/send_image)');
    }
}