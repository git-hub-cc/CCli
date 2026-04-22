import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { sysLogger, LogLevel, LogRole } from '../core/logger.js';
import { buildRecapContext } from './builder.js';
import type { ILLMProvider } from '../llm/interface.js';
import { AIMLParser } from '../parser/aiml-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

export class BaseRecapMode {
    modeName: 'macros' | 'data' | 'prompts';

    constructor(modeName: 'macros' | 'data' | 'prompts') {
        this.modeName = modeName;
    }

    async execute(provider: ILLMProvider, chatHistory: { role: string, content: string }[]) {
        sysLogger.log(LogLevel.INFO, `进入复盘反思模式 [${this.modeName}]，正在准备环境...`);

        try {
            await provider.resetSession();
            await new Promise(resolve => setTimeout(resolve, 2000));

            sysLogger.log(LogLevel.INFO, `正在聚合全局上下文并生成物理文件 res.md...`);
            const resFilePath = await buildRecapContext(chatHistory, this.modeName);

            sysLogger.log(LogLevel.INFO, '正在将 res.md 挂载至会话...');
            await provider.uploadFile(resFilePath, false);

            const savedMeta = sysLogger.saveAttachment(resFilePath);
            if (fs.existsSync(resFilePath)) {
                let uploadLog = `[复盘模式挂载文件]: ${resFilePath}\n`;
                if (savedMeta) {
                    uploadLog += `> 💾 已归档至: [${savedMeta.relativePath}](${savedMeta.relativePath})\n`;
                }
                this.appendLog('File_Upload', uploadLog);
            }

            sysLogger.log(LogLevel.ACTION, '正在请求大模型进行分析，请稍候...');

            let recapPrompt = '';
            const promptPath = path.resolve(PKG_ROOT, 'prompts', 'recap', `${this.modeName}.md`);
            try {
                recapPrompt = fs.readFileSync(promptPath, 'utf-8').trim();
            } catch (e) {
                recapPrompt = `你现在进入了特殊的复盘模式 (${this.modeName})。请分析历史记录与当前系统上下文，给出优化建议。`;
            }

            this.appendLog('Prompt_Context', recapPrompt);
            const response = await provider.ask(recapPrompt);

            console.log(chalk.green(`\nAI (${this.modeName} 分析) > `));
            console.log(chalk.yellow(response) + '\n');

            this.appendLog('AI', response);

            await this.afterAsk(response, provider);

            this.appendLog('Recap_Action', `【系统执行了 /recap ${this.modeName} 动作完毕】`);
            sysLogger.log(LogLevel.SUCCESS, `模式 [${this.modeName}] 执行完毕。`);

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `复盘分析失败: ${err.message}`);
            
            try {
                const crashLogPath = path.resolve(process.cwd(), '.ccli', 'logs', 'recap-crash.log');
                if (!fs.existsSync(path.dirname(crashLogPath))) {
                    fs.mkdirSync(path.dirname(crashLogPath), { recursive: true });
                }
                fs.appendFileSync(crashLogPath, `[${new Date().toISOString()}] [BaseRecapMode] ${err.stack || err.message}\n`);
            } catch (logErr) {
            }
        }
    }

    protected appendLog(role: LogRole, content: string) {
        if (this.modeName === 'data') {
            sysLogger.appendDataLog(role, content);
        } else if (this.modeName === 'prompts') {
            sysLogger.appendRecapPrompts(role, content);
        } else if (this.modeName === 'macros') {
            sysLogger.appendRecapMacros(role, content);
        }
    }

    /**
     * 获取大模型响应后的附加动作
     */
    protected async afterAsk(response: string, provider: ILLMProvider): Promise<void> {
        if (this.modeName === 'data') {
            const parsedNodes = AIMLParser.parse(response);
            await AIMLParser.executeNodes(parsedNodes, provider);
        }
    }
}