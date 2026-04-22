import { confirm, input } from '@inquirer/prompts';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

export class HumanAction extends BaseAction {
    tag = 'human';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const type = (attributes['type'] || 'qa').toLowerCase();
        const channel = attributes['channel'];
        const target = attributes['target'];
        const hardware = attributes['hardware'];
        const timeoutStr = attributes['timeout'];

        let promptMsg = content.trim() || 'AI 请求人类介入：';
        
        if (channel && target) {
            sysLogger.log(LogLevel.INFO, `[模拟网络推送] 准备通过 ${channel} 向 ${target} 发送阻塞通知...`);
            promptMsg = `(来自 ${channel} - ${target}) ${promptMsg}`;
        }

        if (type === 'physical' && hardware) {
            promptMsg = `[物理设备交互: ${hardware}] ${promptMsg}`;
        }

        sysLogger.log(LogLevel.WARN, `进入人类协同阻塞模式，挂起主线程等待外部信号: [${type}]`);

        try {
            let answer: string | boolean;

            if (type === 'approval') {
                answer = await confirm({ message: promptMsg, default: true });
                sysLogger.log(LogLevel.SUCCESS, `收到人类审批结果: ${answer}`);
                return { 
                    type: 'human', 
                    content: `【系统自动反馈：人类审批结果】\n人类选择了: ${answer ? '同意 (Yes)' : '拒绝 (No)'}。请根据此决策继续或终止后续任务。` 
                };
            } 
            else if (type === 'physical') {
                answer = await confirm({ message: promptMsg + ' (完成后请确认)', default: true });
                sysLogger.log(LogLevel.SUCCESS, `收到物理交互确认: ${answer}`);
                return { 
                    type: 'human', 
                    content: `【系统自动反馈：物理交互结果】\n外部反馈: ${answer ? '已完成物理操作' : '操作失败或被人类拒绝'}。` 
                };
            } 
            else if (type === 'rescue') {
                sysLogger.log(LogLevel.ERROR, `任务请求人类兜底救援！(可在此处拓展自动发送错误日志和截图的逻辑)`);
                answer = await input({ message: `[异常兜底] ${promptMsg}` });
                return { 
                    type: 'human', 
                    content: `【系统自动反馈：人类兜底指导】\n人类给出了如下纠正建议:\n${answer}` 
                };
            }
            else {
                // 默认 qa 问答模式
                answer = await input({ message: promptMsg });
                sysLogger.log(LogLevel.SUCCESS, `收到人类答复: ${answer}`);
                return { 
                    type: 'human', 
                    content: `【系统自动反馈：人类答复内容】\n${answer}` 
                };
            }
        } catch (err: any) {
            if (err.name === 'ExitPromptError') {
                sysLogger.log(LogLevel.ERROR, '人类强制中止了交互通信');
                return {
                    type: 'interrupt',
                    content: '人类中止了交互'
                };
            }
            throw err;
        }
    }
}