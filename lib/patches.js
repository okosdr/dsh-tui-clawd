/**
 * Apply / revert the three dsh-tui patches and keep a one-time backup of the
 * original files next to them (`<file>.clawd-backup`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { filesOf } from './targets.js';
import {
  isLayoutPatched,
  isLogoPatched,
  isWhaleFramesPatched,
  patchLaunchpadLayout,
  patchLogoV2,
  patchWhaleFramesSource,
} from './crab.js';
import { isAnimatedDeepy, buildAnimatedDeepyJson } from './animation.js';
import { isMascotPatched, patchDeepyRenderModule, patchSkinsModule } from './mascot.js';
import { isLangPatched, patchI18nModule } from './lang.js';

const BACKUP_SUFFIX = '.clawd-backup';

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function atomicWrite(file, text) {
  // pnpm installs are hard links into a content-addressable store: write a new
  // file and rename it over the old one so the store copy stays untouched.
  const tmp = `${file}.clawd-tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

function backup(file) {
  const copy = `${file}${BACKUP_SUFFIX}`;
  if (!fs.existsSync(copy)) fs.copyFileSync(file, copy);
  return copy;
}

/** @returns {Array<{file: string, state: 'patched'|'clean'|'missing'|'unsupported'>}> */
export function inspect(installDir) {
  const files = filesOf(installDir);
  const out = [];
  const checks = [
    ['assets/deepy/frames.json', files.deepy, isAnimatedDeepy],
    ['lib/types/components/whaleFrames.js', files.whaleFrames, isWhaleFramesPatched],
    ['lib/types/components/launchpadLayout.js', files.launchpadLayout, isLayoutPatched],
    ['lib/types/components/LogoV2.js', files.logoV2, isLogoPatched],
    ['.../companion/deepy.js', files.deepyRender, isMascotPatched],
    ['.../companion/skins.js', files.skins, isMascotPatched],
    ['lib/types/i18n.js', files.i18n, isLangPatched],
  ];
  for (const [label, file, isPatched] of checks) {
    const text = readIfExists(file);
    if (text === undefined) out.push({ label, file, state: 'missing' });
    else out.push({ label, file, state: isPatched(text) ? 'patched' : 'clean' });
  }
  return out;
}

/**
 * @param {string} installDir
 * @param {{layout?: boolean, dryRun?: boolean}} options
 * @returns {Array<{label: string, result: string}>}
 */
export function apply(installDir, options = {}) {
  const withLayout = options.layout !== false;
  const files = filesOf(installDir);
  const results = [];

  const run = (label, file, patched, makePatched) => {
    const text = readIfExists(file);
    if (text === undefined) return results.push({ label, result: 'missing' });
    if (patched(text)) {
      // Adopt a backup left by an earlier manual patch so `restore` still works.
      const backupFile = `${file}${BACKUP_SUFFIX}`;
      if (!fs.existsSync(backupFile) && fs.existsSync(`${file}.orig-backup`)) {
        try {
          fs.copyFileSync(`${file}.orig-backup`, backupFile);
        } catch {
          /* backup stays unavailable */
        }
      }
      return results.push({ label, result: 'already patched' });
    }
    let next;
    try {
      next = makePatched(text);
    } catch (error) {
      return results.push({ label, result: `skipped (${error.message})` });
    }
    if (next === undefined || next === text) return results.push({ label, result: 'unchanged' });
    if (options.dryRun) return results.push({ label, result: 'would patch' });
    backup(file);
    atomicWrite(file, next);
    return results.push({ label, result: 'patched' });
  };

  run('assets/deepy/frames.json', files.deepy, isAnimatedDeepy, (text) => buildAnimatedDeepyJson(text));
  run('lib/types/components/whaleFrames.js', files.whaleFrames, isWhaleFramesPatched, (text) =>
    patchWhaleFramesSource(text),
  );
  if (withLayout) {
    run('lib/types/components/launchpadLayout.js', files.launchpadLayout, isLayoutPatched, (text) =>
      patchLaunchpadLayout(text),
    );
    run('lib/types/components/LogoV2.js', files.logoV2, isLogoPatched, (text) => patchLogoV2(text));
  }
  if (options.mascot !== false) {
    run('.../companion/deepy.js', files.deepyRender, isMascotPatched, (text) => patchDeepyRenderModule(text));
    run('.../companion/skins.js', files.skins, isMascotPatched, (text) => patchSkinsModule(text));
  }
  run('lib/types/i18n.js', files.i18n, isLangPatched, (text) => patchI18nModule(text));
  return results;
}

/** Restore every file that has a .clawd-backup copy. */
export function revert(installDir) {
  const files = filesOf(installDir);
  const results = [];
  for (const [label, file] of Object.entries(files)) {
    const copy = `${file}${BACKUP_SUFFIX}`;
    if (!fs.existsSync(copy)) {
      results.push({ label, result: 'no backup' });
      continue;
    }
    try {
      atomicWrite(file, fs.readFileSync(copy, 'utf8'));
      fs.rmSync(copy);
      results.push({ label, result: 'restored' });
    } catch (error) {
      results.push({ label, result: `failed (${error.message})` });
    }
  }
  return results;
}

export function hasBackups(installDir) {
  const files = filesOf(installDir);
  return Object.values(files).some((file) => fs.existsSync(`${file}${BACKUP_SUFFIX}`));
}

export function labelOf(file) {
  return path.basename(file);
}
