'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { applyOverlay, removeOverlay, status, codexConfigPath } = require('../lib/config-overlay');

function tmpConfig() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-zh-')), 'config.toml');
}

test('creates missing config with desktop section', () => {
  const p = tmpConfig();
  assert.equal(applyOverlay(p), 'updated');
  const text = fs.readFileSync(p, 'utf8');
  assert.ok(text.includes('[desktop]'));
  assert.ok(text.includes('localeOverride = "zh-CN"'));
  assert.equal(status(p), 'applied');
});

test('preserves other sections and keys', () => {
  const p = tmpConfig();
  fs.writeFileSync(p, 'model = "gpt-5.6-sol"\n\n[desktop]\nappearanceTheme = "system"\n');
  assert.equal(applyOverlay(p), 'updated');
  const text = fs.readFileSync(p, 'utf8');
  assert.ok(text.includes('model = "gpt-5.6-sol"'));
  assert.ok(text.includes('appearanceTheme = "system"'));
  assert.ok(text.includes('localeOverride = "zh-CN"'));
});

test('replaces existing localeOverride', () => {
  const p = tmpConfig();
  fs.writeFileSync(p, '[desktop]\nlocaleOverride = "en-US"\n');
  assert.equal(applyOverlay(p), 'updated');
  assert.equal(status(p), 'applied');
  assert.ok(!fs.readFileSync(p, 'utf8').includes('en-US'));
});

test('is idempotent and backs up existing files', () => {
  const p = tmpConfig();
  fs.writeFileSync(p, 'model = "gpt-5.6-sol"\n');
  applyOverlay(p);
  assert.ok(fs.existsSync(p + '.codex-code-zh-cn.bak'));
  assert.equal(applyOverlay(p), 'unchanged');
});

test('removeOverlay removes only the key', () => {
  const p = tmpConfig();
  fs.writeFileSync(p, '[desktop]\nlocaleOverride = "zh-CN"\nappearanceTheme = "system"\n');
  assert.equal(removeOverlay(p), 'removed');
  const text = fs.readFileSync(p, 'utf8');
  assert.ok(!text.includes('localeOverride'));
  assert.ok(text.includes('appearanceTheme'));
});

test('status reports missing/not-applied', () => {
  const p = tmpConfig();
  assert.equal(status(p), 'missing');
  fs.writeFileSync(p, '[desktop]\nappearanceTheme = "dark"\n');
  assert.equal(status(p), 'not-applied');
});

test('codexConfigPath respects CODEX_HOME', () => {
  const old = process.env.CODEX_HOME;
  process.env.CODEX_HOME = path.join(os.tmpdir(), 'codex-home-test');
  try {
    assert.equal(codexConfigPath(), path.join(process.env.CODEX_HOME, 'config.toml'));
  } finally {
    if (old === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = old;
  }
});
