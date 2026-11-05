/**
 * Clawd above the prompt as a real terminal image (sixel / kitty), pose-driven.
 *
 * Frames live in `~/.dsh-tui/crab/<set>/frame-*.png` (transparent, crab body
 * recoloured blue). Two files drive the pose:
 *
 *   ~/.dsh-tui/clawd-tool.json  { tool, ts }  written by ToolUseLoader while a
 *                               tool call animates — the exact tool name, so a
 *                               file read gets the reading pose, not a shell.
 *   ~/.dsh-tui/clawd-state.json { phase, line, ts } written by ActivityLine —
 *                               thinking / tool / done for the turn itself.
 *
 * Pose priority: fresh tool (1.2 s) → thinking → celebrate on the active→idle
 * transition (3 s) → idle, where coffee is a rare 9 s break and doze only after
 * three idle minutes.
 */

const MARK = 'clawd-image-patch:v6';

const IMPORT_AFTER = "import { PromptInput, composerImageRefsForText } from '../components/PromptInput.js';";
const IMPORT_ADD = `${IMPORT_AFTER}
import { loadSharp } from '../dsh-adapter/sharp.js';`;

const UI_IMPORT_OLD = "useTerminalSize } from '../ui.js';";
const UI_IMPORT_NEW = "useTerminalSize, useTerminalImages, useTerminalImageProtocol } from '../ui.js';";

const ANCHOR = '_jsx(PromptInput, { channel: channel,';

const COMPONENT = `
/* ${MARK} */
const CLAWD_TOOL_SETS = [
    [/^(edit|write|multiedit|str_replace_editor|notebook_edit)$/i, 'writing'],
    [/^(read|view|cat)$/i, 'reading'],
    [/^(grep|glob|search|file_search)$/i, 'search'],
    [/^(bash|powershell|pwsh|shell|exec)$/i, 'bash'],
    [/^web_search$/i, 'browser'],
    [/^(web_fetch|fetch)$/i, 'web-fetch'],
    [/^git/i, 'git'],
    [/test/i, 'tests-pass'],
    [/build/i, 'build'],
    [/debug/i, 'debug'],
    [/todo/i, 'todo-list'],
    [/database|sql/i, 'database'],
    [/download/i, 'download'],
    [/memory/i, 'memory-write'],
    [/doc/i, 'docs-read'],
    [/^(subagent|task|job|workflow)$/i, 'thinking-aloud'],
];
const CLAWD_TOOL_FRESH_MS = 1200;
const CLAWD_ACT_FRESH_MS = 1200;
const CLAWD_MIN_SWITCH_MS = 600;
const CLAWD_COFFEE_MS = 9000;
const CLAWD_DOZE_AFTER_MS = 180000;
const clawdSetCache = new Map();
function clawdHome() {
    return process.env.USERPROFILE || process.env.HOME || '.';
}
function clawdReadJson(name) {
    try {
        const fs = process.getBuiltinModule('node:fs');
        const nodePath = process.getBuiltinModule('node:path');
        const parsed = JSON.parse(fs.readFileSync(nodePath.join(clawdHome(), '.dsh-tui', name), 'utf8'));
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch {
        return {};
    }
}
function clawdSetForTool(tool) {
    for (const [pattern, set] of CLAWD_TOOL_SETS) {
        if (pattern.test(tool))
            return set;
    }
    return 'bash';
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
    const lastSwitchRef = React.useRef(0);
    const lastActiveRef = React.useRef(Date.now());
    const wasActiveRef = React.useRef(false);
    const celebrateUntilRef = React.useRef(0);
    const coffeeUntilRef = React.useRef(0);
    const nextCoffeeRef = React.useRef(Date.now() + 60000);
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
            const now = Date.now();
            const tool = clawdReadJson('clawd-tool.json');
            const act = clawdReadJson('clawd-state.json');
            const toolFresh = typeof tool.tool === 'string' && tool.tool !== '' && now - Number(tool.ts ?? 0) < CLAWD_TOOL_FRESH_MS;
            const actFresh = now - Number(act.ts ?? 0) < CLAWD_ACT_FRESH_MS;
            const active = toolFresh || actFresh;
            if (active)
                lastActiveRef.current = now;
            let next;
            if (toolFresh)
                next = clawdSetForTool(String(tool.tool));
            else if (actFresh && (act.phase === 'thinking' || act.phase === 'request'))
                next = 'thinking';
            else if (actFresh && act.phase === 'tool')
                next = 'bash';
            else {
                if (wasActiveRef.current)
                    celebrateUntilRef.current = now + 3000;
                if (now < celebrateUntilRef.current)
                    next = 'celebrate';
                else if (now - lastActiveRef.current > CLAWD_DOZE_AFTER_MS)
                    next = 'idle-doze';
                else if (now < coffeeUntilRef.current)
                    next = 'idle-coffee';
                else if (now > nextCoffeeRef.current && now - lastActiveRef.current > 20000) {
                    coffeeUntilRef.current = now + CLAWD_COFFEE_MS;
                    nextCoffeeRef.current = now + 60000 + Math.random() * 120000;
                    next = 'idle-coffee';
                }
                else
                    next = 'idle';
            }
            wasActiveRef.current = active;
            if (next === setRef.current)
                return;
            if (now - lastSwitchRef.current < CLAWD_MIN_SWITCH_MS)
                return;
            setRef.current = next;
            lastSwitchRef.current = now;
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
        }, 300);
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
