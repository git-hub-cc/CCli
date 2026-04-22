import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';

/**
 * 处理 <listen> 标签：实现异步事件监听与守护
 * 支持：文件/目录变动监控 (file)
 * 进程监控 (process) 与 Webhook 监听 (webhook) 可在此框架下继续扩展
 */
export class ListenAction extends BaseAction {
    tag = 'listen';
    
    // 静态存储全局监听器实例，便于统一管理与销毁
    private static activeWatchers: Map<string, chokidar.FSWatcher> = new Map();

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const type = attributes['type'];
        const target = attributes['target'];
        const callbackPrompt = attributes['callback_prompt'] || content;

        if (!type || !['file', 'process', 'webhook'].includes(type.toLowerCase())) {
            throw new Error('<listen> 标签缺少合法的 type 属性 (file/process/webhook)');
        }
        if (!target) {
            throw new Error('<listen> 标签缺少必填属性 target');
        }

        sysLogger.log(LogLevel.ACTION, `准备注册系统级监听器: ${type} -> ${target}`);

        try {
            if (type.toLowerCase() === 'file') {
                return this.handleFileWatch(target, callbackPrompt);
            } else if (type.toLowerCase() === 'process') {
                return { 
                    type: 'listen', 
                    content: `【系统自动反馈】进程监控功能 (process) 框架已就绪，原生实现请根据需求补充。` 
                };
            } else if (type.toLowerCase() === 'webhook') {
                return { 
                    type: 'listen', 
                    content: `【系统自动反馈】Webhook 监听功能 (webhook) 框架已就绪，需引入 http 模块启动端口监听。` 
                };
            }
            
            throw new Error(`不支持的监听类型: ${type}`);
            
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `注册监听器失败: ${err.message}`);
            throw new Error(`注册监听器异常: ${err.message}`);
        }
    }

    private handleFileWatch(target: string, callbackPrompt: string): ActionResult {
        const targetPath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
        
        // 如果已经存在针对该路径的监听器，先关闭它
        if (ListenAction.activeWatchers.has(targetPath)) {
            const oldWatcher = ListenAction.activeWatchers.get(targetPath);
            oldWatcher?.close();
            ListenAction.activeWatchers.delete(targetPath);
            sysLogger.log(LogLevel.INFO, `已清理旧的文件监听器: ${targetPath}`);
        }

        const watcher = chokidar.watch(targetPath, {
            ignored: /(^|[\/\\])\../, // 忽略隐藏文件
            persistent: true,
            ignoreInitial: true, // 不触发初始扫描事件
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });

        // 绑定事件处理机制
        watcher
            .on('add', filePath => this.triggerCallback('新建文件', filePath, callbackPrompt))
            .on('change', filePath => this.triggerCallback('文件修改', filePath, callbackPrompt))
            .on('unlink', filePath => this.triggerCallback('删除文件', filePath, callbackPrompt))
            .on('error', error => sysLogger.log(LogLevel.ERROR, `文件监听器异常: ${error}`));

        ListenAction.activeWatchers.set(targetPath, watcher);
        sysLogger.log(LogLevel.SUCCESS, `文件/目录变动守护进程已启动: ${targetPath}`);

        return {
            type: 'listen',
            content: `【系统自动反馈】已成功启动后台守护进程，开始监控文件/目录: ${targetPath}。\n当发生变动时，系统将打断挂起任务并主动向大模型注入回调指令。`
        };
    }

    private triggerCallback(eventDesc: string, triggerPath: string, callbackPrompt: string) {
        const relativePath = path.relative(process.cwd(), triggerPath);
        sysLogger.log(LogLevel.WARN, `[异步事件触发] ${eventDesc}: ${relativePath}`);
        sysLogger.log(LogLevel.ACTION, `准备将事件注入会话中断流: ${callbackPrompt}`);
        
        // TODO: 这里需要接入 Agent 的中断与唤醒机制。
        // 目前仅打印日志，实际实现中需要通过 ContextManager 或 EventBus 将 callbackPrompt
        // 动态压入大模型的交互队列中，并携带 triggerPath 上下文。
    }
}