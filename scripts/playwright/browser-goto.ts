import { getConnectedPage } from './core-context.js';

// 全局看门狗：防止因不可预知的页面弹窗或底层卡死导致流程永久挂起
setTimeout(() => {
    console.log("【执行异常】脚本执行超时 (45秒)，已被全局看门狗强制终止。");
    process.exit(1);
}, 45000).unref();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log("【执行异常】参数不足！请提供目标 URL。");
        process.exit(1);
    }

    let url = args[0].trim();
    // 自动补全协议头
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    try {
        const { page } = await getConnectedPage();
        
        // 确保浏览器窗口处于激活状态
        await page.bringToFront();
        
        console.log(`正在导航至: ${url} ...`);
        
        // 使用 domcontentloaded 提升响应速度，避免被第三方追踪脚本挂起
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`【系统自动反馈】已成功控制自动化浏览器导航至: ${url}`);
        process.exit(0);
    } catch (err: any) {
        console.log(`【系统自动反馈】网页导航超时或失败: ${err.message}`);
        process.exit(1);
    }
}

main();