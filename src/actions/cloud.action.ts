import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { localConfig } from '../core/config.js';

export class CloudAction extends BaseAction {
    tag = 'cloud';

    public static async uploadToCloud(filePath: string): Promise<string> {
        if (!localConfig.cloudinaryCloudName || !localConfig.cloudinaryApiKey || !localConfig.cloudinaryApiSecret) {
            throw new Error('Cloudinary 凭证未配置完整，请检查 config/01参数.md');
        }

        const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(targetPath)) {
            throw new Error(`文件不存在，无法上传: ${targetPath}`);
        }

        cloudinary.config({
            cloud_name: localConfig.cloudinaryCloudName,
            api_key: localConfig.cloudinaryApiKey,
            api_secret: localConfig.cloudinaryApiSecret
        });

        const result = await cloudinary.uploader.upload(targetPath, {
            resource_type: 'auto'
        });

        return result.secure_url;
    }

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = (attributes['action'] || '').toLowerCase();
        const filePath = attributes['path'];

        if (action !== 'upload') {
            throw new Error('<cloud> 标签缺少或包含不支持的 action 属性 (目前仅支持 upload)');
        }
        if (!filePath) {
            throw new Error('<cloud> 标签缺少必填属性 path');
        }

        sysLogger.log(LogLevel.ACTION, `准备上传文件至云端: ${filePath}`);

        try {
            const secureUrl = await CloudAction.uploadToCloud(filePath);

            sysLogger.log(LogLevel.SUCCESS, `文件上传成功，公开外链已生成。`);

            return {
                type: 'cloud',
                content: `【系统自动反馈：云端上传结果】\n文件已成功上传，公开外链 URL 为：\n${secureUrl}`
            };
        } catch (err: any) {
            sysLogger.log(LogLevel.ERROR, `上传至 Cloudinary 失败: ${err.message}`);
            throw new Error(`云端上传执行异常: ${err.message}`);
        }
    }
}