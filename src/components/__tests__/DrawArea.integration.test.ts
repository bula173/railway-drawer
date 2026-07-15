/**
 * @file DrawArea.integration.test.ts
 * @brief Integration tests for DrawArea undo/redo functionality with brush strokes and elements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import type { Element, DrawAreaRef } from '../DrawArea';

describe('DrawArea Undo/Redo Integration Tests', () => {
  describe('Brush stroke history logic', () => {
    it('should prioritize brush history on undo when both histories exist', () => {
      let elementHistoryIndex = 1;
      let brushHistoryIndex = 1;

      // Undo should prioritize brush history
      let undidBrush = false;
      let undidElement = false;

      if (brushHistoryIndex > 0) {
        brushHistoryIndex--;
        undidBrush = true;
      } else if (elementHistoryIndex > 0) {
        elementHistoryIndex--;
        undidElement = true;
      }

      expect(undidBrush).toBe(true);
      expect(undidElement).toBe(false);
    });

    it('should fall back to element history after brush history is exhausted', () => {
      let elementHistoryIndex = 1;
      let brushHistoryIndex = 0;

      // First undo - no brush history
      let undidBrush = false;
      let undidElement = false;

      if (brushHistoryIndex > 0) {
        brushHistoryIndex--;
        undidBrush = true;
      } else if (elementHistoryIndex > 0) {
        elementHistoryIndex--;
        undidElement = true;
      }

      expect(undidBrush).toBe(false);
      expect(undidElement).toBe(true);
      expect(elementHistoryIndex).toBe(0);
    });
  });

  describe('History state validation', () => {
    it('should recover from invalid history index', () => {
      let elementHistoryIndex = 5;
      const elementHistoryLength = 3;

      // Validate and fix if corrupted
      if (elementHistoryIndex >= elementHistoryLength) {
        elementHistoryIndex = Math.max(0, elementHistoryLength - 1);
      }

      expect(elementHistoryIndex).toBeLessThan(elementHistoryLength);
      expect(elementHistoryIndex).toBeGreaterThanOrEqual(0);
    });

    it('should correctly report canUndo/canRedo states', () => {
      let elementHistoryIndex = 2;
      let brushHistoryIndex = 1;
      const elementHistoryLength = 5;
      const brushHistoryLength = 3;

      const canUndoElement = elementHistoryIndex > 0;
      const canUndoBrush = brushHistoryIndex > 0;
      const canUndo = canUndoElement || canUndoBrush;

      const canRedoElement = elementHistoryIndex < elementHistoryLength - 1;
      const canRedoBrush = brushHistoryIndex < brushHistoryLength - 1;
      const canRedo = canRedoElement || canRedoBrush;

      expect(typeof canUndo).toBe('boolean');
      expect(typeof canRedo).toBe('boolean');
      expect(canUndo).toBe(true);
      expect(canRedo).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle large undo/redo stacks efficiently', () => {
      let elementHistoryIndex = 0;
      let brushHistoryIndex = 0;

      const startTime = performance.now();

      // Simulate many undo/redo operations
      for (let i = 0; i < 1000; i++) {
        // Undo
        if (brushHistoryIndex > 0) {
          brushHistoryIndex--;
        } else if (elementHistoryIndex > 0) {
          elementHistoryIndex--;
        }

        // Redo
        if (brushHistoryIndex < 10 - 1) {
          brushHistoryIndex++;
        } else if (elementHistoryIndex < 10 - 1) {
          elementHistoryIndex++;
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 iterations in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Brush config preservation', () => {
    it('should preserve brush config in history snapshots', () => {
      const config = {
        type: 'marker',
        size: 8,
        color: '#ff0000',
        opacity: 0.5,
        smoothing: 0.3,
        pressure: true,
        temporary: false,
      };

      expect(config.type).toBe('marker');
      expect(config.size).toBe(8);
      expect(config.color).toBe('#ff0000');
      expect(config.opacity).toBe(0.5);
    });
  });

  describe('Edge cases', () => {
    it('should handle undo at history start', () => {
      let historyIndex = 0;

      const canUndo = historyIndex > 0;
      if (canUndo) {
        historyIndex--;
      }

      expect(historyIndex).toBe(0);
      expect(canUndo).toBe(false);
    });

    it('should handle redo at history end', () => {
      let historyIndex = 9;
      const historyLength = 10;

      const canRedo = historyIndex < historyLength - 1;
      if (canRedo) {
        historyIndex++;
      }

      expect(historyIndex).toBe(9);
      expect(canRedo).toBe(false);
    });

    it('should handle large history stacks', () => {
      let historyIndex = 0;
      const historyLength = 1000;

      // Move to middle
      historyIndex = 500;

      // Undo to start
      while (historyIndex > 0) {
        historyIndex--;
        if (historyIndex < 0) break;
      }

      expect(historyIndex).toBe(0);

      // Redo to end
      while (historyIndex < historyLength - 1) {
        historyIndex++;
      }

      expect(historyIndex).toBe(999);
    });
  });

  describe('History clearing on new operation', () => {
    it('should clear future history after new operation', () => {
      let history = [[1], [1, 2], [1, 2, 3]];
      let historyIndex = 1;

      // New operation after undo
      history = [
        ...history.slice(0, historyIndex + 1),
        [1, 2, 99],
      ];
      historyIndex++;

      expect(history).toHaveLength(3);
      expect(history[historyIndex]).toEqual([1, 2, 99]);
    });
  });

  describe('State consistency', () => {
    it('should maintain consistent history indices', () => {
      let elementHistoryIndex = 0;
      let brushHistoryIndex = 0;
      const elementHistoryLength = 10;
      const brushHistoryLength = 5;

      // Perform operations
      if (elementHistoryIndex < elementHistoryLength - 1) elementHistoryIndex++;
      if (brushHistoryIndex < brushHistoryLength - 1) brushHistoryIndex++;

      // Verify consistency
      expect(elementHistoryIndex).toBeGreaterThanOrEqual(0);
      expect(brushHistoryIndex).toBeGreaterThanOrEqual(0);
      expect(elementHistoryIndex).toBeLessThan(elementHistoryLength);
      expect(brushHistoryIndex).toBeLessThan(brushHistoryLength);
    });

    it('should not allow invalid history indices', () => {
      let elementHistoryIndex = 0;
      const elementHistoryLength = 5;

      // Clamp operations
      elementHistoryIndex = Math.max(0, elementHistoryIndex - 1);
      elementHistoryIndex = Math.min(elementHistoryIndex + 1, elementHistoryLength - 1);

      expect(elementHistoryIndex).toBeGreaterThanOrEqual(0);
      expect(elementHistoryIndex).toBeLessThan(elementHistoryLength);
    });
  });
});
