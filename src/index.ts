#!/usr/bin/env node
import { Command } from 'commander';
import { sysLogger, LogLevel } from './core/logger.js';
import { registerAllActions } from './actions/index.js';
import { ChatEngine } from './core/chat-engine.js';

const program = new Command();

program
    .name('ccli')
    .description('下一代 Agentic CLI 工具 (ccli)')
    .version('2.0.0');

program.option('-v, --verbose', '开启 Debug 模式');

program
    .command('chat')
    .description('开启连续对话模式 (Agent 模式)')
    .option('--headless', '后台静默运行浏览器 (节省内存，更快响应)')
    .option('-p, --provider <name>', '指定底层模型驱动 (支持: gemini, doubao, agentrouter, mimo)')
    .action(async (options) => {
        sysLogger.initSession();
        sysLogger.log(LogLevel.INFO, `初始化对话会话，日志目录: ${sysLogger.getSessionDir()}`);

        registerAllActions();

        const engine = new ChatEngine({
            provider: options.provider,
            headless: !!options.headless
        });

        await engine.start();
    });

process.on('unhandledRejection', (reason) => {
    sysLogger.log(LogLevel.ERROR, `未处理的 Promise 拒绝: ${reason}`);
    process.exit(1);
});

program.parse(process.argv);