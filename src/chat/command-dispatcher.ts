import fs from 'fs';
import path from 'path';
import { sysLogger, LogLevel } from '../core/logger.js';
import { ContextManager } from '../core/context-manager.js';
import { spawnDetachedWindow } from '../core/utils.js';

export class CommandDispatcher {
    /**
     * 拦截处理系统级本地指令，将其与常规大模型对话隔离
     */
    static handle(text: string, contextManager: ContextManager, providerName?: string): 'continue' | 'exit' | 'pass' {
        const lowerText = text.toLowerCase();

        // 拦截并分发复盘指令
        if (lowerText.startsWith('/recap')) {
            sysLogger.appendChat('Raw_User', text);

            const history = contextManager.getHistory();
            const timestamp = Date.now();
            const tempFile = path.resolve(process.cwd(), '.ccli', 'data', `temp_history_${timestamp}.json`);

            if (!fs.existsSync(path.dirname(tempFile))) {
                fs.mkdirSync(path.dirname(tempFile), { recursive: true });
            }
            fs.writeFileSync(tempFile, JSON.stringify(history, null, 2), 'utf-8');

            let mode = 'macros';
            if (lowerText.includes('data')) mode = 'data';
            if (lowerText.includes('prompts')) mode = 'prompts';

            const providerOpt = providerName ? `-p ${providerName}` : '';
            const cmd = `ccli chat --recap-mode ${mode} --history-file "${tempFile}" ${providerOpt}`;

            sysLogger.log(LogLevel.INFO, `正在独立窗口启动复盘进程...`);
            try {
                spawnDetachedWindow(cmd);
                sysLogger.log(LogLevel.SUCCESS, `复盘进程已分离启动，您可以继续在当前窗口交互。`);
            } catch (e: any) {
                sysLogger.log(LogLevel.ERROR, `分离启动失败: ${e.message}`);
            }
            return 'continue';
        }

        // 拦截并处理退出指令
        if (['exit', 'quit', 'q'].includes(lowerText)) {
            sysLogger.appendChat('Raw_User', text);
            sysLogger.log(LogLevel.INFO, '正在退出...');
            return 'exit';
        }

        // 非本地指令，放行给大模型
        return 'pass';
    }
}