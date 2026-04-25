import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { keyboard } from '@nut-tree/nut-js';
import { KeyboardParser } from '../core/keyboard-parser.js';

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

        try {
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
        }
    }
}