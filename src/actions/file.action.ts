import fs from 'fs';
import path from 'path';
import fastGlob from 'fast-glob';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import type { ILLMProvider } from '../llm/interface.js';
import { ContextManager } from '../core/context-manager.js';

/**
 * 处理 <file> 标签：全量写入、增量修改、本地搜索、探测树结构、批量打包挂载
 */
export class FileAction extends BaseAction {
    tag = 'file';

    async execute(attributes: Record<string, string>, content: string, provider?: ILLMProvider): Promise<ActionResult> {
        const rawPath = attributes['path'];
        // 兼容处理老版本的 type 参数
        const action = attributes['action'] || attributes['type'] || 'write';

        if (!rawPath) {
            throw new Error('<file> 标签缺少必要的 path 属性');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行文件操作: ${action} -> ${rawPath}`);

        try {
            switch (action) {
                case 'write':
                case 'overwrite':
                    return this.handleWrite(rawPath, content);
                case 'diff':
                    return this.handleDiff(rawPath, content);
                case 'search':
                    const keyword = attributes['keyword'];
                    if (!keyword) throw new Error('search 模式缺少 keyword 属性');
                    return await this.handleSearch(rawPath, keyword);
                case 'tree':
                    return await this.handleTree(rawPath);
                case 'pack':
                    return await this.handlePack(rawPath, provider);
                default:
                    throw new Error(`不支持的文件操作模式: ${action}`);
            }
        } catch (err: any) {
            throw new Error(`文件操作异常: ${err.message}`);
        }
    }

    private handleWrite(rawPath: string, content: string): ActionResult {
        const targetPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let cleanContent = content;
        cleanContent = cleanContent.trim().replace(/\[(https?:\/\/[^\]]+)\]\(\1\)/g, '$1');

        fs.writeFileSync(targetPath, cleanContent, 'utf-8');
        sysLogger.log(LogLevel.SUCCESS, `文件全量写入成功: ${targetPath}`);
        return {
            type: 'file',
            content: `【系统自动反馈：本地文件操作结果】\n文件 \`${rawPath}\` 已成功全量覆盖写入。`
        };
    }

    private handleDiff(rawPath: string, content: string): ActionResult {
        const targetPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
        let cleanContent = content.trim().replace(/\[(https?:\/\/[^\]]+)\]\(\1\)/g, '$1');

        if (!fs.existsSync(targetPath)) {
            throw new Error(`文件不存在，无法执行 diff 修改: ${targetPath}`);
        }

        const originalContent = fs.readFileSync(targetPath, 'utf-8');
        const patchResult = this.applySimpleDiff(originalContent, cleanContent);

        if (patchResult.changed) {
            fs.writeFileSync(targetPath, patchResult.content, 'utf-8');
            sysLogger.log(LogLevel.SUCCESS, `文件增量修改成功: ${targetPath}`);
            return {
                type: 'file',
                content: `【系统自动反馈：本地文件操作结果】\n文件 \`${rawPath}\` 已根据 diff 格式成功应用了局部修改。`
            };
        } else {
            throw new Error("提供的 diff 块无法匹配原文内容。请检查上下文是否精确，或者退回使用 action=\"write\" 全量重写。");
        }
    }

    private applySimpleDiff(originalContent: string, diffContent: string): { changed: boolean, content: string } {
        const lines = diffContent.split('\n');
        let searchLines: string[] = [];
        let replaceLines: string[] = [];

        for (const line of lines) {
            if (line.startsWith('@@')) continue;
            if (line.startsWith('-') && !line.startsWith('---')) {
                searchLines.push(line.substring(1).replace(/\r$/, ''));
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                replaceLines.push(line.substring(1).replace(/\r$/, ''));
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

    private async handleSearch(rawPath: string, keyword: string): Promise<ActionResult> {
        const targetPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`搜索路径不存在: ${targetPath}`);
        }

        const ignorePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__pycache__/**', '**/.cache/**'];
        const entries = await fastGlob('**/*', {
            cwd: targetPath,
            ignore: ignorePatterns,
            dot: true,
            onlyFiles: true,
            absolute: true
        });

        const lowerKeyword = keyword.toLowerCase();
        const matches = entries.filter(f => path.basename(f).toLowerCase().includes(lowerKeyword)).slice(0, 20);

        if (matches.length === 0) {
            return { type: 'file', content: `【搜索结果】在目标区域未找到名称包含 '${keyword}' 的文件。` };
        }

        let res = `【搜索结果: 找到 ${matches.length} 个高度匹配项】\n`;
        matches.forEach(m => res += `-> ${m}\n`);
        if (matches.length >= 20) res += "... (结果已截断，仅展示前 20 项匹配记录)\n";

        return { type: 'file', content: res };
    }

    private async handleTree(rawPath: string): Promise<ActionResult> {
        const targetPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`扫描路径不存在: ${targetPath}`);
        }

        const ignorePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__pycache__/**', '**/.cache/**'];
        const entries = await fastGlob('**/*', {
            cwd: targetPath,
            ignore: ignorePatterns,
            dot: true,
            onlyFiles: false,
            deep: 4
        });

        if (entries.length === 0) {
            return { type: 'file', content: `【系统自动反馈：扫描结果】\n路径 '${targetPath}' 下没有发现可用文件/目录，或被忽略规则过滤。` };
        }

        entries.sort();
        let pathListStr = entries.map(e => `- ${e}`).join('\n');
        if (entries.length > 100) {
            pathListStr = entries.slice(0, 100).map(e => `- ${e}`).join('\n') + `\n... (截断显示前100项)`;
        }

        return {
            type: 'file',
            content: `【系统自动反馈：目录结构扫描结果】\n当前扫描基准路径: ${targetPath}\n有效目录/文件如下：\n\n${pathListStr}`
        };
    }

    private isBinaryFile(filePath: string): boolean {
        const textExts = ['.md', '.txt', '.js', '.ts', '.json', '.py', '.html', '.css', '.vue', '.java', '.c', '.cpp', '.h', '.xml', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.ahk', '.env'];
        const ext = path.extname(filePath).toLowerCase();
        if (textExts.includes(ext)) return false;

        try {
            const buffer = Buffer.alloc(512);
            const fd = fs.openSync(filePath, 'r');
            const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
            fs.closeSync(fd);
            for (let i = 0; i < bytesRead; i++) {
                if (buffer[i] === 0) return true;
            }
        } catch (e) {
            return true;
        }
        return false;
    }

    private async handlePack(rawPath: string, provider?: ILLMProvider): Promise<ActionResult> {
        const pathList = rawPath.split(',').map(p => p.trim()).filter(Boolean);
        if (pathList.length === 0) {
            throw new Error('打包路径列表为空。');
        }

        const cwd = process.cwd();
        const ignorePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__pycache__/**', '**/.cache/**'];
        let validFiles: string[] = [];
        let binaryCount = 0;

        for (const p of pathList) {
            const absPath = path.isAbsolute(p) ? p : path.resolve(cwd, p);
            if (!fs.existsSync(absPath)) continue;

            if (fs.statSync(absPath).isFile()) {
                if (this.isBinaryFile(absPath)) {
                    binaryCount++;
                } else {
                    validFiles.push(absPath);
                }
            } else {
                const entries = await fastGlob('**/*', {
                    cwd: absPath,
                    ignore: ignorePatterns,
                    dot: true,
                    onlyFiles: true,
                    absolute: true
                });

                for (const entry of entries) {
                    if (this.isBinaryFile(entry)) {
                        binaryCount++;
                    } else {
                        validFiles.push(entry);
                    }
                }
            }
        }

        if (validFiles.length === 0) {
            return { type: 'file', content: `【系统自动反馈：打包失败】未找到有效的文本文件。跳过二进制 ${binaryCount} 项。` };
        }

        let mergedContent = "";
        for (const f of validFiles) {
            const relPath = path.relative(cwd, f).replace(/\\/g, '/');
            let ext = path.extname(f).toLowerCase().replace('.', '') || 'text';
            try {
                const content = fs.readFileSync(f, 'utf-8');
                mergedContent += `## 📄 文件: ${relPath}\n\n\`\`\`${ext}\n${content}\n\`\`\`\n\n---\n\n`;
            } catch (e: any) {
                mergedContent += `## 📄 文件: ${relPath} (读取失败)\n\n> 系统提示：无法读取文件内容 (${e.message})。\n\n---\n\n`;
            }
        }

        const resFilePath = path.join(cwd, 'res.md');
        fs.writeFileSync(resFilePath, mergedContent, 'utf-8');

        if (provider) {
            await provider.uploadFile(resFilePath, false);
            try {
                if (ContextManager.activeInstance) {
                    const fileContent = fs.readFileSync(resFilePath, 'utf-8');
                    const fileTokens = ContextManager.activeInstance.calculateRawTokens(fileContent);
                    ContextManager.activeInstance.addExtraTokens(fileTokens);
                }
            } catch (e) {}
        }

        return {
            type: 'file',
            content: `【系统自动反馈：批量打包成功】\n共提取 ${validFiles.length} 个文本文件，跳过二进制 ${binaryCount} 项。\n已将内容合并至 \`res.md\` 并成功挂载。`
        };
    }
}