/**
 * The status dot on tool-call rows → crab.
 *
 * The line under the last message ("· done mulling, starting · Looking for
 * files … · 1s · tool x2") is the tool-call row, and its left glyph comes from
 * `ToolUseLoader`: a blinking `BLACK_CIRCLE` while the call runs, a small
 * category bullet once settled. This patch swaps the running glyph for the
 * crab so the mascot sits exactly where the user watches the work happen.
 */

const MARK = 'clawd-toolloader-patch:v1';
const CRAB = '\u{1F980}';

const OLD = "const char = shouldAnimate ? (isBlinking ? BLACK_CIRCLE : ' ') : BULLET;";
const NEW = `const char = shouldAnimate ? (isBlinking ? '${CRAB}' : ' ') : '${CRAB}'; /* ${MARK} */`;

export function isToolLoaderPatched(src) {
  return src.includes(MARK);
}

export function patchToolUseLoader(src) {
  const count = src.split(OLD).length - 1;
  if (count !== 1) throw new Error(`ToolUseLoader: expected 1 match, found ${count}`);
  return src.replace(OLD, NEW);
}
