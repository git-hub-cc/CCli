import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { execa } from 'execa';

export class OsAction extends BaseAction {
    tag = 'os';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        
        if (!action) {
            throw new Error('<os> 标签缺少必填属性 action (mute/volume_up/volume_down/lock/empty_trash)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行系统控制操作: ${action}`);

        try {
            if (process.platform === 'win32') {
                // Windows 原生控制实现 (替代 AHK)
                switch (action) {
                    case 'volume_up':
                        await execa('powershell', ['-NoProfile', '-Command', '(new-object -com wscript.shell).SendKeys([char]175)']);
                        break;
                    case 'volume_down':
                        await execa('powershell', ['-NoProfile', '-Command', '(new-object -com wscript.shell).SendKeys([char]174)']);
                        break;
                    case 'mute':
                        await execa('powershell', ['-NoProfile', '-Command', '(new-object -com wscript.shell).SendKeys([char]173)']);
                        break;
                    case 'lock':
                        await execa('rundll32.exe', ['user32.dll,LockWorkStation']);
                        break;
                    case 'empty_trash':
                        await execa('powershell', ['-NoProfile', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue']);
                        break;
                    default:
                        throw new Error(`不支持的 Windows 系统指令: ${action}`);
                }
            } else if (process.platform === 'darwin') {
                // macOS 原生控制实现
                switch (action) {
                    case 'volume_up':
                        await execa('osascript', ['-e', 'set volume output volume ((output volume of (get volume settings)) + 10)']);
                        break;
                    case 'volume_down':
                        await execa('osascript', ['-e', 'set volume output volume ((output volume of (get volume settings)) - 10)']);
                        break;
                    case 'mute':
                        await execa('osascript', ['-e', 'set volume with output muted']);
                        break;
                    case 'lock':
                        await execa('pmset', ['displaysleepnow']);
                        break;
                    case 'empty_trash':
                        await execa('rm', ['-rf', '~/.Trash/*']);
                        break;
                    default:
                        throw new Error(`不支持的 macOS 系统指令: ${action}`);
                }
            } else {
                throw new Error(`当前操作系统不支持该 <os> 指令: ${action}`);
            }

            sysLogger.log(LogLevel.SUCCESS, `系统控制指令 [${action}] 执行完毕。`);
            return { type: 'os', content: `【系统自动反馈】系统状态控制指令 [${action}] 已执行完毕。` };

        } catch (err: any) {
            throw new Error(`系统控制执行失败: ${err.message}`);
        }
    }
}