/**
 * cell-lock.ts: draw.io's lock (style key locked=1) on cells and layers — not movable, resizable,
 * deletable, editable or connectable but selectable; layer lock also blocks selection; one
 * undoable edit; saved in the draw.io XML and read back (also from a draw.io file).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Graph, GraphDataModel, InternalEvent, UndoManager } from '@maxgraph/core';
import type { Cell, EventObject, EventSource } from '@maxgraph/core';
import { hasLockedStyle, installCellLocking, isOnLockedLayer, setCellsLocked, toggleCellsLocked } from '../../ui/cell-lock';
import { DeleteController } from '../../ui/delete';
import { exportModelToDrawioXml, importDrawioXmlIntoModel } from '../../services/drawio-xml';

let container: HTMLDivElement;
let graph: Graph;
let undo: UndoManager;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  graph.cellsEditable = true;
  installCellLocking(graph);
  undo = new UndoManager();
  graph.getDataModel().addListener(InternalEvent.UNDO, (_s: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit')));
});

afterEach(() => {
  graph.destroy();
  container.remove();
});

function vertex(value: string, x = 10): Cell {
  return graph.insertVertex({ parent: graph.getDefaultParent(), value, position: [x, 10], size: [40, 20] });
}

describe('cell lock (locked=1)', () => {
  it('a locked cell is selectable but not movable, resizable, rotatable, deletable, editable or connectable', () => {
    const a = vertex('A');
    const b = vertex('B', 100);
    undo.clear();
    expect(toggleCellsLocked(graph, [a])).toBe(true);
    expect(hasLockedStyle(a)).toBe(true);
    expect(graph.isCellLocked(a)).toBe(true);
    expect(graph.isCellMovable(a)).toBe(false);
    expect(graph.isCellResizable(a)).toBe(false);
    expect(graph.isCellRotatable(a)).toBe(false);
    expect(graph.isCellDeletable(a)).toBe(false);
    expect(graph.isCellEditable(a)).toBe(false);
    expect(graph.isValidSource(a)).toBe(false);
    expect(graph.isValidTarget(a)).toBe(false);
    expect(graph.isCellSelectable(a)).toBe(true);
    expect(graph.isCellMovable(b)).toBe(true);
    graph.setSelectionCell(a);
    expect(graph.getSelectionCells()).toEqual([a]);

    // one undo step unlocks
    undo.undo();
    expect(hasLockedStyle(a)).toBe(false);
    expect(graph.isCellMovable(a)).toBe(true);
    undo.redo();
    expect(hasLockedStyle(a)).toBe(true);
  });

  it('Delete leaves locked cells and their edges, deletes the others', () => {
    const a = vertex('A');
    const b = vertex('B', 100);
    const c = vertex('C', 200);
    const e = graph.insertEdge({ parent: graph.getDefaultParent(), source: a, target: b });
    setCellsLocked(graph, [a], true);
    graph.setSelectionCells([a, c]);
    new DeleteController(graph).deleteSelection();
    expect(a.getParent()).toBe(graph.getDefaultParent());
    expect(e.getParent()).toBe(graph.getDefaultParent());
    expect(c.getParent()).toBeNull();
  });

  it('children of a locked group are locked; toggling uses the first cell state for all', () => {
    const a = vertex('A');
    const b = vertex('B', 100);
    const group = graph.groupCells(null as unknown as Cell, 0, [a, b]);
    setCellsLocked(graph, [group], true);
    expect(graph.isCellMovable(a)).toBe(false);
    expect(hasLockedStyle(a)).toBe(false);
    expect(toggleCellsLocked(graph, [a, b])).toBe(true);
    expect(hasLockedStyle(b)).toBe(true);
    expect(toggleCellsLocked(graph, [a, b])).toBe(false);
    expect(hasLockedStyle(a) || hasLockedStyle(b)).toBe(false);
  });

  it('a locked layer: its cells are locked and not selectable, other layers unaffected', () => {
    const a = vertex('A');
    const layer = graph.getDefaultParent();
    setCellsLocked(graph, [layer], true);
    expect(isOnLockedLayer(graph, a)).toBe(true);
    expect(graph.isCellSelectable(a)).toBe(false);
    expect(graph.isCellMovable(a)).toBe(false);
    graph.setSelectionCell(a);
    expect(graph.getSelectionCells()).toEqual([]);
    graph.selectAll(layer, true);
    expect(graph.getSelectionCells()).toEqual([]);
  });

  it('locked=1 round-trips through the draw.io XML (cells and layers), also from a draw.io file', () => {
    const a = vertex('A');
    vertex('B', 100);
    setCellsLocked(graph, [a, graph.getDefaultParent()], true);
    const xml = exportModelToDrawioXml(graph.getDataModel());
    expect(xml).toMatch(/<mxCell id="1" style="locked=1;?" parent="0"\/?>/);
    expect(xml).toMatch(new RegExp(`<mxCell id="${a.getId()}" value="A" style="[^"]*locked=1`));

    const model = new GraphDataModel();
    importDrawioXmlIntoModel(xml, model);
    expect(hasLockedStyle(model.getCell(String(a.getId())))).toBe(true);
    expect(hasLockedStyle(model.getCell('1'))).toBe(true);

    // as draw.io writes it
    const drawio = new GraphDataModel();
    importDrawioXmlIntoModel(
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="L" value="Top" style="locked=1;" parent="0"/>' +
        '<mxCell id="v" value="V" style="rounded=0;whiteSpace=wrap;html=1;locked=1;" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
        '</root></mxGraphModel>',
      drawio
    );
    expect(hasLockedStyle(drawio.getCell('v'))).toBe(true);
    expect(hasLockedStyle(drawio.getCell('L'))).toBe(true);
    expect(hasLockedStyle(drawio.getCell('1'))).toBe(false);
  });
});
