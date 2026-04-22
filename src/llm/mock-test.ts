import type { ILLMProvider, ChatMessage } from './interface.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class MockTestProvider implements ILLMProvider {
    name = 'MockTest';
    private payload: string = '';

    setPayload(content: string) {
        this.payload = content;
    }

    async init(headless: boolean = false): Promise<void> {
        sysLogger.log(LogLevel.INFO, 'Mock 驱动已就绪（沙盒测试模式）。');
    }

    async ask(prompt: string, history?: ChatMessage[]): Promise<string> {
        sysLogger.log(LogLevel.INFO, 'Mock 驱动已拦截网络请求，将直接返回测试负载。');
        return this.payload;
    }

    async resetSession(): Promise<void> {
        sysLogger.log(LogLevel.INFO, 'Mock 会话记忆已重置。');
    }

    async uploadFile(absolutePath: string, useGrid: boolean = true): Promise<void> {
        sysLogger.log(LogLevel.INFO, `[Mock 模式] 模拟拦截文件挂载: ${absolutePath}`);
    }

    async close(): Promise<void> {
    }
}