import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import vm from 'vm';
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

export class SandboxAction extends BaseAction {
    tag = 'sandbox';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const lang = (attributes['lang'] || 'node').toLowerCase();
        const code = content.trim();

        if (!code) {
            throw new Error('<sandbox> 标签内容不能为空');
        }

        sysLogger.log(LogLevel.ACTION, `准备在沙箱中执行代码: ${lang}`);

        try {
            if (lang === 'node' || lang === 'javascript' || lang === 'js') {
                const sandboxEnv = {
                    console: {
                        log: (...args: any[]) => sandboxEnv.output += args.join(' ') + '\n',
                        error: (...args: any[]) => sandboxEnv.output += '[ERROR] ' + args.join(' ') + '\n'
                    },
                    output: '',
                    Buffer,
                    Math,
                    Date
                };

                const context = vm.createContext(sandboxEnv);
                const script = new vm.Script(code);
                
                script.runInContext(context, { timeout: 10000 });
                
                sysLogger.log(LogLevel.SUCCESS, `沙箱代码 (Node) 执行完毕`);
                return {
                    type: 'sandbox',
                    content: `【系统自动反馈：沙箱执行结果】\n${sandboxEnv.output.trim() || '执行成功，无输出'}`
                };

            } else if (lang === 'python' || lang === 'py') {
                const tempDir = path.resolve(process.cwd(), '.ccli');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                
                const tempFile = path.resolve(tempDir, `sandbox_${Date.now()}.py`);
                fs.writeFileSync(tempFile, code, 'utf-8');

                try {
                    const { stdout, stderr } = await execa('python', [tempFile], { timeout: 15000 });
                    fs.unlinkSync(tempFile);
                    sysLogger.log(LogLevel.SUCCESS, `沙箱代码 (Python) 执行完毕`);
                    
                    return {
                        type: 'sandbox',
                        content: `【系统自动反馈：沙箱执行结果】\n${stdout.trim() || stderr.trim() || '执行成功，无输出'}`
                    };
                } catch (execErr: any) {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    throw execErr;
                }

            } else {
                throw new Error(`不支持的沙箱语言: ${lang}`);
            }
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `沙箱执行失败: ${err.message}`);
            throw new Error(`沙箱执行异常:\n${err.message}`);
        }
    }
}