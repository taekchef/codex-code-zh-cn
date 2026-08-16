#!/usr/bin/env node
'use strict';

/**
 * codex-zh — run OpenAI Codex CLI with live Simplified-Chinese output.
 *
 * Spawns the native `codex` binary inside a pseudo-terminal and rewrites
 * known English UI phrases on the output stream.  Terminal escape sequences
 * pass through untouched; each replacement is padded to the original display
 * width so layouts, box borders and cursor positions stay aligned.
 *
 * Usage:  codex-zh [codex args...]
 *
 * codex-zh specific flags (consumed before Codex sees them):
 *   --codex-bin <path>          use an explicit Codex executable
 *   --codex-zh-no-translate     passthrough without translation
 *   --codex-zh-help             show this help
 *
 * Environment:
 *   CODEX_ZH_DISABLE=1          same as --codex-zh-no-translate
 *   CODEX_ZH_SKIP=1             internal guard against recursive wrapping
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { StreamTranslator } = require('../lib/translator');
const detect = require('../lib/detect');

const HELP = `codex-zh — Codex CLI 简体中文实时翻译包装器

Usage:
  codex-zh [--codex-bin <path>] [--codex-zh-no-translate] [codex args...]

Codex 参数原样转发（-m、exec、--help 等均可）。
   --codex-bin <path>          指定 Codex 可执行文件
   --codex-zh-no-translate     禁用翻译（等于 CODEX_ZH_DISABLE=1）
   --codex-zh-help             显示本帮助

Examples:
  codex-zh
  codex-zh exec "列出当前目录" --sandbox read-only
  codex-zh --help | less
`;

function fail(msg, code = 1) {
  process.stderr.write(`codex-zh: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { translate: process.env.CODEX_ZH_DISABLE !== '1', codexBin: null };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--codex-zh-help' || arg === '-zh-help') {
      opts.help = true;
    } else if (arg === '--codex-zh-no-translate' || arg === '--no-translate') {
      opts.translate = false;
    } else if (arg === '--codex-bin') {
      i += 1;
      opts.codexBin = argv[i];
      if (!opts.codexBin) fail('--codex-bin requires a path');
    } else if (arg.startsWith('--codex-bin=')) {
      opts.codexBin = arg.slice('--codex-bin='.length);
    } else {
      rest.push(arg);
    }
  }
  return { opts, rest };
}

function loadEntries() {
  const candidates = [
    path.join(__dirname, '..', 'data', 'ui-translations.json'),
    path.join(__dirname, '..', 'data', 'ui-translations-extra.json'),
    path.join(__dirname, '..', 'data', 'ui-translations-slash.json'),
    path.join(__dirname, '..', 'data', 'ui-translations-words.json'),
    path.join(__dirname, '..', 'data', 'ui-patterns.json'),
    path.join(__dirname, '..', 'verbs', 'zh-CN.json'),
  ];
  const entries = [];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const entry of Array.isArray(data) ? data : []) {
        if (entry && typeof entry.en === 'string' && typeof entry.zh === 'string') {
          entries.push(entry);
        }
      }
    } catch (err) {
      process.stderr.write(`codex-zh: 无法读取翻译数据 ${file}: ${err.message}\n`);
    }
  }
  return entries;
}

async function main() {
  const { opts, rest } = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  const codexBin = detect.resolveCodexBin(opts.codexBin);
  if (!codexBin) {
    fail(
      '未找到 Codex CLI。请先安装：npm install -g @openai/codex@latest，' +
        '或用 --codex-bin 指定可执行文件路径。'
    );
  }

  if (process.env.CODEX_ZH_SKIP === '1' || !opts.translate) {
    // Direct passthrough (no PTY rewriting).
    const child = spawnSync(codexBin, rest, { stdio: 'inherit', env: process.env });
    process.exit(child.status == null ? 1 : child.status);
  }

  let pty;
  try {
    pty = require('node-pty');
  } catch {
    fail(
      '缺少依赖 node-pty。请先运行安装脚本，或执行：npm install -g node-pty'
    );
  }

  const parent = {
    cols: process.stdout.isTTY ? process.stdout.columns : 120,
    rows: process.stdout.isTTY ? process.stdout.rows : 36,
  };
  const term = process.env.TERM && process.env.TERM !== 'dumb'
    ? process.env.TERM
    : 'xterm-256color';

  const childEnv = {
    ...process.env,
    TERM: term,
    CODEX_ZH_SKIP: '1',
    CODEX_ZH_WRAPPED: '1',
  };

  const entries = loadEntries();
  const translator = new StreamTranslator(entries, (chunk) => {
    process.stdout.write(chunk);
  });

  let p;
  try {
    p = pty.spawn(codexBin, rest, {
      name: term,
      cols: parent.cols,
      rows: parent.rows,
      cwd: process.cwd(),
      env: childEnv,
    });
  } catch (err) {
    fail(`无法启动 Codex（${codexBin}）：${err.message}`);
  }

  p.onData((data) => translator.feed(data));

  // stdin → child PTY.
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(true);
    } catch {}
  }
  process.stdin.on('data', (data) => {
    try {
      p.write(data);
    } catch {}
  });
  process.stdin.resume();

  // Terminal resize.
  process.stdout.on('resize', () => {
    try {
      if (process.stdout.columns && process.stdout.rows) {
        p.resize(process.stdout.columns, process.stdout.rows);
      }
    } catch {}
  });
  process.on('SIGWINCH', () => {
    try {
      if (process.stdout.columns && process.stdout.rows) {
        p.resize(process.stdout.columns, process.stdout.rows);
      }
    } catch {}
  });

  // Forward signals.
  const forwardSignal = (signal) => {
    try {
      p.kill(signal);
    } catch {}
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  process.on('SIGHUP', () => forwardSignal('SIGHUP'));

  const finish = (code, signal) => {
    translator.end();
    try {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    } catch {}
    if (signal) {
      const signum = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[signal] || 1;
      process.exit(128 + signum);
    } else {
      process.exit(code == null ? 0 : code);
    }
  };

  p.onExit(({ exitCode, signal }) => finish(exitCode, signal));
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
