/**
 * Force sixel under Windows Terminal.
 *
 * Windows Terminal 1.22+ paints sixel images, but its DA1 reply does not carry
 * attribute 4, so `selectTerminalImageProtocol` concludes "no graphics". This
 * patch falls back to sixel whenever the process runs inside Windows Terminal
 * (`WT_SESSION`), leaving every other terminal untouched.
 */
const MARK = 'clawd-protocol-patch:v1';

const OLD = "return attributes?.slice(1).includes(4) ? 'sixel' : 'none';";
const NEW = `if (attributes?.slice(1).includes(4))
        return 'sixel';
    // Windows Terminal ships sixel (1.22+) but does not advertise it in DA1.
    if (process.env.WT_SESSION)
        return 'sixel';
    return 'none';`;

export function isProtocolPatched(src) {
  return src.includes(MARK);
}

export function patchProtocol(src) {
  const count = src.split(OLD).length - 1;
  if (count !== 1) throw new Error(`terminal-image-protocol: expected 1 match, found ${count}`);
  return `/* ${MARK} */\n${src.replace(OLD, NEW)}`;
}
