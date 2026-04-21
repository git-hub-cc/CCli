import { chromium, type Browser } from 'playwright';
import net from 'net';
import { spawn } from 'child_process';
import fs from 'fs';
import { sysLogger, LogLevel } from '../core/logger.js';

/**
 * 探测本地调试端口是否已经开启
 */
function isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, '127.0.0.1');
    });
}

/**
 * 跨进程复用的浏览器守护进程管理器
 * 确保多开复盘窗口时，能够共享登录态并且不发生资源死锁
 */
export class BrowserDaemon {
    static async connect(profileName: string, port: number, authDir: string, headless: boolean): Promise<Browser> {
        const isOpen = await isPortOpen(port);
        
        if (!isOpen) {
            sysLogger.log(LogLevel.INFO, `检测到 ${profileName} 自动化守护进程未启动，正在后台拉起 (端口: ${port})...`);
            let chromePath = '';
            
            if (process.platform === 'win32') {
                chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
                if (!fs.existsSync(chromePath)) {
                    chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
                }
            } else if (process.platform === 'darwin') {
                chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else {
                chromePath = '/usr/bin/google-chrome';
            }

            if (!fs.existsSync(chromePath)) {
                throw new Error(`未能在默认路径找到 Chrome/Edge 浏览器，请检查安装状态。`);
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