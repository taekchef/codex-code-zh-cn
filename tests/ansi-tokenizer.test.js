'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AnsiTokenizer } = require('../lib/ansi-tokenizer');

function collect(chunks) {
  const texts = [];
  const raws = [];
  const tok = new AnsiTokenizer({
    onText: (t) => texts.push(t),
    onRaw: (r) => raws.push(r),
  });
  for (const c of chunks) tok.feed(c);
  tok.end();
  return { texts, raws };
}

test('splits text around SGR', () => {
  const { texts, raws } = collect(['model:     ', '\x1b[3mloading\x1b[23m   /model']);
  assert.deepEqual(texts, ['model:     ', 'loading', '   /model']);
  assert.equal(raws.join(''), '\x1b[3m\x1b[23m');
});

test('CSI sequences pass through verbatim', () => {
  const { texts, raws } = collect(['\x1b[3;10HDo\x1b[3;13Hyou']);
  assert.deepEqual(texts, ['Do', 'you']);
  assert.equal(raws.join(''), '\x1b[3;10H\x1b[3;13H');
});

test('OSC sequences pass through verbatim', () => {
  const { raws } = collect(['\x1b]0;title\x07text']);
  assert.equal(raws.join(''), '\x1b]0;title\x07');
});

test('flushText keeps requested tail', () => {
  const texts = [];
  const tok = new AnsiTokenizer({ onText: (t) => texts.push(t), onRaw: () => {} });
  tok.feed('hello world');
  tok.flushText(5);
  assert.deepEqual(texts, ['hello ']);
  tok.end();
});

test('charset and single-char escapes', () => {
  const { texts, raws } = collect(['a\x1b(Bb']);
  assert.equal(raws.join(''), '\x1b(B');
  assert.deepEqual(texts, ['a', 'b']);
});
