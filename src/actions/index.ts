import { ActionRegistry } from './base.js';
import { TextAction } from './text.action.js';
import { FileAction } from './file.action.js';
import { ShellAction } from './shell.action.js';
import { ClipboardAction } from './clipboard.action.js';
import { AskAction } from './ask.action.js';
import { ContinueAction } from './continue.action.js';
import { ContextAction } from './context.action.js';
import { WindowAction } from './window.action.js';
import { VisionAction } from './vision.action.js';
import { MouseAction } from './mouse.action.js';
import { KeyboardAction } from './keyboard.action.js';

import { BrowserAction } from './browser.action.js';
import { WaitAction } from './wait.action.js';
import { AssertAction } from './assert.action.js';
import { OsAction } from './os.action.js';

import { ListenAction } from './listen.action.js';
import { NetworkAction } from './network.action.js';
import { DeviceAction } from './device.action.js';

import { VaultAction } from './vault.action.js';
import { DbAction } from './db.action.js';
import { SandboxAction } from './sandbox.action.js';
import { StreamAction } from './stream.action.js';

import { HumanAction } from './human.action.js';
import { CaptchaAction } from './captcha.action.js';
import { MemoryAction } from './memory.action.js';
import { UiaAction } from './uia.action.js';

/**
 * 自动实例化并注册所有核心 AIML 动作插件
 */
export function registerAllActions() {
    ActionRegistry.register(new TextAction());
    ActionRegistry.register(new FileAction());
    ActionRegistry.register(new ShellAction());
    ActionRegistry.register(new ClipboardAction());
    ActionRegistry.register(new AskAction());
    ActionRegistry.register(new ContinueAction());
    ActionRegistry.register(new ContextAction());
    ActionRegistry.register(new WindowAction());
    ActionRegistry.register(new VisionAction());
    ActionRegistry.register(new MouseAction());
    ActionRegistry.register(new KeyboardAction());
    
    ActionRegistry.register(new BrowserAction());
    ActionRegistry.register(new WaitAction());
    ActionRegistry.register(new AssertAction());
    ActionRegistry.register(new OsAction());

    ActionRegistry.register(new ListenAction());
    ActionRegistry.register(new NetworkAction());
    ActionRegistry.register(new DeviceAction());

    ActionRegistry.register(new VaultAction());
    ActionRegistry.register(new DbAction());
    ActionRegistry.register(new SandboxAction());
    ActionRegistry.register(new StreamAction());
    
    ActionRegistry.register(new HumanAction());
    ActionRegistry.register(new CaptchaAction());
    ActionRegistry.register(new MemoryAction());

    ActionRegistry.register(new UiaAction());
}