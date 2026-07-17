/**
 * @file maxGraphShapeManager.ts
 * @brief Shape management for maxGraph integration
 *
 * Handles loading, caching, and applying toolbox items as maxGraph shapes
 */

import { Graph, Cell } from '@maxgraph/core';
import type { ToolboxItem, ShapeElement } from '../components/Toolbox';
import { logger } from './logger';

interface ShapeCache {
  [key: string]: {
    item: ToolboxItem;
    dataUrl?: string;
    lastUsed: number;
  };
}

class MaxGraphShapeManager {
  private graph: Graph | null = null;
  private shapeCache: ShapeCache = {};
  private maxCacheSize = 100;

  setGraph(graph: Graph): void {
    this.graph = graph;
  }

  /**
   * Register a toolbox item as an available shape
   */
  registerShape(item: ToolboxItem): void {
    this.shapeCache[item.id] = {
      item,
      lastUsed: Date.now(),
    };

    // Preprocess SVG if available
    if (item.shapeElements?.[0]?.svg) {
      this.preprocessShape(item.id);
    }

    // Clean cache if needed
    if (Object.keys(this.shapeCache).length > this.maxCacheSize) {
      this.evictLRU();
    }

    logger.debug('MaxGraphShapeManager', 'Shape registered', { shapeId: item.id });
  }

  /**
   * Register multiple shapes
   */
  registerShapes(items: ToolboxItem[]): void {
    items.forEach(item => this.registerShape(item));
  }

  /**
   * Create a cell from a toolbox item
   */
  createCellFromShape(item: ToolboxItem, x: number, y: number, parent?: Cell): Cell {
    if (!this.graph) throw new Error('Graph not initialized');

    const p = parent || this.graph.getDefaultParent();
    const cell = this.graph.insertVertex(
      p,
      null,
      item.name,
      x,
      y,
      item.width,
      item.height,
      this.getShapeStyle(item)
    );

    // Apply SVG if available
    if (item.shapeElements?.[0]?.svg) {
      this.applySvgToCell(cell, item);
    }

    // Store metadata
    cell.setConnectable(true);
    (cell as any).__shapeId = item.id;
    (cell as any).__shapeType = item.type;

    this.shapeCache[item.id].lastUsed = Date.now();

    logger.debug('MaxGraphShapeManager', 'Cell created from shape', {
      shapeId: item.id,
      cellId: cell.getId(),
    });

    return cell;
  }

  /**
   * Apply SVG shape to an existing cell
   */
  applySvgToCell(cell: Cell, item: ToolboxItem): void {
    if (!item.shapeElements?.[0]?.svg) return;

    const svg = item.shapeElements[0].svg;
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      // Apply as image shape
      cell.setStyle(`shape=image;image=${url};aspect=fixed;`);

      // Cache the URL
      this.shapeCache[item.id].dataUrl = url;
    } catch (error) {
      logger.error('MaxGraphShapeManager', 'Failed to apply SVG', { error, shapeId: item.id });
    }
  }

  /**
   * Get style string for shape
   */
  private getShapeStyle(item: ToolboxItem): string {
    const parts: string[] = [
      'rounded=1',
      'strokeColor=#999',
      'fillColor=#f0f0f0',
      'strokeWidth=1',
    ];

    if (item.type === 'ertms' || item.type === 'rail') {
      parts.push('dashed=1');
    }

    return parts.join(';');
  }

  /**
   * Preprocess shape (cache SVG, validate, etc.)
   */
  private preprocessShape(shapeId: string): void {
    const cached = this.shapeCache[shapeId];
    if (!cached?.item.shapeElements?.[0]?.svg) return;

    try {
      const svg = cached.item.shapeElements[0].svg;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      cached.dataUrl = URL.createObjectURL(blob);
    } catch (error) {
      logger.error('MaxGraphShapeManager', 'Failed to preprocess shape', {
        error,
        shapeId,
      });
    }
  }

  /**
   * Evict least recently used shape from cache
   */
  private evictLRU(): void {
    let lruKey = '';
    let lruTime = Date.now();

    Object.entries(this.shapeCache).forEach(([key, cache]) => {
      if (cache.lastUsed < lruTime) {
        lruTime = cache.lastUsed;
        lruKey = key;
      }
    });

    if (lruKey) {
      const cached = this.shapeCache[lruKey];
      if (cached.dataUrl) {
        URL.revokeObjectURL(cached.dataUrl);
      }
      delete this.shapeCache[lruKey];
      logger.debug('MaxGraphShapeManager', 'Evicted shape from cache', { shapeId: lruKey });
    }
  }

  /**
   * Get cached shape
   */
  getShape(shapeId: string): ToolboxItem | null {
    const cached = this.shapeCache[shapeId];
    if (!cached) return null;

    cached.lastUsed = Date.now();
    return cached.item;
  }

  /**
   * List all cached shapes
   */
  listShapes(): ToolboxItem[] {
    return Object.values(this.shapeCache).map(c => c.item);
  }

  /**
   * Clear all cached shapes
   */
  clearCache(): void {
    Object.values(this.shapeCache).forEach(cache => {
      if (cache.dataUrl) {
        URL.revokeObjectURL(cache.dataUrl);
      }
    });
    this.shapeCache = {};
    logger.debug('MaxGraphShapeManager', 'Shape cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedShapes: Object.keys(this.shapeCache).length,
      maxSize: this.maxCacheSize,
      usage: `${Object.keys(this.shapeCache).length}/${this.maxCacheSize}`,
    };
  }
}

export const shapeManager = new MaxGraphShapeManager();
