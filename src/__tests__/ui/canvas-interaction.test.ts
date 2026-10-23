/**
 * Canvas interaction like draw.io: connections start only from connection points (no hotspot
 * start, no centre point), a press in a transparent group's gap hits the group, right-click acts
 * on the selection / topmost group, arrow-key nudge skips locked cells (one undo step), and the
 * Properties geometry controls are disabled for locked cells.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Graph, InternalEvent, InternalMouseEvent, Point, Rectangle, UndoManager } from '@maxgraph/core';
import type { Cell, ConnectionHandler, EventObject, EventSource } from '@maxgraph/core';
import { installCellLocking, setCellsLocked } from '../../ui/cell-lock';
import { CONNECT_TARGET_COLOR, CONNECTION_POINT_IMAGE, ConnectionHandler as AppConnectionHandler, isInVertexCentre, isOnSourcePoint, isSymbolGroup, SOURCE_POINT_TOLERANCE } from '../../ui/connections';
import { cellAtBackgroundPoint, companionCells, EDGE_HIT_TOLERANCE, installGroupBackgroundHit, isGroupVertex, vertexAt } from '../../ui/canvas-interaction';
import { contextSelectionFor } from '../../ui/context-menu';
import { GraphCommandService } from '../../services/graph-command-service';
import { PropertiesPanel } from '../../ui/properties';
import { loadAppDom, clearAppDom } from './app-dom';

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
});

const parent = (): Cell => graph.getDefaultParent();
const vertex = (value: string, x: number, y = 10, w = 80, h = 40, p: Cell = parent()): Cell =>
  graph.insertVertex({ parent: p, value, position: [x, y], size: [w, h] });

describe('connection start', () => {
  it('no hovered vertex becomes a source before a connection started; targets still validate', () => {
    new AppConnectionHandler(graph);
    const handler = graph.getPlugin('ConnectionHandler') as ConnectionHandler;
    const a = vertex('A', 10);
    const me = new InternalMouseEvent(new MouseEvent('mousemove'));
    expect(handler.isValidSource(a, me)).toBe(false);
    handler.first = new Point(10, 10);
    expect(handler.isValidSource(a, me)).toBe(true);
    handler.first = null;
  });

  it('shapes without own points get draw.io\'s default points (rectangle 16, ellipse 8), no centre point', () => {
    new AppConnectionHandler(graph);
    const a = vertex('A', 10);
    const points = (graph.getAllConnectionConstraints(graph.view.getState(a), true) ?? []).map((c) => [c.point!.x, c.point!.y]);
    expect(points).toHaveLength(16);
    expect(points).toContainEqual([0.25, 0]);
    expect(points).toContainEqual([1, 1]);
    expect(points).not.toContainEqual([0.5, 0.5]);
    const e = graph.insertVertex({ parent: parent(), value: 'E', position: [200, 10], size: [40, 40], style: { shape: 'ellipse' } });
    expect(graph.getAllConnectionConstraints(graph.view.getState(e), true)).toHaveLength(8);
  });

  it('connection points are visible (draw.io x image) and a valid target is outlined in blue', () => {
    new AppConnectionHandler(graph);
    const handler = graph.getPlugin('ConnectionHandler') as ConnectionHandler;
    expect(handler.constraintHandler.pointImage.src).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(handler.constraintHandler.pointImage).toBe(CONNECTION_POINT_IMAGE);
    expect(handler.marker.validColor).toBe(CONNECT_TARGET_COLOR);
  });

  it('an edge end dropped on a shape body connects floating (no outline point)', () => {
    new AppConnectionHandler(graph);
    const a = vertex('A', 10);
    const b = vertex('B', 200);
    const edge = graph.insertEdge({ parent: parent(), source: a, target: b, value: '' });
    const h = graph.createEdgeHandler(graph.view.getState(edge)!, null as never) as unknown as { outline: boolean; outlineConnect: boolean; constraintHandler: { pointImage: unknown } };
    expect(h.outline).toBe(false);
    expect(h.constraintHandler.pointImage).toBe(CONNECTION_POINT_IMAGE);
  });

  it('a railway symbol group connects as a whole; its parts do not', () => {
    new AppConnectionHandler(graph);
    const g = vertex('', 300, 10, 42, 26);
    const part = vertex('', 0, 0, 10, 10, g);
    g.setConnectable(false);
    expect(isSymbolGroup(g)).toBe(false);
    expect(g.isConnectable()).toBe(false);
    const obj = document.implementation.createDocument(null, null, null).createElement('object');
    obj.setAttribute('rdKind', 'signal');
    graph.getDataModel().setValue(g, obj);
    expect(isSymbolGroup(g)).toBe(true);
    expect(g.isConnectable()).toBe(true);
    expect(part.isConnectable()).toBe(false);
    // the file flag is untouched
    expect(g.connectable).toBe(false);
  });

  it('a press in the middle of a vertex never hits a connection point', () => {
    new AppConnectionHandler(graph);
    const handler = graph.getPlugin('ConnectionHandler') as ConnectionHandler;
    const small = vertex('S', 100, 100, 12, 12);
    const state = graph.view.getState(small)!;
    expect(isInVertexCentre(state, state.getCenterX(), state.getCenterY())).toBe(true);
    expect(isInVertexCentre(state, state.x + 1, state.getCenterY())).toBe(false);
    const constraints = handler.constraintHandler;
    constraints.currentFocus = state;
    const icon = { bounds: { x: state.x - 2, y: state.getCenterY() - 2, width: 5, height: 5 } } as never;
    const mouse = (x: number, y: number): Rectangle => ({ getCenterX: () => x, getCenterY: () => y, x: x - 4, y: y - 4, width: 8, height: 8 }) as unknown as Rectangle;
    // the left midpoint icon (6 px from the centre): not from the centre ...
    expect(constraints.intersects(icon, mouse(state.getCenterX(), state.getCenterY()), true, false)).toBe(false);
    // ... but on the border, and always as a target
    expect(constraints.intersects(icon, mouse(state.x, state.getCenterY()), true, false)).toBe(true);
    expect(constraints.intersects(icon, mouse(state.x + 2, state.getCenterY()), false, false)).toBe(true);
    constraints.currentFocus = null;
  });
});

describe('transparent groups', () => {
  it('a press in a gap of a group gets the group as its state', () => {
    installGroupBackgroundHit(graph);
    const a = vertex('a', 100, 100, 20, 40);
    const b = vertex('b', 160, 100, 20, 40);
    const group = graph.groupCells(null as unknown as Cell, 0, [a, b]);
    expect(isGroupVertex(graph, group)).toBe(true);
    expect(isGroupVertex(graph, a)).toBe(false);
    expect(isGroupVertex(graph, parent())).toBe(false);
    const evt = new MouseEvent('mousedown', { clientX: 140, clientY: 120 });
    Object.defineProperty(evt, 'target', { value: container });
    const me = graph.updateMouseEvent(new InternalMouseEvent(evt), InternalEvent.MOUSE_DOWN);
    expect(me.getCell()).toBe(group);
    // outside the group: still the background
    const outside = new MouseEvent('mousedown', { clientX: 400, clientY: 400 });
    Object.defineProperty(outside, 'target', { value: container });
    expect(graph.updateMouseEvent(new InternalMouseEvent(outside), InternalEvent.MOUSE_DOWN).getCell()).toBeNull();
    // hovering a gap reaches the group only when it is connectable (its points show); presses on
    // a shape are left alone
    const move = new MouseEvent('mousemove', { clientX: 140, clientY: 120 });
    Object.defineProperty(move, 'target', { value: container });
    group.setConnectable(false);
    expect(graph.updateMouseEvent(new InternalMouseEvent(move), InternalEvent.MOUSE_MOVE).getCell()).toBeNull();
    group.setConnectable(true);
    expect(graph.updateMouseEvent(new InternalMouseEvent(move), InternalEvent.MOUSE_MOVE).getCell()).toBe(group);
    // far outside the drawing: no cell scan at all
    const far = new MouseEvent('mousemove', { clientX: 900, clientY: 900 });
    Object.defineProperty(far, 'target', { value: container });
    const spy = vi.spyOn(graph, 'getCellAt');
    expect(graph.updateMouseEvent(new InternalMouseEvent(far), InternalEvent.MOUSE_MOVE).getCell()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    const onA = new InternalMouseEvent(new MouseEvent('mousedown', { clientX: 110, clientY: 120 }), graph.view.getState(a));
    expect(graph.updateMouseEvent(onA, InternalEvent.MOUSE_DOWN).getCell()).toBe(a);
  });
});

describe('press inside any shape', () => {
  const down = (x: number, y: number): InternalMouseEvent => {
    const evt = new MouseEvent('mousedown', { clientX: x, clientY: y });
    Object.defineProperty(evt, 'target', { value: container });
    return graph.updateMouseEvent(new InternalMouseEvent(evt), InternalEvent.MOUSE_DOWN);
  };

  it('the transparent corner of an ellipse, a thin edge within the tolerance and a tiny vertex are hit; the background and layers are not', () => {
    installGroupBackgroundHit(graph);
    const e = graph.insertVertex({ parent: parent(), value: '', position: [100, 100], size: [80, 40], style: { shape: 'ellipse' } });
    expect(down(102, 102).getCell()).toBe(e);
    const line = graph.insertEdge({ parent: parent(), value: '', source: null, target: null, style: { strokeWidth: 1 } });
    const g = line.getGeometry()!.clone();
    g.setTerminalPoint(new Point(300, 200), true);
    g.setTerminalPoint(new Point(500, 200), false);
    graph.getDataModel().setGeometry(line, g);
    expect(cellAtBackgroundPoint(graph, 400, 200 + EDGE_HIT_TOLERANCE)).toBe(line);
    expect(down(400, 205).getCell()).toBe(line);
    expect(cellAtBackgroundPoint(graph, 400, 200 + EDGE_HIT_TOLERANCE + 2)).toBeNull();
    const flat = graph.insertVertex({ parent: parent(), value: '', position: [100, 300], size: [60, 0] });
    expect(cellAtBackgroundPoint(graph, 130, 302)).toBe(flat);
    expect(down(700, 700).getCell()).toBeNull();
    expect(cellAtBackgroundPoint(graph, 50, 50)).toBeNull();
  });
});

describe('press to move: selection, members, sizers, hit priority', () => {
  const railway = (cell: Cell, attrs: Record<string, string>): void => {
    const obj = document.implementation.createDocument(null, null, null).createElement('object');
    for (const [k, v] of Object.entries(attrs)) obj.setAttribute(k, v);
    graph.getDataModel().setValue(cell, obj);
  };

  it('Shift is a toggle event like Ctrl/Cmd', () => {
    new AppConnectionHandler(graph);
    expect(graph.isToggleEvent(new MouseEvent('mousedown', { shiftKey: true }))).toBe(true);
    expect(graph.isToggleEvent(new MouseEvent('mousedown'))).toBe(false);
    expect(graph.isTransparentClickEvent(new MouseEvent('mousedown', { altKey: true }))).toBe(true);
  });

  it('a balise group drags its balises (inside its frame); a track drags its loose points legs', () => {
    const bg = vertex('', 100, 100, 60, 20);
    railway(bg, { rdKind: 'baliseGroup', rdId: 'BG1' });
    const b1 = vertex('', 110, 104, 12, 12);
    railway(b1, { rdKind: 'balise', rdId: 'B1', rdGroupId: 'BG1' });
    const far = vertex('', 400, 400, 12, 12);
    railway(far, { rdKind: 'balise', rdId: 'B2', rdGroupId: 'BG1' });
    expect(companionCells(graph, [bg])).toEqual([bg, b1]);
    const track = graph.insertEdge({ parent: parent(), value: '', source: null, target: null });
    const tg = track.getGeometry()!.clone();
    tg.setTerminalPoint(new Point(0, 300), true);
    tg.setTerminalPoint(new Point(200, 300), false);
    graph.getDataModel().setGeometry(track, tg);
    railway(track, { rdKind: 'track' });
    const leg = graph.insertEdge({ parent: parent(), value: '', source: null, target: null });
    const lg = leg.getGeometry()!.clone();
    lg.setTerminalPoint(new Point(40, 300), true);
    lg.setTerminalPoint(new Point(160, 260), false);
    graph.getDataModel().setGeometry(leg, lg);
    railway(leg, { rdKind: 'points' });
    expect(companionCells(graph, [track])).toEqual([track, leg]);
    expect(companionCells(graph, [leg])).toEqual([leg]);
  });

  it('small shapes and railway symbols keep only the bottom-right sizer, outside the shape', () => {
    new AppConnectionHandler(graph);
    const small = vertex('', 100, 100, 12, 12);
    const big = vertex('', 300, 100, 120, 60);
    graph.setSelectionCells([small, big]);
    const handlers = graph.getPlugin('SelectionCellsHandler') as unknown as { getHandler(c: Cell): { sizers: Array<{ node: HTMLElement; bounds: Rectangle }> } };
    const hs = handlers.getHandler(small);
    expect(hs.sizers.filter((z) => z.node.style.display !== 'none')).toHaveLength(1);
    const st = graph.view.getState(small)!;
    expect(hs.sizers[7].bounds.x).toBeGreaterThan(st.x + st.width);
    expect(hs.sizers[7].bounds.y).toBeGreaterThan(st.y + st.height);
    expect(handlers.getHandler(big).sizers.filter((z) => z.node.style.display !== 'none')).toHaveLength(8);
  });

  it('the smallest object under the point wins over a bigger one around it', () => {
    const signal = vertex('', 100, 100, 60, 40);
    const joint = vertex('', 120, 110, 10, 12);
    graph.orderCells(false, [signal]);
    expect(graph.getCellAt(125, 116)).toBe(signal);
    expect(vertexAt(graph, 125, 116)).toBe(joint);
    expect(vertexAt(graph, 105, 105)).toBe(signal);
  });
});

describe('connection start tolerance', () => {
  it('a new connection starts only within SOURCE_POINT_TOLERANCE screen px of a point; none on a selected cell', () => {
    new AppConnectionHandler(graph);
    const handler = graph.getPlugin('ConnectionHandler') as ConnectionHandler;
    const a = vertex('A', 100, 100, 120, 60);
    const state = graph.view.getState(a)!;
    const icon = { bounds: new Rectangle(state.x + 30 - 2, state.y - 2, 5, 5) };
    const mouse = (x: number, y: number) => new Rectangle(x - 4, y - 4, 8, 8);
    const cx = state.x + 30.5;
    const cy = state.y + 0.5;
    const ch = handler.constraintHandler;
    ch.currentFocus = state;
    expect(ch.intersects(icon as never, mouse(cx, cy), true, false)).toBe(true);
    // along the edge and outside the shape within the tolerance
    expect(ch.intersects(icon as never, mouse(cx + SOURCE_POINT_TOLERANCE, cy), true, false)).toBe(true);
    expect(ch.intersects(icon as never, mouse(cx - 2, cy - SOURCE_POINT_TOLERANCE), true, false)).toBe(true);
    // 4 px off, or 2 px inside the shape: the shape moves (maxGraph's default reached ~6.5 px)
    expect(ch.intersects(icon as never, mouse(cx + 4, cy), true, false)).toBe(false);
    expect(ch.intersects(icon as never, mouse(cx, cy + 2), true, false)).toBe(false);
    expect(ch.intersects(icon as never, mouse(cx + 1, cy + 1), true, false)).toBe(true);
    // as a target (connection running / edge end) the default stays
    expect(ch.intersects(icon as never, mouse(cx + 4, cy + 4), false, false)).toBe(true);
    expect(isOnSourcePoint(icon.bounds, cx, cy, null)).toBe(true);
    ch.currentFocus = null;
    // draw.io: no source points on a selected cell, targets unaffected
    expect(ch.isStateIgnored(state, true)).toBe(false);
    graph.setSelectionCell(a);
    expect(ch.isStateIgnored(state, true)).toBe(true);
    expect(ch.isStateIgnored(state, false)).toBe(false);
  });
});

describe('context menu selection', () => {
  it('keeps a selection containing the cell or its group, else selects the topmost group', () => {
    const a = vertex('a', 100);
    const b = vertex('b', 200);
    const c = vertex('c', 400);
    const group = graph.groupCells(null as unknown as Cell, 0, [a, b]);
    const edge = graph.insertEdge({ parent: parent(), source: group, target: c });
    expect(contextSelectionFor(graph, null)).toBeNull();
    expect(contextSelectionFor(graph, a)).toEqual([group]);
    expect(contextSelectionFor(graph, edge)).toEqual([edge]);
    graph.setSelectionCells([group, c]);
    expect(contextSelectionFor(graph, a)).toEqual([group, c]);
    expect(contextSelectionFor(graph, c)).toEqual([group, c]);
    graph.setSelectionCells([a]);
    // the selected child itself
    expect(contextSelectionFor(graph, a)).toEqual([a]);
    expect(contextSelectionFor(graph, b)).toEqual([group]);
    // cells on a locked layer: nothing selectable (canvas menu)
    graph.clearSelection();
    setCellsLocked(graph, [parent()], true);
    expect(contextSelectionFor(graph, c)).toBeNull();
  });
});

describe('arrow-key nudge', () => {
  it('moves the movable top-level selected cells as one undo step, never locked ones', () => {
    const service = new GraphCommandService(graph);
    const undo = new UndoManager();
    graph.getDataModel().addListener(InternalEvent.UNDO, (_s: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit')));
    const a = vertex('a', 10);
    const b = vertex('b', 200);
    const c1 = vertex('c1', 400, 10, 20, 20);
    const c2 = vertex('c2', 440, 10, 20, 20);
    const group = graph.groupCells(null as unknown as Cell, 0, [c1, c2]);
    setCellsLocked(graph, [b], true);
    undo.clear();
    graph.setSelectionCells([a, b, group, c1]);
    expect(service.nudge(1, 0)).toBe(true);
    expect(a.getGeometry()!.x).toBe(11);
    expect(b.getGeometry()!.x).toBe(200);
    expect(group.getGeometry()!.x).toBe(401);
    // the child moved with its group only (not twice)
    expect(c1.getGeometry()!.x).toBe(0);
    undo.undo();
    expect(a.getGeometry()!.x).toBe(10);
    expect(group.getGeometry()!.x).toBe(400);
    graph.setSelectionCells([b]);
    expect(service.nudge(0, 10)).toBe(false);
    expect(b.getGeometry()!.y).toBe(10);
  });
});

describe('Properties geometry controls of locked cells', () => {
  beforeEach(() => {
    loadAppDom();
    // loadAppDom replaces the body: the graph is the shown one again
    document.body.appendChild(container);
  });
  afterEach(() => clearAppDom());

  it('are disabled for a locked cell (also via its layer) and ignore late change events', () => {
    const panel = new PropertiesPanel(graph);
    const a = vertex('a', 10);
    const field = (id: string) => document.getElementById(id) as HTMLInputElement;
    graph.setSelectionCell(a);
    expect(field('prop-x').disabled).toBe(false);
    setCellsLocked(graph, [a], true);
    for (const id of ['prop-x', 'prop-y', 'prop-w', 'prop-h', 'prop-rotation', 'btn-rotate90', 'btn-flipHorizontal', 'btn-flipVertical']) {
      expect(field(id).disabled, id).toBe(true);
    }
    expect(field('btn-lock').disabled).toBe(false);
    field('prop-w').value = '300';
    field('prop-w').dispatchEvent(new Event('change'));
    field('prop-rotation').value = '45';
    field('prop-rotation').dispatchEvent(new Event('change'));
    expect(a.getGeometry()!.width).toBe(80);
    expect((a.getStyle() as Record<string, unknown>).rotation).toBeUndefined();
    setCellsLocked(graph, [a], false);
    expect(field('prop-x').disabled).toBe(false);
    // locked layer
    graph.getDataModel().setStyle(parent(), { locked: 1 } as never);
    expect(field('prop-x').disabled).toBe(true);
    graph.getDataModel().setStyle(parent(), {} as never);
    expect(field('prop-x').disabled).toBe(false);
    field('prop-w').value = '300';
    field('prop-w').dispatchEvent(new Event('change'));
    expect(a.getGeometry()!.width).toBe(300);
    panel.destroy();
  });
});
