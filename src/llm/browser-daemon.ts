import { chromium, type Browser } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { sysLogger, LogLevel } from '../core/logger.js';

async function isPortOpen(port: number): Promise<boolean> {
    try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
            signal: AbortSignal.timeout(1000)
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

export class BrowserDaemon {
    static async connect(profileName: string, port: number, authDir: string, headless: boolean): Promise<Browser> {
        const isOpen = await isPortOpen(port);

        if (!isOpen) {
            sysLogger.log(LogLevel.INFO, `检测到 ${profileName} 自动化守护进程未启动，正在后台拉起 (端口: ${port})...`);
            let chromePath = '';

            if (process.platform === 'win32') {
                const paths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
                ];
                for (const p of paths) {
                    if (fs.existsSync(p)) {
                        chromePath = p;
                        break;
                    }
                }
            } else if (process.platform === 'darwin') {
                chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else {
                chromePath = '/usr/bin/google-chrome';
            }

            if (!chromePath || !fs.existsSync(chromePath)) {
                throw new Error(`未能在系统常见路径中找到 Chrome/Edge 浏览器，请检查安装状态。`);
            }

            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }

            const args = [
                `--remote-debugging-port=${port}`,
                `--user-data-dir=${authDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--restore-last-session',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars'
            ];

            if (headless) {
                args.push('--headless=new');
            }

            const child = spawn(chromePath, args, {
                detached: true,
                stdio: 'ignore'
            });

            child.unref();

            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 500));
                if (await isPortOpen(port)) break;
            }
        }

        return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 15000 });
    }
}