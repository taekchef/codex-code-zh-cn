'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * settings.js — codex-code-zh-cn 自身的持久化设置。
 *
 * 文件：<CODEX_ZH_HOME 或 ~/.codex-code-zh-cn>/settings.json
 * 字段：language: "zh-CN" | "en"  （/chinese、/english 切换的就是它）
 */

function settingsPath() {
  const home = process.env.CODEX_ZH_HOME || path.join(os.homedir(), '.codex-code-zh-cn');
  return path.join(home, 'settings.json');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2) + '\n');
}

function currentLanguage() {
  const lang = readSettings().language;
  return lang === 'en' ? 'en' : 'zh-CN';
}

function setLanguage(language) {
  const normalized = language === 'en' ? 'en' : 'zh-CN';
  const settings = readSettings();
  settings.language = normalized;
  writeSettings(settings);
  return normalized;
}

module.exports = { readSettings, writeSettings, currentLanguage, setLanguage, settingsPath };
