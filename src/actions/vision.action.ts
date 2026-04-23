import fs from 'fs';
import path from 'path';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';
import screenshot from 'screenshot-desktop';
import { createWorker } from 'tesseract.js';
import type { ILLMProvider } from '../llm/interface.js';

/**
 * 处理 <vision> 标签：充当 Agent 的“眼睛”，支持截屏、打网格与本地 OCR 识别
 */
export class VisionAction extends BaseAction {
    tag = 'vision';

    async execute(attributes: Record<string, string>, content: string, provider?: ILLMProvider): Promise<ActionResult> {
        const action = attributes['action'];
        if (!action) {
            throw new Error('<vision> 标签缺少必填属性 action');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行视觉操作: ${action}`);

        const outputDir = path.resolve(process.cwd(), '.ccli', 'image');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        try {
            if (action === 'screenshot' || action === 'grid') {
                const imgName = `screenshot_${Date.now()}.png`;
                let imgPath = path.join(outputDir, imgName);

                // 执行跨平台物理截屏
                await screenshot({ filename: imgPath });

                if (action === 'grid') {
                    imgPath = await addGridToImage(imgPath, outputDir);
                }

                // 如果存在底层模型引擎，直接调用文件注入以视觉挂载
                if (provider) {
                    await provider.uploadFile(imgPath, false);
                }

                return {
                    type: 'vision',
                    content: `【系统自动反馈】已截取当前屏幕 ${action === 'grid' ? '(并覆盖物理网格)' : ''}，保存至: ${imgPath}，并已挂载至对话上下文。`
                };
            }
            else if (action === 'ocr') {
                const imgPath = path.join(outputDir, `ocr_temp_${Date.now()}.png`);
                await screenshot({ filename: imgPath });

                const ocrModelDir = path.resolve(process.cwd(), '.ccli', 'ocr');
                if (!fs.existsSync(ocrModelDir)) {
                    fs.mkdirSync(ocrModelDir, { recursive: true });
                }

                sysLogger.log(LogLevel.INFO, '正在执行本地屏幕 OCR 文本识别...');
                const worker = await createWorker('chi_sim+eng', 1, {
                    langPath: ocrModelDir
                });
                const { data: { text } } = await worker.recognize(imgPath);
                await worker.terminate();

                // 清理临时截图
                fs.unlinkSync(imgPath);

                return {
                    type: 'vision',
                    content: `【系统自动反馈：屏幕 OCR 提取结果】\n${text.trim() || '未识别到明显的可用文本。'}`
                };
            }
            else if (action === 'inspect' || action === 'match') {
                return {
                    type: 'vision',
                    content: `【系统自动反馈】操作被拒绝。高级控件树嗅探与图像模板比对 (match) 暂未就绪，请优先使用 grid 和 ocr 以视觉推断坐标。`
                };
            }
            else {
                throw new Error(`不支持的视觉动作: ${action}`);
            }
        } catch (err: any) {
            throw new Error(`视觉感知执行异常: ${err.message}`);
        }
    }
}