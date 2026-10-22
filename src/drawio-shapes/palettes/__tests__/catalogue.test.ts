/**
 * The generated draw.io catalogue (all v32.4.1 sidebar palettes): consistency of catalogue.json,
 * search-index.json and the palette files, lazy loading, the global search, notices for vendor
 * icon sets and the vendored stencils/images the entries reference.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasPalette, loadPalette, loadPaletteCatalogue, loadPaletteSearchIndex, paletteFileName } from '..';
import type { PaletteCatalogue, PaletteSearchIndex } from '..';
import { searchLibraries, searchTerms } from '../../../ui/drawio-palette/global-search';

const DATA = 'src/drawio-shapes/palettes/data';

describe('draw.io catalogue', () => {
  it('lists every generated palette with its library, counts matching the palette files', async () => {
    const cat: PaletteCatalogue = await loadPaletteCatalogue();
    expect(cat.drawioTag).toBe('v32.4.1');
    expect(cat.palettes.length).toBe(504);
    const files = readdirSync(DATA).filter((f) => f.endsWith('.json') && f !== 'catalogue.json' && f !== 'search-index.json');
    expect(files.length).toBe(cat.palettes.length);
    const libs = new Map(cat.libraries.map((l) => [l.id, l]));
    let total = 0;
    for (const p of cat.palettes) {
      expect(p.file).toBe(paletteFileName(p.id));
      expect(await hasPalette(p.id)).toBe(true);
      expect(libs.get(p.library)?.palettes).toContain(p.id);
      const def = JSON.parse(readFileSync(`${DATA}/${p.file}.json`, 'utf8')) as { id: string; entries: unknown[] };
      expect(def.id).toBe(p.id);
      expect(def.entries.length).toBe(p.count);
      total += p.count;
    }
    expect(total).toBe(13971);
    for (const l of cat.libraries) expect(l.count).toBe(l.palettes.reduce((n, id) => n + (cat.palettes.find((p) => p.id === id)?.count ?? 0), 0));
    // draw.io's More shapes sections
    expect(cat.categories.map((c) => c.title)).toEqual(['Standard', 'Software', 'Networking', 'Business', 'Other']);
    for (const id of ['uml', 'bpmn2', 'aws4', 'azure2', 'gcp2', 'cisco19', 'kubernetes', 'er', 'mockups', 'electrical', 'pid', 'archimate3']) {
      expect(libs.has(id)).toBe(true);
    }
  });

  it('loads a palette lazily by id, including ids that are not file names', async () => {
    const uml = await loadPalette('uml');
    expect(uml.entries.find((e) => e.title === 'Actor')?.style).toBe('shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;');
    const general = await loadPalette('aws4General Resources');
    expect(general.id).toBe('aws4General Resources');
    expect(paletteFileName('aws4General Resources')).toBe('p-aws4general-resources');
    await expect(loadPalette('no-such-palette')).rejects.toThrow(/Unknown/);
  });

  it('search index lines match the palette entries (title + tags, entry order)', async () => {
    const index: PaletteSearchIndex = await loadPaletteSearchIndex();
    const cat = await loadPaletteCatalogue();
    expect(index.palettes.length).toBe(cat.palettes.length);
    for (const id of ['uml', 'aws4Compute', 'bpmn2Tasks', 'cisco19Routing WAN']) {
      const lines = index.palettes.find(([p]) => p === id)![1];
      const def = await loadPalette(id);
      expect(lines.length).toBe(def.entries.length);
      def.entries.forEach((e, i) => expect(lines[i]).toBe(`${e.title}\t${e.tags ?? ''}`));
    }
  });

  it('global search finds "actor", "lambda" and "router", grouped by library', async () => {
    const index = await loadPaletteSearchIndex();
    const cat = await loadPaletteCatalogue();
    const libs = (q: string): string[] => searchLibraries(index, cat, searchTerms(q)).map((g) => g.library);
    expect(libs('actor')).toContain('uml');
    expect(libs('lambda')).toContain('aws4');
    expect(libs('router')).toEqual(expect.arrayContaining(['cisco', 'cisco19']));
    expect(libs('')).toEqual([]);
    // groups are sorted by hit count; skipped palettes do not count
    const groups = searchLibraries(index, cat, ['router']);
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].hits.length).toBeGreaterThanOrEqual(groups[i].hits.length);
    const withoutCisco = searchLibraries(index, cat, ['router'], (id) => id.startsWith('cisco'));
    expect(withoutCisco.map((g) => g.library)).not.toContain('cisco');
    // every term must match (title or tags)
    const lambda = groups.length > 0 ? searchLibraries(index, cat, ['lambda', 'function']) : [];
    expect(lambda.flatMap((g) => g.hits).length).toBeGreaterThan(0);
  });

  it('vendor icon sets carry an attribution and a notice file', async () => {
    const cat = await loadPaletteCatalogue();
    for (const id of ['aws4', 'azure2', 'gcp2', 'cisco', 'ibm', 'alibaba_cloud', 'salesforce', 'veeam2', 'citrix2', 'kubernetes', 'sap', 'office']) {
      const lib = cat.libraries.find((l) => l.id === id)!;
      expect(lib.attribution, id).toMatch(/trademark/i);
      expect(existsSync(lib.notice!), lib.notice).toBe(true);
    }
    expect(cat.libraries.find((l) => l.id === 'uml')?.notice).toBeUndefined();
  });

  it('every stencil set and image the entries reference is vendored', async () => {
    const cat = await loadPaletteCatalogue();
    const missing = new Set<string>();
    for (const p of cat.palettes) {
      const text = readFileSync(`${DATA}/${p.file}.json`, 'utf8');
      for (const m of text.matchAll(/image=(img\/[^;"\\&=]+\.(?:svg|png|jpe?g|gif))/gi)) {
        if (!existsSync(`public/${m[1]}`)) missing.add(m[1]);
      }
    }
    expect([...missing]).toEqual([]);
    const index = JSON.parse(readFileSync('src/drawio-shapes/vendor/index.json', 'utf8')) as {
      libraries: Record<string, { stencils: string[] }>;
    };
    for (const lib of Object.values(index.libraries)) for (const f of lib.stencils) expect(existsSync(`public/stencils/${f}`), f).toBe(true);
  });
});
