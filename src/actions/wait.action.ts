import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { BrowserService } from '../core/browser-service.js';
import { execa } from 'execa';

export class WaitAction extends BaseAction {
    tag = 'wait';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const type = (attributes['type'] || '').toLowerCase();
        const timeout = parseInt(attributes['timeout'] || attributes['time'] || '5000', 10);

        if (!type) {
            throw new Error('<wait> 标签缺少必填属性 type (sleep/networkidle/dom/window)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行等待操作: ${type} (${timeout}ms)`);

        try {
            if (type === 'sleep') {
                await new Promise(r => setTimeout(r, timeout));
                return { type: 'wait', content: `【系统自动反馈】已完成 ${timeout}ms 的休眠等待。` };
            }

            if (type === 'networkidle' || type === 'dom') {
                const condition = type === 'dom' ? 'domcontentloaded' : 'networkidle';
                try {
                    const { page } = await BrowserService.getSharedPage();
                    await page.waitForLoadState(condition, { timeout });
                    return { type: 'wait', content: `【系统自动反馈】网页状态 [${condition}] 已就绪。` };
                } catch (e) {
                    return { type: 'wait', content: `【系统自动反馈】等待网页状态 [${condition}] 超时，已自动放行。` };
                }
            }

            if (type === 'window') {
                const target = attributes['target'];
                if (!target) throw new Error('window 等待缺少 target 属性');

                if (process.platform === 'win32') {
                    const safeTarget = target.replace(/'/g, "''");
                    const checkInterval = 500;
                    const maxAttempts = Math.max(1, Math.floor(timeout / checkInterval));

                    for (let i = 0; i < maxAttempts; i++) {
                        const psScript = `
                            $processes = Get-Process | Where-Object { ($_.MainWindowTitle -match '${safeTarget}' -or $_.ProcessName -match '${safeTarget}') -and $_.MainWindowHandle -ne 0 }
                            if ($processes) { Write-Output "FOUND" } else { Write-Output "WAITING" }
                        `;
                        const { stdout } = await execa('powershell', ['-NoProfile', '-Command', psScript]);
                        if (stdout.trim() === 'FOUND') {
                            return { type: 'wait', content: `【系统自动反馈】目标窗口 "${target}" 已就绪。` };
                        }
                        await new Promise(r => setTimeout(r, checkInterval));
                    }
                    return { type: 'wait', content: `【系统自动反馈】等待窗口 "${target}" 超时，已自动放行。` };
                } else {
                    throw new Error('原生窗口句柄等待暂仅支持 Windows 平台。');
                }
            }

            throw new Error(`不支持的等待类型: ${type}`);

        } catch (err: any) {
            throw new Error(`等待执行异常: ${err.message}`);
        }
    }
}