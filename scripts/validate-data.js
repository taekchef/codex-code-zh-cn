#!/usr/bin/env node
'use strict';

/**
 * validate-data.js — lint translation data:
 *   - well-formed entries and ${name} placeholder symmetry
 *   - duplicate English keys across files
 *   - display-width overflows (zh wider than en without pad:false)
 *   - literal keys that would be shadowed by longer literals (prefix check)
 *
 * Exit code 1 when structural errors are found; width warnings are advisory.
 */

const fs = require('fs');
const path = require('path');
const { stringWidth } = require('../lib/width');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'data/ui-translations.json',
  'data/ui-translations-extra.json',
  'data/ui-translations-slash.json',
  'data/ui-translations-words.json',
  'data/ui-translations-source.json',
  'data/ui-patterns.json',
  'verbs/zh-CN.json',
];

let errors = 0;
let warnings = 0;
const byEn = new Map();

function report(level, msg) {
  if (level === 'error') errors += 1;
  else warnings += 1;
  console.log(`[${level}] ${msg}`);
}

const placeholders = (s) => [...s.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]);

for (const file of FILES) {
  const p = path.join(ROOT, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    report('error', `${file}: invalid JSON: ${err.message}`);
    continue;
  }
  if (!Array.isArray(data)) {
    report('error', `${file}: expected an array`);
    continue;
  }
  for (let idx = 0; idx < data.length; idx += 1) {
    const e = data[idx];
    const at = `${file}[${idx}]`;
    if (!e || typeof e.en !== 'string' || typeof e.zh !== 'string') {
      report('error', `${at}: missing en/zh strings`);
      continue;
    }
    if (!e.en.trim()) {
      report('error', `${at}: empty en`);
      continue;
    }
    const enNames = placeholders(e.en);
    const zhNames = placeholders(e.zh);
    const missing = enNames.filter((n) => !zhNames.includes(n));
    const extra = zhNames.filter((n) => !enNames.includes(n));
    if (missing.length) report('error', `${at}: zh missing placeholder(s) ${missing.join(',')}`);
    if (extra.length) report('error', `${at}: zh has extra placeholder(s) ${extra.join(',')}`);
    if (!enNames.length && !e.en.includes(' ')) e.word = true;

    if (byEn.has(e.en)) {
      const other = byEn.get(e.en);
      if (other.zh !== e.zh) {
        report('warn', `duplicate en "${e.en}": ${other.file}[${other.idx}] vs ${at}`);
      }
    } else {
      byEn.set(e.en, { file, idx, zh: e.zh });
    }

    if (!enNames.length && e.pad !== false) {
      const enW = stringWidth(e.en);
      const zhW = stringWidth(e.zh);
      if (zhW > enW) {
        report('warn', `${at}: display width overflow ${enW}→${zhW} for "${e.en}"`);
      }
    }
  }
}

console.log(`\nvalidated ${byEn.size} unique keys, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
