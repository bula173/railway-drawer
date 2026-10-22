/**
 * @file global-search.ts
 * @brief Search over every draw.io library (loaded on the first search): matches the generated
 *        title/tag index (src/drawio-shapes/palettes/data/search-index.json) and shows the hits of
 *        libraries that are not in the Shapes tab, grouped by library, below the tab's own results.
 *        Palette data is only fetched for the libraries whose tiles are shown.
 */
import { loadPaletteSearchIndex } from '../../drawio-shapes/palettes';
import type { PaletteCatalogue, PaletteSearchIndex } from '../../drawio-shapes/palettes';
import { entrySignature } from './entry-cells';
import type { PaletteViewInternals } from './view-internals';

/** Libraries whose tiles are rendered right away; the others show a "Show results" button. */
export const OPEN_GROUPS = 6;
/** Tiles per library group (the rest: "Show library"). */
export const TILES_PER_GROUP = 24;

export interface LibraryHits {
  library: string;
  title: string;
  /** Matching entries: palette id + entry index, in palette/entry order. */
  hits: Array<{ paletteId: string; index: number }>;
}

let lowered: Map<string, string[]> | null = null;
let loweredFor: PaletteSearchIndex | null = null;

function loweredIndex(index: PaletteSearchIndex): Map<string, string[]> {
  if (lowered && loweredFor === index) return lowered;
  lowered = new Map(index.palettes.map(([id, lines]) => [id, lines.map((l) => l.replace('\t', ' ').toLowerCase())]));
  loweredFor = index;
  return lowered;
}

/** Query terms as the inline filter uses them (lowercase, whitespace separated). */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Entries of the index matching every term (substring of `title tags`, case-insensitive), grouped
 * by draw.io library and sorted by hit count (then catalogue order). Palettes for which `skip`
 * returns true (e.g. those shown in the tab) are left out.
 */
export function searchLibraries(
  index: PaletteSearchIndex,
  catalogue: PaletteCatalogue,
  terms: string[],
  skip: (paletteId: string) => boolean = () => false,
): LibraryHits[] {
  if (terms.length === 0) return [];
  const libOf = new Map(catalogue.palettes.map((p) => [p.id, p.library]));
  const order = new Map(catalogue.libraries.map((l, i) => [l.id, i]));
  const titles = new Map(catalogue.libraries.map((l) => [l.id, l.title]));
  const groups = new Map<string, LibraryHits>();
  for (const [paletteId, lines] of loweredIndex(index)) {
    if (skip(paletteId)) continue;
    const library = libOf.get(paletteId);
    if (!library) continue;
    lines.forEach((text, i) => {
      if (!terms.every((t) => text.includes(t))) return;
      let g = groups.get(library);
      if (!g) {
        g = { library, title: titles.get(library) ?? library, hits: [] };
        groups.set(library, g);
      }
      g.hits.push({ paletteId, index: i });
    });
  }
  return [...groups.values()].sort((a, b) => b.hits.length - a.hits.length || (order.get(a.library) ?? 0) - (order.get(b.library) ?? 0));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function fillGroup(body: HTMLElement, group: LibraryHits, ctx: PaletteViewInternals, seen: Set<string>, isCurrent: () => boolean): Promise<void> {
  body.replaceChildren(el('div', 'rd-dp-empty', 'Loading…'));
  const hits = group.hits.slice(0, TILES_PER_GROUP * 2);
  const palettes = [...new Set(hits.map((h) => h.paletteId))];
  const entries = new Map<string, Awaited<ReturnType<PaletteViewInternals['loadEntries']>>>();
  await Promise.all(palettes.map(async (id) => entries.set(id, await ctx.loadEntries(id))));
  if (!isCurrent()) return;
  body.replaceChildren();
  let shown = 0;
  for (const h of hits) {
    if (shown >= TILES_PER_GROUP) break;
    const entry = entries.get(h.paletteId)?.[h.index];
    if (!entry) continue;
    const sig = entrySignature(entry);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const tile = ctx.createTile(h.paletteId, entry);
    if (!tile) continue;
    body.appendChild(tile);
    shown++;
  }
  if (shown === 0) body.appendChild(el('div', 'rd-dp-empty', 'Already shown above'));
}

/** Renders the grouped results of `query` into `host` (hidden when nothing matches). */
export async function renderGlobalSearch(
  host: HTMLElement,
  query: string,
  ctx: PaletteViewInternals,
  isCurrent: () => boolean,
): Promise<void> {
  const terms = searchTerms(query);
  const catalogue = ctx.catalogue;
  if (terms.length === 0 || !catalogue) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  const index = await loadPaletteSearchIndex();
  if (!isCurrent()) return;
  const groups = searchLibraries(index, catalogue, terms, (id) => ctx.isPaletteVisible(id));
  host.replaceChildren();
  if (groups.length === 0) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  host.appendChild(el('div', 'rd-dp-sr-title', `In other draw.io libraries: ${total} shape${total === 1 ? '' : 's'}`));
  const seen = ctx.shownSignatures();
  const pending: Promise<void>[] = [];
  groups.forEach((group, i) => {
    const section = el('section', 'rd-dp-sr-group');
    section.dataset.library = group.library;
    const header = el('div', 'rd-dp-sr-header');
    header.appendChild(el('span', 'rd-dp-sr-library', `${group.title} (${group.hits.length})`));
    const show = el('button', 'rd-dp-sr-show', 'Show library');
    show.type = 'button';
    show.title = `Add "${group.title}" to the Shapes tab`;
    show.addEventListener('click', () => ctx.revealPalette(group.hits[0].paletteId));
    header.appendChild(show);
    const body = el('div', 'rd-dp-body rd-dp-sr-body');
    section.append(header, body);
    host.appendChild(section);
    if (i < OPEN_GROUPS) {
      pending.push(fillGroup(body, group, ctx, seen, isCurrent));
    } else {
      const more = el('button', 'rd-dp-sr-more', `Show ${group.hits.length} result${group.hits.length === 1 ? '' : 's'}`);
      more.type = 'button';
      more.addEventListener('click', () => void fillGroup(body, group, ctx, seen, isCurrent));
      body.appendChild(more);
    }
  });
  await Promise.all(pending);
}
