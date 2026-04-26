import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEncoding } from 'js-tiktoken';
import { localConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

export interface ChatMessage {
    role: string;
    content: string;
}

export class ContextManager {
    public static activeInstance: ContextManager | null = null;
    private chatHistory: ChatMessage[] = [];
    private cachedHintPrompt: string = '';
    public currentTotalTokens: number = 0;
    private encoder: any;
    private baseTokens: number = 0;
    private extraTokens: number = 0;
    public binaryUploadCount: number = 0;

    constructor() {
        ContextManager.activeInstance = this;
        this.loadHintPrompt();
        try {
            this.encoder = getEncoding(localConfig.tokenizerName as any || 'o200k_base');
        } catch (e) {
            this.encoder = getEncoding('cl100k_base');
        }
    }

    private calculateTokens(text: string): number {
        if (!text) return 0;
        try {
            return this.encoder.encode(text).length;
        } catch (e) {
            const chinese = (text.match(/[\u4e00-\u9fa5]/g) ||[]).length;
            const others = text.length - chinese;
            return chinese + Math.ceil(others / 4);
        }
    }

    public calculateRawTokens(text: string): number {
        return this.calculateTokens(text);
    }

    public setBaseTokens(tokens: number) {
        this.baseTokens = tokens;
        this.recountTokens();
    }

    public addExtraTokens(tokens: number) {
        this.extraTokens += tokens;
        this.recountTokens();
    }

    private recountTokens() {
        if (this.chatHistory.length === 0) {
            this.currentTotalTokens = 0;
        } else {
            this.currentTotalTokens = this.baseTokens + this.extraTokens;
            for (const msg of this.chatHistory) {
                this.currentTotalTokens += this.calculateTokens(msg.content);
            }
        }
    }

    private loadHintPrompt() {
        this.cachedHintPrompt = '【系统隐式提示】当前上下文 Token 占用已达预警阈值。为了防止截断或遗忘，请在本次回复的首行使用 <context action="trim|clear" keep_last="n" /> 标签清理历史。如果无需清理，请正常回答。';
        try {
            const hintPromptPath = path.resolve(PKG_ROOT, 'prompts', '04新会话模式.md');
            this.cachedHintPrompt = fs.readFileSync(hintPromptPath, 'utf-8').trim();
        } catch (e) {}
    }

    getHistory(): ChatMessage[] {
        return this.chatHistory;
    }

    get length(): number {
        return this.chatHistory.length;
    }

    addMessage(role: string, content: string) {
        this.chatHistory.push({ role, content });
        this.recountTokens();
    }

    popMessage(): ChatMessage | undefined {
        const msg = this.chatHistory.pop();
        if (msg) {
            this.recountTokens();
        }
        return msg;
    }

    getLastMessage(): ChatMessage | undefined {
        return this.chatHistory[this.chatHistory.length - 1];
    }

    getPromptWithHints(text: string): string {
        let promptWithHint = text;
        const tokenUsageRatio = this.currentTotalTokens / localConfig.modelMaxTokens;

        if (tokenUsageRatio >= localConfig.tokenThresholdPercent) {
            promptWithHint += `\n\n${this.cachedHintPrompt}`;
        }
        return promptWithHint;
    }

    executeAction(action: string, keepLast: number) {
        if (action === 'clear') {
            const lastUser = this.chatHistory.pop();
            this.chatHistory.length = 0;
            this.extraTokens = 0;
            this.binaryUploadCount = 0;
            if (lastUser) this.chatHistory.push(lastUser);
        } else if (action === 'trim') {
            const keepCount = (keepLast * 2) + 1;
            if (this.chatHistory.length > keepCount) {
                this.chatHistory.splice(0, this.chatHistory.length - keepCount);
            }
        }
        this.recountTokens();
    }

    formatHistoryString(): string {
        let historyStr = '';
        for (let i = 0; i < this.chatHistory.length - 1; i++) {
            historyStr += `[${this.chatHistory[i].role}]: ${this.chatHistory[i].content}\n\n`;
        }
        return historyStr;
    }
}