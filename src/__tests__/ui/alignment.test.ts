/**
 * alignment.ts: align / distribute write cloned geometries through the model in ONE update (one undo
 * step, the old geometry objects stay untouched) and skip locked cells (cell, group or layer).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { AlignmentController } from '../../ui/alignment';
import { installCellLocking, setCellsLocked } from '../../ui/cell-lock';

let container: HTMLDivElement;
let graph: Graph;
let undo: UndoManager;
let edits: number;
let ctrl: AlignmentController;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  installCellLocking(graph);
  undo = new UndoManager();
  edits = 0;
  graph.getDataModel().addListener(InternalEvent.UNDO, (_s: EventSource, evt: EventObject) => {
    edits++;
    undo.undoableEditHappened(evt.getProperty('edit'));
  });
  ctrl = new AlignmentController(graph);
});

afterEach(() => {
  ctrl.destroy();
  graph.destroy();
  container.remove();
});

function vertex(x: number, y: number, w = 40, h = 20): Cell {
  return graph.insertVertex({ parent: graph.getDefaultParent(), value: 'v', position: [x, y], size: [w, h] });
}

function prepare(cells: Cell[]): void {
  undo.clear();
  edits = 0;
  graph.setSelectionCells(cells);
}

describe('AlignmentController', () => {
  it('align left is one undoable model edit with cloned geometries', () => {
    const a = vertex(10, 10);
    const b = vertex(100, 60);
    const c = vertex(50, 120);
    const oldGeo = b.geometry!;
    prepare([a, b, c]);
    ctrl.alignLeft();
    expect([a, b, c].map((v) => v.geometry!.x)).toEqual([10, 10, 10]);
    expect(b.geometry).not.toBe(oldGeo);
    expect(oldGeo.x).toBe(100);
    expect(edits).toBe(1);
    undo.undo();
    expect([a, b, c].map((v) => v.geometry!.x)).toEqual([10, 100, 50]);
    undo.redo();
    expect(b.geometry!.x).toBe(10);
  });

  it('align center / right / top / middle / bottom', () => {
    const a = vertex(0, 0, 40, 20);
    const b = vertex(100, 100, 20, 40);
    prepare([a, b]);
    ctrl.alignRight();
    expect([a.geometry!.x, b.geometry!.x]).toEqual([80, 100]);
    ctrl.alignCenter();
    expect([a.geometry!.x + 20, b.geometry!.x + 10]).toEqual([100, 100]);
    ctrl.alignTop();
    expect([a.geometry!.y, b.geometry!.y]).toEqual([0, 0]);
    ctrl.alignBottom();
    expect([a.geometry!.y, b.geometry!.y]).toEqual([20, 0]);
    ctrl.alignMiddle();
    expect([a.geometry!.y + 10, b.geometry!.y + 20]).toEqual([20, 20]);
    expect(edits).toBe(5);
  });

  it('distribute horizontally / vertically keep equal gaps in one step', () => {
    const a = vertex(0, 0);
    const b = vertex(50, 30);
    const c = vertex(200, 200);
    prepare([c, a, b]);
    ctrl.distributeHorizontally();
    expect([a, b, c].map((v) => v.geometry!.x)).toEqual([0, 100, 200]);
    ctrl.distributeVertically();
    expect([a, b, c].map((v) => v.geometry!.y)).toEqual([0, 100, 200]);
    expect(edits).toBe(2);
    undo.undo();
    undo.undo();
    expect([a, b, c].map((v) => [v.geometry!.x, v.geometry!.y])).toEqual([[0, 0], [50, 30], [200, 200]]);
  });

  it('skips locked cells (also as reference) and does nothing with fewer than two movable', () => {
    const a = vertex(10, 10);
    const b = vertex(100, 60);
    const locked = vertex(0, 200);
    setCellsLocked(graph, [locked], true);
    prepare([a, b, locked]);
    ctrl.alignLeft();
    expect([a, b, locked].map((v) => v.geometry!.x)).toEqual([10, 10, 0]);
    prepare([a, locked]);
    ctrl.alignTop();
    expect(edits).toBe(0);
    expect(locked.geometry!.y).toBe(200);
  });

  it('skips cells on a locked layer', () => {
    const a = vertex(10, 10);
    const b = vertex(100, 60);
    prepare([a, b]);
    setCellsLocked(graph, [graph.getDefaultParent()], true);
    edits = 0;
    ctrl.alignLeft();
    expect(edits).toBe(0);
    expect(b.geometry!.x).toBe(100);
  });

  it('no edit when nothing changes', () => {
    const a = vertex(10, 10);
    const b = vertex(10, 60);
    prepare([a, b]);
    ctrl.alignLeft();
    expect(edits).toBe(0);
  });
});
