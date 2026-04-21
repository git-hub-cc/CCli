import fs from 'fs';
import path from 'path';
import ora from 'ora';
import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';

export class AgentRouterApiProvider implements ILLMProvider {
    name = 'AgentRouterAPI';
    // API 是无状态的，驱动内部需自行维护对话记忆上下文
    private messages: { role: string, content: string }[] = [];

    async init(headless: boolean = false): Promise<void> {
        sysLogger.log(LogLevel.INFO, 'AgentRouter API 驱动已就绪（API 模式忽略无头参数）。');
        if (!localConfig.defaultApiKey) {
            sysLogger.log(LogLevel.WARN, '警告：配置文件中缺少 AGENTROUTER_API_KEY，请求可能会被拒绝。');
        }
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        const spinner = ora('等待 AgentRouter 响应...').start();

        try {
            // 将最新提问压入内部记忆
            this.messages.push({ role: 'user', content: prompt });

            // 严格遵循请求的所有特征指纹及参数体
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localConfig.defaultApiKey}`,
                'User-Agent': 'QwenCode/0.14.5 (win32; x64)',
                'X-Stainless-Package-Version': '5.11.0',
                'X-Stainless-Lang': 'js',
                'X-Stainless-OS': 'Windows',
                'X-Stainless-Arch': 'x64',
                'X-Stainless-Runtime': 'node',
                'X-Stainless-Runtime-Version': 'v24.14.0',
                'X-Stainless-Retry-Count': '0',
                'Sec-Fetch-Mode': 'cors',
                'Accept-Language': '*',
                'Accept': 'application/json'
            };

            const body = JSON.stringify({
                model: localConfig.defaultModel,
                messages: this.messages,
                temperature: 0.7
            });

            // Native fetch (Node.js >= 18)
            const response = await fetch('https://agentrouter.org/v1/chat/completions', {
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

            // 将 AI 回复压入内部记忆
            this.messages.push({ role: 'assistant', content: reply });

            spinner.succeed('已成功提取 API 响应报文');
            return reply;

        } catch (error: any) {
            spinner.fail('与 API 交互链路发生异常');
            // 如果报错，将刚才压入的 user 提问弹出，避免产生脏数据
            this.messages.pop();
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        sysLogger.log(LogLevel.INFO, '正在物理重置 AgentRouter API 的内部上下文记忆...');
        this.messages = [];
        sysLogger.log(LogLevel.SUCCESS, 'API 会话记忆已重置。');
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        sysLogger.log(LogLevel.INFO, `[API 模式] 正在读取并注入文件: ${path.basename(absolutePath)}`);

        try {
            // 对于 API 驱动，通常通过将文件内容文本化作为 system 提示词注入来实现挂载
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
        // API 调用无持续占据的系统级资源，无需复杂释放逻辑
    }
}