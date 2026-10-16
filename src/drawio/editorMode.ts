/**
 * @file editorMode.ts
 * @brief Chooses between the main Railway Drawer editor (maxGraph) and the draw.io
 *        compatibility view (the embedded draw.io editor, for import/export fidelity).
 *
 * Resolution order: URL `?editor=main|drawio` > persisted choice > 'main'.
 * 'legacy' (the former name of the main editor) is still accepted in the URL and in storage.
 */

export type EditorMode = 'main' | 'drawio';

export const EDITOR_MODE_STORAGE_KEY = 'railway-drawer-editor-mode';
export const DEFAULT_EDITOR_MODE: EditorMode = 'main';

/** 'legacy' is the main editor's former name (old links, stored choices). */
function asMode(value: string | null | undefined): EditorMode | null {
  if (value === 'main' || value === 'legacy') return 'main';
  return value === 'drawio' ? value : null;
}

export function getEditorMode(search: string = window.location.search): EditorMode {
  const fromUrl = asMode(new URLSearchParams(search).get('editor'));
  if (fromUrl) return fromUrl;
  try {
    const raw = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    const stored = asMode(raw);
    // Migrate the former name once, so the stored value always uses the current one
    if (stored && raw !== stored) localStorage.setItem(EDITOR_MODE_STORAGE_KEY, stored);
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
