/**
 * Locate every installed @deepseek-harness-tui/dsh-tui copy on this machine:
 * the global npm install, the DSH profiles (~/.dsh/profiles/*) and a few
 * common pnpm/global prefixes. Missing paths are simply skipped.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PKG = path.join('@deepseek-harness-tui', 'dsh-tui');

function isDshTui(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return pkg.name === '@deepseek-harness-tui/dsh-tui';
  } catch {
    return false;
  }
}

function pushCandidate(list, dir) {
  if (!dir) return;
  try {
    if (isDshTui(dir)) list.push(fs.realpathSync(dir));
  } catch {
    /* not a dsh-tui install */
  }
}

function nodeModulesPrefixes() {
  const home = os.homedir();
  const out = [];
  const fromEnv = process.env.DSH_TUI_CLAWD_TARGET;
  if (fromEnv) out.push(fromEnv);
  if (process.env.npm_config_prefix) out.push(path.join(process.env.npm_config_prefix, 'node_modules'));
  if (process.env.APPDATA) out.push(path.join(process.env.APPDATA, 'npm', 'node_modules')); // Windows
  out.push(
    path.join(home, '.npm-global', 'lib', 'node_modules'),
    path.join(home, '.local', 'share', 'pnpm', 'global', '5', 'node_modules'),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    '/opt/homebrew/lib/node_modules',
  );
  return out;
}

/** @returns {string[]} absolute package directories, de-duplicated */
export function findDshTuiInstalls() {
  const found = [];
  pushCandidate(found, path.join(nodeModulesPrefixes()[0] ?? '', PKG)); // env override first
  for (const prefix of nodeModulesPrefixes()) pushCandidate(found, path.join(prefix, PKG));

  // DSH profiles: ~/.dsh/profiles/<name>/node_modules/@deepseek-harness-tui/dsh-tui
  const profiles = path.join(os.homedir(), '.dsh', 'profiles');
  try {
    for (const entry of fs.readdirSync(profiles, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      pushCandidate(found, path.join(profiles, entry.name, 'node_modules', PKG));
      // pnpm virtual store fallback: .pnpm/@deepseek-harness-tui+dsh-tui@*/node_modules/...
      const pnpmDir = path.join(profiles, entry.name, 'node_modules', '.pnpm');
      try {
        for (const pnpmEntry of fs.readdirSync(pnpmDir)) {
          if (!pnpmEntry.startsWith('@deepseek-harness-tui+dsh-tui@')) continue;
          pushCandidate(found, path.join(pnpmDir, pnpmEntry, 'node_modules', PKG));
        }
      } catch {
        /* no pnpm store */
      }
    }
  } catch {
    /* no DSH profiles */
  }
  return [...new Set(found)];
}

/** Files this package may touch inside one dsh-tui installation. */
export function filesOf(installDir) {
  const companion = path.join('lib', 'types', 'components', 'sidePanel', 'companion');
  return {
    deepy: path.join(installDir, 'assets', 'deepy', 'frames.json'),
    whaleFrames: path.join(installDir, 'lib', 'types', 'components', 'whaleFrames.js'),
    launchpadLayout: path.join(installDir, 'lib', 'types', 'components', 'launchpadLayout.js'),
    logoV2: path.join(installDir, 'lib', 'types', 'components', 'LogoV2.js'),
    deepyRender: path.join(installDir, companion, 'deepy.js'),
    skins: path.join(installDir, companion, 'skins.js'),
    i18n: path.join(installDir, 'lib', 'types', 'i18n.js'),
  };
}
