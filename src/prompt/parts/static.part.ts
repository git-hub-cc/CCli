import fs from 'fs';
import path from 'path';
import { IPromptPart } from './interface.js';
import { sysLogger, LogLevel } from '../../core/logger.js';

export class StaticPart implements IPromptPart {
    private filePath: string;

    constructor(private promptsDir: string, private fileName: string) {
        this.filePath = path.join(promptsDir, fileName);
    }

    generate(): string {
        if (fs.existsSync(this.filePath)) {
            return fs.readFileSync(this.filePath, 'utf-8') + '\n\n';
        } else {
            sysLogger.log(LogLevel.WARN, `构建提示词时未找到目标文件: ${this.fileName}`);
            return '';
        }
    }
}