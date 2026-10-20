/**
 * @file ertms-display.ts
 * @brief Display-time clean-up of the ERTMS library palette (public/libraries/ertms.xml stays
 *        byte-identical: it is the draw.io compatibility fixture): titles without stray spaces or
 *        typos ("SIgnal Right 4" -> "Signal Right 4", "Line " -> "Line"), and search tags so the
 *        points entries are found as "switch", "turnout" or "zwrotnica" too.
 *
 * Wraps the palette source given to the palette views in main-editor.ts; the kinds assigned on
 * insert (catalogue.ts kindForLibraryTitle, case-insensitive) match the cleaned titles as before.
 */
import type { LazyPaletteSource, PaletteDef, PaletteEntry } from './drawio-palette';
import { kindForLibraryTitle } from '../railway/catalogue';

/** Search words of the points (turnout) entries, besides their title. */
export const POINTS_SEARCH_TAGS = 'points switch turnout zwrotnica';

/** Title as shown: trimmed (\s also matches non-breaking spaces), single spaces, "SIgnal" -> "Signal". */
export function ertmsDisplayTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([A-Z])([A-Z])([a-z]{2,})\b/g, (_m, first: string, second: string, rest: string) => `${first}${second.toLowerCase()}${rest}`);
}

export function ertmsDisplayEntry(entry: PaletteEntry): PaletteEntry {
  const title = ertmsDisplayTitle(entry.title);
  const points = kindForLibraryTitle(title)?.kind === 'points';
  const tags = points ? [entry.tags, POINTS_SEARCH_TAGS].filter(Boolean).join(' ') : entry.tags;
  return { ...entry, title, ...(tags ? { tags } : {}) };
}

/** The same palette source with cleaned titles and the extra search tags. */
export function withErtmsDisplayTitles(source: LazyPaletteSource): LazyPaletteSource {
  return {
    ...source,
    async load(): Promise<PaletteDef> {
      const def = await source.load();
      return { ...def, entries: def.entries.map(ertmsDisplayEntry) };
    },
  };
}
