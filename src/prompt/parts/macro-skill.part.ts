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
                const paramsMatch = fileContent.match(/params:\s*(.+)/);
                const reqMatch = fileContent.match(/requires:\s*(.+)/);

                if (nameMatch && nameMatch[1] && descMatch && descMatch[1]) {
                    const name = nameMatch[1].trim();
                    const desc = descMatch[1].trim();
                    const params = paramsMatch && paramsMatch[1] ? paramsMatch[1].trim() : '无';
                    const req = reqMatch && reqMatch[1] ? reqMatch[1].trim() : '-';

                    macroList += `| \`<${name}>\` | ${desc} | 内容: ${params} | ${req} |\n`;
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