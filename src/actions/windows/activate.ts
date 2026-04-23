import { ActionResult } from '../base.js';
import { KeyboardAction } from '../keyboard.action.js';
import { sysLogger, LogLevel } from '../../core/logger.js';

/**
 * 针对特定应用的全局快捷键唤醒逻辑
 */
export async function handleActivate(target: string): Promise<ActionResult | null> {
    const keyboardAction = new KeyboardAction();
    let shortcut: string | null = null;

    // 针对不同应用配置对应的唤醒快捷键
    if (target === 'Weixin') {
        shortcut = '^%w'; // 微信默认: Ctrl + Alt + W
    } 
    // 后续可在此处扩展其他应用，例如：
    // else if (target === 'DingTalk') { shortcut = '^%f'; }

    if (shortcut) {
        sysLogger.log(LogLevel.INFO, `检测到特化目标 ${target}，尝试通过全局快捷键 [${shortcut}] 唤醒`);
        
        // 执行键盘模拟动作
        await keyboardAction.execute({ action: 'type' }, shortcut);
        
        return {
            type: 'window',
            content: `【系统自动反馈】窗口动作 activate 已针对特化目标 "${target}" 通过全局快捷键执行唤醒。`
        };
    }

    // 若未匹配到任何特化方案，返回 null 以便外层逻辑退回到标准的窗口句柄寻找模式
    return null;
}