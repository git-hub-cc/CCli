import fs from 'fs';
import path from 'path';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { SkillManager } from '../core/skill-manager.js';

export class SkillAction extends BaseAction {
    tag = 'skill';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();

        if (!action || !['search', 'inspect'].includes(action)) {
            throw new Error('<skill> 标签缺少合法的 action 属性 (支持: search/inspect)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行技能操作: ${action}`);

        try {
            if (action === 'search') {
                const keyword = attributes['keyword'] || content.trim();
                const skills = keyword ? SkillManager.searchSkills(keyword) : SkillManager.getAllSkills();

                if (skills.length === 0) {
                    return {
                        type: 'skill',
                        content: `【系统自动反馈】未找到与 "${keyword}" 相关的技能。`
                    };
                }

                let resultStr = `【系统自动反馈：技能搜索结果】\n找到 ${skills.length} 个匹配技能：\n\n`;
                skills.forEach(s => {
                    resultStr += `- **${s.name}** [${s.category}]: ${s.description}\n`;
                });

                return {
                    type: 'skill',
                    content: resultStr
                };
            } else if (action === 'inspect') {
                const name = attributes['name'] || content.trim();
                if (!name) throw new Error('inspect 模式缺少 name 属性');

                const skill = SkillManager.getSkillByName(name);
                if (!skill) {
                    return {
                        type: 'skill',
                        content: `【系统自动反馈】本地未安装名为 "${name}" 的技能。`
                    };
                }

                let fileListStr = '';
                let skillMdContent = '';

                if (fs.existsSync(skill.dirPath)) {
                    const files = fs.readdirSync(skill.dirPath);
                    fileListStr = files.map(f => `- ${f}`).join('\n');

                    const skillMdPath = path.join(skill.dirPath, 'SKILL.md');
                    if (fs.existsSync(skillMdPath)) {
                        skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
                    }
                }

                const responseText = `【系统自动反馈：技能详情】
名称: ${skill.name}
分类: ${skill.category || '无'}
版本: ${skill.version}
物理目录: \`${skill.dirPath}\`
提供工具: ${skill.provides_tools?.join(', ') || '无'}

目录内包含的文件：
${fileListStr}

--- SKILL.md 内容 ---
${skillMdContent}
---------------------

提示：请阅读上述说明，并组合 <shell> 或其他工具来运行此技能。`;

                sysLogger.log(LogLevel.SUCCESS, `已读取技能 ${skill.name} 详情。`);
                return {
                    type: 'skill',
                    content: responseText
                };
            }

            throw new Error(`未知的 action: ${action}`);
        } catch (err: any) {
            throw new Error(`技能操作异常: ${err.message}`);
        }
    }
}