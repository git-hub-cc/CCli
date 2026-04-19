import Jimp from 'jimp';
import path from 'path';
import { sysLogger, LogLevel } from './logger.js';

/**
 * 为图片添加红色透明的坐标网格与文本刻度
 * 供视觉大模型精确读取物理坐标
 */
export async function addGridToImage(imagePath: string, outputDir: string): Promise<string> {
    const ext = path.extname(imagePath).toLowerCase();
    const supportedExts = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    
    if (!supportedExts.includes(ext)) {
        return imagePath; // 非支持的图片格式，直接原路返回
    }

    try {
        const image = await Jimp.read(imagePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const step = 100; // 网格刻度步长 100px

        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
        const redColor = Jimp.rgbaToInt(255, 0, 0, 120); // 红色半透明网格线

        // 1. 绘制垂直网格线
        for (let x = 0; x < width; x += step) {
            for (let y = 0; y < height; y++) {
                image.setPixelColor(redColor, x, y);
            }
        }
        
        // 2. 绘制水平网格线
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x++) {
                image.setPixelColor(redColor, x, y);
            }
        }

        // 3. 在所有网格交叉点右下角打印坐标文本 (x,y)
        for (let x = 0; x < width; x += step) {
            for (let y = 0; y < height; y += step) {
                // 打印坐标文本，稍微偏移2像素避免被线挡住
                image.print(font, x + 2, y + 2, `${x},${y}`);
            }
        }

        const fileName = `grid_${path.basename(imagePath)}`;
        const outputPath = path.join(outputDir, fileName);
        
        await image.writeAsync(outputPath);
        sysLogger.log(LogLevel.ACTION, `已为图片附加坐标网格: ${fileName}`);
        return outputPath;

    } catch (err: any) {
        sysLogger.log(LogLevel.WARN, `绘制网格失败，将使用原图上传: ${err.message}`);
        return imagePath; // 如果处理失败，退阶使用原图，不阻断流程
    }
}