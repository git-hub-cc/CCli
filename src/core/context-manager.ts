import fs from 'fs';
import path from 'path';
import { localConfig } from './config.js';

export interface ChatMessage {
    role: string;
    content: string;
}

export class ContextManager {
    private chatHistory: ChatMessage[] = [];
    private cachedHintPrompt: string = '';

    constructor() {
        this.loadHintPrompt();
    }

    private loadHintPrompt() {
        this.cachedHintPrompt = '【系统隐式提示】当前会话历史较长。如果你认为存在干扰或即将达到长度上限，请在本次回复的首行使用 <context action="trim|clear" keep_last="n" /> 标签清理历史。如果无需清理，请正常回答。';
        try {
            const hintPromptPath = path.resolve(process.cwd(), 'prompts', '05新会话模式.md');
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
    }

    popMessage(): ChatMessage | undefined {
        return this.chatHistory.pop();
    }

    getLastMessage(): ChatMessage | undefined {
        return this.chatHistory[this.chatHistory.length - 1];
    }

    getPromptWithHints(text: string): string {
        let promptWithHint = text;
        if (this.chatHistory.length >= localConfig.maxHistoryRounds) {
            promptWithHint += `\n\n${this.cachedHintPrompt}`;
        }
        return promptWithHint;
    }

    executeAction(action: string, keepLast: number) {
        if (action === 'clear') {
            const lastUser = this.chatHistory.pop();
            this.chatHistory.length = 0;
            if (lastUser) this.chatHistory.push(lastUser);
        } else if (action === 'trim') {
            const keepCount = (keepLast * 2) + 1;
            if (this.chatHistory.length > keepCount) {
                this.chatHistory.splice(0, this.chatHistory.length - keepCount);
            }
        }
    }

    formatHistoryString(): string {
        let historyStr = '';
        for (let i = 0; i < this.chatHistory.length - 1; i++) {
            historyStr += `[${this.chatHistory[i].role}]: ${this.chatHistory[i].content}\n\n`;
        }
        return historyStr;
    }
}