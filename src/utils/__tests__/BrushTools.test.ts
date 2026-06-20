/**
 * @file BrushTools.test.ts
 * @brief Tests for brush tool utilities
 */

import { describe, it, expect } from 'vitest';
import {
  smoothPath,
  pointsToSVGPath,
  addSketchyEffect,
  isStrokeTap,
  simplifyPath,
  BRUSH_PRESETS,
  BRUSH_DESCRIPTIONS,
} from '../brushTools';

describe('Brush Tools', () => {
  describe('Smooth Path', () => {
    it('should return same points if smoothing is 0', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 5 },
      ];

      const smoothed = smoothPath(points, 0);
      expect(smoothed).toEqual(points);
    });

    it('should increase point count with higher smoothing', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 5 },
      ];

      const smoothed = smoothPath(points, 0.5);
      expect(smoothed.length).toBeGreaterThan(points.length);
    });

    it('should handle single point', () => {
      const points = [{ x: 0, y: 0 }];
      const smoothed = smoothPath(points, 0.5);
      expect(smoothed).toEqual(points);
    });

    it('should handle empty array', () => {
      const points: Array<{ x: number; y: number }> = [];
      const smoothed = smoothPath(points, 0.5);
      expect(smoothed).toEqual([]);
    });
  });

  describe('Points to SVG Path', () => {
    it('should generate SVG path from points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 5 },
      ];

      const path = pointsToSVGPath(points);
      expect(path).toContain('M 0 0');
      expect(path).toContain('L 10 10');
      expect(path).toContain('L 20 5');
    });

    it('should handle single point', () => {
      const points = [{ x: 5, y: 5 }];
      const path = pointsToSVGPath(points);
      expect(path).toBe('M 5 5');
    });

    it('should return empty string for empty points', () => {
      const points: Array<{ x: number; y: number }> = [];
      const path = pointsToSVGPath(points);
      expect(path).toBe('');
    });

    it('should start with M command', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      const path = pointsToSVGPath(points);
      expect(path.startsWith('M')).toBe(true);
    });
  });

  describe('Sketchy Effect', () => {
    it('should add jitter to points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      const sketchy = addSketchyEffect(points, 2);
      expect(sketchy).toHaveLength(points.length);
      // Points should be different (with very high probability)
      expect(sketchy).not.toEqual(points);
    });

    it('should respect intensity parameter', () => {
      const points = [{ x: 0, y: 0 }];

      const light = addSketchyEffect(points, 1);
      const heavy = addSketchyEffect(points, 10);

      // Both should modify the point
      expect(light[0]).not.toEqual(points[0]);
      expect(heavy[0]).not.toEqual(points[0]);
    });

    it('should handle zero intensity', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      const sketchy = addSketchyEffect(points, 0);
      expect(sketchy).toEqual(points);
    });
  });

  describe('Stroke Tap Detection', () => {
    it('should detect tap stroke', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];

      expect(isStrokeTap(points)).toBe(true);
    });

    it('should not detect long stroke as tap', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ];

      expect(isStrokeTap(points)).toBe(false);
    });

    it('should detect single point as tap', () => {
      const points = [{ x: 0, y: 0 }];
      expect(isStrokeTap(points)).toBe(true);
    });

    it('should handle empty array', () => {
      const points: Array<{ x: number; y: number }> = [];
      expect(isStrokeTap(points)).toBe(true);
    });
  });

  describe('Path Simplification', () => {
    it('should remove close points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 10, y: 10 },
      ];

      const simplified = simplifyPath(points, 2);
      expect(simplified.length).toBeLessThan(points.length);
    });

    it('should preserve first and last points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 100, y: 100 },
      ];

      const simplified = simplifyPath(points, 5);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should handle single point', () => {
      const points = [{ x: 0, y: 0 }];
      const simplified = simplifyPath(points, 2);
      expect(simplified).toEqual(points);
    });

    it('should handle empty distance parameter', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];

      const simplified = simplifyPath(points, 0);
      expect(simplified).toEqual(points);
    });
  });

  describe('Brush Presets', () => {
    it('should have all brush types defined', () => {
      const brushTypes = ['freehand', 'pen', 'marker', 'pencil', 'annotation'];
      brushTypes.forEach((type) => {
        expect(BRUSH_PRESETS[type as any]).toBeDefined();
      });
    });

    it('should have valid default sizes', () => {
      Object.values(BRUSH_PRESETS).forEach((preset) => {
        expect(preset.size).toBeGreaterThan(0);
        expect(preset.size).toBeLessThanOrEqual(20);
      });
    });

    it('should have valid opacity values', () => {
      Object.values(BRUSH_PRESETS).forEach((preset) => {
        expect(preset.opacity).toBeGreaterThanOrEqual(0);
        expect(preset.opacity).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid smoothing values', () => {
      Object.values(BRUSH_PRESETS).forEach((preset) => {
        expect(preset.smoothing).toBeGreaterThanOrEqual(0);
        expect(preset.smoothing).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Brush Descriptions', () => {
    it('should have descriptions for all brush types', () => {
      const brushTypes = ['freehand', 'pen', 'marker', 'pencil', 'annotation'];
      brushTypes.forEach((type) => {
        expect(BRUSH_DESCRIPTIONS[type as any]).toBeTruthy();
        expect(typeof BRUSH_DESCRIPTIONS[type as any]).toBe('string');
      });
    });

    it('should have meaningful descriptions', () => {
      Object.values(BRUSH_DESCRIPTIONS).forEach((desc) => {
        expect(desc.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Brush Configuration', () => {
    it('should have freehand as default type', () => {
      expect(BRUSH_PRESETS.freehand).toBeDefined();
    });

    it('should have marker with high opacity', () => {
      expect(BRUSH_PRESETS.marker.opacity).toBeLessThan(1);
    });

    it('should have annotation as temporary', () => {
      expect(BRUSH_PRESETS.annotation.temporary).toBe(true);
    });

    it('should have pen with high smoothing', () => {
      expect(BRUSH_PRESETS.pen.smoothing).toBeGreaterThan(0.7);
    });
  });
});
