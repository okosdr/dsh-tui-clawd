/**
 * Tool-name state for the crab poses.
 *
 * The activity line only carries a human-readable sentence, so guessing the
 * pose from its text was unreliable (a file read looked like a shell command).
 * `ToolUseLoader` receives the real tool name while a call is animating, so this
 * patch records it in `~/.dsh-tui/clawd-tool.json`; the crab reads that file and
 * picks an exact pose. Nothing visual changes here.
 */

const MARK = 'clawd-toolstate-patch:v1';

const OLD = 'export function ToolUseLoader({ isError, isUnresolved, shouldAnimate, toolName, }) {';
const NEW = `${OLD}
    clawdToolNode(toolName, shouldAnimate);`;

const HELPER = `
/* ${MARK} */
function clawdToolNode(toolName, shouldAnimate) {
    try {
        if (!shouldAnimate || !toolName)
            return;
        const now = Date.now();
        if (globalThis.__clawdToolAt && now - globalThis.__clawdToolAt < 200)
            return;
        globalThis.__clawdToolAt = now;
        const fs = process.getBuiltinModule('node:fs');
        const nodePath = process.getBuiltinModule('node:path');
        const home = process.env.USERPROFILE || process.env.HOME || '.';
        fs.writeFileSync(nodePath.join(home, '.dsh-tui', 'clawd-tool.json'), JSON.stringify({ tool: String(toolName), ts: now }));
    }
    catch { }
}
`;

export function isToolStatePatched(src) {
  return src.includes(MARK);
}

export function patchToolState(src) {
  const count = src.split(OLD).length - 1;
  if (count !== 1) throw new Error(`ToolUseLoader: expected 1 signature, found ${count}`);
  return `${src.replace(OLD, NEW)}${HELPER}`;
}
