import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { BrowserService } from '../core/browser-service.js';
import { execa } from 'execa';

export class AssertAction extends BaseAction {
    tag = 'assert';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const type = (attributes['type'] || '').toLowerCase();
        const target = attributes['target'];
        const timeout = parseInt(attributes['timeout'] || '5000', 10);

        if (!type || !target) {
            throw new Error('<assert> 标签缺少必填属性 type 和 target');
        }

        sysLogger.log(LogLevel.ACTION, `执行刚性断言: [${type}] 目标: ${target}`);

        try {
            if (type === 'ui_exist') {
                const { page } = await BrowserService.getSharedPage();
                try {
                    // 支持使用 data-ccli-id 或常规文本选择器进行断言
                    const selector = target.match(/^\d+$/) ? `[data-ccli-id="${target}"]` : `text="${target}"`;
                    await page.waitForSelector(selector, { state: 'attached', timeout });
                    return { type: 'assert', content: `【断言成功】UI 元素 "${target}" 存在。` };
                } catch (e) {
                    throw new Error(`【动作被拒绝】UI 断言失败: 元素 "${target}" 在 ${timeout}ms 内未出现。`);
                }
            }

            if (type === 'text_exist') {
                const { page } = await BrowserService.getSharedPage();
                try {
                    await page.waitForFunction((text) => {
                        return document.body.innerText.includes(text);
                    }, target, { timeout });
                    return { type: 'assert', content: `【断言成功】屏幕文本 "${target}" 存在。` };
                } catch (e) {
                    throw new Error(`【动作被拒绝】文本断言失败: 网页中未找到文本 "${target}"。`);
                }
            }

            if (type === 'window_active') {
                if (process.platform === 'win32') {
                    const safeTarget = target.replace(/'/g, "''");
                    const psScript = `
                        Add-Type @"
                        using System;
                        using System.Runtime.InteropServices;
                        using System.Text;
                        public class Win32 {
                            [DllImport("user32.dll")]
                            public static extern IntPtr GetForegroundWindow();
                            [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
                            public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
                        }
"@
                        $hwnd = [Win32]::GetForegroundWindow()
                        $sb = New-Object System.Text.StringBuilder 500
                        [Win32]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null
                        $title = $sb.ToString()
                        if ($title -match '${safeTarget}') { Write-Output "PASS" } else { Write-Output "FAIL|$title" }
                    `;
                    
                    const checkInterval = 500;
                    const maxAttempts = Math.max(1, Math.floor(timeout / checkInterval));
                    
                    for (let i = 0; i < maxAttempts; i++) {
                        const { stdout } = await execa('powershell', ['-NoProfile', '-Command', psScript]);
                        if (stdout.trim().startsWith('PASS')) {
                            return { type: 'assert', content: `【断言成功】窗口 "${target}" 处于前台激活状态。` };
                        }
                        await new Promise(r => setTimeout(r, checkInterval));
                    }
                    throw new Error(`【动作被拒绝】窗口断言失败: "${target}" 未在前台激活。`);
                } else {
                    throw new Error('原生前台窗口断言暂仅支持 Windows 平台。');
                }
            }

            throw new Error(`不支持的断言类型: ${type}`);

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, err.message);
            throw err;
        }
    }
}