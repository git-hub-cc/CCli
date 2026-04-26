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
    private isTestMode: boolean = false;
    private traceBuffer: string[] = [];

    enableTestMode() {
        this.isTestMode = true;
    }

    initSession() {
        const baseDir = this.isTestMode 
            ? path.join(process.cwd(), '.ccli', 'logs', 'tests')
            : path.join(process.cwd(), '.ccli', 'logs');
            
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
        fs.writeFileSync(this.chatFilePath, `# 会话记录 - ${today.toLocaleString()}\n# 当前所在目录：${this.sessionDir}\n\n`, 'utf-8');

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

    appendActionTrace(trace: string) {
        const time = new Date().toLocaleTimeString();
        this.traceBuffer.push(`[${time}] ${trace}`);
    }

    flushActionTrace(contextName: string = 'trace') {
        if (this.traceBuffer.length === 0) return;
        
        if (this.isTestMode && this.sessionDir) {
            const safeName = path.basename(contextName, path.extname(contextName));
            const tracePath = path.join(this.sessionDir, `${safeName}_trace.log`);
            fs.writeFileSync(tracePath, this.traceBuffer.join('\n'), 'utf-8');
        } else if (this.chatFilePath) {
            const traceContent = `### [${new Date().toLocaleTimeString()}] Action_Trace:\n\n\`\`\`text\n${this.traceBuffer.join('\n')}\n\`\`\`\n\n---\n\n`;
            fs.appendFileSync(this.chatFilePath, traceContent, 'utf-8');
        }
        
        this.traceBuffer = [];
    }

    private appendToFile(filePath: string, role: LogRole, content: string) {
        if (!filePath) return;
        const entry = `### [${new Date().toLocaleTimeString()}] ${role}:\n\n${content}\n\n---\n\n`;
        fs.appendFileSync(filePath, entry, 'utf-8');
    }

    appendChat(role: LogRole, content: string) {
        const cleanContent = content.replace(/````/g, '');
        this.appendToFile(this.chatFilePath, role, cleanContent);
    }

    appendSystemPrompt(content: string) {
        this.appendToFile(this.promptsFilePath, 'Prompt_Context', content);
    }

    appendRecapMacros(role: LogRole, content: string) {
        this.appendToFile(this.recapMacrosFilePath, role, content);
    }

    appendRecapPrompts(role: LogRole, content: string) {
        this.appendToFile(this.recapPromptsFilePath, role, content);
    }

    appendDataLog(role: LogRole, content: string) {
        this.appendToFile(this.recapDataFilePath, role, content);
    }

    saveAttachment(sourceFilePath: string): { relativePath: string, fileName: string } | null {
        if (!this.sessionDir) return null;
        if (!fs.existsSync(sourceFilePath)) throw new Error(`附件不存在: ${sourceFilePath}`);

        const fileDir = path.join(this.sessionDir, 'files');
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
            relativePath: `files/${newFileName}`,
            fileName: originalName
        };
    }

    saveTextAsAttachment(content: string, fullContent?: string, ext: string = '.md'): { relativePath: string, fullRelativePath?: string, fileName: string } | null {
        if (!this.sessionDir) return null;

        const fileDir = path.join(this.sessionDir, 'files');
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }

        const existingFiles = fs.readdirSync(fileDir);
        const nextSeq = existingFiles.length + 1;
        const seqStr = String(nextSeq).padStart(3, '0');

        const newFileName = `${seqStr}${ext}`;
        const targetPath = path.join(fileDir, newFileName);

        fs.writeFileSync(targetPath, content, 'utf-8');

        let fullRelativePath: string | undefined;
        if (fullContent) {
            const logsDir = path.join(this.sessionDir, 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            const fullTargetPath = path.join(logsDir, newFileName);
            fs.writeFileSync(fullTargetPath, fullContent, 'utf-8');
            fullRelativePath = `logs/${newFileName}`;
        }

        return {
            relativePath: `files/${newFileName}`,
            fullRelativePath,
            fileName: newFileName
        };
    }

    saveScanResult(content: string, prefix: string = 'browser-scan'): { relativePath: string, fileName: string } | null {
        if (!this.sessionDir) return null;

        const scanDir = path.join(this.sessionDir, prefix);
        if (!fs.existsSync(scanDir)) {
            fs.mkdirSync(scanDir, { recursive: true });
        }

        const existingFiles = fs.readdirSync(scanDir).filter(f => f.endsWith('.md'));
        const nextSeq = existingFiles.length + 1;
        const seqStr = String(nextSeq).padStart(3, '0');

        const newFileName = `${seqStr}.md`;
        const targetPath = path.join(scanDir, newFileName);

        fs.writeFileSync(targetPath, content, 'utf-8');

        return {
            relativePath: `${prefix}/${newFileName}`,
            fileName: newFileName
        };
    }

    saveScanHtml(content: string, prefix: string = 'browser-scan-html'): { relativePath: string, fileName: string } | null {
        if (!this.sessionDir) return null;

        const scanDir = path.join(this.sessionDir, prefix);
        if (!fs.existsSync(scanDir)) {
            fs.mkdirSync(scanDir, { recursive: true });
        }

        const existingFiles = fs.readdirSync(scanDir).filter(f => f.endsWith('.html'));
        const nextSeq = existingFiles.length + 1;
        const seqStr = String(nextSeq).padStart(3, '0');

        const newFileName = `${seqStr}.html`;
        const targetPath = path.join(scanDir, newFileName);

        fs.writeFileSync(targetPath, content, 'utf-8');

        return {
            relativePath: `${prefix}/${newFileName}`,
            fileName: newFileName
        };
    }
}

export const sysLogger = new Logger();