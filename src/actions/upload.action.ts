import fs from 'fs';
import path from 'path';
import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import type { ILLMProvider } from '../llm/interface.js';
import { ContextManager } from '../core/context-manager.js';

/**
 * 处理 <upload> 标签：指示系统提取本地文件并挂载到下一次对话上下文中
 */
export class UploadAction extends BaseAction {
    tag = 'upload';

    async execute(attributes: Record<string, string>, content: string, provider?: ILLMProvider): Promise<string> {
        const rawPath = attributes['path'];
        const grid = attributes['grid'] !== 'false';

        if (!rawPath) {
            throw new Error('<upload> 标签缺少必要的 path 属性');
        }

        const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`系统找不到指定的文件路径: ${absolutePath}`);
        }

        sysLogger.log(LogLevel.ACTION, `正在提取并准备挂载本地文件: ${absolutePath} (添加网格: ${grid})`);

        try {
            if (!provider) {
                throw new Error('未提供底层的模型驱动，无法执行文件挂载操作。');
            }

            await provider.uploadFile(absolutePath, grid);

            try {
                const ext = path.extname(absolutePath).toLowerCase();
                const textExts = ['.ts', '.js', '.json', '.md', '.txt', '.css', '.html', '.config', '.ahk', '.py', '.java', '.c', '.cpp', '.rs', '.go', '.xml', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.env'];
                if (textExts.includes(ext) && ContextManager.activeInstance) {
                    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
                    const fileTokens = ContextManager.activeInstance.calculateRawTokens(fileContent);
                    ContextManager.activeInstance.addExtraTokens(fileTokens);
                }
            } catch (e) {
            }

            let feedback = `【系统自动反馈：文件挂载成功】\n文件 \`${absolutePath}\` 已经成功挂载到当前对话框中！请直接分析该文件内容并得出结论。`;

            // 处理日志归档
            try {
                const savedMeta = sysLogger.saveAttachment(absolutePath);
                if (savedMeta) {
                    feedback += `\n> 💾 日志已归档文件副本: [${savedMeta.fileName}](${savedMeta.relativePath})`;
                }

                let uploadLog = `[系统主动挂载文件]: ${absolutePath}\n`;
                if (savedMeta) {
                    uploadLog += `> 💾 已归档至: [${savedMeta.relativePath}](${savedMeta.relativePath})\n`;
                }
                sysLogger.appendChat('File_Upload', uploadLog);
            } catch (e: any) {
                // 忽略日志附件存档错误
            }

            return feedback;
        } catch (err: any) {
            throw new Error(`文件挂载逻辑异常: ${err.message}`);
        }
    }
}