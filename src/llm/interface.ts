export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * 统一的 LLM 驱动提供者接口
 * 用于解耦 Gemini Web、Doubao Web 及未来潜在的 API 模型
 */
export interface ILLMProvider {
    name: string;
    
    /**
     * 初始化资源（如启动浏览器、校验 API Key）
     */
    init(headless?: boolean): Promise<void>;
    
    /**
     * 发送提问并获取回复
     */
    ask(prompt: string, history?: ChatMessage[]): Promise<string>;

    /**
     * 重置物理会话，清空模型端所有记忆
     */
    resetSession(): Promise<void>;

    /**
     * 触发物理文件上传/挂载
     * @param absolutePath 文件绝对路径
     * @param useGrid 是否添加坐标网格（仅对图片有效）
     */
    uploadFile(absolutePath: string, useGrid?: boolean): Promise<void>;
    
    /**
     * 关闭与释放资源
     */
    close(): Promise<void>;
}