/**
 * @file maxGraphUtils.ts
 * @brief Utility functions for maxGraph integration
 */

import { Graph, Cell, CellStyle } from '@maxgraph/core';
import type { ToolboxItem } from '../components/Toolbox';

/**
 * Create a vertex (shape) with SVG styling
 */
export function createVertex(
  graph: Graph,
  parent: Cell,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style?: string
): Cell {
  const defaultStyle = style || 'rounded=1;strokeColor=#666;fillColor=#f0f0f0';
  return graph.insertVertex(parent, null, value, x, y, width, height, defaultStyle);
}

/**
 * Create an edge (connector) between two vertices
 */
export function createEdge(
  graph: Graph,
  parent: Cell,
  source: Cell,
  target: Cell,
  style?: string
): Cell {
  const defaultStyle = style || 'rounded=1;strokeColor=#666;endArrow=classic';
  return graph.insertEdge(parent, null, '', source, target, defaultStyle);
}

/**
 * Apply shape from ToolboxItem to vertex
 */
export function applySvgShape(vertex: Cell, item: ToolboxItem): void {
  if (!item.shapeElements?.[0]?.svg) return;

  const svg = item.shapeElements[0].svg;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  vertex.setStyle(`shape=image;image=${url};aspect=fixed`);
}

/**
 * Get cell style as object
 */
export function getCellStyleAsObject(cell: Cell): Record<string, string> {
  const style = cell.getStyle() || '';
  const obj: Record<string, string> = {};

  style.split(';').forEach(item => {
    const [key, value] = item.split('=');
    if (key && value) {
      obj[key] = value;
    }
  });

  return obj;
}

/**
 * Update cell style from object
 */
export function updateCellStyle(cell: Cell, updates: Record<string, string>): void {
  const current = getCellStyleAsObject(cell);
  const merged = { ...current, ...updates };
  const style = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
  cell.setStyle(style);
}

/**
 * Duplicate cell(s)
 */
export function duplicateCells(graph: Graph, cells: Cell[]): Cell[] {
  const cloned: Cell[] = [];
  cells.forEach(cell => {
    const clone = graph.cloneCells([cell])[0];
    const geo = clone.getGeometry();
    if (geo) {
      geo.translate(20, 20);
      clone.setGeometry(geo);
    }
    cloned.push(clone);
  });
  return cloned;
}

/**
 * Align cells
 */
export function alignCells(graph: Graph, cells: Cell[], align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
  if (cells.length < 2) return;

  const geometries = cells.map(c => c.getGeometry()).filter((g): g is any => g !== null);
  if (geometries.length === 0) return;

  let alignValue = 0;

  switch (align) {
    case 'left':
      alignValue = Math.min(...geometries.map(g => g.x));
      geometries.forEach((g, i) => {
        g.x = alignValue;
        cells[i].setGeometry(g);
      });
      break;
    case 'center':
      alignValue = geometries.reduce((sum, g) => sum + g.x, 0) / geometries.length;
      geometries.forEach((g, i) => {
        g.x = alignValue;
        cells[i].setGeometry(g);
      });
      break;
    case 'right':
      alignValue = Math.max(...geometries.map(g => g.x + g.width));
      geometries.forEach((g, i) => {
        g.x = alignValue - g.width;
        cells[i].setGeometry(g);
      });
      break;
    case 'top':
      alignValue = Math.min(...geometries.map(g => g.y));
      geometries.forEach((g, i) => {
        g.y = alignValue;
        cells[i].setGeometry(g);
      });
      break;
    case 'middle':
      alignValue = geometries.reduce((sum, g) => sum + g.y, 0) / geometries.length;
      geometries.forEach((g, i) => {
        g.y = alignValue;
        cells[i].setGeometry(g);
      });
      break;
    case 'bottom':
      alignValue = Math.max(...geometries.map(g => g.y + g.height));
      geometries.forEach((g, i) => {
        g.y = alignValue - g.height;
        cells[i].setGeometry(g);
      });
      break;
  }
}

/**
 * Distribute cells evenly
 */
export function distributeCells(graph: Graph, cells: Cell[], direction: 'h' | 'v'): void {
  if (cells.length < 3) return;

  const geometries = cells.map(c => c.getGeometry()).filter((g): g is any => g !== null);
  if (geometries.length < 3) return;

  if (direction === 'h') {
    const totalWidth = geometries.reduce((sum, g) => sum + g.width, 0);
    const spacing = (cells[0].getGeometry()?.x || 0) - totalWidth / cells.length;
    let x = 0;
    geometries.forEach((g, i) => {
      g.x = x;
      x += g.width + spacing;
      cells[i].setGeometry(g);
    });
  } else {
    const totalHeight = geometries.reduce((sum, g) => sum + g.height, 0);
    const spacing = (cells[0].getGeometry()?.y || 0) - totalHeight / cells.length;
    let y = 0;
    geometries.forEach((g, i) => {
      g.y = y;
      y += g.height + spacing;
      cells[i].setGeometry(g);
    });
  }
}

/**
 * Export graph as XML
 */
export function exportAsXml(graph: Graph): string {
  try {
    const model = graph.getModel();
    // Use maxGraph's codec
    const codec = (window as any).mx?.mxCodec;
    if (!codec) {
      // Fallback: serialize manually
      return JSON.stringify(serializeGraph(graph));
    }
    const encoder = new codec();
    const node = encoder.encode(model);
    return (window as any).mx?.mxUtils.getXml?.(node) || '';
  } catch {
    return '';
  }
}

/**
 * Serialize graph to JSON for storage
 */
export function serializeGraph(graph: Graph): any {
  const cells: any[] = [];
  const root = graph.getModel().getRoot();

  if (root) {
    const traverse = (cell: Cell) => {
      if (!cell.isEdge() && !cell.isVertex()) return;

      const geo = cell.getGeometry();
      cells.push({
        id: cell.getId(),
        value: cell.getValue(),
        style: cell.getStyle(),
        geometry: geo ? { x: geo.x, y: geo.y, width: geo.width, height: geo.height } : null,
        edge: cell.isEdge(),
        source: cell.getSource()?.getId(),
        target: cell.getTarget()?.getId(),
      });

      for (let i = 0; i < cell.getChildCount(); i++) {
        traverse(cell.getChildAt(i));
      }
    };

    traverse(root);
  }

  return {
    version: '1.0',
    cells,
    timestamp: Date.now(),
  };
}

/**
 * Restore graph from serialized data
 */
export function deserializeGraph(graph: Graph, data: any): void {
  if (!data.cells) return;

  const model = graph.getModel();
  const parent = model.getRoot();
  const cellMap: Map<string, Cell> = new Map();

  model.beginUpdate();

  try {
    // First pass: create vertices
    data.cells.forEach((cellData: any) => {
      if (!cellData.edge && cellData.geometry) {
        const vertex = graph.insertVertex(
          parent,
          cellData.id,
          cellData.value,
          cellData.geometry.x,
          cellData.geometry.y,
          cellData.geometry.width,
          cellData.geometry.height,
          cellData.style
        );
        cellMap.set(cellData.id, vertex);
      }
    });

    // Second pass: create edges
    data.cells.forEach((cellData: any) => {
      if (cellData.edge && cellData.source && cellData.target) {
        const source = cellMap.get(cellData.source);
        const target = cellMap.get(cellData.target);
        if (source && target) {
          graph.insertEdge(parent, cellData.id, cellData.value, source, target, cellData.style);
        }
      }
    });
  } finally {
    model.endUpdate();
  }
}

/**
 * Get graph statistics
 */
export function getGraphStats(graph: Graph) {
  let vertices = 0;
  let edges = 0;

  const root = graph.getModel().getRoot();
  if (root) {
    const traverse = (cell: Cell) => {
      if (cell.isVertex()) vertices++;
      if (cell.isEdge()) edges++;

      for (let i = 0; i < cell.getChildCount(); i++) {
        traverse(cell.getChildAt(i));
      }
    };

    traverse(root);
  }

  return { vertices, edges, total: vertices + edges };
}
