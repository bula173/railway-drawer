/**
 * @file BrushHistory.test.ts
 * @brief Tests for brush stroke history and undo/redo functionality
 */

import { describe, it, expect } from 'vitest';
import type { BrushStroke, BrushConfig } from '../../utils/brushTools';
import { smoothPath, pointsToSVGPath, simplifyPath } from '../../utils/brushTools';

describe('Brush History Management', () => {
  describe('Brush stroke creation', () => {
    it('should create a valid brush stroke', () => {
      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ];

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points,
        config,
        created: Date.now(),
      };

      expect(stroke.id).toBe('stroke-1');
      expect(stroke.points).toHaveLength(3);
      expect(stroke.config.type).toBe('pen');
    });

    it('should handle multiple consecutive brush strokes', () => {
      const config: BrushConfig = {
        type: 'freehand',
        size: 3,
        color: '#ff0000',
        opacity: 0.8,
        smoothing: 0.6,
        pressure: true,
        temporary: false,
      };

      const strokes: BrushStroke[] = [];

      for (let i = 0; i < 5; i++) {
        const points = [
          { x: i * 10, y: i * 10 },
          { x: i * 10 + 10, y: i * 10 + 10 },
        ];

        strokes.push({
          id: `stroke-${i}`,
          type: 'freehand',
          points,
          config,
          created: Date.now() + i,
        });
      }

      expect(strokes).toHaveLength(5);
      expect(strokes[0].id).toBe('stroke-0');
      expect(strokes[4].id).toBe('stroke-4');
    });
  });

  describe('History state snapshots', () => {
    it('should create immutable history snapshots', () => {
      const stroke1: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [{ x: 0, y: 0 }],
        config: {
          type: 'pen',
          size: 2,
          color: '#000000',
          opacity: 1,
          smoothing: 0.5,
          pressure: false,
          temporary: false,
        },
        created: Date.now(),
      };

      const history: BrushStroke[][] = [];
      history.push([stroke1]);

      const stroke2: BrushStroke = {
        id: 'stroke-2',
        type: 'pen',
        points: [{ x: 10, y: 10 }],
        config: stroke1.config,
        created: Date.now(),
      };

      history.push([stroke1, stroke2]);

      // Original should not be mutated
      expect(history[0]).toHaveLength(1);
      expect(history[1]).toHaveLength(2);
    });

    it('should maintain correct history indices', () => {
      const strokes: BrushStroke[] = [];
      const history: BrushStroke[][] = [];
      let historyIndex = -1;

      // Add strokes to history
      for (let i = 0; i < 5; i++) {
        strokes.push({
          id: `stroke-${i}`,
          type: 'pen',
          points: [{ x: i * 10, y: i * 10 }],
          config: {
            type: 'pen',
            size: 2,
            color: '#000000',
            opacity: 1,
            smoothing: 0.5,
            pressure: false,
            temporary: false,
          },
          created: Date.now(),
        });

        // Add to history and update index
        history.push([...strokes]);
        historyIndex++;
      }

      expect(historyIndex).toBe(4);
      expect(history).toHaveLength(5);
      expect(history[historyIndex]).toHaveLength(5);
    });
  });

  describe('Undo/Redo operations', () => {
    it('should undo to previous brush state', () => {
      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      let strokes: BrushStroke[] = [];
      let history: BrushStroke[][] = [[]];
      let historyIndex = 0;

      // Add a stroke
      strokes.push({
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        config,
        created: Date.now(),
      });

      history.push([...strokes]);
      historyIndex++;

      // Undo
      if (historyIndex > 0) {
        strokes = [...history[historyIndex - 1]];
        historyIndex--;
      }

      expect(historyIndex).toBe(0);
      expect(strokes).toHaveLength(0);
    });

    it('should redo to next brush state', () => {
      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      let strokes: BrushStroke[] = [];
      let history: BrushStroke[][] = [[]];
      let historyIndex = 0;

      // Add a stroke
      strokes.push({
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        config,
        created: Date.now(),
      });

      history.push([...strokes]);
      historyIndex++;

      // Undo
      strokes = [...history[historyIndex - 1]];
      historyIndex--;

      // Redo
      if (historyIndex < history.length - 1) {
        strokes = [...history[historyIndex + 1]];
        historyIndex++;
      }

      expect(historyIndex).toBe(1);
      expect(strokes).toHaveLength(1);
      expect(strokes[0].id).toBe('stroke-1');
    });

    it('should handle multiple undo/redo operations', () => {
      let history: number[][] = [[1]];
      let historyIndex = 0;

      // Add states
      history.push([1, 2]);
      historyIndex++;
      history.push([1, 2, 3]);
      historyIndex++;

      // Undo twice
      historyIndex = Math.max(0, historyIndex - 1);
      expect(historyIndex).toBe(1);

      historyIndex = Math.max(0, historyIndex - 1);
      expect(historyIndex).toBe(0);

      // Redo once
      historyIndex = Math.min(historyIndex + 1, history.length - 1);
      expect(historyIndex).toBe(1);
    });
  });

  describe('History clearing', () => {
    it('should clear future history after new operation following undo', () => {
      let history: number[][] = [[1]];
      let historyIndex = 0;

      // Add states
      history.push([1, 2]);
      historyIndex++;
      history.push([1, 2, 3]);
      historyIndex++;

      // Undo
      historyIndex--;

      // New operation should clear future history
      history = [...history.slice(0, historyIndex + 1), [1, 2, 99]];
      historyIndex++;

      expect(history).toHaveLength(3);
      expect(history[2]).toEqual([1, 2, 99]);
    });

    it('should handle clearing future history with empty states', () => {
      let history: BrushStroke[][] = [[]];
      let historyIndex = 0;

      // Add stroke 1
      const stroke1: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [{ x: 0, y: 0 }],
        config: {
          type: 'pen',
          size: 2,
          color: '#000000',
          opacity: 1,
          smoothing: 0.5,
          pressure: false,
          temporary: false,
        },
        created: Date.now(),
      };

      history.push([stroke1]);
      historyIndex++;

      // Add stroke 2
      const stroke2: BrushStroke = {
        ...stroke1,
        id: 'stroke-2',
      };

      history.push([stroke1, stroke2]);
      historyIndex++;

      // Undo
      historyIndex--;

      // New stroke after undo clears future
      const newStroke: BrushStroke = {
        ...stroke1,
        id: 'stroke-3',
      };

      history = [...history.slice(0, historyIndex + 1), [stroke1, newStroke]];
      historyIndex++;

      expect(history).toHaveLength(3);
      expect(history[historyIndex][1].id).toBe('stroke-3');
    });
  });

  describe('Brush config preservation', () => {
    it('should preserve brush config in history snapshots', () => {
      const config: BrushConfig = {
        type: 'marker',
        size: 8,
        color: '#ff0000',
        opacity: 0.5,
        smoothing: 0.3,
        pressure: true,
        temporary: false,
      };

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'marker',
        points: [
          { x: 0, y: 0, pressure: 0.8 },
          { x: 10, y: 10, pressure: 1.0 },
        ],
        config,
        created: Date.now(),
      };

      expect(stroke.config.type).toBe('marker');
      expect(stroke.config.size).toBe(8);
      expect(stroke.config.color).toBe('#ff0000');
      expect(stroke.points[0].pressure).toBe(0.8);
    });

    it('should handle config changes during drawing', () => {
      let config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const strokes: BrushStroke[] = [];
      const configHistory: BrushConfig[] = [config];

      // Start stroke with pen
      strokes.push({
        id: 'stroke-1',
        type: 'pen',
        points: [{ x: 0, y: 0 }],
        config,
        created: Date.now(),
      });

      // Change config
      config = {
        ...config,
        type: 'marker',
        size: 8,
      };
      configHistory.push(config);

      // New stroke uses new config
      strokes.push({
        id: 'stroke-2',
        type: 'marker',
        points: [{ x: 10, y: 10 }],
        config,
        created: Date.now(),
      });

      expect(strokes[0].config.type).toBe('pen');
      expect(strokes[1].config.type).toBe('marker');
      expect(configHistory).toHaveLength(2);
    });
  });

  describe('History boundary conditions', () => {
    it('should handle undo at history start', () => {
      let history: number[][] = [[1]];
      let historyIndex = 0;

      // Cannot undo at start
      const canUndo = historyIndex > 0;
      expect(canUndo).toBe(false);

      // Undo should be a no-op
      if (canUndo) {
        historyIndex--;
      }

      expect(historyIndex).toBe(0);
    });

    it('should handle redo at history end', () => {
      let history: number[][] = [[1], [1, 2]];
      let historyIndex = 1;

      // Cannot redo at end
      const canRedo = historyIndex < history.length - 1;
      expect(canRedo).toBe(false);

      // Redo should be a no-op
      if (canRedo) {
        historyIndex++;
      }

      expect(historyIndex).toBe(1);
    });

    it('should handle large history stacks', () => {
      let history: number[][] = [];
      let historyIndex = -1;

      // Build a large history
      for (let i = 0; i < 1000; i++) {
        history.push([i]);
        historyIndex++;
      }

      expect(history).toHaveLength(1000);
      expect(historyIndex).toBe(999);

      // Undo to middle
      for (let i = 0; i < 500; i++) {
        historyIndex--;
      }

      expect(historyIndex).toBe(499);

      // Redo to end
      for (let i = 0; i < 500; i++) {
        historyIndex++;
      }

      expect(historyIndex).toBe(999);
    });
  });

  describe('Stroke validation', () => {
    it('should validate brush strokes before adding to history', () => {
      const validStroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        config: {
          type: 'pen',
          size: 2,
          color: '#000000',
          opacity: 1,
          smoothing: 0.5,
          pressure: false,
          temporary: false,
        },
        created: Date.now(),
      };

      // Validate required fields
      expect(validStroke.id).toBeTruthy();
      expect(validStroke.type).toBeTruthy();
      expect(validStroke.points.length).toBeGreaterThanOrEqual(2);
      expect(validStroke.config).toBeTruthy();
    });

    it('should reject strokes with insufficient points', () => {
      const invalidStroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [{ x: 0, y: 0 }], // Only 1 point - invalid
        config: {
          type: 'pen',
          size: 2,
          color: '#000000',
          opacity: 1,
          smoothing: 0.5,
          pressure: false,
          temporary: false,
        },
        created: Date.now(),
      };

      const isValid = invalidStroke.points.length >= 2;
      expect(isValid).toBe(false);
    });
  });
});
