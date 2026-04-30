import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import path from 'path';
import { downloadFile } from '../core/utils.js';

export class NetworkAction extends BaseAction {
    tag = 'network';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || 'get').toLowerCase();
        let targetUrl = attributes['url'];
        const headersStr = attributes['headers'];
        const savePath = attributes['save_path'];

        if (!targetUrl) {
            throw new Error('<network> 标签缺少必填属性 url');
        }

        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        sysLogger.log(LogLevel.ACTION, `准备执行网络通信: [${action.toUpperCase()}] -> ${targetUrl}`);

        try {
            let headers: Record<string, string> = {
                'User-Agent': 'CCLI-Agent-Network-Client/1.0',
                'Accept': 'application/json, text/plain, */*'
            };

            if (headersStr) {
                try {
                    const customHeaders = JSON.parse(headersStr);
                    headers = { ...headers, ...customHeaders };
                } catch (e) {
                    sysLogger.log(LogLevel.WARN, `提供的 headers 属性非有效 JSON，已忽略: ${headersStr}`);
                }
            }

            const fetchOptions: RequestInit = {
                method: action.toUpperCase(),
                headers: headers
            };

            if (['post', 'put', 'patch'].includes(action) && content) {
                fetchOptions.body = content;
                if (!headers['Content-Type']) {
                    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                        headers['Content-Type'] = 'application/json';
                    } else {
                        headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    }
                }
            }

            if (savePath || action === 'download') {
                const finalSavePath = savePath
                    ? (path.isAbsolute(savePath) ? savePath : path.resolve(process.cwd(), savePath))
                    : path.resolve(process.cwd(), `.ccli/downloads/download_${Date.now()}`);

                const { status } = await downloadFile(targetUrl, finalSavePath, fetchOptions);

                sysLogger.log(LogLevel.SUCCESS, `网络资源已下载并保存至: ${finalSavePath}`);
                return {
                    type: 'network',
                    content: `【系统自动反馈：网络通信结果】\n文件下载成功。\n状态码: ${status}\n保存路径: ${finalSavePath}`
                };
            }

            const response = await fetch(targetUrl, fetchOptions);

            if (!response.ok) {
                throw new Error(`HTTP 响应异常，状态码: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();

            const MAX_RESPONSE_LENGTH = 5000;
            const isTruncated = responseText.length > MAX_RESPONSE_LENGTH;
            const displayContent = isTruncated
                ? responseText.substring(0, MAX_RESPONSE_LENGTH) + '\n\n... (内容过长，已被截断以保护内存)'
                : responseText;

            sysLogger.log(LogLevel.SUCCESS, `网络请求完成 (状态码: ${response.status}, 数据长度: ${responseText.length})`);

            return {
                type: 'network',
                content: `【系统自动反馈：网络通信结果】\n目标URL: ${targetUrl}\n状态码: ${response.status}\n\n[响应报文提取]:\n\`\`\`text\n${displayContent}\n\`\`\``
            };

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `网络请求执行失败: ${err.message}`);
            throw new Error(`网络请求执行失败: ${err.message}`);
        }
    }
}