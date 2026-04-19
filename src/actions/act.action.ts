import { execa } from 'execa';
import { BaseAction } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';

/**
 * 处理 <act> 标签：执行终端命令行操作
 */
export class ActAction extends BaseAction {
    tag = 'act';

    async execute(attributes: Record<string, string>, content: string): Promise<string> {
        if (!content || !content.trim()) {
            throw new Error('<act> 标签内容不能为空');
        }

        const command = content.trim().replace(/\[(https?:\/\/[^\]]+)\]\(\1\)/g, '$1');
        sysLogger.log(LogLevel.ACTION, `准备执行终端命令: ${command}`);

        // 内部辅助方法：限制日志长度，保留末尾的有效报错信息
        const truncateLog = (log: string) => {
            if (!log) return '';
            return log.length > localConfig.maxErrorLogLength
                ? `...[前方内容已截断]\n${log.slice(-localConfig.maxErrorLogLength)}`
                : log;
        };

        try {
            let finalCommand = command;
            let shellOpt: string | boolean = true;

            // 针对 Windows 环境的特殊处理
            if (process.platform === 'win32') {
                shellOpt = 'powershell';
                // 静默前置：强制 PowerShell 将 stdout 编码设为 UTF-8，解决跨进程中文乱码问题
                finalCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
            }

            // 使用特定的 shell 执行命令，合并抓取标准输出与错误输出
            const { stdout, stderr } = await execa(finalCommand, { shell: shellOpt });

            let feedback = `【系统自动反馈：命令执行结果】\n`;
            if (stdout) {
                feedback += `[标准输出]\n${truncateLog(stdout)}\n`;
            }
            if (stderr) {
                feedback += `[标准错误]\n${truncateLog(stderr)}\n`;
            }
            if (!stdout && !stderr) {
                feedback += `命令执行成功，无任何控制台输出。`;
            }

            sysLogger.log(LogLevel.SUCCESS, `命令执行完毕`);
            return feedback;

        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `命令执行失败: ${err.shortMessage || err.message}`);
            const errorLog = err.stderr || err.message;
            throw new Error(`终端命令异常退出:\n${truncateLog(errorLog)}`);
        }
    }
}