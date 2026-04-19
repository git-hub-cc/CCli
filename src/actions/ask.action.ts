import { confirm, input } from '@inquirer/prompts';
import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

/**
 * 处理 <ask> 标签：主动阻断自动化流程，向用户索要授权或额外输入
 */
export class AskAction extends BaseAction {
    tag = 'ask';

    async execute(attributes: Record<string, string>, content: string): Promise<string> {
        const type = attributes['type'] || 'input';
        const questionText = content.trim() || 'AI 需要您的确认或输入：';

        sysLogger.log(LogLevel.WARN, `任务挂起，等待用户授权/输入...`);

        try {
            if (type === 'confirm') {
                const answer = await confirm({ message: questionText, default: true });
                sysLogger.log(LogLevel.INFO, `用户确认结果: ${answer}`);
                return `【系统自动反馈：用户授权结果】\n用户选择了: ${answer ? '是 (Yes)' : '否 (No)'}`;
            } else {
                const answer = await input({ message: questionText });
                sysLogger.log(LogLevel.INFO, `用户输入内容: ${answer}`);
                return `【系统自动反馈：用户输入结果】\n${answer}`;
            }
        } catch (err: any) {
            // 处理用户强行中断 (Ctrl+C)
            if (err.name === 'ExitPromptError') {
                sysLogger.log(LogLevel.ERROR, '用户强制取消了输入');
                process.exit(1);
            }
            throw err;
        }
    }
}