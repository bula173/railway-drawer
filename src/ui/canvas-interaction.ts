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
import { getRawKind } from '../railway/object-data';

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
    if (result.getState()) return result;
    // Presses select/move the group; hovering and releasing over a gap reach it too, so its
    // connection points show and an edge end dropped there connects to it (draw.io: the group's
    // bounds are its hit area)
    if (evtName !== InternalEvent.MOUSE_DOWN && evtName !== InternalEvent.MOUSE_MOVE && evtName !== InternalEvent.MOUSE_UP) return result;
    // Only presses on the canvas background itself (handles and overlays carry their own state)
    const source = result.getSource() as Node | null;
    const canvas = graph.view.getCanvas() as SVGElement | null;
    const background = graph.view.getBackgroundPane() as SVGElement | null;
    const onBackground = !!source && (source === graph.container || source === canvas ||
      source === canvas?.ownerSVGElement || (!!background && background.contains(source)));
    if (!onBackground) return result;
    const cell = graph.getCellAt(result.getGraphX(), result.getGraphY());
    if (isGroupVertex(graph, cell) && graph.isCellSelectable(cell) &&
      (evtName === InternalEvent.MOUSE_DOWN || cell.isConnectable())) {
      result.state = graph.view.getState(cell);
    }
    return result;
  };
}

const SPLIT_INSTALLED = new WeakSet<Graph>();

/**
 * Dropping a shape on an edge splits the edge (maxGraph/draw.io `isSplitTarget`). Like draw.io,
 * Alt or Shift prevent it; railway objects never split and are never split, and a railway
 * symbol group (rdKind on a group vertex) is never a drop target: a balise or signal
 * dropped on a track (an edge) is placed on it (snap to track) instead of cutting the track into
 * two edges connected to the symbol.
 */
export function installRailwaySplitRules(graph: Graph): void {
  if (SPLIT_INSTALLED.has(graph)) return;
  SPLIT_INSTALLED.add(graph);
  // A railway symbol drawn as a group (ERTMS signal, train) is one object: nothing is dropped into it
  const origDropTarget = graph.isValidDropTarget.bind(graph);
  graph.isValidDropTarget = ((cell: Cell, cells?: Cell[], evt?: MouseEvent | null): boolean =>
    !(isGroupVertex(graph, cell) && getRawKind(cell)) && origDropTarget(cell, cells as Cell[], evt as MouseEvent)) as Graph['isValidDropTarget'];
  const orig = graph.isSplitTarget.bind(graph);
  graph.isSplitTarget = (target: Cell, cells: Cell[] = [], evt?: MouseEvent | null): boolean => {
    if (evt && (evt.altKey || evt.shiftKey)) return false;
    if (getRawKind(target) || cells.some((c) => getRawKind(c))) return false;
    return orig(target, cells, evt);
  };
}
