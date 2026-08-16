#!/usr/bin/env node
'use strict';

/**
 * apply-config-overlay.js — apply/remove/status the desktop locale overlay.
 *
 *   node scripts/apply-config-overlay.js apply
 *   node scripts/apply-config-overlay.js remove
 *   node scripts/apply-config-overlay.js status
 */

const { applyOverlay, removeOverlay, status, codexConfigPath } = require('../lib/config-overlay');

const action = process.argv[2] || 'apply';
const configPath = codexConfigPath();

switch (action) {
  case 'apply': {
    const result = applyOverlay(configPath);
    console.log(`[codex-code-zh-cn] localeOverride=zh-CN ${result} (${configPath})`);
    process.exit(0);
    break;
  }
  case 'remove':
  case 'restore': {
    const result = removeOverlay(configPath);
    console.log(`[codex-code-zh-cn] localeOverride ${result} (${configPath})`);
    process.exit(0);
    break;
  }
  case 'status': {
    const result = status(configPath);
    console.log(result);
    process.exit(result === 'applied' ? 0 : 1);
    break;
  }
  default:
    console.error(`usage: ${process.argv[1]} apply|remove|status`);
    process.exit(2);
}
