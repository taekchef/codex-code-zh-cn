#!/usr/bin/env node
'use strict';

/**
 * shadow-codex.js — 让直接输入 `codex` 就启动中文版。
 *
 * 原理：把 npm 安装的 `codex` 命令入口替换成一个极小的 shim，shim 转发给
 * `bin/codex-zh.js` 并用 --codex-bin 指向备份的真实入口，因此：
 *   - 用户继续敲 `codex`，得到中文界面
 *   - 真实 Codex 文件原样保留在备份位置，卸载/恢复一步完成
 *   - 升级 Codex（npm i -g @openai/codex@latest）会重建命令入口，
 *     重新运行 install.sh 即可再次接管
 *
 * 用法：
 *   node scripts/shadow-codex.js apply    接管 codex 命令
 *   node scripts/shadow-codex.js remove   恢复原始 codex 命令
 *   node scripts/shadow-codex.js status   输出 installed / not-installed
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MARKER = 'codex-code-zh-cn shadow shim';
const STATE_NAME = 'shadow-state.json';

function installDir() {
  return process.env.CODEX_ZH_HOME || path.join(os.homedir(), '.codex-code-zh-cn');
}

function statePath() {
  return path.join(installDir(), STATE_NAME);
}

function which(command) {
  if (process.platform === 'win32') {
    const res = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true });
    if (res.status === 0) return res.stdout.split(/\r?\n/).filter(Boolean)[0] || null;
    return null;
  }
  const res = spawnSync('which', [command], { encoding: 'utf8' });
  if (res.status === 0) return res.stdout.split('\n').filter(Boolean)[0] || null;
  return null;
}

function isShim(file) {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 512);
    return head.includes(MARKER);
  } catch {
    return false;
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2) + '\n');
}

function resolveRealTarget(linkPath) {
  // Windows npm 入口是 .cmd；真实逻辑在 node_modules 里的 codex.js。
  if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(linkPath)) {
    const prefix = path.dirname(linkPath);
    const candidates = [
      path.join(prefix, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
      path.join(prefix, '..', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  let real = linkPath;
  try {
    real = fs.realpathSync(linkPath);
  } catch {}
  return real;
}

function shimContents(realTarget) {
  const node = process.execPath;
  if (process.platform === 'win32') {
    const js = JSON.stringify(path.join(ROOT, 'bin', 'codex-zh.js'));
    const bin = JSON.stringify(realTarget);
    return [
      `@echo off`,
      `rem ${MARKER}`,
      `set "CODEX_ZH_REAL_BIN=${realTarget}"`,
      `"${node}" ${js} --codex-bin ${bin} %*`,
      '',
    ].join('\r\n');
  }
  const js = JSON.stringify(path.join(ROOT, 'bin', 'codex-zh.js'));
  const bin = JSON.stringify(realTarget);
  return [
    '#!/usr/bin/env bash',
    `# ${MARKER}`,
    `export CODEX_ZH_REAL_BIN=${bin}`,
    `exec ${JSON.stringify(node)} ${js} --codex-bin ${bin} "$@"`,
    '',
  ].join('\n');
}

function apply() {
  const linkPath = which('codex');
  if (!linkPath) {
    console.error('[shadow] 未找到 codex 命令，先安装 Codex CLI');
    process.exit(1);
  }
  if (isShim(linkPath)) {
    console.log(`[shadow] codex 已被接管：${linkPath}`);
    return;
  }

  const st = fs.lstatSync(linkPath);
  const realTarget = resolveRealTarget(linkPath);
  if (!fs.existsSync(realTarget)) {
    console.error(`[shadow] 无法解析真实 Codex 入口：${realTarget}`);
    process.exit(1);
  }

  let state;
  if (st.isSymbolicLink()) {
    state = {
      kind: 'symlink',
      link: linkPath,
      linkTarget: fs.readlinkSync(linkPath),
      realTarget,
      backup: null,
      appliedAt: new Date().toISOString(),
    };
    fs.unlinkSync(linkPath);
  } else if (st.isFile()) {
    // Windows .cmd / 直接二进制：改名备份，再写入 shim。
    const backup = `${linkPath}.codex-zh-orig`;
    state = {
      kind: 'file',
      link: linkPath,
      linkTarget: null,
      realTarget,
      backup,
      appliedAt: new Date().toISOString(),
    };
    if (fs.existsSync(backup)) fs.rmSync(backup, { force: true });
    fs.renameSync(linkPath, backup);
  } else {
    console.error(`[shadow] 不支持的 codex 入口类型：${linkPath}`);
    process.exit(1);
  }

  fs.writeFileSync(linkPath, shimContents(realTarget));
  if (process.platform !== 'win32') fs.chmodSync(linkPath, 0o755);
  writeState(state);
  console.log(`[shadow] 已接管 codex → 中文版（真实入口：${realTarget}）`);
}

function remove() {
  const state = readState();
  if (!state) {
    console.log('[shadow] 未安装接管（无状态文件）');
    return;
  }
  const linkPath = state.link;
  if (fs.existsSync(linkPath) && isShim(linkPath)) {
    fs.unlinkSync(linkPath);
  }
  if (state.kind === 'symlink') {
    if (!fs.existsSync(linkPath) && state.linkTarget) {
      fs.symlinkSync(state.linkTarget, linkPath);
    }
  } else if (state.kind === 'file' && state.backup && fs.existsSync(state.backup)) {
    fs.renameSync(state.backup, linkPath);
  }
  fs.rmSync(statePath(), { force: true });
  console.log(`[shadow] 已恢复原始 codex 命令：${linkPath}`);
}

function status() {
  const linkPath = which('codex');
  if (linkPath && isShim(linkPath)) {
    console.log('installed');
    return;
  }
  console.log('not-installed');
}

const cmd = process.argv[2] || 'status';
if (cmd === 'apply') apply();
else if (cmd === 'remove') remove();
else if (cmd === 'status') status();
else {
  console.error('usage: shadow-codex.js apply|remove|status');
  process.exit(2);
}
