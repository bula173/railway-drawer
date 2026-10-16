/**
 * Templates against real graphs: selection extraction (descendants + internal edges only),
 * insertion as one undoable edit with verbatim draw.io styles, "Open as new diagram" in a real
 * TabManager tab, the "Save as template…" flow and the Templates panel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Graph, GraphDataModel, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMxLibrary } from '../../../drawio-shapes/engine';
import { applyDrawioDefaultStyles, exportModelToDrawioXml, importDrawioXmlIntoModel, parseDrawioStyle, registerDrawioCodecs, registerDrawioNamedStyles } from '../../../services/drawio-xml';
import { TabManager } from '../../tabs';
import { loadAppDom, clearAppDom } from '../../../__tests__/ui/app-dom';
import { resetDrawioPaletteRenderer } from '../../drawio-palette';
import {
  collectTemplateCells,
  createTemplatesPanel,
  extractTemplate,
  insertTemplate,
  openTemplateAsNewDiagram,
  saveAsTemplate,
  splitErtmsLibrary,
  TemplateStore,
} from '..';
import type { DiagramTemplate } from '..';

const ROOT = resolve(__dirname, '../../../..');
const STYLE_G = 'rounded=1;fillColor=#ff0000;';
const STYLE_A = 'ellipse;whiteSpace=wrap;html=1;';

beforeAll(() => {
  registerDrawioCodecs();
  const proto = (globalThis as any).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
  (globalThis as any).IntersectionObserver = undefined;
});

interface Fixture {
  graph: Graph;
  g: Cell;
  a: Cell;
  b: Cell;
  ab: Cell;
  c: Cell;
  d: Cell;
  e1: Cell; // A -> C (crosses the group border)
  e2: Cell; // C -> D
  e3: Cell; // A -> D
}

/** A graph set up like a tab graph's stylesheet (draw.io defaults). */
function drawioGraph(): Graph {
  const graph = new Graph(document.body.appendChild(document.createElement('div')));
  applyDrawioDefaultStyles(graph.getStylesheet());
  registerDrawioNamedStyles(graph.getStylesheet());
  return graph;
}

function fixture(): Fixture {
  const graph = drawioGraph();
  const parent = graph.getDefaultParent();
  const f = { graph } as Fixture;
  graph.batchUpdate(() => {
    f.g = graph.insertVertex(parent, null, 'G', 100, 100, 200, 100, parseDrawioStyle(STYLE_G));
    f.a = graph.insertVertex(f.g, null, 'A', 10, 10, 40, 20, parseDrawioStyle(STYLE_A));
    f.b = graph.insertVertex(f.g, null, 'B', 120, 10, 40, 20, parseDrawioStyle(STYLE_A));
    f.ab = graph.insertEdge(f.g, null, '', f.a, f.b);
    f.c = graph.insertVertex(parent, null, 'C', 400, 100, 40, 40);
    f.d = graph.insertVertex(parent, null, 'D', 600, 100, 40, 40);
    f.e1 = graph.insertEdge(parent, null, 'e1', f.a, f.c);
    f.e2 = graph.insertEdge(parent, null, 'e2', f.c, f.d);
    f.e3 = graph.insertEdge(parent, null, 'e3', f.a, f.d);
  });
  return f;
}

/** Decodes a template XML; returns the first layer's cells by label. */
function decode(xml: string): { top: Cell[]; byLabel: Map<string, Cell> } {
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(xml, model);
  const top = [...(model.getRoot()!.getChildAt(0).children ?? [])];
  const byLabel = new Map<string, Cell>();
  const visit = (cell: Cell): void => {
    if (cell.getValue()) byLabel.set(String(cell.getValue()), cell);
    for (const child of cell.children ?? []) visit(child);
  };
  top.forEach(visit);
  return { top, byLabel };
}

afterEach(() => {
  document.body.replaceChildren();
  resetDrawioPaletteRenderer();
  localStorage.clear();
});

describe('selection extraction', () => {
  it('takes the selected cells with their descendants and only the edges inside', () => {
    const f = fixture();
    // A is redundant (its group is selected); e2/e3 lead to the unselected D
    expect(collectTemplateCells(f.graph, [f.g, f.c, f.a])).toEqual([f.g, f.c, f.e1]);

    const t = extractTemplate(f.graph, [f.g, f.c])!;
    expect(t.cellCount).toBe(3);
    expect(t.width).toBe(340);
    expect(t.height).toBe(100);
    const { top, byLabel } = decode(t.xml);
    expect(top.map((c) => c.getValue())).toEqual(['G', 'C', 'e1']);
    expect(byLabel.has('D')).toBe(false);
    expect(byLabel.has('e2')).toBe(false);
    expect(byLabel.has('e3')).toBe(false);
    // descendants and the edge inside the group come along, connected to the copies
    const g = byLabel.get('G')!;
    expect(g.children.map((c) => c.getValue())).toEqual(['A', 'B', '']);
    const ab = g.children[2];
    expect(ab.getTerminal(true)).toBe(byLabel.get('A'));
    expect(ab.getTerminal(false)).toBe(byLabel.get('B'));
    const e1 = byLabel.get('e1')!;
    expect(e1.getTerminal(true)).toBe(byLabel.get('A'));
    expect(e1.getTerminal(false)).toBe(byLabel.get('C'));
    // moved to the origin; children keep their relative position
    expect([g.getGeometry()!.x, g.getGeometry()!.y]).toEqual([0, 0]);
    expect([byLabel.get('C')!.getGeometry()!.x, byLabel.get('C')!.getGeometry()!.y]).toEqual([300, 0]);
    expect(byLabel.get('B')!.getGeometry()!.x).toBe(120);
    // draw.io styles verbatim
    expect(t.xml).toContain(`style="${STYLE_G}"`);
    expect(t.xml).toContain(`style="${STYLE_A}"`);
    f.graph.destroy();
  });

  it('moves nested cells to absolute coordinates when their parent is not selected', () => {
    const f = fixture();
    const t = extractTemplate(f.graph, [f.a, f.c])!;
    const { top, byLabel } = decode(t.xml);
    expect(top.map((c) => c.getValue())).toEqual(['A', 'C', 'e1']);
    // A is at (110, 110) in the diagram, C at (400, 100): origin (110, 100)
    expect([byLabel.get('A')!.getGeometry()!.x, byLabel.get('A')!.getGeometry()!.y]).toEqual([0, 10]);
    expect([byLabel.get('C')!.getGeometry()!.x, byLabel.get('C')!.getGeometry()!.y]).toEqual([290, 0]);
    expect(t.width).toBe(330);
    f.graph.destroy();
  });

  it('keeps a selected edge to an unselected cell as a dangling edge', () => {
    const f = fixture();
    const { byLabel } = decode(extractTemplate(f.graph, [f.c, f.e2])!.xml);
    const e2 = byLabel.get('e2')!;
    expect(e2.getTerminal(true)).toBe(byLabel.get('C'));
    expect(e2.getTerminal(false)).toBeNull();
    expect(e2.getGeometry()!.getTerminalPoint(false)).not.toBeNull();
    expect(byLabel.has('D')).toBe(false);
    f.graph.destroy();
  });

  it('saves the whole diagram without a selection, and nothing for an empty one', () => {
    const f = fixture();
    f.graph.clearSelection();
    const { top } = decode(extractTemplate(f.graph)!.xml);
    expect(top.map((c) => c.getValue())).toEqual(['G', 'C', 'D', 'e1', 'e2', 'e3']);
    const empty = new Graph(document.body.appendChild(document.createElement('div')));
    expect(extractTemplate(empty)).toBeNull();
    f.graph.destroy();
    empty.destroy();
  });
});

const ertmsTemplates = splitErtmsLibrary(parseMxLibrary(readFileSync(resolve(ROOT, 'public/libraries/ertms.xml'), 'utf8'))).templates;

describe('insert', () => {
  it('inserts a template as one undoable edit with the draw.io styles verbatim', () => {
    const graph = drawioGraph();
    const undo = new UndoManager();
    graph.getDataModel().addListener(InternalEvent.UNDO, (_sender: unknown, evt: any) => undo.undoableEditHappened(evt.getProperty('edit')));
    const template = ertmsTemplates[0];
    const inserted = insertTemplate(graph, template, { x: 500, y: 400 });
    expect(inserted.length).toBeGreaterThan(0);
    expect(graph.getSelectionCells()).toEqual(inserted);
    expect(undo.history).toHaveLength(1);

    // every style string of the template is written back unchanged
    const out = exportModelToDrawioXml(graph.getDataModel(), { stylesheet: graph.getStylesheet() });
    const styles = (xml: string) =>
      new Set(
        Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('mxCell'))
          .map((c) => c.getAttribute('style'))
          .filter((x): x is string => !!x)
      );
    const wanted = styles(template.xml);
    const got = styles(out);
    expect(wanted.size).toBeGreaterThan(5);
    for (const s of wanted) expect(got.has(s), s).toBe(true);

    undo.undo();
    expect(graph.getDefaultParent().getChildCount()).toBe(0);
    graph.destroy();
  });
});

describe('with the app (TabManager)', () => {
  let tabManager: TabManager | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
    loadAppDom();
    localStorage.clear();
    tabManager = new TabManager('tabs-container', 'graph-container');
    tabManager.createTab('Diagram 1');
  });

  afterEach(() => {
    tabManager?.destroy();
    tabManager = null;
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (globalThis as any).IntersectionObserver = undefined;
  });

  it('opens a template as a new diagram tab named after it', () => {
    const tm = tabManager!;
    const first = tm.getActiveTab()!;
    const template = ertmsTemplates[2];
    const id = openTemplateAsNewDiagram(tm, template);
    const tab = tm.getActiveTab()!;
    expect(tab.id).toBe(id);
    expect(tab.name).toBe('ERTMS scenario 3');
    expect(tm.getAllTabs()).toHaveLength(2);
    expect(tab.graph.getDefaultParent().getChildCount()).toBeGreaterThan(10);
    expect(first.graph.getDefaultParent().getChildCount()).toBe(0);

    const broken: DiagramTemplate = { ...template, id: 'x', name: 'Broken', xml: '<mxGraphModel><root>' };
    expect(() => openTemplateAsNewDiagram(tm, broken)).toThrow();
    expect(tm.getAllTabs()).toHaveLength(2);
    expect(tm.getActiveTab()!.id).toBe(id);
  });

  it('"Save as template…" stores the selection under the given name', async () => {
    const graph = tabManager!.getActiveTab()!.graph;
    const store = new TemplateStore(localStorage);
    const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    let a!: Cell;
    graph.batchUpdate(() => {
      a = graph.insertVertex(graph.getDefaultParent(), null, 'Signal', 50, 50, 40, 40, parseDrawioStyle(STYLE_A));
      graph.insertVertex(graph.getDefaultParent(), null, 'Other', 300, 50, 40, 40);
    });
    graph.setSelectionCells([a]);
    const prompt = vi.fn(async () => ({ name: 'My signal', description: 'one signal' }));
    const saved = await saveAsTemplate({ graph, store, notify, prompt });
    expect(prompt).toHaveBeenCalledWith(expect.objectContaining({ hint: expect.stringContaining('1 selected shape') }));
    expect(saved).toMatchObject({ name: 'My signal', description: 'one signal', width: 40, height: 40 });
    expect(notify.success).toHaveBeenCalledWith('Template "My signal" saved', undefined);
    const { top } = decode(new TemplateStore(localStorage).list()[0].xml);
    expect(top.map((c) => c.getValue())).toEqual(['Signal']);

    // cancelled: nothing stored
    expect(await saveAsTemplate({ graph, store, notify, prompt: async () => null })).toBeNull();
    expect(store.list()).toHaveLength(1);

    // empty diagram: a hint, no dialog
    const other = tabManager!.createTab('Empty');
    const never = vi.fn();
    expect(await saveAsTemplate({ graph: other.graph, store, notify, prompt: never })).toBeNull();
    expect(never).not.toHaveBeenCalled();
    expect(notify.info).toHaveBeenCalled();
  });

  it('the Templates panel lists both sections, inserts, opens and deletes', async () => {
    const tm = tabManager!;
    const store = new TemplateStore(localStorage);
    store.add({ name: 'Yard', xml: ertmsTemplates[0].xml, width: 100, height: 50 });
    const container = document.getElementById('templates-panel')!;
    const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    const thumbnails = { thumbnail: vi.fn(async () => document.createElementNS('http://www.w3.org/2000/svg', 'svg')), forget: vi.fn() };
    const panel = createTemplatesPanel({
      container,
      store,
      loadBuiltIns: async () => ertmsTemplates,
      getGraph: () => tm.getActiveTab()?.graph ?? null,
      openAsNewDiagram: (t) => void openTemplateAsNewDiagram(tm, t),
      saveAsTemplate: vi.fn(),
      parseLibrary: parseMxLibrary,
      notify,
      thumbnails,
    });
    await panel.ready;
    const builtin = () => container.querySelectorAll('[data-section="builtin"] .rd-tpl-tile');
    const user = () => container.querySelectorAll<HTMLElement>('[data-section="user"] .rd-tpl-tile');
    expect(builtin()).toHaveLength(22);
    expect(user()).toHaveLength(1);
    expect(thumbnails.thumbnail).toHaveBeenCalledWith(expect.objectContaining({ kind: 'cells' }), 120, 72);

    // search over names, subtitles and labels
    panel.setSearch('entrance route');
    expect(builtin()).toHaveLength(1);
    expect(user()).toHaveLength(0);
    panel.setSearch('');

    // click -> popover -> Insert into diagram (view centre)
    const graph = tm.getActiveTab()!.graph;
    (builtin()[0] as HTMLElement).click();
    const popover = document.querySelector<HTMLElement>('.rd-tpl-popover')!;
    expect(popover.hidden).toBe(false);
    expect(popover.querySelector('[data-action="rename"]')).toBeNull();
    popover.querySelector<HTMLElement>('[data-action="insert"]')!.click();
    expect(popover.hidden).toBe(true);
    expect(graph.getDefaultParent().getChildCount()).toBeGreaterThan(10);

    // Open as new diagram
    user()[0].click();
    popover.querySelector<HTMLElement>('[data-action="open"]')!.click();
    expect(tm.getActiveTab()!.name).toBe('Yard');

    // empty state after deleting the user template (confirm dialog)
    user()[0].querySelector<HTMLElement>('.rd-tpl-delete')!.click();
    const confirmBtn = document.querySelector<HTMLElement>('.rd-tpl-modal .rd-tpl-btn-danger')!;
    expect(confirmBtn.textContent).toBe('Delete');
    confirmBtn.click();
    await vi.waitFor(() => expect(user()).toHaveLength(0));
    expect(container.querySelector('[data-section="user"] .rd-tpl-empty')!.textContent).toContain('Save as template');
    expect(store.list()).toHaveLength(0);
    panel.destroy();
  });

  it('the name dialog validates, submits on Enter and cancels on Escape', async () => {
    const { promptTemplateDetails } = await import('..');
    const pending = promptTemplateDetails({ heading: 'Save as template' });
    const input = document.querySelector<HTMLInputElement>('.rd-tpl-modal input[name="template-name"]')!;
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.rd-tpl-modal-error')!.hasAttribute('hidden')).toBe(false);
    input.value = 'Junction';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await expect(pending).resolves.toEqual({ name: 'Junction', description: '' });
    expect(document.querySelector('.rd-tpl-modal')).toBeNull();

    const cancelled = promptTemplateDetails({ heading: 'Rename template', name: 'X' });
    // the app's shortcut dispatcher (document capture) does not see the dialog's keys
    const docKeys = vi.fn();
    document.addEventListener('keydown', docKeys, true);
    document.querySelector('.rd-tpl-modal input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(cancelled).resolves.toBeNull();
    expect(docKeys).not.toHaveBeenCalled();
    document.removeEventListener('keydown', docKeys, true);
  });
});
