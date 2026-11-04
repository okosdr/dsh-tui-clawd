/**
 * Spinner glyph → crab.
 *
 * `SpinnerGlyph` is the single animated glyph every spinner in dsh-TUI draws
 * (the working row, compaction, loading states, session list …). Replacing its
 * character is the smallest possible patch and a reliable marker: if the crab
 * shows up where the rotating dot used to be, the patched tree is the one the
 * running app loads.
 */

const MARK = 'clawd-glyph-patch:v1';
const CRAB = '\u{1F980}';

export function isGlyphPatched(src) {
  return src.includes(MARK);
}

export function patchSpinnerGlyph(src) {
  let out = src;
  if (!out.includes("const REDUCED_MOTION_DOT")) throw new Error('SpinnerGlyph: shape changed');

  // Every branch renders `spinnerChar`; swap the character, keep the animation.
  const count = out.split('children: spinnerChar').length - 1;
  if (count < 1) throw new Error('SpinnerGlyph: spinnerChar not found');
  out = out.split('children: spinnerChar').join(`children: '${CRAB}' /* ${MARK} */`);

  // Reduced-motion fallback dot.
  out = out.split("children: REDUCED_MOTION_DOT").join(`children: '${CRAB}'`);
  return out;
}
