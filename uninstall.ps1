# uninstall.ps1 — 卸载 codex-code-zh-cn（Windows）
# 用法：powershell -ExecutionPolicy Bypass -File uninstall.ps1 [-Purge]
param([switch]$Purge)

$ErrorActionPreference = 'Stop'
$InstallDir = if ($env:CODEX_ZH_HOME) { $env:CODEX_ZH_HOME } else { Join-Path $HOME '.codex-code-zh-cn' }
$BinDir = if ($env:CODEX_ZH_BIN_DIR) { $env:CODEX_ZH_BIN_DIR } else { Join-Path $HOME '.local\bin' }

foreach ($name in @('codex-zh', 'codex-zh-doctor')) {
    $cmd = Join-Path $BinDir "$name.cmd"
    if (Test-Path $cmd) {
        Remove-Item $cmd -Force
        Write-Host "[codex-zh] 已移除：$cmd"
    }
}

$overlay = Join-Path $InstallDir 'scripts\apply-config-overlay.js'
if (Test-Path $overlay) {
    node $overlay remove
}

if ($Purge -and (Test-Path $InstallDir)) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Host "[codex-zh] 已删除安装目录：$InstallDir"
} else {
    Write-Host "[codex-zh] 保留安装目录（-Purge 可删除）：$InstallDir"
}
Write-Host '[codex-zh] 卸载完成。Codex 本体、认证与 ~/.codex 会话数据未被触碰。'
