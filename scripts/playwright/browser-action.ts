import { getConnectedPage } from './core-context.js';

// 全局看门狗：防止因页面弹窗拦截或底层协议死锁导致 CLI 永久挂起
setTimeout(() => {
    console.log("【执行异常】脚本执行超时 (45秒)，已被全局看门狗强制终止。");
    process.exit(1);
}, 45000).unref();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("【执行异常】参数不足！请提供 元素ID 和 动作指令(Click/Fill/Select)。");
        process.exit(1);
    }

    const targetId = args[0];
    const action = args[1].toLowerCase();
    const value = args[2] || ''; 

    try {
        const { page } = await getConnectedPage();
        await page.bringToFront();

        // 通过前一步扫描注入的特征 ID 进行精准定位
        const locator = page.locator(`[data-ccli-id="${targetId}"]`).first();

        const count = await locator.count();
        if (count === 0) {
            console.log(`【执行异常】未找到短 ID 为 [${targetId}] 的元素！页面可能已刷新，请重新执行 browser-scan。`);
            process.exit(1);
        }

        // 防幻觉：动作执行前，页面节点短暂闪烁高亮背景色
        await locator.evaluate((node) => {
            const el = node as HTMLElement;
            el.style.backgroundColor = 'rgba(255, 255, 0, 0.6)';
            el.style.transition = 'background-color 0.3s';
        });

        await page.waitForTimeout(300);

        if (action === 'click' || action === 'c') {
            await locator.click({ force: true, timeout: 15000 });
            console.log(`【系统自动反馈】已成功点击元素 [${targetId}]。`);
        } 
        else if (action === 'fill' || action === 'f') {
            await locator.fill(value, { timeout: 15000 });
            console.log(`【系统自动反馈】已成功在输入框 [${targetId}] 填入文本："${value}"。`);
        } 
        else if (action === 'select' || action === 's') {
            await locator.selectOption({ label: value }, { timeout: 15000 });
            console.log(`【系统自动反馈】已成功在下拉列表 [${targetId}] 选择项："${value}"。`);
        } 
        else {
            console.log(`【执行异常】不支持的操作类型: ${action}`);
            process.exit(1);
        }

        // 清理高亮状态
        await locator.evaluate((node) => {
            const el = node as HTMLElement;
            el.style.outline = 'none';
            el.style.backgroundColor = 'transparent';
        }).catch(() => {}); 

        process.exit(0);

    } catch (err: any) {
        console.log(`【执行异常】网页动作执行失败: ${err.message}`);
        process.exit(1);
    }
}

main();