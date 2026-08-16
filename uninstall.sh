#!/usr/bin/env bash
# uninstall.sh — 卸载 codex-code-zh-cn
#
# 用法：
#   ./uninstall.sh          移除命令软链 + 恢复 localeOverride
#   ./uninstall.sh --purge  同时删除安装目录（~/.codex-code-zh-cn）
set -euo pipefail

CODEX_ZH_HOME="${CODEX_ZH_HOME:-$HOME/.codex-code-zh-cn}"
BIN_DIR="${CODEX_ZH_BIN_DIR:-$HOME/.local/bin}"
PURGE=0
if [[ "${1:-}" == "--purge" ]]; then PURGE=1; fi

info() { printf '\033[1;36m[codex-zh]\033[0m %s\n' "$*"; }

info "卸载 codex-code-zh-cn"

for name in codex-zh codex-zh-doctor; do
  link="$BIN_DIR/$name"
  if [[ -L "$link" ]]; then
    rm -f "$link"
    info "已移除软链：$link"
  elif [[ -e "$link" ]]; then
    info "保留非软链文件：$link"
  fi
done

if [[ -f "$CODEX_ZH_HOME/scripts/apply-config-overlay.js" ]]; then
  node "$CODEX_ZH_HOME/scripts/apply-config-overlay.js" remove || true
fi

if [[ "$PURGE" == "1" ]]; then
  if [[ -d "$CODEX_ZH_HOME" ]]; then
    rm -rf "$CODEX_ZH_HOME"
    info "已删除安装目录：$CODEX_ZH_HOME"
  fi
else
  info "保留安装目录（可用 --purge 删除）：$CODEX_ZH_HOME"
fi

info "卸载完成。Codex 本体、认证与 ~/.codex 会话数据未被触碰。"
