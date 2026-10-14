/**
 * @file ertms-source.ts
 * @brief The default ERTMS palette: public/libraries/ertms.xml parsed with the engine's
 *        parseMxLibrary and adapted with libraryToPaletteDef (contract 5).
 */
import type { LazyPaletteSource } from './drawio-palette-view';
import { getDrawioPaletteEngine } from './drawio-palette-view';
import { libraryToPaletteDef } from './library-adapter';

export const ERTMS_LIBRARY_FILE = 'libraries/ertms.xml';

/** Lazy palette source for the ERTMS library, served under `baseUrl` (default BASE_URL). */
export function ertmsPaletteSource(baseUrl: string = import.meta.env.BASE_URL): LazyPaletteSource {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = `${base}${ERTMS_LIBRARY_FILE}`;
  return {
    id: 'ertms',
    title: 'ERTMS',
    defaultVisible: true,
    async load() {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
      const entries = getDrawioPaletteEngine().parseMxLibrary(await response.text());
      return libraryToPaletteDef(entries, { id: 'ertms', title: 'ERTMS', tags: 'ertms etcs', source: ERTMS_LIBRARY_FILE });
    },
  };
}
