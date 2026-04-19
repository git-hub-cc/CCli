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

    constructor() {
        this.promptsDir = path.resolve(PKG_ROOT, 'prompts');
        this.macroDir = path.resolve(PKG_ROOT, 'macros');
        this.templateDir = path.resolve(PKG_ROOT, 'data-templates');
        this.dataDir = path.resolve(process.cwd(), '.ccli', 'data');
        this.initDataDir();
    }

    /**
     * 初始化记忆数据目录，如果 00base.md 不存在则自动生成默认基础文件
     */
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

    /**
     * 按顺序读取并拼装提示词模块，包含动态注入的录制技能 (Macro)
     */
    build(): string {
        const filesToMerge = [
            '01角色定义.md',
            '02AI标记语言.md',
            '03角色微调.md',
            '04宏技能库.md'
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

        // 动态注入录制的宏技能（现在仅负责追加动态列表）
        finalPrompt += this.buildMacroPrompt();
        finalPrompt += this.buildDataPrompt();

        return finalPrompt.trim();
    }

    /**
     * 扫描 macros/ 目录，将所有合法的宏指令打包进 Prompt
     */
    private buildMacroPrompt(): string {
        if (!fs.existsSync(this.macroDir)) return '';

        const skillFiles = fs.readdirSync(this.macroDir).filter(f => f.endsWith('.md'));
        if (skillFiles.length === 0) return '';

        let macroList = '';
        let hasValidMacro = false;

        for (const file of skillFiles) {
            try {
                const content = fs.readFileSync(path.join(this.macroDir, file), 'utf-8');
                // 利用正则简单解析 YAML Meta 头
                const nameMatch = content.match(/name:\s*(.+)/);
                const descMatch = content.match(/description:\s*(.+)/);
                const reqMatch = content.match(/requires:\s*(.+)/);

                if (nameMatch && nameMatch[1] && descMatch && descMatch[1]) {
                    const reqText = reqMatch && reqMatch[1] ? ` [前置要求: ${reqMatch[1].trim()}]` : '';
                    // 只生成技能列表项，前置的说明头已被独立为 04宏技能库.md
                    macroList += `- <${nameMatch[1].trim()}>: ${descMatch[1].trim()}${reqText}\n`;
                    hasValidMacro = true;
                }
            } catch (err) {
                // 静默忽略解析失败的技能文件
            }
        }

        return hasValidMacro ? macroList + '\n' : '';
    }

    /**
     * 扫描 .ccli/data 目录，将基础设定索引作为特定区块注入
     */
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