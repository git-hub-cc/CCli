import { type BrowserContext, type Page, type Browser } from 'playwright';
import path from 'path';
import fs from 'fs';
import ora from 'ora';
import os from 'os';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';
import { BrowserDaemon } from './browser-daemon.js';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles', 'doubao');
const CDP_PORT = 9227;

export class DoubaoWebProvider implements ILLMProvider {
    name = 'DoubaoWeb';
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async init(headless: boolean = false): Promise<void> {
        const isFirstTime = !fs.existsSync(AUTH_DIR);
        const finalHeadless = isFirstTime ? false : headless;

        this.browser = await BrowserDaemon.connect('Doubao', CDP_PORT, AUTH_DIR, finalHeadless);
        this.context = this.browser.contexts()[0];
        
        this.page = await this.context.newPage();

        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        });

        await this.page.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded' });

        if (isFirstTime) {
            sysLogger.log(LogLevel.WARN, '首次运行，请在弹出的浏览器窗口中登录豆包账号。');
            sysLogger.log(LogLevel.WARN, '登录完成后，请在终端按 Ctrl+C 关闭程序，然后重新运行即可进入静默工作模式。');
            await new Promise(() => {});
        }
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        if (!this.page) throw new Error('浏览器尚未初始化');

        const spinner = ora('等待豆包响应...').start();

        try {
            const inputLocator = this.page.locator('textarea.semi-input-textarea, textarea[placeholder*="发消息"]').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });
            await inputLocator.click();
            await this.page.keyboard.insertText(prompt);

            const sendButton = this.page.locator('#flow-end-msg-send, button[data-testid="chat-send-button"]').last();
            await sendButton.waitFor({ state: 'visible' });
            await sendButton.click();

            try {
                await this.page.waitForFunction(() => {
                    return new Promise((resolve) => {
                        let lastText = '';
                        let stableCycles = 0;

                        const checkInterval = setInterval(() => {
                            const nodes = document.querySelectorAll('.flow-markdown-body, [data-testid="chat-message-text"], .message-text');
                            if (nodes.length === 0) return;

                            const targetNode = nodes[nodes.length - 1];
                            const currentText = targetNode?.textContent || '';

                            if (currentText.length > 0 && currentText === lastText) {
                                stableCycles++;
                                if (stableCycles >= 4) {
                                    clearInterval(checkInterval);
                                    resolve(true);
                                }
                            } else {
                                lastText = currentText;
                                stableCycles = 0;
                            }
                        }, 500);
                    });
                }, undefined, { timeout: 120000 });
            } catch (e) {
                spinner.text = '⚠ 动态等待渲染超时，准备强制提取...';
            }

            let responseText = '';
            try {
                await this.page.waitForTimeout(300);
                await this.page.evaluate(() => navigator.clipboard.writeText(''));

                const receiveActionBar = this.page.locator('[data-foundation-type="receive-message-action-bar"]').last();

                await this.page.bringToFront();
                await receiveActionBar.hover();

                const copyBtn = receiveActionBar.locator([
                    'button[title*="复制"]',
                    'button[aria-label*="复制"]',
                    'button:has(svg path[d^="M15.0664"])'
                ].join(', ')).first();

                await copyBtn.waitFor({ state: 'attached', timeout: 5000 });
                await copyBtn.scrollIntoViewIfNeeded();
                await copyBtn.click({ force: true });

                await this.page.waitForTimeout(800);
                responseText = await this.page.evaluate(() => navigator.clipboard.readText());

                if (!responseText || responseText.trim() === '') {
                    throw new Error('复制成功但剪贴板为空');
                }
            } catch (copyError: any) {
                sysLogger.log(LogLevel.WARN, '复制按钮提取失败，降级为 DOM 文本抓取。');

                const aiMessageBlocks = this.page.locator('.flow-markdown-body');
                const lastAiBlock = aiMessageBlocks.last();

                if (await lastAiBlock.isVisible()) {
                    responseText = await lastAiBlock.innerText();
                } else {
                    responseText = '未能提取到有效内容';
                }
            }

            spinner.succeed('已成功提取豆包响应报文');
            return responseText.trim();

        } catch (error: any) {
            spinner.fail('与豆包交互链路发生异常');
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, '正在物理重置豆包网页会话...');
        try {
            await this.page.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded' });

            const inputLocator = this.page.locator('textarea.semi-input-textarea, textarea[placeholder*="发消息"]').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });

            await this.page.waitForTimeout(2000);

            sysLogger.log(LogLevel.SUCCESS, '网页会话已重置。');
        } catch (error: any) {
            sysLogger.log(LogLevel.ERROR, `重置会话失败: ${error.message}`);
        }
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, `正在通过剪贴板模拟注入豆包环境: ${path.basename(absolutePath)} (网格: ${useGrid})`);

        try {
            const processedPath = useGrid
                ? await addGridToImage(absolutePath, path.dirname(absolutePath))
                : absolutePath;

            const inputBox = this.page.locator('textarea.semi-input-textarea, textarea[placeholder*="发消息"]').last();
            await inputBox.waitFor({ state: 'visible', timeout: 5000 });
            await inputBox.click();

            const fileBuffer = fs.readFileSync(processedPath);
            const base64Data = fileBuffer.toString('base64');
            const fileName = path.basename(processedPath);
            const ext = path.extname(fileName).toLowerCase();

            let mimeType = 'text/plain';
            if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                mimeType = `image/${ext.replace('.', '')}`;
            } else if (ext === '.pdf') {
                mimeType = 'application/pdf';
            }

            await this.page.evaluate(async ({ base64, name, mimeType }) => {
                const response = await fetch(`data:${mimeType};base64,${base64}`);
                const blob = await response.blob();
                const file = new File([blob], name, { type: mimeType });

                const dt = new DataTransfer();
                dt.items.add(file);

                const target = document.activeElement || document.body;
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dt
                });

                target.dispatchEvent(pasteEvent);
            }, {
                base64: base64Data,
                name: fileName,
                mimeType: mimeType
            });

            await this.page.waitForTimeout(6000);
            sysLogger.log(LogLevel.SUCCESS, '文件已通过模拟剪贴板事件成功粘贴至对话框。');

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `剪贴板粘贴交互彻底失败: ${err.message}`);
            throw err;
        }
    }

    async close(): Promise<void> {
        if (this.page) await this.page.close();
    }
}