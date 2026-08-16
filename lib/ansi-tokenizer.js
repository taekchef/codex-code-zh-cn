'use strict';

/**
 * ansi-tokenizer.js — splits a byte/char stream into printable text runs and
 * raw terminal control sequences.
 *
 * Control sequences (CSI, OSC, DCS/SOS/PM/APC, charset selects, single-char
 * escapes) are passed through byte-for-byte.  Printable runs are buffered and
 * handed to `onText` when a control byte interrupts the run or when the
 * consumer calls `flushText()`.  Splitting at SGR boundaries is intentional:
 * Codex styles individual words (`Press ` + styled key + ` to continue`), and
 * the translation table contains per-fragment entries.
 */

class AnsiTokenizer {
  /**
   * @param {object} opts
   * @param {(text:string)=>void} opts.onText  called with a printable run
   * @param {(bytes:string)=>void} opts.onRaw  called with raw control bytes
   */
  constructor({ onText, onRaw }) {
    this.onText = onText;
    this.onRaw = onRaw;
    this.pending = '';
    this.state = 'text'; // text | esc | csi | osc | string | string-esc | osc-esc
    this.stringTerminator = null;
    this.escBuffer = '';
  }

  /**
   * Flush the buffered printable run through onText.
   * @param {number} [keep]  keep this many trailing characters buffered so
   *   matches spanning chunk boundaries are not split (0 = flush all).
   */
  flushText(keep = 0) {
    if (this.pending.length > keep) {
      const cut = this.pending.length - keep;
      const text = this.pending.slice(0, cut);
      this.pending = this.pending.slice(cut);
      if (text.length > 0) this.onText(text);
    }
  }

  _flushRaw() {
    if (this.escBuffer) {
      const bytes = this.escBuffer;
      this.escBuffer = '';
      this.onRaw(bytes);
    }
  }

  _enterEsc(byte) {
    this.state = 'esc';
    this.escBuffer = byte;
  }

  feed(chunk) {
    for (const ch of chunk) {
      const cp = ch.codePointAt(0);
      const isControl = cp < 0x20 || cp === 0x7f;

      switch (this.state) {
        case 'text': {
          if (ch === '\x1b') {
            this.flushText();
            this._enterEsc(ch);
          } else if (isControl) {
            this.flushText();
            this.onRaw(ch);
          } else {
            this.pending += ch;
          }
          break;
        }

        case 'esc': {
          this.escBuffer += ch;
          if (ch === '[') {
            this.state = 'csi';
          } else if (ch === ']') {
            this.state = 'osc';
          } else if (ch === 'P' || ch === 'X' || ch === '^' || ch === '_') {
            this.state = 'string';
            this.stringTerminator = ch;
          } else if (cp >= 0x20 && cp <= 0x2f) {
            // Escape with an intermediate byte: ESC ( B, ESC ) 0, ESC # 8 ...
            this.state = 'esc-inter';
          } else {
            // Two-byte sequence (ESC 7, ESC =, ESC M ...).
            this._flushRaw();
            this.state = 'text';
          }
          break;
        }

        case 'esc-inter': {
          this.escBuffer += ch;
          this._flushRaw();
          this.state = 'text';
          break;
        }

        case 'csi': {
          this.escBuffer += ch;
          // Final byte of a CSI sequence is 0x40..0x7E.
          if (cp >= 0x40 && cp <= 0x7e) {
            this._flushRaw();
            this.state = 'text';
          }
          break;
        }

        case 'osc': {
          this.escBuffer += ch;
          if (ch === '\x07') {
            // BEL-terminated OSC.
            this._flushRaw();
            this.state = 'text';
          } else if (ch === '\x1b') {
            this.state = 'osc-esc';
          }
          break;
        }

        case 'osc-esc': {
          this.escBuffer += ch;
          if (ch === '\\') {
            // ST-terminated OSC.
            this._flushRaw();
            this.state = 'text';
          } else if (ch === '\x07') {
            this._flushRaw();
            this.state = 'text';
          } else if (ch === '\x1b') {
            this.state = 'osc-esc';
          } else {
            this.state = 'osc';
          }
          break;
        }

        case 'string': {
          this.escBuffer += ch;
          if (ch === '\x1b') {
            this.state = 'string-esc';
          }
          break;
        }

        case 'string-esc': {
          this.escBuffer += ch;
          if (ch === '\\') {
            this._flushRaw();
            this.state = 'text';
          } else if (ch === '\x1b') {
            this.state = 'string-esc';
          } else {
            this.state = 'string';
          }
          break;
        }
      }
    }
  }

  /** End of stream: flush everything. */
  end() {
    if (this.state !== 'text') this._flushRaw();
    this.flushText();
    this.state = 'text';
    this.escBuffer = '';
  }
}

module.exports = { AnsiTokenizer };
