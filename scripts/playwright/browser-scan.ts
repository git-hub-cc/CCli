import { getConnectedPage } from './core-context.js';

// 全局看门狗：防止脚本永久挂起
setTimeout(() => {
    console.log("【执行异常】脚本执行超时 (45秒)，已被全局看门狗强制终止。");
    process.exit(1);
}, 45000).unref();

async function main() {
    try {
        const { page } = await getConnectedPage();

        // 将页面带到前台，确保可见性计算准确
        await page.bringToFront();

        // 注入脚本扫描 DOM，提取可交互元素并打上标记
        const elements = await page.evaluate(() => {
            let idCounter = 1;
            // 覆盖绝大多数常规网页的交互元素标识
            const selectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"]';
            const interactables = document.querySelectorAll(selectors);
            const results: string[] = [];

            // 视口边界辅助，仅处理屏幕内或稍微偏出屏幕的元素，减少噪点
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;

            interactables.forEach((el) => {
                const element = el as HTMLElement;
                const rect = element.getBoundingClientRect();
                
                // 1. 过滤完全不可见或尺寸为 0 的幽灵节点
                if (rect.width === 0 || rect.height === 0) return;
                
                // 2. 过滤完全超出屏幕太远（不可见）的元素
                if (rect.bottom < 0 || rect.top > windowHeight + 500) return;

                const style = window.getComputedStyle(element);
                if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return;

                // 3. 过滤被禁用的元素
                if ((element as any).disabled) return;

                const id = idCounter++;
                // 注入自定义属性供后续动作精准寻址
                element.setAttribute('data-ccli-id', id.toString());

                // 防幻觉：在页面上绘制红色虚线框进行物理高亮
                element.style.outline = '2px dashed rgba(255, 0, 0, 0.7)';
                element.style.outlineOffset = '2px';

                // 提取语义化名称
                let name = element.innerText || element.getAttribute('aria-label') || element.getAttribute('placeholder') || (element as HTMLInputElement).value || element.getAttribute('title') || '';
                name = name.trim().replace(/\s+/g, ' ').substring(0, 40);

                const tagName = element.tagName.toLowerCase();
                const typeAttr = element.getAttribute('type') ? `:${element.getAttribute('type')}` : '';

                results.push(`[${id}] ${tagName}${typeAttr} - ${name ? `"${name}"` : '无文本(可能为图标)'}`);
            });

            return results;
        });

        if (elements.length === 0) {
            console.log("【系统自动反馈】页面可视区域内未检测到有效的交互元素。");
            process.exit(0);
        }

        console.log("【系统自动反馈：网页交互元素扫描结果】");
        console.log("已为页面元素分配数字 ID 并打上红色高亮虚线框。");
        console.log("------------------------------------------");
        console.log(elements.join('\n'));
        console.log("------------------------------------------");
        console.log("提示：请使用 <browser-action> 技能并传入上方对应的 ID 编号执行动作。");
        
        process.exit(0);

    } catch (err: any) {
        console.log(`【执行异常】网页元素扫描失败: ${err.message}`);
        process.exit(1);
    }
}

main();