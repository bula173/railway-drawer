/**
 * @file canvas-interaction.ts
 * @brief Pointer hits on transparent groups, so a group moves like one shape (draw.io feel).
 *
 * A draw.io group (`style=group`, no fill and no stroke) paints nothing itself: a press in a gap
 * between its children (the ERTMS signals and balises are small groups of stencil parts) reached
 * maxGraph as a press on the empty background and started a rubber band instead of moving the
 * group. Here such a press is given the group under the pointer (`graph.getCellAt` hits the group's
 * bounds), so the SelectionHandler selects and drags the group (topmost ancestor first, like a
 * press on one of its children). Alt+drag still forces the rubber band (maxGraph's marquee event).
 */
import { InternalEvent, type Cell, type Graph, type InternalMouseEvent } from '@maxgraph/core';
import { isLayer } from './cell-lock';

/** Whether `cell` is a group-like vertex: a vertex with vertex/edge children (not a layer). */
export function isGroupVertex(graph: Graph, cell: Cell | null | undefined): cell is Cell {
  if (!cell || !cell.isVertex() || isLayer(graph, cell)) return false;
  return (cell.children ?? []).some((child) => child.isVertex() || child.isEdge());
}

const INSTALLED = new WeakSet<Graph>();

export function installGroupBackgroundHit(graph: Graph): void {
  if (INSTALLED.has(graph)) return;
  INSTALLED.add(graph);
  const origUpdate = graph.updateMouseEvent.bind(graph);
  graph.updateMouseEvent = (me: InternalMouseEvent, evtName: string): InternalMouseEvent => {
    const result = origUpdate(me, evtName);
    if (evtName !== InternalEvent.MOUSE_DOWN || result.getState()) return result;
    // Only presses on the canvas background itself (handles and overlays carry their own state)
    const source = result.getSource() as Node | null;
    const canvas = graph.view.getCanvas() as SVGElement | null;
    const background = graph.view.getBackgroundPane() as SVGElement | null;
    const onBackground = !!source && (source === graph.container || source === canvas ||
      source === canvas?.ownerSVGElement || (!!background && background.contains(source)));
    if (!onBackground) return result;
    const cell = graph.getCellAt(result.getGraphX(), result.getGraphY());
    if (isGroupVertex(graph, cell) && graph.isCellSelectable(cell)) {
      result.state = graph.view.getState(cell);
    }
    return result;
  };
}
