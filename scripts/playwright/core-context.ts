import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles', 'automation');
// 避开常规默认端口，防止与其他前端工具或自带浏览器调试工具冲突导致死锁
const CDP_PORT = 9225;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

/**
 * 探测本地调试端口是否已经开启
 */
async function isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        // 增加 destroy 调用，防止句柄泄露挂起事件循环
        socket.once('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, '127.0.0.1');
    });
}

/**
 * 建立与 CDP 浏览器宿主的连接。如果宿主未启动，则以静默分离模式自动拉起。
 * 从而保证多脚本共享同一套登录态和 DOM 环境。
 */
export async function getConnectedPage(): Promise<{ browser: any, context: BrowserContext, page: Page }> {
    const isOpen = await isPortOpen(CDP_PORT);
    
    if (!isOpen) {
        console.log(`【系统状态反馈】检测到浏览器自动化宿主未启动，正在拉起持久化守护进程 (端口: ${CDP_PORT})...`);
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

        const logDir = path.join(process.cwd(), '.ccli', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const crashLogPath = path.join(logDir, 'browser-crash.log');
        const errLogStream = fs.openSync(crashLogPath, 'a');

        // 以脱离父进程(detached)模式启动，保证 CLI 会话结束后浏览器可独立存活
        const child = spawn(chromePath, [
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${AUTH_DIR}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--restore-last-session'
        ], { 
            detached: true, 
            stdio: ['ignore', 'ignore', errLogStream] 
        });
        
        child.unref();

        // 轮询等待端口就绪
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            
            if (child.exitCode !== null) {
                throw new Error(`浏览器守护进程已意外崩溃退出 (Exit Code: ${child.exitCode})，请检查日志: ${crashLogPath}`);
            }
            
            if (await isPortOpen(CDP_PORT)) break;
        }
    }

    // 显式指定超时，拒绝无限期等待 CDP 握手
    const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 15000 });
    const contexts = browser.contexts();
    const context = contexts[0];
    const pages = context.pages();
    
    // 优先选取非关闭状态的前台标签页，否则开启新页签
    let page = pages.find(p => !p.isClosed());
    if (!page) {
        page = await context.newPage();
    }

    return { browser, context, page };
}