import { execa } from 'execa';
import { sysLogger, LogLevel } from '../../core/logger.js';
import { ActionResult } from '../base.js';

export async function handleActivate(target: string): Promise<ActionResult | null> {
    sysLogger.log(LogLevel.INFO, `尝试通过底层 API 激活窗口: ${target}`);

    if (process.platform !== 'win32') {
        return null;
    }

    try {
        const safeTarget = target.replace(/'/g, "''");
        const psScript = `
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
                [DllImport("user32.dll")]
                [return: MarshalAs(UnmanagedType.Bool)]
                public static extern bool SetForegroundWindow(IntPtr hWnd);

                [DllImport("user32.dll")]
                public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

                [DllImport("user32.dll")]
                public static extern bool IsIconic(IntPtr hWnd);
            }
"@
            $processes = Get-Process | Where-Object { ($_.MainWindowTitle -like '*${safeTarget}*' -or $_.ProcessName -like '*${safeTarget}*') -and $_.MainWindowHandle -ne 0 }

            if (-not $processes) {
                Write-Output "NOT_FOUND"
                exit 0
            }

            $validProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
            if (-not $validProcess) {
                Write-Output "NOT_FOUND"
                exit 0
            }

            $hwnd = $validProcess.MainWindowHandle
            if ([Win32]::IsIconic($hwnd)) {
                [Win32]::ShowWindowAsync($hwnd, 9) | Out-Null
            }

            $success = [Win32]::SetForegroundWindow($hwnd)
            if ($success) {
                Write-Output "SUCCESS|$($validProcess.MainWindowTitle)"
            } else {
                Write-Output "FAILED"
            }
        `;

        const { stdout } = await execa('powershell', ['-NoProfile', '-Command', psScript]);
        const out = stdout.trim();

        if (out.startsWith('SUCCESS|')) {
            const title = out.split('|')[1];
            return {
                type: 'window',
                content: `【系统自动反馈】已成功激活并置顶窗口: ${title}`
            };
        } else if (out === 'NOT_FOUND') {
            throw new Error(`无法激活窗口: 未找到名称包含 "${target}" 的运行中应用。`);
        } else {
            throw new Error(`激活窗口失败，系统底层 API 拒绝了该操作。`);
        }
    } catch (error: any) {
        throw new Error(`激活窗口时发生异常: ${error.message}`);
    }
}