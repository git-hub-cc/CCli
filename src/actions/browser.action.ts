import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { BrowserService } from '../core/browser-service.js';

export class BrowserAction extends BaseAction {
    tag = 'browser';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        if (!action) {
            throw new Error('<browser> 标签缺少必填属性 action (goto/scan/click/fill/select/read)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行浏览器操作: ${action}`);

        try {
            const { page } = await BrowserService.getSharedPage();
            await page.bringToFront();

            if (action === 'goto') {
                let url = (attributes['url'] || content).trim();
                if (!url) throw new Error('goto 操作缺少 url 参数');
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                sysLogger.log(LogLevel.SUCCESS, `成功导航至: ${url}`);
                return { type: 'browser', content: `【系统自动反馈】浏览器已成功导航至: ${url}` };
            } 
            
            else if (action === 'scan') {
                const elements = await page.evaluate(() => {
                    let idCounter = 1;
                    const selectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"]';
                    const interactables = document.querySelectorAll(selectors);
                    const results: string[] = [];
                    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

                    interactables.forEach((el) => {
                        const element = el as HTMLElement;
                        const rect = element.getBoundingClientRect();
                        
                        if (rect.width === 0 || rect.height === 0) return;
                        if (rect.bottom < 0 || rect.top > windowHeight + 500) return;

                        const style = window.getComputedStyle(element);
                        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return;
                        if ((element as any).disabled) return;

                        const id = idCounter++;
                        element.setAttribute('data-ccli-id', id.toString());
                        element.style.outline = '2px dashed rgba(255, 0, 0, 0.7)';
                        element.style.outlineOffset = '2px';

                        let name = element.innerText || element.getAttribute('aria-label') || element.getAttribute('placeholder') || (element as HTMLInputElement).value || element.getAttribute('title') || '';
                        name = name.trim().replace(/\s+/g, ' ').substring(0, 40);

                        const tagName = element.tagName.toLowerCase();
                        const typeAttr = element.getAttribute('type') ? `:${element.getAttribute('type')}` : '';

                        results.push(`[${id}] ${tagName}${typeAttr} - ${name ? `"${name}"` : '无文本(可能为图标)'}`);
                    });
                    return results;
                });

                if (elements.length === 0) {
                    return { type: 'browser', content: `【系统自动反馈】页面可视区域内未检测到有效的交互元素。` };
                }

                return {
                    type: 'browser',
                    content: `【系统自动反馈：网页交互元素扫描结果】\n已为页面元素分配数字 ID。\n------------------------------------------\n${elements.join('\n')}\n------------------------------------------\n提示：请使用 action="click/fill/select" 并传入 id 执行后续操作。`
                };
            }

            else if (action === 'click' || action === 'fill' || action === 'select') {
                const targetId = attributes['id'];
                if (!targetId) throw new Error(`${action} 操作缺少 id 属性`);

                const locator = page.locator(`[data-ccli-id="${targetId}"]`).first();
                const count = await locator.count();
                if (count === 0) {
                    throw new Error(`未找到短 ID 为 [${targetId}] 的元素！页面可能已刷新，请重新 scan。`);
                }

                await locator.evaluate((node) => {
                    const el = node as HTMLElement;
                    el.style.backgroundColor = 'rgba(255, 255, 0, 0.6)';
                    el.style.transition = 'background-color 0.3s';
                });
                await page.waitForTimeout(300);

                if (action === 'click') {
                    await locator.evaluate((node) => {
                        const el = node as HTMLLinkElement;
                        if (el.getAttribute('target') === '_blank') el.removeAttribute('target');
                    }).catch(() => {});
                    await locator.click({ force: true, timeout: 15000 });
                    sysLogger.log(LogLevel.SUCCESS, `已点击元素 [${targetId}]`);
                    return { type: 'browser', content: `【系统自动反馈】已成功点击元素 [${targetId}]。` };
                } 
                else if (action === 'fill') {
                    const value = attributes['value'] || content;
                    await locator.fill(value, { timeout: 15000 });
                    sysLogger.log(LogLevel.SUCCESS, `已在 [${targetId}] 填入文本`);
                    return { type: 'browser', content: `【系统自动反馈】已成功在输入框 [${targetId}] 填入文本。` };
                } 
                else if (action === 'select') {
                    const value = attributes['value'] || content;
                    await locator.selectOption({ label: value }, { timeout: 15000 });
                    sysLogger.log(LogLevel.SUCCESS, `已在 [${targetId}] 选择: ${value}`);
                    return { type: 'browser', content: `【系统自动反馈】已成功在下拉列表 [${targetId}] 选择项："${value}"。` };
                }
            }

            else if (action === 'read') {
                const text = await page.evaluate(() => document.body.innerText);
                return {
                    type: 'browser',
                    content: `【系统自动反馈：页面纯文本内容】\n${text.substring(0, 3000)}${text.length > 3000 ? '\n... (已截断)' : ''}`
                };
            }

            throw new Error(`不支持的 browser 操作: ${action}`);

        } catch (err: any) {
            throw new Error(`浏览器操作异常: ${err.message}`);
        }
    }
}