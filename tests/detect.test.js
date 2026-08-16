'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isShadowShim } = require('../lib/detect');

test('isShadowShim detects the shadow marker', () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-zh-')), 'codex');
  fs.writeFileSync(p, '#!/usr/bin/env bash\n# codex-code-zh-cn shadow shim\nexit 0\n');
  assert.equal(isShadowShim(p), true);
  fs.writeFileSync(p, '#!/usr/bin/env bash\necho real\n');
  assert.equal(isShadowShim(p), false);
});

test('isShadowShim returns false for missing files', () => {
  assert.equal(isShadowShim(path.join(os.tmpdir(), 'codex-zh-does-not-exist-12345')), false);
});
