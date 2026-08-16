'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * detect.js — locate the Codex CLI executable and report its version.
 *
 * Modern Codex is installed as an npm package whose `codex` shim forwards to
 * a native per-platform binary:
 *
 *   node_modules/@openai/codex/bin/codex.js
 *     └─▶ node_modules/@openai/codex/node_modules/@openai/codex-<target>
 *           └─▶ vendor/<target-triple>/bin/codex[.exe]
 */

function which(command) {
  if (process.platform === 'win32') {
    const res = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true });
    if (res.status === 0) return res.stdout.split(/\r?\n/).find(Boolean) || null;
    return null;
  }
  const res = spawnSync('which', [command], { encoding: 'utf8' });
  if (res.status === 0) return res.stdout.split('\n').find(Boolean) || null;
  return null;
}

function isFileExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function resolveCodexBin(override) {
  if (override) return path.resolve(override);
  const fromEnv = process.env.CODEX_BIN;
  if (fromEnv) return path.resolve(fromEnv);
  const found = which('codex');
  if (found && isFileExecutable(found)) return found;
  return null;
}

/**
 * Try to locate the native platform binary (for doctor output and future
 * in-place patching).  Returns null when Codex is installed differently.
 */
function resolveNativeBinary() {
  const bin = resolveCodexBin();
  if (!bin) return null;
  let real = bin;
  try {
    real = fs.realpathSync(bin);
  } catch {}
  const dir = path.dirname(real);
  // npm shim layout: <root>/bin/codex.js
  const pkgRoot = path.resolve(dir, '..');
  const targetDirs = [
    path.join(pkgRoot, 'node_modules', '@openai'),
    path.join(path.dirname(dir), 'node_modules', '@openai'),
  ];
  for (const base of targetDirs) {
    let names = [];
    try {
      names = fs.readdirSync(base).filter((n) => n.startsWith('codex-'));
    } catch {}
    for (const name of names) {
      const target = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
      if (!name.includes(target)) continue;
      const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
      if (!name.includes(arch)) continue;
      const vendor = path.join(base, name, 'vendor');
      let candidates = [];
      try {
        const triples = fs.readdirSync(vendor);
        for (const triple of triples) {
          candidates.push(
            path.join(vendor, triple, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex')
          );
        }
      } catch {}
      for (const c of candidates) {
        if (isFileExecutable(c)) return c;
      }
    }
  }
  return null;
}

function getCodexVersion(codexBin) {
  const bin = codexBin || resolveCodexBin();
  if (!bin) return null;
  try {
    const res = spawnSync(bin, ['--version'], {
      encoding: 'utf8',
      env: { ...process.env, TERM: 'dumb' },
      timeout: 15000,
      windowsHide: true,
    });
    const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
    const m = out.match(/(?:codex-cli[^\d]*)?(\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?)/);
    return m ? m[1] : out.slice(0, 80) || null;
  } catch {
    return null;
  }
}

module.exports = { which, resolveCodexBin, resolveNativeBinary, getCodexVersion };
