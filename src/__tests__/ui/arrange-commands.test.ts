/**
 * arrange-commands.ts (Edit / Arrange menus like draw.io): Select Vertices / Edges / None, Rotate 90°, Flip, Lock,
 * one undo step each, locked cells keep their transform; groupSelection / duplicateCells (railway ids renumbered).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { flipSelection, rotateSelection90, selectEdges, selectNone, selectVertices, toggleSelectionLocked } from '../../ui/arrange-commands';
import { installCellLocking, hasLockedStyle } from '../../ui/cell-lock';
import { groupSelection } from '../../ui/grouping';
import { duplicateCells } from '../../ui/duplicate-offset';

let container: HTMLDivElement;
let graph: Graph;
let undo: UndoManager;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  installCellLocking(graph);
  undo = new UndoManager();
  graph.getDataModel().addListener(InternalEvent.UNDO, (_s: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit')));
});

afterEach(() => {
  graph.destroy();
  container.remove();
});

const vertex = (x: number): Cell => graph.insertVertex({ parent: graph.getDefaultParent(), value: '', position: [x, 10], size: [40, 20] });

describe('arrange commands', () => {
  it('select vertices / edges / none', () => {
    const a = vertex(10);
    const b = vertex(100);
    const e = graph.insertEdge({ parent: graph.getDefaultParent(), source: a, target: b });
    selectVertices(graph);
    expect(graph.getSelectionCells()).toEqual([a, b]);
    selectEdges(graph);
    expect(graph.getSelectionCells()).toEqual([e]);
    selectNone(graph);
    expect(graph.getSelectionCount()).toBe(0);
  });

  it('rotate 90° and flips: one undo step each, locked cells skipped', () => {
    const a = vertex(10);
    const b = vertex(100);
    graph.setSelectionCells([a, b]);
    toggleSelectionLocked(graph);
    expect(hasLockedStyle(b)).toBe(true);
    toggleSelectionLocked(graph);
    expect(hasLockedStyle(b)).toBe(false);
    graph.setSelectionCell(b);
    toggleSelectionLocked(graph);
    graph.setSelectionCells([a, b]);
    undo.clear();
    rotateSelection90(graph);
    expect(a.getStyle().rotation).toBe(90);
    expect(b.getStyle().rotation).toBeUndefined();
    rotateSelection90(graph);
    expect(a.getStyle().rotation).toBe(180);
    flipSelection(graph, 'flipH');
    expect(a.getStyle().flipH).toBe(true);
    flipSelection(graph, 'flipV');
    expect(a.getStyle().flipV).toBe(true);
    expect(undo.history.length).toBe(4);
    undo.undo();
    expect(a.getStyle().flipV).toBeFalsy();
  });

  it('group and duplicate are one undo step each', () => {
    const a = vertex(10);
    const b = vertex(100);
    graph.setSelectionCells([a, b]);
    undo.clear();
    const group = groupSelection(graph);
    expect(group?.children).toEqual([a, b]);
    const copies = duplicateCells(graph, [group!]);
    expect(copies).toHaveLength(1);
    expect(copies[0].getGeometry()!.x).toBe(group!.getGeometry()!.x + 20);
    expect(undo.history.length).toBe(2);
  });
});
