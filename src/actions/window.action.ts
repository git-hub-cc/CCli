import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { execa } from 'execa';
import { handleActivate } from './windows/activate.js';

/**
 * 处理 <window> 标签：管理操作系统窗口生命周期与物理属性提取
 */
export class WindowAction extends BaseAction {
    tag = 'window';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];
        const target = attributes['target'];

        if (!action) {
            throw new Error('<window> 标签缺少必填属性 action');
        }
        if (!target) {
            throw new Error('<window> 标签缺少必填属性 target');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行窗口操作: ${action} -> ${target}`);

        // 优先尝试特化唤醒逻辑（如快捷键唤醒）
        if (action.toLowerCase() === 'activate') {
            const specialResult = await handleActivate(target);
            if (specialResult) {
                return specialResult;
            }
        }

        try {
            if (process.platform === 'win32') {
                const safeTarget = target.replace(/'/g, "''");
                const psScript = `
                    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
                    Add-Type @"
                    using System;
                    using System.Runtime.InteropServices;
                    using System.Text;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                        [DllImport("user32.dll")]
                        public static extern bool IsIconic(IntPtr hWnd);
                        [DllImport("user32.dll", SetLastError = true)]
                        public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
                        [StructLayout(LayoutKind.Sequential)]
                        public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
                    }
"@
                    $processes = Get-Process | Where-Object { ($_.MainWindowTitle -like '*${safeTarget}*' -or $_.ProcessName -like '*${safeTarget}*') -and $_.MainWindowHandle -ne 0 }
                    if (-not $processes) { Write-Output "NOT_FOUND"; exit 0 }
                    
                    $validProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
                    if (-not $validProcess) { Write-Output "NO_HWND"; exit 0 }
                    
                    $hwnd = $validProcess.MainWindowHandle
                    
                    $action = '${action}'.ToLower()
                    if ($action -eq 'activate') {
                        if ([Win32]::IsIconic($hwnd)) { [Win32]::ShowWindowAsync($hwnd, 9) | Out-Null }
                        [Win32]::SetForegroundWindow($hwnd) | Out-Null
                        Write-Output "SUCCESS"
                    } elseif ($action -eq 'close') {
                        $validProcess.CloseMainWindow() | Out-Null
                        Write-Output "SUCCESS"
                    } elseif ($action -eq 'min') {
                        [Win32]::ShowWindowAsync($hwnd, 2) | Out-Null
                        Write-Output "SUCCESS"
                    } elseif ($action -eq 'max') {
                        [Win32]::ShowWindowAsync($hwnd, 3) | Out-Null
                        Write-Output "SUCCESS"
                    } elseif ($action -eq 'restore') {
                        [Win32]::ShowWindowAsync($hwnd, 9) | Out-Null
                        Write-Output "SUCCESS"
                    } elseif ($action -eq 'info') {
                        $rect = New-Object Win32+RECT
                        [Win32]::GetWindowRect($hwnd, [ref]$rect) > $null
                        $w = $rect.Right - $rect.Left
                        $h = $rect.Bottom - $rect.Top
                        $title = $validProcess.MainWindowTitle
                        Write-Output "INFO|$title|$($rect.Left)|$($rect.Top)|$w|$h"
                    } else {
                        Write-Output "UNSUPPORTED"
                    }
                `;

                const { stdout } = await execa('powershell', ['-NoProfile', '-Command', psScript]);
                const out = stdout.trim();

                if (out === 'NOT_FOUND' || out === 'NO_HWND') {
                    throw new Error(`未找到匹配的窗口或窗口无句柄: ${target}`);
                }

                if (out.startsWith('INFO|')) {
                    const [, title, x, y, w, h] = out.split('|');
                    return {
                        type: 'window',
                        content: `【系统自动反馈：窗口物理信息】\n目标窗口: ${title}\n绝对坐标 (X, Y): ${x}, ${y}\n物理尺寸 (宽 x 高): ${w} x ${h}\n`
                    };
                }

                if (action.toLowerCase() === 'extract_text') {
                    return {
                        type: 'window',
                        content: `【系统自动反馈】提取传统窗口纯文本需要视觉配合，请结合 <vision action="ocr"> 标签进行图像层面的抓取。`
                    };
                }

                if (out === 'UNSUPPORTED') {
                    throw new Error(`不支持的窗口动作: ${action}`);
                }

                return {
                    type: 'window',
                    content: `【系统自动反馈】窗口动作 ${action} 已对 "${target}" 执行完毕。`
                };
            } else {
                throw new Error('目前原生窗口底层控制暂仅支持 Windows 平台。');
            }
        } catch (err: any) {
            throw new Error(`窗口操作异常: ${err.stderr || err.message}`);
        }
    }
}