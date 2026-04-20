import fs from 'fs';
import path from 'path';
import ora from 'ora';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';

export class SiliconFlowApiProvider implements ILLMProvider {
    name = 'SiliconFlowAPI';
    private messages: { role: string, content: string }[] = [];

    async init(headless: boolean = false): Promise<void> {
        sysLogger.log(LogLevel.INFO, 'SiliconFlow API 驱动已就绪（API 模式忽略无头参数）。');
        if (!localConfig.siliconflowApiKey) {
            sysLogger.log(LogLevel.WARN, '警告：配置文件中缺少 SILICONFLOW_API_KEY，请求可能会被拒绝。');
        }
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        const spinner = ora('等待 SiliconFlow 响应...').start();

        try {
            this.messages.push({ role: 'user', content: prompt });

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localConfig.siliconflowApiKey}`
            };

            const body = JSON.stringify({
                model: localConfig.siliconflowModel || "deepseek-ai/DeepSeek-V2.5",
                messages: this.messages
            });

            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers,
                body
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json() as any;
            const reply = data.choices?.[0]?.message?.content || '';

            if (!reply) {
                throw new Error('API 返回了空响应或报文格式不匹配');
            }

            this.messages.push({ role: 'assistant', content: reply });

            spinner.succeed('已成功提取 API 响应报文');
            return reply;

        } catch (error: any) {
            spinner.fail('与 API 交互链路发生异常');
            this.messages.pop();
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        sysLogger.log(LogLevel.INFO, '正在物理重置 SiliconFlow API 的内部上下文记忆...');
        this.messages = [];
        sysLogger.log(LogLevel.SUCCESS, 'API 会话记忆已重置。');
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        sysLogger.log(LogLevel.INFO, `[API 模式] 正在读取并注入文件: ${path.basename(absolutePath)}`);

        try {
            const ext = path.extname(absolutePath).toLowerCase();
            const textExts = ['.ts', '.js', '.json', '.md', '.txt', '.css', '.html', '.config', '.ahk'];

            if (textExts.includes(ext) && fs.existsSync(absolutePath)) {
                const content = fs.readFileSync(absolutePath, 'utf-8');
                this.messages.push({
                    role: 'system',
                    content: `[用户主动挂载了文件: ${absolutePath}]\n\n内容如下:\n\`\`\`\n${content}\n\`\`\``
                });
                sysLogger.log(LogLevel.SUCCESS, '文件内容已成功作为系统消息注入 API 上下文。');
            } else {
                this.messages.push({
                    role: 'system',
                    content: `[用户意图挂载二进制或未知文件: ${absolutePath}，由于 API 驱动限制，仅做文件名占位]`
                });
                sysLogger.log(LogLevel.WARN, 'API 模式暂不支持二进制文件视觉读取，仅记录文件操作占位。');
            }
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `读取文件失败: ${err.message}`);
            throw err;
        }
    }

    async close(): Promise<void> {
    }
}