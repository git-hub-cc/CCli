import { BaseAction, ActionResult } from './base.js';
import { sysLogger, LogLevel } from '../core/logger.js';
import { mouse, Point, Button, straightTo } from '@nut-tree/nut-js';

/**
 * 处理 <mouse> 标签：执行物理级别的原生鼠标动作
 */
export class MouseAction extends BaseAction {
    tag = 'mouse';

    async execute(attributes: Record<string, string>, content: string): Promise<ActionResult> {
        const action = attributes['action'];
        if (!action) {
            throw new Error('<mouse> 标签缺少必填属性 action (支持: click, drag, hover, scroll)');
        }

        sysLogger.log(LogLevel.ACTION, `准备执行物理鼠标操作: ${action}`);

        try {
            mouse.config.autoDelayMs = 100;

            const getButton = (btnStr?: string) => {
                const b = (btnStr || 'left').toLowerCase();
                if (b === 'right') return Button.RIGHT;
                if (b === 'middle') return Button.MIDDLE;
                return Button.LEFT;
            };

            switch (action.toLowerCase()) {
                case 'click': {
                    const x = parseInt(attributes['x'] || '0', 10);
                    const y = parseInt(attributes['y'] || '0', 10);
                    const btn = getButton(attributes['btn']);
                    
                    if (!isNaN(x) && !isNaN(y)) {
                        await mouse.setPosition(new Point(x, y));
                    }
                    
                    await mouse.click(btn);
                    sysLogger.log(LogLevel.SUCCESS, `鼠标物理点击完成 (坐标: ${x},${y} 按键: ${attributes['btn'] || 'left'})`);
                    return { type: 'mouse', content: `【系统自动反馈】物理鼠标已在 (${x}, ${y}) 完成点击操作。` };
                }
                
                case 'drag': {
                    const x1 = parseInt(attributes['x1'] || '0', 10);
                    const y1 = parseInt(attributes['y1'] || '0', 10);
                    const x2 = parseInt(attributes['x2'] || '0', 10);
                    const y2 = parseInt(attributes['y2'] || '0', 10);
                    
                    await mouse.setPosition(new Point(x1, y1));
                    await mouse.drag(straightTo(new Point(x2, y2)));
                    sysLogger.log(LogLevel.SUCCESS, `鼠标物理拖拽完成 (${x1},${y1}) -> (${x2},${y2})`);
                    return { type: 'mouse', content: `【系统自动反馈】物理鼠标已完成拖拽操作。` };
                }
                
                case 'hover': {
                    const x = parseInt(attributes['x'] || '0', 10);
                    const y = parseInt(attributes['y'] || '0', 10);
                    
                    await mouse.setPosition(new Point(x, y));
                    sysLogger.log(LogLevel.SUCCESS, `鼠标物理悬停完成 (坐标: ${x},${y})`);
                    return { type: 'mouse', content: `【系统自动反馈】物理鼠标已悬停在 (${x}, ${y})。` };
                }
                
                case 'scroll': {
                    const dir = (attributes['dir'] || 'down').toLowerCase();
                    const amount = parseInt(attributes['amount'] || '500', 10);
                    
                    if (dir === 'up') {
                        await mouse.scrollUp(amount);
                    } else {
                        await mouse.scrollDown(amount);
                    }
                    
                    sysLogger.log(LogLevel.SUCCESS, `鼠标物理滚动完成 (方向: ${dir}, 距离: ${amount})`);
                    return { type: 'mouse', content: `【系统自动反馈】物理鼠标已完成滚动操作。` };
                }
                
                default:
                    throw new Error(`不支持的鼠标动作: ${action}`);
            }
        } catch (err: any) {
            throw new Error(`物理鼠标操作异常: ${err.message}`);
        }
    }
}