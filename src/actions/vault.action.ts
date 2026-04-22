import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import clipboard from 'clipboardy';
import { keyboard } from '@nut-tree/nut-js';

export class VaultAction extends BaseAction {
    tag = 'vault';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];
        const key = attributes['key'];

        if (!action || !key) {
            throw new Error('<vault> 标签缺少必填属性 action 或 key');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行凭证保险箱操作: ${action} -> [${key}]`);

        const secretValue = process.env[`VAULT_${key}`] || `mock_secret_for_${key}`;

        try {
            if (action.toLowerCase() === 'clip') {
                let originalClip = '';
                try {
                    originalClip = await clipboard.read();
                } catch (e) {
                }

                await clipboard.write(secretValue);
                sysLogger.log(LogLevel.SUCCESS, `凭证已写入剪贴板，5秒后自动销毁`);

                setTimeout(async () => {
                    await clipboard.write(originalClip);
                    sysLogger.log(LogLevel.INFO, `凭证已从剪贴板销毁，恢复原有内容`);
                }, 5000);

                return { 
                    type: 'vault', 
                    content: `【系统自动反馈】安全凭证 [${key}] 已临时写入系统剪贴板，请尽快使用，5秒后自动销毁。` 
                };
            } else if (action.toLowerCase() === 'type') {
                keyboard.config.autoDelayMs = 20;
                await keyboard.type(secretValue);
                sysLogger.log(LogLevel.SUCCESS, `凭证已通过物理键盘模拟输入`);
                return { 
                    type: 'vault', 
                    content: `【系统自动反馈】安全凭证 [${key}] 已通过物理键盘模拟输入完毕。` 
                };
            } else {
                throw new Error(`不支持的 vault 动作: ${action}`);
            }
        } catch (err: any) {
            throw new Error(`保险箱操作异常: ${err.message}`);
        }
    }
}