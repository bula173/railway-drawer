/**
 * Every entry of every other draw.io palette (497 palettes beyond the 7 of drawio-xml-palettes.test.ts,
 * jgraph/drawio v32.4.1) keeps its draw.io style unchanged, byte for byte, through the save path:
 * inserted -> exported like SaveLoadController (tab stylesheet with draw.io defaults) -> re-imported ->
 * exported again (stable). Composite entries keep the styles of all their cells.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Graph, GraphDataModel } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import {
  applyDrawioDefaultStyles,
  exportModelToDrawioXml,
  importDrawioXmlIntoModel,
  registerDrawioNamedStyles,
} from '../../services/drawio-xml';
import { createCellsForEntry, wrapModelXml } from '../../ui/drawio-palette';
import type { PaletteDef } from '../../drawio-shapes/palettes';

const ROOT = path.resolve(__dirname, '../../..');
const DATA = path.join(ROOT, 'src/drawio-shapes/palettes/data');
const CORE = new Set(['general', 'misc', 'advanced', 'basic', 'arrows2', 'flowchart', 'arrows'].map((id) => `${id}.json`));
const files = fs.readdirSync(DATA)
  .filter((f) => f.endsWith('.json') && !CORE.has(f) && f !== 'catalogue.json')
  .sort();

let graph: Graph;
let host: HTMLElement;

beforeAll(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  graph = new Graph(host);
  applyDrawioDefaultStyles(graph.getStylesheet());
  registerDrawioNamedStyles(graph.getStylesheet());
});

afterAll(() => {
  graph.destroy();
  host.remove();
});

function save(model: GraphDataModel): string {
  return exportModelToDrawioXml(model, { stylesheet: graph.getStylesheet(), htmlLabels: graph.isHtmlLabels() });
}

function load(xml: string): GraphDataModel {
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(xml, model);
  return model;
}

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

describe('all draw.io palettes round-trip through the save path', () => {
  it('covers the 497 other palettes', () => {
    expect(files.length).toBe(497);
  });

  it.each(files)('%s: every entry keeps its styles verbatim', (file) => {
    const def = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')) as PaletteDef;
    const failures: string[] = [];
    for (const entry of def.entries) {
      try {
        if (entry.kind === 'cells' || (!entry.style && entry.xml)) {
          const original = stylesById(wrapModelXml(entry.xml!));
          const written = stylesById(save(load(wrapModelXml(entry.xml!))));
          for (const [id, style] of original) if (written.get(id) !== style) failures.push(`${entry.id} cell ${id}`);
        } else {
          const cells = createCellsForEntry(entry);
          cells[0].setId('c');
          const first = save(modelWith(cells));
          if ((stylesById(first).get('c') ?? '') !== (entry.style ?? '')) failures.push(`${entry.id}: style changed`);
          else if (save(load(first)) !== first) failures.push(`${entry.id}: second save differs`);
        }
      } catch (err) {
        failures.push(`${entry.id}: ${(err as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
