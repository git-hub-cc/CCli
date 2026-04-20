import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sysLogger, LogLevel } from '../core/logger.js';

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

        const baseFile = path.join(this.dataDir, '00base.md');
        
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

        const baseScriptFile = path.join(this.scriptsDir, '000base.md');
        
        if (!fs.existsSync(baseScriptFile)) {
            const defaultContent = `# 动态扩展脚本索引\n\n这里存放由大模型自动编写并注册的动态脚本能力清单。\n\n### 可用脚本列表\n- 暂无脚本\n`;
            fs.writeFileSync(baseScriptFile, defaultContent, 'utf-8');
        }
    }

    build(): string {
        const filesToMerge = [
            '01角色定义.md',
            '02AI标记语言.md',
            '03角色微调.md',
            '04宏技能库.md',
            '06动态扩展机制.md'
        ];

        let finalPrompt = '';

        for (const file of filesToMerge) {
            const filePath = path.join(this.promptsDir, file);
            if (fs.existsSync(filePath)) {
                finalPrompt += fs.readFileSync(filePath, 'utf-8') + '\n\n';
            } else {
                sysLogger.log(LogLevel.WARN, `构建提示词时未找到目标文件: ${file}`);
            }
        }

        finalPrompt += this.buildMacroPrompt();
        finalPrompt += this.buildScriptsPrompt();
        finalPrompt += this.buildDataPrompt();

        return finalPrompt.trim();
    }

    private buildMacroPrompt(): string {
        if (!fs.existsSync(this.macroDir)) return '';

        const skillFiles = fs.readdirSync(this.macroDir).filter(f => f.endsWith('.md'));
        if (skillFiles.length === 0) return '';

        let macroList = '';
        let hasValidMacro = false;

        for (const file of skillFiles) {
            try {
                const content = fs.readFileSync(path.join(this.macroDir, file), 'utf-8');
                const nameMatch = content.match(/name:\s*(.+)/);
                const descMatch = content.match(/description:\s*(.+)/);
                const reqMatch = content.match(/requires:\s*(.+)/);

                if (nameMatch && nameMatch[1] && descMatch && descMatch[1]) {
                    const reqText = reqMatch && reqMatch[1] ? ` [前置要求: ${reqMatch[1].trim()}]` : '';
                    macroList += `- <${nameMatch[1].trim()}>: ${descMatch[1].trim()}${reqText}\n`;
                    hasValidMacro = true;
                }
            } catch (err) {
            }
        }

        return hasValidMacro ? macroList + '\n' : '';
    }

    private buildScriptsPrompt(): string {
        let content = '';
        
        const baseScriptPath = path.join(this.scriptsDir, '000base.md');
        if (fs.existsSync(baseScriptPath)) {
            content += fs.readFileSync(baseScriptPath, 'utf-8') + '\n\n';
        }

        return content;
    }

    private buildDataPrompt(): string {
        let content = '';
        
        const baseDataPath = path.join(this.dataDir, '00base.md');
        if (fs.existsSync(baseDataPath)) {
            content += fs.readFileSync(baseDataPath, 'utf-8') + '\n\n';
        }

        if (content) {
            return `\n${content}\n## 完成下面任务\n\n`;
        }
        return '';
    }
}