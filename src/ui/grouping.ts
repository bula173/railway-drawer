/**
 * @file grouping.ts
 * @brief Group and ungroup selected shapes
 * @details
 * Groups 2+ selected shapes into a container cell with maxGraph's own grouping
 * (`graph.groupCells` / `graph.ungroupCells`): the children become children of the group with
 * relative geometries, so they move with it, and both operations are undoable model edits.
 */

import type { Cell, CellStyle, Graph } from '@maxgraph/core';
import { shouldIgnoreGraphShortcut } from './delete';

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
 * @brief Group (Ctrl/Cmd+G, toolbar, context menu) and ungroup (Ctrl/Cmd+Shift+G) the selection.
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
    this.setupGroupingButtons();
    this.setupKeyboardShortcuts();
  }

  /**
   * @brief Wire up group and ungroup button click handlers
   */
  private setupGroupingButtons(): void {
    const groupBtn = document.getElementById('btn-group');
    const ungroupBtn = document.getElementById('btn-ungroup');

    if (groupBtn) {
      groupBtn.addEventListener('click', () => this.group());
    }
    if (ungroupBtn) {
      ungroupBtn.addEventListener('click', () => this.ungroup());
    }
  }

  /**
   * @brief Register keyboard shortcuts for grouping
   * @details
   * - Ctrl/Cmd+G: Group selected shapes
   * - Ctrl/Cmd+Shift+G: Ungroup selected groups
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (shouldIgnoreGraphShortcut(e, this.graph)) {
        return;
      }

      // Ctrl/Cmd + G for group
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        this.group();
      }

      // Ctrl/Cmd + Shift + G for ungroup
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        this.ungroup();
      }
    });
  }

  /**
   * @brief Group the selected shapes (2+ vertices; edges are ignored) into a container
   * @returns The new group cell, or null when fewer than 2 shapes are selected
   */
  group(): Cell | null {
    const vertices = this.graph.getSelectionCells().filter((cell: Cell) => cell.isVertex());
    if (vertices.length < 2) {
      console.log('[Grouping] Select at least 2 shapes to group');
      return null;
    }

    const container = this.graph.createGroupCell(vertices);
    container.setStyle({ ...GROUP_STYLE });
    // One undoable model edit (groupCells runs in its own batch update)
    const group = this.graph.groupCells(container, 0, vertices);
    this.graph.setSelectionCell(group);
    return group;
  }

  /**
   * @brief Ungroup the selected groups: their children go back to the group's parent (absolute
   *        positions) and the empty containers are removed
   * @returns The cells that were ungrouped
   */
  ungroup(): Cell[] {
    const groups = this.graph.getSelectionCells().filter((cell: Cell) => cell.getChildCount() > 0);
    if (groups.length === 0) {
      console.log('[Grouping] Select a group to ungroup');
      return [];
    }
    const children = this.graph.ungroupCells(groups);
    if (children.length > 0) this.graph.setSelectionCells(children);
    return children;
  }

  destroy(): void {
    // Cleanup if needed
  }
}
