import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActionRegistry } from '../actions/base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';
import type { ILLMProvider } from '../llm/interface.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

export interface ParsedNode {
    tag: string;
    attributes: Record<string, string>;
    content: string;
}

export class AIMLParser {
    /**
     * 解析 AI 回复中的 XML 风格标签
     * @param responseText AI 的原始回复文本
     */
    static parse(responseText: string): ParsedNode[] {
        const nodes: ParsedNode[] = [];

        // 匹配闭合标签 <tag attr="val">content</tag> 或自闭合标签 <tag attr="val" />
        const tagRegex = /<([a-zA-Z0-9_-]+)([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
        const attrRegex = /([a-zA-Z0-9_-]+)=["']([^"']+)["']/gi;

        let match;
        while ((match = tagRegex.exec(responseText)) !== null) {
            const tag = match[1]!.toLowerCase();
            const attrString = match[2] || '';
            const content = match[3] ? match[3].trim() : '';

            const attributes: Record<string, string> = {};
            let attrMatch;
            while ((attrMatch = attrRegex.exec(attrString)) !== null) {
                attributes[attrMatch[1]!] = attrMatch[2]!;
            }

            nodes.push({ tag, attributes, content });
        }

        // 如果没有任何标签，但有文本内容，将其包装为隐式 <text> 标签
        if (nodes.length === 0 && responseText.trim()) {
            nodes.push({ tag: 'text', attributes: {}, content: responseText.trim() });
        }

        return nodes;
    }

    /**
     * 执行解析出的节点流，并收集反馈
     */
    static async executeNodes(nodes: ParsedNode[], provider?: ILLMProvider): Promise<string[]> {
        const feedbacks: string[] = [];

        for (const node of nodes) {
            const actionInstance = ActionRegistry.get(node.tag);

            if (!actionInstance) {
                // 尝试在 macros 目录下寻找同名的动态宏技能
                const macroFilePath = path.resolve(PKG_ROOT, 'macros', `${node.tag}.md`);
                if (fs.existsSync(macroFilePath)) {
                    sysLogger.log(LogLevel.ACTION, `识别到动态宏技能标签: <${node.tag}>，正在展开执行...`);
                    try {
                        const macroRawContent = fs.readFileSync(macroFilePath, 'utf-8');
                        
                        const requiresMatch = macroRawContent.match(/requires:\s*(.+)/);
                        if (requiresMatch && requiresMatch[1]) {
                            sysLogger.log(LogLevel.INFO, `[预检] 当前技能依赖前置条件: ${requiresMatch[1].trim()}`);
                        }

                        // 移除文件顶部的 YAML Meta 头 (--- xxx ---)
                        let template = macroRawContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();

                        // 注入 {0} 代表未切割的原始参数字符串，防止由于参数自带英文逗号引发解析异常
                        const rawArgValue = node.content
                            .replace(/`/g, '``')
                            .replace(/"/g, '`"')
                            .replace(/\$/g, '`$');
                        template = template.replace(/\{0\}/g, () => rawArgValue);

                        // 按照逗号分割提取参数
                        const args = node.content.split(',');
                        for (let i = 0; i < args.length; i++) {
                            // 必须优先转义反引号，防止后续步骤添加的反引号被错误地二次转义
                            args[i] = args[i]
                                .replace(/`/g, '``')
                                .replace(/"/g, '`"')
                                .replace(/\$/g, '`$');

                            const argValue = args[i]?.trim() || '';
                            // 替换 {1}, {2} 等占位符。使用函数返回值避免 argValue 中含有特殊 $ 符号引发错误
                            template = template.replace(new RegExp(`\\{${i + 1}\\}`, 'g'), () => argValue);
                        }

                        template = template.replace(/\{\d+\}/g, '');
                        template = template.replace(/\.\/scripts\//g, `${PKG_ROOT.replace(/\\/g, '/')}/scripts/`);

                        const innerNodes = AIMLParser.parse(template);
                        const innerFeedbacks = await AIMLParser.executeNodes(innerNodes, provider);
                        feedbacks.push(...innerFeedbacks);
                    } catch (err: any) {
                        sysLogger.log(LogLevel.ERROR, `动态宏技能 <${node.tag}> 展开执行失败: ${err.message}`);
                        feedbacks.push(`【系统自动反馈：宏技能 <${node.tag}> 执行异常】\n${err.message}`);
                    }
                    continue;
                }

                sysLogger.log(LogLevel.WARN, `未识别的 AIML 标签: <${node.tag}>，已被忽略。`);
                continue;
            }

            try {
                const feedback = await actionInstance.execute(node.attributes, node.content, provider);
                if (feedback) {
                    feedbacks.push(feedback);
                }
            } catch (err: any) {
                sysLogger.log(LogLevel.ERROR, `<${node.tag}> 动作执行失败: ${err.message}`);

                // 全局兜底拦截：如果某个插件抛出的异常日志过大，强制执行截断
                let errorMsgStr = err.message || String(err);
                if (errorMsgStr.length > localConfig.maxErrorLogLength) {
                    errorMsgStr = `...[前方内容已截断]\n${errorMsgStr.slice(-localConfig.maxErrorLogLength)}`;
                }

                const errorMsg = `【系统自动反馈：<${node.tag}> 执行异常】\n${errorMsgStr}`;
                feedbacks.push(errorMsg);
            }
        }

        return feedbacks;
    }
}