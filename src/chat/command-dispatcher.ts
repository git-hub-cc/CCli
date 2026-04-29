import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { sysLogger, LogLevel } from '../core/logger.js';
import { ContextManager } from '../core/context-manager.js';
import { spawnDetachedWindow } from '../core/utils.js';
import { SkillManager } from '../core/skill-manager.js';

export class CommandDispatcher {
    /**
     * 拦截处理系统级本地指令，将其与常规大模型对话隔离
     */
    static handle(text: string, contextManager: ContextManager, providerName?: string): 'continue' | 'exit' | 'pass' {
        const lowerText = text.toLowerCase();

        // 拦截并处理技能系统指令
        if (lowerText.startsWith('/skill')) {
            const parts = text.split(' ').filter(Boolean);
            const cmd = parts[1] ? parts[1].toLowerCase() : 'list';
            const arg = parts.slice(2).join(' ');

            if (cmd === 'list') {
                const skills = SkillManager.getAllSkills();
                if (skills.length === 0) {
                    console.log(chalk.yellow(`\n未找到任何技能。当前扫描路径: ${path.resolve(process.cwd(), 'skills')}\n`));
                } else {
                    console.log(chalk.cyan(`\n=== 本地可用技能 (${skills.length}) ===`));

                    const grouped: Record<string, typeof skills> = {};
                    skills.forEach(s => {
                        const cat = s.category || 'other';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(s);
                    });

                    for (const cat of Object.keys(grouped).sort()) {
                        console.log(chalk.green(`\n[ ${cat} ]`));
                        grouped[cat].forEach(s => {
                            console.log(`  ` + chalk.white(`${s.name}: `) + chalk.gray(s.description.substring(0, 100)));
                        });
                    }
                    console.log('');
                }
            } else if (cmd === 'search') {
                const skills = SkillManager.searchSkills(arg);
                console.log(chalk.cyan(`\n=== 搜索结果 (${skills.length}) ===`));
                skills.forEach(s => console.log(chalk.white(`- [${s.category}] ${s.name}: `) + chalk.gray(s.description.substring(0, 100))));
                console.log('');
            } else if (cmd === 'inspect') {
                const skill = SkillManager.getSkillByName(arg);
                if (skill) {
                    console.log(chalk.cyan(`\n=== 技能详情: ${skill.name} ===`));
                    console.log(chalk.white(`分类: ${skill.category || '无'}`));
                    console.log(chalk.white(`版本: ${skill.version || '未知'}`));
                    console.log(chalk.white(`路径: ${skill.dirPath}`));
                    console.log(chalk.white(`描述: ${skill.description}`));
                    console.log(chalk.white(`提供工具: ${skill.provides_tools?.join(', ') || '无'}\n`));
                } else {
                    console.log(chalk.yellow(`\n未找到技能: ${arg}\n`));
                }
            } else {
                console.log(chalk.yellow('\n用法: /skill [list|search <keyword>|inspect <name>]\n'));
            }
            return 'continue';
        }

        // 拦截并分发复盘指令
        if (lowerText.startsWith('/recap')) {
            sysLogger.appendChat('Raw_User', text);

            const history = contextManager.getHistory();
            const timestamp = Date.now();
            const tempFile = path.resolve(process.cwd(), '.ccli', 'data', `temp_history_${timestamp}.json`);

            if (!fs.existsSync(path.dirname(tempFile))) {
                fs.mkdirSync(path.dirname(tempFile), { recursive: true });
            }
            fs.writeFileSync(tempFile, JSON.stringify(history, null, 2), 'utf-8');

            let mode = 'macros';
            if (lowerText.includes('data')) mode = 'data';
            if (lowerText.includes('prompts')) mode = 'prompts';

            const providerOpt = providerName ? `-p ${providerName}` : '';
            const cmd = `ccli chat --recap-mode ${mode} --history-file "${tempFile}" ${providerOpt}`;

            sysLogger.log(LogLevel.INFO, `正在独立窗口启动复盘进程...`);
            try {
                spawnDetachedWindow(cmd);
                sysLogger.log(LogLevel.SUCCESS, `复盘进程已分离启动，您可以继续在当前窗口交互。`);
            } catch (e: any) {
                sysLogger.log(LogLevel.ERROR, `分离启动失败: ${e.message}`);
            }
            return 'continue';
        }

        // 拦截并处理退出指令
        if (['exit', 'quit', 'q'].includes(lowerText)) {
            sysLogger.appendChat('Raw_User', text);
            sysLogger.log(LogLevel.INFO, '正在退出...');
            return 'exit';
        }

        // 非本地指令，放行给大模型
        return 'pass';
    }
}