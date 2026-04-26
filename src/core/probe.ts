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

    let consoleType = 'cmd';
    let windowsList = '无法获取当前窗口列表';
    let displayInfo = '无法获取显示器拓扑与缩放信息';

    if (platform === 'win32') {
        try {
            // 1. 终端溯源探测
            const traceScript = `
                $current = Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
                $id = $current.ParentProcessId
                $fallback = 'cmd'
                while($id -gt 0) {
                    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $id"
                    if (-not $p) { break }
                    $name = $p.Name.ToLower()
                    if ($name -match 'pwsh\\.exe') { Write-Output 'powershell7'; exit }
                    if ($name -match 'powershell\\.exe') { Write-Output 'powershell5'; exit }
                    if ($name -match 'bash\\.exe|mintty\\.exe') { Write-Output 'bash'; exit }
                    if ($name -match 'cmd\\.exe') { $fallback = 'cmd' }
                    $id = $p.ParentProcessId
                }
                Write-Output $fallback
            `;
            const { stdout: consoleOut } = await execa('powershell', ['-NoProfile', '-Command', traceScript]);
            consoleType = consoleOut.trim() || 'cmd';

            // 2. 原生窗口列表探测
            const winListScript = `
                [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
                Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | 
                Select-Object -Property MainWindowTitle | ForEach-Object { $_.MainWindowTitle.Trim() }
            `;
            const { stdout: winOut } = await execa('powershell', ['-NoProfile', '-Command', winListScript]);
            windowsList = winOut.trim() || '暂无活跃窗口';

            // 3. 原生显示器信息探测
            const displayScript = `
                [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
                Add-Type -AssemblyName System.Windows.Forms
                [System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
                    $s = $_
                    "$($s.DeviceName.Replace('\\\\.\\', '')) - 分辨率: $($s.Bounds.Width)x$($s.Bounds.Height) (主屏: $($s.Primary))"
                }
            `;
            const { stdout: dispOut } = await execa('powershell', ['-NoProfile', '-Command', displayScript]);
            displayInfo = dispOut.trim() || '无法获取显示器数据';

        } catch (e) {
            // 保持默认值
        }
    } else {
        consoleType = process.env.SHELL || 'bash';
    }

    // 4. Scoop 软件清单抓取
    let scoopList = '未安装 Scoop 或当前环境无软件列表';
    try {
        const { stdout } = await execa('scoop', ['list'], {
            reject: false,
            env: { ...process.env, NO_COLOR: '1' }
        });
        if (stdout && stdout.trim() !== '') {
            scoopList = stdout.trim().split('\n').map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('Installed apps:')) return trimmed;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2) {
                    return `${parts[0].padEnd(12)} ${parts[1]}`;
                }
                return line;
            }).join('\n');
        }
    } catch (e) {
        // 忽略执行异常
    }

    // 5. 组装带有 Frontmatter 的最终内容
    const probeContent = `---
name: 01环境.md
description: 系统与目录环境信息。
tags: 系统, 环境
---

### 系统环境
OS: ${platform}-${arch}
Shell: ${consoleType}

### 当前工作目录
${cwd}

### 显示器拓扑与缩放
${displayInfo}

### 当前运行的窗口
${windowsList}

### Scoop 软件清单
${scoopList}
`;

    const envPath = path.resolve(process.cwd(), '.ccli', 'data', '01环境.md');

    if (!fs.existsSync(path.dirname(envPath))) {
        fs.mkdirSync(path.dirname(envPath), { recursive: true });
    }

    fs.writeFileSync(envPath, probeContent, 'utf-8');

    return probeContent;
}