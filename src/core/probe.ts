import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');

/**
 * 强制刷新并抓取最新的系统环境探针信息，写入 .ccli/data/01环境.md
 */
export async function refreshSystemProbe(): Promise<string> {
    const platform = os.platform();
    const arch = os.arch();
    const cwd = process.cwd();

    let scoopList = '未安装 Scoop 或当前环境无软件列表';
    try {
        const { stdout } = await execa('scoop', ['list'], {
            reject: false,
            env: { ...process.env, NO_COLOR: '1' }
        });
        if (stdout && stdout.trim() !== '') {
            // 过滤 Scoop 输出，仅保留 Name 和 Version 两列
            scoopList = stdout.trim().split('\n').map(line => {
                const trimmed = line.trim();
                // 保留提示行
                if (trimmed.startsWith('Installed apps:')) return trimmed;

                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2) {
                    // 仅提取前两个元素：Name 和 Version
                    return `${parts[0].padEnd(12)} ${parts[1]}`;
                }
                return line;
            }).join('\n');
        }
    } catch (e) {
        // 忽略执行异常
    }

    let windowsList = '无法获取当前窗口列表';
    try {
        const winScriptPath = path.resolve(PKG_ROOT, 'scripts', 'python', 'list-running-apps.py');
        const { stdout: winOut } = await execa('python', [winScriptPath], { reject: false });
        if (winOut && winOut.trim() !== '') {
            windowsList = winOut.trim();
        }
    } catch (e) {
        // 忽略执行异常
    }

    let displayInfo = '无法获取显示器拓扑与缩放信息';
    try {
        const displayScriptPath = path.resolve(PKG_ROOT, 'scripts', 'python', 'get-display-info.py');
        const { stdout: displayOut } = await execa('python', [displayScriptPath], { reject: false });
        if (displayOut && displayOut.trim() !== '') {
            displayInfo = displayOut.trim();
        }
    } catch (e) {
        // 忽略执行异常
    }

    const probeContent = `### 系统环境\nOS: ${platform}-${arch}\n\n### 当前工作目录\n${cwd}\n\n### 显示器拓扑与缩放\n${displayInfo}\n\n### 当前运行的窗口\n${windowsList}\n\n### Scoop 软件清单\n${scoopList}\n`;

    const envPath = path.resolve(process.cwd(), '.ccli', 'data', '01环境.md');

    // 确保目录存在
    if (!fs.existsSync(path.dirname(envPath))) {
        fs.mkdirSync(path.dirname(envPath), { recursive: true });
    }

    fs.writeFileSync(envPath, probeContent, 'utf-8');

    return probeContent;
}