/**
 * Shape catalogue API over every draw.io library (504 palettes, jgraph/drawio v32.4.1), for code
 * that picks shapes by name, e.g. an assistant: list the libraries, search titles/tags, and get
 * insertable entries (exact draw.io style strings or mxGraphModel XML). Everything is lazy:
 * import this module dynamically; it loads the catalogue, the search index and only the palettes
 * whose entries are returned.
 */
import { loadPalette, loadPaletteCatalogue, loadPaletteSearchIndex } from './index';
import type { PaletteEntry } from './types';

export interface ShapeLibraryInfo {
  id: string;
  title: string;
  /** draw.io's More shapes section (Standard, Software, Networking, Business, Other; '' for legacy). */
  category: string;
  count: number;
  palettes: string[];
  attribution?: string;
}

export interface ShapeSearchResult {
  library: string;
  palette: string;
  entry: PaletteEntry;
}

/** All draw.io libraries with their palettes and entry counts. */
export async function listShapeLibraries(): Promise<ShapeLibraryInfo[]> {
  const cat = await loadPaletteCatalogue();
  const sectionOf = new Map<string, string>();
  for (const c of cat.categories) for (const l of c.libraries) sectionOf.set(l.id, c.title);
  return cat.libraries.map((l) => ({
    id: l.id,
    title: l.title,
    category: sectionOf.get(l.id) ?? '',
    count: l.count,
    palettes: [...l.palettes],
    ...(l.attribution ? { attribution: l.attribution } : {}),
  }));
}

/**
 * Entries whose title or tags contain every word of `query` (case-insensitive), in library order;
 * `libraries` restricts the search (library ids, e.g. ['aws4', 'uml']).
 */
export async function searchShapes(
  query: string,
  opts: { limit?: number; libraries?: string[] } = {},
): Promise<ShapeSearchResult[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const limit = opts.limit ?? 50;
  const [cat, index] = await Promise.all([loadPaletteCatalogue(), loadPaletteSearchIndex()]);
  const libOf = new Map(cat.palettes.map((p) => [p.id, p.library]));
  const only = opts.libraries ? new Set(opts.libraries) : null;
  const hits: Array<{ palette: string; index: number }> = [];
  for (const [palette, lines] of index.palettes) {
    if (only && !only.has(libOf.get(palette) ?? '')) continue;
    lines.forEach((line, i) => {
      if (hits.length >= limit) return;
      const text = line.replace('\t', ' ').toLowerCase();
      if (terms.every((t) => text.includes(t))) hits.push({ palette, index: i });
    });
    if (hits.length >= limit) break;
  }
  const out: ShapeSearchResult[] = [];
  for (const h of hits) {
    const def = await loadPalette(h.palette);
    const entry = def.entries[h.index];
    if (entry) out.push({ library: libOf.get(h.palette) ?? '', palette: h.palette, entry });
  }
  return out;
}

/** One palette's entries (e.g. 'aws4Compute'). */
export async function paletteEntries(paletteId: string): Promise<PaletteEntry[]> {
  return (await loadPalette(paletteId)).entries;
}
