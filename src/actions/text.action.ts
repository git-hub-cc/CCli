import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import chalk from 'chalk';

export class TextAction extends BaseAction {
    tag = 'text';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult | null> {
        if (!content) return null;

        console.log(chalk.green('\nAI > '));
        console.log(chalk.white(content) + '\n');
        
        sysLogger.log(LogLevel.INFO, '已解析并展示 <text> 内容。');

        return null;
    }
}