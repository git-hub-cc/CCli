import { chromium, type BrowserContext, type Page, type Browser } from 'playwright';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import { sysLogger, LogLevel } from './logger.js';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles', 'automation');
const CDP_PORT = 9225;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

export class BrowserService {
    private static browser: Browser | null = null;
    private static context: BrowserContext | null = null;
    private static page: Page | null = null;

    /**
     * 探测本地调试端口是否已经开启
     */
    private static async isPortOpen(port: number): Promise<boolean> {
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
     * 获取全局共享的 CDP 浏览器宿主连接。
     * 保证 <browser>, <wait>, <assert> 共享相同的 DOM 环境和登录态。
     */
    public static async getSharedPage(): Promise<{ browser: Browser, context: BrowserContext, page: Page }> {
        // 如果当前内存中已有存活的页面实例，直接复用，避免反复触发 CDP 握手
        if (this.page && !this.page.isClosed()) {
            return { browser: this.browser!, context: this.context!, page: this.page };
        }

        const isOpen = await this.isPortOpen(CDP_PORT);
        
        if (!isOpen) {
            sysLogger.log(LogLevel.INFO, `检测到浏览器自动化宿主未启动，正在拉起持久化守护进程 (端口: ${CDP_PORT})...`);
            let chromePath = '';
            let browserName = 'chrome';
            
            if (process.platform === 'win32') {
                chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
                if (!fs.existsSync(chromePath)) {
                    chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
                    browserName = 'edge';
                }
            } else if (process.platform === 'darwin') {
                chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else {
                chromePath = '/usr/bin/google-chrome';
            }

            if (!fs.existsSync(chromePath)) {
                throw new Error(`未能在默认路径找到 Chrome/Edge 浏览器，请检查安装状态。`);
            }

            let logDir = '';
            if (process.env.CCLI_BROWSER_LOG_DIR && fs.existsSync(process.env.CCLI_BROWSER_LOG_DIR)) {
                logDir = process.env.CCLI_BROWSER_LOG_DIR;
            } else if (process.env.CCLI_SESSION_DIR && fs.existsSync(process.env.CCLI_SESSION_DIR)) {
                logDir = process.env.CCLI_SESSION_DIR;
            } else {
                logDir = path.join(process.cwd(), '.ccli', 'logs');
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
            }
            
            const crashLogPath = path.join(logDir, `browser-crash-${browserName}-${CDP_PORT}.log`);
            const errLogStream = fs.openSync(crashLogPath, 'a');

            const child = spawn(chromePath, [
                `--remote-debugging-port=${CDP_PORT}`,
                `--user-data-dir=${AUTH_DIR}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--restore-last-session',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps'
            ], { 
                detached: true, 
                stdio: ['ignore', 'ignore', errLogStream] 
            });
            
            child.unref();

            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 500));
                
                if (child.exitCode !== null) {
                    throw new Error(`浏览器守护进程已意外崩溃退出 (Exit Code: ${child.exitCode})，请检查日志: ${crashLogPath}`);
                }
                
                if (await this.isPortOpen(CDP_PORT)) break;
            }
        }

        this.browser = await chromium.connectOverCDP(CDP_URL, { timeout: 15000 });
        this.context = this.browser.contexts()[0];
        const pages = this.context.pages();
        
        this.page = pages.find(p => !p.isClosed()) || await this.context.newPage();

        return { browser: this.browser, context: this.context, page: this.page };
    }
}