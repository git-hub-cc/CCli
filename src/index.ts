#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { sysLogger, LogLevel } from './core/logger.js';
import { registerAllActions } from './actions/index.js';
import { ChatSession } from './chat/chat-session.js';
import { getMaskedConfig, localConfig } from './core/config.js';
import { TestEngine } from './core/test-engine.js';
import { LLMProviderFactory } from './llm/factory.js';

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

        // 独立处理复盘模式，不污染常规会话的生命周期
        if (options.recapMode && options.historyFile) {
            try {
                const provider = LLMProviderFactory.create(options.provider || localConfig.defaultProvider || 'gemini');
                sysLogger.log(LogLevel.INFO, `正在初始化复盘专享驱动...`);
                await provider.init(!!options.headless);

                let history = [];
                if (fs.existsSync(options.historyFile)) {
                    history = JSON.parse(fs.readFileSync(options.historyFile, 'utf-8'));
                    fs.unlinkSync(options.historyFile);
                }

                const { BaseRecapMode } = await import('./recap/base.js');
                await new BaseRecapMode(options.recapMode as any).execute(provider, history);

                await input({ message: chalk.yellow('复盘执行完毕，按回车键关闭窗口...') });
            } catch (err: any) {
                sysLogger.log(LogLevel.ERROR, `复盘模式执行失败: ${err.message}`);
                const crashLogPath = path.resolve(process.cwd(), '.ccli', 'logs', 'recap-crash.log');
                fs.appendFileSync(crashLogPath, `[${new Date().toISOString()}] ${err.stack || err.message}\n`);
                await input({ message: chalk.red('复盘执行发生异常，请查阅日志。按回车键退出...') });
            }
            return;
        }

        const session = new ChatSession({
            provider: options.provider,
            headless: !!options.headless
        });

        await session.start();
    });

program
    .command('test [caseName]')
    .description('运行本地自动化测试用例')
    .option('--tags <tags>', '通过标签筛选测试用例，逗号分隔 (例: file,act)')
    .action(async (caseName, options) => {
        registerAllActions();
        const engine = new TestEngine();
        await engine.run(caseName, options.tags);
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