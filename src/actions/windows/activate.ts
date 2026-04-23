import { ActionResult } from '../base.js';
import { KeyboardAction } from '../keyboard.action.js';
import { sysLogger, LogLevel } from '../../core/logger.js';
import { execa } from 'execa';

/**
 * 针对特定应用的全局快捷键唤醒逻辑与兜底启动机制
 */
export async function handleActivate(target: string): Promise<ActionResult | null> {
    const keyboardAction = new KeyboardAction();
    let shortcut: string | null = null;

    if (target === 'Weixin') {
        shortcut = '^%w'; // 微信默认: Ctrl + Alt + W
    } 

    if (shortcut) {
        sysLogger.log(LogLevel.INFO, `检测到特化目标 ${target}，尝试通过全局快捷键 [${shortcut}] 唤醒`);
        
        // 执行键盘模拟动作
        await keyboardAction.execute({ action: 'type' }, shortcut);
        
        // 兜底策略：如果快捷键未生效，通过进程检测与绝对路径启动微信
        if (target === 'Weixin' && process.platform === 'win32') {
            sysLogger.log(LogLevel.INFO, `执行快捷键后，尝试通过默认路径兜底唤醒微信进程`);
            try {
                const psScript = `
                    $process = Get-Process WeChat -ErrorAction SilentlyContinue
                    if (-not $process) {
                        $paths = @(
                            "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe",
                            "C:\\Program Files\\Tencent\\Weixin\\Weixin.exe",
                            "C:\\Program Files (x86)\\Tencent\\WeChat\\WeChat.exe",
                            "C:\\Program Files (x86)\\Tencent\\Weixin\\Weixin.exe"
                        )
                        foreach ($p in $paths) {
                            if (Test-Path $p) {
                                Start-Process $p
                                break
                            }
                        }
                    }
                `;
                await execa('powershell', ['-NoProfile', '-Command', psScript]);
            } catch (e) {
                sysLogger.log(LogLevel.WARN, `兜底唤醒异常: ${e}`);
            }
        }

        return {
            type: 'window',
            content: `【系统自动反馈】窗口动作 activate 已针对特化目标 "${target}" 尝试执行唤醒。`
        };
    }

    return null;
}