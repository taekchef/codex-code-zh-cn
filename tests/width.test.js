'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stringWidth, padToWidth } = require('../lib/width');

test('ASCII width', () => {
  assert.equal(stringWidth(''), 0);
  assert.equal(stringWidth('abc'), 3);
  assert.equal(stringWidth('a b!'), 4);
});

test('CJK width', () => {
  assert.equal(stringWidth('思考中'), 6);
  assert.equal(stringWidth('模型'), 4);
});

test('mixed width', () => {
  assert.equal(stringWidth('Hook 审核'), 4 + 1 + 4);
});

test('combining marks are zero-width', () => {
  assert.equal(stringWidth('e\u0301'), 1);
});

test('padToWidth pads shorter text', () => {
  assert.equal(padToWidth('思考中', 8), '思考中  ');
  assert.equal(padToWidth('already long', 3), 'already long');
});
