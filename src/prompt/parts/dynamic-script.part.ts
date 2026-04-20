import fs from 'fs';
import path from 'path';
import { IPromptPart } from './interface.js';
import { sysLogger, LogLevel } from '../../core/logger.js';

export class DynamicScriptPart implements IPromptPart {
    constructor(private promptsDir: string, private scriptsDir: string) {}

    generate(): string {
        let content = '';

        const staticPath = path.join(this.promptsDir, '06动态扩展机制.md');
        if (fs.existsSync(staticPath)) {
            content += fs.readFileSync(staticPath, 'utf-8') + '\n\n';
        } else {
            sysLogger.log(LogLevel.WARN, `构建提示词时未找到目标文件: 06动态扩展机制.md`);
        }
        
        const baseScriptPath = path.join(this.scriptsDir, 'index.md');
        if (fs.existsSync(baseScriptPath)) {
            content += fs.readFileSync(baseScriptPath, 'utf-8') + '\n\n';
        }

        return content;
    }
}