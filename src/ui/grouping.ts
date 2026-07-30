/**
 * @file grouping.ts
 * @brief Group and ungroup selected shapes
 * @details
 * Manages grouping of multiple selected shapes into a container group.
 * Groups maintain relative positioning of children and move as a single unit.
 * Implements geometry tracking to synchronize parent and child movement.
 */

import { Graph } from '@maxgraph/core';

/**
 * @interface GroupInfo
 * @brief Metadata for tracking grouped shapes
 * @property {any} group - The group container cell
 * @property {any[]} children - Array of child cells in the group
 * @property {number} lastX - Last recorded X position of group
 * @property {number} lastY - Last recorded Y position of group
 */
interface GroupInfo {
  group: any;
  children: any[];
  lastX: number;
  lastY: number;
}

/**
 * @class GroupingController
 * @brief Manages grouping and ungrouping of shapes
 * @details
 * Allows users to select multiple shapes and group them into a single
 * container. Groups are visual containers with dashed blue borders.
 * When a group is moved, all children move with it using geometry tracking.
 *
 * Features:
 * - Group 2+ selected shapes into a container
 * - Visual feedback with dashed border
 * - Synchronized movement of parent and children
 * - Ungroup to restore individual shapes
 * - Keyboard shortcuts: Ctrl+G (group), Ctrl+Shift+G (ungroup)
 *
 * @note Groups track relative positions; ungrouping converts back to absolute
 */
export class GroupingController {
  /** @brief Reference to the maxGraph instance */
  private graph: Graph;
  /** @brief Map of active groups for movement tracking */
  private groups = new Map<string, GroupInfo>();

  /**
   * @brief Initialize grouping controller
   * @param {Graph} graph - The maxGraph instance to manage grouping for
   */
  constructor(graph: Graph) {
    this.graph = graph;
    this.setupGroupingButtons();
    this.setupKeyboardShortcuts();
    this.setupGroupMovementTracking();
  }

  /**
   * @brief Wire up group and ungroup button click handlers
   * @details Registers event listeners for the group and ungroup buttons
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
   * @brief Enable synchronized movement of grouped shapes
   * @details
   * Overrides the graph model's setGeometry method to intercept group movement.
   * When a tracked group's geometry changes, calculates the delta and applies
   * the same translation to all child cells, keeping them in sync with the group.
   *
   * This ensures that when a user drags a group, all children move together
   * while maintaining their relative positions.
   *
   * @note Uses geometry tracking map to identify which cells are groups
   * @see GroupInfo interface for the data structure
   */
  private setupGroupMovementTracking(): void {
    // Listen for geometry changes on the graph model
    const model = this.graph.model as any;
    const originalSetGeometry = model.setGeometry.bind(model);

    model.setGeometry = (cell: any, geometry: any) => {
      // Check if this cell is a group that we're tracking
      const groupId = cell.getId ? cell.getId() : (cell as any).id;
      const groupInfo = this.groups.get(groupId);

      if (groupInfo && geometry) {
        // Calculate movement delta
        const deltaX = geometry.x - groupInfo.lastX;
        const deltaY = geometry.y - groupInfo.lastY;

        // Update last position
        groupInfo.lastX = geometry.x;
        groupInfo.lastY = geometry.y;

        // Move all children by the same delta
        this.graph.batchUpdate(() => {
          groupInfo.children.forEach((child: any) => {
            if (child.geometry) {
              const childGeo = child.geometry.clone() as any;
              childGeo.translate(deltaX, deltaY);
              originalSetGeometry(child, childGeo);
            }
          });

          // Set the group geometry
          originalSetGeometry(cell, geometry);
        });
      } else {
        originalSetGeometry(cell, geometry);
      }
    };
  }

  /**
   * @brief Group selected shapes into a container
   * @details
   * Creates a group container for 2 or more selected shapes.
   * The group is a rectangle with a dashed blue border.
   * Children positions are converted to relative coordinates.
   * Registers the group for movement tracking.
   *
   * @note Requires at least 2 selected vertices (edges are ignored)
   * @see ungroup() to split a group back into individual shapes
   */
  group(): void {
    const selected = this.graph.getSelectionCells();
    console.log('[Grouping] group() called with', selected.length, 'selected cells');

    if (selected.length < 2) {
      console.log('[Grouping] Select at least 2 objects to group');
      return;
    }

    // Filter out edges - only group vertices
    const vertices = selected.filter((cell: any) => cell.isVertex?.());

    if (vertices.length < 2) {
      console.log('[Grouping] Select at least 2 shapes to group');
      return;
    }

    this.graph.batchUpdate(() => {
      // Calculate bounding box for all vertices
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      vertices.forEach((vertex: any) => {
        minX = Math.min(minX, vertex.geometry.x);
        minY = Math.min(minY, vertex.geometry.y);
        maxX = Math.max(maxX, vertex.geometry.x + vertex.geometry.width);
        maxY = Math.max(maxY, vertex.geometry.y + vertex.geometry.height);
      });

      const groupWidth = maxX - minX;
      const groupHeight = maxY - minY;

      // Create group cell
      const group = this.graph.insertVertex(
        this.graph.getDefaultParent(),
        null,
        '',
        minX,
        minY,
        groupWidth,
        groupHeight,
        {
          shape: 'rectangle',
          fillColor: 'transparent',
          strokeColor: '#0066cc',
          strokeWidth: 2,
          dashed: true,
        }
      );

      // Make group movable and resizable
      (group as any).movable = true;
      (group as any).resizable = true;

      // Move vertices into the group (adjust relative coordinates)
      vertices.forEach((vertex: any) => {
        vertex.geometry.x -= minX;
        vertex.geometry.y -= minY;
        (this.graph.model as any).setParent(vertex, group);
      });

      // Track this group for movement synchronization
      const groupId = group.getId ? group.getId() : (group as any).id;
      this.groups.set(groupId, {
        group,
        children: vertices,
        lastX: minX,
        lastY: minY,
      });

      this.graph.setSelectionCells([group]);
    });

    console.log(`[Grouping] Grouped ${vertices.length} shapes`);
  }

  /**
   * @brief Ungroup selected groups back into individual shapes
   * @details
   * Removes a group container and promotes its children back to the default parent.
   * Children coordinates are converted from relative to absolute positioning.
   * Removes group from movement tracking.
   *
   * @note Can ungroup multiple groups at once if multiple are selected
   * @see group() to create a group
   */
  ungroup(): void {
    const selected = this.graph.getSelectionCells();

    if (selected.length === 0) {
      console.log('[Grouping] Select a group to ungroup');
      return;
    }

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        const children = (this.graph.model as any).getChildren(cell);

        if (children && children.length > 0) {
          // Get group position
          const groupX = cell.geometry.x;
          const groupY = cell.geometry.y;

          // Move children out of group (convert back to absolute positions)
          children.forEach((child: any) => {
            child.geometry.x += groupX;
            child.geometry.y += groupY;
            (this.graph.model as any).setParent(child, this.graph.getDefaultParent());
          });

          // Stop tracking this group
          const groupId = cell.getId ? cell.getId() : (cell as any).id;
          this.groups.delete(groupId);

          // Remove group
          this.graph.model.remove(cell);

          console.log(`[Grouping] Ungrouped ${children.length} shapes`);
        }
      });
    });
  }

  destroy(): void {
    // Cleanup if needed
  }
}
