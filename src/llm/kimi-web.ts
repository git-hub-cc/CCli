import { type BrowserContext, type Page, type Browser } from 'playwright';
import path from 'path';
import fs from 'fs';
import ora from 'ora';
import os from 'os';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';
import { BrowserDaemon } from './browser-daemon.js';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles', 'kimi');
const CDP_PORT = 9229;

export class KimiWebProvider implements ILLMProvider {
    name = 'KimiWeb';
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async init(headless: boolean = false): Promise<void> {
        const isFirstTime = !fs.existsSync(AUTH_DIR);
        const finalHeadless = isFirstTime ? false : headless;

        this.browser = await BrowserDaemon.connect('Kimi', CDP_PORT, AUTH_DIR, finalHeadless);
        this.context = this.browser.contexts()[0];
        
        this.page = await this.context.newPage();

        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        });

        await this.page.goto('https://kimi.moonshot.cn/', { waitUntil: 'domcontentloaded' });

        if (isFirstTime) {
            sysLogger.log(LogLevel.WARN, '首次运行，请在弹出的浏览器窗口中登录 Kimi 账号。');
            sysLogger.log(LogLevel.WARN, '登录完成后，请在终端按 Ctrl+C 关闭程序，然后重新运行即可进入静默工作模式。');
            await new Promise(() => {});
        }
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        if (!this.page) throw new Error('浏览器尚未初始化');

        const spinner = ora('等待 Kimi 响应...').start();

        try {
            // 定位 Kimi 的富文本输入框
            const inputLocator = this.page.locator('.chat-input-editor[contenteditable="true"]').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });
            await inputLocator.click();
            await this.page.keyboard.insertText(prompt);

            await this.page.waitForTimeout(300);

            // 点击发送按钮或直接回车（✅ 修复 Playwright 定位器语法）
            const sendButton = this.page.locator('.send-button-container:not(.disabled)').last();

            if (await sendButton.isVisible()) {
                await sendButton.click();
            } else {
                await this.page.keyboard.press('Enter');
            }

            // 预留缓冲时间，等待网络请求发出
            await this.page.waitForTimeout(5000);

            try {
                await this.page.waitForFunction(() => {
                    return new Promise((resolve) => {
                        let lastText = '';
                        let stableCycles = 0;

                        const checkInterval = setInterval(() => {
                            // 监控整个页面的文本变动状态，判断流式输出是否完成
                            const currentText = document.body.innerText || '';

                            if (currentText.length > 0 && currentText === lastText) {
                                stableCycles++;
                                // 连续 4 个周期 (2秒) 无变化，视为流式输出完成
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
                await this.page.waitForTimeout(500);
                await this.page.evaluate(() => navigator.clipboard.writeText(''));
                await this.page.bringToFront();

                const copyBtn = this.page.locator('.icon-button:has(svg[name="Copy"]), [title*="复制"], [aria-label*="复制"]').last();

                await copyBtn.hover({ force: true }).catch(() => {});
                await copyBtn.waitFor({ state: 'attached', timeout: 3000 });
                await copyBtn.scrollIntoViewIfNeeded();
                await copyBtn.click({ force: true });

                await this.page.waitForTimeout(800);
                responseText = await this.page.evaluate(() => navigator.clipboard.readText());

                if (!responseText || responseText.trim() === '') {
                    throw new Error('复制成功但剪贴板为空');
                }
            } catch (copyError: any) {
                sysLogger.log(LogLevel.WARN, `复制按钮提取失败，降级为 DOM 文本抓取。`);

                // fallback 粗略抓取，提取最后一个回复块的内容
                const textBlocks = this.page.locator('.markdown-body, [data-role="assistant"] .content');
                if (await textBlocks.count() > 0) {
                    const lastBlock = textBlocks.last();
                    responseText = await lastBlock.innerText();
                } else {
                    responseText = '未能提取到有效内容，页面结构可能发生变化。';
                }
            }

            spinner.succeed('已成功提取 Kimi 响应报文');
            return responseText.trim();

        } catch (error: any) {
            spinner.fail('与 Kimi 交互链路发生异常');
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, '正在物理重置 Kimi 网页会话...');
        try {
            await this.page.goto('https://kimi.moonshot.cn/', { waitUntil: 'domcontentloaded' });

            const inputLocator = this.page.locator('.chat-input-editor[contenteditable="true"]').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });

            await this.page.waitForTimeout(2000);
            sysLogger.log(LogLevel.SUCCESS, '网页会话已重置。');
        } catch (error: any) {
            sysLogger.log(LogLevel.ERROR, `重置会话失败: ${error.message}`);
        }
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, `正在将文件注入 Kimi 环境: ${path.basename(absolutePath)} (网格: ${useGrid})`);

        try {
            const processedPath = useGrid
                ? await addGridToImage(absolutePath, path.dirname(absolutePath))
                : absolutePath;

            // 优先尝试寻找原生的 input[type="file"]
            const fileInput = this.page.locator('input[type="file"].hidden-input').first();
            if (await fileInput.count() > 0) {
                await fileInput.setInputFiles(processedPath);
                await this.page.waitForTimeout(3000);
                sysLogger.log(LogLevel.SUCCESS, '文件已通过原生文件输入框成功挂载。');
            } else {
                sysLogger.log(LogLevel.WARN, '未找到原生文件上传元素，尝试剪贴板回退策略...');

                const inputBox = this.page.locator('.chat-input-editor[contenteditable="true"]').last();
                await inputBox.waitFor({ state: 'visible', timeout: 5000 });
                await inputBox.click();

                const fileBuffer = fs.readFileSync(processedPath);
                const base64Data = fileBuffer.toString('base64');
                const fileName = path.basename(processedPath);
                const ext = path.extname(fileName).toLowerCase();

                let mimeType = 'application/octet-stream';
                if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                    mimeType = `image/${ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '')}`;
                } else if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html'].includes(ext)) {
                    mimeType = 'text/plain';
                } else if (ext === '.pdf') {
                    mimeType = 'application/pdf';
                } else if (ext === '.docx') {
                    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                } else if (ext === '.xlsx') {
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                } else if (ext === '.zip') {
                    mimeType = 'application/zip';
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

                await this.page.waitForTimeout(5000);
                sysLogger.log(LogLevel.SUCCESS, '文件已通过剪贴板事件成功粘贴。');
            }
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `文件挂载交互失败: ${err.message}`);
            throw err;
        }
    }

    async close(): Promise<void> {
        if (this.page) await this.page.close();
    }
}