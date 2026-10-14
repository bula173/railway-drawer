/**
 * draw.io (jgraph/drawio v32.4.1) behaviour for the maxGraph editor: containers and
 * swimlanes (containers.ts), the layout manager's child layouts (layouts.ts), table
 * editing (tables.ts) and the context menu entries for them (menu.ts).
 *
 *   installDrawioBehaviour(graph)  -> everything below, per tab graph (idempotent)
 *   installContainers(graph)       -> drop targets, folding, extend parent, stacks on fold
 *   installDrawioLayouts(graph)    -> stack/table/circle/tree/flow/organic child layouts
 *   installTables(graph)           -> table handles, row/column resize, table-aware edits
 */

import type { Graph } from '@maxgraph/core';
import { installContainers } from './containers';
import { installDrawioLayouts } from './layouts';
import { installTables } from './tables';

export {
  createFoldingImage,
  dropCellsIntoContainerAt,
  getDropTargetAt,
  installContainers,
  isContainer,
  isDrawioCellFoldable,
  toggleFold,
} from './containers';
export {
  DrawioStackLayout,
  createDrawioStackLayout,
  createLayoutForCell,
  deleteLane,
  getLayoutForParent,
  insertLane,
  installDrawioLayouts,
  resizeParentStacks,
} from './layouts';
export {
  TableLineShape,
  deleteTableColumn,
  deleteTableRow,
  distributeColumns,
  distributeRows,
  getCompositeParent,
  insertTableColumn,
  insertTableRow,
  installTables,
  resizeAllTableColumns,
  resizeAllTableRows,
  selectTableRange,
  setTableColumnWidth,
  setTableRowHeight,
} from './tables';
export { DRAWIO_MENU_PREFIX, ensureDrawioMenuItems, executeDrawioMenuAction, updateDrawioMenuItems } from './menu';
export { getTableForCell, isLane, isStack, isStackChild, isTransparentBounds } from './common';

/** Installs draw.io's container, layout and table behaviour on the given graph. Idempotent. */
export function installDrawioBehaviour(graph: Graph): void {
  installDrawioLayouts(graph);
  installContainers(graph);
  installTables(graph);
}
