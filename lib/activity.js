/**
 * Bottom "Working…" line → crab.
 *
 * The line between the transcript and the prompt is `ActivityLine`: it renders
 * a frame from `activityFrames` (the rotating dot the user calls "the moon"),
 * a shimmering activity text and the token suffix. This patch removes the
 * rotating frame and draws a small crab above the line instead, so the mascot
 * sits exactly where the work is shown.
 */

const MARK = 'clawd-activity-patch:v1';

const IMPORT_AFTER = "import { parseRGB } from './Spinner/spinnerUtils.js';";
const IMPORT_ADD = `${IMPORT_AFTER}
import Box from '../ink/components/Box.js';`;

const RETURN_PREFIX = 'return (_jsxs(Text, { wrap: "truncate", children: [';
const FRAME_CLAUSE = "activity.phase !== 'done' && (_jsxs(Text, { color: color, children: [frame, \" \"] })), ";

const HELPER = `
/* ${MARK} — crab above the activity line, no rotating frame */
function clawdActivityCrab(time) {
    const step = Math.floor(time / 140) % 2 === 0;
    const art = [
        '..########..',
        '..#.####.#..',
        '############',
        '..########..',
        step ? '..#.#..#.#..' : '.#.#..#.#.#.',
        step ? '.#.#..#.#.#.' : '..#.#..#.#..',
    ];
    const lines = [];
    for (let y = 0; y < art.length; y += 2) {
        let line = '';
        for (let x = 0; x < art[y].length; x += 1) {
            const top = art[y][x] === '#';
            const bottom = art[y + 1][x] === '#';
            line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
        }
        lines.push(line);
    }
    return lines.join('\\n');
}
`;

export function isActivityPatched(src) {
  return src.includes(MARK);
}

export function patchActivityLine(src) {
  if (!src.includes(IMPORT_AFTER)) throw new Error('ActivityLine: import anchor not found');
  const start = src.indexOf(RETURN_PREFIX);
  if (start < 0) throw new Error('ActivityLine: return block not found');
  const end = src.lastIndexOf('}));');
  if (end < start) throw new Error('ActivityLine: return block end not found');

  let block = src.slice(start, end + 4);
  if (!block.includes(FRAME_CLAUSE)) throw new Error('ActivityLine: frame clause not found');
  block = block.replace(FRAME_CLAUSE, '');

  let inner = block.slice(RETURN_PREFIX.length).trimEnd();
  const tail = '] }));';
  if (!inner.endsWith(tail)) throw new Error('ActivityLine: unexpected return tail');
  inner = inner.slice(0, -tail.length);

  const newBlock = `return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: color, children: clawdActivityCrab(time) }), _jsxs(Text, { wrap: "truncate", children: [${inner}] })] }));`;

  let out = `${src.slice(0, start)}${newBlock}${src.slice(end + 4)}`;
  out = out.replace(IMPORT_AFTER, IMPORT_ADD);
  return `${out}${HELPER}`;
}
