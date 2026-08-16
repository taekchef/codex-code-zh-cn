'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Matcher } = require('../lib/matcher');
const { stringWidth } = require('../lib/width');

const ENTRIES = [
  { en: 'Press space or enter to toggle; esc to go back', zh: '空格或回车切换；esc 返回' },
  { en: 'model:     ', zh: '模型：' },
  { en: 'loading', zh: '加载中', word: true },
  { en: 'Trusted', zh: '已信任', word: true },
  { en: 'Trust', zh: '信任', word: true },
  { en: 'Yes, continue', zh: '是，继续' },
  { en: 'Yes', zh: '是', word: true },
  { en: 'Options:', zh: '选项：' },
  { en: 'Long prose sentence that should not get trailing padding.', zh: '长句翻译', pad: false },
];

test('longest literal match wins', () => {
  const m = new Matcher(ENTRIES);
  const r = m.translate('1. Yes, continue');
  assert.equal(r.out, '1. 是，继续     ');
  assert.equal(stringWidth(r.out), stringWidth('1. Yes, continue'));
});

test('word entry does not match inside longer word', () => {
  const m = new Matcher(ENTRIES);
  assert.equal(m.translate('Trusting').out, 'Trusting');
  assert.equal(m.translate('Trusted').out, '已信任 ');
  assert.equal(m.translate('Trust').out, '信任 ');
});

test('fragment translation preserves display width', () => {
  const m = new Matcher(ENTRIES);
  const src = 'model:     loading';
  const r = m.translate(src);
  assert.equal(r.out, '模型：     加载中 ');
  assert.equal(stringWidth(r.out), stringWidth(src));
});

test('pad:false does not pad', () => {
  const m = new Matcher(ENTRIES);
  const r = m.translate('Long prose sentence that should not get trailing padding.');
  assert.equal(r.out, '长句翻译');
});

test('dynamic patterns with placeholders', () => {
  const m = new Matcher([
    { en: 'OpenAI Codex (v${version})', zh: 'OpenAI Codex（v${version}）', pad: false },
    { en: '(${sec}s • esc to interrupt)', zh: '（${sec}s • esc 中断）' },
  ]);
  assert.equal(m.translate('OpenAI Codex (v0.147.0)').out, 'OpenAI Codex（v0.147.0）');
  assert.equal(m.translate('(3s • esc to interrupt)').out, '（3s • esc 中断）      ');
});

test('longer pattern beats shorter literal prefix', () => {
  const m = new Matcher([
    { en: 'Starting MCP servers', zh: '正在启动 MCP 服务器' },
    { en: 'Starting MCP servers (${done}/${total}): ${names}', zh: '正在启动 MCP 服务器 (${done}/${total})：${names}', pad: false },
  ]);
  const r = m.translate('Starting MCP servers (2/5): chrome, stitch');
  assert.equal(r.out, '正在启动 MCP 服务器 (2/5)：chrome, stitch');
});

test('punctuation-only continuation is handled', () => {
  const m = new Matcher([{ en: 'Options:', zh: '选项：' }]);
  assert.equal(m.translate('Options:').out, '选项：  ');
  assert.equal(stringWidth(m.translate('Options:').out), stringWidth('Options:'));
});
