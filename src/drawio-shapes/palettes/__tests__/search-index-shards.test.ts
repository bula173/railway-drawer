/**
 * The all-libraries search index is served as shards (data/search/*.json, loaded on the first
 * search): the merged index and the results of both searches (Shapes tab global search,
 * `searchShapes` used by the AI tools) must be identical to the former single search-index.json.
 * fixtures/search-golden.json holds the results computed from that file before the split (regenerate
 * it only together with a deliberate palette regeneration, scripts/drawio-palettes).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadPaletteCatalogue, loadPaletteSearchIndex } from '..';
import { searchShapes } from '../shape-catalogue';
import { searchLibraries, searchTerms } from '../../../ui/drawio-palette/global-search';

const GOLDEN = 'src/drawio-shapes/palettes/__tests__/fixtures/search-golden.json';
const QUERIES = [
  'rectangle', 'Rect  Box', 'signal', 'aws lambda', 'server', 'arrow', 'cloud', 'user', 'database', 'switch',
  'train', 'cisco router', 'kubernetes', 'flow', 'a', 'e', 'bpmn task', 'uml class', 'azure', 'network',
  'ż', 'zzzzqx', 'mxgraph', '1',
];

interface GoldenEntry {
  index: { palettes: number; lines: number; sha: string };
  global: Record<string, { groups: number; hits: number; sha: string; first: string[] }>;
  shapes: Record<string, string[]>;
}

const sha = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex');

async function compute(): Promise<GoldenEntry> {
  const [index, catalogue] = await Promise.all([loadPaletteSearchIndex(), loadPaletteCatalogue()]);
  const out: GoldenEntry = {
    index: { palettes: index.palettes.length, lines: index.palettes.reduce((n, [, l]) => n + l.length, 0), sha: sha(index.palettes) },
    global: {},
    shapes: {},
  };
  for (const q of QUERIES) {
    const groups = searchLibraries(index, catalogue, searchTerms(q));
    const flat = groups.flatMap((g) => g.hits.map((h) => `${g.library}/${h.paletteId}#${h.index}`));
    out.global[q] = { groups: groups.length, hits: flat.length, sha: sha(groups), first: flat.slice(0, 10) };
    out.shapes[q] = (await searchShapes(q, { limit: 25 })).map((r) => `${r.library}/${r.palette}:${r.entry.title}`);
  }
  return out;
}

describe('search index shards', () => {
  it('give the same index and the same search results as the single file did', async () => {
    const now = await compute();
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as GoldenEntry;
    expect(now.index).toEqual(golden.index);
    expect(now.global).toEqual(golden.global);
    expect(now.shapes).toEqual(golden.shapes);
  }, 60_000);
});
