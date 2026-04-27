import path from 'path';
import fs from 'fs';
import os from 'os';

// 定义全局配置 Schema
export interface CcliConfig {
    initialized: boolean;
    lastWorkspace: string;
}

export const localConfig = {
    maxErrorLogLength: 300,
    modelMaxTokens: 100000,
    tokenThresholdPercent: 0.80,
    tokenizerName: 'o200k_base',
    modelId: 'gpt-4o',
    defaultProvider: 'gemini',
    defaultApiKey: '',
    defaultModel: 'deepseek-r1-0528',
    siliconflowApiKey: '',
    siliconflowModel: 'deepseek-ai/DeepSeek-V2.5',
    lmstudioApiBase: 'http://127.0.0.1:1234/v1',
    lmstudioModel: 'local-model',
    maxBinaryUploads: { default: 3 } as Record<string, number>,
    ioWait: 500,
    windowWait: 3000
};

const parseConfig = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
        const cleanLine = line.split('#')[0].trim();
        if (!cleanLine) return;

        const [key, ...values] = cleanLine.split('=');
        if (!key) return;

        const value = values.join('=').trim();
        
        if (key.trim() === 'MAX_ERROR_LOG_LENGTH' && value) {
            localConfig.maxErrorLogLength = parseInt(value, 10) || 300;
        }
        if (key.trim() === 'MODEL_MAX_TOKENS' && value) {
            localConfig.modelMaxTokens = parseInt(value, 10) || 100000;
        }
        if (key.trim() === 'TOKEN_THRESHOLD_PERCENT' && value) {
            localConfig.tokenThresholdPercent = parseFloat(value) || 0.80;
        }
        if (key.trim() === 'TOKENIZER_NAME' && value) {
            localConfig.tokenizerName = value;
        }
        if (key.trim() === 'MODEL_ID' && value) {
            localConfig.modelId = value;
        }
        if (key.trim() === 'DEFAULT_PROVIDER' && value) {
            localConfig.defaultProvider = value.toLowerCase();
        }
        if (key.trim() === 'AGENTROUTER_API_KEY' && value) {
            localConfig.defaultApiKey = value;
        }
        if (key.trim() === 'AGENTROUTER_MODEL' && value) {
            localConfig.defaultModel = value;
        }
        if (key.trim() === 'SILICONFLOW_API_KEY' && value) {
            localConfig.siliconflowApiKey = value;
        }
        if (key.trim() === 'SILICONFLOW_MODEL' && value) {
            localConfig.siliconflowModel = value;
        }
        if (key.trim() === 'LMSTUDIO_API_BASE' && value) {
            localConfig.lmstudioApiBase = value;
        }
        if (key.trim() === 'LMSTUDIO_MODEL' && value) {
            localConfig.lmstudioModel = value;
        }
        if (key.trim() === 'MAX_BINARY_UPLOADS' && value) {
            const limits: Record<string, number> = {};
            value.split(',').forEach(pair => {
                const [model, num] = pair.split(':');
                if (model && num) {
                    limits[model.trim().toLowerCase()] = parseInt(num.trim(), 10) || 3;
                }
            });
            if (!limits['default']) limits['default'] = 3;
            localConfig.maxBinaryUploads = limits;
        }
        if (key.trim() === 'IO_WAIT' && value) {
            localConfig.ioWait = parseInt(value, 10) || 500;
        }
        if (key.trim() === 'WINDOW_WAIT' && value) {
            localConfig.windowWait = parseInt(value, 10) || 3000;
        }
    });
};

export function getMaskedConfig() {
    const maskStr = (str: string) => {
        if (!str || str.length <= 8) return '******';
        return str.substring(0, 3) + '******' + str.substring(str.length - 4);
    };

    return {
        ...localConfig,
        defaultApiKey: localConfig.defaultApiKey ? maskStr(localConfig.defaultApiKey) : '',
        siliconflowApiKey: localConfig.siliconflowApiKey ? maskStr(localConfig.siliconflowApiKey) : ''
    };
}

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