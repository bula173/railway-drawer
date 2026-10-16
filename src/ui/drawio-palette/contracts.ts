/**
 * @file contracts.ts
 * @brief Palette-data and stencil-engine contracts used by the palette UI.
 *
 * The types come from `src/drawio-shapes/palettes` and `src/drawio-shapes/engine`. The app passes
 * the real engine functions as `PaletteEngine` (see `setDrawioPaletteEngine` in legacy-main.ts).
 *
 * `fallbackEngine` is a minimal stand-in (tests, or before the engine is set): it parses plain or
 * entity-escaped `<mxlibrary>` files (no base64-deflate entries), loads no stencils and installs
 * no color compatibility.
 */
import type { Graph } from '@maxgraph/core';
import type { LibraryEntry } from '../../drawio-shapes/engine';

export type { PaletteDef, PaletteEntry, PaletteMeta } from '../../drawio-shapes/palettes';
export type { LibraryEntry } from '../../drawio-shapes/engine';

/** The engine functions the palette UI needs (contracts 4 and 5). */
export interface PaletteEngine {
  /** Preloads the stencil sets used by a model XML or a list of style strings. */
  ensureStencilsForXml(xmlOrStyles: string | string[]): Promise<unknown>;
  /** light-dark()/default colours and HTML label CSS compatibility for a graph. */
  installDrawioCompat(graph: Graph): void;
  /** Parses a `<mxlibrary>` document or a bare JSON array. */
  parseMxLibrary(text: string): LibraryEntry[];
}

function finiteNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Minimal `<mxlibrary>` parser: plain or entity-escaped `xml` and `data` entries.
 * Compressed entries (base64 deflate) are skipped; the real engine handles them.
 */
export function fallbackParseMxLibrary(text: string): LibraryEntry[] {
  const trimmed = text.trim();
  let json: string;
  if (trimmed.startsWith('[')) {
    json = trimmed;
  } else {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    const root = doc.documentElement;
    if (doc.getElementsByTagName('parsererror').length > 0 || !root || root.nodeName !== 'mxlibrary') {
      throw new Error('Not a draw.io library (<mxlibrary>)');
    }
    json = root.textContent ?? '';
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`Library body is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(raw)) throw new Error('Library body must be a JSON array');
  const entries: LibraryEntry[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const entry: LibraryEntry = {
      title: typeof rec.title === 'string' ? rec.title : '',
      w: finiteNumber(rec.w, 80),
      h: finiteNumber(rec.h, 80),
    };
    if (typeof rec.aspect === 'string') entry.aspect = rec.aspect;
    if (typeof rec.tags === 'string') entry.tags = rec.tags;
    if (typeof rec.xml === 'string') {
      const xml = rec.xml.trim();
      if (!xml.startsWith('<')) continue; // compressed: needs the real engine
      entry.xml = xml;
    } else if (typeof rec.data === 'string') {
      entry.data = rec.data;
    } else {
      continue;
    }
    entries.push(entry);
  }
  return entries;
}

/** Stand-in engine used until integration passes the real one. */
export const fallbackEngine: PaletteEngine = {
  ensureStencilsForXml: () => Promise.resolve(),
  installDrawioCompat: () => undefined,
  parseMxLibrary: fallbackParseMxLibrary,
};
