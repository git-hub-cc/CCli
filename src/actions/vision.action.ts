import fs from 'fs';
import path from 'path';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { addGridToImage } from '../core/image-processor.js';
import screenshot from 'screenshot-desktop';
import { createWorker } from 'tesseract.js';
import type { ILLMProvider } from '../llm/interface.js';
import { execa } from 'execa';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

/**
 * 处理 <vision> 标签：充当 Agent 的“眼睛”，支持截屏、打网格与本地 OCR 识别
 */
export class VisionAction extends BaseAction {
    tag = 'vision';

    /**
     * 确保本地存在 OCR 训练数据文件，若缺失则自动从镜像源下载
     */
    private async ensureOcrData(ocrModelDir: string, langs: string[]): Promise<void> {
        for (const lang of langs) {
            const fileName = `${lang}.traineddata.gz`;
            const filePath = path.join(ocrModelDir, fileName);

            if (!fs.existsSync(filePath)) {
                sysLogger.log(LogLevel.INFO, `检测到缺失 OCR 语言包: ${fileName}，正在尝试自动下载 (超时: 15s)...`);
                // 使用官方推荐的 4.0.0 版本的训练数据镜像
                const url = `https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/${fileName}`;

                try {
                    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
                    if (!response.ok) {
                        throw new Error(`网络响应异常: ${response.status} ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    fs.writeFileSync(filePath, buffer);
                    sysLogger.log(LogLevel.SUCCESS, `语言包 ${fileName} 已成功下载并保存至本地。`);
                } catch (err: any) {
                    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                        throw new Error(`自动下载 OCR 语言包网络超时 (15s): ${fileName}\n由于网络环境受限，请手动下载并放置到: ${filePath}`);
                    }
                    throw new Error(`自动下载 OCR 语言包失败: ${err.message}\n请手动下载并放置到: ${filePath}`);
                }
            }
        }
    }

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
                const imgPath = path.join(outputDir, `vision_temp_${Date.now()}.png`);
                await screenshot({ filename: imgPath });

                const model = (attributes['model'] || 'tesseract').toLowerCase();
                let ocrText = '';

                if (model === 'paddleocr') {
                    const ocrModelDir = path.resolve(process.cwd(), '.ccli', 'ocr', 'paddleOCR');
                    if (!fs.existsSync(ocrModelDir)) {
                        fs.mkdirSync(ocrModelDir, { recursive: true });
                    }

                    sysLogger.log(LogLevel.INFO, `正在执行本地屏幕文本识别 (PaddleOCR 排版模式)...`);
                    const scriptPath = path.resolve(PKG_ROOT, 'scripts', 'python', 'paddleocr-bridge.py');

                    const { stdout, stderr } = await execa('python', [scriptPath, imgPath, ocrModelDir], {
                        timeout: 60000,
                        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                    });

                    if (stderr && !stdout) {
                        sysLogger.log(LogLevel.WARN, `PaddleOCR 标准错误输出: ${stderr}`);
                    }

                    ocrText = stdout.trim();
                } else {
                    const ocrModelDir = path.resolve(process.cwd(), '.ccli', 'ocr', 'tesseract');
                    if (!fs.existsSync(ocrModelDir)) {
                        fs.mkdirSync(ocrModelDir, { recursive: true });
                    }

                    // 预检并自动下载所需的语言包
                    const requiredLangs = ['chi_sim', 'eng'];
                    await this.ensureOcrData(ocrModelDir, requiredLangs);

                    sysLogger.log(LogLevel.INFO, `正在执行本地屏幕文本识别 (Tesseract)...`);

                    const worker = await createWorker('chi_sim+eng', 1, {
                        langPath: ocrModelDir,
                        cachePath: ocrModelDir,
                        gzip: true
                    });

                    const { data } = await worker.recognize(imgPath);
                    await worker.terminate();

                    ocrText = data.text.trim();
                }

                // 清理临时截图
                if (fs.existsSync(imgPath)) {
                    fs.unlinkSync(imgPath);
                }

                return {
                    type: 'vision',
                    content: `【系统自动反馈：屏幕 OCR 提取结果】\n${ocrText || '未识别到明显的可用文本。'}`
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