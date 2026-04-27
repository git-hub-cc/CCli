import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActionRegistry, type ActionResult } from '../actions/base.js';
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

        // 匹配闭合标签 <tag attr="val">content</tag> 与自闭合标签 <tag attr="val" />
        const tagRegex = /<([a-zA-Z0-9_-]+)([^>]*?)(?:>([\s\S]*?)<\/\1>|\/>)/gi;
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
     * 执行解析出的节点流，并收集结构化的反馈对象
     */
    static async executeNodes(nodes: ParsedNode[], provider?: ILLMProvider): Promise<ActionResult[]> {
        const readNodes = nodes.filter(n => n.tag === 'file' && (n.attributes['action'] === 'read' || n.attributes['type'] === 'read'));
        let optimizedNodes = nodes;

        if (readNodes.length > 1) {
            const mergedPaths = readNodes.map(n => n.attributes['path']).filter(Boolean).join(',');
            let firstReplaced = false;
            optimizedNodes = nodes.filter(n => {
                if (n.tag === 'file' && (n.attributes['action'] === 'read' || n.attributes['type'] === 'read')) {
                    if (!firstReplaced) {
                        n.attributes['action'] = 'pack';
                        n.attributes['path'] = mergedPaths;
                        firstReplaced = true;
                        return true;
                    }
                    return false;
                }
                return true;
            });
            sysLogger.log(LogLevel.INFO, `检测到多个连续的文件读取操作，已自动优化合并为 pack 批量处理`);
        }

        const feedbacks: ActionResult[] = [];

        for (const node of optimizedNodes) {
            const actionInstance = ActionRegistry.get(node.tag);

            if (!actionInstance) {
                // 尝试在 macros 目录下寻找同名的动态宏技能
                const macroFilePath = path.resolve(PKG_ROOT, 'macros', `${node.tag}.md`);
                if (fs.existsSync(macroFilePath)) {
                    sysLogger.log(LogLevel.ACTION, `识别到动态宏技能标签: <${node.tag}>，正在展开执行...`);
                    sysLogger.appendActionTrace(`[MACRO-START] 展开宏技能 <${node.tag}> | 属性: ${JSON.stringify(node.attributes)}`);
                    
                    try {
                        const macroRawContent = fs.readFileSync(macroFilePath, 'utf-8');
                        
                        const requiresMatch = macroRawContent.match(/requires:\s*(.+)/);
                        if (requiresMatch && requiresMatch[1]) {
                            sysLogger.log(LogLevel.INFO, `[预检] 当前技能依赖前置条件: ${requiresMatch[1].trim()}`);
                        }

                        // 移除文件顶部的 YAML Meta 头 (--- xxx ---)
                        let template = macroRawContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();

                        // 注入 {_content_} 代表标签内部的文本内容
                        const rawArgValue = node.content
                            .replace(/`/g, '``')
                            .replace(/"/g, '`"')
                            .replace(/\$/g, '`$');
                        template = template.replace(/\{_content_\}/g, () => rawArgValue);

                        // 解析宏定义中的 params，映射到 XML 属性传参
                        const attrMatch = macroRawContent.match(/params:\s*(.+)/);
                        const paramNames = attrMatch && attrMatch[1] ? attrMatch[1].split(',').map(s => s.trim()) : [];
                        
                        for (let i = 0; i < paramNames.length; i++) {
                            const paramName = paramNames[i];
                            let argValue = node.attributes[paramName] || '';
                            argValue = argValue
                                .replace(/`/g, '``')
                                .replace(/"/g, '`"')
                                .replace(/\$/g, '`$');

                            template = template.replace(new RegExp(`\\{${paramName}\\}`, 'g'), () => argValue);
                        }

                        const innerNodes = AIMLParser.parse(template);
                        const innerFeedbacks = await AIMLParser.executeNodes(innerNodes, provider);
                        feedbacks.push(...innerFeedbacks);
                        
                        sysLogger.appendActionTrace(`[MACRO-END] 宏技能 <${node.tag}> 执行完毕`);
                    } catch (err: any) {
                        sysLogger.log(LogLevel.ERROR, `动态宏技能 <${node.tag}> 展开执行失败: ${err.message}`);
                        sysLogger.appendActionTrace(`[MACRO-ERROR] 宏技能 <${node.tag}> 异常: ${err.message}`);
                        feedbacks.push({ type: 'error', content: `【系统自动反馈：宏技能 <${node.tag}> 执行异常】\n${err.message}` });
                    }
                    continue;
                }

                sysLogger.log(LogLevel.WARN, `未识别的 AIML 标签: <${node.tag}>，已被忽略。`);
                sysLogger.appendActionTrace(`[SKIP] 未知动作标签 <${node.tag}>`);
                continue;
            }

            try {
                sysLogger.appendActionTrace(`[START] 动作 <${node.tag}> | 属性: ${JSON.stringify(node.attributes)}`);
                const feedback = await actionInstance.execute(node.attributes, node.content, provider);
                if (feedback) {
                    feedbacks.push(feedback);
                    sysLogger.appendActionTrace(`[END] 动作 <${node.tag}> 成功 | 返回类型: ${feedback.type}`);
                } else {
                    sysLogger.appendActionTrace(`[END] 动作 <${node.tag}> 成功 | 无状态返回`);
                }
            } catch (err: any) {
                sysLogger.log(LogLevel.ERROR, `<${node.tag}> 动作执行失败: ${err.message}`);
                sysLogger.appendActionTrace(`[ERROR] 动作 <${node.tag}> 失败 | 异常: ${err.message}`);

                let errorMsgStr = err.message || String(err);
                if (errorMsgStr.length > localConfig.maxErrorLogLength) {
                    errorMsgStr = `...[前方内容已截断]\n${errorMsgStr.slice(-localConfig.maxErrorLogLength)}`;
                }

                const errorMsg = `【系统自动反馈：<${node.tag}> 执行异常】\n${errorMsgStr}`;
                feedbacks.push({ type: 'error', content: errorMsg });
            }
        }

        return feedbacks;
    }
}