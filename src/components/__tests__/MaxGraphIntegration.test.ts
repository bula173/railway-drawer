/**
 * @file MaxGraphIntegration.test.ts
 * @brief Integration tests for maxGraph system
 *
 * Phase 8: Testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Graph, Cell } from '@maxgraph/core';
import {
  createVertex,
  createEdge,
  getCellStyleAsObject,
  updateCellStyle,
  duplicateCells,
  alignCells,
  serializeGraph,
  deserializeGraph,
  getGraphStats,
} from '../../utils/maxGraphUtils';
import {
  cellToDrawElement,
  drawElementToCellStyle,
  parseStyle,
} from '../../components/MaxGraphAdapter';

describe('MaxGraph Integration', () => {
  let graph: Graph;
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create test container
    container = document.createElement('div');
    container.id = 'graph-container';
    document.body.appendChild(container);

    // Create graph
    graph = new Graph(container);
  });

  afterEach(() => {
    graph.destroy();
    document.body.removeChild(container);
  });

  describe('Cell Creation', () => {
    it('should create a vertex', () => {
      const parent = graph.getDefaultParent();
      const vertex = createVertex(graph, parent, 'Test', 10, 20, 80, 60);

      expect(vertex).toBeDefined();
      expect(vertex.isVertex()).toBe(true);
      expect(vertex.getValue()).toBe('Test');

      const geo = vertex.getGeometry();
      expect(geo?.x).toBe(10);
      expect(geo?.y).toBe(20);
      expect(geo?.width).toBe(80);
      expect(geo?.height).toBe(60);
    });

    it('should create an edge', () => {
      const parent = graph.getDefaultParent();
      const v1 = createVertex(graph, parent, 'V1', 10, 20, 80, 60);
      const v2 = createVertex(graph, parent, 'V2', 200, 20, 80, 60);

      const edge = createEdge(graph, parent, v1, v2);

      expect(edge).toBeDefined();
      expect(edge.isEdge()).toBe(true);
      expect(edge.getSource()).toBe(v1);
      expect(edge.getTarget()).toBe(v2);
    });
  });

  describe('Style Management', () => {
    it('should parse style string', () => {
      const style = parseStyle('fillColor=#fff;strokeColor=#000;strokeWidth=2');
      expect(style.fillColor).toBe('#fff');
      expect(style.strokeColor).toBe('#000');
      expect(style.strokeWidth).toBe('2');
    });

    it('should get cell style as object', () => {
      const parent = graph.getDefaultParent();
      const vertex = createVertex(graph, parent, 'Test', 10, 20, 80, 60, 'fillColor=#f0f0f0;strokeColor=#999');

      const styleObj = getCellStyleAsObject(vertex);
      expect(styleObj.fillColor).toBe('#f0f0f0');
      expect(styleObj.strokeColor).toBe('#999');
    });

    it('should update cell style', () => {
      const parent = graph.getDefaultParent();
      const vertex = createVertex(graph, parent, 'Test', 10, 20, 80, 60);

      updateCellStyle(vertex, {
        fillColor: '#ff0000',
        strokeWidth: '3',
      });

      const styleObj = getCellStyleAsObject(vertex);
      expect(styleObj.fillColor).toBe('#ff0000');
      expect(styleObj.strokeWidth).toBe('3');
    });
  });

  describe('Cell Operations', () => {
    it('should duplicate cells', () => {
      const parent = graph.getDefaultParent();
      const v1 = createVertex(graph, parent, 'V1', 10, 20, 80, 60);

      const clones = duplicateCells(graph, [v1]);
      expect(clones).toHaveLength(1);
      expect(clones[0].getValue()).toBe(v1.getValue());

      const cloneGeo = clones[0].getGeometry();
      const originalGeo = v1.getGeometry();
      expect(cloneGeo?.x).toBe((originalGeo?.x || 0) + 20);
      expect(cloneGeo?.y).toBe((originalGeo?.y || 0) + 20);
    });

    it('should align cells', () => {
      const parent = graph.getDefaultParent();
      const v1 = createVertex(graph, parent, 'V1', 10, 20, 80, 60);
      const v2 = createVertex(graph, parent, 'V2', 100, 20, 80, 60);

      alignCells(graph, [v1, v2], 'left');

      const v1Geo = v1.getGeometry();
      const v2Geo = v2.getGeometry();
      expect(v1Geo?.x).toBe(v2Geo?.x);
    });
  });

  describe('Serialization', () => {
    it('should serialize graph', () => {
      const parent = graph.getDefaultParent();
      createVertex(graph, parent, 'V1', 10, 20, 80, 60);
      createVertex(graph, parent, 'V2', 100, 20, 80, 60);

      const serialized = serializeGraph(graph);
      expect(serialized.version).toBe('1.0');
      expect(serialized.cells).toBeDefined();
      expect(Array.isArray(serialized.cells)).toBe(true);
    });

    it('should deserialize graph', () => {
      const parent = graph.getDefaultParent();
      createVertex(graph, parent, 'V1', 10, 20, 80, 60);

      const serialized = serializeGraph(graph);
      const newGraph = new Graph(document.createElement('div'));
      deserializeGraph(newGraph, serialized);

      const stats = getGraphStats(newGraph);
      expect(stats.vertices).toBeGreaterThan(0);
    });
  });

  describe('Adapter', () => {
    it('should convert cell to DrawElement', () => {
      const parent = graph.getDefaultParent();
      const vertex = createVertex(graph, parent, 'Test', 10, 20, 80, 60);

      const element = cellToDrawElement(vertex, graph);
      expect(element.type).toBe('shape');
      expect(element.x).toBe(10);
      expect(element.y).toBe(20);
      expect(element.width).toBe(80);
      expect(element.height).toBe(60);
    });

    it('should convert DrawElement to cell style', () => {
      const element = {
        id: '1',
        type: 'shape' as const,
        x: 10,
        y: 20,
        width: 80,
        height: 60,
        rotation: 45,
        shape: 'rectangle',
        styles: {
          fill: '#ff0000',
          stroke: '#000000',
          strokeWidth: 2,
        },
      };

      const style = drawElementToCellStyle(element);
      expect(style).toContain('fillColor=#ff0000');
      expect(style).toContain('strokeColor=#000000');
      expect(style).toContain('rotation=45');
    });
  });

  describe('Graph Statistics', () => {
    it('should calculate graph stats', () => {
      const parent = graph.getDefaultParent();
      createVertex(graph, parent, 'V1', 10, 20, 80, 60);
      createVertex(graph, parent, 'V2', 100, 20, 80, 60);

      const stats = getGraphStats(graph);
      expect(stats.vertices).toBeGreaterThanOrEqual(2);
      expect(stats.edges).toBeGreaterThanOrEqual(0);
      expect(stats.total).toBe(stats.vertices + stats.edges);
    });
  });
});
