import { execa } from 'execa';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';
import { getConsoleType } from '../core/utils.js';

/**
 * 处理 <shell> 标签：执行终端命令行操作
 */
export class ShellAction extends BaseAction {
    tag = 'shell';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        if (!content || !content.trim()) {
            throw new Error('<shell> 标签内容不能为空');
        }

        const command = content.trim().replace(/\[(https?:\/\/[^\]]+)\]\(\1\)/g, '$1');
        const mode = attributes['mode'] || 'sync';
        const isDetached = mode === 'detached';

        sysLogger.log(LogLevel.ACTION, `准备执行终端命令: ${command}${isDetached ? ' (新独立后台窗口模式)' : ''}`);

        const truncateLog = (log: string) => {
            if (!log) return '';
            return log.length > localConfig.maxErrorLogLength
                ? `...[前方内容已截断]\n${log.slice(-localConfig.maxErrorLogLength)}`
                : log;
        };

        const currentConsole = getConsoleType();

        if (isDetached) {
            try {
                let winCmd = '';
                if (process.platform === 'win32') {
                    if (currentConsole.includes('powershell')) {
                        const psExe = currentConsole.includes('7') ? 'pwsh' : 'powershell';
                        let innerCmd = '';
                        if (/[$;=|&]/.test(command)) {
                            innerCmd = command;
                        } else {
                            innerCmd = `Start-Process ${command}`;
                        }
                        const encodedCommand = Buffer.from(innerCmd, 'utf16le').toString('base64');
                        winCmd = `${psExe} -Command "Start-Process ${psExe} -ArgumentList '-NoExit', '-EncodedCommand', '${encodedCommand}' -WindowStyle Minimized"`;
                    } else {
                        winCmd = `cmd.exe /c "start /min cmd.exe /k ${command.replace(/"/g, '\\"')}"`;
                    }
                } else if (process.platform === 'darwin') {
                    winCmd = `osascript -e 'tell app "Terminal" to do script "${command.replace(/"/g, '\\"')}"'`;
                } else {
                    winCmd = `x-terminal-emulator -e "${command.replace(/"/g, '\\"')}"`;
                }

                execa(winCmd, { shell: true, detached: true }).unref();

                sysLogger.log(LogLevel.SUCCESS, `已唤起新独立窗口执行服务命令`);
                return {
                    type: 'shell',
                    content: `【系统自动反馈：命令执行结果】\n已成功在独立的物理新窗口启动了该服务或命令。当前主进程未被阻塞，请继续完成下一步任务。`
                };
            } catch (err: any) {
                sysLogger.log(LogLevel.ERROR, `唤起新窗口异常: ${err.message}`);
                throw new Error(`唤起新窗口异常:\n${err.message}`);
            }
        }

        try {
            let finalCommand = command;
            let shellOpt: string | boolean = true;

            if (process.platform === 'win32') {
                if (currentConsole.includes('powershell')) {
                    shellOpt = currentConsole.includes('7') ? 'pwsh' : 'powershell';
                    let psCommand = command.trim();
                    if (/^["']/.test(psCommand)) {
                        psCommand = `& ${psCommand}`;
                    }
                    finalCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${psCommand}`;
                } else {
                    shellOpt = 'cmd.exe';
                    finalCommand = `chcp 65001 >nul & ${command}`;
                }
            }

            const childProcess = execa(finalCommand, { shell: shellOpt });
            childProcess.stdout?.pipe(process.stdout);
            childProcess.stderr?.pipe(process.stderr);

            const { stdout, stderr } = await childProcess;

            const truncStdout = truncateLog(stdout);
            const truncStderr = truncateLog(stderr);

            let fullLogContent = `# 执行命令\n\`\`\`bash\n${command}\n\`\`\`\n\n`;
            if (stdout) fullLogContent += `### 标准输出\n\`\`\`text\n${stdout}\n\`\`\`\n\n`;
            if (stderr) fullLogContent += `### 标准错误\n\`\`\`text\n${stderr}\n\`\`\`\n\n`;
            if (!stdout && !stderr) fullLogContent += `命令执行成功，无任何控制台输出。\n`;

            let truncLogContent = `# 执行命令\n\`\`\`bash\n${command}\n\`\`\`\n\n`;
            if (truncStdout) truncLogContent += `### 标准输出\n\`\`\`text\n${truncStdout}\n\`\`\`\n\n`;
            if (truncStderr) truncLogContent += `### 标准错误\n\`\`\`text\n${truncStderr}\n\`\`\`\n\n`;
            if (!stdout && !stderr) truncLogContent += `命令执行成功，无任何控制台输出。\n`;

            const logFile = sysLogger.saveTextAsAttachment(truncLogContent, fullLogContent);

            let feedback = `【系统自动反馈：命令执行结果】\n`;
            if (truncStdout) {
                feedback += `[标准输出]\n${truncStdout}\n`;
            }
            if (truncStderr) {
                feedback += `[标准错误]\n${truncStderr}\n`;
            }
            if (!stdout && !stderr) {
                feedback += `命令执行成功，无任何控制台输出。\n`;
            }

            if (logFile) {
                feedback += `\n- 💾 日志归档： [${logFile.fileName}](${logFile.relativePath})`;
                if (logFile.fullRelativePath) {
                    feedback += `\n- 💾 全量日志归档：[${logFile.fileName}](${logFile.fullRelativePath})`;
                }
            }

            sysLogger.log(LogLevel.SUCCESS, `命令执行完毕`);
            return {
                type: 'shell',
                content: feedback
            };

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `命令执行失败: ${err.shortMessage || err.message}`);

            const stdout = err.stdout || '';
            const stderr = err.stderr || err.message;

            const truncStdout = truncateLog(stdout);
            const truncStderr = truncateLog(stderr);

            let fullLogContent = `# 执行命令 (失败)\n\`\`\`bash\n${command}\n\`\`\`\n\n`;
            if (stdout) fullLogContent += `### 标准输出\n\`\`\`text\n${stdout}\n\`\`\`\n\n`;
            if (stderr) fullLogContent += `### 标准错误\n\`\`\`text\n${stderr}\n\`\`\`\n\n`;

            let truncLogContent = `# 执行命令 (失败)\n\`\`\`bash\n${command}\n\`\`\`\n\n`;
            if (truncStdout) truncLogContent += `### 标准输出\n\`\`\`text\n${truncStdout}\n\`\`\`\n\n`;
            if (truncStderr) truncLogContent += `### 标准错误\n\`\`\`text\n${truncStderr}\n\`\`\`\n\n`;

            const logFile = sysLogger.saveTextAsAttachment(truncLogContent, fullLogContent);

            let errorFeedback = `终端命令异常退出:\n${truncStderr}`;
            if (logFile) {
                errorFeedback += `\n\n- 💾 日志归档： [${logFile.fileName}](${logFile.relativePath})`;
                if (logFile.fullRelativePath) {
                    errorFeedback += `\n- 💾 全量日志归档：[${logFile.fileName}](${logFile.fullRelativePath})`;
                }
            }
            throw new Error(errorFeedback);
        }
    }
}