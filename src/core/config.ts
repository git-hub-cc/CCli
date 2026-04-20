import path from 'path';
import fs from 'fs';
import os from 'os';

// 定义全局配置 Schema
export interface CcliConfig {
    initialized: boolean;
    lastWorkspace: string;
}

export const localConfig = {
    maxHistoryRounds: 16,
    maxErrorLogLength: 300,
    defaultProvider: 'gemini',
    defaultApiKey: '',
    defaultModel: 'deepseek-r1-0528',
    siliconflowApiKey: '',
    siliconflowModel: 'deepseek-ai/DeepSeek-V2.5'
};

const parseConfig = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
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
        if (key?.trim() === 'SILICONFLOW_API_KEY' && value) {
            localConfig.siliconflowApiKey = value;
        }
        if (key?.trim() === 'SILICONFLOW_MODEL' && value) {
            localConfig.siliconflowModel = value;
        }
    });
};

try {
    // 读取用户全局目录配置作为兜底
    const globalConfigPath = path.resolve(os.homedir(), '.ccli', 'config', '01参数.md');
    parseConfig(globalConfigPath);

    // 读取当前项目配置，优先覆盖
    const localConfigPath = path.resolve(process.cwd(), 'config', '01参数.md');
    parseConfig(localConfigPath);
} catch (e) {
    // 忽略配置文件读取异常，静默回退至默认值
}