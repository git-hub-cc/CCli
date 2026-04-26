import fs from 'fs';
import path from 'path';
import fastGlob from 'fast-glob';
import { fileURLToPath } from 'url';
import { extractMarkdownMeta } from '../core/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

/**
 * 辅助函数：扫描指定目录并将匹配的文件内容追加到上下文中
 */
async function appendDirToContext(dirPath: string, globPattern: string, prefix: string, ignore?: string[]): Promise<string> {
    let result = '';
    if (fs.existsSync(dirPath)) {
        const files = await fastGlob(globPattern, { cwd: dirPath, ignore });
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const ext = path.extname(file).replace('.', '') || 'text';
            const rawContent = fs.readFileSync(filePath, 'utf-8');
            
            let displayContent = rawContent;
            
            // 为了防止 YAML 头导致 Markdown 嵌套解析错误，提取为明文元数据
            if (ext === 'md') {
                const { meta, body } = extractMarkdownMeta(rawContent);
                if (Object.keys(meta).length > 0) {
                    displayContent = `[Meta]: ${JSON.stringify(meta)}\n\n${body.trim()}`;
                }
            }
            
            result += `## 📄 文件: ${prefix}/${file}\n\n\`\`\`${ext}\n${displayContent}\n\`\`\`\n\n---\n\n`;
        }
    }
    return result;
}

/**
 * 构建用于各种 /recap 模式的全局上下文
 * 自动聚合相关目录以及内存中的对话历史，并将其写入本地 res.md
 * @returns {Promise<string>} 返回生成的 res.md 文件的绝对路径
 */
export async function buildRecapContext(
    chatHistory: { role: string, content: string }[],
    mode: 'macros' | 'data' | 'prompts' = 'macros'
): Promise<string> {
    let content = '';
    const cwd = process.cwd();

    if (mode === 'macros') {
        content += await appendDirToContext(path.resolve(PKG_ROOT, 'scripts'), '**/*.{md,ahk,js,ts,py}', 'scripts');
        content += await appendDirToContext(path.resolve(PKG_ROOT, 'macros'), '**/*.md', 'macros');
        content += await appendDirToContext(path.resolve(cwd, '.ccli', 'scripts'), '**/*.{md,ahk,js,ts,py}', '.ccli/scripts');
    } else if (mode === 'data') {
        content += await appendDirToContext(path.resolve(cwd, '.ccli', 'data'), '**/*.md', '.ccli/data');
    } else if (mode === 'prompts') {
        content += await appendDirToContext(path.resolve(PKG_ROOT, 'prompts'), '**/*.md', 'prompts', ['recap/**']);
    }

    // 注入当前内存的历史记录
    content += '## 💬 内存状态: 当前对话历史 (chatHistory)\n\n';
    if (chatHistory.length === 0) {
        content += '暂无历史记录。\n\n';
    } else {
        for (const msg of chatHistory) {
            content += `**[${msg.role}]**:\n${msg.content}\n\n`;
        }
    }
    content += '---\n\n';

    // 将聚合后的内容写入物理文件 res.md (工作区数据存放在 cwd)
    const resFilePath = path.resolve(cwd, 'res.md');
    fs.writeFileSync(resFilePath, content, 'utf-8');

    return resFilePath;
}