/**
 * Richer tool state: name + command preview.
 *
 * DeepSeek's agent runs most actions through `pwsh` (reading logs, searching,
 * writing files), so the bare tool name cannot tell a read from a write. The
 * tool card knows the actual arguments, so this patch records a short preview:
 *
 *   ~/.dsh-tui/clawd-tool.json  { tool, input, ts }
 *
 * The crab then classifies the preview (Get-Content → reading, Select-String →
 * search, Set-Content → writing, otherwise → bash). Nothing visual changes.
 */

const MARK = 'clawd-toolargs-patch:v1';

const SIGNATURE_RE = /(export function AssistantToolUseMessage\(\{ tool, [\s\S]*?\) \{)/;

const HELPER = `
/* ${MARK} */
function clawdToolNode2(tool) {
    try {
        if (!tool || tool.status !== 'running' || typeof tool.name !== 'string' || tool.name === '')
            return;
        const now = Date.now();
        if (globalThis.__clawdToolArgsAt && now - globalThis.__clawdToolArgsAt < 250)
            return;
        globalThis.__clawdToolArgsAt = now;
        const fs = process.getBuiltinModule('node:fs');
        const nodePath = process.getBuiltinModule('node:path');
        const home = process.env.USERPROFILE || process.env.HOME || '.';
        const input = String(tool.argsText ?? tool.argsFull ?? '').slice(0, 400);
        fs.writeFileSync(nodePath.join(home, '.dsh-tui', 'clawd-tool.json'), JSON.stringify({ tool: tool.name, input, ts: now }));
    }
    catch { }
}
`;

export function isToolArgsPatched(src) {
  return src.includes(MARK);
}

export function patchToolArgs(src) {
  const match = SIGNATURE_RE.exec(src);
  if (match === null) throw new Error('AssistantToolUseMessage: signature not found');
  const out = src.replace(match[1], `${match[1]}
    clawdToolNode2(tool);`);
  return `${out}${HELPER}`;
}
