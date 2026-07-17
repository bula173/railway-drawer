/**
 * @file MaxGraphAdapter.tsx
 * @brief Adapter to bridge maxGraph with existing Railway Drawer architecture
 *
 * Converts between maxGraph Cell objects and DrawElement format for compatibility
 */

import { Cell, Graph } from '@maxgraph/core';
import type { DrawElement, ElementStyles } from './Elements';
import type { ToolboxItem } from './Toolbox';

/**
 * Convert maxGraph Cell to DrawElement
 */
export function cellToDrawElement(cell: Cell, graph: Graph): DrawElement {
  const geo = cell.getGeometry();
  const style = cell.getStyle() || '';
  const styleObj = parseStyle(style);

  return {
    id: cell.getId() || `cell_${Date.now()}`,
    type: cell.isEdge() ? 'connector' : 'shape',
    x: geo?.x || 0,
    y: geo?.y || 0,
    width: geo?.width || 80,
    height: geo?.height || 60,
    rotation: parseInt(styleObj.rotation || '0') || 0,
    shape: cell.getValue?.() || 'rectangle',
    styles: parseElementStyles(styleObj),
    shapeElements: [{
      id: `element_${cell.getId()}`,
      svg: '', // Will be populated from SVG shape
    }],
  };
}

/**
 * Convert DrawElement to maxGraph Cell style
 */
export function drawElementToCellStyle(element: DrawElement): string {
  const style: Record<string, string> = {
    rounded: '1',
  };

  if (element.styles) {
    if (element.styles.fill) style.fillColor = element.styles.fill;
    if (element.styles.stroke) style.strokeColor = element.styles.stroke;
    if (element.styles.strokeWidth) style.strokeWidth = element.styles.strokeWidth.toString();
  }

  if (element.rotation) {
    style.rotation = element.rotation.toString();
  }

  return Object.entries(style)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
}

/**
 * Parse style string to object
 */
export function parseStyle(styleStr: string): Record<string, string> {
  const obj: Record<string, string> = {};
  if (!styleStr) return obj;

  styleStr.split(';').forEach(item => {
    if (!item.includes('=')) return;
    const [key, value] = item.split('=');
    if (key && value) {
      obj[key.trim()] = value.trim();
    }
  });

  return obj;
}

/**
 * Parse maxGraph style object to ElementStyles
 */
export function parseElementStyles(styleObj: Record<string, string>): ElementStyles {
  return {
    fill: styleObj.fillColor || '#ffffff',
    stroke: styleObj.strokeColor || '#000000',
    strokeWidth: parseInt(styleObj.strokeWidth || '1'),
    opacity: parseInt(styleObj.opacity || '100') / 100,
    fontSize: parseInt(styleObj.fontSize || '12'),
    fontFamily: styleObj.fontFamily || 'Arial',
  };
}

/**
 * Apply ToolboxItem styling to maxGraph Cell
 */
export function applyToolboxItemStyle(cell: Cell, item: ToolboxItem): void {
  const style = drawElementToCellStyle({
    id: cell.getId() || '',
    type: 'shape',
    x: 0,
    y: 0,
    width: item.width,
    height: item.height,
    rotation: 0,
    shape: item.name,
    styles: {
      fill: '#f0f0f0',
      stroke: '#999999',
      strokeWidth: 1,
    },
  });

  cell.setStyle(style);
}

/**
 * Get all cells as DrawElements
 */
export function getAllCellsAsDrawElements(graph: Graph): DrawElement[] {
  const elements: DrawElement[] = [];
  const root = graph.getModel().getRoot();

  if (!root) return elements;

  const traverse = (cell: Cell) => {
    if (cell.isVertex() || cell.isEdge()) {
      elements.push(cellToDrawElement(cell, graph));
    }

    for (let i = 0; i < cell.getChildCount(); i++) {
      traverse(cell.getChildAt(i));
    }
  };

  traverse(root);
  return elements;
}

/**
 * Create Cell from ToolboxItem
 */
export function createCellFromToolboxItem(
  graph: Graph,
  item: ToolboxItem,
  x: number,
  y: number
): Cell {
  const parent = graph.getDefaultParent();
  const style = drawElementToCellStyle({
    id: '',
    type: 'shape',
    x,
    y,
    width: item.width,
    height: item.height,
    rotation: 0,
    shape: item.name,
    styles: {
      fill: '#f0f0f0',
      stroke: '#999999',
      strokeWidth: 1,
    },
  });

  const vertex = graph.insertVertex(
    parent,
    null,
    item.name,
    x,
    y,
    item.width,
    item.height,
    style
  );

  // Apply SVG shape if available
  if (item.shapeElements?.[0]?.svg) {
    const svg = item.shapeElements[0].svg;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    vertex.setStyle(`shape=image;image=${url};aspect=fixed`);
  }

  return vertex;
}

/**
 * Convert selected cells to DrawElements
 */
export function getSelectedAsDrawElements(graph: Graph): DrawElement[] {
  const cells = graph.getSelectionModel().getCells();
  return cells.map(cell => cellToDrawElement(cell, graph));
}
