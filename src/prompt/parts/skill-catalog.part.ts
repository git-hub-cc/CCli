import { IPromptPart } from './interface.js';
import { SkillManager } from '../../core/skill-manager.js';

export class SkillCatalogPart implements IPromptPart {
    generate(): string {
        const skills = SkillManager.getAllSkills();
        if (skills.length === 0) return '';

        const groupedSkills: Record<string, typeof skills> = {};
        for (const skill of skills) {
            const cat = skill.category || 'other';
            if (!groupedSkills[cat]) groupedSkills[cat] = [];
            groupedSkills[cat].push(skill);
        }

        let content = '### 本地可用扩展技能 (Skills)\n';
        content += '你可以通过 `<skill action="inspect" name="技能名">` 来查看技能的详细说明和代码，然后利用 `<shell>` 或 `<file>` 动作来调用执行它们。\n\n';

        for (const category of Object.keys(groupedSkills).sort()) {
            content += `#### 类别: ${category}\n`;
            content += '| 技能名称 | 提供工具 | 描述 |\n';
            content += '| :--- | :--- | :--- |\n';

            for (const skill of groupedSkills[category]) {
                const tools = skill.provides_tools && skill.provides_tools.length > 0 ? skill.provides_tools.join(', ') : '-';
                const desc = skill.description.replace(/\r?\n/g, ' ').substring(0, 100);
                content += `| \`${skill.name}\` | ${tools} | ${desc} |\n`;
            }
            content += '\n';
        }

        return `\n${content}\n`;
    }
}