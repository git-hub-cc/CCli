import fs from 'fs';
import path from 'path';
import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

/**
 * 处理 <file> 标签：静默写入、修改本地文件
 */
export class FileAction extends BaseAction {
    tag = 'file';

    async execute(attributes: Record<string, string>, content: string): Promise<string> {
        const rawPath = attributes['path'];
        const type = attributes['type'] || 'all';

        if (!rawPath) {
            throw new Error('<file> 标签缺少必要的 path 属性');
        }

        const targetPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
        const fileName = path.basename(targetPath);

        sysLogger.log(LogLevel.ACTION, `准备执行文件操作: ${fileName} (模式: ${type})`);

        try {
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            let cleanContent = content;
            cleanContent = cleanContent.trim().replace(/\[(https?:\/\/[^\]]+)\]\(\1\)/g, '$1');

            if (type === 'all') {
                fs.writeFileSync(targetPath, cleanContent, 'utf-8');
                sysLogger.log(LogLevel.SUCCESS, `文件全量写入成功: ${targetPath}`);
                return `【系统自动反馈：本地文件操作结果】\n文件 \`${rawPath}\` 已成功全量覆盖写入。`;
            } else if (type === 'diff') {
                if (!fs.existsSync(targetPath)) {
                    throw new Error(`文件不存在，无法执行 diff 修改: ${targetPath}`);
                }
                
                const originalContent = fs.readFileSync(targetPath, 'utf-8');
                const patchResult = this.applySimpleDiff(originalContent, cleanContent);
                
                if (patchResult.changed) {
                    fs.writeFileSync(targetPath, patchResult.content, 'utf-8');
                    sysLogger.log(LogLevel.SUCCESS, `文件增量修改成功: ${targetPath}`);
                    return `【系统自动反馈：本地文件操作结果】\n文件 \`${rawPath}\` 已根据 diff 格式成功应用了局部修改。`;
                } else {
                    throw new Error("提供的 diff 块无法匹配原文内容。请检查上下文是否精确，或者退回使用 type=\"all\" 全量重写。");
                }
            } else {
                throw new Error(`不支持的文件操作模式: ${type}`);
            }

        } catch (err: any) {
            throw new Error(`文件操作异常: ${err.message}`);
        }
    }

    private applySimpleDiff(originalContent: string, diffContent: string): { changed: boolean, content: string } {
        const lines = diffContent.split('\n');
        
        let searchLines: string[] = [];
        let replaceLines: string[] = [];
        let inBlock = false;

        for (const line of lines) {
            if (line.startsWith('@@')) continue;
            if (line.startsWith('-') && !line.startsWith('---')) {
                searchLines.push(line.substring(1).replace(/\r$/, ''));
                inBlock = true;
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                replaceLines.push(line.substring(1).replace(/\r$/, ''));
                inBlock = true;
            }
        }

        if (searchLines.length === 0 && replaceLines.length === 0) {
            return { changed: false, content: originalContent };
        }

        const searchText = searchLines.join('\n');
        const replaceText = replaceLines.join('\n');

        const normalizedOriginal = originalContent.replace(/\r\n/g, '\n');
        const normalizedSearch = searchText.replace(/\r\n/g, '\n');

        if (normalizedOriginal.includes(normalizedSearch)) {
            const finalContent = normalizedOriginal.replace(normalizedSearch, replaceText);
            return { changed: true, content: finalContent };
        }

        return { changed: false, content: originalContent };
    }
}