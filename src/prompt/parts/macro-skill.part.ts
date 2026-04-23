import fs from 'fs';
import path from 'path';
import { IPromptPart } from './interface.js';

export class MacroSkillPart implements IPromptPart {
    constructor(private promptsDir: string, private macroDir: string) {}

    generate(): string {
        let content = '';

        if (!fs.existsSync(this.macroDir)) return content;

        const skillFiles = fs.readdirSync(this.macroDir).filter(f => f.endsWith('.md'));
        if (skillFiles.length === 0) return content;

        let macroList = '';
        let hasValidMacro = false;

        for (const file of skillFiles) {
            try {
                const fileContent = fs.readFileSync(path.join(this.macroDir, file), 'utf-8');
                const nameMatch = fileContent.match(/name:\s*(.+)/);
                const descMatch = fileContent.match(/description:\s*(.+)/);
                // params 将被明确解析为该宏技能支持的 XML 属性
                const attrMatch = fileContent.match(/params:\s*(.+)/);
                const reqMatch = fileContent.match(/requires:\s*(.+)/);

                const hasContentPlaceholder = fileContent.includes('{_content_}');

                if (nameMatch && nameMatch[1] && descMatch && descMatch[1]) {
                    const name = nameMatch[1].trim();
                    const desc = descMatch[1].trim();
                    const contentParam = hasContentPlaceholder ? '长文本或代码正文' : '-';
                    const attrParam = attrMatch && attrMatch[1] ? attrMatch[1].trim() : '-';
                    const req = reqMatch && reqMatch[1] ? reqMatch[1].trim() : '-';

                    macroList += `| \`<${name}>\` | ${desc} | ${contentParam} | ${attrParam} | ${req} |\n`;
                    hasValidMacro = true;
                }
            } catch (err) {
            }
        }

        if (hasValidMacro) {
            content += macroList + '\n\n';
        }

        return content;
    }
}