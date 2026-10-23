import { STORAGE_KEYS } from '../core/storage-keys';
import { getStorage } from '../core/safe-storage';
/**
 * @file retired-drawio-mode.ts
 * @brief Browser storage left behind by the removed embedded draw.io mode.
 *
 * The app had a second editor (draw.io embedded in an iframe) until it was removed on the user's
 * decision. It left two localStorage keys:
 * - `railway-drawer-editor-mode`: the remembered editor choice. Dropped on boot (old
 *   `?editor=drawio|legacy|main` links just open the editor).
 * - `railway-drawer-drawio-doc`: the draw.io view's own autosaved document (`{ xml, title, savedAt }`),
 *   independent of the editor's tabs. It is opened as new tabs once, then removed, so no diagram is lost.
 *
 * Storage access never throws (private mode, blocked site data).
 */

export const RETIRED_EDITOR_MODE_KEY = STORAGE_KEYS.retiredEditorMode;
export const RETIRED_DRAWIO_DOC_KEY = STORAGE_KEYS.retiredDrawioDoc;

export interface RetiredDrawioDocument {
  xml: string;
  title: string;
}

function storage(): Storage | null {
  try {
    return getStorage('local');
  } catch {
    return null;
  }
}

/** Removes the remembered editor mode of the former mode switch. */
export function clearRetiredEditorMode(store: Storage | null = storage()): void {
  try {
    store?.removeItem(RETIRED_EDITOR_MODE_KEY);
  } catch {
    // Storage unavailable: nothing to clean up
  }
}

/** The draw.io view's autosaved document, or null when there is none (or it is unreadable). */
export function readRetiredDrawioDocument(store: Storage | null = storage()): RetiredDrawioDocument | null {
  try {
    const raw = store?.getItem(RETIRED_DRAWIO_DOC_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.xml !== 'string' || !rec.xml.trim().startsWith('<')) return null;
    const title = typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : 'draw.io diagram';
    return { xml: rec.xml, title };
  } catch {
    return null;
  }
}

/** Removes the draw.io view's autosaved document (after it was opened, or when it is unusable). */
export function discardRetiredDrawioDocument(store: Storage | null = storage()): void {
  try {
    store?.removeItem(RETIRED_DRAWIO_DOC_KEY);
  } catch {
    // Storage unavailable
  }
}
