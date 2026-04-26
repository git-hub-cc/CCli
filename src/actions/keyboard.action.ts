import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { keyboard } from '@nut-tree/nut-js';
import { KeyboardParser } from '../core/keyboard-parser.js';
import { execa } from 'execa';

/**
 * 处理 <keyboard> 标签：执行物理级别的原生键盘模拟输入
 */
export class KeyboardAction extends BaseAction {
    tag = 'keyboard';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];

        if (!action || !['text', 'type'].includes(action.toLowerCase())) {
            throw new Error('<keyboard> 标签缺少合法的 action 属性 (目前仅支持 text 或 type)');
        }
        if (!content) {
            throw new Error('<keyboard> 标签内容不能为空');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行物理键盘操作: [${action}] ${content}`);

        let originalHkl: string | null = null;

        try {
            if (process.platform === 'win32') {
                try {
                    const psGetAndSwitch = `
                        Add-Type @"
                        using System;
                        using System.Runtime.InteropServices;
                        public class Win32 {
                            [DllImport("user32.dll")]
                            public static extern IntPtr GetForegroundWindow();
                            [DllImport("user32.dll")]
                            public static extern uint GetWindowThreadProcessId(IntPtr hwnd, IntPtr proccess);
                            [DllImport("user32.dll")]
                            public static extern IntPtr GetKeyboardLayout(uint thread);
                            [DllImport("user32.dll")]
                            public static extern IntPtr PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                        }
"@
                        $hwnd = [Win32]::GetForegroundWindow()
                        $threadId = [Win32]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)
                        $currentHkl = [Win32]::GetKeyboardLayout($threadId)
                        $engHkl = [IntPtr]0x04090409

                        Write-Output $currentHkl.ToInt64()

                        if ($currentHkl -ne $engHkl) {
                            [Win32]::PostMessage($hwnd, 0x0050, [IntPtr]::Zero, $engHkl) | Out-Null
                        }
                    `;
                    const { stdout } = await execa('powershell', ['-NoProfile', '-Command', psGetAndSwitch]);
                    const hklValue = stdout.trim();

                    if (hklValue && hklValue !== '67699721') {
                        originalHkl = hklValue;
                        await new Promise(r => setTimeout(r, 150));
                    }
                } catch (e) {
                    sysLogger.log(LogLevel.WARN, `尝试记录并切换输入法状态失败: ${e}`);
                }
            }

            keyboard.config.autoDelayMs = 50;

            if (action.toLowerCase() === 'text') {
                await keyboard.type(content);
            } else if (action.toLowerCase() === 'type') {
                const instructions = KeyboardParser.parse(content);

                const hasText = instructions.some(inst => inst.type === 'text');
                if (hasText) {
                    throw new Error('action="type" 仅用于执行快捷键动作，不允许混入普通文本。如需输入文本请使用 action="text"。');
                }

                for (const instruction of instructions) {
                    if (instruction.type === 'hotkey' && instruction.key) {
                        const repeat = instruction.repeat || 1;
                        const modifiers = instruction.modifiers || [];

                        for (let i = 0; i < repeat; i++) {
                            if (modifiers.length > 0) {
                                await keyboard.pressKey(...modifiers);
                            }

                            await keyboard.pressKey(instruction.key);
                            await keyboard.releaseKey(instruction.key);

                            if (modifiers.length > 0) {
                                await keyboard.releaseKey(...modifiers);
                            }
                        }
                    }
                }
            }

            sysLogger.log(LogLevel.SUCCESS, `键盘物理操作完成`);
            return { type: 'keyboard', content: `【系统自动反馈】物理键盘已成功敲击或键入内容。` };
        } catch (err: any) {
            throw new Error(`物理键盘操作异常: ${err.message}`);
        } finally {
            if (originalHkl) {
                try {
                    const psRestore = `
                        Add-Type @"
                        using System;
                        using System.Runtime.InteropServices;
                        public class Win32 {
                            [DllImport("user32.dll")]
                            public static extern IntPtr GetForegroundWindow();
                            [DllImport("user32.dll")]
                            public static extern IntPtr PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                        }
"@
                        $hwnd = [Win32]::GetForegroundWindow()
                        [Win32]::PostMessage($hwnd, 0x0050, [IntPtr]::Zero, [IntPtr]${originalHkl}) | Out-Null
                    `;
                    await execa('powershell', ['-NoProfile', '-Command', psRestore]);
                    sysLogger.log(LogLevel.INFO, '已恢复输入法至初始状态。');
                } catch (e) {
                    sysLogger.log(LogLevel.WARN, `尝试恢复输入法状态失败: ${e}`);
                }
            }
        }
    }
}