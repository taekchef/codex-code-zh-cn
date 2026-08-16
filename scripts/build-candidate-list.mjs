#!/usr/bin/env node
'use strict';

/**
 * build-candidate-list.mjs — merge captured PTY sessions and source-literal
 * candidates into a deduplicated candidate list for translators.
 *
 * Usage:
 *   node scripts/build-candidate-list.mjs <capture-dir> <candidates.jsonl> <existing-json...>
 *   > candidates-to-translate.jsonl
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { AnsiTokenizer } = require(path.join(__dirname, '..', 'lib', 'ansi-tokenizer'));

const captureDir = process.argv[2];
const candidateFile = process.argv[3];
const existingFiles = process.argv.slice(4);

const existing = new Set();
for (const file of existingFiles) {
  if (!fs.existsSync(file)) continue;
  try {
    for (const entry of JSON.parse(fs.readFileSync(file, 'utf8'))) {
      if (entry && entry.en) existing.add(entry.en);
    }
  } catch (err) {
    console.error(`skip ${file}: ${err.message}`);
  }
}

const seen = new Map();

function add(en, source) {
  let key = en.trim();
  // Strip frame decoration so the payload phrase is what gets matched.
  key = key.replace(/^[\s│╭╰╯┌└├┤┬┴┼─═▁▔›»•◦▪■□⚠⚡●○·:+-]+/, '').trim();
  if (key.length < 6 || key.length > 300) return;
  if (existing.has(key)) return;
  if (/[\u4e00-\u9fff]/.test(key)) return; // user content, never UI
  if (/\\[xu0-9]/.test(key)) return; // literal escape sequences
  if (!/\s/.test(key)) return; // phrase candidates only (single words are curated)
  if (!/[A-Za-z]{3,}/.test(key)) return;
  // Drop truncated/render-fragment garbage: every word must be ≥2 letters.
  const words = key.match(/[A-Za-z]+/g) || [];
  if (words.length < 2 || words.some((w) => w.length < 2)) return;
  // Drop code-shaped lines.
  if (/[;{}[\]]/.test(key) || key.includes('=>') || key.includes('::')) return;
  if (source.startsWith('source:')) {
    // Keep source candidates that look like sentences/labels; skip cryptic
    // two-word debug snippets.
    const isTitle = /^[A-Z][a-z]+(?:\s+[A-Za-z0-9'./-]+)*$/.test(key);
    const isSentence = /^[A-Z][^A-Z]*[.!?…]$/.test(key);
    if (words.length < 3 && key.length < 14 && !isTitle && !isSentence) return;
  }
  if (!seen.has(key)) seen.set(key, new Set());
  seen.get(key).add(source);
}

// 1. Captured runs.
if (captureDir && fs.existsSync(captureDir)) {
  for (const name of fs.readdirSync(captureDir)) {
    if (!name.endsWith('.raw')) continue;
    let data;
    try {
      data = fs.readFileSync(path.join(captureDir, name), 'utf8');
    } catch {
      continue;
    }
    const tok = new AnsiTokenizer({
      onText: (text) => {
        const t = text.trim();
        if (t.length >= 4) add(t, `capture:${name}`);
      },
      onRaw: () => {},
    });
    tok.feed(data);
    tok.end();
  }
}

// 2. Source candidates.
if (candidateFile && fs.existsSync(candidateFile)) {
  for (const line of fs.readFileSync(candidateFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.en) add(obj.en, `source:${obj.files}`);
    } catch {}
  }
}

const rows = [...seen.entries()]
  .map(([en, sources]) => ({ en, sources: [...sources].join(',') }))
  .sort((a, b) => a.en.length - b.en.length);
for (const row of rows) console.log(JSON.stringify(row));
console.error(`candidates: ${rows.length} (existing: ${existing.size})`);
