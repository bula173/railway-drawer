/**
 * @file grouping.ts
 * @brief Group and ungroup selected shapes
 * @details
 * Groups 2+ selected shapes into a container cell with maxGraph's own grouping
 * (`graph.groupCells` / `graph.ungroupCells`): the children become children of the group with
 * relative geometries, so they move with it, and both operations are undoable model edits.
 */

import type { Cell, CellStyle, Graph } from '@maxgraph/core';
import { logger } from '../drawio/logger';

/** Style of a group container: transparent, dashed blue border. */
const GROUP_STYLE: CellStyle = {
  shape: 'rectangle',
  fillColor: 'transparent',
  strokeColor: '#0066cc',
  strokeWidth: 2,
  dashed: true,
};

/**
 * @class GroupingController
 * @brief Group (Ctrl/Cmd+G, Properties > Arrange, context menu) and ungroup (Ctrl/Cmd+Shift+G) the
 *        selection; the buttons and keys run the group / ungroup commands (ui/commands/arrange.ts).
 */
export class GroupingController {
  /** @brief Reference to the maxGraph instance */
  private graph: Graph;

  /**
   * @brief Initialize grouping controller
   * @param {Graph} graph - The maxGraph instance to manage grouping for
   */
  constructor(graph: Graph) {
    this.graph = graph;
  }

  /**
   * @brief Group the selected shapes (2+ vertices; edges are ignored) into a container
   * @returns The new group cell, or null when fewer than 2 shapes are selected
   */
  group(): Cell | null {
    return groupSelection(this.graph);
  }

  /**
   * @brief Ungroup the selected groups: their children go back to the group's parent (absolute
   *        positions) and the empty containers are removed
   * @returns The cells that were ungrouped
   */
  ungroup(): Cell[] {
    return ungroupSelection(this.graph);
  }

  destroy(): void {
    // Cleanup if needed
  }
}

/** Groups the selected shapes (2+ vertices; edges are ignored) into a container; Arrange > Group too. */
export function groupSelection(graph: Graph): Cell | null {
  const vertices = graph.getSelectionCells().filter((cell: Cell) => cell.isVertex());
  if (vertices.length < 2) {
    logger.debug('Grouping', 'Select at least 2 shapes to group');
    return null;
  }

  const container = graph.createGroupCell(vertices);
  container.setStyle({ ...GROUP_STYLE });
  // One undoable model edit (groupCells runs in its own batch update)
  const group = graph.groupCells(container, 0, vertices);
  graph.setSelectionCell(group);
  return group;
}

/** Ungroups the selected groups (children back to the group's parent); Arrange > Ungroup too. */
export function ungroupSelection(graph: Graph): Cell[] {
  const groups = graph.getSelectionCells().filter((cell: Cell) => cell.getChildCount() > 0);
  if (groups.length === 0) {
    logger.debug('Grouping', 'Select a group to ungroup');
    return [];
  }
  const children = graph.ungroupCells(groups);
  if (children.length > 0) graph.setSelectionCells(children);
  return children;
}
