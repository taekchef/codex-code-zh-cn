#!/usr/bin/env node
'use strict';

/**
 * codex-zh-doctor — verify a codex-code-zh-cn installation.
 */

const fs = require('fs');
const path = require('path');
const detect = require('../lib/detect');
const { status: overlayStatus, codexConfigPath } = require('../lib/config-overlay');

const ROOT = path.join(__dirname, '..');

function ok(msg) {
  console.log(`  ✔ ${msg}`);
  return true;
}
function warn(msg) {
  console.log(`  ✘ ${msg}`);
  return false;
}

function check(name, fn) {
  process.stdout.write(`· ${name}\n`);
  try {
    return fn() ? ok('通过') : warn('未通过');
  } catch (err) {
    return warn(`异常：${err.message}`);
  }
}

let healthy = true;

healthy = check('Node.js ≥ 18', () => {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) throw new Error(`当前 Node ${process.version}`);
  return true;
}) && healthy;

healthy = check('定位 Codex CLI', () => {
  const bin = detect.resolveCodexBin();
  if (!bin) throw new Error('未在 PATH 中找到 codex；请先 npm install -g @openai/codex@latest');
  return true;
}) && healthy;

healthy = check('Codex 版本', () => {
  const version = detect.getCodexVersion();
  if (!version) throw new Error('无法获取 codex --version');
  console.log(`    版本：${version}`);
  return true;
}) && healthy;

healthy = check('node-pty 依赖', () => {
  try {
    require.resolve('node-pty');
    return true;
  } catch {
    throw new Error('缺少 node-pty；请在安装目录运行 npm install --omit=dev');
  }
}) && healthy;

healthy = check('翻译数据', () => {
  const files = ['ui-translations.json', 'ui-translations-extra.json', 'ui-translations-slash.json', 'ui-translations-words.json', 'ui-patterns.json'];
  const all = [];
  for (const f of files) {
    const p = path.join(ROOT, 'data', f);
    if (!fs.existsSync(p)) throw new Error(`缺少 data/${f}`);
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(arr)) throw new Error(`data/${f} 不是数组`);
    all.push(...arr);
  }
  const verbsPath = path.join(ROOT, 'verbs', 'zh-CN.json');
  if (fs.existsSync(verbsPath)) {
    const verbs = JSON.parse(fs.readFileSync(verbsPath, 'utf8'));
    if (Array.isArray(verbs)) all.push(...verbs);
  }
  const unique = new Set(all.filter((e) => e && typeof e.en === 'string').map((e) => e.en)).size;
  console.log(`    去重词条：${unique}`);
  return true;
}) && healthy;

healthy = check('命令入口', () => {
  const bin = path.join(ROOT, 'bin', 'codex-zh.js');
  if (!fs.existsSync(bin)) throw new Error('缺少 bin/codex-zh.js');
  fs.accessSync(bin, fs.constants.R_OK);
  return true;
}) && healthy;

healthy = check('桌面语言覆盖 (~/.codex/config.toml)', () => {
  const st = overlayStatus(codexConfigPath());
  console.log(`    状态：${st}`);
  return st === 'applied' || st === 'missing';
}) && healthy;

healthy = check('PATH 中的 codex-zh', () => {
  const found = detect.which('codex-zh');
  if (!found) throw new Error('codex-zh 不在 PATH 中；请重新运行 install.sh / install.ps1');
  console.log(`    路径：${found}`);
  return true;
}) && healthy;

console.log(healthy ? '\n结论：codex-code-zh-cn 状态健康。' : '\n结论：存在问题，请按上面 ✘ 项修复。');
process.exit(healthy ? 0 : 1);
