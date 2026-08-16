# install.ps1 — 安装 codex-code-zh-cn（Windows）
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/taekchef/codex-code-zh-cn.git'
$InstallDir = if ($env:CODEX_ZH_HOME) { $env:CODEX_ZH_HOME } else { Join-Path $HOME '.codex-code-zh-cn' }
$BinDir = if ($env:CODEX_ZH_BIN_DIR) { $env:CODEX_ZH_BIN_DIR } else { Join-Path $HOME '.local\bin' }

function Info($msg) { Write-Host "[codex-zh] $msg" -ForegroundColor Cyan }

Info 'Codex 简体中文本地化 安装程序'

# 依赖检查
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '缺少 Node.js（https://nodejs.org）' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw '缺少 npm' }
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { throw '未找到 codex。请先安装：npm install -g @openai/codex@latest' }

# 获取仓库
if (Test-Path (Join-Path $InstallDir '.git')) {
    Info "更新仓库：$InstallDir"
    git -C $InstallDir pull --ff-only | Out-Null
} elseif (Get-Command git -ErrorAction SilentlyContinue) {
    Info "克隆仓库到：$InstallDir"
    git clone --depth 1 $RepoUrl $InstallDir | Out-Null
} else {
    Info '下载 release tarball'
    $tmp = Join-Path $env:TEMP ("codex-zh-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $tgz = Join-Path $tmp 'repo.tgz'
    Invoke-WebRequest -UseBasicParsing 'https://github.com/taekchef/codex-code-zh-cn/archive/refs/heads/main.tar.gz' -OutFile $tgz
    tar -xzf $tgz -C $tmp
    $src = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like 'codex-code-zh-cn*' } | Select-Object -First 1
    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
    Move-Item $src.FullName $InstallDir
    Remove-Item $tmp -Recurse -Force
}

# 安装依赖
Info '安装 node-pty 依赖'
Push-Location $InstallDir
try { npm install --omit=dev --no-audit --no-fund | Out-Null } finally { Pop-Location }

# 建立命令 shim
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$node = (Get-Command node).Source
foreach ($name in @('codex-zh', 'codex-zh-doctor')) {
    $cmd = Join-Path $BinDir "$name.cmd"
    $js = Join-Path $InstallDir "bin\$name.js"
    @"
@echo off
"$node" "$js" %*
"@ | Set-Content -Encoding ASCII $cmd
}
Info "命令已安装：$BinDir\codex-zh.cmd"

# 桌面语言覆盖
Info '写入桌面语言设置（localeOverride=zh-CN）'
node (Join-Path $InstallDir 'scripts\apply-config-overlay.js') apply

# 验证
Info '验证安装'
& (Join-Path $BinDir 'codex-zh.cmd') --version

Info '完成！用法：codex-zh / codex-zh-doctor / codex-zh exec "提示"'
if ($env:Path -notlike "*$BinDir*") {
    Info "注意：请把 $BinDir 加入用户 PATH"
}
