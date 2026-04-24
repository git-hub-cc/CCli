import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

/**
 * 启发式探测 Windows 命令的 Shell 类型
 * @param command 终端命令字符串
 * @returns 'cmd' | 'powershell' | 'neutral'
 */
export function detectWindowsShellType(command: string): 'cmd' | 'powershell' | 'neutral' {
    if (!command) return 'neutral';

    // 1. 匹配 PowerShell 专属特征
    const psPatterns = [
        /\$[a-zA-Z0-9_:]+/,                // 变量或环境变量，如 $env:SystemRoot
        /\b[A-Z][a-z]+-[A-Z][a-z]+\b/,     // 标准 Cmdlet，如 Get-ChildItem
        /\s-[a-zA-Z]{2,}\b/,               // PS 参数风格，如 -Path
        /\[[a-zA-Z0-9_.]+\]::/,            // .NET 静态方法调用
        /\|\s*(%|\?|ForEach-Object|Where-Object)/ // PS 特有的管道符简写
    ];

    // 2. 匹配 CMD 专属特征
    const cmdPatterns = [
        /%[a-zA-Z0-9_]+%/,                 // CMD 环境变量，如 %SystemRoot%
        /\b(dir|del|copy|xcopy|rmdir|mkdir|ren|move)\s+\/[a-zA-Z]\b/i, // CMD 基础命令带 /参数
        />nul\b/i,                         // CMD 黑洞重定向
        /\b(mklink|setx)\b/i               // CMD 特有的内置命令
    ];

    const isPS = psPatterns.some(regex => regex.test(command));
    const isCmd = cmdPatterns.some(regex => regex.test(command));

    if (isPS) return 'powershell';
    if (isCmd) return 'cmd';

    return 'neutral';
}

export function getConsoleType(): string {
    try {
        const envPath = path.resolve(process.cwd(), '.ccli', 'data', '01环境.md');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const match = envContent.match(/Shell:\s*(.+)/);
            if (match && match[1]) {
                return match[1].trim().toLowerCase();
            }
        }
    } catch (e) {}
    return 'powershell';
}

export function injectExecutionEnv(command: string): Record<string, string | undefined> {
    const env = { ...process.env };
    if (process.platform === 'win32') {
        if (/python/i.test(command) || /\.py/i.test(command)) {
            env['PYTHONIOENCODING'] = 'utf-8';
        }
    }
    return env;
}

export function spawnDetachedWindow(command: string, keepOpen: boolean = true) {
    const currentConsole = getConsoleType();
    let winCmd = '';

    if (process.platform === 'win32') {
        if (keepOpen) {
            if (currentConsole.includes('powershell')) {
                const psExe = currentConsole.includes('7') ? 'pwsh' : 'powershell';
                winCmd = `${psExe} -Command "Start-Process ${psExe} -ArgumentList '-NoExit', '-Command', '${command.replace(/'/g, "''")}'"`;
            } else {
                winCmd = `cmd.exe /c "start cmd.exe /k ${command.replace(/"/g, '\\"')}"`;
            }
        } else {
            winCmd = `cmd.exe /c "start \"\" /NORMAL ${command}"`;
        }
    } else if (process.platform === 'darwin') {
        if (keepOpen) {
            winCmd = `osascript -e 'tell app "Terminal" to do script "${command.replace(/"/g, '\\"')}"'`;
        } else {
            winCmd = `nohup ${command} > /dev/null 2>&1 &`;
        }
    } else {
        if (keepOpen) {
            winCmd = `x-terminal-emulator -e "${command.replace(/"/g, '\\"')}"`;
        } else {
            winCmd = `nohup ${command} > /dev/null 2>&1 &`;
        }
    }

    const options: any = { shell: true, detached: true, env: injectExecutionEnv(command) };
    if (!keepOpen) {
        options.stdio = 'ignore';
    }

    execa(winCmd, options).unref();
}