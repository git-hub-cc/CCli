import fs from 'fs';
import path from 'path';
import { sysLogger, LogLevel } from './logger.js';
import { extractMarkdownMeta } from './utils.js';

export interface SkillMeta {
    name: string;
    category?: string;
    version?: string;
    description: string;
    author?: string;
    provides_tools?: string[];
    dirPath: string;
}

export class SkillManager {
    private static skills: SkillMeta[] = [];
    private static loaded = false;

    public static loadSkills(basePath: string = path.resolve(process.cwd(), 'skills')) {
        if (this.loaded) return;
        this.skills = [];

        sysLogger.log(LogLevel.INFO, `正在扫描本地技能目录: ${basePath}`);

        if (!fs.existsSync(basePath)) {
            sysLogger.log(LogLevel.WARN, `未找到 skills 目录: ${basePath}`);
            return;
        }

        const walk = (dir: string, relativePath: string = '') => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const nextRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    walk(fullPath, nextRelativePath);
                } else if (entry.isFile() && entry.name === 'SKILL.md') {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        const { meta } = extractMarkdownMeta(content);

                        const category = nextRelativePath.split('/')[0] || 'uncategorized';
                        const folderName = path.basename(dir);
                        const skillName = meta.name || folderName;

                        if (skillName) {
                            this.skills.push({
                                name: skillName,
                                category: category,
                                version: meta.version || '1.0.0',
                                description: meta.description || '暂无描述',
                                author: meta.author || 'unknown',
                                provides_tools: meta.provides_tools || [],
                                dirPath: dir
                            });
                        }
                    } catch (e: any) {
                        sysLogger.log(LogLevel.WARN, `解析技能文件失败 ${fullPath}: ${e.message}`);
                    }
                }
            }
        };

        walk(basePath);
        this.loaded = true;

        if (this.skills.length > 0) {
            sysLogger.log(LogLevel.INFO, `已成功从 ${basePath} 扫描并加载 ${this.skills.length} 个本地技能。`);
        }
    }

    public static getAllSkills(): SkillMeta[] {
        this.loadSkills();
        return this.skills;
    }

    public static searchSkills(keyword: string): SkillMeta[] {
        this.loadSkills();
        const lower = keyword.toLowerCase();
        return this.skills.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.description.toLowerCase().includes(lower) ||
            (s.category && s.category.toLowerCase().includes(lower)) ||
            (s.provides_tools && s.provides_tools.some(t => t.toLowerCase().includes(lower)))
        );
    }

    public static getSkillByName(name: string): SkillMeta | undefined {
        this.loadSkills();
        const lower = name.toLowerCase();
        return this.skills.find(s => s.name.toLowerCase() === lower);
    }
}