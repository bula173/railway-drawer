/**
 * Regressions: Arrange > Bring Forward / Send Backward, Edit > Select All and the JSON export
 * called GraphDataModel methods that maxGraph 0.10.3 does not have (getParent/getChildCount/
 * getChildAt/getChildren, `model.children`); the context menu's To Front / To Back were swapped.
 * Real maxGraph Graph in jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { GraphCommandService, stepOrder } from '../../services/graph-command-service';
import { createTabDocument, modelXmlToJsonCells } from '../../ui/saveload';
import { modelBackground } from '../../ui/diagram-image-export';
import { createTestGraph, cleanupTestGraph } from '../setup';

describe('stepOrder', () => {
  const cells = ['A', 'B', 'C', 'D'].map((id) => ({ id }) as unknown as Cell);
  const [A, B, C, D] = cells;
  const ids = (order: Cell[]) => order.map((c) => c.id).join('');

  it('moves single and adjacent cells one step, blocked at the ends', () => {
    expect(ids(stepOrder(cells, new Set([B]), 1))).toBe('ACBD');
    expect(ids(stepOrder(cells, new Set([B, C]), 1))).toBe('ADBC');
    expect(ids(stepOrder(cells, new Set([C, D]), 1))).toBe('ABCD');
    expect(ids(stepOrder(cells, new Set([A, C]), 1))).toBe('BADC');
    expect(ids(stepOrder(cells, new Set([C]), -1))).toBe('ACBD');
    expect(ids(stepOrder(cells, new Set([A, B]), -1))).toBe('ABCD');
    expect(ids(stepOrder(cells, new Set([B, D]), -1))).toBe('BADC');
  });
});

describe('GraphCommandService z-order and select all', () => {
  let graph: Graph;
  let service: GraphCommandService;
  const byId: Record<string, Cell> = {};

  const order = () => graph.getDefaultParent().children.map((c) => c.id).join('');
  const select = (s: string) => graph.setSelectionCells([...s].map((id) => byId[id]));

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    graph = createTestGraph();
    service = new GraphCommandService(graph);
    graph.batchUpdate(() => {
      for (const id of 'ABCD') byId[id] = graph.insertVertex(graph.getDefaultParent(), id, id, 10, 10, 40, 20);
    });
    service.clearHistory();
  });

  afterEach(() => {
    service.destroy();
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  it('bringForward / sendBackward move the selection one step as one undoable edit', () => {
    select('BC');
    service.bringForward();
    expect(order()).toBe('ADBC');
    service.undo();
    expect(order()).toBe('ABCD');
    expect(service.canUndo()).toBe(false);

    select('BD');
    service.sendBackward();
    expect(order()).toBe('BADC');
    service.undo();
    expect(order()).toBe('ABCD');
    service.redo();
    expect(order()).toBe('BADC');
  });

  it('a step that changes nothing adds no history', () => {
    select('CD');
    service.bringForward();
    expect(order()).toBe('ABCD');
    expect(service.canUndo()).toBe(false);
  });

  it('cells of a group move within the group', () => {
    const group = graph.insertVertex(graph.getDefaultParent(), 'G', '', 0, 0, 100, 100);
    const inner = ['x', 'y', 'z'].map((id) => graph.insertVertex(group, id, id, 0, 0, 10, 10));
    graph.setSelectionCells([inner[0], byId.A]);
    service.bringForward();
    expect(group.children.map((c) => c.id).join('')).toBe('yxz');
    expect(order()).toBe('BACDG');
  });

  it('toFront / toBack keep the relative order (context menu used to swap them)', () => {
    select('BA');
    service.toFront();
    expect(order()).toBe('CDAB');
    select('BC');
    service.toBack();
    expect(order()).toBe('CBDA');
    service.undo();
    expect(order()).toBe('CDAB');
  });

  it('selectAll selects the layer cells and their descendants, nothing on a locked layer', () => {
    const group = graph.insertVertex(graph.getDefaultParent(), 'G', '', 0, 0, 100, 100);
    graph.insertVertex(group, 'g1', 'g1', 0, 0, 10, 10);
    service.selectAll();
    expect(graph.getSelectionCells().map((c) => c.id).sort()).toEqual(['A', 'B', 'C', 'D', 'G', 'g1']);

    graph.clearSelection();
    graph.getDataModel().setStyle(graph.getDefaultParent(), { locked: 1 } as never);
    service.selectAll();
    expect(graph.getSelectionCount()).toBe(0);
  });
});

describe('SaveLoadController.exportAsJson', () => {
  it('lists the cells of the tab with draw.io styles, terminals and geometry', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const graph = createTestGraph();
    try {
      const controller = createTabDocument(graph);
      controller.load(
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
          '<mxCell id="a" value="Alpha" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="30" height="40" as="geometry"/></mxCell>' +
          '<object id="s1" label="S1" rdKind="signal" rdId="S1"><mxCell style="ellipse;" vertex="1" parent="1"><mxGeometry x="100" y="20" width="20" height="20" as="geometry"/></mxCell></object>' +
          '<mxCell id="e" style="endArrow=classic;" edge="1" parent="1" source="a" target="s1"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="60" y="30"/></Array></mxGeometry></mxCell>' +
          '</root></mxGraphModel>'
      );
      const data = JSON.parse(controller.exportAsJson());
      expect(data.format).toBe('railway-drawer-cells');
      const ids = data.cells.map((c: { id: string }) => c.id);
      expect(ids).toEqual(['0', '1', 'a', 's1', 'e']);
      const [, , a, s1, e] = data.cells;
      expect(a).toMatchObject({ value: 'Alpha', vertex: true, edge: false, parent: '1', geometry: { x: 10, y: 20, width: 30, height: 40 } });
      expect(a.style).toContain('fillColor=#dae8fc');
      expect(s1).toMatchObject({ value: 'S1', data: { rdKind: 'signal', rdId: 'S1' } });
      expect(e).toMatchObject({ edge: true, source: 'a', target: 's1', geometry: { relative: true, points: [{ x: 60, y: 30 }] } });
    } finally {
      cleanupTestGraph(graph);
      vi.restoreAllMocks();
    }
  });

  it('modelXmlToJsonCells of an empty model is []', () => {
    expect(modelXmlToJsonCells('<mxGraphModel/>')).toEqual([]);
  });
});

describe('modelBackground', () => {
  it('is the page colour, else white', () => {
    expect(modelBackground('<mxGraphModel background="#FFF2CC"><root/></mxGraphModel>')).toBe('#FFF2CC');
    expect(modelBackground('<mxGraphModel background="none"><root/></mxGraphModel>')).toBe('#ffffff');
    expect(modelBackground('<mxGraphModel><root/></mxGraphModel>')).toBe('#ffffff');
    expect(modelBackground('<mxGraphModel background="url(x)"><root/></mxGraphModel>')).toBe('#ffffff');
  });
});
