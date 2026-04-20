import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import ora from 'ora';
import os from 'os';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';

const AUTH_DIR = path.join(os.homedir(), '.ccli', 'profiles','doubao');

export class DoubaoWebProvider implements ILLMProvider {
    name = 'DoubaoWeb';
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
            // 定位输入框 (采用明确的类名和特征进行定位)
            const inputLocator = this.page.locator('textarea.semi-input-textarea, textarea[placeholder*="发消息"]').last();
            await inputLocator.waitFor({ state: 'visible', timeout: 15000 });
            await inputLocator.click();
            await this.page.keyboard.insertText(prompt);

            // 发送按钮定位 (使用新版 DOM 的确切 ID 作为首选)
            const sendButton = this.page.locator('#flow-end-msg-send, button[data-testid="chat-send-button"]').last();
            await sendButton.waitFor({ state: 'visible' });
            await sendButton.click();

            // 动态等待流式输出状态
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
                                // 连续数周期稳定，视为输出完毕
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

                // 精确划定作用域：直接锁定最后一个 AI 的操作栏
                const receiveActionBar = this.page.locator('[data-foundation-type="receive-message-action-bar"]').last();

                // 确保页面在前台并激活悬浮状态，让按钮显示出来
                await this.page.bringToFront();
                await receiveActionBar.hover();

                // 兼容性定位：结合旧逻辑 + 最新的 SVG Path 特征硬定位
                const copyBtn = receiveActionBar.locator([
                    'button[title*="复制"]',
                    'button[aria-label*="复制"]',
                    'button:has(svg path[d^="M15.0664"])'
                ].join(', ')).first();

                await copyBtn.waitFor({ state: 'attached', timeout: 5000 });
                await copyBtn.scrollIntoViewIfNeeded();
                await copyBtn.click({ force: true });

                // 给剪贴板一点写入时间
                await this.page.waitForTimeout(800);
                responseText = await this.page.evaluate(() => navigator.clipboard.readText());

                if (!responseText || responseText.trim() === '') {
                    throw new Error('复制成功但剪贴板为空');
                }
            } catch (copyError: any) {
                sysLogger.log(LogLevel.WARN, '复制按钮提取失败，降级为 DOM 文本抓取。');

                // 只抓 AI 的区块，防止抓到用户发送的内容
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

            // 摒弃传统寻找 input[type=file] 的 DOM 依赖，改为在 Node 端读取文件并转换为 Base64 注入页面
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
                // 将 Base64 还原为 Blob 对象，并组装成原生的 File 实体
                const response = await fetch(`data:${mimeType};base64,${base64}`);
                const blob = await response.blob();
                const file = new File([blob], name, { type: mimeType });

                // 构造 DataTransfer 对象以模拟真实的系统剪贴板数据
                const dt = new DataTransfer();
                dt.items.add(file);

                // 向当前激活的输入框派发原生的 paste 粘贴事件，完美绕过前端风控拦截
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
        if (this.context) await this.context.close();
    }
}