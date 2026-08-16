#!/usr/bin/env bash
# install.sh — 安装 codex-code-zh-cn（macOS / Linux）
#
# 用法：
#   ./install.sh                 安装或更新
#   CODEX_ZH_HOME=/path ./install.sh   指定安装目录（默认 ~/.codex-code-zh-cn）
#   ./install.sh --no-config     只装包装器，不写 ~/.codex/config.toml
#
# 安装内容：
#   1. 克隆/更新仓库到 $CODEX_ZH_HOME
#   2. npm install --omit=dev（node-pty）
#   3. 在 ~/.local/bin 建立 codex-zh / codex-zh-doctor 软链
#   4. 向 ~/.codex/config.toml 写入 [desktop] localeOverride = "zh-CN"
set -euo pipefail

REPO="https://github.com/taekchef/codex-code-zh-cn.git"
CODEX_ZH_HOME="${CODEX_ZH_HOME:-$HOME/.codex-code-zh-cn}"
BIN_DIR="${CODEX_ZH_BIN_DIR:-$HOME/.local/bin}"
WRITE_CONFIG=1
if [[ "${1:-}" == "--no-config" ]]; then WRITE_CONFIG=0; fi

info() { printf '\033[1;36m[codex-zh]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[codex-zh]\033[0m %s\n' "$*" >&2; }

info "Codex 简体中文本地化 安装程序"

# ---- 依赖检查 -------------------------------------------------------------
for cmd in node npm git curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "缺少命令：$cmd（Node.js 与 git/curl 至少需要其一）"
    exit 1
  fi
done
if ! command -v codex >/dev/null 2>&1; then
  err "未找到 codex 命令。请先安装 Codex CLI：npm install -g @openai/codex@latest"
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  err "Node.js 版本过低（当前 $(node -v)，需要 ≥ 18）"
  exit 1
fi

# ---- 获取/更新仓库 ----------------------------------------------------------
if [[ -d "$CODEX_ZH_HOME/.git" ]]; then
  info "更新仓库：$CODEX_ZH_HOME"
  git -C "$CODEX_ZH_HOME" pull --ff-only >/dev/null
else
  info "克隆仓库到：$CODEX_ZH_HOME"
  if git clone --depth 1 "$REPO" "$CODEX_ZH_HOME" >/dev/null 2>&1; then
    :
  else
    info "git 克隆失败，改用 release tarball"
    TMP="$(mktemp -d)"
    curl -fsSL "https://github.com/taekchef/codex-code-zh-cn/archive/refs/heads/main.tar.gz" -o "$TMP/repo.tgz"
    tar -xzf "$TMP/repo.tgz" -C "$TMP"
    rm -rf "$CODEX_ZH_HOME"
    mv "$TMP"/codex-code-zh-cn-main "$CODEX_ZH_HOME"
    rm -rf "$TMP"
  fi
fi

# ---- 安装依赖 ---------------------------------------------------------------
info "安装 node-pty 依赖"
( cd "$CODEX_ZH_HOME" && npm install --omit=dev --no-audit --no-fund >/dev/null )
# 部分 npm/系统组合下 prebuild 文件会丢失可执行位，显式补上
chmod +x "$CODEX_ZH_HOME"/node_modules/node-pty/prebuilds/*/spawn-helper 2>/dev/null || true

chmod +x "$CODEX_ZH_HOME/bin/codex-zh.js" "$CODEX_ZH_HOME/bin/codex-zh-doctor.js" 2>/dev/null || true

# ---- 建立命令软链 ------------------------------------------------------------
mkdir -p "$BIN_DIR"
for name in codex-zh codex-zh-doctor; do
  link="$BIN_DIR/$name"
  target="$CODEX_ZH_HOME/bin/$name.js"
  if [[ -L "$link" ]]; then
    rm -f "$link"
  elif [[ -e "$link" ]]; then
    info "已存在同名文件，备份为 $link.bak"
    mv "$link" "$link.bak"
  fi
  ln -s "$target" "$link"
done
info "命令已安装：$BIN_DIR/codex-zh"

# ---- 桌面语言覆盖 ------------------------------------------------------------
if [[ "$WRITE_CONFIG" == "1" ]]; then
  info "写入桌面语言设置（localeOverride=zh-CN）"
  node "$CODEX_ZH_HOME/scripts/apply-config-overlay.js" apply
fi

# ---- 验证 -------------------------------------------------------------------
info "验证安装"
"$BIN_DIR/codex-zh" --version

# ---- 使用提示 ----------------------------------------------------------------
info "完成！用法："
echo
echo "  codex-zh                       # 中文 TUI"
echo "  codex-zh exec \"你的提示\"       # 非交互中文输出"
echo "  codex-zh --codex-zh-no-translate ...   # 临时关闭翻译"
echo "  codex-zh-doctor                # 健康检查"
echo
if ! echo "$PATH" | tr ':' '\n' | grep -qxF "$BIN_DIR"; then
  info "注意：$BIN_DIR 不在 PATH 中，请加入 shell 配置，例如："
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi
if [[ -f "$CODEX_ZH_HOME/tips/zh-CN.json" ]]; then
  node -e '
    const tips = require(process.argv[1]).slice(0, 5);
    console.log("小贴士：");
    for (const t of tips) console.log("  · " + t.zh);
  ' "$CODEX_ZH_HOME/tips/zh-CN.json" || true
fi
