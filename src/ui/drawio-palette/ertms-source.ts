/**
 * @file ertms-source.ts
 * @brief The default ERTMS palette: public/libraries/ertms.xml parsed with the engine's
 *        parseMxLibrary and adapted with libraryToPaletteDef (contract 5).
 *
 * The palette shows only the simple elements; the complex scenario diagrams of the same file are
 * the built-in "ERTMS templates" of the Templates tab (`loadErtmsTemplates`, classification in
 * src/ui/templates/ertms-templates.ts). Entry ids keep the library index (`ertms-<index>-<slug>`),
 * so they stay stable when the palette's selection of entries changes.
 */
import type { LazyPaletteSource } from './drawio-palette-view';
import { getDrawioPaletteEngine } from './drawio-palette-view';
import { libraryToPaletteDef } from './library-adapter';
import type { LibraryEntry, PaletteDef } from './contracts';
import { splitErtmsLibrary } from '../templates/ertms-templates';
import type { DiagramTemplate } from '../templates/template-types';
import { ERTMS_LIBRARY_FILE, fetchErtmsLibraryText, resetErtmsLibraryCache } from '../../drawio-shapes/ertms-library';

export { ERTMS_LIBRARY_FILE, resetErtmsLibraryCache };

/** All entries of the ERTMS library (elements and scenarios). */
export async function loadErtmsLibraryEntries(baseUrl: string = import.meta.env.BASE_URL): Promise<LibraryEntry[]> {
  return getDrawioPaletteEngine().parseMxLibrary(await fetchErtmsLibraryText(baseUrl));
}

/** Palette definition with only the simple ERTMS elements (ids keep the library index). */
export function ertmsElementsPaletteDef(entries: LibraryEntry[]): PaletteDef {
  const def = libraryToPaletteDef(entries, { id: 'ertms', title: 'ERTMS', tags: 'ertms etcs', source: ERTMS_LIBRARY_FILE });
  const keep = new Set(splitErtmsLibrary(entries).elements.map((e) => e.index));
  // entry.source is `<file>#<library index>` (entries without xml/data are skipped by the adapter)
  return { ...def, entries: def.entries.filter((entry) => keep.has(Number(entry.source.slice(entry.source.lastIndexOf('#') + 1)))) };
}

/** The built-in ERTMS templates (complex scenario diagrams of the library). */
export async function loadErtmsTemplates(baseUrl: string = import.meta.env.BASE_URL): Promise<DiagramTemplate[]> {
  return splitErtmsLibrary(await loadErtmsLibraryEntries(baseUrl)).templates;
}

/** Lazy palette source for the ERTMS library elements, served under `baseUrl` (default BASE_URL). */
export function ertmsPaletteSource(baseUrl: string = import.meta.env.BASE_URL): LazyPaletteSource {
  return {
    id: 'ertms',
    title: 'ERTMS',
    defaultVisible: true,
    async load() {
      return ertmsElementsPaletteDef(await loadErtmsLibraryEntries(baseUrl));
    },
  };
}
