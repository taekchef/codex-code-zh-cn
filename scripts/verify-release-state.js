#!/usr/bin/env node
'use strict';

/**
 * verify-release-state.js — 校验 package.json / CHANGELOG / git tag / GitHub
 * Release 是否对齐当前版本。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

function ok(msg) {
  console.log(`✔ ${msg}`);
}
function fail(msg) {
  console.error(`✘ ${msg}`);
  process.exitCode = 1;
}

// 1. package.json
ok(`package.json version = ${version}`);

// 2. CHANGELOG
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
if (changelog.includes(`## v${version}`)) ok(`CHANGELOG 包含 ## v${version}`);
else fail(`CHANGELOG 缺少 ## v${version}`);

// 3. git tag
let tags = '';
try {
  tags = execFileSync('git', ['tag', '--points-at', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
} catch {}
if (tags.split('\n').includes(`v${version}`)) ok(`当前 HEAD 带有 tag v${version}`);
else fail(`当前 HEAD 没有 tag v${version}`);

// 4. GitHub Release（可选，需要 gh 且联网）
try {
  execFileSync('gh', ['release', 'view', `v${version}`, '--json', 'tagName'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  ok(`GitHub Release v${version} 存在`);
} catch {
  fail(`GitHub Release v${version} 不存在或无法访问`);
}

if (process.exitCode) console.error('\n发布状态未对齐。');
else console.log('\n发布状态对齐。');
