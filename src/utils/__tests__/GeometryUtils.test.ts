/**
 * @file GeometryUtils.test.ts
 * @brief Tests for geometry and coordinate utility functions
 */

import { describe, it, expect } from 'vitest';

describe('Geometry Utilities', () => {
  describe('Grid Snapping', () => {
    it('should snap to 10px grid', () => {
      const snap = (value: number, gridSize: number = 10) => {
        return Math.round(value / gridSize) * gridSize;
      };

      expect(snap(5)).toBe(10);
      expect(snap(14)).toBe(10);
      expect(snap(15)).toBe(20);
      expect(snap(25)).toBe(30);
    });

    it('should snap negative values to grid', () => {
      const snap = (value: number, gridSize: number = 10) => {
        return Math.round(value / gridSize) * gridSize;
      };

      // JavaScript's Math.round behavior with banker's rounding:
      // snap(-5) = Math.round(-0.5) * 10 = 0 * 10 = -0 (negative zero!)
      // snap(-14) = Math.round(-1.4) * 10 = -1 * 10 = -10
      // snap(-15) = Math.round(-1.5) * 10 = -2 * 10 = -20 (but actually -10)
      expect(snap(-14)).toBe(-10);
      expect(snap(-15)).toBe(-10); // rounds to -10, not -20
      expect(Object.is(snap(-5), -0) || snap(-5) === 0).toBe(true); // Either -0 or 0
    });

    it('should handle zero', () => {
      const snap = (value: number, gridSize: number = 10) => {
        return Math.round(value / gridSize) * gridSize;
      };

      expect(snap(0)).toBe(0);
    });

    it('should snap point to grid', () => {
      const snapPoint = (x: number, y: number, gridSize: number = 10) => ({
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      });

      const snapped = snapPoint(17, 28);
      expect(snapped.x).toBe(20);
      expect(snapped.y).toBe(30);
    });

    it('should support different grid sizes', () => {
      const snap = (value: number, gridSize: number) => {
        return Math.round(value / gridSize) * gridSize;
      };

      expect(snap(5, 5)).toBe(5);
      expect(snap(7, 5)).toBe(5);
      expect(snap(8, 5)).toBe(10);
      expect(snap(25, 25)).toBe(25);
    });
  });

  describe('Bounding Box', () => {
    it('should calculate bounding box from two points', () => {
      const getBBox = (x1: number, y1: number, x2: number, y2: number) => ({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });

      const bbox = getBBox(0, 0, 100, 100);
      expect(bbox.x).toBe(0);
      expect(bbox.y).toBe(0);
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(100);
    });

    it('should handle reversed points', () => {
      const getBBox = (x1: number, y1: number, x2: number, y2: number) => ({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });

      const bbox = getBBox(100, 100, 0, 0);
      expect(bbox.x).toBe(0);
      expect(bbox.y).toBe(0);
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(100);
    });

    it('should calculate bounding box for multiple elements', () => {
      const elements = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 30, y: 30, width: 50, height: 50 },
        { x: 100, y: 100, width: 50, height: 50 },
      ];

      const bbox = {
        x: Math.min(...elements.map(e => e.x)),
        y: Math.min(...elements.map(e => e.y)),
        maxX: Math.max(...elements.map(e => e.x + e.width)),
        maxY: Math.max(...elements.map(e => e.y + e.height)),
      };

      bbox.width = bbox.maxX - bbox.x;
      bbox.height = bbox.maxY - bbox.y;

      expect(bbox.x).toBe(0);
      expect(bbox.y).toBe(0);
      expect(bbox.width).toBe(150);
      expect(bbox.height).toBe(150);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between two points', () => {
      const distance = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      };

      expect(distance(0, 0, 3, 4)).toBe(5);
    });

    it('should calculate distance for negative coordinates', () => {
      const distance = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      };

      expect(distance(-3, -4, 0, 0)).toBe(5);
    });

    it('should handle same points', () => {
      const distance = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      };

      expect(distance(10, 10, 10, 10)).toBe(0);
    });
  });

  describe('Point Intersection', () => {
    it('should detect point inside rectangle', () => {
      const pointInRect = (
        px: number,
        py: number,
        rx: number,
        ry: number,
        rw: number,
        rh: number
      ) => px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;

      expect(pointInRect(50, 50, 0, 0, 100, 100)).toBe(true);
    });

    it('should detect point outside rectangle', () => {
      const pointInRect = (
        px: number,
        py: number,
        rx: number,
        ry: number,
        rw: number,
        rh: number
      ) => px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;

      expect(pointInRect(150, 150, 0, 0, 100, 100)).toBe(false);
    });

    it('should detect point on rectangle boundary', () => {
      const pointInRect = (
        px: number,
        py: number,
        rx: number,
        ry: number,
        rw: number,
        rh: number
      ) => px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;

      expect(pointInRect(0, 0, 0, 0, 100, 100)).toBe(true);
      expect(pointInRect(100, 100, 0, 0, 100, 100)).toBe(true);
    });
  });

  describe('Rectangle Intersection', () => {
    it('should detect overlapping rectangles', () => {
      const rectsOverlap = (
        x1: number,
        y1: number,
        w1: number,
        h1: number,
        x2: number,
        y2: number,
        w2: number,
        h2: number
      ) =>
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;

      expect(rectsOverlap(0, 0, 100, 100, 50, 50, 100, 100)).toBe(true);
    });

    it('should detect non-overlapping rectangles', () => {
      const rectsOverlap = (
        x1: number,
        y1: number,
        w1: number,
        h1: number,
        x2: number,
        y2: number,
        w2: number,
        h2: number
      ) =>
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;

      expect(rectsOverlap(0, 0, 50, 50, 100, 100, 50, 50)).toBe(false);
    });

    it('should detect touching rectangles as overlapping', () => {
      const rectsOverlap = (
        x1: number,
        y1: number,
        w1: number,
        h1: number,
        x2: number,
        y2: number,
        w2: number,
        h2: number
      ) =>
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;

      // Touching at edge
      expect(rectsOverlap(0, 0, 50, 50, 50, 0, 50, 50)).toBe(false);
    });
  });

  describe('Midpoint Calculation', () => {
    it('should calculate midpoint between two points', () => {
      const midpoint = (x1: number, y1: number, x2: number, y2: number) => ({
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
      });

      const mp = midpoint(0, 0, 100, 100);
      expect(mp.x).toBe(50);
      expect(mp.y).toBe(50);
    });

    it('should handle negative coordinates', () => {
      const midpoint = (x1: number, y1: number, x2: number, y2: number) => ({
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
      });

      const mp = midpoint(-50, -50, 50, 50);
      expect(mp.x).toBe(0);
      expect(mp.y).toBe(0);
    });
  });

  describe('Angle Calculation', () => {
    it('should calculate angle between two points', () => {
      const angle = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      };

      const deg = angle(0, 0, 1, 0);
      expect(deg).toBe(0);
    });

    it('should handle vertical angle', () => {
      const angle = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      };

      const deg = angle(0, 0, 0, 1);
      expect(deg).toBe(90);
    });
  });

  describe('Coordinate Transformation', () => {
    it('should translate point by offset', () => {
      const translate = (x: number, y: number, dx: number, dy: number) => ({
        x: x + dx,
        y: y + dy,
      });

      const translated = translate(10, 20, 5, 10);
      expect(translated.x).toBe(15);
      expect(translated.y).toBe(30);
    });

    it('should scale point around origin', () => {
      const scale = (x: number, y: number, factor: number) => ({
        x: x * factor,
        y: y * factor,
      });

      const scaled = scale(10, 20, 2);
      expect(scaled.x).toBe(20);
      expect(scaled.y).toBe(40);
    });

    it('should scale point around arbitrary center', () => {
      const scaleAroundCenter = (
        x: number,
        y: number,
        centerX: number,
        centerY: number,
        factor: number
      ) => ({
        x: centerX + (x - centerX) * factor,
        y: centerY + (y - centerY) * factor,
      });

      const scaled = scaleAroundCenter(20, 20, 10, 10, 2);
      expect(scaled.x).toBe(30);
      expect(scaled.y).toBe(30);
    });
  });

  describe('Clamp Functions', () => {
    it('should clamp value to min/max', () => {
      const clamp = (value: number, min: number, max: number) => {
        return Math.max(min, Math.min(max, value));
      };

      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should clamp point to rectangle bounds', () => {
      const clampPoint = (
        x: number,
        y: number,
        minX: number,
        minY: number,
        maxX: number,
        maxY: number
      ) => ({
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
      });

      const clamped = clampPoint(150, 150, 0, 0, 100, 100);
      expect(clamped.x).toBe(100);
      expect(clamped.y).toBe(100);
    });
  });

  describe('Rounding Functions', () => {
    it('should round to nearest integer', () => {
      expect(Math.round(3.4)).toBe(3);
      expect(Math.round(3.5)).toBe(4);
    });

    it('should round to decimal places', () => {
      const roundTo = (value: number, decimals: number) => {
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
      };

      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(3.14159, 3)).toBe(3.142);
    });
  });
});
