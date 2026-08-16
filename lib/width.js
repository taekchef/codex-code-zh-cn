'use strict';

/**
 * width.js — terminal display-width (wcwidth) helpers.
 *
 * The translation proxy rewrites terminal output before it reaches the real
 * terminal.  To keep box-drawing, column alignment and cursor positioning
 * intact we must preserve the *display width* of every replaced run: each
 * translation is padded with spaces up to the display width of the original
 * English run.
 */

// Zero-width code points (combining marks, joiners, variation selectors,
// control/format characters).  A deliberately generous list; a missing entry
// only causes a one-cell over-estimate, never a crash.
const ZERO_WIDTH_RE =
  /^[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08d3-\u08e1\u08e3-\u0902\u093a\u093c\u0941-\u0948\u094d\u0951-\u0957\u0962\u0963\u0981\u09bc\u09c1-\u09c4\u09cd\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0afa-\u0aff\u0b01\u0b3c\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b62\u0b63\u0b82\u0bc0\u0bcd\u0bd7\u0c00\u0c04\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c81\u0cbc\u0cbf\u0cc6\u0ccc\u0ccd\u0ce2\u0ce3\u0d00\u0d01\u0d3b\u0d3c\u0d41-\u0d44\u0d4d\u0d62\u0d63\u0dca\u0dd2-\u0dd4\u0dd6\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4\u17b5\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u1885\u1886\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a1b\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1ab0-\u1abe\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80-\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1bab-\u1bad\u1be6\u1be8\u1be9\u1bed-\u1bef\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1cf4\u1cf8\u1cf9\u1dc0-\u1df9\u1dfb-\u1dff\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\u20d0-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua674-\ua67d\ua69e\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8c5\ua8e0-\ua8f1\ua8ff\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\ua9e5\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaa7c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaec\uaaed\uaaf6\uabe5\uabe8\uabed\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\ufeff\ufff9-\ufffb]$/u;

function codePointWidth(cp) {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  // East Asian Wide / Fullwidth blocks (wcwidth = 2).
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo init.
    cp === 0x2329 || cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || // CJK radicals..Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat ideographs
    (cp >= 0xfe10 && cp <= 0xfe19) || // Vertical forms
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK compat forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // Emoji-ish symbols
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (ZERO_WIDTH_RE.test(ch)) return 0;
  return codePointWidth(cp);
}

function stringWidth(str) {
  let width = 0;
  // Iterate by code point, not UTF-16 code unit, so surrogate pairs count once.
  for (const ch of str) width += charWidth(ch);
  return width;
}

/** Pad `str` with spaces until its display width is at least `targetWidth`. */
function padToWidth(str, targetWidth) {
  const current = stringWidth(str);
  if (current >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - current);
}

module.exports = { charWidth, codePointWidth, stringWidth, padToWidth };
