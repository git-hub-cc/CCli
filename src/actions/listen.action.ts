import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { ContextManager } from '../core/context-manager.js';
import { localConfig } from '../core/config.js';

export class ListenAction extends BaseAction {
    tag = 'listen';

    private static activeWatchers: Map<string, chokidar.FSWatcher> = new Map();
    private static webhookServer: http.Server | null = null;

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const type = attributes['type'];
        const target = attributes['target'];
        const callbackPrompt = attributes['callback_prompt'] || content;

        if (!type || !['file', 'process', 'webhook'].includes(type.toLowerCase())) {
            throw new Error('<listen> 标签缺少合法的 type 属性 (file/process/webhook)');
        }

        sysLogger.log(LogLevel.ACTION, `准备注册系统级监听器: ${type} ${target ? '-> ' + target : ''}`);

        try {
            if (type.toLowerCase() === 'file') {
                if (!target) throw new Error('<listen> file模式缺少必填属性 target');
                return this.handleFileWatch(target, callbackPrompt);
            } else if (type.toLowerCase() === 'process') {
                return {
                    type: 'listen',
                    content: `【系统自动反馈】进程监控功能 (process) 框架已就绪，原生实现请根据需求补充。`
                };
            } else if (type.toLowerCase() === 'webhook') {
                return this.handleWebhookWatch(callbackPrompt);
            }

            throw new Error(`不支持的监听类型: ${type}`);

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `注册监听器失败: ${err.message}`);
            throw new Error(`注册监听器异常: ${err.message}`);
        }
    }

    // 默认的注入提示词，要求 AI 在思考后使用 weixin_send 宏技能进行物理回传
    public static startWebhookServer(callbackPrompt: string = '收到来自微信用户 "{sender}" 的推送消息：{message}\n请你作为 AI 助手处理该消息，并在回答时必须使用 <weixin_send contacts="{sender}">你的回复内容</weixin_send> 标签将处理结果回传给该用户。') {
        const port = localConfig.webhookPort;
        if (ListenAction.webhookServer) {
            return;
        }

        ListenAction.webhookServer = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/webhook/wechat') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', () => {
                    try {
                        const payload = JSON.parse(body);

                        // 适配 OpeniLink Hub 的深层 JSON 结构
                        let sender = '未知联系人';
                        let msgContent = '';

                        if (payload.event && payload.event.data) {
                            const data = payload.event.data;
                            // 提取发送人标识 (优先取昵称，没有则取 ID)
                            sender = data.sender?.name || data.sender?.id || sender;
                            // 提取消息内容
                            msgContent = data.content || '';

                            // 尝试清理微信 ID 的后缀，让它对 AI 看起来更干净些
                            sender = sender.replace('@im.wechat', '');
                        }

                        const injectedPrompt = callbackPrompt
                            .replace(/\{sender\}/g, sender)
                            .replace(/\{message\}/g, msgContent);

                        ListenAction.triggerCallback('收到 Webhook 推送消息', sender, injectedPrompt);
                    } catch (e) {
                        sysLogger.log(LogLevel.ERROR, `Webhook 解析失败: ${e}`);
                    }
                    res.writeHead(200);
                    res.end('OK');
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        ListenAction.webhookServer.listen(port, () => {
            sysLogger.log(LogLevel.SUCCESS, `OpeniLink Webhook 监听已启动: http://127.0.0.1:${port}/webhook/wechat`);
        });
    }

    private handleWebhookWatch(callbackPrompt: string): ActionResult {
        const port = localConfig.webhookPort;
        if (ListenAction.webhookServer) {
            return { type: 'listen', content: `【系统自动反馈】Webhook 服务已在端口 ${port} 运行中，持续监听外部推送。` };
        }

        ListenAction.startWebhookServer(callbackPrompt);

        return {
            type: 'listen',
            content: `【系统自动反馈】已成功启动 Webhook 守护进程 (端口:${port})。当收到外部系统推送时，将打断当前对话状态并触发回调指令。`
        };
    }

    private handleFileWatch(target: string, callbackPrompt: string): ActionResult {
        const targetPath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);

        if (ListenAction.activeWatchers.has(targetPath)) {
            const oldWatcher = ListenAction.activeWatchers.get(targetPath);
            oldWatcher?.close();
            ListenAction.activeWatchers.delete(targetPath);
            sysLogger.log(LogLevel.INFO, `已清理旧的文件监听器: ${targetPath}`);
        }

        const watcher = chokidar.watch(targetPath, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });

        watcher
            .on('add', filePath => ListenAction.triggerCallback('新建文件', filePath, callbackPrompt))
            .on('change', filePath => ListenAction.triggerCallback('文件修改', filePath, callbackPrompt))
            .on('unlink', filePath => ListenAction.triggerCallback('删除文件', filePath, callbackPrompt))
            .on('error', error => sysLogger.log(LogLevel.ERROR, `文件监听器异常: ${error}`));

        ListenAction.activeWatchers.set(targetPath, watcher);
        sysLogger.log(LogLevel.SUCCESS, `文件/目录变动守护进程已启动: ${targetPath}`);

        return {
            type: 'listen',
            content: `【系统自动反馈】已成功启动后台守护进程，开始监控文件/目录: ${targetPath}。\n当发生变动时，系统将打断挂起任务并主动向大模型注入回调指令。`
        };
    }

    private static triggerCallback(eventDesc: string, triggerId: string, callbackPrompt: string) {
        sysLogger.log(LogLevel.WARN, `[异步事件触发] ${eventDesc}: ${triggerId}`);
        sysLogger.log(LogLevel.ACTION, `已将事件信号压入上下文总线: ${callbackPrompt}`);

        if (ContextManager.activeInstance) {
            ContextManager.activeInstance.emit('external_message', callbackPrompt);
        }
    }
}