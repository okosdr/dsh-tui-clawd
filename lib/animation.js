/**
 * Animated Clawd frames for dsh-TUI's companion.
 *
 * dsh-TUI already drives 20 animation states (typing while tools run,
 * thinking, sleeping, happy, ...) from `assets/deepy/frames.json`: each frame
 * is a 42x30 grid of palette letters plus a duration. We generate the crab per
 * frame with controllable legs, body bob and eyes, so the mascot walks in place,
 * crouches, blinks and squints exactly when the harness reports that state.
 *
 * This replaces the earlier static "same crab in every frame" patch.
 */

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

const W = 42;
const H = 30;
const S = 3;
const OX = 3;
const OY = 3;
const LEGS = [2, 4, 7, 9];

function drawEye(grid, x, y, state) {
  const put = (dx, dy, ch) => {
    const X = x + dx;
    const Y = y + dy;
    if (X >= 0 && X < W && Y >= 0 && Y < H) grid[Y][X] = ch;
  };
  for (let dy = 0; dy < S; dy += 1) for (let dx = 0; dx < S; dx += 1) put(dx, dy, 'B');
  switch (state) {
    case 'open':
      for (let dy = 0; dy < S; dy += 1) for (let dx = 0; dx < S; dx += 1) put(dx, dy, 'K');
      break;
    case 'blink':
      put(0, 1, 'K'); put(1, 1, 'K'); put(2, 1, 'K');
      break;
    case 'squint':
      put(0, 2, 'K'); put(1, 2, 'K'); put(2, 2, 'K');
      break;
    case 'happy':
      put(0, 2, 'K'); put(1, 1, 'K'); put(2, 2, 'K');
      break;
    case 'closed':
      put(0, 2, 'K'); put(1, 2, 'K'); put(2, 2, 'K');
      break;
    case 'error':
      put(0, 0, 'K'); put(2, 0, 'K'); put(1, 1, 'K'); put(0, 2, 'K'); put(2, 2, 'K');
      break;
    case 'wide':
      for (let dy = 0; dy < S; dy += 1) for (let dx = 0; dx < S; dx += 1) put(dx, dy, 'K');
      put(1, 1, 'B');
      break;
    default:
      for (let dy = 0; dy < S; dy += 1) for (let dx = 0; dx < S; dx += 1) put(dx, dy, 'K');
  }
}

/** One 42x30 crab frame. */
export function crabFrame(options = {}) {
  const bodyDy = options.bodyDy ?? 0;
  const legDy = options.legDy ?? [0, 0, 0, 0];
  const eyes = options.eyes ?? 'open';
  const eyeDx = options.eyeDx ?? 0;
  const eyeDy = options.eyeDy ?? 0;

  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  const block = (x, y) => {
    for (let dy = 0; dy < S; dy += 1) {
      for (let dx = 0; dx < S; dx += 1) {
        const X = x + dx;
        const Y = y + dy;
        if (X >= 0 && X < W && Y >= 0 && Y < H) grid[Y][X] = 'B';
      }
    }
  };

  for (let gy = 0; gy < ART.length; gy += 1) {
    for (let gx = 0; gx < ART[gy].length; gx += 1) {
      if (ART[gy][gx] === '.') continue;
      const x = OX + gx * S;
      if (gy >= 6) {
        const index = LEGS.indexOf(gx);
        block(x, OY + gy * S + (index >= 0 ? legDy[index] ?? 0 : 0));
      } else {
        block(x, OY + gy * S + bodyDy);
      }
    }
  }

  for (const [gx, gy] of [[3, 1], [8, 1]]) {
    drawEye(grid, OX + gx * S + eyeDx, OY + gy * S + bodyDy + eyeDy, eyes);
  }
  return grid.map((row) => row.join(''));
}

const f = (dur, options = {}) => ({ dur, options });
const legs = (a, b = a, c = a, d = a) => [a, b, c, d];

/** Frame scripts per dsh-TUI animation key. */
export const ANIMATIONS = {
  idle: [
    f(320, { bodyDy: 0, legDy: legs(0), eyes: 'open' }),
    f(320, { bodyDy: 2, legDy: legs(0, 0, 3, 3), eyes: 'open' }),
    f(320, { bodyDy: 0, legDy: legs(3, 3, 0, 0), eyes: 'open' }),
    f(320, { bodyDy: 2, legDy: legs(3, 3, 3, 3), eyes: 'open' }),
    f(200, { bodyDy: 0, legDy: legs(0), eyes: 'blink' }),
    f(320, { bodyDy: 0, legDy: legs(0), eyes: 'open' }),
  ],
  'idle-look': [
    f(420, { eyes: 'open', eyeDx: -1 }),
    f(420, { eyes: 'open', eyeDx: 0 }),
    f(420, { eyes: 'open', eyeDx: 1 }),
    f(420, { eyes: 'open', eyeDx: 0 }),
  ],
  'idle-spout': [
    f(260, { bodyDy: 2, eyes: 'open' }),
    f(200, { bodyDy: -2, eyes: 'happy' }),
    f(260, { bodyDy: 0, eyes: 'open' }),
    f(200, { bodyDy: 0, eyes: 'blink' }),
  ],
  thinking: [
    f(360, { eyes: 'open', eyeDy: -1, legDy: legs(0, 0, 3, 0) }),
    f(360, { eyes: 'squint', eyeDy: -1, legDy: legs(3, 0, 0, 3) }),
    f(360, { eyes: 'open', eyeDy: -1, legDy: legs(0, 0, 3, 0) }),
    f(360, { eyes: 'open', eyeDy: -1, legDy: legs(0, 3, 0, 3) }),
  ],
  typing: [
    f(120, { bodyDy: 1, legDy: legs(0, 3, 0, 3), eyes: 'squint' }),
    f(120, { bodyDy: 1, legDy: legs(3, 0, 3, 0), eyes: 'squint' }),
    f(120, { bodyDy: 2, legDy: legs(0, 3, 0, 3), eyes: 'open' }),
    f(120, { bodyDy: 1, legDy: legs(3, 0, 3, 0), eyes: 'squint' }),
  ],
  music: [
    f(180, { bodyDy: 0, legDy: legs(0, 3, 3, 0), eyes: 'happy' }),
    f(180, { bodyDy: 2, legDy: legs(3, 0, 0, 3), eyes: 'happy' }),
    f(180, { bodyDy: 0, legDy: legs(0, 3, 3, 0), eyes: 'open' }),
    f(180, { bodyDy: 2, legDy: legs(3, 0, 0, 3), eyes: 'open' }),
  ],
  conducting: [
    f(200, { bodyDy: 0, legDy: legs(0), eyes: 'open' }),
    f(200, { bodyDy: 3, legDy: legs(0), eyes: 'squint' }),
    f(200, { bodyDy: 0, legDy: legs(3), eyes: 'open' }),
  ],
  building: [
    f(100, { bodyDy: 1, legDy: legs(0, 3, 0, 3), eyes: 'squint' }),
    f(100, { bodyDy: 2, legDy: legs(3, 0, 3, 0), eyes: 'squint' }),
    f(100, { bodyDy: 1, legDy: legs(0, 3, 0, 3), eyes: 'open' }),
  ],
  error: [
    f(300, { bodyDy: 2, legDy: legs(0), eyes: 'error' }),
    f(200, { bodyDy: 0, legDy: legs(0), eyes: 'error' }),
    f(300, { bodyDy: 2, legDy: legs(0), eyes: 'squint' }),
  ],
  happy: [
    f(180, { bodyDy: 0, legDy: legs(0), eyes: 'happy' }),
    f(160, { bodyDy: -3, legDy: legs(0), eyes: 'happy' }),
    f(180, { bodyDy: 0, legDy: legs(0), eyes: 'open' }),
    f(160, { bodyDy: -2, legDy: legs(0), eyes: 'happy' }),
  ],
  notification: [
    f(220, { bodyDy: -2, legDy: legs(0), eyes: 'wide' }),
    f(220, { bodyDy: 0, legDy: legs(0), eyes: 'open' }),
    f(220, { bodyDy: -2, legDy: legs(0), eyes: 'wide' }),
  ],
  compacting: [
    f(300, { bodyDy: 3, legDy: legs(0), eyes: 'squint' }),
    f(300, { bodyDy: 1, legDy: legs(0), eyes: 'squint' }),
    f(300, { bodyDy: 3, legDy: legs(0), eyes: 'closed' }),
  ],
  carrying: [
    f(240, { bodyDy: 0, legDy: legs(0, 3, 0, 3), eyes: 'open' }),
    f(240, { bodyDy: 2, legDy: legs(3, 0, 3, 0), eyes: 'open' }),
    f(240, { bodyDy: 0, legDy: legs(0, 3, 0, 3), eyes: 'blink' }),
  ],
  sleeping: [
    f(700, { bodyDy: 3, legDy: legs(0), eyes: 'closed' }),
    f(700, { bodyDy: 2, legDy: legs(0), eyes: 'closed' }),
    f(700, { bodyDy: 3, legDy: legs(0), eyes: 'closed' }),
    f(900, { bodyDy: 3, legDy: legs(0), eyes: 'squint' }),
  ],
  waking: [
    f(180, { bodyDy: 3, eyes: 'closed' }),
    f(180, { bodyDy: 1, eyes: 'squint' }),
    f(220, { bodyDy: 0, eyes: 'open' }),
    f(180, { bodyDy: 0, eyes: 'blink' }),
  ],
  'poke-left': [
    f(220, { bodyDy: 1, eyes: 'open', eyeDx: -1 }),
    f(220, { bodyDy: 0, eyes: 'happy', eyeDx: -1 }),
  ],
  'poke-right': [
    f(220, { bodyDy: 1, eyes: 'open', eyeDx: 1 }),
    f(220, { bodyDy: 0, eyes: 'happy', eyeDx: 1 }),
  ],
  tickle: [
    f(120, { bodyDy: -2, legDy: legs(0, 3, 0, 3), eyes: 'happy' }),
    f(120, { bodyDy: 0, legDy: legs(3, 0, 3, 0), eyes: 'happy' }),
    f(120, { bodyDy: -1, legDy: legs(0, 3, 0, 3), eyes: 'happy' }),
    f(120, { bodyDy: 1, legDy: legs(3, 0, 3, 0), eyes: 'happy' }),
  ],
  drag: [
    f(200, { bodyDy: -1, legDy: legs(3, 3, 3, 3), eyes: 'wide' }),
    f(200, { bodyDy: 0, legDy: legs(0, 3, 3, 0), eyes: 'wide' }),
    f(200, { bodyDy: -1, legDy: legs(3, 0, 0, 3), eyes: 'wide' }),
  ],
  swim: [
    f(180, { bodyDy: 0, legDy: legs(0, 3, 3, 0), eyes: 'open' }),
    f(180, { bodyDy: 2, legDy: legs(3, 0, 0, 3), eyes: 'open' }),
    f(180, { bodyDy: 0, legDy: legs(0, 3, 3, 0), eyes: 'blink' }),
  ],
};

export const ANIMATION_VERSION = 3;

/**
 * Rewrite every deepy animation with generated crab frames, preserving the
 * file's metadata (size, palette, key/title/state/trigger) and durations of
 * animations we do not script explicitly (they fall back to `idle`).
 */
export function buildAnimatedDeepyJson(rawText) {
  const data = JSON.parse(rawText);
  const size = data.size;
  if (!Array.isArray(size) || size.length !== 2) throw new Error('deepy frames: unexpected size');
  let frames = 0;
  for (const animation of data.animations ?? []) {
    const script = ANIMATIONS[animation.key] ?? ANIMATIONS.idle;
    animation.frames = script.map((frame) => ({ dur: frame.dur, rows: crabFrame(frame.options) }));
    frames += animation.frames.length;
  }
  if (frames === 0) throw new Error('deepy frames: no frames found');
  data.clawdAnim = ANIMATION_VERSION;
  return JSON.stringify(data);
}

export function isAnimatedDeepy(rawText) {
  return rawText.includes(`"clawdAnim":${ANIMATION_VERSION}`);
}
