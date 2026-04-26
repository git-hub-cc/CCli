import fs from 'fs';
import path from 'path';
import { IPromptPart } from './interface.js';
import { extractMarkdownMeta } from '../../core/utils.js';

export class DataTemplatePart implements IPromptPart {
    constructor(private dataDir: string) {}

    generate(): string {
        let content = '';

        const baseDataPath = path.join(this.dataDir, 'index.md');
        if (fs.existsSync(baseDataPath)) {
            const indexContent = fs.readFileSync(baseDataPath, 'utf-8');
            const { body: indexBody } = extractMarkdownMeta(indexContent);
            content += indexBody.trim() + '\n\n';
        }

        if (fs.existsSync(this.dataDir)) {
            const groupedFiles: Record<string, string[]> = {};

            const scanDir = (currentDir: string, relativePath: string) => {
                const entries = fs.readdirSync(currentDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        scanDir(path.join(currentDir, entry.name), `${relativePath}/${entry.name}`);
                    } else if (entry.isFile() && entry.name.endsWith('.md')) {
                        // 跳过根目录的 index.md
                        if (relativePath === '.ccli/data' && entry.name === 'index.md') continue;

                        const filePath = path.join(currentDir, entry.name);
                        const fileContent = fs.readFileSync(filePath, 'utf-8');
                        const { meta } = extractMarkdownMeta(fileContent);

                        const name = meta.name || entry.name;
                        const description = meta.description || '无具体描述';

                        if (!groupedFiles[relativePath]) {
                            groupedFiles[relativePath] = [];
                        }
                        groupedFiles[relativePath].push(`- ${name}: ${description}`);
                    }
                }
            };

            // 从根目录开始递归扫描
            scanDir(this.dataDir, '.ccli/data');

            const directories = Object.keys(groupedFiles).sort();
            if (directories.length > 0) {
                content += '### 记忆说明\n使用`file`能够主动加载\n';
                for (const dir of directories) {
                    content += `${dir}\n`;
                    content += groupedFiles[dir].join('\n') + '\n';
                }
            }
        }

        if (content) {
            return `\n${content.trim()}\n`;
        }
        return '';
    }
}