'use strict';

const { AnsiTokenizer } = require('./ansi-tokenizer');
const { Matcher } = require('./matcher');

/**
 * translator.js — streaming ANSI-aware Codex output translator.
 *
 *   chunk in ──▶ AnsiTokenizer ──▶ printable runs ──▶ Matcher ──▶ chunk out
 *                     └──────────────▶ control bytes (verbatim) ──────────┘
 *
 * Printable text is buffered up to `holdback` characters so that a phrase
 * split across two PTY chunks is still matched as a whole.  Control bytes and
 * escape sequences flush the buffer and pass through untouched.
 */

const DEFAULT_HOLDBACK = 1024;
const DEFAULT_FLUSH_INTERVAL_MS = 25;

class StreamTranslator {
  /**
   * @param {Array<{en:string, zh:string, pad?:boolean}>} entries
   * @param {(chunk:string)=>void} write  output sink
   * @param {object} [opts]
   */
  constructor(entries, write, opts = {}) {
    this.write = write;
    this.matcher = new Matcher(entries, { logger: opts.logger });
    // A phrase-only matcher is used for runs that contain command/flag
    // syntax, code examples or long prose; translating single tokens there
    // would garble command names (--model), /commands and model output.
    this.matcherPhrases = new Matcher(
      entries.filter((e) => /\s/.test(e.en) || e.en.includes('${') || /[:：]/.test(e.en)),
      { logger: opts.logger }
    );
    this.holdback = Math.max(
      DEFAULT_HOLDBACK,
      (opts.holdback || 0),
      Math.max(this.matcher.maxLiteralLength, this.matcherPhrases.maxLiteralLength) - 1
    );
    this.tokenizer = new AnsiTokenizer({
      onText: (text) => this._onText(text),
      onRaw: (bytes) => write(bytes),
    });
    this.flushIntervalMs = opts.flushIntervalMs || DEFAULT_FLUSH_INTERVAL_MS;
    this.stats = { inBytes: 0, outBytes: 0, hits: 0, runs: 0 };
    this._timer = null;
  }

  _onText(text) {
    this.stats.runs += 1;
    const matcher = this._pickMatcher(text);
    const result = matcher.translate(text);
    this.stats.hits += result.hits;
    const out = result.out;
    this.stats.outBytes += Buffer.byteLength(out);
    this.write(out);
  }

  /**
   * Choose a matcher for a printable run.  Syntax-heavy and long prose runs
   * only get phrase translation; short UI runs also get word tokens.
   */
  _pickMatcher(text) {
    if (text.length > 240) return this.matcherPhrases;
    if (text.includes('`')) return this.matcherPhrases;
    if (/^\s*--?[A-Za-z]/.test(text)) return this.matcherPhrases;
    if (/--[A-Za-z]/.test(text)) return this.matcherPhrases;
    if (/^\/[A-Za-z]/.test(text)) return this.matcherPhrases;
    // clap command rows: "  exec            Run Codex ..."
    if (/^\s{1,8}[A-Za-z][\w-]*\s{2,}/.test(text)) return this.matcherPhrases;
    return this.matcher;
  }

  _startTimer() {
    if (this._timer || this.flushIntervalMs <= 0) return;
    this._timer = setInterval(() => this._flush(false), this.flushIntervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  _flush(force) {
    this.tokenizer.flushText(force ? 0 : this.holdback);
  }

  feed(chunk) {
    if (!chunk) return;
    this.stats.inBytes += Buffer.byteLength(chunk);
    this.tokenizer.feed(chunk);
    // Control-heavy TUI frames flush themselves; this covers plain streams.
    this._flush(false);
    this._startTimer();
  }

  /** End of the child process output. */
  end() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.tokenizer.end();
  }
}

module.exports = { StreamTranslator, Matcher, AnsiTokenizer };
