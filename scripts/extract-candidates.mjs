#!/usr/bin/env node
'use strict';

/**
 * extract-candidates.mjs — extract candidate UI string literals from the
 * openai/codex Rust sources for a given release tag.
 *
 * Usage:
 *   node scripts/extract-candidates.mjs /path/to/codex-src > candidates.json
 *
 * The output is newline-delimited JSON: {"en": "...", "files": n}.
 * It deliberately excludes test files and single tokens, keeps phrases that
 * look like user-facing copy, and marks format strings separately.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/extract-candidates.mjs <codex-src-dir>');
  process.exit(2);
}

const dirs = [
  'codex-rs/tui/src',
  'codex-rs/cli/src',
  'codex-rs/core/src',
  'codex-rs/apply-patch/src',
  'codex-rs/exec/src',
]
  .map((d) => path.join(root, d))
  .filter((d) => fs.existsSync(d));

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests') continue;
      yield* walk(p);
    } else if (entry.name.endsWith('.rs')) {
      const base = path.basename(entry.name);
      if (base.endsWith('_tests.rs') || base.endsWith('_test.rs') || base.includes('test_')) continue;
      yield p;
    }
  }
}

const counts = new Map();
const LITERAL_RE = /"(?:[^"\\]|\\.)*"/g;

/** Remove `#[cfg(test)] mod tests { ... }` blocks (brace-counting). */
function stripTestModules(src) {
  const re = /#\[cfg\(test\)\]\s*(?:\/\/[^\n]*\n\s*)*mod\s+[A-Za-z0-9_]+\s*\{/g;
  let out = '';
  let last = 0;
  for (const m of src.matchAll(re)) {
    out += src.slice(last, m.index);
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
    }
    last = i;
  }
  out += src.slice(last);
  return out;
}

for (const dir of dirs) {
  for (const file of walk(dir)) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    src = stripTestModules(src);
    for (const m of src.matchAll(LITERAL_RE)) {
      let lit = m[0].slice(1, -1);
      if (lit.includes('\\')) {
        // Normalise the common escapes; skip exotic ones.
        if (/\\u\{|\\x[0-9a-f]{2,}|\\[0-7]{3}/.test(lit)) continue;
        lit = lit
          .replace(/\\n/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\\r/g, '')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\'/g, "'");
      }
      if (lit.length < 4 || lit.length > 300) continue;
      if (!/[A-Za-z]{2,}/.test(lit)) continue;
      if (/^[\s\W_]+$/.test(lit)) continue;
      // Skip ANSI escapes, paths, URLs, and pure symbols.
      if (/\x1b/.test(lit)) continue;
      if (/^(\/|\.\.?\/|https?:|[A-Za-z]:\\|\$)/.test(lit)) continue;
      if (/^[A-Za-z0-9_.-]+$/.test(lit)) continue; // single token / identifier
      if (lit.includes('{') || lit.includes('}')) continue; // format strings handled separately
      const key = lit.trim();
      if (key.length < 4 || key.length > 300) continue;
      // Reject code/test fragments that survived module stripping.
      if (/\)\)|\);|assert!?|panic!?|expect[_!]|unreachable!|todo!|unwrap\(/.test(key)) continue;
      if (/\.rs\b|\/tmp\/|snapshot|fixture|fixtures|mock|unit test|test case/.test(key)) continue;
      if (/[\u4e00-\u9fff]/.test(key)) continue;
      // Must look like copy: contains a space or is title/sentence case.
      if (!/\s/.test(key) && !/^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(key)) continue;
      // Skip strings that are mostly punctuation or a single short token.
      if (/^[^A-Za-z]*$/.test(key)) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
}

const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
for (const [en, files] of rows) {
  console.log(JSON.stringify({ en, files }));
}
console.error(`extracted ${rows.length} candidates from ${dirs.length} source dirs`);
