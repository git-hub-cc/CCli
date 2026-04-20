import { getConnectedPage } from './core-context.js';

// 全局看门狗：确保脚本在任何情况下都能及时返回反馈给大模型
setTimeout(() => {
    console.log("【系统自动反馈】等待脚本触发 45秒 全局超时保护，已强制释放流程。");
    process.exit(0); 
}, 45000).unref();

async function main() {
    const args = process.argv.slice(2);
    
    // Playwright 支持的状态: 'load' | 'domcontentloaded' | 'networkidle'
    const condition = (args[0] || 'networkidle').toLowerCase() as "load" | "domcontentloaded" | "networkidle";
    const timeout = parseInt(args[1] || '15000', 10);

    try {
        const { page } = await getConnectedPage();
        await page.bringToFront();

        // 挂起流程，等待底层网络和 DOM 渲染抵达目标状态
        await page.waitForLoadState(condition, { timeout });
        
        console.log(`【系统自动反馈】网页状态 [${condition}] 已就绪。`);
        process.exit(0);

    } catch (err: any) {
        console.log(`【系统自动反馈】等待网页状态 [${condition}] 超时 (${timeout}ms)，引擎已自动放行。`);
        process.exit(0); 
    }
}

main();