/**
 * GroupingController: group + ungroup round-trip through maxGraph's groupCells/ungroupCells
 * (the old code called model.setParent/getChildren, which maxGraph 0.10 does not have).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Graph, UndoManager, InternalEvent } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { GroupingController } from '../../ui/grouping';

let container: HTMLDivElement;
let graph: Graph;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
});

afterEach(() => {
  graph.destroy();
  container.remove();
});

function addShapes(): [Cell, Cell] {
  const parent = graph.getDefaultParent();
  let a!: Cell;
  let b!: Cell;
  graph.batchUpdate(() => {
    a = graph.insertVertex({ parent, value: 'A', position: [40, 60], size: [80, 40] });
    b = graph.insertVertex({ parent, value: 'B', position: [200, 120], size: [60, 30] });
  });
  return [a, b];
}

describe('GroupingController', () => {
  it('groups the selected shapes and ungroups them back to the same positions', () => {
    const controller = new GroupingController(graph);
    const [a, b] = addShapes();
    graph.setSelectionCells([a, b]);

    const group = controller.group();
    expect(group).not.toBeNull();
    expect(a.getParent()).toBe(group);
    expect(b.getParent()).toBe(group);
    expect(group!.getParent()).toBe(graph.getDefaultParent());
    expect(group!.geometry).toMatchObject({ x: 40, y: 60, width: 220, height: 90 });
    expect(a.geometry).toMatchObject({ x: 0, y: 0 });
    expect(b.geometry).toMatchObject({ x: 160, y: 60 });
    expect(graph.getSelectionCells()).toEqual([group]);
    expect(group!.style).toMatchObject({ dashed: true, strokeColor: '#0066cc' });

    // Moving the group moves the children with it (relative geometries)
    graph.moveCells([group!], 10, 5);
    expect(group!.geometry).toMatchObject({ x: 50, y: 65 });

    const ungrouped = controller.ungroup();
    expect(new Set(ungrouped)).toEqual(new Set([a, b]));
    expect(a.getParent()).toBe(graph.getDefaultParent());
    expect(b.getParent()).toBe(graph.getDefaultParent());
    expect(a.geometry).toMatchObject({ x: 50, y: 65, width: 80, height: 40 });
    expect(b.geometry).toMatchObject({ x: 210, y: 125, width: 60, height: 30 });
    expect(graph.getDataModel().getCell(group!.getId()!)).toBeFalsy();
  });

  it('is one undoable edit each way', () => {
    const controller = new GroupingController(graph);
    const undo = new UndoManager();
    const listener = (_sender: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit'));
    graph.getDataModel().addListener(InternalEvent.UNDO, listener);
    const [a, b] = addShapes();
    undo.clear();

    graph.setSelectionCells([a, b]);
    const group = controller.group()!;
    expect(a.getParent()).toBe(group);
    undo.undo();
    expect(a.getParent()).toBe(graph.getDefaultParent());
    expect(a.geometry).toMatchObject({ x: 40, y: 60 });
    undo.redo();
    expect(a.getParent()).toBe(group);

    graph.setSelectionCells([group]);
    controller.ungroup();
    expect(a.getParent()).toBe(graph.getDefaultParent());
    undo.undo();
    expect(a.getParent()).toBe(group);
  });

  it('needs at least two shapes', () => {
    const controller = new GroupingController(graph);
    const [a] = addShapes();
    graph.setSelectionCells([a]);
    expect(controller.group()).toBeNull();
    expect(a.getParent()).toBe(graph.getDefaultParent());
    expect(controller.ungroup()).toEqual([]);
  });
});
