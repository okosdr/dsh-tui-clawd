/**
 * Clawd above the prompt as a real terminal image (sixel / kitty), pose-driven.
 *
 * Frames live in `~/.dsh-tui/crab/<set>/frame-*.png` (transparent, crab body
 * recoloured blue). The component polls `~/.dsh-tui/clawd-state.json`, which the
 * activity line writes during a turn, and swaps the frame set:
 *
 *   thinking            -> thinking
 *   tool + edit/write   -> writing   (typing at a laptop)
 *   tool + search       -> search    (magnifying glass)
 *   tool + read         -> reading
 *   tool + anything     -> bash      (running)
 *   done                -> celebrate (4 s, then back to idle)
 *   idle / stale state  -> idle, idle-coffee, idle-doze (rotating)
 */

const MARK = 'clawd-image-patch:v5';

const IMPORT_AFTER = "import { PromptInput, composerImageRefsForText } from '../components/PromptInput.js';";
const IMPORT_ADD = `${IMPORT_AFTER}
import { loadSharp } from '../dsh-adapter/sharp.js';`;

const UI_IMPORT_OLD = "useTerminalSize } from '../ui.js';";
const UI_IMPORT_NEW = "useTerminalSize, useTerminalImages, useTerminalImageProtocol } from '../ui.js';";

const ANCHOR = '_jsx(PromptInput, { channel: channel,';

const COMPONENT = `
/* ${MARK} */
const CLAWD_IDLE_SETS = ['idle', 'idle-coffee', 'idle-doze'];
const clawdSetCache = new Map();
function clawdHome() {
    return process.env.USERPROFILE || process.env.HOME || '.';
}
function clawdReadState() {
    try {
        const fs = process.getBuiltinModule('node:fs');
        const nodePath = process.getBuiltinModule('node:path');
        const file = nodePath.join(clawdHome(), '.dsh-tui', 'clawd-state.json');
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (typeof parsed !== 'object' || parsed === null)
            return { phase: '', line: '', ts: 0 };
        return parsed;
    }
    catch {
        return { phase: '', line: '', ts: 0 };
    }
}
function clawdPickSet(state, idleIndex) {
    const phase = String(state.phase ?? '');
    const line = String(state.line ?? '').toLowerCase();
    const fresh = Date.now() - Number(state.ts ?? 0) < 5000;
    if (fresh && phase === 'done')
        return 'celebrate';
    if (fresh && (phase === 'thinking' || phase === 'request'))
        return 'thinking';
    if (fresh && phase === 'tool') {
        if (/edit|write|patch|apply|create/.test(line))
            return 'writing';
        if (/search|grep|glob|find|query/.test(line))
            return 'search';
        if (/read|cat|view|open/.test(line))
            return 'reading';
        return 'bash';
    }
    return CLAWD_IDLE_SETS[idleIndex % CLAWD_IDLE_SETS.length];
}
async function clawdLoadSet(sharp, name) {
    const cached = clawdSetCache.get(name);
    if (cached !== undefined)
        return cached;
    const fs = process.getBuiltinModule('node:fs');
    const nodePath = process.getBuiltinModule('node:path');
    const dir = nodePath.join(clawdHome(), '.dsh-tui', 'crab', name);
    if (!fs.existsSync(dir))
        return [];
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.png')).sort();
    const frames = [];
    for (const file of files) {
        try {
            const decoded = await sharp(fs.readFileSync(nodePath.join(dir, file)), { failOn: 'error' })
                .toColourspace('srgb')
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            if (decoded.info.channels !== 4)
                continue;
            frames.push({
                data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
                width: decoded.info.width,
                height: decoded.info.height,
            });
        }
        catch { }
    }
    clawdSetCache.set(name, frames);
    return frames;
}
function ClawdImage() {
    const imagesReady = useTerminalImages();
    const protocol = useTerminalImageProtocol();
    const sharpRef = React.useRef(null);
    const setRef = React.useRef('idle');
    const idleRef = React.useRef(0);
    const idleSinceRef = React.useRef(Date.now());
    const celebrateUntilRef = React.useRef(0);
    const [frames, setFrames] = React.useState([]);
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const sharp = await loadSharp();
                if (!sharp)
                    return;
                sharpRef.current = sharp;
                const initial = await clawdLoadSet(sharp, 'idle');
                if (alive && initial.length > 0)
                    setFrames(initial);
            }
            catch { }
        })();
        return () => { alive = false; };
    }, []);
    React.useEffect(() => {
        let alive = true;
        const id = setInterval(() => {
            const sharp = sharpRef.current;
            if (!sharp)
                return;
            if (Date.now() - idleSinceRef.current > 20000) {
                idleSinceRef.current = Date.now();
                idleRef.current += 1;
            }
            const state = clawdReadState();
            let next = clawdPickSet(state, idleRef.current);
            if (next === 'celebrate') {
                if (celebrateUntilRef.current === 0)
                    celebrateUntilRef.current = Date.now() + 4000;
                if (Date.now() > celebrateUntilRef.current) {
                    celebrateUntilRef.current = 0;
                    next = CLAWD_IDLE_SETS[idleRef.current % CLAWD_IDLE_SETS.length];
                }
            }
            else {
                celebrateUntilRef.current = 0;
            }
            if (next === setRef.current)
                return;
            setRef.current = next;
            void (async () => {
                try {
                    const loaded = await clawdLoadSet(sharp, next);
                    if (alive && loaded.length > 0) {
                        setFrames(loaded);
                        setTick(0);
                    }
                }
                catch { }
            })();
        }, 400);
        if (id.unref)
            id.unref();
        return () => { alive = false; clearInterval(id); };
    }, []);
    React.useEffect(() => {
        if (frames.length < 2)
            return;
        const id = setInterval(() => setTick((value) => value + 1), 140);
        if (id.unref)
            id.unref();
        return () => clearInterval(id);
    }, [frames]);
    React.useEffect(() => {
        try {
            const fs = process.getBuiltinModule('node:fs');
            const nodePath = process.getBuiltinModule('node:path');
            fs.appendFileSync(nodePath.join(clawdHome(), '.dsh-tui', 'clawd-image.log'), new Date().toISOString() + ' protocol=' + String(protocol) + ' images=' + imagesReady + ' set=' + setRef.current + ' frames=' + frames.length + '\\n');
        }
        catch { }
    }, [protocol, imagesReady, frames.length]);
    if (!imagesReady || frames.length === 0)
        return null;
    const frame = frames[tick % frames.length];
    return _jsx(Box, { flexDirection: "column", alignItems: "center", children: _jsx(Image, { source: frame, width: 24, height: 4, alt: '', presentation: 'transcript', transparent: true }) });
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
