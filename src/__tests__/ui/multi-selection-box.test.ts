/** multi-selection-box.ts: more than MULTI_SELECTION_BOX_MIN selected cells -> no per-cell handlers, one box. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { Cell, SelectionCellsHandler } from '@maxgraph/core';
import { MULTI_SELECTION_BOX_MIN, installMultiSelectionBox, selectionBounds } from '../../ui/multi-selection-box';

let container: HTMLDivElement;
let graph: Graph;
let uninstall: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  uninstall = installMultiSelectionBox(graph);
});

afterEach(() => {
  uninstall();
  graph.destroy();
  container.remove();
});

const boxes = (): Element[] => Array.from(container.querySelectorAll('.rd-multi-selection-box'));

describe('multi-selection box', () => {
  it('small selections keep their handlers, large ones get one box', () => {
    const cells: Cell[] = [];
    for (let i = 0; i <= MULTI_SELECTION_BOX_MIN; i++) {
      cells.push(graph.insertVertex({ parent: graph.getDefaultParent(), value: '', position: [10 + i * 50, 20], size: [40, 20] }));
    }
    const sch = graph.getPlugin('SelectionCellsHandler') as unknown as SelectionCellsHandler;
    graph.setSelectionCells(cells.slice(0, 2));
    expect(sch.getHandler(cells[0])).toBeTruthy();
    expect(boxes()).toHaveLength(0);
    graph.setSelectionCells(cells);
    expect(sch.getHandler(cells[0])).toBeFalsy();
    expect(boxes()).toHaveLength(1);
    expect(boxes()[0].getAttribute('data-count')).toBe(String(cells.length));
    const b = selectionBounds(graph)!;
    expect(Math.abs(b.x - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width - (MULTI_SELECTION_BOX_MIN * 50 + 40))).toBeLessThanOrEqual(2);
    graph.clearSelection();
    expect(boxes()).toHaveLength(0);
  });
});
