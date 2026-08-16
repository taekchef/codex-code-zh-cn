# codex-code-zh-cn

> OpenAI **Codex CLI** 简体中文本地化扩展 —— 让终端里的 Codex 说中文。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/taekchef/codex-code-zh-cn/actions/workflows/ci.yml/badge.svg)](https://github.com/taekchef/codex-code-zh-cn/actions/workflows/ci.yml)

这是 [claude-code-zh-cn](https://github.com/taekchef/claude-code-zh-cn) 的 Codex 姊妹项目：
同样地，把界面上的**词句、状态动词（spinner words）、提示（tips）**，能翻译的都翻译成简体中文。

- ✅ 实时汉化 Codex CLI 终端界面（TUI）：启动框、Hook 审核、模型选择、会话恢复、MCP 状态、帮助输出、doctor 进度等
- ✅ 安装后**直接输入 `codex` 就是中文**（接管 codex 命令，和 claude-code-zh-cn 的使用习惯一致）；`codex-zh` 作为显式包装器保留
- ✅ 会话内随时切换：在 Codex 输入框输入 **`/chinese`**（或 `/zh`）回车 → 中文；**`/english`**（或 `/en`）→ 英文；选择会全局记住
- ✅ 保留所有终端转义序列，每条译文**补齐到原文显示宽度**——边框、菜单、进度条不歪
- ✅ 桌面版 Codex：Settings → General → Language 里可直接选 **中文（中国）**；安装脚本也会自动写入 `[desktop] localeOverride = "zh-CN"`
- ✅ 不修改 Codex 二进制：真实入口原样备份，卸载/恢复一步完成
- ✅ 支持最新版 Codex CLI（当前验证：**0.147.0**，2026-08-07 发布）

---

## 快速开始

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/taekchef/codex-code-zh-cn/main/install.sh | bash
```

安装完成后：

```bash
codex                          # 直接输入 codex，就是中文 TUI
codex-zh                       # 显式中文包装器（不想接管 codex 时使用）
codex exec "列出当前目录"       # 非交互中文输出
codex --help | less            # 中文帮助
codex-zh-doctor                # 健康检查
```

在 Codex 输入框里输入 **`/chinese`** 回车 → 切中文；**`/english`** → 切英文（全局记住，下次启动仍生效）。

> 安装脚本默认**接管 `codex` 命令**：把 npm 的 codex 入口换成小 shim，转发给中文包装器；
> 真实 Codex 文件原样备份，卸载时恢复。若不想接管，安装时加 `--no-shadow`（Windows：`-NoShadow`）。
> Codex 升级（`npm i -g @openai/codex@latest`）会重建入口、变回英文，重跑 `install.sh` 即可再次接管。

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

或直接下载仓库后运行 `install.ps1`。安装后使用 `codex-zh` / `codex-zh-doctor`。

### 卸载

```bash
./uninstall.sh          # 移除软链 + 恢复语言设置
./uninstall.sh --purge  # 同时删除安装目录
```

```powershell
powershell -ExecutionPolicy Bypass -File uninstall.ps1 -Purge
```

卸载只影响本扩展；Codex 本体、登录状态和 `~/.codex` 会话数据不会被触碰。

---

## 效果对比

安装前（英文）：

```
╭───────────────────────────────────────╮
│ >_ OpenAI Codex (v0.147.0)            │
│ model:     gpt-5.6-sol max /model to change │
│ directory: ~                          │
╰───────────────────────────────────────╯
  Tip: Use /personality to customize how Codex communicates.
› Explain this codebase   tab to queue message   100% context left
```

安装后（中文）：

```
╭───────────────────────────────────────╮
│ >_ OpenAI Codex（v0.147.0）          │
│ 模型： gpt-5.6-sol 最强 /model 切换    │
│ 目录： ~                              │
╰───────────────────────────────────────╯
  提示：使用 /personality 自定义 Codex 的沟通方式。
› 解释这个代码库   Tab 排队消息   剩余上下文 100%
```

---

## 工作原理

Codex 0.147.0 是原生二进制（Rust），**没有官方 CLI 语言包**，也不能像 Claude Code
那样直接改 `cli.js`。本扩展采用「PTY 实时翻译包装器」方案：

```
你的终端
   │ 输入（原样转发）
   ▼
codex-zh（Node.js + node-pty）
   │ 启动原生 codex，挂在伪终端里
   ▼
Codex CLI 输出 ──► ANSI 分词器 ──► 文本段 ──► 最长匹配翻译引擎 ──► 补齐显示宽度 ──► 你的终端
                                      ▲
                              转义序列 / 控制字节原样透传
```

关键设计：

1. **ANSI 安全**：CSI/OSC/字符集等转义序列逐字节透传，只在可打印文本段上做替换。
2. **宽度守恒**：每条译文用 CJK 宽度算法（wcwidth）补齐到原文显示宽度，光标定位、表格列、边框不受影响。
3. **全译或全不译**：多词文本只用「完整短语」匹配——没有整句译文就保持整句英文，绝不把句子里
   某个单词单独翻掉（不会出现 `Codex can read and 编辑 files...` 这种混搭）。
   单词翻译只作用于独立渲染的单个 UI 词（按钮、状态动词等）。
4. **语法区保护**：`/command`、`--flag`、反引号示例里的 token 一律保留英文，
   因此 `Use /skills to list available skills...` 原样显示。
5. **最长匹配优先**：短词不会抢先吃掉长句；`Starting MCP servers (2/5): ...` 这类动态文本用 `${...}` 模式匹配。
6. **命令接管（shadow）**：把 npm 的 `codex` 入口换成 shim 转发给包装器，直接敲 `codex` 即中文；
   真实入口与卸载恢复信息保存在 `shadow-state.json`。
7. **版本无关**：包装器不修改二进制，Codex 升级后重跑安装脚本即可继续使用。

---

## 数据文件

| 文件 | 说明 |
|------|------|
| `data/ui-translations.json` | 核心界面词条（英文 → 中文） |
| `data/ui-translations-extra.json` | 启动/信任、MCP、模型选择、帮助、doctor 等界面词条 |
| `data/ui-translations-slash.json` | `/` 命令面板说明翻译 |
| `data/ui-translations-words.json` | 单个 UI 词汇（默认按整词匹配） |
| `data/ui-translations-source.json` | 从 openai/codex 0.147.0 源码筛选补译的界面词条 |
| `data/ui-patterns.json` | 含 `${变量}` 的动态文本模式 |
| `verbs/zh-CN.json` | 状态栏动词（唯一数据源：Thinking/Working/Checking…） |
| `tips/zh-CN.json` | 中文使用提示（唯一数据源） |
| `settings-overlay.toml` | 桌面语言覆盖（只含 `[desktop] localeOverride`） |

维护规则：

- **单一数据源**：动词翻译只改 `verbs/zh-CN.json`，提示只改 `tips/zh-CN.json`，
  不要把内容复制进别处。
- Hook、MCP、TUI、transcript、Token、API、PR 等技术术语保留英文（沿用 claude-code-zh-cn 惯例）。
- 改完词条运行 `node scripts/validate-data.js`（检查占位符、重复键、显示宽度溢出）。
- 更新 Codex 版本后，可用
  `node scripts/extract-candidates.mjs <codex-src>` 从官方源码提取候选字符串补充翻译。

---

## 配置

安装脚本只会写入一个键：

```toml
[desktop]
localeOverride = "zh-CN"
```

- 仅影响桌面版 Codex 语言，不触碰模型、认证、沙盒等任何其他配置。
- 原文件在首次修改前备份为 `~/.codex/config.toml.codex-code-zh-cn.bak`。
- 手动操作：`node scripts/apply-config-overlay.js apply|remove|status`。

包装器开关：

| 开关 | 作用 |
|------|------|
| `--codex-bin <path>` | 指定 Codex 可执行文件 |
| `--codex-zh-no-translate` | 本次运行关闭翻译 |
| `CODEX_ZH_DISABLE=1` | 环境变量方式关闭翻译 |
| `--codex-zh-help` | 包装器帮助 |

---

## 支持版本

| Codex CLI | 状态 |
|-----------|------|
| 0.147.0（当前 latest） | ✅ 验证通过 |
| 更早的 0.x（npm 安装的原生二进制） | ⚠️ 包装器通用，词条可能不全 |
| 未来版本 | 包装器通用；升级后重跑 `install.sh` 即可，欢迎 PR 补充词条 |

检测到的 Codex 安装形态：npm 包 `@openai/codex` → 平台包 `@openai/codex-<target>` → `vendor/<triple>/bin/codex`。

---

## 开发

```bash
git clone https://github.com/taekchef/codex-code-zh-cn.git
cd codex-code-zh-cn
npm install
npm test                    # 引擎 + 配置覆盖测试
npm run lint                # 词条校验
node bin/codex-zh.js        # 本地运行
```

新增翻译词条请保持 `en` 为 Codex 实际输出原文（含空格/标点），`zh` 为简体中文；
长句描述可加 `"pad": false`。提交前确保 `npm test && npm run lint` 通过。

---

## 姊妹项目

- [claude-code-zh-cn](https://github.com/taekchef/claude-code-zh-cn) —— Claude Code CLI 中文本地化插件（本项目的灵感来源）

---

## 免责声明

本项目是**非官方**中文补丁，只处理本机终端输出与桌面语言配置，与 OpenAI 无关；
不修改 Codex 二进制、不触碰认证凭据。使用风险自负。

## License

[MIT](LICENSE)
