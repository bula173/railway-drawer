/**
 * @file drawio-compat.test.ts
 * @brief The draw.io compatibility guard.
 *
 * The embedded draw.io editor was removed; draw.io compatibility is the file format and the shapes.
 * These tests take files in draw.io's own format (fixtures/drawio/: draw.io 24 desktop layout with
 * compressed and plain <diagram> pages, several pages, layers, groups, edges with waypoints and labels,
 * <object>/<UserObject> with attributes and placeholders, core shapes and stencils, scenario pages;
 * the existing src/__tests__/fixtures/drawio/ files; the real ERTMS draw.io library) through the app's
 * File > Open / File > Save path (SaveLoadController.loadProjectXml -> getProjectXml) and require:
 * - the saved file is valid draw.io XML (<mxfile>, one <diagram> per page, mxGraphModel/root with cells 0 and 1),
 * - the round trip is semantically lossless (pages, page ids/names, cells, ids, parents, terminals,
 *   values, wrapper attributes, styles, geometry, page settings) and stable from the first save on,
 * - libraries (<mxlibrary>, plain/escaped/compressed entries) and #R share links keep working.
 * Never weaken these assertions to make a change pass: fix the change instead.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { inflateRawSync } from 'zlib';
import { Cell, Geometry } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import {
  installUserObjectLabels,
  parseStyleString,
  registerDrawioCodecs,
  registerDrawioNamedStyles,
} from '../drawio-xml';
import { SaveLoadController } from '../../ui/saveload';
import { registerErtmsShapes } from '../../shapes/ertms';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { decodeShareHash, encodeShareData } from '../../share/share-link';
import { splitSharedFile } from '../../share/share-mxfile';
import { createTestGraph, cleanupTestGraph } from '../../__tests__/setup';

const FIXTURES = resolve(__dirname, 'fixtures/drawio');
const OLD_FIXTURES = resolve(__dirname, '../../__tests__/fixtures/drawio');
const read = (dir: string, name: string): string => readFileSync(resolve(dir, name), 'utf8');
const ERTMS_LIBRARY = readFileSync(resolve(__dirname, '../../../public/libraries/ertms.xml'), 'utf8');

const parseXml = (xml: string): Document => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
};

/** draw.io's page compression: base64 -> raw deflate -> URI-encoded XML. */
const decompressPage = (text: string): string =>
  decodeURIComponent(inflateRawSync(Buffer.from(text.replace(/\s+/g, ''), 'base64')).toString('utf8'));

interface Page {
  id: string | null;
  name: string | null;
  /** <diagram> attributes other than id/name. */
  attributes: Record<string, string>;
  compressed: boolean;
  model: Element;
}

function attributesOf(el: Element, skip: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) if (!skip.includes(attr.name)) out[attr.name] = attr.value;
  return out;
}

/** The pages of an <mxfile>, compressed ones decoded. Asserts draw.io's file structure. */
function pagesOf(fileXml: string): Page[] {
  const doc = parseXml(fileXml);
  const mxfile = doc.documentElement;
  expect(mxfile.nodeName).toBe('mxfile');
  const children = Array.from(mxfile.children);
  expect(children.length).toBeGreaterThan(0);
  expect(children.map((c) => c.nodeName).every((n) => n === 'diagram')).toBe(true);
  return children.map((diagram) => {
    const modelEl = Array.from(diagram.children).find((c) => c.nodeName === 'mxGraphModel');
    const compressed = !modelEl;
    const model = modelEl ?? parseXml(decompressPage(diagram.textContent ?? '')).documentElement;
    expect(model.nodeName).toBe('mxGraphModel');
    return {
      id: diagram.getAttribute('id'),
      name: diagram.getAttribute('name'),
      attributes: attributesOf(diagram, ['id', 'name']),
      compressed,
      model,
    };
  });
}

/** Asserts a valid draw.io model: <mxGraphModel><root> with cell 0 (root) and cell 1 (default layer, parent 0). */
function expectValidModel(model: Element, label: string): void {
  expect(model.nodeName, label).toBe('mxGraphModel');
  const root = Array.from(model.children).find((c) => c.nodeName === 'root');
  expect(root, `${label} <root>`).toBeTruthy();
  const cells = Array.from(root!.children);
  const ids = cells.map((c) => c.getAttribute('id'));
  expect(new Set(ids).size, `${label} unique cell ids`).toBe(ids.length);
  const first = cells[0];
  expect(first.getAttribute('id'), `${label} cell 0`).toBe('0');
  expect(first.hasAttribute('parent'), `${label} cell 0 has no parent`).toBe(false);
  const layer = cells.find((c) => c.getAttribute('id') === '1');
  expect(layer?.getAttribute('parent'), `${label} cell 1`).toBe('0');
}

/** Cell elements (mxCell, or the <object>/<UserObject> wrapper) under <root>, by id. */
function cellElements(model: Element): Map<string, Element> {
  const root = Array.from(model.children).find((c) => c.nodeName === 'root')!;
  return new Map(Array.from(root.children).map((el) => [el.getAttribute('id') ?? '', el]));
}

const innerCell = (el: Element): Element =>
  el.nodeName === 'mxCell' ? el : (Array.from(el.children).find((c) => c.nodeName === 'mxCell') as Element);

/** A coordinate rounded to 1/1000 px: the app writes 6.45 where draw.io's float noise wrote 6.4500000000000455. */
const num = (el: Element | null | undefined, name: string): number =>
  Math.round((parseFloat(el?.getAttribute(name) ?? '0') || 0) * 1000) / 1000 || 0;

/** Geometry as comparable data: bounds, relative, points, terminal points, offset, alternate bounds. */
function geometryOf(cell: Element): unknown {
  const geo = Array.from(cell.children).find((c) => c.nodeName === 'mxGeometry');
  if (!geo) return null;
  const point = (p: Element | undefined) => (p ? [num(p, 'x'), num(p, 'y')] : null);
  const child = (as: string) => Array.from(geo.children).find((c) => c.getAttribute('as') === as);
  const points = child('points');
  const alt = child('alternateBounds');
  return {
    x: num(geo, 'x'),
    y: num(geo, 'y'),
    // a relative (edge) geometry's size has no meaning; draw.io writes 50x50 by habit
    ...(geo.getAttribute('relative') === '1' ? {} : { width: num(geo, 'width'), height: num(geo, 'height') }),
    relative: geo.getAttribute('relative') === '1',
    points: points ? Array.from(points.children).map((p) => point(p)) : [],
    sourcePoint: point(child('sourcePoint')),
    targetPoint: point(child('targetPoint')),
    offset: point(child('offset')),
    alternateBounds: alt ? [num(alt, 'x'), num(alt, 'y'), num(alt, 'width'), num(alt, 'height')] : null,
  };
}

const CELL_ATTRIBUTES = ['value', 'vertex', 'edge', 'parent', 'source', 'target', 'connectable', 'visible', 'collapsed'];
/** Model (page settings) attributes draw.io writes and the app must keep. */
const MODEL_ATTRIBUTES = ['grid', 'gridSize', 'guides', 'tooltips', 'connect', 'arrows', 'fold', 'page', 'pageScale', 'pageWidth', 'pageHeight', 'background', 'math', 'shadow'];

/**
 * Semantic comparison of a draw.io model with the app's save of it: the same cells with the same ids,
 * kinds, parents, terminals, values, wrapper attributes (all of them, unknown ones included), geometry
 * and every original style entry (the save may add the app's explicit defaults, never drop or change one).
 */
function expectSameModel(original: Element, saved: Element, label: string): void {
  expectValidModel(saved, `${label} (saved)`);
  for (const name of MODEL_ATTRIBUTES) {
    if (original.hasAttribute(name)) expect(saved.getAttribute(name), `${label} mxGraphModel@${name}`).toBe(original.getAttribute(name));
  }
  const before = cellElements(original);
  const after = cellElements(saved);
  expect([...after.keys()], `${label} cell ids (in order)`).toEqual([...before.keys()]);
  for (const [id, origEl] of before) {
    const outEl = after.get(id)!;
    const where = `${label} cell ${id}`;
    expect(outEl.nodeName, `${where} element`).toBe(origEl.nodeName);
    if (origEl.nodeName !== 'mxCell') expect(attributesOf(outEl), `${where} attributes`).toEqual(attributesOf(origEl));
    const o = innerCell(origEl);
    const e = innerCell(outEl);
    for (const name of CELL_ATTRIBUTES) {
      // draw.io writes value="" on many cells; an absent value is the same
      const ov = o.getAttribute(name);
      const ev = e.getAttribute(name);
      if (name === 'value' && !ov) expect(ev || '', `${where} @value`).toBe('');
      else expect(ev, `${where} @${name}`).toBe(ov);
    }
    const oStyle = parseStyleString(o.getAttribute('style') ?? '') as Record<string, unknown>;
    const eStyle = parseStyleString(e.getAttribute('style') ?? '') as Record<string, unknown>;
    expect(eStyle, `${where} style`).toMatchObject(oStyle);
    // A draw.io style string starts unchanged (shape and stencil names, named styles, order)
    if (o.getAttribute('style')) expect(e.getAttribute('style') ?? '', `${where} style prefix`).toContain((o.getAttribute('style') ?? '').replace(/;$/, ''));
    expect(geometryOf(e), `${where} geometry`).toEqual(geometryOf(o));
  }
}

describe('draw.io compatibility guard', () => {
  let graphs: Graph[] = [];

  /** A tab graph as TabManager.createTab() sets it up, with its SaveLoadController. */
  function newTab(): { graph: Graph; controller: SaveLoadController } {
    const graph = createTestGraph();
    registerDrawioNamedStyles(graph.getStylesheet());
    installUserObjectLabels(graph);
    graphs.push(graph);
    return { graph, controller: new SaveLoadController(graph) };
  }

  /** File > Open of `fileXml`, then File > Save: the saved <mxfile>. */
  async function openAndSave(fileXml: string, name = 'fixture.drawio'): Promise<{ saved: string; graph: Graph }> {
    const { graph, controller } = newTab();
    await controller.loadProjectXml(fileXml, name, { quiet: true });
    return { saved: controller.getProjectXml(), graph };
  }

  beforeAll(() => {
    registerDrawioCodecs();
    registerErtmsShapes();
  });

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    graphs.forEach(cleanupTestGraph);
    graphs = [];
    document.querySelectorAll('.notification-container, .notification').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  describe.each(['compat-multipage.drawio', 'compat-compressed.drawio'])('%s', (fixtureName) => {
    const source = read(FIXTURES, fixtureName);

    it('the fixture is a draw.io file (plain and compressed pages as draw.io writes them)', () => {
      const pages = pagesOf(source);
      expect(pages.map((p) => p.name)).toEqual(['Station layout', 'Approach / 1. Clear', 'Notes', 'Archive']);
      expect(pages.map((p) => p.compressed)).toEqual(
        fixtureName.includes('compressed') ? [true, true, true, true] : [false, false, false, true]
      );
      pages.forEach((p) => expectValidModel(p.model, `${fixtureName} ${p.name}`));
    });

    it('File > Open -> File > Save is lossless and valid draw.io XML', async () => {
      const { saved } = await openAndSave(source, fixtureName);
      expect(saved).not.toContain('xmlns');
      const before = pagesOf(source);
      const after = pagesOf(saved);

      // Same pages, order, names and ids; scenario and unknown <diagram> attributes kept
      expect(after.map((p) => p.name)).toEqual(before.map((p) => p.name));
      expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
      expect(new Set(after.map((p) => p.id)).size).toBe(after.length);
      for (const [i, page] of before.entries()) {
        const out = after[i];
        for (const [name, value] of Object.entries(page.attributes)) {
          if (name === 'rdScenarios') expect(JSON.parse(out.attributes[name] ?? 'null'), `${page.name}@${name}`).toMatchObject(JSON.parse(value));
          else expect(out.attributes[name], `${page.name}@${name}`).toBe(value);
        }
        expectSameModel(page.model, out.model, `${fixtureName} page "${page.name}"`);
      }
      // Pages the editor does not show are written back as they were (still compressed if they were)
      expect(after[2].compressed).toBe(before[2].compressed);
      expect(after[3].compressed).toBe(true);
    });

    it('the save is stable: opening and saving it again gives the same file', async () => {
      const first = (await openAndSave(source, fixtureName)).saved;
      const second = (await openAndSave(first, 'again.drawio')).saved;
      const strip = (xml: string) => xml.replace(/ modified="[^"]*"/, '');
      expect(strip(second)).toBe(strip(first));
    });

    it('loads layers, groups, edges, labels, UserObjects and placeholders into the graph', async () => {
      const { graph } = await openAndSave(source, fixtureName);
      const model = graph.getDataModel();
      const root = model.getRoot()!;
      expect(root.getChildCount()).toBe(3);
      expect(root.getChildAt(1).getId()).toBe('L2');
      expect(root.getChildAt(1).getValue()).toBe('Signals');
      expect(model.getCell('L3')?.isVisible()).toBe(false);
      expect(model.getCell('L3')?.getStyle()).toMatchObject({ locked: 1 });

      const group = model.getCell('grp')!;
      expect(group.getChildCount()).toBe(2);
      expect(model.getCell('g-ell')?.getParent()).toBe(group);
      expect(group.isConnectable()).toBe(false);

      const edge = model.getCell('e1')!;
      expect(edge.isEdge()).toBe(true);
      expect(edge.getTerminal(true)).toBe(model.getCell('g-rect'));
      expect(edge.getTerminal(false)).toBe(model.getCell('bal'));
      expect(edge.getGeometry()?.points?.map((p) => [p.x, p.y])).toEqual([[320, 105], [320, 60], [575, 60]]);
      expect(model.getCell('e1-lbl')?.getParent()).toBe(edge);
      expect(model.getCell('e1-lbl')?.getGeometry()?.relative).toBe(true);
      const dangling = model.getCell('t1')!.getGeometry()!;
      expect([dangling.sourcePoint?.x, dangling.targetPoint?.x]).toEqual([40, 760]);

      const signal = model.getCell('sig1')!;
      expect((signal.getValue() as Element).nodeName).toBe('object');
      expect((signal.getValue() as Element).getAttribute('signalType')).toBe('main');
      expect(graph.convertValueToString(signal)).toBe('S1 (12+345)');
      expect(signal.getParent()?.getId()).toBe('L2');
      expect(String(signal.getStyle().shape)).toBe('mxgraph.flowchart.collate');
      const balise = model.getCell('bal')!;
      expect((balise.getValue() as Element).nodeName).toBe('UserObject');
      expect((balise.getValue() as Element).getAttribute('link')).toBe('https://example.org/balise/B12');
      expect(graph.convertValueToString(balise)).toBe('Balise <b>B12</b>');
      expect(model.getCell('note')?.getValue()).toBe('Line one\nLine "two" & three – Łódź');
      expect(model.getCell('hex')?.getStyle()).toMatchObject({ shape: 'hexagon', perimeter: 'hexagonPerimeter2' });
      expect(graph.gridSize).toBe(10);
    });
  });

  it('the compressed and the plain save of the same diagram open identically', async () => {
    const plain = await openAndSave(read(FIXTURES, 'compat-multipage.drawio'));
    const packed = await openAndSave(read(FIXTURES, 'compat-compressed.drawio'));
    const shown = (xml: string) => new XMLSerializer().serializeToString(pagesOf(xml)[0].model);
    expect(shown(packed.saved)).toBe(shown(plain.saved));
    // the scenario step page is rebuilt from the same data (the plain one keeps the file's indentation)
    expectSameModel(pagesOf(plain.saved)[1].model, pagesOf(packed.saved)[1].model, 'scenario step page');
  });

  it.each(['native-desktop.drawio', 'native-compressed.drawio', 'ertms-library.drawio'])(
    'older draw.io fixture %s round-trips through File > Open / Save',
    async (name) => {
      const source = read(OLD_FIXTURES, name);
      const { saved } = await openAndSave(source, name);
      const before = pagesOf(source);
      const after = pagesOf(saved);
      expect(after.map((p) => [p.id, p.name])).toEqual(before.map((p) => [p.id, p.name]));
      before.forEach((page, i) => expectSameModel(page.model, after[i].model, `${name} page "${page.name}"`));
    }
  );

  it('a bare <mxGraphModel> file opens and saves as an <mxfile> with one page', async () => {
    const model = new XMLSerializer().serializeToString(pagesOf(read(FIXTURES, 'compat-multipage.drawio'))[0].model);
    const { saved } = await openAndSave(model, 'bare.xml');
    const after = pagesOf(saved);
    expect(after).toHaveLength(1);
    expectSameModel(parseXml(model).documentElement, after[0].model, 'bare model');
  });

  it('app shapes are written as draw.io shapes with rdShape and restored on open', async () => {
    const { graph, controller } = newTab();
    const layer = graph.getDataModel().getRoot()!.getChildAt(0);
    const cell = new Cell('Hex', new Geometry(10, 10, 80, 40), { shape: 'hexagon-shape' });
    cell.setId('app-hex');
    cell.setVertex(true);
    graph.getDataModel().add(layer, cell);
    const saved = controller.getProjectXml();
    const style = innerCell(cellElements(pagesOf(saved)[0].model).get('app-hex')!).getAttribute('style') ?? '';
    expect(parseStyleString(style)).toMatchObject({ shape: 'hexagon', perimeter: 'hexagonPerimeter2', rdShape: 'hexagon-shape' });

    const reopened = await openAndSave(saved);
    expect(reopened.graph.getDataModel().getCell('app-hex')?.getStyle().shape).toBe('hexagon-shape');
    expect(reopened.saved.replace(/ modified="[^"]*"/, '')).toBe(saved.replace(/ modified="[^"]*"/, ''));
  });

  it('#R share links carry every page and open the same diagram', async () => {
    const { saved } = await openAndSave(read(FIXTURES, 'compat-compressed.drawio'));
    const decoded = await decodeShareHash(`#R${await encodeShareData(saved)}`);
    expect(decoded).toBe(saved);
    // Tabs: the scenario step page stays with its main page; every other page is a tab of its own
    const tabs = splitSharedFile(decoded);
    expect(tabs.map((t) => t.name)).toEqual(['Station layout', 'Notes', 'Archive']);
    expect(pagesOf(tabs[0].fileXml).map((p) => p.name)).toEqual(['Station layout', 'Approach / 1. Clear']);
    const opened = await openAndSave(tabs[0].fileXml);
    expectSameModel(pagesOf(saved)[0].model, pagesOf(opened.saved)[0].model, '#R tab 1');
  });

  describe('draw.io libraries (<mxlibrary>)', () => {
    it('reads plain, compressed and image entries', () => {
      const entries = parseMxLibrary(read(FIXTURES, 'compat-library.xml'));
      expect(entries.map((e) => e.title)).toEqual(['Balise', 'Collate (compressed)', 'Image']);
      expect(entries[0].xml).toMatch(/^<mxGraphModel>/);
      expect(entries[0].xml).toContain('placeholders="1"');
      expect(entries[1].xml).toContain('shape=mxgraph.flowchart.collate');
      expect(entries[2].data).toMatch(/^data:image\/svg\+xml;base64,/);
      expect([entries[0].w, entries[0].h, entries[0].aspect]).toEqual([30, 30, 'fixed']);
    });

    it('every entry of the ERTMS draw.io library opens and saves losslessly', () => {
      const entries = parseMxLibrary(ERTMS_LIBRARY);
      expect(entries).toHaveLength(40);
      expect(entries.every((e) => e.xml?.startsWith('<mxGraphModel'))).toBe(true);
      const { controller } = newTab();
      for (const [index, entry] of entries.entries()) {
        controller.load(entry.xml!);
        expectSameModel(parseXml(entry.xml!).documentElement, parseXml(controller.serializeToXml()).documentElement, `ERTMS #${index} ${entry.title}`);
      }
      // ~0.5 s alone; the whole suite runs files in parallel
    }, 30_000);

    it('library entries open through the file path too', async () => {
      for (const entry of parseMxLibrary(read(FIXTURES, 'compat-library.xml')).filter((e) => e.xml)) {
        const { saved, graph } = await openAndSave(entry.xml!, `${entry.title}.xml`);
        expectSameModel(parseXml(entry.xml!).documentElement, pagesOf(saved)[0].model, entry.title);
        if (entry.title === 'Balise') expect(graph.convertValueToString(graph.getDataModel().getCell('2')!)).toBe('SB1');
      }
    });
  });
});
