import { input } from '@inquirer/prompts';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class CaptchaAction extends BaseAction {
    tag = 'captcha';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const solver = (attributes['solver'] || attributes['type'] || 'manual').toLowerCase();
        const msg = content.trim() || '请在此输入你看到的验证码内容：';

        sysLogger.log(LogLevel.ACTION, `准备处理验证码与风控对抗机制: [${solver} 模式]`);

        try {
            if (solver === 'auto') {
                sysLogger.log(LogLevel.INFO, `正在将当前上下文提交至自动化打码平台...`);
                // 此处可用纯 TS 模拟网络延迟或未来拓展对接真实的打码 API
                await new Promise(r => setTimeout(r, 2000));
                
                sysLogger.log(LogLevel.SUCCESS, `打码平台模拟返回成功。`);
                return { 
                    type: 'captcha', 
                    content: `【系统自动反馈：验证码识别结果】\n自动打码服务已尝试处理该验证码（模拟结果：SUCCESS）。如果后续交互依然受阻，请尝试切换至 manual 模式人工介入或检查页面状态。` 
                };
            } else {
                sysLogger.log(LogLevel.WARN, `触发验证码人工介入，正在等待外部人工破解...`);
                const answer = await input({ message: `[人工打码] ${msg}` });
                sysLogger.log(LogLevel.SUCCESS, `人工验证码接收完毕。`);
                return { 
                    type: 'captcha', 
                    content: `【系统自动反馈：人工验证码结果】\n人类提供的验证码内容为: ${answer}` 
                };
            }
        } catch (err: any) {
            if (err.name === 'ExitPromptError') {
                sysLogger.log(LogLevel.ERROR, '人工取消了打码介入');
                return {
                    type: 'interrupt',
                    content: '人工取消了验证码输入'
                };
            }
            throw err;
        }
    }
}