/**
 * Clawd above the prompt as a real terminal image (sixel / kitty).
 *
 * Windows Terminal 1.22+ and most modern terminals can paint real pixels, and
 * dsh-TUI already ships an image pipeline for attachments and the maid
 * portrait. This patch reuses it: the crab frames live as transparent PNGs in
 * `~/.dsh-tui/crab/`, are decoded with the host's sharp, and animated by
 * swapping the RGBA source every 200 ms.
 *
 * On terminals without graphics the component renders nothing, so the layout
 * stays exactly as stock.
 */

const MARK = 'clawd-image-patch:v3';

const IMPORT_AFTER = "import { PromptInput, composerImageRefsForText } from '../components/PromptInput.js';";
const IMPORT_ADD = `${IMPORT_AFTER}
import { loadSharp } from '../dsh-adapter/sharp.js';`;

const UI_IMPORT_OLD = 'useTerminalSize } from \'../ui.js\';';
const UI_IMPORT_NEW = 'useTerminalSize, useTerminalImages, useTerminalImageProtocol } from \'../ui.js\';';

const ANCHOR = '_jsx(PromptInput, { channel: channel,';

const COMPONENT = `
/* ${MARK} */
const CLAWD_IMAGE_DIR = ['.dsh-tui', 'crab'];
function ClawdImage() {
    const imagesReady = useTerminalImages();
    const protocol = useTerminalImageProtocol();
    const [frames, setFrames] = React.useState([]);
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const sharp = await loadSharp();
                if (!sharp)
                    return;
                const fs = process.getBuiltinModule('node:fs');
                const nodePath = process.getBuiltinModule('node:path');
                const home = process.env.USERPROFILE || process.env.HOME || '.';
                const dir = nodePath.join(home, ...CLAWD_IMAGE_DIR);
                if (!fs.existsSync(dir))
                    return;
                const files = fs.readdirSync(dir).filter((file) => file.endsWith('.png')).sort();
                const decodedFrames = [];
                for (const file of files) {
                    const decoded = await sharp(fs.readFileSync(nodePath.join(dir, file)), { failOn: 'error' })
                        .toColourspace('srgb')
                        .ensureAlpha()
                        .raw()
                        .toBuffer({ resolveWithObject: true });
                    if (decoded.info.channels !== 4)
                        continue;
                    decodedFrames.push({
                        data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
                        width: decoded.info.width,
                        height: decoded.info.height,
                    });
                }
                if (alive && decodedFrames.length > 0)
                    setFrames(decodedFrames);
            }
            catch { }
        })();
        return () => { alive = false; };
    }, []);
    React.useEffect(() => {
        if (frames.length < 2)
            return;
        const id = setInterval(() => setTick((value) => value + 1), 220);
        if (id.unref)
            id.unref();
        return () => clearInterval(id);
    }, [frames]);
    React.useEffect(() => {
        try {
                const fs = process.getBuiltinModule('node:fs');
                const nodePath = process.getBuiltinModule('node:path');
                const home = process.env.USERPROFILE || process.env.HOME || '.';
                fs.appendFileSync(nodePath.join(home, '.dsh-tui', 'clawd-image.log'), new Date().toISOString() + ' protocol=' + String(protocol) + ' images=' + imagesReady + ' frames=' + frames.length + '\\n');
        }
        catch { }
    }, [protocol, imagesReady, frames.length]);
    if (!imagesReady || frames.length === 0)
        return null;
    const frame = frames[tick % frames.length];
    return _jsx(Box, { flexDirection: "column", alignItems: "center", children: _jsx(Image, { source: frame, width: 16, height: 6, alt: '' }) });
}
`;

export function isCrabImagePatched(src) {
  return src.includes(MARK);
}

export function patchChatImage(src) {
  if (!src.includes(IMPORT_AFTER)) throw new Error('Chat: PromptInput import not found');
  if (!src.includes(UI_IMPORT_OLD)) throw new Error('Chat: ui import not found');
  const count = src.split(ANCHOR).length - 1;
  if (count !== 1) throw new Error(`Chat: PromptInput anchor count ${count}`);
  let out = src.replace(IMPORT_AFTER, IMPORT_ADD);
  out = out.replace(UI_IMPORT_OLD, UI_IMPORT_NEW);
  out = out.replace(ANCHOR, `_jsx(ClawdImage, {}), ${ANCHOR}`);
  return `${out}${COMPONENT}`;
}
