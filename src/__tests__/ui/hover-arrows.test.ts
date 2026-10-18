/**
 * draw.io connection arrows (src/ui/hover-arrows.ts): placement math, click modes, clone data
 * (fresh railway IDs, dropped route/railML attributes), which cells get arrows (locks, edges,
 * groups), connectVertex as one undo step, and the persisted View > Connection Arrows setting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { installCellLocking, setCellsLocked } from '../../ui/cell-lock';
import {
  CONNECTION_ARROWS_KEY,
  DEFAULT_EDGE_LENGTH,
  HoverArrowsController,
  clonePosition,
  connectEndPoint,
  connectMode,
  connectVertex,
  findConnectTarget,
  hoverArrowCell,
  isConnectionArrowsEnabled,
  prepareClonedCells,
  resetConnectionArrowsSettingCache,
  selectionLevelCell,
  setConnectionArrowsEnabled,
  syncConnectionArrowsMenu,
  toggleConnectionArrows,
} from '../../ui/hover-arrows';
import { setRailwayData } from '../../railway/object-data';

let container: HTMLDivElement;
let graph: Graph;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  graph.setConnectable(true);
  installCellLocking(graph);
});

afterEach(() => {
  graph.destroy();
  container.remove();
  vi.restoreAllMocks();
  localStorage.removeItem(CONNECTION_ARROWS_KEY);
  resetConnectionArrowsSettingCache();
});

const parent = (): Cell => graph.getDefaultParent();
const vertex = (value: string, x: number, y = 10, w = 80, h = 40, p: Cell = parent()): Cell =>
  graph.insertVertex({ parent: p, value, position: [x, y], size: [w, h] });
const edgesOf = (): Cell[] => Object.values(graph.getDataModel().cells ?? {}).filter((c) => c.isEdge());
const verticesOf = (): Cell[] => (parent().children ?? []).filter((c) => c.isVertex());

function undoManager(): UndoManager {
  const undo = new UndoManager();
  const listener = (_s: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit'));
  graph.getDataModel().addListener(InternalEvent.UNDO, listener);
  return undo;
}

describe('placement (draw.io connectVertex)', () => {
  const geo = { x: 100, y: 50, width: 120, height: 60 };

  it('the end point lies defaultEdgeLength (80) beyond the middle of the side', () => {
    expect(DEFAULT_EDGE_LENGTH).toBe(80);
    expect(connectEndPoint(geo, 'east')).toEqual({ x: 300, y: 80 });
    expect(connectEndPoint(geo, 'west')).toEqual({ x: 20, y: 80 });
    expect(connectEndPoint(geo, 'north')).toEqual({ x: 160, y: -30 });
    expect(connectEndPoint(geo, 'south')).toEqual({ x: 160, y: 190 });
  });

  it('a same-size clone keeps the row/column with an 80 gap', () => {
    expect(clonePosition(geo, 'east')).toEqual({ x: 300, y: 50 });
    expect(clonePosition(geo, 'west')).toEqual({ x: -100, y: 50 });
    expect(clonePosition(geo, 'north')).toEqual({ x: 100, y: -90 });
    expect(clonePosition(geo, 'south')).toEqual({ x: 100, y: 190 });
  });

  it('modifiers: click / Ctrl / Shift / Ctrl+Shift', () => {
    expect(connectMode({ ctrl: false, shift: false })).toEqual({ clone: true, searchTarget: true, edge: true });
    expect(connectMode({ ctrl: true, shift: false })).toEqual({ clone: true, searchTarget: false, edge: true });
    expect(connectMode({ ctrl: false, shift: true })).toEqual({ clone: false, searchTarget: true, edge: true });
    expect(connectMode({ ctrl: true, shift: true })).toEqual({ clone: true, searchTarget: false, edge: false });
  });
});

describe('which cell gets arrows', () => {
  it('unlocked vertices only: no edges, no locked cells, no cells on a locked layer, not connectable=0', () => {
    const a = vertex('A', 10);
    const b = vertex('B', 200);
    const e = graph.insertEdge(parent(), null, '', a, b);
    expect(hoverArrowCell(graph, a)).toBe(a);
    expect(hoverArrowCell(graph, e)).toBeNull();
    expect(hoverArrowCell(graph, parent())).toBeNull();
    setCellsLocked(graph, [a], true);
    expect(hoverArrowCell(graph, a)).toBeNull();
    setCellsLocked(graph, [parent()], true);
    expect(hoverArrowCell(graph, b)).toBeNull();
    setCellsLocked(graph, [parent()], false);
    expect(hoverArrowCell(graph, b)).toBe(b);
    b.setConnectable(false);
    expect(hoverArrowCell(graph, b)).toBeNull();
    graph.getDataModel().setStyle(a, { allowArrows: 0 } as never);
    setCellsLocked(graph, [a], false);
    expect(hoverArrowCell(graph, a)).toBeNull();
  });

  it('a group gets the arrows (like its first-click selection); a child once the group is selected', () => {
    const group = vertex('', 10, 10, 200, 60);
    group.setConnectable(false);
    const child = vertex('C', 0, 0, 60, 60, group);
    vertex('D', 120, 0, 60, 60, group);
    expect(selectionLevelCell(graph, child)).toBe(group);
    expect(hoverArrowCell(graph, child)).toBe(group);
    graph.setSelectionCell(group);
    expect(hoverArrowCell(graph, child)).toBe(child);
    // locked group: none for the group and its children
    graph.clearSelection();
    setCellsLocked(graph, [group], true);
    expect(hoverArrowCell(graph, child)).toBeNull();
  });
});

describe('clone data', () => {
  it('railway objects get the next free ID of their kind; routes and railML ids are dropped', () => {
    const s1 = vertex('S', 10);
    const s2 = vertex('S', 200);
    setRailwayData(graph.getDataModel(), [s1, s2], { kind: 'signal' }, { autoId: true });
    setRailwayData(graph.getDataModel(), [s1], { attrs: { rdRoutes: 'R1', rdRailmlId: 'sig_1', rdDirection: 'reverse' } });
    const [clone] = graph.cloneCells([s1], false);
    prepareClonedCells(graph.getDataModel(), [clone]);
    const value = clone.getValue() as Element;
    expect(value.getAttribute('rdKind')).toBe('signal');
    expect(value.getAttribute('rdId')).toBe('S3');
    expect(value.getAttribute('rdDirection')).toBe('reverse');
    expect(value.hasAttribute('rdRoutes')).toBe(false);
    expect(value.hasAttribute('rdRailmlId')).toBe(false);
    // the original is untouched
    expect((s1.getValue() as Element).getAttribute('rdId')).toBe('S1');
    expect((s1.getValue() as Element).getAttribute('rdRoutes')).toBe('R1');
  });

  it('railway children of a cloned group get distinct fresh IDs; plain cells keep their value', () => {
    const group = vertex('', 10, 10, 200, 60);
    const b1 = vertex('b', 0, 0, 20, 20, group);
    const b2 = vertex('b', 40, 0, 20, 20, group);
    const plain = vertex('plain', 80, 0, 20, 20, group);
    setRailwayData(graph.getDataModel(), [b1, b2], { kind: 'balise' }, { autoId: true });
    const [clone] = graph.cloneCells([group], false);
    prepareClonedCells(graph.getDataModel(), [clone]);
    const ids = (clone.children ?? []).map((c) => (typeof c.getValue() === 'string' ? c.getValue() : (c.getValue() as Element).getAttribute('rdId')));
    expect(ids).toEqual(['B3', 'B4', 'plain']);
    expect(plain.getValue()).toBe('plain');
  });
});

describe('connectVertex', () => {
  it('click: a clone 80 to the right, connected, one undo step', () => {
    const undo = undoManager();
    const a = vertex('A', 40, 40, 120, 60);
    const before = verticesOf().length;
    const result = connectVertex(graph, a, 'east');
    expect(result.cloned).toBe(true);
    const clone = result.target!;
    expect(clone).not.toBe(a);
    expect(clone.getValue()).toBe('A');
    expect(clone.getGeometry()).toMatchObject({ x: 240, y: 40, width: 120, height: 60 });
    expect(result.edge!.source).toBe(a);
    expect(result.edge!.target).toBe(clone);
    expect(verticesOf().length).toBe(before + 1);
    undo.undo();
    expect(verticesOf().length).toBe(before);
    expect(edgesOf()).toEqual([]);
  });

  it('a cell in that direction is connected instead; Ctrl clones anyway; locked cells are no targets', () => {
    const a = vertex('A', 40, 40, 120, 60);
    const b = vertex('B', 260, 50, 80, 40); // its left side is at the end point (240)
    expect(findConnectTarget(graph, a, 'east')).toBe(b);
    expect(findConnectTarget(graph, a, 'south')).toBeNull();
    const result = connectVertex(graph, a, 'east');
    expect(result).toMatchObject({ cloned: false, target: b });
    expect(result.edge!.target).toBe(b);
    const forced = connectVertex(graph, a, 'east', { ctrl: true, shift: false });
    expect(forced.cloned).toBe(true);
    setCellsLocked(graph, [b], true);
    expect(findConnectTarget(graph, a, 'east')).not.toBe(b);
  });

  it('Shift: no clone (dangling edge to the end point); Ctrl+Shift: a clone without an edge', () => {
    const a = vertex('A', 40, 40, 120, 60);
    const before = verticesOf().length;
    const dangling = connectVertex(graph, a, 'south', { ctrl: false, shift: true });
    expect(dangling.target).toBeNull();
    expect(verticesOf().length).toBe(before);
    expect(dangling.edge!.target).toBeNull();
    expect(dangling.edge!.getGeometry()!.getTerminalPoint(false)).toMatchObject({ x: 100, y: 180 });
    const copy = connectVertex(graph, a, 'south', { ctrl: true, shift: true });
    expect(copy.edge).toBeNull();
    expect(copy.target!.getGeometry()).toMatchObject({ x: 40, y: 180 });
  });
});

describe('controller and setting', () => {
  it('View > Connection Arrows is on by default, persisted and synced to the menu item', () => {
    resetConnectionArrowsSettingCache();
    expect(isConnectionArrowsEnabled()).toBe(true);
    const item = document.createElement('div');
    item.dataset.action = 'toggleConnectionArrows';
    document.body.appendChild(item);
    syncConnectionArrowsMenu();
    expect(item.getAttribute('aria-checked')).toBe('true');
    expect(toggleConnectionArrows()).toBe(false);
    expect(localStorage.getItem(CONNECTION_ARROWS_KEY)).toBe('0');
    expect(item.getAttribute('aria-checked')).toBe('false');
    resetConnectionArrowsSettingCache();
    expect(isConnectionArrowsEnabled()).toBe(false);
    setConnectionArrowsEnabled(true);
    expect(item.getAttribute('aria-checked')).toBe('true');
    item.remove();
  });

  it('arrows are created in the graph container, hidden by reset/escape and removed on destroy', () => {
    const controller = new HoverArrowsController(graph);
    const a = vertex('A', 40, 40, 120, 60);
    (controller as unknown as { show(c: Cell): void }).show(a);
    expect(container.querySelectorAll('.rd-hover-arrow').length).toBe(4);
    expect(controller.getCurrentCell()).toBe(a);
    controller.escape();
    expect(container.querySelectorAll('.rd-hover-arrow').length).toBe(0);
    (controller as unknown as { show(c: Cell): void }).show(a);
    // a lock (model change) hides them
    setCellsLocked(graph, [a], true);
    expect(controller.getCurrentCell()).toBeNull();
    setCellsLocked(graph, [a], false);
    (controller as unknown as { show(c: Cell): void }).show(a);
    setConnectionArrowsEnabled(false);
    expect(controller.getCurrentCell()).toBeNull();
    setConnectionArrowsEnabled(true);
    (controller as unknown as { show(c: Cell): void }).show(a);
    controller.destroy();
    expect(container.querySelectorAll('.rd-hover-arrow').length).toBe(0);
  });
});
