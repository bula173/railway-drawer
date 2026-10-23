/**
 * @file view-fixes.ts
 * @brief Edge styles for edges without a source terminal, as mxGraph/draw.io route them.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Behaviour of jgraph/drawio v32.4.1
 * src/main/webapp/mxgraph/src/view/mxGraphView.js (updatePoints): the edge style runs whenever
 * one is set; a missing terminal is replaced by the edge's terminal point.
 *
 * maxGraph 0.10.3 GraphView.updatePoints only runs the edge style when the edge has a source
 * terminal, so dangling edges (every edge in the draw.io palettes and libraries: elbows, manual
 * lines, isometric edges, the ERTMS movement authority curve) are drawn as straight lines.
 */
import { installOnce } from '../../core/install-once';
import type { CellState, Graph, Point } from '@maxgraph/core';

type EdgeStyleFn = (state: CellState, source: CellState | null, target: CellState | null, points: Point[], result: (Point | null)[]) => void;

interface ViewInternals {
  updatePoints(edge: CellState, points: Point[], source: CellState | null, target: CellState | null): void;
  getEdgeStyle(edge: CellState, points: Point[], source: CellState | null, target: CellState | null): EdgeStyleFn | null;
  getTerminalPort(state: CellState, terminal: CellState, source: boolean): CellState;
}

/** Runs edge styles for edges without a source terminal on this graph's view. Idempotent. */
export function installDanglingEdgeStyles(graph: Graph): void {
  const view = graph.view as unknown as ViewInternals;
  if (!installOnce(view, 'drawio.dangling-edge-styles')) return;
  const base = view.updatePoints.bind(view);
  view.updatePoints = (edge, points, source, target) => {
    const edgeStyle = source ? null : view.getEdgeStyle(edge, points, source, target);
    if (!edgeStyle) {
      base(edge, points, source, target);
      return;
    }
    const first = edge.absolutePoints[0];
    const last = edge.absolutePoints[edge.absolutePoints.length - 1];
    const pts: (Point | null)[] = [first];
    try {
      const trg = target ? view.getTerminalPort(edge, target, false) : null;
      edgeStyle(edge, null, trg, points, pts);
    } catch {
      // the style needs a source terminal: draw the edge as maxGraph does
      base(edge, points, source, target);
      return;
    }
    pts.push(last);
    edge.absolutePoints = pts as Point[];
  };
}

/**
 * draw.io's `inherit` style values (e.g. `strokeColor=inherit` in table rows and cells): the
 * value comes from the parent cell's resolved style. maxGraph has no such value and draws the
 * literal (an invalid colour, i.e. black). Idempotent per graph.
 */
export function installInheritStyleValues(graph: Graph): void {
  if (!installOnce(graph, 'drawio.inherit-style-values')) return;
  const base = graph.getCellStyle.bind(graph);
  const resolve = (cell: Parameters<Graph['getCellStyle']>[0], depth: number): ReturnType<Graph['getCellStyle']> => {
    const style = base(cell);
    const map = style as unknown as Record<string, unknown>;
    for (const key of Object.keys(map)) {
      if (map[key] !== 'inherit') continue;
      const parent = cell.getParent();
      let inherited: unknown;
      if (parent && depth < 50 && (parent.isVertex() || parent.isEdge())) {
        inherited = (resolve(parent, depth + 1) as unknown as Record<string, unknown>)[key];
        // the stylesheet drops 'none' values; draw.io reads them from the unresolved style
        // (mxStencil.getStyleWithNone)
        if (inherited === undefined) {
          const own = parent.getStyle() as unknown;
          if (own && typeof own === 'object' && (own as Record<string, unknown>)[key] === 'none') inherited = 'none';
        }
      }
      if (inherited === undefined || inherited === 'inherit') delete map[key];
      else map[key] = inherited;
    }
    return style;
  };
  graph.getCellStyle = (cell) => resolve(cell, 0);
}
