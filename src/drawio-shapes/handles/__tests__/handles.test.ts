import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EventObject, Graph, InternalEvent, InternalMouseEvent, Point } from '@maxgraph/core';
import type { Cell, CellStyle, EdgeHandler, SelectionCellsHandler, VertexHandler } from '@maxgraph/core';
import { GraphCommandService } from '../../../services/graph-command-service';
import { registerShapesCoreShapes } from '../../js/shapes-core';
import { registerShapesEdgeShapes } from '../../js/shapes-edges';
import { registerMxLibShapes } from '../../js/mx-libs';
import { DrawioHandle, DRAWIO_HANDLE_FACTORIES, installDrawioHandles } from '..';

let container: HTMLElement;
let graph: Graph;

beforeAll(() => {
  // jsdom has no layout: maxGraph measures labels with getBBox
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
  // maxGraph registers its core shapes with the first Graph; draw.io's then replace them
  (Graph.prototype as unknown as { registerDefaults(): void }).registerDefaults();
  registerShapesCoreShapes();
  registerShapesEdgeShapes();
  registerMxLibShapes();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  graph?.destroy();
  container?.remove();
});

function st(style: Record<string, unknown>): CellStyle {
  return style as unknown as CellStyle;
}

function styleOf(cell: Cell): Record<string, unknown> {
  return cell.style as unknown as Record<string, unknown>;
}

function newGraph(): Graph {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  installDrawioHandles(graph);
  return graph;
}

function insert(g: Graph, style: CellStyle, size: [number, number] = [120, 60]): Cell {
  let cell: Cell | undefined;
  g.batchUpdate(() => {
    cell = g.insertVertex({ parent: g.getDefaultParent(), position: [100, 100], size, style });
  });
  return cell!;
}

function handlerFor(g: Graph, cell: Cell): VertexHandler {
  g.setSelectionCell(cell);
  const sch = g.getPlugin('SelectionCellsHandler') as SelectionCellsHandler;
  return sch.getHandler(cell) as VertexHandler;
}

function mouse(type: string, x: number, y: number): InternalMouseEvent {
  const me = new InternalMouseEvent(new MouseEvent(type, { clientX: x, clientY: y }));
  me.graphX = x;
  me.graphY = y;
  return me;
}

/** Drags custom handle `i` of `handler` to (x, y) graph coordinates; returns the live style before mouseUp. */
function drag(g: Graph, handler: VertexHandler | EdgeHandler, i: number, x: number, y: number): Record<string, unknown> {
  const h = handler.customHandles![i] as DrawioHandle;
  const start = h.shape!.bounds!;
  handler.start(start.getCenterX(), start.getCenterY(), InternalEvent.CUSTOM_HANDLE - i);
  handler.mouseMove(g, mouse('mousemove', x, y));
  const live = { ...(handler.state.style as Record<string, unknown>) };
  handler.mouseUp(g, mouse('mouseup', x, y));
  return live;
}

describe('installDrawioHandles', () => {
  it('adds draw.io handles for ported shapes, the rounded arc handle and none for plain rectangles', () => {
    const g = newGraph();
    const process = handlerFor(g, insert(g, st({ shape: 'process', size: 0.1 })));
    expect(process.customHandles).toHaveLength(1);
    expect(process.customHandles[0]).toBeInstanceOf(DrawioHandle);
    // draw.io's yellow diamond image
    expect(process.customHandles[0].image?.src).toMatch(/^data:image\/svg\+xml;base64,/);

    const plain = handlerFor(g, insert(g, st({ rounded: false })));
    expect(plain.customHandles).toHaveLength(0);

    const rounded = handlerFor(g, insert(g, st({ rounded: true })));
    expect(rounded.customHandles).toHaveLength(1);

    const callout = handlerFor(g, insert(g, st({ shape: 'callout', rounded: 1 })));
    expect(callout.customHandles).toHaveLength(4);

    // mx-libs factories are merged in (mxArrows.js entries)
    expect(typeof DRAWIO_HANDLE_FACTORIES['mxgraph.arrows2.arrow']).toBe('function');
  });

  it('places the handle from the style (process: x + width * size)', () => {
    const g = newGraph();
    const handler = handlerFor(g, insert(g, st({ shape: 'process', size: 0.25 })));
    const b = handler.customHandles[0].shape!.bounds!;
    expect(b.getCenterX()).toBeCloseTo(100 + 120 * 0.25, 0);
    expect(b.getCenterY()).toBeCloseTo(100 + 60 / 4, 0);
  });

  it('dragging updates the style live, commits on mouse up and undoes in one step', () => {
    const g = newGraph();
    g.gridEnabled = false;
    const commands = new GraphCommandService(g);
    const cell = insert(g, st({ shape: 'process', size: 0.1 }));
    commands.clearHistory();
    const handler = handlerFor(g, cell);

    // processEvent centres the 16px handle image: pt = mouse - 16 / 4
    const live = drag(g, handler, 0, 100 + 30 + 4, 120);
    expect(live.size).toBeCloseTo(0.25, 5);
    expect(styleOf(cell).size).toBeCloseTo(0.25, 5);
    expect((g.view.getState(cell)!.style as Record<string, unknown>).size).toBeCloseTo(0.25, 5);

    commands.undo();
    expect(styleOf(cell).size).toBe(0.1);
    commands.redo();
    expect(styleOf(cell).size).toBeCloseTo(0.25, 5);
    commands.destroy();
  });

  it('rounded rectangle arc handle writes arcSize; note handle writes size', () => {
    const g = newGraph();
    g.gridEnabled = false;
    const rect = insert(g, st({ rounded: 1 }), [100, 100]);
    // arc handle: arcSize = (width - (pt.x - x)) * 100 / min(w, h); drop at x + 80 -> 20
    drag(g, handlerFor(g, rect), 0, 100 + 80 + 4, 112 + 4);
    expect(styleOf(rect).arcSize).toBe(20);

    const note = insert(g, st({ shape: 'note', size: 30 }), [100, 100]);
    drag(g, handlerFor(g, note), 0, 100 + 100 - 10 + 4, 100 + 10 + 4);
    expect(styleOf(note).size).toBe(10);
  });

  it('recreates custom handles when the style changes (refresh) and survives Escape mid-drag', () => {
    const g = newGraph();
    const cell = insert(g, st({ rounded: 0 }));
    const handler = handlerFor(g, cell);
    expect(handler.customHandles).toHaveLength(0);
    g.setCellStyles('rounded', 1, [cell]);
    const after = (g.getPlugin('SelectionCellsHandler') as SelectionCellsHandler).getHandler(cell) as VertexHandler;
    expect(after.customHandles).toHaveLength(1);

    after.start(0, 0, InternalEvent.CUSTOM_HANDLE);
    expect(() => g.fireEvent(new EventObject(InternalEvent.ESCAPE))).not.toThrow();
    expect(after.index).toBeNull();
  });

  it('adds edge handles (flexArrow width) on edge handlers', () => {
    const g = newGraph();
    let edge: Cell | undefined;
    g.batchUpdate(() => {
      edge = g.insertEdge({
        parent: g.getDefaultParent(),
        style: st({ shape: 'flexArrow', endArrow: 'classic', startArrow: 'none' }),
      });
      edge.geometry!.setTerminalPoint(new Point(0, 0), true);
      edge.geometry!.setTerminalPoint(new Point(200, 0), false);
    });
    g.refresh();
    g.setSelectionCell(edge!);
    const handler = (g.getPlugin('SelectionCellsHandler') as SelectionCellsHandler).getHandler(edge!) as EdgeHandler;
    expect(handler.customHandles!.filter((h) => h instanceof DrawioHandle)).toHaveLength(2);
  });
});
