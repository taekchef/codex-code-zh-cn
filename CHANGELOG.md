## v1.0.3（2026-08-16）

### 改进

- /model to change 前导空格、Yes,/No, 逗号贴合等信任/启动界面细节
- 去重词条总数 978

## v1.0.2（2026-08-16）

### 新增

- 从 openai/codex rust-v0.147.0 源码候选池中人工筛选并补译 250 条界面词条（认证/登录、用量、审批、插件/MCP、调试等），去重词条总数达到 976
- scripts/verify-release-state.js：package.json / CHANGELOG / tag / GitHub Release 对齐校验

### 改进

- /model 切换与 max 推理强度翻译微调

### 修复

- Windows：优先解析原生 codex.exe 并注入 CODEX_MANAGED_PACKAGE_ROOT，避免 ConPTY 无法直接执行 .cmd shim
- Windows 安装脚本：对非 git 安装目录的更新路径先清理再克隆
- 输出管道 EPIPE 保护（codex-zh --help | head 不再报错）

## v1.0.1（2026-08-16）

### 修复

- install.sh：部分 npm/系统组合下 node-pty 的 spawn-helper 丢失可执行位，安装后显式补齐
- 单元测试改用 `node --test` 自动发现，修复 Windows CI 的 glob 不展开问题
- codexConfigPath 的 CODEX_HOME 断言改为跨平台路径构造
- codex-zh-doctor 现在报告去重后的词条总数

# Changelog

## v1.0.0（2026-08-16）

首个版本：面向 Codex CLI 0.147.0（当前 latest stable）的简体中文本地化扩展。

### 新增

- `codex-zh` PTY 实时翻译包装器：ANSI 安全、宽度守恒、最长匹配、动态模式、语法区保护
- 725 条去重词条：启动/信任、Hook 审核、MCP 状态、模型选择、会话恢复、斜杠命令面板、`--help`、`exec`、doctor 进度等
- 状态动词数据源 `verbs/zh-CN.json` 与中文提示数据源 `tips/zh-CN.json`
- 桌面语言覆盖：`[desktop] localeOverride = "zh-CN"`（只写一个键，自动备份）
- 安装/卸载脚本：`install.sh`、`install.ps1`、`uninstall.sh`、`uninstall.ps1`
- 健康检查命令：`codex-zh-doctor`
- 单元测试（29 项）与数据校验脚本 `validate-data.js`
- 上游候选词提取脚本 `extract-candidates.mjs`（配合 openai/codex 源码使用）

### 改进

- 参照 claude-code-zh-cn 的数据单一来源与术语规范（Hook、MCP、TUI、transcript、Token 保留英文）

### 修复

- 无（首个版本）
