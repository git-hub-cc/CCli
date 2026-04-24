import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

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