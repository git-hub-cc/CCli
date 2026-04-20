import type { ILLMProvider } from './interface.js';
import { GeminiWebProvider } from './gemini-web.js';
import { DoubaoWebProvider } from './doubao-web.js';
import { AgentRouterApiProvider } from './agentrouter-api.js';
import { MimoWebProvider } from './mimo-web.js';
import { SiliconFlowApiProvider } from './siliconflow-api.js';

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
        } else {
            return new GeminiWebProvider();
        }
    }
}