import { sysLogger, LogLevel } from '../core/logger.js';
import type { ILLMProvider } from '../llm/interface.js';
import { BaseRecapMode } from './base.js';

export class RecapDispatcher {
    /**
     * 路由调度中心，负责根据用户指令实例化对应的策略执行类
     */
    static async dispatch(command: string, provider: ILLMProvider, chatHistory: { role: string, content: string }[]) {
        const cmd = command.trim().toLowerCase();

        if (cmd === '/recap data') {
            sysLogger.appendDataLog('User', cmd);
            await new BaseRecapMode('data').execute(provider, chatHistory);
        } else if (cmd === '/recap prompts') {
            sysLogger.appendRecapPrompts('User', cmd);
            await new BaseRecapMode('prompts').execute(provider, chatHistory);
        } else if (cmd === '/recap' || cmd === '/recap macros') {
            sysLogger.appendRecapMacros('User', cmd);
            await new BaseRecapMode('macros').execute(provider, chatHistory);
        } else {
            sysLogger.log(LogLevel.WARN, `未知的复盘模式指令: ${cmd}`);
        }
    }
}