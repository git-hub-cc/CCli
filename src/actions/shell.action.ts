import { execa } from 'execa';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';
import { getConsoleType, injectExecutionEnv, detectWindowsShellType } from '../core/utils.js';

/**
 * 处理 <shell> 标签：执行终端命令行操作
 */
export class ShellAction extends BaseAction {
    tag = 'shell';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        if (!content || !content.trim()) {
            throw new Error('<shell> 标签内容不能为空');
        }

        const command = content.trim();
        const mode = attributes['mode'] || 'sync';
        const isDetached = mode === 'detached';
        const isLaunch = mode === 'launch';

        sysLogger.log(LogLevel.ACTION, `准备执行终端命令: ${command}${isDetached ? ' (新独立后台窗口模式)' : isLaunch ? ' (直接拉起无头/GUI模式)' : ''}`);

        const currentConsole = getConsoleType();

        // --- 模式 1: 非阻塞后台执行 (Detached / Launch) ---
        if (isDetached || isLaunch) {
            return this.executeDetached(command, isLaunch, currentConsole);
        }

        // --- 模式 2: 阻塞同步执行 (Sync) ---
        return this.executeSync(command, currentConsole);
    }

    /**
     * 处理后台独立进程执行逻辑 (Detached / Launch)
     */
    private async executeDetached(command: string, isLaunch: boolean, currentConsole: string): Promise<ActionResult> {
        try {
            let winCmd = '';

            // 1. 构造特定平台的后台启动指令
            if (process.platform === 'win32') {
                const detectedType = detectWindowsShellType(command);
                const usePowerShell = detectedType === 'powershell' || (detectedType === 'neutral' && currentConsole.includes('powershell'));

                if (isLaunch) {
                    winCmd = `cmd.exe /c "start \"\" /NORMAL ${command}"`;
                } else if (usePowerShell) {
                    const psExe = currentConsole.includes('7') ? 'pwsh' : 'powershell';
                    const innerCmd = /[$;=|&]/.test(command) ? command : `Start-Process ${command}`;
                    // 使用 Base64 编码，避免在启动新 PowerShell 进程时处理复杂的单双引号转义
                    const encodedCommand = Buffer.from(innerCmd, 'utf16le').toString('base64');
                    winCmd = `${psExe} -Command "Start-Process ${psExe} -ArgumentList '-NoExit', '-EncodedCommand', '${encodedCommand}' -WindowStyle Minimized"`;
                } else {
                    winCmd = `cmd.exe /c "start /min cmd.exe /k ${command.replace(/"/g, '\\"')}"`;
                }
            } else if (process.platform === 'darwin') {
                winCmd = isLaunch
                    ? `nohup ${command} > /dev/null 2>&1 &`
                    : `osascript -e 'tell app "Terminal" to do script "${command.replace(/"/g, '\\"')}"'`;
            } else {
                winCmd = isLaunch
                    ? `nohup ${command} > /dev/null 2>&1 &`
                    : `x-terminal-emulator -e "${command.replace(/"/g, '\\"')}"`;
            }

            // 2. 执行并解除父子进程绑定 (unref)
            const execaOptions: any = { shell: true, detached: true, env: injectExecutionEnv(command) };
            if (isLaunch) execaOptions.stdio = 'ignore';

            execa(winCmd, execaOptions).unref();

            sysLogger.log(LogLevel.SUCCESS, `已唤起新独立窗口或后台进程执行服务命令`);
            return {
                type: 'shell',
                content: `【系统自动反馈：命令执行结果】\n已成功在独立的物理新窗口或后台启动了该服务或命令。当前主进程未被阻塞，请继续完成下一步任务。`
            };
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `唤起后台进程异常: ${err.message}`);
            throw new Error(`唤起后台进程异常:\n${err.message}`);
        }
    }

    /**
     * 处理同步阻塞执行逻辑 (Sync)
     */
    private async executeSync(command: string, currentConsole: string): Promise<ActionResult> {
        // 工具函数：截断超长日志，防止污染 LLM 上下文
        const truncateLog = (log: string) => {
            if (!log) return '';
            return log.length > localConfig.maxErrorLogLength
                ? `...[前方内容已截断]\n${log.slice(-localConfig.maxErrorLogLength)}`
                : log;
        };

        // 工具函数：生成日志文件的 Markdown 结构
        const buildLogContent = (cmd: string, out: string, err: string, isFail: boolean = false) => {
            let content = `# 执行命令 ${isFail ? '(失败)' : ''}\n\`\`\`bash\n${cmd}\n\`\`\`\n\n`;
            if (out) content += `### 标准输出\n\`\`\`text\n${out}\n\`\`\`\n\n`;
            if (err) content += `### 标准错误\n\`\`\`text\n${err}\n\`\`\`\n\n`;
            if (!out && !err) content += `命令执行成功，无任何控制台输出。\n`;
            return content;
        };

        try {
            let finalCommand = command;
            let shellOpt: string | boolean = true;

            // 1. Windows 下的命令编码与执行环境适配
            if (process.platform === 'win32') {
                const detectedType = detectWindowsShellType(command);
                const usePowerShell = detectedType === 'powershell' || (detectedType === 'neutral' && currentConsole.includes('powershell'));

                if (usePowerShell) {
                    shellOpt = currentConsole.includes('7') ? 'pwsh' : 'powershell';
                    let psCommand = command.trim();
                    if (/^["']/.test(psCommand)) psCommand = `& ${psCommand}`;
                    // 强制 PowerShell 输出 UTF-8 避免中文乱码
                    finalCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${psCommand}`;
                } else {
                    shellOpt = 'cmd.exe';
                    finalCommand = `chcp 65001 >nul & ${command}`; // 确保 CMD 输出 UTF-8
                }
            }

            // 2. 阻塞执行命令，并将子进程输出流实时透传到宿主终端
            const childProcess = execa(finalCommand, { shell: shellOpt, env: injectExecutionEnv(command) });
            childProcess.stdout?.pipe(process.stdout);
            childProcess.stderr?.pipe(process.stderr);

            const { stdout, stderr } = await childProcess;

            // 3. 处理日志截断与落盘归档
            const truncStdout = truncateLog(stdout);
            const truncStderr = truncateLog(stderr);

            const fullLogContent = buildLogContent(command, stdout, stderr, false);
            const truncLogContent = buildLogContent(command, truncStdout, truncStderr, false);
            const logFile = sysLogger.saveTextAsAttachment(truncLogContent, fullLogContent);

            // 4. 组装给大模型的轻量级反馈字符串
            let feedback = `【系统自动反馈：命令执行结果】\n`;
            if (truncStdout) feedback += `[标准输出]\n${truncStdout}\n`;
            if (truncStderr) feedback += `[标准错误]\n${truncStderr}\n`;
            if (!stdout && !stderr) feedback += `命令执行成功，无任何控制台输出。\n`;

            if (logFile) {
                feedback += `\n- 💾 日志归档： [${logFile.fileName}](${logFile.relativePath})`;
                if (logFile.fullRelativePath) {
                    feedback += `\n- 💾 全量日志归档：[${logFile.fileName}](${logFile.fullRelativePath})`;
                }
            }

            sysLogger.log(LogLevel.SUCCESS, `命令执行完毕`);
            return { type: 'shell', content: feedback };

        } catch (err: any) {
            // 5. 异常情况兜底处理
            sysLogger.log(LogLevel.ERROR, `命令执行失败: ${err.shortMessage || err.message}`);

            const stdout = err.stdout || '';
            const stderr = err.stderr || err.message;
            const truncStdout = truncateLog(stdout);
            const truncStderr = truncateLog(stderr);

            const fullLogContent = buildLogContent(command, stdout, stderr, true);
            const truncLogContent = buildLogContent(command, truncStdout, truncStderr, true);
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