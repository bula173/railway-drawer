/**
 * @file template-extract.ts
 * @brief "Save as template…": the selected cells (or the whole diagram) as a draw.io model XML.
 *
 * Content: the selected cells without the ones whose ancestor is selected too (their descendants
 * come with them), plus every unselected edge whose two terminals are inside that set (cells or
 * descendants). Other edges to cells outside are left out; a selected edge with one end outside
 * keeps that end as a dangling terminal point. Nested cells are moved to absolute coordinates
 * and the content is moved so its top-left corner is at (0, 0). Without a selection, the cells of
 * every layer are taken (flattened into one layer). Styles are written verbatim (draw.io styles
 * keep their original string, see copyRawDrawioStyle).
 */
import { GraphDataModel } from '@maxgraph/core';
import type { Cell, Graph } from '@maxgraph/core';
import { exportModelToDrawioXml } from '../../services/drawio-xml';
import { cloneWithTerminals } from '../drawio-palette/entry-cells';

export interface ExtractedTemplate {
  /** draw.io `<mxGraphModel>` XML. */
  xml: string;
  width: number;
  height: number;
  /** Number of top-level cells in the template. */
  cellCount: number;
}

/** Cells of the model in depth-first order (root excluded). */
function modelOrder(graph: Graph): Map<Cell, number> {
  const order = new Map<Cell, number>();
  const visit = (cell: Cell): void => {
    order.set(cell, order.size);
    for (const child of cell.children ?? []) visit(child);
  };
  const root = graph.getDataModel().getRoot();
  for (const layer of root?.children ?? []) visit(layer);
  return order;
}

function isLayer(graph: Graph, cell: Cell): boolean {
  const root = graph.getDataModel().getRoot();
  return !!root && (cell === root || cell.getParent() === root);
}

/**
 * The top-level cells a template of `selection` consists of (in model order): see the file comment.
 * An empty selection means the whole diagram.
 */
export function collectTemplateCells(graph: Graph, selection: Cell[] = graph.getSelectionCells()): Cell[] {
  const order = modelOrder(graph);
  const byOrder = (a: Cell, b: Cell): number => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const root = graph.getDataModel().getRoot();

  let top: Cell[];
  if (selection.length === 0) {
    top = (root?.children ?? []).flatMap((layer) => [...(layer.children ?? [])]);
  } else {
    const selected = new Set(selection.filter((c) => order.has(c) && !isLayer(graph, c)));
    top = [...selected].filter((cell) => {
      for (let p = cell.getParent(); p; p = p.getParent()) if (selected.has(p)) return false;
      return true;
    });
  }

  // Everything that is copied: the top cells and their descendants
  const inside = new Set<Cell>();
  const addTree = (cell: Cell): void => {
    inside.add(cell);
    for (const child of cell.children ?? []) addTree(child);
  };
  top.forEach(addTree);

  // Unselected edges between copied cells (e.g. connections in the layer between two groups)
  const extra: Cell[] = [];
  for (const cell of order.keys()) {
    if (!cell.isEdge() || inside.has(cell)) continue;
    const source = cell.getTerminal(true);
    const target = cell.getTerminal(false);
    if (source && target && inside.has(source) && inside.has(target)) extra.push(cell);
  }
  return [...top, ...extra].sort(byOrder);
}

/**
 * The template XML of `selection` (default: the graph's selection; empty: the whole diagram).
 * Returns null when there is nothing to save.
 */
export function extractTemplate(graph: Graph, selection: Cell[] = graph.getSelectionCells()): ExtractedTemplate | null {
  const cells = collectTemplateCells(graph, selection);
  if (cells.length === 0) return null;

  // Absolute geometry (cloneCells adds the parent origins), dangling ends as terminal points,
  // connections between the copies restored, draw.io style strings kept
  const clones = cloneWithTerminals(graph, cells);
  // The app layer ids (rdLayerId) belong to the source diagram
  const stripLayer = (cell: Cell): void => {
    delete (cell as unknown as { __layerId?: unknown }).__layerId;
    for (const child of cell.children ?? []) stripLayer(child);
  };
  clones.forEach(stripLayer);
  const bounds = graph.getBoundingBoxFromGeometry(clones, true);
  const dx = -(bounds?.x ?? 0);
  const dy = -(bounds?.y ?? 0);
  for (const clone of clones) clone.getGeometry()?.translate(dx, dy);

  const model = new GraphDataModel();
  const layer = model.getRoot()!.getChildAt(0);
  model.beginUpdate();
  try {
    for (const clone of clones) model.add(layer, clone);
  } finally {
    model.endUpdate();
  }

  const xml = exportModelToDrawioXml(model, {
    stylesheet: graph.getStylesheet(),
    htmlLabels: graph.isHtmlLabels(),
  });
  return {
    xml,
    width: Math.max(1, Math.round(bounds?.width ?? 80)),
    height: Math.max(1, Math.round(bounds?.height ?? 80)),
    cellCount: clones.length,
  };
}
