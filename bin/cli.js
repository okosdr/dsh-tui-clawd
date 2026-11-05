#!/usr/bin/env node
/**
 * dsh-tui-clawd — blue Clawd mascot + English UI for dsh-TUI.
 *
 *   dsh-tui-clawd                 install / re-apply (default)
 *   dsh-tui-clawd install [...]   same, with flags
 *   dsh-tui-clawd restore         put the original whale frames and layout back
 *   dsh-tui-clawd status          show what is patched where
 *   dsh-tui-clawd doctor          list detected dsh-tui installations
 *
 * Flags: --lang <en|zh|keep>  (default: en, only written when the file is
 *        missing), --no-layout, --dry-run, --quiet, --strict
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findDshTuiInstalls } from '../lib/targets.js';
import { apply, inspect, revert } from '../lib/patches.js';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const command = argv.find((a) => !a.startsWith('--')) ?? 'install';
const langFlag = (() => {
  const i = argv.indexOf('--lang');
  return i >= 0 ? argv[i + 1] : undefined;
})();
const quiet = flags.has('--quiet');
const strict = flags.has('--strict');

const say = (...lines) => {
  if (!quiet) console.log(...lines);
};

function langPath() {
  return path.join(os.homedir(), '.dsh-tui', 'lang.json');
}

function ensureLanguage() {
  const lang = langFlag ?? 'en';
  if (lang === 'keep') return 'language: kept (not sealed)';
  const dir = path.join(os.homedir(), '.dsh-tui');
  try {
    fs.mkdirSync(dir, { recursive: true });
    // 1. persisted /lang choice
    fs.writeFileSync(path.join(dir, 'lang.json'), `${JSON.stringify({ lang }, null, 2)}\n`, 'utf8');
    // 2. hard seal: the patched i18n.js reads this file and refuses to switch
    fs.writeFileSync(path.join(dir, 'lang.lock'), `${lang}\n`, 'utf8');
    // 3. keep the /settings document in sync
    const settingsFile = path.join(dir, 'settings.json');
    let settings = { version: 1, values: {}, imported: { from: 'none', at: 0 } };
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {
      /* fresh or unreadable document: start from the default shape */
    }
    if (settings === null || typeof settings !== 'object') settings = { version: 1, values: {} };
    if (settings.values === null || typeof settings.values !== 'object') settings.values = {};
    settings.values.lang = lang;
    fs.writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    return `language: ${lang} (sealed)`;
  } catch (error) {
    return `language: failed (${error.message})`;
  }
}

/** PID of the last launched dsh-tui if that process is still alive. */
function runningTuiPid() {
  try {
    const file = path.join(os.homedir(), '.dsh-tui', 'last-run.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pid = data && data.pid;
    if (!pid) return undefined;
    process.kill(pid, 0);
    return pid;
  } catch {
    return undefined;
  }
}

function warnIfRunning() {
  const pid = runningTuiPid();
  if (pid !== undefined) {
    say(`\n⚠  dsh-tui is STILL RUNNING (pid ${pid}). Patches only apply to a new process —`);
    say('   close the TUI window (or `Stop-Process -Id ' + pid + ' -Force`) and run `dst` again.');
  }
}

function main() {
  const installs = findDshTuiInstalls();

  if (command === 'help' || flags.has('--help')) {
    console.log(`dsh-tui-clawd ${process.env.npm_package_version ?? ''}
Blue Clawd mascot + English UI for dsh-TUI.

Commands:
  install (default)   patch every detected dsh-tui installation
  restore             restore the original files from *.clawd-backup
  status              show patched/clean state per installation
  doctor              list detected installations

Flags:
  --lang <en|zh|keep> language file (default en; only written if missing)
  --no-layout         skip the short-terminal layout patch
  --no-mascot         skip theme colour / auto-scaling patches
  --no-inline         keep the rotating spinner glyph (skip the working crab)
  --dry-run           report what would change
  --quiet             only errors
  --strict            exit 1 when nothing was patched`);
    return 0;
  }

  if (command === 'doctor' || command === 'status') {
    if (installs.length === 0) {
      console.log('No @deepseek-harness-tui/dsh-tui installation found.');
      return strict ? 1 : 0;
    }
    for (const dir of installs) {
      console.log(`\n${dir}`);
      if (command === 'doctor') {
        console.log('  detected');
        continue;
      }
      for (const row of inspect(dir)) console.log(`  ${row.state.padEnd(10)} ${row.label}`);
    }
    return 0;
  }

  if (command === 'restore') {
    if (installs.length === 0) {
      console.log('No dsh-tui installation found — nothing to restore.');
      return strict ? 1 : 0;
    }
    for (const dir of installs) {
      say(`\n${dir}`);
      for (const row of revert(dir)) say(`  ${row.result.padEnd(10)} ${row.label}`);
    }
    say('\nDone. Restart dsh-tui (`dst`) to see the original whale again.');
    warnIfRunning();
    return 0;
  }

  if (command === 'sets') {
    const dir = path.join(os.homedir(), '.dsh-tui', 'crab');
    if (!fs.existsSync(dir)) {
      console.log(`No crab frames yet: ${dir}`);
      return 0;
    }
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isDirectory()) continue;
      const frames = fs.readdirSync(full).filter((file) => file.endsWith('.png')).length;
      console.log(`  ${name.padEnd(16)} ${String(frames).padStart(2)} frames`);
    }
    return 0;
  }

  if (command === 'pose') {
    const name = argv[1];
    const seconds = Number(argv[2] ?? 10);
    if (!name) {
      console.log('usage: dsh-tui-clawd pose <set> [seconds]');
      return 1;
    }
    const dir = path.join(os.homedir(), '.dsh-tui');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'clawd-force.json'),
      JSON.stringify({ set: name, until: Date.now() + seconds * 1000 }),
      'utf8',
    );
    console.log(`pose ${name} for ${seconds}s`);
    return 0;
  }

  if (command === 'state') {
    const dir = path.join(os.homedir(), '.dsh-tui');
    for (const file of ['clawd-state.json', 'clawd-tool.json', 'clawd-music.json', 'clawd-force.json']) {
      const full = path.join(dir, file);
      console.log(`${file.padEnd(20)} ${fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '(missing)'}`);
    }
    return 0;
  }

  if (command === 'map') {
    const rows = [
      ['reading', 'pwsh: Get-Content, cat, type, Get-ChildItem, ls, dir, Test-Path, Get-Item', 'read'],
      ['search', 'pwsh: Select-String, findstr, rg, grep', 'grep, glob, web_search'],
      ['ide-connected', 'pwsh: Set-Content, Out-File, Add-Content, apply_patch, New-Item, Remove-Item, Copy-Item, >>, tee', 'edit, write, multiedit'],
      ['bash', 'pwsh: everything else', 'bash, powershell, pwsh'],
      ['browser', 'when a web page is opened', 'web_fetch, fetch, browser'],
      ['git', 'git commands', 'git*'],
      ['tests-pass', 'test runs', '*test*'],
      ['build', 'builds', '*build*'],
      ['debug', 'debugger work', '*debug*'],
      ['todo-list', 'task lists', '*todo*'],
      ['database', 'SQL work', '*database*, *sql*'],
      ['download', 'downloads', '*download*'],
      ['memory-write', 'memory writes', '*memory*'],
      ['docs-read', 'doc reading', '*doc*'],
      ['ask', 'the question panel is open', 'question line in the activity state'],
      ['permission', 'approval prompt', 'permission, approval'],
      ['thinking-aloud', 'subagents', 'subagent, task, job, workflow'],
      ['thinking', 'model is reasoning (no tool yet)', '-'],
      ['dj', 'Windows media session is playing (GSMTC)', 'any player: Liner, Spotify, Yandex, AIMP, browser'],
      ['celebrate', 'one continuous run over 5 minutes', '-'],
      ['idle', 'default rest pose (95%)', '-'],
      ['idle-coffee / idle-book / idle-juggle / idle-yawn / idle-look', 'calm idle picked once per rest (5%)', '-'],
      ['idle-doze', 'no activity for 3 minutes', '-'],
    ];
    const w = Math.max(...rows.map((r) => r[0].length));
    const w2 = Math.max(...rows.map((r) => r[1].length));
    console.log(`${'ANIMATION'.padEnd(w)}  ${'WHEN IT PLAYS'.padEnd(w2)}  TOOLS / TRIGGERS`);
    console.log(`${'-'.repeat(w)}  ${'-'.repeat(w2)}  ${'-'.repeat(20)}`);
    for (const [name, when, tools] of rows) console.log(`${name.padEnd(w)}  ${when.padEnd(w2)}  ${tools}`);
    return 0;
  }

  if (command !== 'install') {
    console.error(`Unknown command: ${command} (try --help)`);
    return 2;
  }

  if (installs.length === 0) {
    say('No @deepseek-harness-tui/dsh-tui installation found — install dsh-tui first.');
    say('  npm install -g @deepseek-ai/dsh @deepseek-harness-tui/dsh-tui');
    return strict ? 1 : 0;
  }

  let changed = 0;
  for (const dir of installs) {
    say(`\n${dir}`);
    for (const row of apply(dir, { layout: !flags.has('--no-layout'), mascot: !flags.has('--no-mascot'), inline: !flags.has('--no-inline'), dryRun: flags.has('--dry-run') })) {
      say(`  ${row.result.padEnd(15)} ${row.label}`);
      if (row.result === 'patched' || row.result === 'would patch') changed += 1;
    }
  }
  say(`\n${ensureLanguage()}`);
  say(changed > 0 ? 'Restart dsh-tui (`dst`) to apply.' : 'Already up to date.');
  warnIfRunning();
  if (flags.has('--dry-run')) say('(dry run: nothing was written)');
  return strict && changed === 0 && !flags.has('--dry-run') ? 1 : 0;
}

process.exitCode = main();
