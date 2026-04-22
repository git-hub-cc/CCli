# 🚀 CCLI (Chinese Command Line Interface)

**下一代 Agentic CLI 工具 —— 让大模型接管你的操作系统**

![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![License](https://img.shields.io/badge/license-Non--Commercial-orange)

`ccli` 是一个突破传统终端限制的**智能体命令行工具**。它不仅仅是一个能在终端里聊天的 AI，而是一个被赋予了“双手”和“眼睛”的数字助理。通过首创的 **AIML (AI Markup Language)** 标记语言，大模型可以直接在你的电脑上执行命令、修改文件、截图读取坐标，甚至操作微信和控制桌面软件。

---

## ✨ 核心特性

- 🤖 **多驱动模型引擎**：支持直接驱动 `Gemini Web`、`豆包 Web`（基于 Playwright 自动化零成本调用），以及纯 API 调用的 `AgentRouter` (DeepSeek 等模型)。
- ⚡ **AIML 标记语言**：AI 通过输出特定 XML 标签（如 `<act>`, `<file>`, `<upload>`）直接与底层操作系统交互。
- 👁️ **视觉辅助系统**：在上传图片时支持自动添加 **红色透明坐标网格与刻度** (`grid="true"`)，让视觉大模型具备精准的物理坐标感知能力。
- 🛠️ **可扩展宏技能库 (Macros)**：内置无缝桥接 Python 与 AutoHotkey (AHK) 的能力，轻松实现如“扫描系统窗口”、“截取特定软件屏幕”、“微信自动发送消息”等高级技能。
- 🧠 **全局长记忆与复盘系统 (/recap)**：突破上下文限制，自动生成并维护持久化记忆文件，支持指令触发的深度反思与自我迭代。

---

## 📦 安装与初始化

### 1. 环境依赖
- **Node.js** >= 18.x
- **Python** 3.x (用于部分内置宏技能)
- **AutoHotkey v2** (用于微信控制等桌面 GUI 自动化)

推荐使用 powershell7
```powershell
# 使用官方提供的快速安装脚本
iex "& { $(irm https://aka.ms/install-powershell.ps1) } -UseMSI"
```

要求使用 Scoop 安装基础依赖。请在 **PowerShell** (非管理员权限) 中运行：

```powershell
# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 下载并运行 Scoop 安装脚本
irm get.scoop.sh -outfile 'install.ps1'
.\install.ps1

# 安装基础工具 (包含 Node.js, Git 等)
scoop install 7zip git nodejs24 python311 autohotkey

# 添加国内镜像库 (推荐)
scoop bucket add scoop-proxy-cn https://github.com/lzwme/scoop-proxy-cn
```

### 2. 本地安装

```bash
# 设置 npm 淘宝镜像加速安装（可选）
npm config set registry https://registry.npmmirror.com

# 默认情况下 IDE 可能使用 CMD 执行脚本，这可能导致部分环境不一致（可选）
# 若下方命令因权限报错（EPERM），请手动执行 `notepad $HOME\.npmrc` 并在文件末尾添加一行：script-shell=powershell # 可选: pwsh
npm config set script-shell powershell

# 安装 Playwright 浏览器内核 (用于驱动 网页)
npx playwright install chrome

# 克隆仓库
git clone https://github.com/git-hub-cc/ccli.git
cd ccli

# 安装依赖
npm install

# 编译 TypeScript 并链接为全局命令
npm run build
npm link
```

---

## ⚙️ 基础配置

项目的核心配置文件位于 `config/01参数.md`：

```ini
# config/01参数.md
MAX_HISTORY_ROUNDS=32
MAX_ERROR_LOG_LENGTH=2000
DEFAULT_PROVIDER=gemini # 可选: gemini, doubao, agentrouter

# 当使用 agentrouter 作为 provider 时需要的配置
AGENTROUTER_API_KEY=sk-xxxxxx
AGENTROUTER_MODEL=deepseek-v3.1
```

---

## 🚀 快速开始

在终端中输入以下命令启动连续对话模式：

```bash
# 启动默认配置对话
ccli chat

# 静默后台模式 (不弹出浏览器)
ccli chat --headless
```

> **💡 Web 驱动首次运行须知**：
> 如果您使用 `gemini` 或 `doubao`，首次运行时会弹出一个真实的浏览器窗口供您登录账号。登录完成后按 `Ctrl+C` 退出，下次启动即可实现后台静默运行。

---

## 🤖 AIML (AI Markup Language) 规范

`ccli` 的 AI 会在回复中输出特定标签，本地系统会拦截并执行这些动作：

| 标签 | 功能描述 | 示例 |
|---|---|---|
| `<act>` | 执行终端命令 (支持 PowerShell) | `<act>npm run build</act>` |
| `<file>` | 读写或修改本地文件 (支持 all/diff) | `<file path="src/main.ts" type="all">内容</file>` |
| `<upload>`| 将本地文件/图片挂载至下次对话 | `<upload path="res.md" grid="true" />` |
| `<ask>` | 阻断流程，请求用户确认或输入 | `<ask type="confirm">是否删除？</ask>` |
| `<context>`| 动态清理对话上下文防 Token 溢出 | `<context action="trim" keep_last="2" />` |
| `<continue>`| 突破输出长度限制，流式续传内容 | `<continue reply="继续" />` |

---

## 🛠️ 内置宏技能库 (Macros)

存放在 `macros/` 目录下的 `.md` 文件会自动被注册为 AI 可用的技能：
- `<scan />`: 扫描当前目录下的有效文件树。
- `<get-app-paths />`: 获取当前系统所有已安装应用的绝对路径。
- `<list-running-apps />`: 查看当前运行中的应用窗口列表。
- `<screenshot>软件名称,保存路径</screenshot>`: 截取指定窗口或全屏。
- `<wechat-send>搜索词,消息文本,文件路径</wechat-send>`: 自动操作微信发送消息。

---

## 🧠 记忆复盘模式 (/recap)

AI 会全局审视项目和历史记录，并执行自我优化：
- `/recap data`：提取并更新长期记忆库 (`.ccli/data/`)。
- `/recap macros`：分析频繁操作，提炼可优化的宏技能脚本。
- `/recap prompts`：审视 AI 角色表现，优化系统提示词。

---

## 📂 目录结构

```text
ccli/
├── .ccli/               # 运行时生成的配置文件、浏览器 Profile 及长记忆数据
├── config/              # 全局运行参数
├── macros/              # 动态宏技能定义
├── prompts/             # 系统 System Prompt 模块
├── scripts/             # 底层执行脚本 (Python / AutoHotkey)
└── src/                 # TypeScript 核心源码
```

---

## ⚖️ 许可证与商业授权 (License & Commercial Terms)

本项目采用 **双重授权** 模式：

### 1. 个人与非商业用途 (Personal & Non-Commercial)
本项目源代码对个人开发者、学术研究以及非营利性组织免费开放，遵循 **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)** 许可证。
- **允许**：学习、自用、研究、在非盈利环境下修改。
- **禁止**：未经授权将本软件及其衍生品用于任何直接或间接的盈利活动。

### 2. 商业用途授权 (Commercial Use)
任何公司、盈利性机构或个人将本项目（包括但不限于：原始代码、编译后的二进制文件、修改后的衍生版本）用于商业目的（如：企业内部提高生产力的工具、商业产品的组件、收费咨询服务等），**必须获得作者的书面授权**。

**购买商业授权请联系：**
- 📧 **邮箱**: c_peizhi@qq.com
- 💬 **备注**: 商业授权咨询 - [您的公司名/项目名]

---
*未经授权的商业使用将被视为侵权，作者保留追究法律责任的权利。*
