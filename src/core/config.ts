import path from 'path';
import fs from 'fs';

// 定义全局配置 Schema
export interface CcliConfig {
    initialized: boolean;
    lastWorkspace: string;
}

// 解析项目本地配置 config\01参数.md
export const localConfig = {
    maxHistoryRounds: 16,
    maxErrorLogLength: 300,
    defaultProvider: 'gemini',
    defaultApiKey: '',
    defaultModel: 'deepseek-r1-0528'
};

try {
    const localConfigPath = path.resolve(process.cwd(), 'config', '01参数.md');
    if (fs.existsSync(localConfigPath)) {
        const content = fs.readFileSync(localConfigPath, 'utf-8');
        content.split('\n').forEach(line => {
            const [key, ...values] = line.split('=');
            const value = values.join('=').trim();
            if (key?.trim() === 'MAX_HISTORY_ROUNDS' && value) {
                localConfig.maxHistoryRounds = parseInt(value, 10) || 16;
            }
            if (key?.trim() === 'MAX_ERROR_LOG_LENGTH' && value) {
                localConfig.maxErrorLogLength = parseInt(value, 10) || 300;
            }
            if (key?.trim() === 'DEFAULT_PROVIDER' && value) {
                localConfig.defaultProvider = value.toLowerCase();
            }
            if (key?.trim() === 'AGENTROUTER_API_KEY' && value) {
                localConfig.defaultApiKey = value;
            }
            if (key?.trim() === 'AGENTROUTER_MODEL' && value) {
                localConfig.defaultModel = value;
            }
        });
    }
} catch (e) {
    // 忽略配置文件读取异常，静默回退至默认值
}