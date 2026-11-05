/**
 * State feed for the desktop pet.
 *
 * dsh-TUI's activity line renders on every frame while a turn is in flight.
 * This patch only *observes* it: the phase and the line are written to
 * `~/.dsh-tui/clawd-state.json` (throttled to 400 ms), and the pet window polls
 * that file to pick its animation. Nothing about the line's look changes.
 */

const MARK = 'clawd-statefeed-patch:v1';

const MARKER = 'children: [';
const RETURN_PREFIX = 'return (_jsxs(Text, { wrap: "truncate", children: [';
const RETURN_PATCHED = 'return (_jsxs(Text, { wrap: "truncate", children: [clawdStateNode(activity.phase, activity.line), ';

const HELPER = `
/* ${MARK} */
function clawdStateNode(phase, line) {
    try {
        const now = Date.now();
        if (!globalThis.__clawdStateAt || now - globalThis.__clawdStateAt > 400) {
            globalThis.__clawdStateAt = now;
            const fs = process.getBuiltinModule('node:fs');
            const nodePath = process.getBuiltinModule('node:path');
            const home = process.env.USERPROFILE || process.env.HOME || '.';
            const dir = nodePath.join(home, '.dsh-tui');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(nodePath.join(dir, 'clawd-state.json'), JSON.stringify({ phase: phase ?? '', line: String(line ?? '').slice(0, 120), ts: now }));
        }
    }
    catch { }
    return null;
}
`;

export function isStateFeedPatched(src) {
  return src.includes(MARK);
}

export function patchStateFeed(src) {
  const count = src.split(RETURN_PREFIX).length - 1;
  if (count !== 1) throw new Error(`ActivityLine: expected 1 return, found ${count}`);
  let out = src.replace(RETURN_PREFIX, RETURN_PATCHED);
  return `${out}${HELPER}`;
}
