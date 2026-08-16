'use strict';

const { stringWidth, padToWidth } = require('./width');

/**
 * matcher.js — longest-match English→Chinese replacement over a printable run.
 *
 * Entries look like:
 *   { "en": "Press space or enter to toggle; esc to go back",
 *     "zh": "空格或回车切换；esc 返回" }
 *
 * An `en` value containing `${name}` placeholders is compiled into a sticky
 * RegExp so dynamic UI text (`OpenAI Codex (v0.147.0)`,
 * `1 hook needs review...`) can be translated too.
 *
 * Every replacement is padded to the display width of the English source so
 * terminal column positions stay intact.
 */

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class Matcher {
  constructor(entries = [], { logger = null } = {}) {
    this.entries = entries;
    this.logger = logger;
    this.literals = new Map(); // en -> entry
    this.trie = new Map(); // char -> node
    this.patterns = [];
    this.maxLiteralLength = 0;
    this.duplicates = [];

    for (const entry of entries) {
      if (!entry || typeof entry.en !== 'string' || typeof entry.zh !== 'string') continue;
      if (entry.en.length === 0) continue;

      if (entry.en.includes('${')) {
        this.patterns.push(this._compilePattern(entry));
        continue;
      }

      if (this.literals.has(entry.en)) {
        this.duplicates.push(entry.en);
        continue;
      }
      this.literals.set(entry.en, entry);
      // Single-token entries default to whole-word matching so UI words like
      // "Trust" never clobber the inside of longer English words.
      if (entry.word === undefined) entry.word = !/\s/.test(entry.en);
      this.maxLiteralLength = Math.max(this.maxLiteralLength, entry.en.length);
      this._insertTrie(entry.en, entry);
    }

    // Longest patterns first (matters only for iteration, not correctness).
    this.patterns.sort((a, b) => b.en.length - a.en.length);
  }

  _insertTrie(en, entry) {
    let node = this.trie;
    for (const ch of en) {
      let next = node.get(ch);
      if (!next) {
        next = new Map();
        node.set(ch, next);
      }
      node = next;
    }
    node.set('\u0000', entry);
  }

  _compilePattern(entry) {
    // "OpenAI Codex (v${version})" -> /OpenAI Codex \(v(.+?)\)/y
    const parts = entry.en.split(/\$\{[^}]+\}/g);
    const names = [...entry.en.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]);
    let src = '^';
    for (let i = 0; i < parts.length; i += 1) {
      src += escapeRegex(parts[i]);
      if (i < names.length) src += '(.+?)';
    }
    const re = new RegExp(src, 'uy');
    return {
      en: entry.en,
      zh: entry.zh,
      pad: entry.pad !== false,
      re,
      names,
    };
  }

  /** Longest literal match at `start`, or null. */
  _matchLiteral(text, start) {
    let node = this.trie;
    let best = null;
    let bestEnd = -1;
    let i = start;
    while (i < text.length && node) {
      node = node.get(text[i]);
      if (!node) break;
      i += 1;
      const entry = node.get('\u0000');
      if (entry) {
        best = entry;
        bestEnd = i;
      }
    }
    return best ? { entry: best, end: bestEnd } : null;
  }

  _render(text, entry, groups) {
    let zh = entry.zh;
    for (const [name, value] of Object.entries(groups || {})) {
      zh = zh.split(`\${${name}}`).join(value == null ? '' : value);
    }
    if (entry.pad === false) return zh;
    const enWidth = stringWidth(text);
    return padToWidth(zh, enWidth);
  }

  /**
   * Translate one printable run.
   * @returns {{out:string, hits:number, missed:number, maxWidthDelta:number}}
   */
  translate(run) {
    if (!run) return { out: '', hits: 0, missed: 0, maxWidthDelta: 0 };
    let out = '';
    let hits = 0;
    let i = 0;
    let maxWidthDelta = 0;

    while (i < run.length) {
      const literal = this._matchLiteral(run, i);
      if (literal && literal.entry.word) {
        // `word: true` entries are single UI tokens ("Trust", "Model") and
        // must not match inside a longer word in the same run.
        const prev = i > 0 ? run[i - 1] : '';
        const next = literal.end < run.length ? run[literal.end] : '';
        const isAlpha = (ch) => /[A-Za-z]/.test(ch);
        if (isAlpha(prev) || isAlpha(next)) {
          const cp = run.codePointAt(i);
          const ch = String.fromCodePoint(cp);
          out += ch;
          i += ch.length;
          continue;
        }
      }

      // Prefer whichever candidate covers the longest source span, so a
      // short literal ("Starting MCP servers") never shadows a longer
      // dynamic pattern ("Starting MCP servers (2/5): ...").
      let best = null;
      if (literal) best = { kind: 'literal', length: literal.end - i, entry: literal.entry };
      for (const pattern of this.patterns) {
        pattern.re.lastIndex = i;
        const m = pattern.re.exec(run);
        if (m && m[0].length > 0 && (!best || m[0].length > best.length)) {
          const groups = {};
          pattern.names.forEach((name, idx) => {
            groups[name] = m[idx + 1];
          });
          best = { kind: 'pattern', length: m[0].length, pattern, m, groups };
        }
      }

      if (best && best.kind === 'literal') {
        const enWidth = stringWidth(best.entry.en);
        const zh = this._render(best.entry.en, best.entry, null);
        maxWidthDelta = Math.max(maxWidthDelta, stringWidth(zh) - enWidth);
        out += zh;
        hits += 1;
        i += best.length;
        continue;
      }

      if (best && best.kind === 'pattern') {
        const { pattern, m, groups } = best;
        const zh = this._render(m[0], pattern, groups);
        maxWidthDelta = Math.max(maxWidthDelta, stringWidth(zh) - stringWidth(m[0]));
        out += zh;
        hits += 1;
        i += m[0].length;
        continue;
      }

      // No match: copy one code point.
      const cp = run.codePointAt(i);
      const ch = String.fromCodePoint(cp);
      out += ch;
      i += ch.length;
    }

    return {
      out,
      hits,
      missed: hits === 0 ? 1 : 0,
      maxWidthDelta,
    };
  }
}

module.exports = { Matcher, escapeRegex };
