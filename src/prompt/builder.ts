import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sysLogger, LogLevel } from '../core/logger.js';
import { IPromptPart } from './parts/interface.js';
import { StaticPart } from './parts/static.part.js';
import { MacroSkillPart } from './parts/macro-skill.part.js';
import { DataTemplatePart } from './parts/data-template.part.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

export class PromptBuilder {
    private promptsDir: string;
    private macroDir: string;
    private dataDir: string;
    private templateDir: string;
    private provider: string;

    constructor(provider: string = 'gemini') {
        this.provider = provider;
        this.promptsDir = path.resolve(PKG_ROOT, 'prompts');
        this.macroDir = path.resolve(PKG_ROOT, 'macros');
        this.templateDir = path.resolve(PKG_ROOT, 'data-templates');
        this.dataDir = path.resolve(process.cwd(), '.ccli', 'data');
        this.initDataDir();
    }

    private initDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        const baseFile = path.join(this.dataDir, 'index.md');

        if (!fs.existsSync(baseFile)) {
            if (fs.existsSync(this.templateDir)) {
                const files = fs.readdirSync(this.templateDir);
                for (const file of files) {
                    if (file.endsWith('.md')) {
                        const srcPath = path.join(this.templateDir, file);
                        const destPath = path.join(this.dataDir, file);
                        if (!fs.existsSync(destPath)) {
                            fs.copyFileSync(srcPath, destPath);
                        }
                    }
                }
            } else {
                sysLogger.log(LogLevel.WARN, `未找到模板目录: ${this.templateDir}，跳过基础记忆初始化。`);
            }
        }
    }

    build(): string {
        const pipeline: IPromptPart[] = [
            new StaticPart(this.promptsDir, '01角色定义.md'),
            new StaticPart(this.promptsDir, '02系统指令库.md'),
            new MacroSkillPart(this.promptsDir, this.macroDir),
            new DataTemplatePart(this.dataDir),
            new StaticPart(this.promptsDir, '03角色微调.md')
        ];

        let finalPrompt = '';

        for (const part of pipeline) {
            finalPrompt += part.generate();
        }

        const tweaksPath = path.resolve(this.promptsDir, 'tweaks', `${this.provider}.md`);
        if (fs.existsSync(tweaksPath)) {
            try {
                const tweakContent = fs.readFileSync(tweaksPath, 'utf-8');
                tweakContent.split('\n').forEach(line => {
                    const cleanLine = line.split('#')[0].trim();
                    if (!cleanLine) return;

                    const [key, ...values] = cleanLine.split('=');
                    if (!key) return;

                    const value = values.join('=').trim();
                    const placeholder = new RegExp(`\\{\\{${key.trim()}\\}\\}`, 'g');
                    finalPrompt = finalPrompt.replace(placeholder, value);
                });
            } catch (e: any) {
                sysLogger.log(LogLevel.ERROR, `解析微调配置文件失败 (${tweaksPath}): ${e.message}`);
            }
        }

        finalPrompt = finalPrompt.replace(/\{\{[A-Z0-9_]+\}\}/g, '');

        return finalPrompt.replace(/\n+/g, '\n').trim()+'\n### 完成下面任务';
    }
}