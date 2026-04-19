import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import chalk from 'chalk';

/**
 * 处理 <text> 标签：常规文本输出
 */
export class TextAction extends BaseAction {
    tag = 'text';

    async execute(attributes: Record<string, string>, content: string): Promise<string | null> {
        if (!content) return null;

        // 纯文本输出不需要构造系统反馈回传给 AI
        // 仅仅在控制台上进行友好展示
        console.log(chalk.green('\nAI > '));
        console.log(chalk.white(content) + '\n');
        
        sysLogger.log(LogLevel.INFO, '已解析并展示 <text> 内容。');

        return null;
    }
}