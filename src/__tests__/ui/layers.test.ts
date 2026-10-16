/**
 * LayersController: deleting a layer removes the layer and its shapes in one undoable model edit;
 * Undo brings both back. (The list's × button used to pass the layer itself as a cell.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { LayersController } from '../../ui/layers';

let container: HTMLDivElement;
let list: HTMLDivElement;
let graph: Graph;
let undo: UndoManager;

beforeEach(() => {
  list = document.createElement('div');
  list.id = 'layers-list';
  document.body.appendChild(list);
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  undo = new UndoManager();
  graph.getDataModel().addListener(InternalEvent.UNDO, (_s: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit')));
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  graph.destroy();
  container.remove();
  list.remove();
  vi.unstubAllGlobals();
});

function setup(): { layers: LayersController; a: Cell; b: Cell; secondId: string } {
  const layers = new LayersController(graph);
  layers.addLayer();
  const secondId = layers.getCurrentLayer()!.id;
  let a!: Cell;
  let b!: Cell;
  graph.batchUpdate(() => {
    a = graph.insertVertex({ parent: graph.getDefaultParent(), value: 'A', position: [10, 10], size: [40, 20] });
    b = graph.insertVertex({ parent: graph.getDefaultParent(), value: 'B', position: [100, 10], size: [40, 20] });
  });
  layers.addCellToLayer(b, secondId);
  (b as Cell & { __layerId?: string }).__layerId = secondId;
  layers.getLayers()[0].cells = layers.getLayers()[0].cells.filter((c) => c !== b);
  undo.clear();
  return { layers, a, b, secondId };
}

describe('LayersController delete', () => {
  it('the × button deletes that layer and its shapes; Undo restores both', () => {
    const { layers, a, b, secondId } = setup();
    expect(layers.getLayers().map((l) => l.id)).toEqual(['layer-0', secondId]);

    const items = list.querySelectorAll('.layer-item');
    expect(items).toHaveLength(2);
    (items[1].querySelector('button:last-of-type') as HTMLButtonElement).click();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(layers.getLayers().map((l) => l.id)).toEqual(['layer-0']);
    expect(b.getParent()).toBeNull();
    expect(a.getParent()).toBe(graph.getDefaultParent());
    expect(list.querySelectorAll('.layer-item')).toHaveLength(1);

    undo.undo();
    expect(b.getParent()).toBe(graph.getDefaultParent());
    expect(layers.getLayers().map((l) => l.id)).toEqual(['layer-0', secondId]);
    expect(layers.getLayers()[1].cells).toEqual([b]);
    expect(list.querySelectorAll('.layer-item')).toHaveLength(2);
  });

  it('cancelling the confirm keeps the layer; the last layer cannot be deleted', () => {
    const { layers, b, secondId } = setup();
    vi.mocked(confirm).mockReturnValueOnce(false);
    expect(layers.deleteLayer(secondId)).toBe(false);
    expect(b.getParent()).toBe(graph.getDefaultParent());
    expect(layers.getLayers()).toHaveLength(2);

    expect(layers.deleteLayer(secondId)).toBe(true);
    expect(layers.deleteLayer('layer-0')).toBe(false);
    expect(alert).toHaveBeenCalledWith('Cannot delete the last layer');
    expect(layers.getLayers()).toHaveLength(1);
  });
});
