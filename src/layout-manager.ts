/**
 * Layout Manager
 * Uses maxGraph's built-in layout algorithms
 * Leveraging library capabilities - not reimplementing
 */

import { HierarchicalLayout, CircleLayout, CompactTreeLayout, ParallelEdgeLayout, constants } from '@maxgraph/core';

export type LayoutType = 'hierarchical' | 'circle' | 'tree' | 'parallel';

export class LayoutManager {
  constructor(private graph: any) {}

  /**
   * Apply hierarchical (top-down) layout
   * Uses maxGraph's HierarchicalLayout
   */
  applyHierarchicalLayout(parent?: any, orientation: 'vertical' | 'horizontal' = 'vertical'): void {
    try {
      const layoutParent = parent || this.graph.getDefaultParent();

      const direction = orientation === 'vertical' ? constants.DIRECTION.NORTH : constants.DIRECTION.WEST;
      const layout = new HierarchicalLayout(this.graph, direction);
      layout.execute(layoutParent);

      this.graph.view.refresh();
    } catch (err) {
      throw new Error(`Hierarchical layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply circular layout
   * Uses maxGraph's CircleLayout
   */
  applyCircleLayout(parent?: any): void {
    try {
      const layoutParent = parent || this.graph.getDefaultParent();

      const layout = new CircleLayout(this.graph);
      layout.execute(layoutParent);

      this.graph.view.refresh();
    } catch (err) {
      throw new Error(`Circle layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply tree layout
   * Uses maxGraph's CompactTreeLayout
   */
  applyTreeLayout(parent?: any, horizontal: boolean = false): void {
    try {
      const layoutParent = parent || this.graph.getDefaultParent();

      const layout = new CompactTreeLayout(this.graph, horizontal);
      layout.execute(layoutParent);

      this.graph.view.refresh();
    } catch (err) {
      throw new Error(`Tree layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply parallel edge layout
   * Uses maxGraph's ParallelEdgeLayout
   */
  applyParallelEdgeLayout(parent?: any): void {
    try {
      const layoutParent = parent || this.graph.getDefaultParent();

      const layout = new ParallelEdgeLayout(this.graph);
      layout.execute(layoutParent);

      this.graph.view.refresh();
    } catch (err) {
      throw new Error(`Parallel edge layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply layout with options
   */
  applyLayout(
    type: LayoutType,
    options?: {
      parent?: any;
      orientation?: 'vertical' | 'horizontal';
      spacing?: number;
    },
  ): void {
    switch (type) {
      case 'hierarchical':
        this.applyHierarchicalLayout(options?.parent, options?.orientation);
        break;
      case 'circle':
        this.applyCircleLayout(options?.parent);
        break;
      case 'tree':
        this.applyTreeLayout(options?.parent, options?.orientation === 'horizontal');
        break;
      case 'parallel':
        this.applyParallelEdgeLayout(options?.parent);
        break;
      default:
        throw new Error(`Unknown layout type: ${type}`);
    }
  }

  /**
   * Distribute selected cells evenly
   * Simple spacing distribution
   */
  distributeUniformly(cells: any[], direction: 'horizontal' | 'vertical' = 'horizontal'): void {
    if (cells.length < 2) return;

    const isHorizontal = direction === 'horizontal';
    const sorted = [...cells].sort((a, b) => (isHorizontal ? a.geometry.x - b.geometry.x : a.geometry.y - b.geometry.y));

    // Calculate total space
    let minPos = isHorizontal ? Infinity : Infinity;
    let maxPos = isHorizontal ? -Infinity : -Infinity;
    let totalSize = 0;

    sorted.forEach((cell) => {
      const geo = cell.geometry;
      if (isHorizontal) {
        minPos = Math.min(minPos, geo.x);
        maxPos = Math.max(maxPos, geo.x + geo.width);
        totalSize += geo.width;
      } else {
        minPos = Math.min(minPos, geo.y);
        maxPos = Math.max(maxPos, geo.y + geo.height);
        totalSize += geo.height;
      }
    });

    const availableSpace = maxPos - minPos - totalSize;
    const gap = availableSpace / (sorted.length - 1);

    this.graph.batchUpdate(() => {
      let currentPos = minPos;
      sorted.forEach((cell) => {
        const geo = cell.geometry;
        if (isHorizontal) {
          const newGeo = {
            x: currentPos,
            y: geo.y,
            width: geo.width,
            height: geo.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
          currentPos += geo.width + gap;
        } else {
          const newGeo = {
            x: geo.x,
            y: currentPos,
            width: geo.width,
            height: geo.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
          currentPos += geo.height + gap;
        }
      });
    });
  }
}
