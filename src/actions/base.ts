import type { ILLMProvider } from '../llm/interface.js';

/**
 * AIML 动作插件的抽象基类
 */
export abstract class BaseAction {
    /**
     * 该插件对应的 AIML 标签名（全小写，如 'file', 'act'）
     */
    abstract tag: string;

    /**
     * 核心执行逻辑
     * @param attributes 标签属性字典
     * @param content 标签内部包裹的内容
     * @param provider 底层大模型驱动实例引用
     * @returns 返回给大模型的系统层反馈（如果不需要反馈则返回 null/空字符串）
     */
    abstract execute(attributes: Record<string, string>, content: string, provider?: ILLMProvider): Promise<string | null>;
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