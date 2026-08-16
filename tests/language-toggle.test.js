'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createToggleDetector } = require('../lib/language-toggle');

function collect(input) {
  const calls = [];
  const feed = createToggleDetector((lang, cmd) => calls.push({ lang, cmd }));
  feed(input);
  return calls;
}

test('detects /chinese', () => {
  assert.deepEqual(collect('/chinese\r'), [{ lang: 'zh-CN', cmd: 'chinese' }]);
  assert.deepEqual(collect('/zh\n'), [{ lang: 'zh-CN', cmd: 'zh' }]);
  assert.deepEqual(collect('  /CHINESE \r'), [{ lang: 'zh-CN', cmd: 'CHINESE' }]);
});

test('detects /english', () => {
  assert.deepEqual(collect('/english\r'), [{ lang: 'en', cmd: 'english' }]);
  assert.deepEqual(collect('/en\r'), [{ lang: 'en', cmd: 'en' }]);
});

test('ignores ordinary input and inline args', () => {
  assert.deepEqual(collect('hello\r'), []);
  assert.deepEqual(collect('/model\r'), []);
  assert.deepEqual(collect('/chinese now\r'), []);
});

test('backspace edits the line', () => {
  assert.deepEqual(collect('/chinesex\x7f\r'), [{ lang: 'zh-CN', cmd: 'chinese' }]);
});

test('ctrl-c resets the line buffer', () => {
  assert.deepEqual(collect('/chin\x03other\r'), []);
});
