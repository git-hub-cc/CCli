import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

export function getConsoleType(): string {
    try {
        const envPath = path.resolve(process.cwd(), '.ccli', 'data', '01环境.md');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const match = envContent.match(/控制台:\s*(.+)/);
            if (match && match[1]) {
                return match[1].trim().toLowerCase();
            }
        }
    } catch (e) {}
    return 'powershell';
}

export function spawnDetachedWindow(command: string) {
    const currentConsole = getConsoleType();
    let winCmd = '';

    if (process.platform === 'win32') {
        if (currentConsole.includes('powershell')) {
            const psExe = currentConsole.includes('7') ? 'pwsh' : 'powershell';
            winCmd = `${psExe} -Command "Start-Process ${psExe} -ArgumentList '-NoExit', '-Command', '${command.replace(/'/g, "''")}'"`;
        } else {
            winCmd = `cmd.exe /c "start cmd.exe /k ${command.replace(/"/g, '\\"')}"`;
        }
    } else if (process.platform === 'darwin') {
        winCmd = `osascript -e 'tell app "Terminal" to do script "${command.replace(/"/g, '\\"')}"'`;
    } else {
        winCmd = `x-terminal-emulator -e "${command.replace(/"/g, '\\"')}"`;
    }

    execa(winCmd, { shell: true, detached: true }).unref();
}