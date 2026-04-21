#!/usr/bin/env node
import { Command } from 'commander';
import { sysLogger, LogLevel } from './core/logger.js';
import { registerAllActions } from './actions/index.js';
import { ChatEngine } from './core/chat-engine.js';
import { getMaskedConfig } from './core/config.js';

const program = new Command();

program
    .name('ccli')
    .description('下一代 Agentic CLI 工具 (ccli)')
    .version('0.1.0', '-v, --version');

program
    .command('chat')
    .description('开启连续对话模式 (Agent 模式)')
    .option('--headless', '后台静默运行浏览器 (节省内存，更快响应)')
    .option('-p, --provider <name>', '指定底层模型驱动 (支持: gemini, doubao, agentrouter, mimo, siliconflow)')
    .option('--recap-mode <mode>', '作为子进程执行单次复盘模式 (支持: macros, data, prompts)')
    .option('--history-file <path>', '复盘模式专用的上下文快照 JSON 文件路径')
    .action(async (options) => {
        sysLogger.initSession();
        sysLogger.log(LogLevel.INFO, `初始化对话会话，日志目录: ${sysLogger.getSessionDir()}`);

        const safeConfig = getMaskedConfig();
        sysLogger.log(LogLevel.INFO, `当前加载的环境配置:\n${JSON.stringify(safeConfig, null, 2)}`);

        registerAllActions();

        const engine = new ChatEngine({
            provider: options.provider,
            headless: !!options.headless,
            recapMode: options.recapMode,
            historyFile: options.historyFile
        });

        await engine.start();
    });

process.on('unhandledRejection', (reason) => {
    sysLogger.log(LogLevel.ERROR, `未处理的 Promise 拒绝: ${reason}`);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    sysLogger.log(LogLevel.ERROR, `未捕获的异常: ${err.message}`);
    process.exit(1);
});

program.parse(process.argv);