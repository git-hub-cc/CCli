import fs from 'fs';
import path from 'path';
import { sysLogger, LogLevel } from '../core/logger.js';

export class PromptBuilder {
    private promptsDir: string;
    private macroDir: string;
    private dataDir: string;

    constructor() {
        this.promptsDir = path.resolve(process.cwd(), 'prompts');
        this.macroDir = path.resolve(process.cwd(), 'macros');
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
        // 改为判断核心索引文件是否存在，防止环境探针文件干扰初始化
        if (!fs.existsSync(baseFile)) {
            const baseContent = `# 长期记忆库索引\n\n这是 ccli 的长期记忆存储中心。你可以根据以下说明，在需要时主动加载对应的记忆分片。\n\n### 记忆分片说明\n* **01环境.md**: 存储探针自动获取的系统与目录环境信息。\n* **02个人.md**: 存储用户的个人基本信息、交互偏好、习惯习惯、成长记录等。\n* **03工作.md**: 存储项目背景、业务逻辑、公司规范、任务清单、会议纪要。\n* **04设备.md**: 存储当前硬件环境配置、常用软件路径、环境维护记录、故障库。\n* **05归档.md**: 存储已完结的重大项目总结、历史参考资料、不再频繁变动的备份记录。\n\n### 操作指南\n1. 如果你发现当前任务涉及上述领域，请使用 \`<upload path=".ccli/data/文件名.md" />\` 主动调取记忆。\n`;
            
            fs.writeFileSync(baseFile, baseContent, 'utf-8');
            fs.writeFileSync(path.join(this.dataDir, '02个人.md'), '### 基本信息\n- 用户姓名：未设置\n- 角色定义：开发者\n\n### 偏好与习惯\n- 代码风格：优先使用干净、现代的语法\n- 交互偏好：回复尽量简短，直接给出解决方案或代码块\n- 常用技术栈：未设置\n', 'utf-8');
            fs.writeFileSync(path.join(this.dataDir, '03工作.md'), '### 基本信息\n- 当前公司/团队：未设置\n- 核心职责：未设置\n\n### 项目规范\n- 代码风格：未设置\n- 命名规范：未设置\n- 提交规范：未设置\n', 'utf-8');
            fs.writeFileSync(path.join(this.dataDir, '04设备.md'), '### 硬件环境\n- 操作系统：未设置\n\n### 软件配置\n- 包管理器：未设置\n- 默认终端：未设置\n', 'utf-8');
            fs.writeFileSync(path.join(this.dataDir, '05归档.md'), '### 项目总结\n- 暂无已完结项目总结\n\n### 历史参考资料\n- 暂无\n', 'utf-8');
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

                if (nameMatch && nameMatch[1] && descMatch && descMatch[1]) {
                    // 只生成技能列表项，前置的说明头已被独立为 04宏技能库.md
                    macroList += `- <${nameMatch[1].trim()}>: ${descMatch[1].trim()}\n`;
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