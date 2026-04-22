import fs from 'fs';
import path from 'path';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class MemoryAction extends BaseAction {
    tag = 'memory';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        const domain = attributes['domain'] || 'global';
        const text = content.trim();

        if (!action || !['store', 'recall'].includes(action)) {
            throw new Error('<memory> 标签缺少合法的 action 属性 (store/recall)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行语义记忆操作: [${action}] 领域: ${domain}`);

        const memoryDir = path.resolve(process.cwd(), '.ccli', 'data', 'memory');
        if (!fs.existsSync(memoryDir)) {
            fs.mkdirSync(memoryDir, { recursive: true });
        }
        
        const memoryFile = path.join(memoryDir, `${domain}.json`);
        let memories: string[] = [];

        if (fs.existsSync(memoryFile)) {
            try {
                memories = JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
            } catch (e) {
                memories = [];
            }
        }

        try {
            if (action === 'store') {
                if (!text) throw new Error('store 模式需要提供需要存储的经验内容');
                
                memories.push(text);
                memories = Array.from(new Set(memories));
                
                fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2), 'utf-8');
                sysLogger.log(LogLevel.SUCCESS, `经验已持久化存入 [${domain}] 领域。`);
                
                return { 
                    type: 'memory', 
                    content: `【系统自动反馈】核心经验已成功写入本地持久化语义记忆库（作用域: ${domain}）。这将在未来相同的场景下协助你的决策。` 
                };
            } 
            else if (action === 'recall') {
                if (memories.length === 0) {
                    return { 
                        type: 'memory', 
                        content: `【系统自动反馈：记忆检索】\n领域 [${domain}] 中暂无持久化记忆记录，请直接继续当前任务。` 
                    };
                }
                
                let resultText = '';
                if (text) {
                    const keyword = text.toLowerCase();
                    const matched = memories.filter(m => m.toLowerCase().includes(keyword));
                    if (matched.length > 0) {
                        resultText = matched.map((m, i) => `[提取经验 ${i + 1}] ${m}`).join('\n');
                    } else {
                        resultText = `未找到与特征 "${text}" 高度相关的明确经验，以下是部分兜底记录参考：\n` + 
                                     memories.slice(-5).map((m, i) => `[参考经验 ${i + 1}] ${m}`).join('\n');
                    }
                } else {
                    resultText = memories.slice(-10).map((m, i) => `[经验 ${i + 1}] ${m}`).join('\n');
                }
                
                sysLogger.log(LogLevel.SUCCESS, `已成功从 [${domain}] 提取相关记忆分片`);
                return { 
                    type: 'memory', 
                    content: `【系统自动反馈：本地记忆检索结果】\n${resultText}` 
                };
            }
        } catch (err: any) {
            throw new Error(`语义记忆操作异常: ${err.message}`);
        }

        return { type: 'memory' };
    }
}