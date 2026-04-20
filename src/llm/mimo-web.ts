import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import ora from 'ora';
import os from 'os';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles', 'mimo');

export class MimoWebProvider implements ILLMProvider {
    name = 'MimoWeb';
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async init(headless: boolean = false): Promise<void> {
        const isFirstTime = !fs.existsSync(AUTH_DIR);
        const finalHeadless = isFirstTime ? false : headless;

        this.context = await chromium.launchPersistentContext(AUTH_DIR, {
            headless: finalHeadless,
            viewport: { width: 1280, height: 720 },
            channel: 'chrome',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            permissions: ['clipboard-read', 'clipboard-write'],
        });

        await this.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        });

        this.page = this.context.pages()[0] || await this.context.newPage();

        await this.page.goto('https://aistudio.xiaomimimo.com/#/c', { waitUntil: 'domcontentloaded' });

        if (isFirstTime) {
            sysLogger.log(LogLevel.WARN, '首次运行，请在弹出的浏览器窗口中登录小米账号。');
            sysLogger.log(LogLevel.WARN, '登录完成后，请在终端按 Ctrl+C 关闭程序，然后重新运行即可进入静默工作模式。');
            await new Promise(() => {});
        }
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        if (!this.page) throw new Error('浏览器尚未初始化');

        const spinner = ora('等待 Mimo 响应...').start();

        try {
            const inputLocator = this.page.locator('textarea').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });
            await inputLocator.click();
            await this.page.keyboard.insertText(prompt);

            await this.page.waitForTimeout(300);
            await this.page.keyboard.press('Enter');

            // 预留缓冲时间，等待网络请求发出并清空输入框
            await this.page.waitForTimeout(12000);

            try {
                await this.page.waitForFunction(() => {
                    return new Promise((resolve) => {
                        let lastText = '';
                        let stableCycles = 0;

                        const checkInterval = setInterval(() => {
                            // 放弃特定的类名依赖，直接监控整个页面的文本变动状态
                            // 这对防止遇到未知且动态的 CSS 容器类名非常有效
                            const currentText = document.body.innerText || '';

                            if (currentText.length > 0 && currentText === lastText) {
                                stableCycles++;
                                // 连续 3 个周期 (1.5秒) 无变化，视为流式输出完成
                                if (stableCycles >= 3) {
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

                await this.page.bringToFront();

                // 使用 SVG 特征指纹精确定位复制按钮，绕过无 title/aria-label 的限制
                // 对应路径: d="M7 9.667A2.667..."
                const copyBtn = this.page.locator('button:has(svg path[d^="M7 9.667"])').last();

                // 尝试 hover 激活所在区域，防止按钮处于透明或隐藏状态
                await copyBtn.hover({ force: true }).catch(() => {});

                await copyBtn.waitFor({ state: 'attached', timeout: 5000 });
                await copyBtn.scrollIntoViewIfNeeded();
                await copyBtn.click({ force: true });

                await this.page.waitForTimeout(800);
                responseText = await this.page.evaluate(() => navigator.clipboard.readText());

                if (!responseText || responseText.trim() === '') {
                    throw new Error('复制成功但剪贴板为空');
                }
            } catch (copyError: any) {
                sysLogger.log(LogLevel.WARN, `复制按钮提取失败 (${copyError.message})，降级为 DOM 文本抓取。`);

                // fallback 粗略抓取，如果无法点击，则抓取最后一个可能包含文本的区块
                const textBlocks = this.page.locator('div[class*="message"], div.prose, .markdown-body');
                if (await textBlocks.count() > 0) {
                    const lastBlock = textBlocks.last();
                    responseText = await lastBlock.innerText();
                } else {
                    responseText = '未能提取到有效内容，页面结构可能极其特殊。';
                }
            }

            spinner.succeed('已成功提取 Mimo 响应报文');
            return responseText.trim();

        } catch (error: any) {
            spinner.fail('与 Mimo 交互链路发生异常');
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, '正在物理重置 Mimo 网页会话...');
        try {
            await this.page.goto('https://aistudio.xiaomimimo.com/#/c', { waitUntil: 'domcontentloaded' });

            const inputLocator = this.page.locator('textarea').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });

            await this.page.waitForTimeout(2000);

            sysLogger.log(LogLevel.SUCCESS, '网页会话已重置。');
        } catch (error: any) {
            sysLogger.log(LogLevel.ERROR, `重置会话失败: ${error.message}`);
        }
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        if (!this.page) throw new Error('浏览器尚未初始化');
        sysLogger.log(LogLevel.INFO, `正在将文件注入 Mimo 环境: ${path.basename(absolutePath)} (网格: ${useGrid})`);

        try {
            const processedPath = useGrid
                ? await addGridToImage(absolutePath, path.dirname(absolutePath))
                : absolutePath;

            const fileInput = this.page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
                await fileInput.setInputFiles(processedPath);
                await this.page.waitForTimeout(3000);
                sysLogger.log(LogLevel.SUCCESS, '文件已通过原生文件输入框成功挂载。');
            } else {
                sysLogger.log(LogLevel.WARN, '未找到原生文件上传元素，尝试剪贴板回退策略...');

                const inputBox = this.page.locator('textarea').last();
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
        if (this.context) await this.context.close();
    }
}