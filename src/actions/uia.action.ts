import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

export class UiaAction extends BaseAction {
    tag = 'uia';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        const target = attributes['target'];
        
        if (!action) {
            throw new Error('<uia> 标签缺少必填属性 action (scan/click/fill/scroll)');
        }
        if (!target) {
            throw new Error('<uia> 标签缺少必填属性 target (目标窗口名称或类名)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行 UIA 原生自动化操作: ${action} -> ${target}`);

        try {
            const scriptPath = path.resolve(PKG_ROOT, 'scripts', 'python', 'uia-bridge.py');
            const args = ['--action', action, '--target', target];
            
            if (attributes['id']) {
                args.push('--id', attributes['id']);
            }
            
            const value = attributes['value'] || content;
            if (value) {
                args.push('--value', value);
            }

            const { stdout, stderr } = await execa('python', [scriptPath, ...args], {
                timeout: 25000,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });

            if (stderr && !stdout) {
                throw new Error(`Python Bridge Error: ${stderr}`);
            }

            const result = JSON.parse(stdout.trim());

            if (result.status === 'error') {
                throw new Error(result.message);
            }

            if (action === 'scan') {
                const elements = result.elements || [];
                if (elements.length === 0) {
                    return { type: 'uia', content: `【系统自动反馈】未在窗口 "${target}" 可视区域内检测到有效的交互元素。` };
                }
                
                const formatList = elements.map((e: any) => `[${e.id}] ${e.type} - "${e.name}"`);
                return {
                    type: 'uia',
                    content: `【系统自动反馈：UIA 交互元素扫描结果】\n已为目标窗口 "${target}" 分配短 ID。\n------------------------------------------\n${formatList.join('\n')}\n------------------------------------------\n提示：请使用 action="click/fill" 并传入 id 执行后续操作。`
                };
            }

            sysLogger.log(LogLevel.SUCCESS, `UIA 操作执行成功: ${result.message}`);
            return { type: 'uia', content: `【系统自动反馈】${result.message}` };

        } catch (err: any) {
            if (err.timedOut) {
                throw new Error(`UIA 操作超时 (25s): 目标软件可能卡死或 UIA 树过于庞大。`);
            }
            throw new Error(`UIA 操作异常: ${err.message}`);
        }
    }
}