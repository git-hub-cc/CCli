import fs from 'fs';
import path from 'path';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { BrowserService } from '../core/browser-service.js';

export class BrowserAction extends BaseAction {
    tag = 'browser';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        if (!action) {
            throw new Error('<browser> 标签缺少必填属性 action (goto/scan/click/fill/select)');
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
                const elementsData = await page.evaluate(() => {
                    let idCounter = 1;
                    const selectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"])';
                    const scanTargets = Array.from(document.querySelectorAll(selectors));

                    document.querySelectorAll('div, span, svg, i').forEach(el => {
                        if (el.hasAttribute('title') || window.getComputedStyle(el).cursor === 'pointer') {
                            scanTargets.push(el);
                        }
                    });

                    const interactables = new Set(scanTargets);
                    const results: any[] = [];
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

                        if (!name.trim() && element.parentElement) {
                            name = element.parentElement.getAttribute('title') || '';
                        }

                        const fallbackName = element.className && typeof element.className === 'string' ? `无文本 [class: ${element.className.trim()}]` : '无文本(可能为图标)';
                        name = name.trim().replace(/\s+/g, ' ').substring(0, 40) || fallbackName;

                        const tagName = element.tagName.toLowerCase();
                        const typeAttr = element.getAttribute('type') ? `:${element.getAttribute('type')}` : '';

                        results.push({
                            id,
                            tagName,
                            typeAttr,
                            name,
                            bbox: {
                                x: rect.left + window.scrollX,
                                y: rect.top + window.scrollY,
                                w: rect.width,
                                h: rect.height
                            }
                        });
                    });
                    return results;
                });

                if (elementsData.length === 0) {
                    return { type: 'browser', content: `【系统自动反馈】页面可视区域内未检测到有效的交互元素。` };
                }

                const formatList = elementsData.map(e => `[${e.id}] ${e.tagName}${e.typeAttr} - ${e.name.startsWith('无文本') ? e.name : `"${e.name}"`}`);

                let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { background: #1a1a1a; color: #00ffff; margin: 0; padding: 0; font-family: sans-serif; }
        .control-box {
            position: absolute;
            border: 1px solid rgba(0, 255, 255, 0.5);
            background: rgba(0, 255, 255, 0.05);
            box-sizing: border-box;
            pointer-events: auto;
            transition: all 0.1s;
        }
        .control-box:hover {
            border: 2px solid #fff;
            background: rgba(0, 255, 255, 0.3);
            z-index: 9999 !important;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        .id-tag {
            background: #007acc;
            color: white;
            padding: 1px 3px;
            font-size: 10px;
            font-weight: bold;
            position: absolute;
            left: -1px;
            top: -1px;
            white-space: nowrap;
        }
        .content-text {
            font-size: 10px;
            color: #fff;
            position: absolute;
            width: calc(100% - 4px);
            left: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            pointer-events: none;
        }
        .content-text.centered {
            bottom: auto;
            top: 50%;
            transform: translateY(-50%);
            text-align: center;
            opacity: 1;
        }
        .content-text.bottom {
            bottom: 1px;
            opacity: 0.8;
            font-size: 9px;
        }
    </style>
</head>
<body>`;

                elementsData.forEach((e: any) => {
                    const titleInfo = `[${e.id}] ${e.tagName}${e.typeAttr}\nName: ${e.name}`;
                    const innerHtml = `<span class="id-tag">[${e.id}]</span>`;

                    htmlContent += `
                    <div class="control-box" title="${titleInfo.replace(/"/g, '&quot;')}"
                         style="left:${e.bbox.x}px; top:${e.bbox.y}px; width:${e.bbox.w}px; height:${e.bbox.h}px; z-index:${100 - Math.floor((e.bbox.w * e.bbox.h) / 10000)};">
                        ${innerHtml}
                    </div>`;
                });

                htmlContent += `</body></html>`;

                const savedHtml = sysLogger.saveScanHtml(htmlContent, 'browser-scan-html');
                const htmlPathDisplay = savedHtml ? savedHtml.relativePath : 'browser-scan-html/001.html';

                const fullContent = `【系统自动反馈：网页交互元素扫描结果】\n已为页面元素分配数字 ID。可视化映射（科技蓝配色）已保存至 \`${htmlPathDisplay}\`。\n------------------------------------------\n${formatList.join('\n')}\n------------------------------------------\n提示：请使用 action="click/fill/select" 并传入 id 执行后续操作。`;
                const savedScan = sysLogger.saveScanResult(fullContent, 'browser-scan');
                const logContent = `【系统自动反馈：网页交互元素扫描结果】\n> 💾 已归档至: [${savedScan?.fileName}](${savedScan?.relativePath})\n提示：请使用 action="click/fill/select" 并传入 id 执行后续操作。`;

                return {
                    type: 'browser',
                    content: logContent,
                    payload: { fullContent }
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
                        const el = node as HTMLElement;
                        if (el.getAttribute('target') === '_blank') el.removeAttribute('target');
                        
                        const aTag = el.closest('a');
                        if (aTag) {
                            aTag.removeAttribute('target');
                            aTag.onclick = (e) => {
                                if (aTag.href && aTag.href !== 'javascript:void(0)') {
                                    e.preventDefault();
                                    window.location.href = aTag.href;
                                }
                            };
                        }
                    }).catch(() => {});
                    
                    await locator.click({ force: true, timeout: 15000 });
                    sysLogger.log(LogLevel.SUCCESS, `已点击元素 [${targetId}]`);
                    return { type: 'browser', content: `【系统自动反馈】已成功点击元素 [${targetId}]。` };
                }
                else if (action === 'fill') {
                    const value = attributes['value'] || content;

                    try {
                        await locator.fill(value, { timeout: 15000 });
                        sysLogger.log(LogLevel.SUCCESS, `已在 [${targetId}] 填入文本`);
                        return { type: 'browser', content: `【系统自动反馈】已成功在输入框 [${targetId}] 填入文本。` };
                    } catch (fillError: any) {
                        sysLogger.log(LogLevel.WARN, `[${targetId}] 不支持直接输入文本，正在尝试寻找相邻输入框容错 (ID±1)...`);

                        const currentIdNum = parseInt(targetId, 10);
                        const fallbackIds = [currentIdNum - 1, currentIdNum + 1];
                        let successId = null;

                        for (const fId of fallbackIds) {
                            if (fId > 0) {
                                const fLocator = page.locator(`[data-ccli-id="${fId}"]`).first();
                                const fCount = await fLocator.count();
                                if (fCount > 0) {
                                    try {
                                        await fLocator.evaluate((node) => {
                                            const el = node as HTMLElement;
                                            el.style.backgroundColor = 'rgba(0, 255, 0, 0.6)';
                                        }).catch(() => {});
                                        await page.waitForTimeout(300);

                                        await fLocator.fill(value, { timeout: 5000 });
                                        successId = fId;
                                        break;
                                    } catch (e) {
                                    }
                                }
                            }
                        }

                        if (successId !== null) {
                            sysLogger.log(LogLevel.SUCCESS, `容错成功：已在相邻元素 [${successId}] 填入文本`);
                            return { type: 'browser', content: `【系统自动反馈】原元素 [${targetId}] 不可输入，已触发动态容错机制，成功在相邻的输入框 [${successId}] 填入文本。` };
                        } else {
                            throw fillError;
                        }
                    }
                }
                else if (action === 'select') {
                    const value = attributes['value'] || content;
                    await locator.selectOption({ label: value }, { timeout: 15000 });
                    sysLogger.log(LogLevel.SUCCESS, `已在 [${targetId}] 选择: ${value}`);
                    return { type: 'browser', content: `【系统自动反馈】已成功在下拉列表 [${targetId}] 选择项："${value}"。` };
                }
            }

            throw new Error(`不支持的 browser 操作: ${action}`);

        } catch (err: any) {
            throw new Error(`浏览器操作异常: ${err.message}`);
        }
    }
}