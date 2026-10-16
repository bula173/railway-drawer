import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DRAWIO_TAG,
  PALETTES,
  getBasenameForStencil,
  loadPalette,
  paletteStencilBasenames,
  stencilBasenamesForShapes,
} from '../index';
import type { PaletteDef, PaletteEntry } from '../types';

const ROOT = resolve(__dirname, '../../../..');
const EXPECTED_COUNTS: Record<string, number> = {
  general: 45, misc: 54, advanced: 33, basic: 76, arrows2: 31, arrows: 34, flowchart: 34,
};
const STENCIL_FILES = ['basic.xml', 'flowchart.xml', 'arrows.xml', 'mscae/enterprise.xml'];

/** Registered stencil names, using draw.io's lowercase(pkg) + '.' + lowercase(name with ' ' -> '_') rule. */
function stencilNames(): Set<string> {
  const names = new Set<string>();
  for (const file of STENCIL_FILES) {
    const text = readFileSync(resolve(ROOT, 'public/stencils', file), 'utf8');
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    expect(doc.getElementsByTagName('parsererror').length, file).toBe(0);
    const root = doc.documentElement;
    expect(root.nodeName).toBe('shapes');
    const pkg = (root.getAttribute('name') ?? '').toLowerCase();
    for (let n = root.firstElementChild; n; n = n.nextElementSibling) {
      const name = n.getAttribute('name');
      if (name) names.add(pkg + '.' + name.replace(/ /g, '_').toLowerCase());
    }
  }
  return names;
}

function assertEntry(e: PaletteEntry, paletteId: string): void {
  expect(typeof e.id).toBe('string');
  expect(e.id.startsWith(paletteId + '-')).toBe(true);
  expect(typeof e.title).toBe('string');
  expect(['vertex', 'edge', 'cells']).toContain(e.kind);
  expect(Number.isFinite(e.width)).toBe(true);
  expect(Number.isFinite(e.height)).toBe(true);
  expect(['a', 'b', 'c', 'd']).toContain(e.cls);
  expect(Array.isArray(e.shapeNames)).toBe(true);
  expect(e.source).toMatch(/^[\w./-]+\.js:\d+$/);
  if (e.tags !== undefined) expect(typeof e.tags).toBe('string');
  if (e.value !== undefined) expect(typeof e.value).toBe('string');
  if (e.kind === 'cells') {
    expect(e.style).toBeUndefined();
    expect(e.xml).toMatch(/^<mxGraphModel[\s>]/);
    const doc = new DOMParser().parseFromString(e.xml as string, 'text/xml');
    expect(doc.getElementsByTagName('parsererror').length, e.id).toBe(0);
  } else {
    expect(typeof e.style).toBe('string');
    expect(e.xml).toBeUndefined();
  }
}

describe('draw.io palette data', () => {
  const ids = Object.keys(EXPECTED_COUNTS);

  it('PALETTES lists the palettes in draw.io order, legacy arrows hidden', () => {
    expect(PALETTES.map((p) => p.id)).toEqual(['general', 'misc', 'advanced', 'basic', 'arrows2', 'flowchart', 'arrows']);
    expect(PALETTES.filter((p) => !p.defaultVisible).map((p) => p.id)).toEqual(['arrows']);
  });

  it.each(ids)('%s validates against the types and has the extracted entry count', async (id) => {
    const def: PaletteDef = await loadPalette(id);
    expect(def.id).toBe(id);
    expect(def.drawioTag).toBe(DRAWIO_TAG);
    expect(def.source).toMatch(/^[\w./-]+\.js:\d+$/);
    expect(def.entries).toHaveLength(EXPECTED_COUNTS[id]);
    for (const e of def.entries) assertEntry(e, id);
  });

  it('entry ids are unique across all palettes', async () => {
    const all = (await Promise.all(ids.map((id) => loadPalette(id)))).flatMap((d) => d.entries.map((e) => e.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('every cls b shape name exists in the vendored stencil XML', async () => {
    const names = stencilNames();
    for (const id of ids) {
      const def = await loadPalette(id);
      for (const e of def.entries.filter((x) => x.cls === 'b')) {
        expect(e.shapeNames.length, e.id).toBeGreaterThan(0);
        for (const n of e.shapeNames) expect(names.has(n.toLowerCase()), `${e.id}: ${n}`).toBe(true);
      }
    }
  });

  it('contains the stencils the ERTMS library needs', () => {
    const names = stencilNames();
    expect(names.has('mxgraph.mscae.enterprise.wireless_connection')).toBe(true);
    expect(names.has('mxgraph.basic.flash')).toBe(true);
  });

  it('paletteStencilBasenames matches the stencil shapes of each palette', async () => {
    for (const id of ids) {
      const def = await loadPalette(id);
      const stencilShapes = def.entries.filter((e) => e.cls === 'b').flatMap((e) => e.shapeNames);
      expect(paletteStencilBasenames(id).sort(), id).toEqual(stencilBasenamesForShapes(stencilShapes).sort());
    }
    expect(paletteStencilBasenames('nope')).toEqual([]);
  });

  it('getBasenameForStencil follows draw.io', () => {
    expect(getBasenameForStencil('mxgraph.basic.flash')).toBe('basic');
    expect(getBasenameForStencil('mxgraph.mscae.enterprise.wireless_connection')).toBe('mscae/enterprise');
    expect(getBasenameForStencil('process')).toBeNull();
    expect(getBasenameForStencil(null)).toBeNull();
  });

  it('keeps draw.io styles and sizes exactly (spot checks)', async () => {
    const general = await loadPalette('general');
    expect(general.entries[0]).toMatchObject({ title: 'Rectangle', width: 120, height: 60, style: 'rounded=0;whiteSpace=wrap;html=1;', cls: 'a' });
    const basic = await loadPalette('basic');
    expect(basic.entries[0]).toMatchObject({ title: 'Partial Rectangle', width: 120, height: 60, shapeNames: ['mxgraph.basic.rect'], cls: 'c' });
    const misc = await loadPalette('misc');
    expect(misc.entries.filter((e) => e.kind === 'cells' && /tableRow/.test(e.xml ?? ''))).not.toHaveLength(0);
  });

  it('rejects unknown palette ids', async () => {
    await expect(loadPalette('__proto__')).rejects.toThrow();
  });
});
