/**
 * @file drawioStorage.ts
 * @brief Autosave and file helpers for the draw.io editor mode.
 *
 * Uses its own localStorage key, separate from the legacy editor's `railway-drawer-project`.
 * Storage access is always wrapped in try/catch: it can throw (private mode, blocked
 * site data) or hit the quota on large diagrams. The shape library is never stored.
 */

import { logger } from './logger';

export const DRAWIO_AUTOSAVE_KEY = 'railway-drawer-drawio-doc';
export const DEFAULT_DIAGRAM_TITLE = 'Untitled diagram';

export interface StoredDrawioDoc {
  xml: string;
  title: string;
  savedAt: string;
}

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22;
}

/** Reads the autosaved draw.io document, or null when missing, invalid or storage is unavailable. */
export function loadAutosave(): StoredDrawioDoc | null {
  try {
    const raw = localStorage.getItem(DRAWIO_AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.xml !== 'string') return null;
    return {
      xml: rec.xml,
      title: typeof rec.title === 'string' && rec.title.trim() ? rec.title : DEFAULT_DIAGRAM_TITLE,
      savedAt: typeof rec.savedAt === 'string' ? rec.savedAt : '',
    };
  } catch (err) {
    logger.warn('drawio', 'autosave could not be read', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Writes the autosave. Never throws. */
export function saveAutosave(doc: { xml: string; title: string }): SaveResult {
  try {
    const stored: StoredDrawioDoc = { xml: doc.xml, title: doc.title, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAWIO_AUTOSAVE_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch (err) {
    const reason = isQuotaError(err) ? 'quota' : 'unavailable';
    logger.warn('drawio', 'autosave failed', {
      reason,
      size: doc.xml.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason };
  }
}

function triggerDownload(filename: string, href: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Downloads text content as a file. */
export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  triggerDownload(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SVG_DATA_URI_RE = /^data:image\/svg\+xml((?:;[^,;]*)*),/i;

/**
 * Decodes a `data:image/svg+xml[;charset=..][;base64],...` URI into a Blob.
 * Throws for any other scheme or media type, so a URI supplied by the iframe is never navigated to.
 */
export function svgDataUriToBlob(dataUri: string): Blob {
  const match = SVG_DATA_URI_RE.exec(dataUri);
  if (!match) throw new Error('not an SVG data URI');
  const params = match[1].toLowerCase().split(';');
  const payload = dataUri.slice(match[0].length);
  if (params.includes('base64')) {
    const binary = atob(payload.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/svg+xml' });
  }
  return new Blob([decodeURIComponent(payload)], { type: 'image/svg+xml' });
}

/** Downloads an SVG data URI as a file (via a Blob URL; the data URI itself is never used as href). */
export function downloadSvgDataUri(filename: string, dataUri: string): void {
  const url = URL.createObjectURL(svgDataUriToBlob(dataUri));
  triggerDownload(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Light validation of a .drawio/.xml file: well-formed XML whose root is <mxfile> or
 * <mxGraphModel>. Compressed <diagram> content is fine (draw.io decompresses on load).
 */
export function looksLikeDrawioXml(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed.startsWith('<')) return false;
  try {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return false;
    const name = doc.documentElement?.nodeName;
    return name === 'mxfile' || name === 'mxGraphModel';
  } catch {
    return false;
  }
}

const FORBIDDEN_FILENAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

/** Makes a title safe to use as a download filename (without extension). */
export function sanitizeFilename(name: string): string {
  let out = '';
  for (const ch of name) {
    out += FORBIDDEN_FILENAME_CHARS.has(ch) || ch.charCodeAt(0) < 32 ? '_' : ch;
  }
  out = out.trim().replace(/^\.+/, '').slice(0, 120).trim();
  return out || 'diagram';
}

/** Derives a diagram title from a file name (drops .drawio/.xml/.drawio.svg). */
export function titleFromFilename(filename: string): string {
  const title = filename.replace(/\.(drawio\.svg|drawio\.xml|drawio|xml)$/i, '').trim();
  return title || DEFAULT_DIAGRAM_TITLE;
}
