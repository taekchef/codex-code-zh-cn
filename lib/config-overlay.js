'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * config-overlay.js — minimal TOML key writer for ~/.codex/config.toml.
 *
 * Codex has no `codex config set` command (yet), so the desktop locale
 * overlay is written with a conservative section-aware text edit:
 *
 *   [desktop]
 *   localeOverride = "zh-CN"
 *
 * Only that single key is added/replaced.  Every other line in the file is
 * preserved byte-for-byte, and a backup is written before the first change.
 */

const OVERLAY_SECTION = 'desktop';
const OVERLAY_KEY = 'localeOverride';
const OVERLAY_VALUE = 'zh-CN';
const BACKUP_SUFFIX = '.codex-code-zh-cn.bak';

function codexConfigPath() {
  const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return path.join(home, 'config.toml');
}

function ensureBackup(configPath) {
  const backup = configPath + BACKUP_SUFFIX;
  if (!fs.existsSync(backup) && fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backup);
  }
  return backup;
}

/** Find the line range of the `[desktop]` section, or null. */
function findSection(lines, section) {
  const header = new RegExp(`^\\s*\\[${section}\\](\\s+#.*)?$`);
  for (let i = 0; i < lines.length; i += 1) {
    if (header.test(lines[i])) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^\s*\[[^\]]+\]/.test(lines[j])) {
          end = j;
          break;
        }
      }
      return { start: i, end };
    }
  }
  return null;
}

/**
 * Apply the overlay.  Returns one of:
 *   created | updated | unchanged
 */
function applyOverlay(configPath = codexConfigPath()) {
  let lines = [];
  if (fs.existsSync(configPath)) {
    lines = fs.readFileSync(configPath, 'utf8').split('\n');
  } else {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }

  const keyRe = new RegExp(`^\\s*${OVERLAY_KEY}\\s*=`);
  const desired = `${OVERLAY_KEY} = "${OVERLAY_VALUE}"`;
  const section = findSection(lines, OVERLAY_SECTION);
  let result = 'unchanged';

  if (section) {
    // Replace the key inside the section if present.
    let found = false;
    for (let i = section.start + 1; i < section.end; i += 1) {
      if (keyRe.test(lines[i])) {
        if (lines[i].trim() === desired) return result;
        lines[i] = desired;
        found = true;
        result = 'updated';
        break;
      }
    }
    if (!found) {
      const insertAt = section.end;
      lines.splice(insertAt, 0, desired);
      result = 'updated';
    }
  } else {
    if (lines.length && lines[lines.length - 1].trim() === '') {
      lines.splice(lines.length - 1, 0, '', `[${OVERLAY_SECTION}]`, desired);
    } else {
      if (lines.length) lines.push('');
      lines.push(`[${OVERLAY_SECTION}]`, desired);
    }
    result = 'updated';
  }

  if (result !== 'unchanged') {
    ensureBackup(configPath);
    fs.writeFileSync(configPath, lines.join('\n'));
  }
  return result;
}

/** Remove the overlay key (and an emptied [desktop] section). */
function removeOverlay(configPath = codexConfigPath()) {
  if (!fs.existsSync(configPath)) return 'unchanged';
  const lines = fs.readFileSync(configPath, 'utf8').split('\n');
  const keyRe = new RegExp(`^\\s*${OVERLAY_KEY}\\s*=`);
  const section = findSection(lines, OVERLAY_SECTION);
  if (!section) return 'unchanged';

  let removed = false;
  const kept = [];
  let sectionEmpty = true;
  for (let i = 0; i < lines.length; i += 1) {
    if (i === section.start) {
      kept.push(lines[i]);
      continue;
    }
    if (i > section.start && i < section.end && keyRe.test(lines[i])) {
      removed = true;
      continue;
    }
    if (i > section.start && i < section.end && lines[i].trim() !== '' && !/^\s*#/.test(lines[i])) {
      sectionEmpty = false;
    }
    kept.push(lines[i]);
  }
  if (!removed) return 'unchanged';
  ensureBackup(configPath);
  fs.writeFileSync(configPath, kept.join('\n'));
  return 'removed';
}

function status(configPath = codexConfigPath()) {
  if (!fs.existsSync(configPath)) return 'missing';
  const text = fs.readFileSync(configPath, 'utf8');
  const section = findSection(text.split('\n'), OVERLAY_SECTION);
  if (!section) return 'not-applied';
  for (const line of text.split('\n').slice(section.start + 1, section.end)) {
    if (line.trim() === `${OVERLAY_KEY} = "${OVERLAY_VALUE}"`) return 'applied';
  }
  return 'not-applied';
}

module.exports = {
  applyOverlay,
  removeOverlay,
  status,
  codexConfigPath,
  OVERLAY_SECTION,
  OVERLAY_KEY,
  OVERLAY_VALUE,
  BACKUP_SUFFIX,
};
