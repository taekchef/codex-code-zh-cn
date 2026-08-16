# codex-code-zh-cn

OpenAI Codex CLI 简体中文本地化扩展（PTY 实时翻译包装器；只做 CLI，不碰桌面版）。

## 架构与数据流

- `bin/codex-zh.js` — 入口：node-pty 挂起原生 `codex`，输出经翻译引擎后写入终端
- `lib/ansi-tokenizer.js` — 把输出流切成可打印文本段与转义序列（后者逐字节透传）
- `lib/matcher.js` — 最长匹配优先的 EN→ZH 替换；`${name}` 模式；单 token 默认整词匹配
- `lib/translator.js` — 流式缓冲 + 上下文选择（语法区/长文段只用短语匹配）
- `lib/width.js` — wcwidth；译文补齐到原文显示宽度
- `lib/config-overlay.js` — 只写 `[desktop] localeOverride = "zh-CN"` 一个键
- `bin/codex-zh-doctor.js` — 健康检查

## 翻译数据单一来源

- `verbs/zh-CN.json` 是状态动词（Thinking/Working/Checking…）的**唯一数据源**
- `tips/zh-CN.json` 是提示的**唯一数据源**
- `data/ui-translations*.json` 是界面词条；`data/ui-patterns.json` 是动态模式
- **禁止**把 verbs/tips 内容复制到其它文件；改翻译只改对应文件
- `en` 必须是 Codex 真实输出原文（含空格、标点），否则匹配不上

## 技术铁律

- 转义序列（CSI/OSC/DCS/字符集）只能透传，不得在翻译中丢字节
- 默认 `pad`：译文显示宽度必须 ≤ 原文；补齐空格到等宽，保证 TUI 对齐
- 长句/散文用 `"pad": false`，避免行尾拖空格
- 单 token 词条自动整词匹配；不要把 UI 单词翻译写进 `--flag`、`/command`、反引号示例里（translator 已做语法区保护）
- Hook、MCP、TUI、transcript、Token、API、PR 等术语保留英文；Codex/OpenAI 产品名保留
- 不要把 `--model`、`--sandbox` 等命令行 token 翻译掉

## 维护流程

1. 改词条后必须：`npm test && npm run lint`
2. 新增词条优先来自真实 PTY 抓取（`scripts/extract-candidates.mjs` 只是候选池，需人工筛选）
3. Codex 升级后：验证 `codex --version` 仍是目标版本，重跑安装脚本验证；词条失效时更新 `support-window` 相关文档
4. 发布：升 `package.json` version → 更新 CHANGELOG → commit → tag `vX.Y.Z` → push → `gh release create`

## 版本发布流程

1. 升版本号（`package.json`，语义化版本）
2. 更新 `CHANGELOG.md`（新增/改进/修复）
3. `git commit`，提交信息带版本号
4. `git tag vX.Y.Z`
5. `git push origin main --tags`
6. `gh release create vX.Y.Z --title "vX.Y.Z" --notes "变更摘要"`
