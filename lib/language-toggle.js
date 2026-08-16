'use strict';

/**
 * language-toggle.js — 在输入字节流里识别 /chinese、/english 切换命令。
 *
 * 识别规则：一行（以回车/换行结束）去掉首尾空白后匹配
 *   /chinese | /zh | /english | /en （大小写不敏感）
 * 识别后原样把字节转交给 Codex；Codex 会报 Unrecognized command，
 * 包装器把那条错误替换成切换成功提示。
 */

function createToggleDetector(apply) {
  let line = '';
  return function feed(data) {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    for (const ch of text) {
      if (ch === '\r' || ch === '\n') {
        const m = /^\s*\/(chinese|zh|english|en)\s*$/i.exec(line.trim());
        if (m) {
          const lang = /^(chinese|zh)$/i.test(m[1]) ? 'zh-CN' : 'en';
          apply(lang, m[1]);
        }
        line = '';
      } else if (ch === '\x7f' || ch === '\b') {
        line = line.slice(0, -1);
      } else if (ch === '\x03') {
        line = '';
      } else if (ch && ch.codePointAt(0) >= 0x20) {
        line += ch;
      }
    }
  };
}

module.exports = { createToggleDetector };
