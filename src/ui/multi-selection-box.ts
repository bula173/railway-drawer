/**
 * @file multi-selection-box.ts
 * @brief One selection border for a large selection, like draw.io: inserting a template into a tab selected its
 *        ~35 cells and every one got its own dashed border and handles (unreadable). Above `MULTI_SELECTION_BOX_MIN`
 *        selected cells no per-cell handlers are created (SelectionCellsHandler.getHandledSelectionCells) and one
 *        dashed rectangle in the selection colour (`--rd-selection`, handle-colors.ts) frames the selection's
 *        bounding box. A press on any selected cell still moves them all (selected cells count as handled, so
 *        SelectionHandler delays the selection like with handlers); smaller selections keep their handles. View only (overlay pane), nothing saved or undoable.
 */
import { Rectangle } from '@maxgraph/core';
import type { Cell, Graph } from '@maxgraph/core';
import { onModelChange, onSelectionChange, onViewTransform } from '../core/graph-events';
import { GraphOverlay, svgEl } from '../railway/graph-overlay';
import { selectionColor } from '../drawio-shapes/engine/handle-colors';

/** Selections with more cells than this get one bounding box instead of per-cell handles. */
export const MULTI_SELECTION_BOX_MIN = 10;
const PADDING = 4;

type HandledCells = {
  getHandledSelectionCells(): ReturnType<Graph['getSelectionCells']>;
  isHandled(cell: Cell): boolean;
  refresh(): void;
};

/** True when `graph`'s selection is shown as one box. */
export function isMultiSelectionBox(graph: Graph): boolean {
  return graph.getSelectionCount() > MULTI_SELECTION_BOX_MIN;
}

/** The selection's bounds in graph coordinates (null: nothing drawn). */
export function selectionBounds(graph: Graph): Rectangle | null {
  const cells = graph.getSelectionCells();
  const box = cells.length > 0 ? graph.getBoundingBox(cells) : null;
  if (!box) return null;
  const { scale: s, translate: t } = graph.view;
  return new Rectangle(box.x / s - t.x, box.y / s - t.y, box.width / s, box.height / s);
}

export function installMultiSelectionBox(graph: Graph): () => void {
  const handler = graph.getPlugin('SelectionCellsHandler') as unknown as HandledCells | undefined;
  if (!handler) return () => undefined;
  const base = handler.getHandledSelectionCells.bind(handler);
  handler.getHandledSelectionCells = () => (isMultiSelectionBox(graph) ? [] : base());
  // SelectionHandler delays the selection of a press on a "handled" cell (so a drag moves the whole selection);
  // without handlers it would select just the pressed cell: in box mode every selected cell counts as handled
  const baseHandled = handler.isHandled.bind(handler);
  handler.isHandled = (cell: Cell) => (isMultiSelectionBox(graph) ? graph.isCellSelected(cell) : baseHandled(cell));

  let overlay: GraphOverlay | null = null;
  const redraw = (): void => {
    const bounds = isMultiSelectionBox(graph) ? selectionBounds(graph) : null;
    if (!bounds) {
      overlay?.clear();
      return;
    }
    overlay ??= new GraphOverlay(graph, 'rd-multi-selection');
    const s = graph.view.scale;
    const pad = PADDING / s;
    overlay.set([
      svgEl('rect', {
        x: bounds.x - pad,
        y: bounds.y - pad,
        width: bounds.width + 2 * pad,
        height: bounds.height + 2 * pad,
        fill: 'none',
        stroke: selectionColor(graph),
        'stroke-width': 1,
        'stroke-dasharray': '3 3',
        'vector-effect': 'non-scaling-stroke',
        'data-count': graph.getSelectionCount(),
        class: 'rd-multi-selection-box',
      }),
    ]);
  };
  const disposers = [onSelectionChange(graph, redraw), onModelChange(graph, redraw), onViewTransform(graph, redraw)];
  return () => {
    for (const dispose of disposers) dispose();
    handler.getHandledSelectionCells = base;
    handler.isHandled = baseHandled;
    overlay?.destroy();
    overlay = null;
  };
}
