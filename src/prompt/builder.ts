import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sysLogger, LogLevel } from '../core/logger.js';
import { IPromptPart } from './parts/interface.js';
import { StaticPart } from './parts/static.part.js';
import { MacroSkillPart } from './parts/macro-skill.part.js';
import { DynamicScriptPart } from './parts/dynamic-script.part.js';
import { DataTemplatePart } from './parts/data-template.part.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

export class PromptBuilder {
    private promptsDir: string;
    private macroDir: string;
    private dataDir: string;
    private templateDir: string;
    private scriptsDir: string;

    constructor() {
        this.promptsDir = path.resolve(PKG_ROOT, 'prompts');
        this.macroDir = path.resolve(PKG_ROOT, 'macros');
        this.templateDir = path.resolve(PKG_ROOT, 'data-templates');
        this.dataDir = path.resolve(process.cwd(), '.ccli', 'data');
        this.scriptsDir = path.resolve(process.cwd(), '.ccli', 'scripts');
        this.initDataDir();
        this.initScriptsDir();
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

    private initScriptsDir() {
        if (!fs.existsSync(this.scriptsDir)) {
            fs.mkdirSync(this.scriptsDir, { recursive: true });
        }

        const baseScriptFile = path.join(this.scriptsDir, 'index.md');
        
        if (!fs.existsSync(baseScriptFile)) {
            const defaultContent = `# 动态扩展脚本索引\n\n这里存放由大模型自动编写并注册的动态脚本能力清单。\n\n### 可用脚本列表\n- 暂无脚本\n`;
            fs.writeFileSync(baseScriptFile, defaultContent, 'utf-8');
        }
    }

    build(): string {
        const pipeline: IPromptPart[] = [
            new StaticPart(this.promptsDir, '01角色定义.md'),
            new StaticPart(this.promptsDir, '02AI标记语言.md'),
            new MacroSkillPart(this.promptsDir, this.macroDir),
            new DynamicScriptPart(this.promptsDir, this.scriptsDir),
            new DataTemplatePart(this.dataDir),
            new StaticPart(this.promptsDir, '03角色微调.md')
        ];

        let finalPrompt = '';

        for (const part of pipeline) {
            finalPrompt += part.generate();
        }

        return finalPrompt.replace(/\n+/g, '\n').trim()+'\n### 完成下面任务';
    }
}