/**
 * Clawd (the Claude Code crab) as a terminal pixel sprite.
 *
 * Base art: 12x8 grid recovered by the ClawdMoji project
 * (https://github.com/afspies/ClawdMoji, MIT) from the Claude Code splash.
 * We only recolour it: `B` = DeepSeek blue #4E6FFF, `K` = #142660 outline/eyes.
 */
import { whaleFrameRows } from './animation.js';

export const ART = [
  '..########..',
  '..#O####O#..',
  '############',
  '############',
  '..########..',
  '..########..',
  '..#.#..#.#..',
  '..#.#..#.#..',
];

export const BODY = 'B';
export const EYE = 'K';

/** Render the crab into a WxH grid of palette letters ('.' = transparent). */
export function crabGrid(W, H, options = {}) {
  const scale = options.scale ?? 3;
  const bodyChar = options.body ?? BODY;
  const eyeChar = options.eye ?? EYE;
  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  const baseX = Math.max(0, Math.floor((W - ART[0].length * scale) / 2));
  const baseY = Math.max(0, Math.floor((H - ART.length * scale) / 2));
  for (let gy = 0; gy < ART.length; gy += 1) {
    for (let gx = 0; gx < ART[gy].length; gx += 1) {
      const ch = ART[gy][gx];
      if (ch === '.') continue;
      const fill = ch === 'O' ? eyeChar : bodyChar;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = baseX + gx * scale + dx;
          const y = baseY + gy * scale + dy;
          if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = fill;
        }
      }
    }
  }
  return grid.map((row) => row.join(''));
}

/** Original deepy frames always contain this run; the crab art never does. */
const DEEPY_WHALE_MARKER = 'KBBBBKKBBBB';
/** Original whaleFrames art always contains this run; the crab art never does. */
const WHALE_ART_MARKER = 'DBBBBDDBBBBD';

export function isDeepyPatched(rawText) {
  return !rawText.includes(DEEPY_WHALE_MARKER);
}

export function isWhaleFramesPatched(rawText) {
  return rawText.includes('clawd-patch:v2');
}

/** Rewrite every deepy frame (42x30) with the crab. Returns a new JSON string. */
export function patchDeepyJson(rawText) {
  const data = JSON.parse(rawText);
  const size = data.size;
  if (!Array.isArray(size) || size.length !== 2) throw new Error('deepy frames: unexpected size');
  const [W, H] = size;
  const rows = crabGrid(W, H, { scale: 3 });
  let frames = 0;
  for (const animation of data.animations ?? []) {
    for (const frame of animation.frames ?? []) {
      frame.rows = rows.slice();
      frames += 1;
    }
  }
  if (frames === 0) throw new Error('deepy frames: no frames found');
  return JSON.stringify(data);
}

/**
 * Rewrite `whaleFrames.js`: keep the file's header, the frame names and the
 * trailing exports (`WHALE_FRAME_INDEX`, `OPENING_SEQUENCES`, ...), replace
 * only the rows with the crab (40x25).
 */
export function patchWhaleFramesSource(src) {
  const startMarker = 'export const WHALE_FRAMES = [';
  const start = src.indexOf(startMarker);
  const endMarker = '\n];\n';
  const end = src.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('whaleFrames: frame array not found');
  const prefix = src.slice(0, start);
  const suffix = src.slice(end + endMarker.length);
  const names = [...src.slice(start, end).matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
  if (names.length === 0) throw new Error('whaleFrames: no frame names');
  const body = names
    .map((name) => {
      const rows = whaleFrameRows(name);
      return `    {\n        name: '${name}',\n        rows: [\n${rows
        .map((row) => `            '${row}',`)
        .join('\n')}\n        ],\n    },`;
    })
    .join('\n');
  return `/* clawd-patch:v2 — sprite replaced by dsh-tui-clawd */\n${prefix}${startMarker}\n${body}\n];\n${suffix}`;
}

/* ------------------------------------------------------------------ layout */

const LAYOUT_STAGE_OLD = `    const dropArt = (stage === 'no-art' || stage === 'input-only') && withArt > 0;
    const heroRowsFinal = dropArt ? titleRows : heroRows;`;

const LAYOUT_STAGE_NEW = `    let dropArt = (stage === 'no-art' || stage === 'input-only') && withArt > 0;
    // clawd-patch:v1 — on short terminals show the mascot instead of the block title
    let artOnly = false;
    if (dropArt && showWhale) {
        const artOnlyRows = withArt + HERO_TO_CARD_GAP_TIGHT + cardRows + paramRows + cornersBlockRows;
        if (artOnlyRows <= rows) {
            artOnly = true;
            dropArt = false;
        }
    }
    const heroRowsFinal = artOnly ? withArt : dropArt ? titleRows : heroRows;`;

const LAYOUT_RETURN_OLD = `    return {
        stage,`;
const LAYOUT_RETURN_NEW = `    return {
        stage: artOnly ? 'art-only' : stage,`;

const LAYOUT_BIG_OLD = `        showBigTitle,`;
const LAYOUT_BIG_NEW = `        showBigTitle: artOnly ? false : showBigTitle,`;

const LAYOUT_PLAIN_OLD = `        showPlainTitle: showBigTitle ? false : showPlainTitle || dropArt,`;
const LAYOUT_PLAIN_NEW = `        showPlainTitle: artOnly ? false : showBigTitle ? false : showPlainTitle || dropArt,`;

export function isLayoutPatched(src) {
  return src.includes('clawd-patch');
}

export function patchLaunchpadLayout(src) {
  const swaps = [
    [LAYOUT_STAGE_OLD, LAYOUT_STAGE_NEW],
    [LAYOUT_RETURN_OLD, LAYOUT_RETURN_NEW],
    [LAYOUT_BIG_OLD, LAYOUT_BIG_NEW],
    [LAYOUT_PLAIN_OLD, LAYOUT_PLAIN_NEW],
  ];
  let out = src;
  for (const [from, to] of swaps) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`launchpadLayout: expected 1 match, found ${count}`);
    out = out.replace(from, to);
  }
  return out;
}

/* -------------------------------------------------------------------- logo */

const LOGO_SIZE_OLD = `    const { columns } = useTerminalSize();`;
const LOGO_SIZE_NEW = `    const { columns, rows: termRows } = useTerminalSize();`;

const LOGO_SPLASH_OLD = `    const splash = resolveSplashLayout(columns, { whale, font: titleFont });`;
const LOGO_SPLASH_NEW = `    let splash = resolveSplashLayout(columns, { whale, font: titleFont });
    // clawd-patch:v1 — a short launchpad keeps the mascot and drops the block title
    if (chrome === 'minimal' && whale && columns >= WHALE_BOX_WIDTH && splash.showWhale && termRows < 34) {
        splash = { showWhale: true, showBigTitle: false, showPlainTitle: false };
    }`;

export function isLogoPatched(src) {
  return src.includes('clawd-patch');
}

export function patchLogoV2(src) {
  const swaps = [
    [LOGO_SIZE_OLD, LOGO_SIZE_NEW],
    [LOGO_SPLASH_OLD, LOGO_SPLASH_NEW],
  ];
  let out = src;
  for (const [from, to] of swaps) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`LogoV2: expected 1 match, found ${count}`);
    out = out.replace(from, to);
  }
  return out;
}
