import { chromium, type BrowserContext, type Page, type Browser } from 'playwright';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
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
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
                signal: AbortSignal.timeout(1000)
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取全局共享的 CDP 浏览器宿主连接。
     * 保证 <browser>, <assert> 共享相同的 DOM 环境和登录态。
     */
    public static async getSharedPage(): Promise<{ browser: Browser, context: BrowserContext, page: Page }> {
        // 如果当前内存中已有存活的页面实例，复用连接并动态追踪最新页面，避免反复触发 CDP 握手
        if (this.browser && this.context && this.page && !this.page.isClosed()) {
            const pages = this.context.pages();
            const validPages = pages.filter(p => !p.isClosed());

            if (validPages.length > 0) {
                this.page = validPages[validPages.length - 1];

                if (validPages.length > 1) {
                    for (let i = 0; i < validPages.length - 1; i++) {
                        validPages[i].close().catch(() => {});
                    }
                }
            } else {
                this.page = await this.context.newPage();
            }

            return { browser: this.browser, context: this.context, page: this.page };
        }

        const isOpen = await this.isPortOpen(CDP_PORT);

        if (!isOpen) {
            sysLogger.log(LogLevel.INFO, `检测到浏览器自动化宿主未启动，正在拉起持久化守护进程 (端口: ${CDP_PORT})...`);
            let chromePath = '';
            let browserName = 'chrome';

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
                        if (p.includes('msedge.exe')) browserName = 'edge';
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

            for (let i = 0; i < 30; i++) {
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

        const validPages = pages.filter(p => !p.isClosed());

        if (validPages.length > 0) {
            this.page = validPages[validPages.length - 1];

            if (validPages.length > 1) {
                for (let i = 0; i < validPages.length - 1; i++) {
                    validPages[i].close().catch(() => {});
                }
            }
        } else {
            this.page = await this.context.newPage();
        }

        return { browser: this.browser, context: this.context, page: this.page };
    }
}