# dsh-tui-clawd 🦀

Blue **Clawd** (the Claude Code crab) instead of the pixel whale in
[**dsh-TUI**](https://github.com/ccch1mneyyy/dsh-TUI) — the terminal UI for
DeepSeek Harness — plus English UI defaults and a small layout fix for short
terminals.

dsh-TUI reinstalls its `node_modules` on every `/update`, which wipes custom
art. This package re-applies everything with one command.

```
dsh-tui-clawd
```

## What it does

| Patch | Effect |
|---|---|
| `assets/deepy/frames.json` | launch page mascot (20 animations, 198 frames) → crab |
| `lib/types/components/whaleFrames.js` | classic whale splash sprite (22 frames) → crab |
| `lib/types/components/launchpadLayout.js` | on short terminals show the mascot **instead of** the block `DEEPSEEK HARNESS` title |
| `lib/types/components/LogoV2.js` | the launchpad hides the block title when only the mascot fits |
| `~/.dsh-tui/lang.json` | UI language (`en` by default, only written when missing) |

With the layout patch:

| Terminal height | Launch page |
|---|---|
| ≥ 35 rows | crab **and** `DEEPSEEK HARNESS` |
| 23–34 rows | crab only |
| < 23 rows | title only (nothing else fits) |

## Install

```bash
npm install -g dsh-tui-clawd
```

The `postinstall` step patches every detected dsh-TUI installation
(global npm and `~/.dsh/profiles/*`). Then restart the TUI:

```bash
dst          # or: dsh-tui
```

### Without a global install

```bash
npx dsh-tui-clawd
```

### After a dsh-TUI update

TUI updates replace `node_modules`, so run the same command again:

```bash
dsh-tui-clawd
```

## Commands

```bash
dsh-tui-clawd              # install / re-apply (same as `install`)
dsh-tui-clawd status       # what is patched where
dsh-tui-clawd doctor       # list detected dsh-tui installations
dsh-tui-clawd restore      # put the original whale + layout back
```

Flags:

```
--lang <en|zh|keep>   language file to write (default: en, only if missing)
--no-layout           skip the short-terminal layout patch
--dry-run             report what would change, write nothing
--quiet               only errors
--strict              exit 1 when nothing was patched
```

## How it works

- Finds installations at `%APPDATA%\npm\node_modules` (Windows),
  `/usr/local/lib/node_modules` (macOS/Linux), `~/.dsh/profiles/*/node_modules`
  and pnpm global stores. Override with `DSH_TUI_CLAWD_TARGET=/path/to/dsh-tui`.
- Writes a new file and renames it over the old one, because pnpm installations
  are hard links into a content-addressable store — editing in place would
  corrupt the store.
- Keeps the original next to each patched file as `<file>.clawd-backup`, which
  `restore` uses.
- Every patch is idempotent and version-guarded: if a future dsh-TUI changes the
  surrounding code, that file is skipped with a reason instead of being damaged.

## Compatibility

Tested with `@deepseek-harness-tui/dsh-tui` **0.18.0**. After a major dsh-TUI
update run `dsh-tui-clawd status`; `clean` on a file means the automatic patch
did not apply and the package needs an update.

## Credits and rights

- Clawd pixel art: fan recolour of Anthropic's Claude Code mascot, base grid
  recovered by [ClawdMoji](https://github.com/afspies/ClawdMoji) (MIT).
  Anthropic keeps the rights to the character; this package is unofficial.
- dsh-TUI by [ccch1mneyyy](https://github.com/ccch1mneyyy/dsh-TUI) and
  contributors (MIT).
- Package itself: MIT.

---

## По-русски

Краб Clawd вместо кита на стартовом экране dsh-TUI, английский интерфейс и
фикс: в низком окне показывается краб вместо надписи `DEEPSEEK HARNESS`,
в высоком — и краб, и надпись.

```powershell
npm install -g dsh-tui-clawd
dsh-tui-clawd         # применить (после каждого /update в dsh-tui)
dsh-tui-clawd restore # вернуть кита
```

После установки перезапусти `dst`.
