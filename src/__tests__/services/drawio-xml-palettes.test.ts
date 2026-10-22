/**
 * Every draw.io palette entry (src/drawio-shapes/palettes/data, jgraph/drawio v32.4.1) and every
 * entry of the ERTMS library (public/libraries/ertms.xml) survives the app's save path with its
 * draw.io style unchanged, byte for byte: inserted/imported -> exported like SaveLoadController
 * (tab stylesheet with draw.io defaults) -> re-imported -> exported again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Graph, GraphDataModel } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import {
  DRAWIO_SHAPE_MAP,
  applyDrawioDefaultStyles,
  exportModelToDrawioXml,
  importDrawioXmlIntoModel,
  legacyMxArrowsToDrawio,
  registerDrawioNamedStyles,
} from '../../services/drawio-xml';
import { createCellsForEntry, wrapModelXml } from '../../ui/drawio-palette';
import type { PaletteDef, PaletteEntry } from '../../drawio-shapes/palettes';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { LEGACY_MXARROWS_TO_DRAWIO } from '../../shapes/drawio-arrows/registry';

const ROOT = path.resolve(__dirname, '../../..');
const DATA = path.join(ROOT, 'src/drawio-shapes/palettes/data');

const palettes: PaletteDef[] = fs
  .readdirSync(DATA)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) as PaletteDef);

const ertmsEntries = parseMxLibrary(fs.readFileSync(path.join(ROOT, 'public/libraries/ertms.xml'), 'utf8'));

let graph: Graph;
let host: HTMLElement;

beforeAll(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  graph = new Graph(host);
  // as TabManager.createTab
  applyDrawioDefaultStyles(graph.getStylesheet());
  registerDrawioNamedStyles(graph.getStylesheet());
});

afterAll(() => {
  graph.destroy();
  host.remove();
});

/** Export as SaveLoadController.serializeToXml does. */
function save(model: GraphDataModel): string {
  return exportModelToDrawioXml(model, { stylesheet: graph.getStylesheet(), htmlLabels: graph.isHtmlLabels() });
}

function load(xml: string): GraphDataModel {
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(xml, model);
  return model;
}

/** Style attribute of every mxCell (by id) of a model XML; cells without style are left out. */
function stylesById(xml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = new Map<string, string>();
  for (const el of Array.from(doc.getElementsByTagName('mxCell'))) {
    const style = el.getAttribute('style');
    const id = el.getAttribute('id') ?? el.parentElement?.getAttribute('id');
    if (style !== null && id) out.set(id, style);
  }
  return out;
}

function modelWith(cells: Cell[]): GraphDataModel {
  const model = new GraphDataModel();
  const parent = model.getRoot()!.getChildAt(0);
  model.beginUpdate();
  try {
    cells.forEach((cell, i) => model.add(parent, cell, i));
  } finally {
    model.endUpdate();
  }
  return model;
}

const styleEntries: Array<[string, PaletteEntry]> = [];
const xmlEntries: Array<[string, PaletteEntry]> = [];
for (const palette of palettes) {
  for (const entry of palette.entries) {
    if (entry.kind === 'cells' || (!entry.style && entry.xml)) xmlEntries.push([entry.id, entry]);
    else styleEntries.push([entry.id, entry]);
  }
}

describe('draw.io palette entries round-trip through the save path', () => {
  it('covers every palette entry', () => {
    const total = palettes.reduce((n, p) => n + p.entries.length, 0);
    expect(styleEntries.length + xmlEntries.length).toBe(total);
    expect(total).toBe(307);
  });

  it.each(styleEntries)('%s keeps its style verbatim', (_id, entry) => {
    const cells = createCellsForEntry(entry);
    cells[0].setId('c');
    const first = save(modelWith(cells));
    expect(stylesById(first).get('c') ?? '').toBe(entry.style ?? '');
    // open the saved file and save it again: unchanged
    expect(save(load(first))).toBe(first);
  });

  it.each(xmlEntries)('%s keeps the styles of all its cells verbatim', (_id, entry) => {
    const original = stylesById(wrapModelXml(entry.xml!));
    const first = save(load(wrapModelXml(entry.xml!)));
    const written = stylesById(first);
    for (const [id, style] of original) expect(written.get(id), `cell ${id}`).toBe(style);
    expect(save(load(first))).toBe(first);
  });
});

describe('ERTMS library (public/libraries/ertms.xml) round-trips', () => {
  it('has the 37 tiles', () => {
    expect(ertmsEntries).toHaveLength(37);
  });

  it.each(ertmsEntries.map((e, i) => [i, e] as const))('entry %i keeps its draw.io styles', (_i, entry) => {
    expect(entry.xml).toBeTruthy();
    const xml = wrapModelXml(entry.xml!);
    const original = stylesById(xml);
    expect(original.size).toBeGreaterThan(0);
    const first = save(load(xml));
    const written = stylesById(first);
    for (const [id, style] of original) expect(written.get(id), `cell ${id}`).toBe(style);
    expect(save(load(first))).toBe(first);
  });
});

describe('DRAWIO_SHAPE_MAP', () => {
  it('maps only legacy app shapes (draw.io names are native and never remapped)', () => {
    const drawioNames = new Set(palettes.flatMap((p) => p.entries.flatMap((e) => e.shapeNames)));
    for (const key of Object.keys(DRAWIO_SHAPE_MAP)) {
      expect(drawioNames.has(key), key).toBe(false);
      expect(key.startsWith('mxgraph.')).toBe(false);
    }
  });

  it('writes legacy mxarrows.* keys with their real draw.io names', () => {
    for (const [legacy, drawio] of Object.entries(LEGACY_MXARROWS_TO_DRAWIO)) {
      expect(legacyMxArrowsToDrawio(legacy)).toBe(drawio);
    }
    expect(legacyMxArrowsToDrawio('mxgraph.arrows2.arrow')).toBeNull();
    const cell = createCellsForEntry({
      id: 'x', title: '', kind: 'vertex', width: 80, height: 40, style: 'shape=mxarrows.Arrows2Arrow;fillColor=#ff0000;',
      shapeNames: [], cls: 'd', source: '',
    })[0];
    cell.setId('a');
    expect(stylesById(save(modelWith([cell]))).get('a')).toBe('shape=mxgraph.arrows2.arrow;fillColor=#ff0000;');
  });
});
