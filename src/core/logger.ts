import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
    INFO = 'INFO',
    ACTION = 'ACTION',
    SUCCESS = 'SUCCESS',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export type LogRole = 'User' | 'Raw_User' | 'Prompt_Context' | 'AI' | 'Tool_Feedback' | 'System_Feedback' | 'File_Upload' | 'Recap_Action';

export class Logger {
    private sessionDir: string = '';
    private chatFilePath: string = '';
    private promptsFilePath: string = '';
    private recapMacrosFilePath: string = '';
    private recapPromptsFilePath: string = '';
    private recapDataFilePath: string = '';
    private browserLogDir: string = '';

    /**
     * 初始化当次会话的日志目录 (自动计算序号)
     */
    initSession() {
        const baseDir = path.join(process.cwd(), '.ccli', 'logs');
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const dateDir = path.join(baseDir, dateStr);

        if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir, { recursive: true });
        }

        const dirs = fs.readdirSync(dateDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => parseInt(dirent.name, 10))
            .filter(num => !isNaN(num));

        const nextSeq = dirs.length > 0 ? Math.max(...dirs) + 1 : 1;
        this.sessionDir = path.join(dateDir, String(nextSeq).padStart(3, '0'));
        fs.mkdirSync(this.sessionDir, { recursive: true });

        process.env.CCLI_SESSION_DIR = this.sessionDir;
        
        this.browserLogDir = this.sessionDir;
        process.env.CCLI_BROWSER_LOG_DIR = this.browserLogDir;

        this.chatFilePath = path.join(this.sessionDir, 'chat.md');
        fs.writeFileSync(this.chatFilePath, `# 会话记录 - ${today.toLocaleString()}\n\n`, 'utf-8');

        this.promptsFilePath = path.join(this.sessionDir, 'prompts.md');
        fs.writeFileSync(this.promptsFilePath, `# 系统提示词记录 - ${today.toLocaleString()}\n\n`, 'utf-8');

        this.recapMacrosFilePath = path.join(this.sessionDir, 'recap-macros.md');
        fs.writeFileSync(this.recapMacrosFilePath, `# 复盘记录 宏技能模式 - ${today.toLocaleString()}\n\n`, 'utf-8');

        this.recapPromptsFilePath = path.join(this.sessionDir, 'recap-prompts.md');
        fs.writeFileSync(this.recapPromptsFilePath, `# 复盘记录 提示词模式 - ${today.toLocaleString()}\n\n`, 'utf-8');

        this.recapDataFilePath = path.join(this.sessionDir, 'recap-data.md');
        fs.writeFileSync(this.recapDataFilePath, `# 复盘记录 数据模式 - ${today.toLocaleString()}\n\n`, 'utf-8');
    }

    getSessionDir() {
        return this.sessionDir;
    }

    /**
     * 控制台标准化彩色打印
     */
    log(level: LogLevel, msg: string) {
        const time = new Date().toLocaleTimeString();
        const prefix = `[${time}] [${level}]`;
        let formatted = msg;
        switch(level) {
            case LogLevel.INFO: formatted = chalk.blue(`${prefix} ${msg}`); break;
            case LogLevel.ACTION: formatted = chalk.magenta(`${prefix} ⚙ ${msg}`); break;
            case LogLevel.SUCCESS: formatted = chalk.green(`${prefix} ✔ ${msg}`); break;
            case LogLevel.WARN: formatted = chalk.yellow(`${prefix} ⚠ ${msg}`); break;
            case LogLevel.ERROR: formatted = chalk.red(`${prefix} ✖ ${msg}`); break;
        }
        console.log(formatted);
    }

    private appendToFile(filePath: string, role: LogRole, content: string) {
        if (!filePath) return;
        const entry = `### [${new Date().toLocaleTimeString()}] ${role}:\n\n${content}\n\n---\n\n`;
        fs.appendFileSync(filePath, entry, 'utf-8');
    }

    /**
     * 将 AI 与 User 的对话记录追加入本地 Markdown 归档
     * 扩展 role 类型，支持精细化的无损日志记录，确保记录不被截断
     */
    appendChat(role: LogRole, content: string) {
        this.appendToFile(this.chatFilePath, role, content);
    }

    /**
     * 将系统提示词单独归档，保持 chat.md 纯净
     */
    appendSystemPrompt(content: string) {
        this.appendToFile(this.promptsFilePath, 'Prompt_Context', content);
    }

    /**
     * 将复盘相关的日志单独写入 recap-macros.md 归档
     */
    appendRecapMacros(role: LogRole, content: string) {
        this.appendToFile(this.recapMacrosFilePath, role, content);
    }

    /**
     * 将复盘相关的日志单独写入 recap-prompts.md 归档
     */
    appendRecapPrompts(role: LogRole, content: string) {
        this.appendToFile(this.recapPromptsFilePath, role, content);
    }

    /**
     * 将记忆存取快照隔离记录，保持纯净度
     */
    appendDataLog(role: LogRole, content: string) {
        this.appendToFile(this.recapDataFilePath, role, content);
    }

    /**
     * 保存用户上传的附件至独立的 file 子目录，并返回带原始名字与相对路径的对象以供日志记录
     */
    saveAttachment(sourceFilePath: string): { relativePath: string, fileName: string } | null {
        if (!this.sessionDir) return null;
        if (!fs.existsSync(sourceFilePath)) throw new Error(`附件不存在: ${sourceFilePath}`);

        const fileDir = path.join(this.sessionDir, 'file');
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }

        const ext = path.extname(sourceFilePath);
        const originalName = path.basename(sourceFilePath);

        const existingFiles = fs.readdirSync(fileDir);
        const nextSeq = existingFiles.length + 1;
        const seqStr = String(nextSeq).padStart(3, '0');

        const newFileName = `${seqStr}${ext}`;
        const targetPath = path.join(fileDir, newFileName);

        fs.copyFileSync(sourceFilePath, targetPath);

        return {
            relativePath: `file/${newFileName}`,
            fileName: originalName
        };
    }
}

// 导出单例，方便全局使用
export const sysLogger = new Logger();