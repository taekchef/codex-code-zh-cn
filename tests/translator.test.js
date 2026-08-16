'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { StreamTranslator } = require('../lib/translator');

const ENTRIES = [
  { en: 'Press space or enter to toggle; esc to go back', zh: '空格或回车切换；esc 返回' },
  { en: 'Manage Codex plugins', zh: '管理 Codex 插件' },
  { en: 'model:     ', zh: '模型：' },
  { en: 'plugin', zh: '插件', word: true },
  { en: 'model', zh: '模型', word: true },
  { en: 'loading', zh: '加载中', word: true },
];

function run(chunks, entries = ENTRIES) {
  let out = '';
  const t = new StreamTranslator(entries, (c) => (out += c), { flushIntervalMs: 0 });
  for (const c of chunks) t.feed(c);
  t.end();
  return out;
}

test('phrase split across chunks still matches', () => {
  const out = run(['Press space or enter ', 'to toggle; esc to go back']);
  assert.equal(out, '空格或回车切换；esc 返回                      ');
});

test('ANSI sequences pass through and fragments translate', () => {
  const out = run(['model:     ', '\x1b[3m', 'loading', '\x1b[23m']);
  assert.ok(out.startsWith('模型：'));
  assert.equal(out, '模型：     \x1b[3m加载中 \x1b[23m');
});

test('command rows keep the command token but translate the description', () => {
  const out = run(['  plugin          Manage Codex plugins']);
  assert.equal(out, '  plugin          管理 Codex 插件     ');
});

test('flag tokens are not translated', () => {
  assert.equal(run(['--model']), '--model');
  assert.equal(run(['/model']), '/model');
});

test('long prose run skips word tokens', () => {
  const long = `The word loading appears in this sentence and should stay ${'x'.repeat(250)}`;
  const out = run([long]);
  assert.equal(out, long);
});
