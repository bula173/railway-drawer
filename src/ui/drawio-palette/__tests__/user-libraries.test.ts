/**
 * User libraries (draw.io `<mxlibrary>` files) as Shapes-tab sections: create, add the selection or a
 * palette entry, rename, persist across re-creation, export text readable by draw.io; and the
 * More shapes dialog's library part (catalogue sections, toggles, persistence).
 */
import { Graph } from '@maxgraph/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../../drawio-shapes/engine';
import { createDrawioPaletteView, fallbackEngine, resetDrawioPaletteRenderer, setDrawioPaletteEngine } from '..';
import type { DrawioPaletteView, PaletteDef } from '..';
import { LIBRARIES_STORAGE_KEY } from '../library-adapter';
import {
  appendToLibrary,
  libraryItems,
  paletteEntryToLibraryItem,
  removeFromLibrary,
  selectionToLibraryItem,
  serializeLibrary,
} from '../user-library-actions';

class ImmediateIntersectionObserver {
  constructor(private readonly cb: (records: Array<{ isIntersecting: boolean; target: Element }>) => void) {}
  observe(target: Element): void {
    this.cb([{ isIntersecting: true, target }]);
  }
  unobserve(): void {}
  disconnect(): void {}
}

const GENERAL: PaletteDef = {
  id: 'general',
  title: 'General',
  drawioTag: 'v32.4.1',
  source: 'test',
  entries: [
    { id: 'general-0-rect', title: 'Rectangle', kind: 'vertex', width: 120, height: 60, style: 'rounded=0;whiteSpace=wrap;html=1;', shapeNames: [], cls: 'a', source: 't' },
    { id: 'general-1-line', title: 'Line', kind: 'edge', width: 50, height: 50, style: 'endArrow=none;html=1;', shapeNames: [], cls: 'd', source: 't' },
  ],
};

let graph: Graph;
let container: HTMLElement;
let view: DrawioPaletteView | null = null;
const engine = { ...fallbackEngine, parseMxLibrary };

function create(extra: Record<string, unknown> = {}): DrawioPaletteView {
  view?.destroy();
  view = createDrawioPaletteView({ container, getGraph: () => graph, palettes: [GENERAL], engine, ...extra });
  return view;
}

beforeAll(() => {
   
  const proto = (globalThis as any).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
   
  (globalThis as any).IntersectionObserver = ImmediateIntersectionObserver;
});

beforeEach(() => {
  localStorage.clear();
  container = document.body.appendChild(document.createElement('div'));
  graph = new Graph(document.body.appendChild(document.createElement('div')));
});

afterEach(() => {
  view?.destroy();
  view = null;
  graph.destroy();
  document.body.replaceChildren();
  resetDrawioPaletteRenderer();
  setDrawioPaletteEngine(fallbackEngine);
});

describe('library text helpers', () => {
  it('serializes well-formed <mxlibrary> XML that draw.io and the engine read back', () => {
    const item = paletteEntryToLibraryItem(GENERAL.entries[0]);
    const text = serializeLibrary([item]);
    expect(text).not.toMatch(/<mxGraphModel/);
    const parsed = parseMxLibrary(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].xml).toContain('style="rounded=0;whiteSpace=wrap;html=1;"');
    expect(parsed[0].w).toBe(120);
    const two = appendToLibrary(text, [paletteEntryToLibraryItem(GENERAL.entries[1])]);
    expect(libraryItems(two)).toHaveLength(2);
    expect(parseMxLibrary(two)[1].xml).toMatch(/edge="1"[\s\S]*sourcePoint/);
    expect(libraryItems(removeFromLibrary(two, 0))[0].title).toBe('Line');
  });

  it('turns the selection into a library item (absolute geometry moved to 0,0)', () => {
    const parent = graph.getDefaultParent();
    let cell = null;
    graph.batchUpdate(() => {
      cell = graph.insertVertex({ parent, value: 'A', position: [100, 50], size: [80, 40], style: { shape: 'ellipse' } });
    });
    graph.setSelectionCell(cell!);
    const item = selectionToLibraryItem(graph, 'Ellipse')!;
    expect(item).toMatchObject({ w: 80, h: 40, title: 'Ellipse', aspect: 'fixed' });
    expect(String(item.xml)).toContain('<mxGraphModel');
  });
});

describe('user libraries in the palette view', () => {
  it('creates, extends, renames and persists a library; export text keeps the entries', async () => {
    const v = create({ catalogue: false });
    const id = v.createLibrary('Signals');
    expect(id).toBe('lib-signals');
    expect(container.querySelector(`section[data-palette-id="${id}"] .rd-dp-header-title`)?.textContent).toBe('Signals');
    await v.addEntryToLibrary(id, GENERAL.entries[0]);
    // the selection
    const parent = graph.getDefaultParent();
    let cell = null;
    graph.batchUpdate(() => {
      cell = graph.insertVertex({ parent, value: 'S1', position: [10, 10], size: [30, 30], style: { shape: 'ellipse' } });
    });
    graph.setSelectionCell(cell!);
    expect(await v.addSelectionToLibrary(id)).toBe(true);
    const items = container.querySelectorAll(`section[data-palette-id="${id}"] .rd-dp-item`);
    expect(items).toHaveLength(2);
    v.renameLibrary(id, 'ETCS signals');
    expect(container.querySelector(`section[data-palette-id="${id}"] .rd-dp-header-title`)?.textContent).toBe('ETCS signals');

    // persisted in localStorage and restored by a new view
    const stored = JSON.parse(localStorage.getItem(LIBRARIES_STORAGE_KEY) ?? '[]') as Array<{ id: string; title: string; text: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('ETCS signals');
    const v2 = create({ catalogue: false });
    expect(container.querySelectorAll(`section[data-palette-id="${id}"] .rd-dp-item`)).toHaveLength(2);
    const text = v2.getLibraryText(id)!;
    expect(parseMxLibrary(text).map((e) => e.title)).toEqual(['Rectangle', '']);

    // nothing selected: nothing added
    graph.clearSelection();
    expect(await v2.addSelectionToLibrary(id)).toBe(false);
    v2.removeLibrary(id);
    expect(localStorage.getItem(LIBRARIES_STORAGE_KEY)).toBeNull();
  });
});

describe('More shapes: draw.io libraries', () => {
  it('adds the catalogue as hidden sections and toggles whole libraries (persisted)', { timeout: 30_000 }, async () => {
    const v = create({ skipCataloguePalettes: ['basic'] });
    await v.catalogueReady;
    const umlSection = container.querySelector<HTMLElement>('section[data-palette-id="uml"]')!;
    expect(umlSection.hidden).toBe(true);
    expect(container.querySelector('section[data-palette-id="basic"]')).toBeNull();
    expect(v.isLibraryVisible('aws4')).toBe(false);

    // the dialog lists the libraries by draw.io category; a checkbox shows all palettes of a library
    v.openMoreShapes();
    await new Promise((r) => setTimeout(r, 50));
    await expect.poll(() => container.querySelectorAll('input[data-library-id]').length).toBeGreaterThan(50);
    expect(container.querySelector('input[data-library-id="basic"]')).toBeNull();
    const aws = container.querySelector<HTMLInputElement>('input[data-library-id="aws4"]')!;
    aws.checked = true;
    aws.dispatchEvent(new Event('change'));
    expect(v.isLibraryVisible('aws4')).toBe(true);
    const awsSections = container.querySelectorAll<HTMLElement>('section.rd-dp-catalogue[data-library="aws4"]');
    expect(awsSections.length).toBe(30);
    for (const s of Array.from(awsSections)) expect(s.hidden).toBe(false);
    expect(container.querySelector('section[data-palette-id="aws4Compute"] .rd-dp-info')?.getAttribute('title')).toMatch(/trademark/);

    // persisted
    const v2 = create({ skipCataloguePalettes: ['basic'] });
    await v2.catalogueReady;
    expect(v2.isLibraryVisible('aws4')).toBe(true);
    v2.setLibraryVisible('aws4', false);
    expect(v2.isLibraryVisible('aws4')).toBe(false);
  });

  it('search shows matches of hidden libraries grouped by library', { timeout: 30_000 }, async () => {
    const v = create();
    await v.catalogueReady;
    v.setSearch('lambda');
    await v.globalSearchDone;
    const groups = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-sr-group')).map((g) => g.dataset.library);
    expect(groups).toContain('aws4');
    await expect.poll(() => container.querySelectorAll('.rd-dp-sr-group[data-library="aws4"] .rd-dp-item').length).toBeGreaterThan(0);
    v.setSearch('');
    await v.globalSearchDone;
    expect(container.querySelector<HTMLElement>('.rd-dp-search-results')!.hidden).toBe(true);
  });
});
