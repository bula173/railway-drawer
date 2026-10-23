import { Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { styleToString } from '../../../services/drawio-xml';
import { openModalCount } from '../../../core/modal';
import {
  createDrawioPaletteView,
  EXPANDED_STORAGE_KEY,
  extractShapeNames,
  fallbackEngine,
  LIBRARIES_STORAGE_KEY,
  libraryToPaletteDef,
  PALETTE_DRAG_TYPE,
  renderEntryForParity,
  resetDrawioPaletteRenderer,
  setDrawioPaletteEngine,
  VISIBLE_STORAGE_KEY,
} from '..';
import type { DrawioPaletteView, PaletteDef, PaletteEngine, PaletteEntry } from '..';

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const COMPOSITE_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="Box" style="rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#dae8fc,#1d293b);" vertex="1" parent="1">' +
  '<mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
  '<mxCell id="3" value="" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="110" y="10" width="40" height="40" as="geometry"/></mxCell>' +
  '<mxCell id="4" style="endArrow=classic;html=1;" edge="1" parent="1" source="2" target="3">' +
  '<mxGeometry relative="1" as="geometry"/></mxCell>' +
  '</root></mxGraphModel>';

function entry(partial: Partial<PaletteEntry> & Pick<PaletteEntry, 'id' | 'title'>): PaletteEntry {
  return { kind: 'vertex', width: 120, height: 60, shapeNames: [], cls: 'a', source: 'fixture:1', ...partial };
}

const GENERAL: PaletteDef = {
  id: 'general',
  title: 'General',
  drawioTag: 'v32.4.1',
  source: 'js/grapheditor/Sidebar.js:2790',
  entries: [
    entry({ id: 'general-0-rectangle', title: 'Rectangle', style: 'rounded=0;whiteSpace=wrap;html=1;', tags: 'rect rectangle box', shapeNames: ['rectangle'] }),
    entry({ id: 'general-1-ellipse', title: 'Ellipse', style: 'ellipse;whiteSpace=wrap;html=1;shapeInside=1;', tags: 'oval ellipse state', width: 120, height: 80 }),
    entry({ id: 'general-2-text', title: 'Text', style: 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;', value: 'Text', width: 60, height: 30, tags: 'text textbox textarea label' }),
    entry({ id: 'general-3-arrow', title: 'Directional Connector', kind: 'edge', style: 'endArrow=classic;html=1;rounded=0;', width: 50, height: 50, tags: 'line arrow connector' }),
  ],
};

const MISC: PaletteDef = {
  id: 'misc',
  title: 'Misc',
  drawioTag: 'v32.4.1',
  source: 'js/grapheditor/Sidebar.js:2930',
  entries: [
    entry({ id: 'misc-0-group', title: 'Shape Group', kind: 'cells', width: 150, height: 50, xml: COMPOSITE_XML, tags: 'group container', shapeNames: ['rectangle', 'ellipse'] }),
    entry({ id: 'misc-1-hexagon', title: 'Hexagon', style: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;', tags: 'hexagon', shapeNames: ['hexagon'] }),
  ],
};

const ARROWS_LEGACY = {
  id: 'arrows',
  title: 'Arrows',
  defaultVisible: false,
  load: () =>
    Promise.resolve<PaletteDef>({
      id: 'arrows',
      title: 'Arrows',
      drawioTag: 'v32.4.1',
      source: 'js/grapheditor/Sidebar.js:3600',
      entries: [entry({ id: 'arrows-0-arrow-right', title: 'Arrow Right', style: 'shape=mxgraph.arrows.arrow_right;html=1;', shapeNames: ['mxgraph.arrows.arrow_right'] })],
    }),
};

function libraryText(title: string): string {
  const items = [
    { xml: COMPOSITE_XML, w: 150, h: 50, title: `${title} group`, aspect: 'fixed' },
    { xml: COMPOSITE_XML.replace('Box', 'Other'), w: 150, h: 50, title: `${title} other` },
  ];
  // entity-escaped like draw.io writes it
  const json = JSON.stringify(items).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<mxlibrary>${json}</mxlibrary>`;
}

// ---------------------------------------------------------------------------------------------
// Environment stubs
// ---------------------------------------------------------------------------------------------

class ImmediateIntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element): void {
    queueMicrotask(() =>
      this.cb([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    );
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeAll(() => {
  const proto = (globalThis as any).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
  (globalThis as any).IntersectionObserver = ImmediateIntersectionObserver;
});

let graph: Graph;
let container: HTMLElement;
let view: DrawioPaletteView | null;
const engine: PaletteEngine = { ...fallbackEngine, ensureStencilsForXml: vi.fn(() => Promise.resolve()) };

function create(extra: Partial<Parameters<typeof createDrawioPaletteView>[0]> = {}): DrawioPaletteView {
  view?.destroy();
  view = createDrawioPaletteView({
    container,
    getGraph: () => graph,
    palettes: [GENERAL, MISC, ARROWS_LEGACY],
    engine,
    ...extra,
  });
  return view;
}

function topCells(): Cell[] {
  return graph.getDefaultParent().children ?? [];
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  const graphDiv = document.createElement('div');
  document.body.appendChild(graphDiv);
  graph = new Graph(graphDiv);
  view = null;
});

afterEach(() => {
  view?.destroy();
  view = null;
  graph.destroy();
  document.body.replaceChildren();
  resetDrawioPaletteRenderer();
  setDrawioPaletteEngine(fallbackEngine);
});

function visibleItems(paletteId: string): HTMLElement[] {
  const section = container.querySelector<HTMLElement>(`[data-palette-id="${paletteId}"]`);
  if (!section || section.hidden) return [];
  return Array.from(section.querySelectorAll<HTMLElement>('.rd-dp-item')).filter((n) => !n.hidden);
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

describe('drawio palette view', () => {
  it('renders the categories in order with their items', async () => {
    const v = create();
    await v.ready;
    const sections = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category'));
    expect(sections.map((s) => s.dataset.paletteId)).toEqual(['general', 'misc', 'arrows']);
    expect(sections.map((s) => s.querySelector('.rd-dp-header-title')?.textContent)).toEqual(['General', 'Misc', 'Arrows']);
    expect(visibleItems('general')).toHaveLength(4);
    expect(visibleItems('misc')).toHaveLength(2);
    // legacy arrows hidden by default
    expect(sections[2].hidden).toBe(true);
    // General expanded by default, Misc collapsed
    expect(sections[0].classList.contains('rd-dp-expanded')).toBe(true);
    expect(sections[1].classList.contains('rd-dp-expanded')).toBe(false);
  });

  it('search filters by title and tags across categories', async () => {
    const v = create();
    await v.ready;
    v.setSearch('rectangle');
    expect(visibleItems('general').map((n) => n.dataset.entryId)).toEqual(['general-0-rectangle']);
    expect(visibleItems('misc')).toHaveLength(0);

    v.setSearch('hexagon');
    expect(visibleItems('general')).toHaveLength(0);
    expect(visibleItems('misc').map((n) => n.dataset.entryId)).toEqual(['misc-1-hexagon']);

    v.setSearch('group container');
    expect(visibleItems('misc').map((n) => n.dataset.entryId)).toEqual(['misc-0-group']);

    v.setSearch('');
    expect(visibleItems('general')).toHaveLength(4);
    expect(visibleItems('misc')).toHaveLength(2);
  });

  it('toggles palette visibility from the More shapes menu and persists it', async () => {
    const v = create();
    await v.ready;
    (container.querySelector('.rd-dp-more') as HTMLButtonElement).click();
    const menu = container.querySelector<HTMLElement>('.rd-dp-menu')!;
    expect(menu.hidden).toBe(false);
    const boxes = Array.from(menu.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
    expect(boxes.map((b) => [b.dataset.paletteId, b.checked])).toEqual([
      ['general', true],
      ['misc', true],
      ['arrows', false],
    ]);

    boxes[1].checked = false;
    boxes[1].dispatchEvent(new Event('change'));
    boxes[2].checked = true;
    boxes[2].dispatchEvent(new Event('change'));
    expect(v.isPaletteVisible('misc')).toBe(false);
    expect(JSON.parse(localStorage.getItem(VISIBLE_STORAGE_KEY)!)).toEqual({ misc: false, arrows: true });

    const v2 = create();
    await v2.ready;
    expect(v2.isPaletteVisible('misc')).toBe(false);
    expect(v2.isPaletteVisible('arrows')).toBe(true);
    expect(container.querySelector<HTMLElement>('[data-palette-id="misc"]')!.hidden).toBe(true);
    expect(container.querySelector<HTMLElement>('[data-palette-id="arrows"]')!.hidden).toBe(false);
  });

  it('lists extra menu items after the palettes and forwards their toggles', async () => {
    let basicShown = true;
    const v = create({
      extraMenuItems: [
        { id: 'app-Basic', title: 'Basic (Railway Drawer)', isChecked: () => basicShown, setChecked: (c) => (basicShown = c) },
      ],
    });
    await v.ready;
    (container.querySelector('.rd-dp-more') as HTMLButtonElement).click();
    const menu = container.querySelector<HTMLElement>('.rd-dp-menu')!;
    const rows = Array.from(menu.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
    expect(rows.map((b) => b.dataset.paletteId ?? b.dataset.menuItemId)).toEqual(['general', 'misc', 'arrows', 'app-Basic']);
    expect(menu.querySelector('.rd-dp-menu-separator')).not.toBeNull();

    const extra = rows[3];
    expect(extra.checked).toBe(true);
    extra.checked = false;
    extra.dispatchEvent(new Event('change'));
    expect(basicShown).toBe(false);
    // re-opening reflects the current state
    (container.querySelector('.rd-dp-more') as HTMLButtonElement).click();
    (container.querySelector('.rd-dp-more') as HTMLButtonElement).click();
    expect(menu.querySelector<HTMLInputElement>('input[data-menu-item-id="app-Basic"]')!.checked).toBe(false);
  });

  it('More shapes is a modal (core/modal): aria-modal, Esc and the backdrop close it, the focus goes back', async () => {
    const v = create();
    await v.ready;
    const more = container.querySelector<HTMLButtonElement>('.rd-dp-more')!;
    more.focus();
    more.click();
    const menu = container.querySelector<HTMLElement>('.rd-dp-menu')!;
    expect(menu.getAttribute('role')).toBe('dialog');
    expect(menu.getAttribute('aria-modal')).toBe('true');
    expect(menu.getAttribute('aria-label')).toBe('More shapes');
    expect(menu.dataset.testid).toBe('more-shapes-dialog');
    expect(openModalCount()).toBe(1);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    menu.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(menu.hidden).toBe(true);
    expect(menu.isConnected).toBe(false);
    expect(openModalCount()).toBe(0);
    expect(document.activeElement).toBe(more);
    // a press on the backdrop closes it, the close button too
    more.click();
    const backdrop = container.querySelector<HTMLElement>('.rd-dp-menu-backdrop')!;
    backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.hidden).toBe(true);
    v.openMoreShapes();
    menu.querySelector<HTMLButtonElement>('.rd-dp-menu-close')!.click();
    expect(menu.isConnected).toBe(false);
    expect(openModalCount()).toBe(0);
  });

  it('persists the expanded state of categories', async () => {
    const v = create();
    await v.ready;
    (container.querySelector('[data-palette-id="misc"] .rd-dp-header') as HTMLButtonElement).click();
    expect(JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY)!)).toEqual({ misc: true });
    create();
    expect(container.querySelector('[data-palette-id="misc"]')!.classList.contains('rd-dp-expanded')).toBe(true);
  });

  it('click inserts a vertex with the exact draw.io style string at the view centre', async () => {
    const v = create();
    await v.ready;
    const item = container.querySelector<HTMLElement>('[data-entry-id="general-2-text"]')!;
    item.click();
    const cells = topCells();
    expect(cells).toHaveLength(1);
    const cell = cells[0];
    expect(cell.isVertex()).toBe(true);
    expect(styleToString(cell.getStyle())).toBe(GENERAL.entries[2].style);
    expect(cell.getValue()).toBe('Text');
    expect(cell.getGeometry()!.width).toBe(60);
    expect(cell.getGeometry()!.height).toBe(30);
    expect(graph.getSelectionCells()).toEqual([cell]);
  });

  it('inserts edges like draw.io (terminal points, length = width)', async () => {
    const v = create();
    await v.ready;
    v.insert(GENERAL.entries[3], { x: 100, y: 100 });
    const [edge] = topCells();
    expect(edge.isEdge()).toBe(true);
    const geo = edge.getGeometry()!;
    expect(geo.relative).toBe(true);
    const src = geo.sourcePoint!;
    const trg = geo.targetPoint!;
    expect(trg.x - src.x).toBe(50);
    expect(src.y - trg.y).toBe(50);
    expect(styleToString(edge.getStyle())).toBe('endArrow=classic;html=1;rounded=0;');
  });

  it('a composite xml entry inserts all cells as one undoable edit, styles verbatim', async () => {
    const v = create();
    await v.ready;
    const undo = new UndoManager();
    const listener = (_sender: unknown, evt: any) => undo.undoableEditHappened(evt.getProperty('edit'));
    graph.getDataModel().addListener(InternalEvent.UNDO, listener);

    v.insert(MISC.entries[0], { x: 300, y: 300 });
    const cells = topCells();
    expect(cells).toHaveLength(3);
    const styles = cells.map((c) => styleToString(c.getStyle()));
    expect(styles).toContain('rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#dae8fc,#1d293b);');
    expect(styles).toContain('ellipse;whiteSpace=wrap;html=1;');
    const edge = cells.find((c) => c.isEdge())!;
    expect(edge.getTerminal(true)).toBe(cells.find((c) => c.getValue() === 'Box'));
    // centred on the insertion point (group bounds 10..150 x 10..50 -> 140x40)
    const box = cells.find((c) => c.getValue() === 'Box')!.getGeometry()!;
    expect(box.x).toBe(graph.snap(300 - 70));
    expect(box.y).toBe(graph.snap(300 - 20));

    expect(undo.history).toHaveLength(1);
    undo.undo();
    expect(topCells()).toHaveLength(0);
  });

  it('drop inserts at the drop point', async () => {
    const v = create({ dropTarget: graph.container });
    await v.ready;
    const data = new Map<string, string>([[PALETTE_DRAG_TYPE, 'misc\nmisc-1-hexagon']]);
    const evt = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt.clientX = 200;
    evt.clientY = 150;
    evt.dataTransfer = { getData: (t: string) => data.get(t) ?? '', types: [...data.keys()] };
    graph.container.dispatchEvent(evt);
    const [cell] = topCells();
    expect(cell).toBeDefined();
    expect(styleToString(cell.getStyle())).toBe(MISC.entries[1].style);
    expect(evt.defaultPrevented).toBe(true);
    const geo = cell.getGeometry()!;
    expect(geo.x).toBe(graph.snap(200 - 60));
    expect(geo.y).toBe(graph.snap(150 - 30));
  });

  it('imports a library, persists it, and restores it on re-create; remove deletes it', async () => {
    const v = create();
    await v.ready;
    const id = v.importLibraryText(libraryText('Track'), 'Track shapes.xml');
    expect(id).toBe('lib-track-shapes');
    expect(visibleItems(id)).toHaveLength(2);
    expect(container.querySelector(`[data-palette-id="${id}"] .rd-dp-header-title`)!.textContent).toBe('Track shapes');
    const stored = JSON.parse(localStorage.getItem(LIBRARIES_STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe(libraryText('Track'));

    create();
    await view!.ready;
    const sections = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category')).map((s) => s.dataset.paletteId);
    expect(sections).toEqual(['general', 'misc', 'arrows', id]);
    expect(visibleItems(id)).toHaveLength(2);

    // the library tile inserts its cells
    container.querySelector<HTMLElement>(`[data-palette-id="${id}"] .rd-dp-item`)!.click();
    expect(topCells()).toHaveLength(3);

    (container.querySelector(`[data-palette-id="${id}"] .rd-dp-remove`) as HTMLElement).click();
    expect(container.querySelector(`[data-palette-id="${id}"]`)).toBeNull();
    expect(localStorage.getItem(LIBRARIES_STORAGE_KEY)).toBeNull();
  });

  it('rejects an invalid library without storing it', async () => {
    const v = create();
    await v.ready;
    expect(() => v.importLibraryText('<notalibrary/>', 'bad.xml')).toThrow();
    expect(localStorage.getItem(LIBRARIES_STORAGE_KEY)).toBeNull();
  });

  it('places extra libraries (ERTMS) after the built-in palettes', async () => {
    const ertms = libraryToPaletteDef(fallbackEngine.parseMxLibrary(libraryText('Signal')), {
      id: 'ertms',
      title: 'ERTMS',
      tags: 'ertms etcs',
    });
    const v = create({ extraLibraries: [ertms] });
    await v.ready;
    const ids = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category')).map((s) => s.dataset.paletteId);
    expect(ids).toEqual(['general', 'misc', 'arrows', 'ertms']);
    expect(container.querySelector('[data-palette-id="ertms"]')!.classList.contains('rd-dp-expanded')).toBe(true);
    v.setSearch('etcs');
    expect(visibleItems('ertms')).toHaveLength(2);
    expect(visibleItems('general')).toHaveLength(0);
  });

  it('renders thumbnails with the real shapes (lazy, after preloading stencils)', async () => {
    const v = create();
    await v.ready;
    await vi.waitFor(() => {
      expect(container.querySelector('[data-entry-id="general-1-ellipse"] .rd-dp-thumb svg')).not.toBeNull();
    });
    const svg = container.querySelector('[data-entry-id="general-1-ellipse"] .rd-dp-thumb svg')!;
    expect(svg.getAttribute('width')).toBe('36');
    expect(svg.getAttribute('height')).toBe('36');
    expect(svg.querySelector('ellipse')).not.toBeNull();

    await vi.waitFor(() => {
      expect(container.querySelector('[data-entry-id="misc-0-group"] .rd-dp-thumb svg')).not.toBeNull();
    });
    const group = container.querySelector('[data-entry-id="misc-0-group"] .rd-dp-thumb svg')!;
    expect(group.querySelector('ellipse')).not.toBeNull();
    expect(group.querySelectorAll('path, rect').length).toBeGreaterThan(0);
    expect(engine.ensureStencilsForXml).toHaveBeenCalled();
    // the hidden render graph is left empty
    await flush();
  });

  it('renderEntryForParity renders at a fixed scale', async () => {
    setDrawioPaletteEngine(engine);
    const svg = await renderEntryForParity(GENERAL.entries[0], 2);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(240);
    expect(Number(svg.getAttribute('height'))).toBeGreaterThanOrEqual(120);
    expect(svg.querySelectorAll('rect, path').length).toBeGreaterThan(0);
  });

  it('renderEntryForParity uses the draw.io PNG export layout (Graph.getSvg at scale 1)', async () => {
    // Regression: the translate was floored at the output scale and the border divided by it,
    // which put cells on half pixels (labels snapped 1 output px off) and halved the margin.
    setDrawioPaletteEngine(engine);
    const rect = entry({ id: 'x-rect', title: 'Rect', style: 'rounded=0;whiteSpace=wrap;html=1;', width: 120, height: 60 });
    const svg = await renderEntryForParity({ ...rect, kind: 'vertex' }, 2, { exportLayout: true, border: 10 });
    // bounds 20..140 (jsdom measures no stroke), extended by the +0.5 crisp offset -> ceil(120.5) + 2 * 10
    expect(svg.getAttribute('width')).toBe('141');
    expect(svg.getAttribute('height')).toBe('81');
    const shapeNode = svg.querySelector('g[transform]');
    expect(shapeNode?.getAttribute('transform')).toBe('translate(0.5,0.5)');
    // the cell is at (10, 10): whole units, so its label is on whole pixels too
    const rectEl = svg.querySelector('rect, path');
    expect(rectEl?.getAttribute('x') ?? rectEl?.getAttribute('d')).toMatch(/^(10|M 10 10)\b/);

    // draw.io mxImageExport.getSvgShapeOffset: no crisp offset for shapes without a stroke
    const noStroke = entry({ id: 'x-nostroke', title: 'No stroke', style: 'rounded=0;html=1;strokeColor=none;fillColor=#ff0000;', width: 120, height: 60 });
    const svg2 = await renderEntryForParity({ ...noStroke, kind: 'vertex' }, 2, { exportLayout: true, border: 10 });
    expect(svg2.querySelector('g[transform^="translate(0.5"]')).toBeNull();
  });
});

describe('libraryToPaletteDef', () => {
  it('maps xml and image entries', () => {
    const def = libraryToPaletteDef(
      [
        { title: 'Signal A', w: 40, h: 80, xml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" style="shape=stencil(abc=);fillColor=light-dark(#fff,#000);" vertex="1" parent="1"><mxGeometry width="40" height="80" as="geometry"/></mxCell></root></mxGraphModel>' },
        { title: 'Logo', w: 20, h: 20, data: 'data:image/png;base64,AAAA' },
      ],
      { id: 'ertms', title: 'ERTMS', tags: 'ertms etcs' }
    );
    expect(def.id).toBe('ertms');
    expect(def.entries[0]).toMatchObject({ id: 'ertms-0-signal-a', kind: 'cells', width: 40, height: 80, tags: 'ertms etcs Signal A', shapeNames: ['stencil(abc=)'] });
    expect(def.entries[1]).toMatchObject({ id: 'ertms-1-logo', kind: 'vertex', shapeNames: ['image'] });
    expect(def.entries[1].style).toContain('image=data:image/png,AAAA;');
  });

  it('extracts shape names from styles and xml', () => {
    expect(extractShapeNames('shape=mxgraph.basic.rect;fillColor=#fff;')).toEqual(['mxgraph.basic.rect']);
    expect(extractShapeNames('<mxCell style="ellipse;shape=cylinder3;"/><mxCell style="shape=process;"/>')).toEqual(['cylinder3', 'process']);
  });
});
