import type { ILLMProvider } from './interface.js';
import { GeminiWebProvider } from './gemini-web.js';
import { DoubaoWebProvider } from './doubao-web.js';
import { AgentRouterApiProvider } from './agentrouter-api.js';
import { MimoWebProvider } from './mimo-web.js';
import { SiliconFlowApiProvider } from './siliconflow-api.js';
import { MockTestProvider } from './mock-test.js';
import { KimiWebProvider } from './kimi-web.js';

export class LLMProviderFactory {
    static create(providerName: string): ILLMProvider {
        const name = providerName.toLowerCase();
        if (name === 'doubao') {
            return new DoubaoWebProvider();
        } else if (name === 'agentrouter') {
            return new AgentRouterApiProvider();
        } else if (name === 'mimo') {
            return new MimoWebProvider();
        } else if (name === 'siliconflow') {
            return new SiliconFlowApiProvider();
        } else if (name === 'kimi') {
            return new KimiWebProvider();
        } else if (name === 'mock') {
            return new MockTestProvider();
        } else {
            return new GeminiWebProvider();
        }
    }
}