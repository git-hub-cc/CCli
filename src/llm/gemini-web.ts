import { type BrowserContext, type Page, type Browser } from 'playwright';
import path from 'path';
import fs from 'fs';
import ora from 'ora';
import os from 'os';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';
import { BrowserDaemon } from './browser-daemon.js';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles', 'gemini');
const CDP_PORT = 9226;

export class GeminiWebProvider implements ILLMProvider {
    name = 'GeminiWeb';
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async init(headless: boolean = false): Promise<void> {
        const isFirstTime = !fs.existsSync(AUTH_DIR);
        const finalHeadless = isFirstTime ? false : headless;

        this.browser = await BrowserDaemon.connect('Gemini', CDP_PORT, AUTH_DIR, finalHeadless);
        this.context = this.browser.contexts()[0];
        
        this.page = await this.context.newPage();

        await this.page.route('**/*.{css,woff2}', route => route.abort());
        await this.page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });

        if (isFirstTime) {
            sysLogger.log(LogLevel.WARN, '首次运行，请在弹出的浏览器窗口中登录 Google 账号。');
            sysLogger.log(LogLevel.WARN, '登录完成后，请在终端按 Ctrl+C 关闭程序，然后重新运行即可进入静默工作模式。');
            await new Promise(() => {});
        }
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        if (!this.page) throw new Error('浏览器尚未初始化');

        const spinner = ora('等待 Gemini 响应...').start();

        try {
            const inputLocator = this.page.locator('rich-textarea');
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });
            await inputLocator.click();
            await this.page.keyboard.insertText(prompt);

            const responseLocator = this.page.locator('message-content, .message-content, model-response');
            const initialCount = await responseLocator.count();

            const sendButton = this.page.locator('button[aria-label*="Send message" i], button.send-button').last();
            await sendButton.waitFor({ state: 'visible' });
            await sendButton.click();

            try {
                await this.page.waitForFunction((initial) => {
                    const elements = document.querySelectorAll('message-content, .message-content, model-response');
                    return elements.length > initial;
                }, initialCount, { timeout: 30000 });
            } catch (e) {
            }

            try {
                await this.page.waitForFunction(() => {
                    return new Promise((resolve) => {
                        let lastText = '';
                        let stableCycles = 0;

                        const checkInterval = setInterval(() => {
                            const nodes = document.querySelectorAll('message-content, .message-content, model-response');
                            if (nodes.length === 0) return;

                            const targetNode = nodes[nodes.length - 1];
                            const currentText = targetNode?.textContent || '';

                            const cleanText = currentText.replace(/Reviewing the Context|Answer now|Gemini said/ig, '').trim();

                            if (cleanText.length > 0 && cleanText === lastText) {
                                stableCycles++;
                                if (stableCycles >= 8) {
                                    clearInterval(checkInterval);
                                    resolve(true);
                                }
                            } else {
                                lastText = cleanText;
                                stableCycles = 0;
                            }
                        }, 500);
                    });
                }, undefined, { timeout: 150000 });
            } catch (e) {
                spinner.text = '⚠ 动态等待内容渲染超时，准备强制提取...';
            }

            let fallbackText = '';
            try {
                await this.page.waitForTimeout(1000);
                const responses = await responseLocator.allInnerTexts();
                const validResponses = responses.filter(text => text.trim().length > 0);
                fallbackText = validResponses[validResponses.length - 1] || '';
            } catch (e) {}

            let responseText = '';
            try {
                await this.page.evaluate(() => navigator.clipboard.writeText(''));

                const latestMessageBlock = this.page.locator('model-response').last();
                const copyBtn = latestMessageBlock.locator('button[aria-label*="Copy" i], button[aria-label*="复制" i], button[mattooltip*="Copy" i], button[mattooltip*="复制" i]').last();

                await this.page.bringToFront();
                await latestMessageBlock.hover();

                await copyBtn.waitFor({ state: 'attached', timeout: 5000 });
                await copyBtn.scrollIntoViewIfNeeded();
                await copyBtn.click({ force: true });
                await this.page.waitForTimeout(800);

                const markdownText = await this.page.evaluate(() => navigator.clipboard.readText());

                if (markdownText && markdownText.trim().length > 0) {
                    responseText = markdownText;
                } else {
                    throw new Error("成功点击但剪贴板内容为空");
                }
            } catch (copyError: any) {
                sysLogger.log(LogLevel.WARN, `UI提取 Markdown 格式失败 (${copyError.message})，已回退至纯文本模式。`);
                responseText = fallbackText ? fallbackText : '未能提取到回复内容（可能是页面结构改变或未生成完整）';
            }

            spinner.succeed('已成功提取 AI 响应报文');

            const finalCleanText = responseText.replace(/Reviewing the Context|Answer now|Gemini said/ig, '').trim();
            return finalCleanText.replace(/\\</g, '<').replace(/\\>/g, '>').replace(/\\\//g, '/');

        } catch (error: any) {
            spinner.fail('与 Gemini 交互链路发生异常');
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, '正在物理重置 Gemini 网页会话...');
        try {
            await this.page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
            await this.page.locator('rich-textarea').waitFor({ state: 'visible', timeout: 15000 });
            sysLogger.log(LogLevel.SUCCESS, '网页会话已重置。');
        } catch (error: any) {
            sysLogger.log(LogLevel.ERROR, `重置会话失败: ${error.message}`);
        }
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');

        sysLogger.log(LogLevel.INFO, `正在将文件注入 Gemini 环境: ${path.basename(absolutePath)} (网格: ${useGrid})`);

        try {
            const processedPath = useGrid
                ? await addGridToImage(absolutePath, path.dirname(absolutePath))
                : absolutePath;

            const addBtn = this.page.locator('button').filter({ has: this.page.locator('mat-icon[data-mat-icon-name="add_2"]') }).first();
            await addBtn.waitFor({ state: 'visible', timeout: 5000 });
            await addBtn.click();

            const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 5000 });

            const uploadBtn = this.page.locator('button, [role="menuitem"]').filter({ has: this.page.locator('mat-icon[data-mat-icon-name="attach_file"]') }).first();
            await uploadBtn.waitFor({ state: 'visible', timeout: 5000 });
            await uploadBtn.click();

            const fileChooser = await fileChooserPromise;
            // Gemini 的原生文件输入支持文本、图片及常见二进制文件（如 pdf, docx 等）
            await fileChooser.setFiles(processedPath);

            await this.page.waitForTimeout(3500);
            sysLogger.log(LogLevel.SUCCESS, '文件成功挂载至当前对话环境。');
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `DOM 上传交互失败: ${err.message}`);
            throw err;
        }
    }

    async close(): Promise<void> {
        if (this.page) await this.page.close();
    }
}