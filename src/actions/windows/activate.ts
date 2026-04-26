import { ActionResult } from '../base.js';
import { sysLogger, LogLevel } from '../../core/logger.js';
import { execa } from 'execa';
import { localConfig } from '../../core/config.js';

/**
 * 针对特定应用的全局快捷键唤醒逻辑与兜底启动机制
 */
export async function handleActivate(target: string): Promise<ActionResult | null> {
    sysLogger.log(LogLevel.INFO, `尝试通过动态扫描快捷方式唤醒目标: ${target}`);

    if (process.platform === 'win32') {
        try {
            const safeTarget = target.replace(/'/g, "''");
            const psScript = `
                $target = '${safeTarget}'
                $paths = @(
                    [Environment]::GetFolderPath('Desktop'),
                    [Environment]::GetFolderPath('CommonDesktopDirectory'),
                    [Environment]::GetFolderPath('Programs'),
                    [Environment]::GetFolderPath('CommonPrograms'),
                    "$env:APPDATA\\Microsoft\\Internet Explorer\\Quick Launch"
                )

                $validLnk = $null
                foreach ($p in $paths) {
                    if (Test-Path $p) {
                        $lnkFiles = Get-ChildItem -Path $p -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | 
                            Where-Object { $_.Name -match $target -and $_.Name -notmatch '卸载|Uninstall' }
                        if ($lnkFiles) {
                            $validLnk = $lnkFiles | Select-Object -First 1
                            break
                        }
                    }
                }

                if (-not $validLnk) {
                    Write-Output "NOT_FOUND"
                    exit 0
                }

                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($validLnk.FullName)
                $exePath = $shortcut.TargetPath

                if (-not (Test-Path $exePath)) {
                    Write-Output "NOT_FOUND"
                    exit 0
                }

                $exeName = [System.IO.Path]::GetFileNameWithoutExtension($exePath)
                $process = Get-Process -Name $exeName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

                if ($process) {
                    Add-Type @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                        [DllImport("user32.dll")]
                        public static extern bool IsIconic(IntPtr hWnd);
                        // 新增：判断窗口是否实质可见
                        [DllImport("user32.dll")]
                        public static extern bool IsWindowVisible(IntPtr hWnd);
                    }
"@
                    $hwnd = $process.MainWindowHandle
                    
                    # 核心修复：针对 QQ/微信 这种驻留托盘的应用
                    if (-not [Win32]::IsWindowVisible($hwnd)) {
                        # 窗口不可见时，最安全的方式是再次运行快捷方式，触发应用原生唤醒机制
                        Start-Process $validLnk.FullName -ErrorAction SilentlyContinue
                    } else {
                        # 窗口可见但可能被遮挡或最小化时，使用原生 Win32 提权置顶
                        if ([Win32]::IsIconic($hwnd)) { [Win32]::ShowWindowAsync($hwnd, 9) | Out-Null }
                        [Win32]::SetForegroundWindow($hwnd) | Out-Null
                    }
                } else {
                    # 进程未启动，直接运行快捷方式
                    Start-Process $validLnk.FullName -ErrorAction SilentlyContinue
                }

                Write-Output "SUCCESS"
            `;

            const { stdout } = await execa('powershell', ['-NoProfile', '-Command', psScript], { timeout: 10000 });
            
            if (stdout.trim() === 'SUCCESS') {
                await new Promise(r => setTimeout(r, localConfig.windowWait));
                return {
                    type: 'window',
                    content: `【系统自动反馈】窗口动作 activate 已针对目标 "${target}" 尝试动态唤醒成功。`
                };
            }
        } catch (e: any) {
            if (e.timedOut) {
                sysLogger.log(LogLevel.WARN, `动态唤醒超时 (10s): ${target}`);
            } else {
                sysLogger.log(LogLevel.WARN, `动态唤醒异常: ${e.message}`);
            }
        }
    }

    return null;
}