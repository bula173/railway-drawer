/**
 * @file editorMode.ts
 * @brief Chooses between the legacy SVG editor and the embedded draw.io editor.
 *
 * Resolution order: URL `?editor=drawio|legacy` > persisted choice > 'legacy'.
 */

export type EditorMode = 'legacy' | 'drawio';

export const EDITOR_MODE_STORAGE_KEY = 'railway-drawer-editor-mode';
export const DEFAULT_EDITOR_MODE: EditorMode = 'legacy';

function asMode(value: string | null | undefined): EditorMode | null {
  return value === 'legacy' || value === 'drawio' ? value : null;
}

export function getEditorMode(search: string = window.location.search): EditorMode {
  const fromUrl = asMode(new URLSearchParams(search).get('editor'));
  if (fromUrl) return fromUrl;
  try {
    const stored = asMode(localStorage.getItem(EDITOR_MODE_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage unavailable (private mode, blocked site data): fall through to the default.
  }
  return DEFAULT_EDITOR_MODE;
}

export function setEditorMode(mode: EditorMode): void {
  try {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
  } catch {
    // Not persisted; the URL parameter still selects the mode for this load.
  }
}

/** Persists the choice and reloads with `?editor=<mode>` (a full reload avoids state leakage). */
export function switchEditorMode(mode: EditorMode): void {
  setEditorMode(mode);
  window.location.search = `?editor=${mode}`;
}
