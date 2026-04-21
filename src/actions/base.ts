import type { ILLMProvider } from '../llm/interface.js';

export interface ActionResult {
    type: string;
    content?: string;
    payload?: any;
}

export abstract class BaseAction {
    /**
     * 该插件对应的 AIML 标签名（全小写，如 'file', 'act'）
     */
    abstract tag: string;

    abstract execute(attributes: Record<string, string>, content: string, provider?: ILLMProvider): Promise<ActionResult | null>;
}

/**
 * 动作插件注册中心
 */
export class ActionRegistry {
    private static actions: Map<string, BaseAction> = new Map();

    /**
     * 注册一个新的动作插件
     */
    static register(action: BaseAction) {
        this.actions.set(action.tag.toLowerCase(), action);
    }

    /**
     * 获取对应标签的动作插件实例
     */
    static get(tag: string): BaseAction | undefined {
        return this.actions.get(tag.toLowerCase());
    }

    /**
     * 获取所有已注册的插件列表
     */
    static getAll(): BaseAction[] {
        return Array.from(this.actions.values());
    }
}