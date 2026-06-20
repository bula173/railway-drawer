/**
 * @file connectionManager.test.ts
 * @brief Comprehensive unit tests for connection management utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConnectionPoints,
  findNearestConnectionPoint,
  canConnect,
  createConnection,
  getAllConnectionPoints,
  isNearConnectionPoint,
  snapToConnectionPoint,
} from '../connectionManager';
import type { DrawElement } from '../../components/Elements';

describe('connectionManager', () => {
  let mockElement1: DrawElement;
  let mockElement2: DrawElement;
  let mockElement3: DrawElement;

  beforeEach(() => {
    mockElement1 = {
      id: 'elem1',
      type: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      styles: {},
      isLineBased: false,
    };

    mockElement2 = {
      id: 'elem2',
      type: 'circle',
      start: { x: 200, y: 200 },
      end: { x: 300, y: 300 },
      styles: {},
      isLineBased: false,
    };

    mockElement3 = {
      id: 'elem3',
      type: 'line',
      start: { x: 50, y: 50 },
      end: { x: 150, y: 150 },
      styles: {},
      isLineBased: true,
    };
  });

  describe('getConnectionPoints', () => {
    it('should return 4 connection points for a shape', () => {
      const points = getConnectionPoints(mockElement1);
      expect(points).toHaveLength(4);
    });

    it('should have one point for each side (top, right, bottom, left)', () => {
      const points = getConnectionPoints(mockElement1);
      const sides = points.map(p => p.side).sort();
      expect(sides).toEqual(['bottom', 'left', 'right', 'top']);
    });

    it('should place top point at center-x, top-y', () => {
      const points = getConnectionPoints(mockElement1);
      const topPoint = points.find(p => p.side === 'top');
      expect(topPoint?.position.x).toBe(50); // center of 0-100
      expect(topPoint?.position.y).toBe(0); // top edge
    });

    it('should place right point at right-x, center-y', () => {
      const points = getConnectionPoints(mockElement1);
      const rightPoint = points.find(p => p.side === 'right');
      expect(rightPoint?.position.x).toBe(100); // right edge
      expect(rightPoint?.position.y).toBe(50); // center of 0-100
    });

    it('should place bottom point at center-x, bottom-y', () => {
      const points = getConnectionPoints(mockElement1);
      const bottomPoint = points.find(p => p.side === 'bottom');
      expect(bottomPoint?.position.x).toBe(50); // center of 0-100
      expect(bottomPoint?.position.y).toBe(100); // bottom edge
    });

    it('should place left point at left-x, center-y', () => {
      const points = getConnectionPoints(mockElement1);
      const leftPoint = points.find(p => p.side === 'left');
      expect(leftPoint?.position.x).toBe(0); // left edge
      expect(leftPoint?.position.y).toBe(50); // center of 0-100
    });

    it('should assign unique IDs to each point', () => {
      const points = getConnectionPoints(mockElement1);
      const ids = points.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });

    it('should set bidirectional type for all points', () => {
      const points = getConnectionPoints(mockElement1);
      points.forEach(point => {
        expect(point.type).toBe('bidirectional');
      });
    });

    it('should reference correct element ID', () => {
      const points = getConnectionPoints(mockElement1);
      points.forEach(point => {
        expect(point.elementId).toBe('elem1');
      });
    });
  });

  describe('findNearestConnectionPoint', () => {
    it('should find nearest point within snap distance', () => {
      const elements = [mockElement1, mockElement2];
      const position = { x: 51, y: 5 }; // Very close to top point of elem1
      const nearest = findNearestConnectionPoint(position, elements);
      expect(nearest).toBeDefined();
      expect(nearest?.elementId).toBe('elem1');
      expect(nearest?.side).toBe('top');
    });

    it('should return null if no points within snap distance', () => {
      const elements = [mockElement1, mockElement2];
      const position = { x: -500, y: -500 }; // Very far away
      const nearest = findNearestConnectionPoint(position, elements);
      expect(nearest).toBeNull();
    });

    it('should exclude specified element ID', () => {
      const elements = [mockElement1, mockElement2];
      const position = { x: 50, y: 0 }; // On elem1's top point
      const nearest = findNearestConnectionPoint(position, elements, 'elem1');
      // Should find elem2's point instead
      expect(nearest?.elementId).not.toBe('elem1');
    });

    it('should find closest point among multiple candidates', () => {
      const elements = [mockElement1, mockElement2];
      const position = { x: 100, y: 50 }; // Closer to elem1's right point
      const nearest = findNearestConnectionPoint(position, elements);
      expect(nearest?.elementId).toBe('elem1');
      expect(nearest?.side).toBe('right');
    });

    it('should handle empty elements array', () => {
      const nearest = findNearestConnectionPoint({ x: 50, y: 50 }, []);
      expect(nearest).toBeNull();
    });

    it('should snap distance be 20px', () => {
      const elements = [mockElement1];
      // Exactly 20px away from top point (50, 0)
      const position = { x: 50, y: 20 };
      const nearest = findNearestConnectionPoint(position, elements);
      expect(nearest).toBeDefined(); // Should be within snap distance
    });

    it('should not snap beyond 20px distance', () => {
      const elements = [mockElement1];
      // 21px away from top point
      const position = { x: 50, y: 21 };
      const nearest = findNearestConnectionPoint(position, elements);
      expect(nearest).toBeNull(); // Should be outside snap distance
    });
  });

  describe('canConnect', () => {
    it('should allow connection between different shapes', () => {
      const result = canConnect(mockElement1, mockElement2);
      expect(result).toBe(true);
    });

    it('should not allow connection from shape to itself', () => {
      const result = canConnect(mockElement1, mockElement1);
      expect(result).toBe(false);
    });

    it('should require valid start point', () => {
      const invalidElement = { ...mockElement2, start: null };
      const result = canConnect(invalidElement as any, mockElement1);
      expect(result).toBe(false);
    });

    it('should require valid end point', () => {
      const invalidElement = { ...mockElement2, end: null };
      const result = canConnect(mockElement1, invalidElement as any);
      expect(result).toBe(false);
    });
  });

  describe('createConnection', () => {
    it('should create connection with unique ID', () => {
      const conn1 = createConnection('elem1', 'elem2');
      const conn2 = createConnection('elem1', 'elem2');
      expect(conn1.id).not.toBe(conn2.id);
    });

    it('should set correct source and target', () => {
      const conn = createConnection('source-id', 'target-id');
      expect(conn.fromElementId).toBe('source-id');
      expect(conn.toElementId).toBe('target-id');
    });

    it('should default to direct type', () => {
      const conn = createConnection('elem1', 'elem2');
      expect(conn.type).toBe('direct');
    });

    it('should allow custom connection type', () => {
      const conn = createConnection('elem1', 'elem2', 'junction');
      expect(conn.type).toBe('junction');
    });

    it('should set default connection points', () => {
      const conn = createConnection('elem1', 'elem2');
      expect(conn.fromPointId).toBe('elem1-right');
      expect(conn.toPointId).toBe('elem2-left');
    });
  });

  describe('getAllConnectionPoints', () => {
    it('should return all points from all elements', () => {
      const elements = [mockElement1, mockElement2, mockElement3];
      const allPoints = getAllConnectionPoints(elements);
      expect(allPoints.length).toBe(12); // 4 points per element * 3 elements
    });

    it('should handle empty array', () => {
      const allPoints = getAllConnectionPoints([]);
      expect(allPoints).toEqual([]);
    });

    it('should maintain element references', () => {
      const elements = [mockElement1, mockElement2];
      const allPoints = getAllConnectionPoints(elements);
      const elem1Points = allPoints.filter(p => p.elementId === 'elem1');
      const elem2Points = allPoints.filter(p => p.elementId === 'elem2');
      expect(elem1Points).toHaveLength(4);
      expect(elem2Points).toHaveLength(4);
    });
  });

  describe('isNearConnectionPoint', () => {
    it('should return true for position near a point', () => {
      const points = getConnectionPoints(mockElement1);
      const topPoint = points.find(p => p.side === 'top')!;
      const position = { x: 50, y: 10 }; // 10px from top point
      const result = isNearConnectionPoint(position, topPoint);
      expect(result).toBe(true);
    });

    it('should return false for position far from point', () => {
      const points = getConnectionPoints(mockElement1);
      const topPoint = points.find(p => p.side === 'top')!;
      const position = { x: 50, y: 100 }; // 100px away
      const result = isNearConnectionPoint(position, topPoint);
      expect(result).toBe(false);
    });

    it('should use 20px snap distance threshold', () => {
      const points = getConnectionPoints(mockElement1);
      const topPoint = points.find(p => p.side === 'top')!;

      // At exactly 20px (on boundary)
      const positionAt20 = { x: 50, y: 20 };
      expect(isNearConnectionPoint(positionAt20, topPoint)).toBe(true);

      // Beyond 20px
      const positionBeyond20 = { x: 50, y: 21 };
      expect(isNearConnectionPoint(positionBeyond20, topPoint)).toBe(false);
    });
  });

  describe('snapToConnectionPoint', () => {
    it('should snap to nearest connection point', () => {
      const elements = [mockElement1];
      const position = { x: 49, y: 1 }; // Close to top point (50, 0)
      const snapped = snapToConnectionPoint(position, elements);
      expect(snapped.x).toBe(50);
      expect(snapped.y).toBe(0);
    });

    it('should return original position if no snap point nearby', () => {
      const elements = [mockElement1];
      const position = { x: 500, y: 500 };
      const snapped = snapToConnectionPoint(position, elements);
      expect(snapped.x).toBe(500);
      expect(snapped.y).toBe(500);
    });

    it('should exclude specified element from snapping', () => {
      const elements = [mockElement1, mockElement2];
      const position = { x: 50, y: 0 }; // On elem1's top point
      const snapped = snapToConnectionPoint(position, elements, 'elem1');
      // Should not snap to elem1, should return original position
      expect(snapped.x).toBe(50);
      expect(snapped.y).toBe(0);
    });

    it('should handle empty elements array', () => {
      const position = { x: 50, y: 50 };
      const snapped = snapToConnectionPoint(position, []);
      expect(snapped).toEqual(position);
    });
  });
});
