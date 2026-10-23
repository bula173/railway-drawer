/**
 * @file ertms-library.ts
 * @brief The ERTMS draw.io library file (public/libraries/ertms.xml): one download per URL and page,
 *        shared by the ERTMS palette and the Templates tab (ui/drawio-palette/ertms-source.ts) and the
 *        features that draw with its symbols (railML import, Railway Script). Core layer, so the
 *        features do not import the palette UI for it.
 */
import { parseMxLibrary } from './engine/mxlibrary';
import type { LibraryEntry } from './engine/mxlibrary';

export const ERTMS_LIBRARY_FILE = 'libraries/ertms.xml';

/** The library file's URL under `baseUrl` (the app's base). */
export function ertmsLibraryUrl(baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${ERTMS_LIBRARY_FILE}`;
}

const textCache = new Map<string, Promise<string>>();

/** The library file's text (cached per URL; a failed download is retried next time). */
export function fetchErtmsLibraryText(baseUrl: string = import.meta.env.BASE_URL): Promise<string> {
  const url = ertmsLibraryUrl(baseUrl);
  let pending = textCache.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
      return response.text();
    });
    pending.catch(() => textCache.delete(url));
    textCache.set(url, pending);
  }
  return pending;
}

/** Test helper: forgets downloaded library files. */
export function resetErtmsLibraryCache(): void {
  textCache.clear();
}

/** All entries of the ERTMS library (elements and scenarios), parsed with the draw.io library parser. */
export async function loadErtmsLibraryEntries(baseUrl: string = import.meta.env.BASE_URL): Promise<LibraryEntry[]> {
  return parseMxLibrary(await fetchErtmsLibraryText(baseUrl));
}
