import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

/**
 * 提取 Markdown 文件的 YAML Frontmatter 元数据和正文
 */
export function extractMarkdownMeta(text: string): { meta: Record<string, any>, body: string } {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: text };

    const metaRaw = match[1];
    const body = match[2];
    const meta: Record<string, any> = {};

    metaRaw.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(':').trim();
            if (val.startsWith('[') && val.endsWith(']')) {
                meta[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            } else {
                meta[key] = val.replace(/^["']|["']$/g, '');
            }
        }
    });
    return { meta, body };
}

/**
 * 启发式探测 Windows 命令的 Shell 类型
 * @param command 终端命令字符串
 * @returns 'cmd' | 'powershell' | 'neutral'
 */
export function detectWindowsShellType(command: string): 'cmd' | 'powershell' | 'neutral' {
    if (!command) return 'neutral';

    // 1. 匹配 PowerShell 专属特征
    const psPatterns = [
        /\$[a-zA-Z0-9_:]+/,
        /\b[A-Z][a-z]+-[A-Z][a-z]+\b/,
        /\s-[a-zA-Z]{2,}\b/,
        /\[[a-zA-Z0-9_.]+\]::/,
        /\|\s*(%|\?|ForEach-Object|Where-Object)/
    ];

    // 2. 匹配 CMD 专属特征
    const cmdPatterns = [
        /%[a-zA-Z0-9_]+%/,
        /\b(dir|del|copy|xcopy|rmdir|mkdir|ren|move)\s+\/[a-zA-Z]\b/i,
        />nul\b/i,
        /\b(mklink|setx)\b/i
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

/**
 * 封装通用文件下载功能，用于 Webhook 接收和主动通信下载
 */
export async function downloadFile(url: string, savePath: string, options?: RequestInit): Promise<{status: number, statusText: string}> {
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP 响应异常: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(savePath, buffer);

    return { status: response.status, statusText: response.statusText };
}