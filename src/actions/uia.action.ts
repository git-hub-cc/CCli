import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import fs from 'fs';

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

                let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { background: #1a1a1a; color: #00ffff; margin: 0; padding: 0; font-family: sans-serif; }
        .control-box {
            position: absolute;
            border: 1px solid rgba(0, 255, 255, 0.5);
            background: rgba(0, 255, 255, 0.05);
            box-sizing: border-box;
            pointer-events: auto;
            transition: all 0.1s;
        }
        .control-box:hover {
            border: 2px solid #fff;
            background: rgba(0, 255, 255, 0.3);
            z-index: 9999 !important;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        .id-tag {
            background: #007acc;
            color: white;
            padding: 1px 3px;
            font-size: 10px;
            font-weight: bold;
            position: absolute;
            left: -1px;
            top: -1px;
            white-space: nowrap;
        }
        .content-text {
            font-size: 10px;
            color: #fff;
            position: absolute;
            width: calc(100% - 4px);
            left: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            pointer-events: none;
        }
        .content-text.centered {
            bottom: auto;
            top: 50%;
            transform: translateY(-50%);
            text-align: center;
            opacity: 1;
        }
        .content-text.bottom {
            bottom: 1px;
            opacity: 0.8;
            font-size: 9px;
        }
    </style>
</head>
<body>`;

                elements.forEach((e: any) => {
                    if (e.bbox && e.bbox.w > 0 && e.bbox.h > 0) {
                        const isText = e.type.includes('Text');
                        const titleInfo = `[${e.id}] ${e.type}\nName: ${e.name}`;

                        let innerHtml = '';
                        if (isText && e.name) {
                            innerHtml = `<span class="content-text centered">${e.name}</span>`;
                        } else {
                            innerHtml = `<span class="id-tag">[${e.id}]</span>`;
                        }

                        htmlContent += `
                        <div class="control-box" title="${titleInfo.replace(/"/g, '&quot;')}"
                             style="left:${e.bbox.x}px; top:${e.bbox.y}px; width:${e.bbox.w}px; height:${e.bbox.h}px; z-index:${100 - (e.bbox.w * e.bbox.h / 10000)};">
                            ${innerHtml}
                        </div>`;
                    }
                });

                htmlContent += `</body></html>`;

                const savedHtml = sysLogger.saveScanHtml(htmlContent, 'uia-scan-html');
                const htmlPathDisplay = savedHtml ? savedHtml.relativePath : 'uia-scan-html/001.html';

                const fullContent = `【系统自动反馈：UIA 交互元素扫描结果】\n已为目标窗口 "${target}" 分配短 ID。可视化映射（科技蓝配色）已保存至 \`${htmlPathDisplay}\`。\n------------------------------------------\n${formatList.join('\n')}\n------------------------------------------\n提示：请使用 action="click/fill" 并传入 id 执行后续操作。`;
                const savedScan = sysLogger.saveScanResult(fullContent, 'uia-scan');
                const logContent = `【系统自动反馈：UIA 交互元素扫描结果】\n> 💾 已归档至: [${savedScan?.fileName}](${savedScan?.relativePath})\n提示：请使用 action="click/fill" 并传入 id 执行后续操作。`;

                return {
                    type: 'uia',
                    content: logContent,
                    payload: { fullContent, isStatefulOverwrite: 'uia_scan' }
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