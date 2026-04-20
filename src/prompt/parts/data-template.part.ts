import fs from 'fs';
import path from 'path';
import { IPromptPart } from './interface.js';

export class DataTemplatePart implements IPromptPart {
    constructor(private dataDir: string) {}

    generate(): string {
        let content = '';
        
        const baseDataPath = path.join(this.dataDir, 'index.md');
        if (fs.existsSync(baseDataPath)) {
            content += fs.readFileSync(baseDataPath, 'utf-8') + '\n\n';
        }

        if (content) {
            return `\n${content}\n## 完成下面任务\n\n`;
        }
        return '';
    }
}