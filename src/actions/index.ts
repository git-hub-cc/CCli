import { ActionRegistry } from './base.js';
import { TextAction } from './text.action.js';
import { FileAction } from './file.action.js';
import { ActAction } from './act.action.js';
import { AskAction } from './ask.action.js';
import { ContinueAction } from './continue.action.js';
import { ContextAction } from './context.action.js';
import { UploadAction } from './upload.action.js';

/**
 * 自动实例化并注册所有核心 AIML 动作插件
 */
export function registerAllActions() {
    ActionRegistry.register(new TextAction());
    ActionRegistry.register(new FileAction());
    ActionRegistry.register(new ActAction());
    ActionRegistry.register(new AskAction());
    ActionRegistry.register(new ContinueAction());
    ActionRegistry.register(new ContextAction());
    ActionRegistry.register(new UploadAction());
}