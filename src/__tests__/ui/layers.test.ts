/**
 * LayersController on the model's real layers (draw.io Layers dialog): add makes the new layer
 * current (default parent), delete removes the layer cell with its shapes in one undoable edit,
 * visibility is the layer's `visible`, lock is `locked=1` on the layer cell's style.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { LayersController } from '../../ui/layers';
import { hasLockedStyle, installCellLocking } from '../../ui/cell-lock';

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
  installCellLocking(graph);
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

function setup(): { layers: LayersController; a: Cell; b: Cell; first: Cell; second: Cell } {
  const layers = new LayersController(graph);
  const first = graph.getDefaultParent();
  const a = graph.insertVertex({ parent: first, value: 'A', position: [10, 10], size: [40, 20] });
  const second = layers.addLayer().cell;
  const b = graph.insertVertex({ parent: graph.getDefaultParent(), value: 'B', position: [100, 10], size: [40, 20] });
  undo.clear();
  return { layers, a, b, first, second };
}

const ids = (layers: LayersController): string[] => layers.getLayers().map((l) => l.id);

describe('LayersController', () => {
  it('+ Layer adds a model layer on top and makes it the current layer (new cells go there)', () => {
    const { layers, a, b, first, second } = setup();
    expect(graph.getDataModel().getRoot()!.children).toEqual([first, second]);
    expect(graph.getDefaultParent()).toBe(second);
    expect(a.getParent()).toBe(first);
    expect(b.getParent()).toBe(second);
    expect(layers.getCurrentLayer()?.cell).toBe(second);
    // listed top-most first, unnamed layer = "Background"
    const names = Array.from(list.querySelectorAll('.layer-name')).map((n) => n.textContent);
    expect(names).toEqual(['Layer 2 (1)', 'Background (1)']);
    (list.querySelectorAll('.layer-item')[1] as HTMLElement).click();
    expect(graph.getDefaultParent()).toBe(first);
  });

  it('the × button deletes that layer and its shapes; Undo restores both', () => {
    const { layers, a, b, first, second } = setup();
    const items = list.querySelectorAll('.layer-item');
    expect(items).toHaveLength(2);
    (items[0].querySelector('.layer-delete') as HTMLButtonElement).click();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(ids(layers)).toEqual([String(first.getId())]);
    expect(b.getParent()?.getParent()).toBeFalsy();
    expect(graph.getDataModel().getCell(String(b.getId()))).toBeFalsy();
    expect(a.getParent()).toBe(first);
    expect(graph.getDefaultParent()).toBe(first);
    expect(list.querySelectorAll('.layer-item')).toHaveLength(1);

    undo.undo();
    expect(b.getParent()).toBe(second);
    expect(ids(layers)).toEqual([String(first.getId()), String(second.getId())]);
    expect(list.querySelectorAll('.layer-item')).toHaveLength(2);
  });

  it('cancelling the confirm keeps the layer; the last layer cannot be deleted', () => {
    const { layers, b, first, second } = setup();
    vi.mocked(confirm).mockReturnValueOnce(false);
    expect(layers.deleteLayer(String(second.getId()))).toBe(false);
    expect(b.getParent()).toBe(second);
    expect(layers.getLayers()).toHaveLength(2);

    expect(layers.deleteLayer(String(second.getId()))).toBe(true);
    expect(layers.deleteLayer(String(first.getId()))).toBe(false);
    expect(alert).toHaveBeenCalledWith('Cannot delete the last layer');
    expect(layers.getLayers()).toHaveLength(1);
  });

  it('the eye toggles the layer visible flag (undoable)', () => {
    const { layers, second } = setup();
    (list.querySelectorAll('.layer-item')[0].querySelector('.layer-visibility') as HTMLButtonElement).click();
    expect(second.isVisible()).toBe(false);
    expect(layers.getLayers()[1].visible).toBe(false);
    undo.undo();
    expect(second.isVisible()).toBe(true);
  });

  it('the padlock sets locked=1 on the layer: its cells cannot be selected; Undo unlocks', () => {
    const { layers, a, b, second } = setup();
    graph.setSelectionCells([a, b]);
    (list.querySelectorAll('.layer-item')[0].querySelector('.layer-lock') as HTMLButtonElement).click();
    expect(hasLockedStyle(second)).toBe(true);
    expect(layers.getLayers()[1].locked).toBe(true);
    expect(list.querySelectorAll('.layer-lock')[0].textContent).toBe('🔒');
    // the locked layer's cell left the selection and cannot be selected again
    expect(graph.getSelectionCells()).toEqual([a]);
    graph.setSelectionCells([a, b]);
    expect(graph.getSelectionCells()).toEqual([a]);
    expect(graph.isCellMovable(b)).toBe(false);
    expect(graph.isCellDeletable(b)).toBe(false);

    undo.undo();
    expect(hasLockedStyle(second)).toBe(false);
    expect(list.querySelectorAll('.layer-lock')[0].textContent).toBe('🔓');
    graph.setSelectionCell(b);
    expect(graph.getSelectionCells()).toEqual([b]);
  });
});
