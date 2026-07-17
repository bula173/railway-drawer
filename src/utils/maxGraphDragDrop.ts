/**
 * @file maxGraphDragDrop.ts
 * @brief Drag-drop support for maxGraph toolbox integration
 */

import { Graph, Point } from '@maxgraph/core';
import type { ToolboxItem } from '../components/Toolbox';
import { logger } from './logger';

const TOOLBOX_MIME_TYPE = 'application/railway-item';

/**
 * Set up drag-drop handlers for a maxGraph container
 */
export function setupMaxGraphDragDrop(
  graph: Graph,
  containerElement: HTMLElement,
  onDropShape: (item: ToolboxItem, x: number, y: number) => void
): void {
  containerElement.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types?.includes(TOOLBOX_MIME_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  containerElement.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.types?.includes(TOOLBOX_MIME_TYPE)) return;

    e.preventDefault();

    try {
      const itemJson = e.dataTransfer.getData(TOOLBOX_MIME_TYPE);
      const item: ToolboxItem = JSON.parse(itemJson);

      // Get drop position relative to canvas
      const rect = containerElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert screen coordinates to graph coordinates
      const scale = graph.getView().getScale();
      const translate = graph.getView().getTranslate();

      const graphX = (x / scale) - translate.x;
      const graphY = (y / scale) - translate.y;

      onDropShape(item, graphX, graphY);

      logger.debug('maxGraphDragDrop', 'Shape dropped', {
        shapeId: item.id,
        graphX,
        graphY,
      });
    } catch (error) {
      logger.error('maxGraphDragDrop', 'Failed to handle drop', { error });
    }
  });
}

/**
 * Create draggable element for toolbox
 */
export function makeDraggable(
  element: HTMLElement,
  item: ToolboxItem,
  preview?: HTMLElement
): void {
  element.draggable = true;

  element.addEventListener('dragstart', (e) => {
    if (!e.dataTransfer) return;

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(TOOLBOX_MIME_TYPE, JSON.stringify(item));

    if (preview) {
      e.dataTransfer.setDragImage(preview, 0, 0);
    }
  });
}

/**
 * Handle drag over a maxGraph canvas
 */
export function handleDragOver(e: DragEvent, graph: Graph): boolean {
  if (!e.dataTransfer?.types?.includes(TOOLBOX_MIME_TYPE)) {
    return false;
  }

  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';

  // Optional: Add visual feedback (highlight drop zone)
  return true;
}

/**
 * Handle drop on a maxGraph canvas
 */
export function handleDrop(
  e: DragEvent,
  graph: Graph,
  containerElement: HTMLElement
): ToolboxItem | null {
  if (!e.dataTransfer?.types?.includes(TOOLBOX_MIME_TYPE)) {
    return null;
  }

  e.preventDefault();

  try {
    const itemJson = e.dataTransfer.getData(TOOLBOX_MIME_TYPE);
    return JSON.parse(itemJson);
  } catch (error) {
    logger.error('maxGraphDragDrop', 'Failed to parse dropped item', { error });
    return null;
  }
}

/**
 * Calculate drop position in graph coordinates
 */
export function getDropPosition(
  e: MouseEvent | DragEvent,
  graph: Graph,
  containerElement: HTMLElement
): { x: number; y: number } {
  const rect = containerElement.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const scale = graph.getView().getScale();
  const translate = graph.getView().getTranslate();

  return {
    x: (screenX / scale) - translate.x,
    y: (screenY / scale) - translate.y,
  };
}
