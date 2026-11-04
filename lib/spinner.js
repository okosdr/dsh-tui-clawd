/**
 * Inline working crab.
 *
 * dsh-TUI draws one thing inside the transcript while a turn runs: the
 * `Working…` spinner row between the last message and the prompt. Upstream
 * puts a rotating glyph ("the moon") on its left. We replace that glyph with a
 * small three-row crab whose legs step while tools run, so the crab appears
 * exactly where the user watches the work happen.
 *
 * The patch is text-local: one `return` block and one appended helper. If the
 * surrounding code changes, the patch is skipped instead of damaging the file.
 */

const MARK = 'clawd-spinner-patch:v1';

const START = 'return (_jsxs(Box, { ref: viewportRef';

const HELPER = `
/* ${MARK} — inline working crab instead of the rotating glyph */
function clawdSpinnerRows(time) {
    const step = Math.floor(time / 140) % 2 === 0;
    const art = [
        '..########..',
        '..#.####.#..',
        '############',
        '..########..',
        step ? '..#.#..#.#..' : '.#.#..#.#.#.',
        step ? '.#.#..#.#.#.' : '..#.#..#.#..',
    ];
    const rows = [];
    for (let y = 0; y < art.length; y += 2) {
        let line = '';
        for (let x = 0; x < art[y].length; x += 1) {
            const top = art[y][x] === '#';
            const bottom = art[y + 1][x] === '#';
            line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
        }
        rows.push(line);
    }
    return rows;
}
`;

export function isSpinnerPatched(src) {
  return src.includes(MARK);
}

export function patchSpinnerModule(src) {
  const start = src.indexOf(START);
  if (start < 0) throw new Error('SpinnerAnimationRow: return block not found');
  const end = src.indexOf('\n}', start);
  if (end < 0) throw new Error('SpinnerAnimationRow: return block end not found');
  const oldBlock = src.slice(start, end);
  if (oldBlock.includes('clawdSpinnerRows')) throw new Error('SpinnerAnimationRow: already patched');

  const newBlock = `return (_jsxs(Box, { ref: viewportRef, flexDirection: "column", marginTop: 1, width: "100%", children: [_jsxs(Box, { flexDirection: "column", children: clawdSpinnerRows(time).map((line, index) => _jsx(Text, { color: messageColor, children: line }, 'clawd-' + index)) }), _jsxs(Box, { flexDirection: "row", flexWrap: "wrap", width: "100%", children: [_jsx(GlimmerMessage, { message: message, mode: mode, messageColor: messageColor, glimmerIndex: glimmerIndex, flashOpacity: flashOpacity, shimmerColor: shimmerColor, stalledIntensity: stalledIntensity }), status] })] }));`;

  const out = `${src.slice(0, start)}${newBlock}${src.slice(end)}`;
  return `${out}${HELPER}`;
}
