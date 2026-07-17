/**
 * @file mxGraphUtils.ts
 * @brief Utility functions for mxGraph integration
 */

import { logger } from './logger';

/**
 * Convert draw.io XML to our internal format
 */
export function parseDrawioXml(xmlString: string): any {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('XML parse error');
    }

    return xmlDoc;
  } catch (error) {
    logger.error('mxGraphUtils', 'Failed to parse draw.io XML', { error });
    throw error;
  }
}

/**
 * Extract cells from mxGraph model
 */
export function extractCells(model: any): any[] {
  const cells = [];
  const root = model.getRoot();

  if (root) {
    for (let i = 0; i < root.getChildCount(); i++) {
      const cell = root.getChildAt(i);
      cells.push({
        id: cell.getId(),
        value: cell.getValue(),
        geometry: cell.getGeometry(),
        style: cell.getStyle(),
      });
    }
  }

  return cells;
}

/**
 * Create a shape from ToolboxItem for mxGraph
 */
export function createShapeFromItem(graph: any, item: any, x: number, y: number) {
  try {
    const parent = graph.getDefaultParent();

    // Insert vertex with image style
    const vertex = graph.insertVertex(
      parent,
      null,
      item.name,
      x,
      y,
      item.width || 80,
      item.height || 60
    );

    // Set SVG as image if available
    if (item.shapeElements && item.shapeElements.length > 0) {
      const svg = item.shapeElements[0].svg;
      if (svg) {
        // Create base64 data URI from SVG
        const svgData = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgData);
        vertex.setStyle(`image;image=${url}`);
      }
    }

    return vertex;
  } catch (error) {
    logger.error('mxGraphUtils', 'Failed to create shape', { error, item });
    throw error;
  }
}

/**
 * Convert mxGraph model to draw.io format
 */
export function modelToDrawioXml(model: any, mxCodec: any, mxUtils: any): string {
  try {
    const encoder = new mxCodec();
    const node = encoder.encode(model);
    return mxUtils.getXml(node);
  } catch (error) {
    logger.error('mxGraphUtils', 'Failed to convert model to XML', { error });
    throw error;
  }
}

/**
 * Load draw.io XML into mxGraph model
 */
export function loadDrawioXmlToModel(
  xmlString: string,
  model: any,
  mxCodec: any,
  mxUtils: any
): void {
  try {
    const xml = mxUtils.parseXml(xmlString);
    const codec = new mxCodec(xml);

    // Clear existing model
    model.clear();

    // Decode XML into model
    codec.decode(xml.documentElement, model);

    logger.debug('mxGraphUtils', 'XML loaded into model successfully');
  } catch (error) {
    logger.error('mxGraphUtils', 'Failed to load XML into model', { error });
    throw error;
  }
}

/**
 * Get graph statistics
 */
export function getGraphStats(graph: any) {
  const cells = graph.getModel().getRoot()?.getChildCount() || 0;
  const vertices = graph.getModel().getRoot()?.getChildCount() || 0;
  const edges = 0;

  return {
    totalCells: cells,
    vertices,
    edges,
  };
}

/**
 * Export graph as SVG
 */
export function exportAsSvg(graph: any): string {
  try {
    const svg = graph.getGraphicsCanvas().getContainer();
    if (!svg) {
      throw new Error('Canvas not found');
    }
    return new XMLSerializer().serializeToString(svg);
  } catch (error) {
    logger.error('mxGraphUtils', 'Failed to export as SVG', { error });
    throw error;
  }
}

/**
 * Fit graph to window
 */
export function fitToWindow(graph: any): void {
  try {
    graph.fit(50); // 50px margin
  } catch (error) {
    logger.error('mxGraphUtils', 'Failed to fit to window', { error });
  }
}

/**
 * Get graph zoom level
 */
export function getZoom(graph: any): number {
  return graph.getView().getScale();
}

/**
 * Set graph zoom level
 */
export function setZoom(graph: any, scale: number): void {
  graph.getView().setScale(scale);
}

/**
 * Validate draw.io XML structure
 */
export function validateDrawioXml(xmlString: string): boolean {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return false;
    }

    // Check for mxGraphModel
    const model = xmlDoc.getElementsByTagName('mxGraphModel');
    return model.length > 0;
  } catch {
    return false;
  }
}
