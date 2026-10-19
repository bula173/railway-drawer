/**
 * @file script-store.ts
 * @brief A tab's Railway Script text (held by its ProjectService like the scenarios) and its
 *        storage: the main page's `<diagram rdRailwayScript="...">` attribute in the .drawio file
 *        and share links (draw.io keeps unknown `<diagram>` attributes, like `rdScenarios`), and
 *        `tabs[].railwayScript` in the tab cache. Main chunk: no YAML code here.
 */

/** `<diagram>` attribute holding the script text. */
export const RAILWAY_SCRIPT_ATTR = 'rdRailwayScript';

/** Longest script kept (characters). */
export const MAX_SCRIPT_LENGTH = 1_000_000;

export type ScriptChangeSource = 'editor' | 'drawing' | 'load' | 'api';

/**
 * Text normalized for storage: `\n` line ends, tabs as two spaces (XML attribute normalization
 * would turn them into single spaces; YAML does not allow tabs for indentation anyway), no
 * XML-invalid control characters, capped.
 */
export function cleanScriptText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .slice(0, MAX_SCRIPT_LENGTH);
}

export class RailwayScriptStore {
  private text = '';
  private readonly listeners = new Set<(text: string, source: ScriptChangeSource) => void>();

  get(): string {
    return this.text;
  }

  /** True when the tab has a script. */
  has(): boolean {
    return this.text.trim() !== '';
  }

  set(text: string, source: ScriptChangeSource = 'api'): void {
    if (text === this.text) return;
    this.text = text;
    for (const l of [...this.listeners]) l(text, source);
  }

  subscribe(listener: (text: string, source: ScriptChangeSource) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Attributes for the main page's `<diagram>` (none without a script). */
export function railwayScriptAttributes(text: string): Record<string, string> {
  return text.trim() === '' ? {} : { [RAILWAY_SCRIPT_ATTR]: cleanScriptText(text) };
}

/** The script of a main page `<diagram>` ('' when none). */
export function readRailwayScriptAttribute(page: Element | null | undefined): string {
  const raw = page?.getAttribute(RAILWAY_SCRIPT_ATTR);
  return raw ? cleanScriptText(raw) : '';
}

/** A cached script value (untrusted): a string or ''. */
export function sanitizeCachedScript(value: unknown): string {
  return typeof value === 'string' ? cleanScriptText(value) : '';
}
