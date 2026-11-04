/**
 * Sealed UI language.
 *
 * The user asked for English that cannot drift back to Chinese (the OS locale
 * guess and the `/lang` command both did that). We write `~/.dsh-tui/lang.lock`
 * with the chosen language and patch `i18n.js` so the lock wins over the env
 * var, the cordis config, `lang.json`, the locale guess and runtime switches.
 */

const LANG_MARK = 'clawd-lang-patch:v1';

const SETLANG_OLD = `export function setLang(lang) {
    activeLang = lang;`;

const SETLANG_NEW = `export function setLang(lang) {
    const clawdLocked = __clawdLockedLang();
    activeLang = clawdLocked !== undefined ? clawdLocked : lang;`;

const RESOLVE_OLD = `export function resolveStartupLang() {
    const envLang = process.env.DSH_TUI_LANG;`;

const RESOLVE_NEW = `export function resolveStartupLang() {
    const clawdLocked = __clawdLockedLang();
    if (clawdLocked !== undefined)
        return clawdLocked;
    const envLang = process.env.DSH_TUI_LANG;`;

const LANG_APPEND = `
/* ${LANG_MARK} — language sealed by dsh-tui-clawd (~/.dsh-tui/lang.lock) */
function __clawdLockedLang() {
    try {
        const value = readFileSync(join(DATA_DIR, 'lang.lock'), 'utf8').trim();
        return value === 'en' || value === 'zh' ? value : undefined;
    }
    catch {
        return undefined;
    }
}
`;

export function isLangPatched(src) {
  return src.includes(LANG_MARK);
}

export function patchI18nModule(src) {
  const swaps = [
    [SETLANG_OLD, SETLANG_NEW],
    [RESOLVE_OLD, RESOLVE_NEW],
  ];
  let out = src;
  for (const [from, to] of swaps) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`i18n.js: expected 1 match, found ${count}`);
    out = out.replace(from, to);
  }
  return `${out}${LANG_APPEND}`;
}
