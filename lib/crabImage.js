/**
 * Clawd above the prompt as a real terminal image (sixel / kitty), pose-driven.
 *
 * Frames live in `~/.dsh-tui/crab/<set>/frame-*.png` (transparent, crab body
 * recoloured blue). Inputs:
 *
 *   ~/.dsh-tui/clawd-tool.json   { tool, ts }        ToolUseLoader, exact name
 *   ~/.dsh-tui/clawd-state.json  { phase, line, ts } ActivityLine, turn phase
 *   ~/.dsh-tui/clawd-music.json  { playing, title }  music watcher (GSMTC)
 *
 * Pose priority while a turn runs: fresh tool → thinking. When the turn ends the
 * crab returns to idle; celebrate only after a long continuous run (5 min).
 * Idle picks one pose per idle period: `idle` with 95 % probability, otherwise a
 * random calm pose. Doze after three idle minutes, dance while music plays.
 */

const MARK = 'clawd-image-patch:v11';

const IMPORT_AFTER = "import { PromptInput, composerImageRefsForText } from '../components/PromptInput.js';";
const IMPORT_ADD = `${IMPORT_AFTER}
import { loadSharp } from '../dsh-adapter/sharp.js';`;

const UI_IMPORT_OLD = "useTerminalSize } from '../ui.js';";
const UI_IMPORT_NEW = "useTerminalSize, useTerminalImages, useTerminalImageProtocol } from '../ui.js';";

const ANCHOR = '_jsx(PromptInput, { channel: channel,';

const COMPONENT = `
/* ${MARK} */
const CLAWD_TOOL_SETS = [
    [/^(edit|write|multiedit|str_replace_editor|notebook_edit)$/i, 'ide-connected'],
    [/^(read|view|cat)$/i, 'reading'],
    [/^(grep|glob)$/i, 'search'],
    [/^(web_search|search)$/i, 'search'],
    [/^(web_fetch|fetch|browser)$/i, 'browser'],
    [/^(bash|powershell|pwsh|shell|exec)$/i, 'bash'],
    [/^git/i, 'git'],
    [/test/i, 'tests-pass'],
    [/build/i, 'build'],
    [/debug/i, 'debug'],
    [/todo/i, 'todo-list'],
    [/database|sql/i, 'database'],
    [/download/i, 'download'],
    [/memory/i, 'memory-write'],
    [/doc/i, 'docs-read'],
    [/ask|question/i, 'ask'],
    [/permission|approval/i, 'permission'],
    [/^(subagent|task|job|workflow)$/i, 'thinking-aloud'],
];
const CLAWD_CALM_IDLES = ['idle-coffee', 'idle-book', 'idle-juggle', 'idle-yawn', 'idle-look'];
const CLAWD_TOOL_FRESH_MS = 1200;
const CLAWD_ACT_FRESH_MS = 1200;
const CLAWD_MUSIC_FRESH_MS = 10000;
const CLAWD_MIN_SWITCH_MS = 600;
const CLAWD_CELEBRATE_AFTER_MS = 300000;
const CLAWD_CELEBRATE_MS = 5000;
const CLAWD_DOZE_AFTER_MS = 180000;
const CLAWD_CALM_CHANCE = 0.05;
const clawdSetCache = new Map();
function clawdHome() {
    return process.env.USERPROFILE || process.env.HOME || '.';
}
function clawdReadJson(name) {
    try {
        const fs = process.getBuiltinModule('node:fs');
        const nodePath = process.getBuiltinModule('node:path');
        const raw = fs.readFileSync(nodePath.join(clawdHome(), '.dsh-tui', name), 'utf8').replace(/^\\uFEFF/, '');
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch {
        return {};
    }
}
function clawdSetForTool(tool, input) {
    const name = String(tool ?? '');
    const cmd = String(input ?? '').toLowerCase();
    // pwsh/bash carry the real action in their command line.
    if (/^(bash|powershell|pwsh|shell|exec)$/i.test(name)) {
        if (/select-string|findstr|\brg\b|grep/.test(cmd))
            return 'search';
        if (/get-content|\bcat\b|\btype\b|get-childitem|\bls\b|\bdir\b|test-path|get-item/.test(cmd))
            return 'reading';
        if (/set-content|out-file|add-content|apply_patch|new-item|remove-item|copy-item|move-item|>>|\btee\b/.test(cmd))
            return 'ide-connected';
        return 'bash';
    }
    for (const [pattern, set] of CLAWD_TOOL_SETS) {
        if (pattern.test(name))
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
    const activeSinceRef = React.useRef(0);
    const celebrateUntilRef = React.useRef(0);
    const musicSetRef = React.useRef(null);
    const idlePickRef = React.useRef(null);
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
            const music = clawdReadJson('clawd-music.json');
            const force = clawdReadJson('clawd-force.json');
            const toolFresh = typeof tool.tool === 'string' && tool.tool !== '' && now - Number(tool.ts ?? 0) < CLAWD_TOOL_FRESH_MS;
            const actFresh = now - Number(act.ts ?? 0) < CLAWD_ACT_FRESH_MS;
            const phase = String(act.phase ?? '');
            const line = String(act.line ?? '').toLowerCase();
            const asking = actFresh && /question|вопрос/.test(line);
            const forceActive = typeof force.set === 'string' && force.set !== '' && now < Number(force.until ?? 0);
            const musicPlaying = music.playing === true && now - Number(music.ts ?? 0) < CLAWD_MUSIC_FRESH_MS;
            if (!musicPlaying)
                musicSetRef.current = null;
            const hardActive = toolFresh || (actFresh && (phase === 'thinking' || phase === 'request' || (phase === 'tool' && !asking)));
            let next;
            if (forceActive)
                next = String(force.set);
            else if (toolFresh)
                next = clawdSetForTool(String(tool.tool), String(tool.input ?? ''));
            else if (asking)
                next = 'ask';
            else if (musicPlaying) {
                if (musicSetRef.current === null)
                    musicSetRef.current = Math.random() < 0.5 ? 'dj' : 'radio';
                next = musicSetRef.current;
            }
            else if (actFresh && (phase === 'thinking' || phase === 'request'))
                next = 'thinking';
            else if (actFresh && phase === 'tool')
                next = 'bash';
            else {
                if (now < celebrateUntilRef.current)
                    next = 'celebrate';
                else if (now - lastActiveRef.current > CLAWD_DOZE_AFTER_MS)
                    next = 'idle-doze';
                else {
                    if (idlePickRef.current === null) {
                        idlePickRef.current = Math.random() < CLAWD_CALM_CHANCE
                            ? CLAWD_CALM_IDLES[Math.floor(Math.random() * CLAWD_CALM_IDLES.length)]
                            : 'idle';
                    }
                    next = idlePickRef.current;
                }
            }
            if (hardActive) {
                if (activeSinceRef.current === 0)
                    activeSinceRef.current = now;
                lastActiveRef.current = now;
                idlePickRef.current = null;
            }
            else if (activeSinceRef.current !== 0) {
                const span = now - activeSinceRef.current;
                activeSinceRef.current = 0;
                if (span >= CLAWD_CELEBRATE_AFTER_MS)
                    celebrateUntilRef.current = now + CLAWD_CELEBRATE_MS;
            }
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