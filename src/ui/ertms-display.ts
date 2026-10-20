/**
 * @file ertms-display.ts
 * @brief Display-time clean-up of the ERTMS library palette (public/libraries/ertms.xml stays
 *        byte-identical: it is the draw.io compatibility fixture): titles without stray spaces or
 *        typos ("SIgnal Right 4" -> "Signal Right 4", "Line " -> "Line"), and railway search tags in
 *        English and Polish (points = "switch", "turnout", "zwrotnica"; signal = "semafor", ...).
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

/**
 * Railway synonyms (EN + PL, with and without Polish diacritics) by railway kind or title word.
 * An entry gets the tags of its kind (catalogue.ts) and of every title word listed here.
 */
export const RAILWAY_SEARCH_TAGS: Readonly<Record<string, string>> = {
  signal: 'signal semafor sygnalizator',
  balise: 'balise balisa eurobalise',
  points: POINTS_SEARCH_TAGS,
  axleCounter: 'axle counter licznik osi',
  bufferStop: 'buffer stop kozioł koziol',
  track: 'track tor',
  trackSection: 'track circuit tc obwód torowy obwod',
  levelCrossing: 'level crossing przejazd',
  leu: 'leu lineside electronic unit',
  rbc: 'rbc radio block centre center',
  train: 'train pociąg pociag',
  ma: 'movement authority ma',
};

/** Title words (lower case) that select a synonym group, besides the catalogue kind. */
const TITLE_WORD_TAGS: Readonly<Record<string, keyof typeof RAILWAY_SEARCH_TAGS>> = {
  signal: 'signal',
  balise: 'balise',
  point: 'points',
  points: 'points',
  axle: 'axleCounter',
  buffer: 'bufferStop',
  track: 'track',
  tc: 'trackSection',
  crossing: 'levelCrossing',
  leu: 'leu',
  rbc: 'rbc',
  train: 'train',
  ma: 'ma',
};

/** Search tags of an entry with this (display) title: its own words' and its kind's synonyms. */
export function railwaySearchTags(title: string): string {
  const groups = new Set<string>();
  const kind = kindForLibraryTitle(title)?.kind;
  if (kind && kind in RAILWAY_SEARCH_TAGS) groups.add(kind);
  for (const word of title.toLowerCase().split(/[^a-z0-9]+/)) {
    const group = TITLE_WORD_TAGS[word];
    if (group) groups.add(group);
  }
  return [...groups].map((g) => RAILWAY_SEARCH_TAGS[g]).join(' ');
}

export function ertmsDisplayEntry(entry: PaletteEntry): PaletteEntry {
  const title = ertmsDisplayTitle(entry.title);
  const tags = [entry.tags, railwaySearchTags(title)].filter(Boolean).join(' ');
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
