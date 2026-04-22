import { PromptBuilder } from '../prompt/builder.js';
import { ContextManager } from '../core/context-manager.js';

export class SessionContext {
    public isFirstTurn: boolean = true;
    public systemPrompt: string = '';
    private builder: PromptBuilder;

    constructor(private contextManager: ContextManager) {
        this.builder = new PromptBuilder();
    }

    /**
     * 初始化会话系统提示词状态
     */
    initialize() {
        this.systemPrompt = this.builder.build();
        const sysTokens = this.contextManager.calculateRawTokens(this.systemPrompt);
        this.contextManager.setBaseTokens(sysTokens);
        this.isFirstTurn = true;
    }

    /**
     * 在上下文被物理切断清空后，重塑会话初始状态
     */
    reset() {
        this.initialize();
    }
}