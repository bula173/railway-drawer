/**
 * @file ertmsLibrary.ts
 * @brief Loads the ERTMS draw.io shape library and builds the draw.io `configure` payload.
 *
 * The library file is an <mxlibrary> whose JSON body contains entity-escaped XML
 * (`&lt;mxGraphModel&gt;`). Reading it via `textContent` decodes the entities; skipping
 * that step makes every tile render as an "Error:" placeholder in draw.io.
 *
 * The library is passed inline as `data` (never `url`): a cross-origin url would be
 * rewritten to draw.io's /proxy, which does not work offline.
 */

import { logger } from './logger';
import type { DrawioConfig, LibraryItem } from './protocol';

/** Bump whenever the library config changes: resets draw.io's persisted sidebar state. */
export const DRAWIO_CONFIG_VERSION = 'rd-1';
export const ERTMS_LIBRARY_PATH = 'libraries/ertms.xml';
export const ERTMS_SEARCH_TAGS = 'ertms etcs';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Parses an <mxlibrary> document into validated library items. Throws on any defect. */
export function parseMxLibrary(text: string): LibraryItem[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Library is not well-formed XML');
  }
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'mxlibrary') {
    throw new Error(`Expected <mxlibrary> root, got <${root?.nodeName ?? 'none'}>`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(root.textContent ?? '');
  } catch (err) {
    throw new Error(`Library body is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(raw)) {
    throw new Error('Library body must be a JSON array');
  }
  return raw.map((entry: unknown, index): LibraryItem => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Library item ${index} is not an object`);
    }
    const rec = entry as Record<string, unknown>;
    if (typeof rec.xml !== 'string' || !rec.xml.startsWith('<')) {
      throw new Error(`Library item ${index} has no decoded xml`);
    }
    if (!isFiniteNumber(rec.w) || !isFiniteNumber(rec.h)) {
      throw new Error(`Library item ${index} has invalid w/h`);
    }
    const item: LibraryItem = { xml: rec.xml, w: rec.w, h: rec.h };
    if (typeof rec.title === 'string') item.title = rec.title;
    if (typeof rec.aspect === 'string') item.aspect = rec.aspect;
    if (typeof rec.tags === 'string') item.tags = rec.tags;
    return item;
  });
}

/**
 * Adds item-level search tags. draw.io ignores library-level tags, and untitled items
 * would otherwise not be searchable at all.
 */
export function withSearchTags(items: LibraryItem[], prefix: string): LibraryItem[] {
  return items.map((item) => ({
    ...item,
    tags: [prefix, item.title, item.tags].filter((part): part is string => !!part && part.trim() !== '').join(' '),
  }));
}

let libraryPromise: Promise<LibraryItem[]> | null = null;

/** Fetches and parses the ERTMS library (memoized; a failure clears the memo so it can be retried). */
export function loadErtmsLibrary(baseUrl: string = import.meta.env.BASE_URL): Promise<LibraryItem[]> {
  if (!libraryPromise) {
    const url = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${ERTMS_LIBRARY_PATH}`;
    libraryPromise = fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
        const items = withSearchTags(parseMxLibrary(await response.text()), ERTMS_SEARCH_TAGS);
        logger.info('drawio', 'ERTMS library loaded', { items: items.length });
        return items;
      })
      .catch((err: unknown) => {
        libraryPromise = null;
        logger.error('drawio', 'ERTMS library failed to load', {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      });
  }
  return libraryPromise;
}

/** Test helper: forget the memoized library. */
export function resetErtmsLibraryCache(): void {
  libraryPromise = null;
}

/** Builds the draw.io `configure` payload. `null` items => no custom libraries. */
export function buildDrawioConfig(items: LibraryItem[] | null): DrawioConfig {
  const config: DrawioConfig = {
    version: DRAWIO_CONFIG_VERSION,
    settingsName: 'railwaydrawer',
    compressXml: false,
    defaultLibraries: items ? 'general;ertms' : 'general',
    enableCustomLibraries: false,
    appendCustomLibraries: false,
  };
  if (items) {
    config.libraries = [
      {
        title: { main: 'Railway' },
        entries: [
          {
            id: 'ertms',
            title: { main: 'ERTMS' },
            desc: { main: 'ERTMS/ETCS signalling shapes' },
            libs: [{ title: { main: 'ERTMS' }, data: items, expand: true }],
          },
        ],
      },
    ];
  }
  return config;
}
