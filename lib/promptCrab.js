/**
 * Clawd above the prompt, always visible.
 *
 * Frames are extracted from MyClawd's `idle/loop.gif` (personal use), cropped to
 * the crab, downsampled to 24x12 and recoloured with the theme accent. The
 * background is dropped: only `#` pixels are painted, `O` (eyes) stay holes.
 *
 * The sprite is drawn with quadrant block characters (2x2 pixels per cell), so
 * a 12x6 cell block carries a 24x12 pixel crab — four times the detail of
 * half-blocks at the same height.
 */

const MARK = 'clawd-prompt-patch:v1';

const FRAMES_JSON = '[{"value":["....################....","....################....","....##OO########OO##....","########################","########################","########################","....################....","....################....","....################....","....##..##....##..##....","....##..##....##..##....","....##..##....##..##...."],"Count":12},{"value":["....################....","....################....","....##OO########OO##....","########################","########################","########################","....################....","....################....","....################....","....##..##....##..##....","....##..##....##..##....","....##..##....##..##...."],"Count":12},{"value":["....################....","....################....","....##OO########OO##....","########################","########################","########################","....################....","....################....","....################....","....##..##....##..##....","....##..##....##..##....","....##..##....##..##...."],"Count":12},{"value":["....################....","....################....","....################....","########################","########################","########################","....################....","....################....","....################....","....##..##....##..##....","....##..##....##..##....","....##..##....##..##...."],"Count":12},{"value":["....################....","....################....","....##OO########OO##....","########################","########################","########################","....################....","....################....","....################....","....##..##....##..##....","....##..##....##..##....","....##..##....##..##...."],"Count":12},{"value":["....################....","....################....","....##OO########OO##....","########################","########################","########################","....################....","....################....","....################....","....##..##....##..##....","....##..##....##..##....","....##..##....##..##...."],"Count":12}]';

const COMPONENT = `
/* ${MARK} */
const CLAWD_PROMPT_FRAMES = ${FRAMES_JSON};
function clawdQuadrantRows(grid) {
    const chars = { 0: ' ', 1: '▘', 2: '▝', 3: '▀', 4: '▖', 5: '▌', 6: '▞', 7: '▛', 8: '▗', 9: '▚', 10: '▐', 11: '▜', 12: '▄', 13: '▙', 14: '▟', 15: '█' };
    const rows = [];
    for (let y = 0; y < grid.length; y += 2) {
        let line = '';
        for (let x = 0; x < grid[y].length; x += 2) {
            const p = (yy, xx) => (grid[yy] && grid[yy][xx] === '#' ? 1 : 0);
            const mask = p(y, x) | (p(y, x + 1) << 1) | (p(y + 1, x) << 2) | (p(y + 1, x + 1) << 3);
            line += chars[mask];
        }
        rows.push(line);
    }
    return rows;
}
function ClawdLine() {
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
        const id = setInterval(() => setTick((value) => value + 1), 260);
        if (id.unref)
            id.unref();
        return () => clearInterval(id);
    }, []);
    const frame = CLAWD_PROMPT_FRAMES[tick % CLAWD_PROMPT_FRAMES.length];
    const rows = clawdQuadrantRows(frame);
    return _jsxs(Box, { flexDirection: "column", alignItems: "center", children: rows.map((row, index) => _jsx(Text, { color: "accent", children: row }, 'clawd-' + index)) });
}
`;

const ANCHOR = '_jsx(PromptInput, { channel: channel,';

export function isPromptPatched(src) {
  return src.includes(MARK);
}

export function patchChatPrompt(src) {
  const count = src.split(ANCHOR).length - 1;
  if (count !== 1) throw new Error(`Chat: PromptInput anchor count ${count}`);
  const out = src.replace(ANCHOR, `_jsx(ClawdLine, {}), ${ANCHOR}`);
  return `${out}${COMPONENT}`;
}