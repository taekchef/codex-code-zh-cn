'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const settings = require('../lib/settings');

test('setLanguage persists zh/en and defaults to zh-CN', () => {
  const old = process.env.CODEX_ZH_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-zh-settings-'));
  process.env.CODEX_ZH_HOME = home;
  try {
    assert.equal(settings.currentLanguage(), 'zh-CN');
    assert.equal(settings.setLanguage('en'), 'en');
    assert.equal(settings.currentLanguage(), 'en');
    assert.ok(fs.existsSync(path.join(home, 'settings.json')));
    assert.equal(settings.setLanguage('zh-CN'), 'zh-CN');
    assert.equal(settings.currentLanguage(), 'zh-CN');
  } finally {
    if (old === undefined) delete process.env.CODEX_ZH_HOME;
    else process.env.CODEX_ZH_HOME = old;
  }
});
