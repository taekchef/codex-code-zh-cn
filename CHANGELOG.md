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
