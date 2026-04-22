import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { keyboard, Key } from '@nut-tree/nut-js';

/**
 * 处理 <keyboard> 标签：执行物理级别的原生键盘模拟输入
 */
export class KeyboardAction extends BaseAction {
    tag = 'keyboard';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];
        
        if (!action || action.toLowerCase() !== 'type') {
            throw new Error('<keyboard> 标签缺少合法的 action 属性 (目前仅支持 type)');
        }
        if (!content) {
            throw new Error('<keyboard> 标签内容不能为空');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行物理键盘操作: ${content}`);

        try {
            keyboard.config.autoDelayMs = 50;

            // 针对常用 AHK 快捷键风格提供基础适配映射
            if (content.includes('^') || content.includes('{')) {
                const lowerContent = content.toLowerCase();
                if (lowerContent === '^c') {
                    await keyboard.pressKey(Key.LeftControl, Key.C);
                    await keyboard.releaseKey(Key.LeftControl, Key.C);
                } else if (lowerContent === '^v') {
                    await keyboard.pressKey(Key.LeftControl, Key.V);
                    await keyboard.releaseKey(Key.LeftControl, Key.V);
                } else if (lowerContent === '^a') {
                    await keyboard.pressKey(Key.LeftControl, Key.A);
                    await keyboard.releaseKey(Key.LeftControl, Key.A);
                } else if (content === '{Enter}') {
                    await keyboard.pressKey(Key.Return);
                    await keyboard.releaseKey(Key.Return);
                } else if (content === '{Tab}') {
                    await keyboard.pressKey(Key.Tab);
                    await keyboard.releaseKey(Key.Tab);
                } else if (content === '{Space}') {
                    await keyboard.pressKey(Key.Space);
                    await keyboard.releaseKey(Key.Space);
                } else if (content === '{Esc}') {
                    await keyboard.pressKey(Key.Escape);
                    await keyboard.releaseKey(Key.Escape);
                } else if (content.endsWith('{Enter}')) {
                    const textToType = content.replace('{Enter}', '');
                    await keyboard.type(textToType);
                    await keyboard.pressKey(Key.Return);
                    await keyboard.releaseKey(Key.Return);
                } else {
                    await keyboard.type(content);
                }
            } else {
                // 常规长文本键入
                await keyboard.type(content);
            }

            sysLogger.log(LogLevel.SUCCESS, `键盘物理操作完成`);
            return { type: 'keyboard', content: `【系统自动反馈】物理键盘已成功敲击或键入内容。` };
        } catch (err: any) {
            throw new Error(`物理键盘操作异常: ${err.message}`);
        }
    }
}