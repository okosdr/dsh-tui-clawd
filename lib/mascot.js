/**
 * Theme-aware, size-aware mascot rendering.
 *
 * Two extra patches on top of the static crab frames:
 *  - `deepy.js`: the sprite is generated per render at the requested scale and
 *    palette, instead of being served from the pre-rendered 3x frames cache;
 *  - `skins.js`: `DeepySkin.render` asks for scale (terminal size) and body
 *    colour (active theme accent; `auto` keeps the DeepSeek blue).
 */

const DEEPY_MARK = 'clawd-theme-patch:v1';

const RENDER_OLD = `    const cacheKey = kit.id + ':' + key;
    let rendered = renderedCache.get(cacheKey);
    if (rendered === undefined) {
        rendered = Object.freeze(animation.frames.map(frame => renderSpriteRows(frame.rows, kit.palette)));
        renderedCache.set(cacheKey, rendered);
    }`;

const RENDER_NEW = `    const cacheKey = kit.id + ':' + key + (clawd ? ':' + clawd.scale + ':' + clawd.body.join(',') : '');
    let rendered = renderedCache.get(cacheKey);
    if (rendered === undefined) {
        const palette = clawd ? Object.assign({}, kit.palette, { B: clawd.body, K: clawd.eye }) : kit.palette;
        const scaledRows = clawd ? clawdSpriteRows(clawd.scale) : undefined;
        rendered = Object.freeze(animation.frames.map(frame => renderSpriteRows(scaledRows !== undefined ? scaledRows : frame.rows, palette)));
        renderedCache.set(cacheKey, rendered);
    }`;

const DEEPY_SIG_OLD = 'export function renderedDeepyAnimation(kit, key) {';
const DEEPY_SIG_NEW = 'export function renderedDeepyAnimation(kit, key, clawd) {';

const DEEPY_APPEND = `
/* ${DEEPY_MARK} */
export const CLAWD_ART = [
    '..########..',
    '..#O####O#..',
    '############',
    '############',
    '..########..',
    '..########..',
    '..#.#..#.#..',
    '..#.#..#.#..',
];
/** Crab sprite in the deepy 42x30 canvas at the requested pixel scale. */
export function clawdSpriteRows(scale) {
    const W = 42;
    const H = 30;
    const grid = [];
    for (let y = 0; y < H; y += 1) grid.push(new Array(W).fill('.'));
    const sx = Math.max(0, Math.floor((W - CLAWD_ART[0].length * scale) / 2));
    const sy = Math.max(0, Math.floor((H - CLAWD_ART.length * scale) / 2));
    for (let gy = 0; gy < CLAWD_ART.length; gy += 1) {
        for (let gx = 0; gx < CLAWD_ART[gy].length; gx += 1) {
            const ch = CLAWD_ART[gy][gx];
            if (ch === '.') continue;
            const fill = ch === 'O' ? 'K' : 'B';
            for (let dy = 0; dy < scale; dy += 1) {
                for (let dx = 0; dx < scale; dx += 1) {
                    const x = sx + gx * scale + dx;
                    const y = sy + gy * scale + dy;
                    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = fill;
                }
            }
        }
    }
    return grid.map((row) => row.join(''));
}
`;

const SKINS_IMPORT_AFTER = `import { Box, Text, Image, useTerminalImages, useTerminalImageProtocol, useTerminalImageCellSize } from '../../../ui.js';`;
const SKINS_IMPORT_ADD = `${SKINS_IMPORT_AFTER}
import { getActiveTheme, getActiveThemeName } from '../../../theme.js';`;

const SKINS_CALL_OLD = `        const rendered = renderedDeepyAnimation(kit, animationKey);`;
const SKINS_CALL_NEW = `        const rendered = renderedDeepyAnimation(kit, animationKey, __clawdRenderOptions());`;

const SKINS_APPEND = `
/* ${DEEPY_MARK} */
/**
 * Scale follows the terminal with hysteresis: 3x on a comfortably large
 * window, 2x below it. Driving the boundary directly made the sprite flip
 * between scales on consecutive resize frames (visible jitter, and the box
 * re-layout that looked like horizontal stretching).
 * Body colour follows the active theme's accent; the auto theme keeps the
 * DeepSeek blue so the crab stays "brand" by default.
 */
let __clawdScale = 3;
export function __clawdRenderOptions() {
    const cols = (typeof process !== 'undefined' && process.stdout && process.stdout.columns) || 120;
    const rows = (typeof process !== 'undefined' && process.stdout && process.stdout.rows) || 40;
    if (__clawdScale === 3 && (cols < 96 || rows < 28)) { __clawdScale = 2; }
    else if (__clawdScale !== 3 && cols >= 110 && rows >= 34) { __clawdScale = 3; }
    // Never draw wider than the terminal can show: 12 cells per pixel step.
    const maxByWidth = Math.max(1, Math.floor(Math.max(12, cols - 2) / 12));
    const scale = Math.max(1, Math.min(__clawdScale, maxByWidth));
    const name = getActiveThemeName();
    const theme = getActiveTheme();
    const fallback = [78, 111, 255];
    let body = fallback;
    if (name && name !== 'auto' && theme) {
        const parsed = __clawdParseRgb(theme.accent || theme.activity || theme.primary);
        if (parsed !== undefined) body = parsed;
    }
    const eye = [Math.round(body[0] * 0.28), Math.round(body[1] * 0.28), Math.round(body[2] * 0.28)];
    // One line per process: proves whether the patched skin is actually used.
    try {
        if (!globalThis.__clawdRenderLogged) {
            globalThis.__clawdRenderLogged = true;
            const fs = process.getBuiltinModule('node:fs');
            const nodePath = process.getBuiltinModule('node:path');
            const home = process.env.USERPROFILE || process.env.HOME || '.';
            fs.appendFileSync(nodePath.join(home, '.dsh-tui', 'clawd-render.log'), new Date().toISOString() + ' deepy-skin pid=' + process.pid + ' cols=' + cols + ' rows=' + rows + ' scale=' + scale + ' theme=' + name + '\n');
        }
    }
    catch { /* logging is best-effort */ }
    return { scale, body, eye };
}
function __clawdParseRgb(value) {
    if (typeof value !== 'string') return undefined;
    const match = /^rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)$/.exec(value.trim());
    if (match === null) return undefined;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}
`;

export function isMascotPatched(src) {
  return src.includes(DEEPY_MARK);
}

const LOGO_ACTIVE_OLD = 'active: !whaleFrozen && whaleIdle';
const LOGO_ACTIVE_NEW = 'active: true /* clawd-always-animate */';

export function isLogoActivePatched(src) {
  return src.includes('clawd-always-animate');
}

/** Keep the splash mascot ticking after the intro settles (upstream freezes it). */
export function patchLogoActive(src) {
  const count = src.split(LOGO_ACTIVE_OLD).length - 1;
  if (count !== 1) throw new Error(`LogoV2: expected 1 active match, found ${count}`);
  return src.replace(LOGO_ACTIVE_OLD, LOGO_ACTIVE_NEW);
}

const SIDEPANEL_OLD = 'const sidePanelOpenStore = createLiveSetting(false, value => normalizeBoolean(value, false));';
const SIDEPANEL_NEW = 'const sidePanelOpenStore = createLiveSetting(true, value => normalizeBoolean(value, true)); /* clawd-sidepanel-open */';

export function isSidePanelPatched(src) {
  return src.includes('clawd-sidepanel-open');
}

/** Open the side panel by default so the companion crab is visible. */
export function patchSidePanelDefault(src) {
  const count = src.split(SIDEPANEL_OLD).length - 1;
  if (count !== 1) throw new Error(`tuiDisplayPrefs: expected 1 sidePanelOpen match, found ${count}`);
  return src.replace(SIDEPANEL_OLD, SIDEPANEL_NEW);
}

export function patchDeepyRenderModule(src) {
  const swaps = [
    [DEEPY_SIG_OLD, DEEPY_SIG_NEW],
    [RENDER_OLD, RENDER_NEW],
  ];
  let out = src;
  for (const [from, to] of swaps) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`deepy.js: expected 1 match, found ${count}`);
    out = out.replace(from, to);
  }
  return `${out}${DEEPY_APPEND}`;
}

export function patchSkinsModule(src) {
  const swaps = [
    [SKINS_IMPORT_AFTER, SKINS_IMPORT_ADD],
    [SKINS_CALL_OLD, SKINS_CALL_NEW],
  ];
  let out = src;
  for (const [from, to] of swaps) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`skins.js: expected 1 match, found ${count}`);
    out = out.replace(from, to);
  }
  return `${out}${SKINS_APPEND}`;
}
