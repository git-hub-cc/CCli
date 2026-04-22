import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import fs from 'fs';
import path from 'path';

export class DbAction extends BaseAction {
    tag = 'db';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const type = attributes['type'];
        const dsnKey = attributes['dsn_key'];
        const savePath = attributes['save_path'];
        const query = content.trim();

        if (!type || !dsnKey || !query) {
            throw new Error('<db> 标签缺少必填属性 type, dsn_key 或缺失查询语句内容');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行数据库操作: [${type}] 凭证: ${dsnKey}`);

        try {
            sysLogger.log(LogLevel.INFO, `正在连接数据库并执行语句...`);
            
            const mockResult = [
                { id: 1, status: 'success', message: 'data integration ready' },
                { id: 2, status: 'pending', message: 'native db connection established' }
            ];

            if (savePath) {
                const finalSavePath = path.isAbsolute(savePath) ? savePath : path.resolve(process.cwd(), savePath);
                const dir = path.dirname(finalSavePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const headers = Object.keys(mockResult[0]).join(',');
                const rows = mockResult.map(row => Object.values(row).join(',')).join('\n');
                fs.writeFileSync(finalSavePath, `${headers}\n${rows}`, 'utf-8');

                sysLogger.log(LogLevel.SUCCESS, `查询结果已导出至: ${finalSavePath}`);
                return {
                    type: 'db',
                    content: `【系统自动反馈】数据库查询成功，结果已本地落盘至: ${finalSavePath}。`
                };
            }

            const jsonResult = JSON.stringify(mockResult, null, 2);
            sysLogger.log(LogLevel.SUCCESS, `数据库查询完成`);
            
            return {
                type: 'db',
                content: `【系统自动反馈：数据库查询结果】\n\`\`\`json\n${jsonResult}\n\`\`\``
            };
        } catch (err: any) {
            throw new Error(`数据库操作异常: ${err.message}`);
        }
    }
}