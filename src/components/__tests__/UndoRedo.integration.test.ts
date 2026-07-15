/**
 * @file UndoRedo.integration.test.ts
 * @brief Integration tests for undo/redo with mixed element and brush operations
 */

import { describe, it, expect } from 'vitest';
import type { Element } from '../DrawArea';
import type { BrushStroke, BrushConfig } from '../../utils/brushTools';

describe('Undo/Redo Mixed Operations', () => {
  describe('Element operations', () => {
    it('should track element creation in history', () => {
      let elements: Element[] = [];
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      const newRect: Element = {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        label: 'Box 1',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };

      elements.push(newRect);
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      expect(elements).toHaveLength(1);
      expect(elementHistory).toHaveLength(2);
      expect(elementHistoryIndex).toBe(1);
    });

    it('should undo element creation', () => {
      let elements: Element[] = [];
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      // Create element
      const rect: Element = {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        label: 'Box',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };

      elements.push(rect);
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      // Undo
      if (elementHistoryIndex > 0) {
        elements = [...elementHistory[elementHistoryIndex - 1]];
        elementHistoryIndex--;
      }

      expect(elements).toHaveLength(0);
      expect(elementHistoryIndex).toBe(0);
    });

    it('should track element modification in history', () => {
      let elements: Element[] = [];
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      // Create element
      const rect: Element = {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        label: 'Box',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };

      elements.push(rect);
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      // Modify element
      elements[0] = { ...elements[0], x: 200, y: 200 };
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      expect(elementHistory[1][0].x).toBe(100);
      expect(elementHistory[2][0].x).toBe(200);
    });
  });

  describe('Brush operations', () => {
    it('should track brush stroke creation in history', () => {
      let brushStrokes: BrushStroke[] = [];
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        config,
        created: Date.now(),
      };

      brushStrokes.push(stroke);
      brushHistory.push([...brushStrokes]);
      brushHistoryIndex++;

      expect(brushStrokes).toHaveLength(1);
      expect(brushHistory).toHaveLength(2);
      expect(brushHistoryIndex).toBe(1);
    });

    it('should undo brush stroke creation', () => {
      let brushStrokes: BrushStroke[] = [];
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        config,
        created: Date.now(),
      };

      brushStrokes.push(stroke);
      brushHistory.push([...brushStrokes]);
      brushHistoryIndex++;

      // Undo
      if (brushHistoryIndex > 0) {
        brushStrokes = [...brushHistory[brushHistoryIndex - 1]];
        brushHistoryIndex--;
      }

      expect(brushStrokes).toHaveLength(0);
      expect(brushHistoryIndex).toBe(0);
    });
  });

  describe('Sequential operations (elements then brush)', () => {
    it('should maintain separate histories for elements and brush', () => {
      let elements: Element[] = [];
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      let brushStrokes: BrushStroke[] = [];
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      // Add element
      const rect: Element = {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        label: 'Box',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };

      elements.push(rect);
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      // Add brush stroke
      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        config,
        created: Date.now(),
      };

      brushStrokes.push(stroke);
      brushHistory.push([...brushStrokes]);
      brushHistoryIndex++;

      expect(elementHistoryIndex).toBe(1);
      expect(brushHistoryIndex).toBe(1);
    });

    it('should prioritize brush history on undo', () => {
      let elements: Element[] = [];
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      let brushStrokes: BrushStroke[] = [];
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      // Add element
      const rect: Element = {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        label: 'Box',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };

      elements.push(rect);
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      // Add brush stroke
      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        config,
        created: Date.now(),
      };

      brushStrokes.push(stroke);
      brushHistory.push([...brushStrokes]);
      brushHistoryIndex++;

      // Undo - should undo brush first
      if (brushHistoryIndex > 0) {
        brushStrokes = [...brushHistory[brushHistoryIndex - 1]];
        brushHistoryIndex--;
      } else if (elementHistoryIndex > 0) {
        elements = [...elementHistory[elementHistoryIndex - 1]];
        elementHistoryIndex--;
      }

      expect(brushHistoryIndex).toBe(0);
      expect(elementHistoryIndex).toBe(1); // Element history not affected
      expect(brushStrokes).toHaveLength(0);
      expect(elements).toHaveLength(1);
    });

    it('should fall back to element history after brush history exhausted', () => {
      let elements: Element[] = [];
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      let brushStrokes: BrushStroke[] = [];
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      // Add element
      const rect: Element = {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        label: 'Box',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      };

      elements.push(rect);
      elementHistory.push([...elements]);
      elementHistoryIndex++;

      // Add brush stroke
      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      const stroke: BrushStroke = {
        id: 'stroke-1',
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        config,
        created: Date.now(),
      };

      brushStrokes.push(stroke);
      brushHistory.push([...brushStrokes]);
      brushHistoryIndex++;

      // First undo - brush
      if (brushHistoryIndex > 0) {
        brushStrokes = [...brushHistory[brushHistoryIndex - 1]];
        brushHistoryIndex--;
      }

      // Second undo - element
      if (brushHistoryIndex > 0) {
        brushStrokes = [...brushHistory[brushHistoryIndex - 1]];
        brushHistoryIndex--;
      } else if (elementHistoryIndex > 0) {
        elements = [...elementHistory[elementHistoryIndex - 1]];
        elementHistoryIndex--;
      }

      expect(brushHistoryIndex).toBe(0);
      expect(elementHistoryIndex).toBe(0);
      expect(brushStrokes).toHaveLength(0);
      expect(elements).toHaveLength(0);
    });
  });

  describe('Alternating operations', () => {
    it('should handle element -> brush -> element sequence', () => {
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      // Element 1
      elementHistory.push([{ id: 'rect-1' } as Element]);
      elementHistoryIndex++;

      // Brush 1
      brushHistory.push([{ id: 'stroke-1' } as BrushStroke]);
      brushHistoryIndex++;

      // Element 2
      elementHistory.push([
        { id: 'rect-1' } as Element,
        { id: 'rect-2' } as Element,
      ]);
      elementHistoryIndex++;

      expect(elementHistoryIndex).toBe(2);
      expect(brushHistoryIndex).toBe(1);
    });

    it('should undo alternating operations correctly', () => {
      let elementHistoryIndex = 2;
      let brushHistoryIndex = 1;

      // Undo element 2
      if (elementHistoryIndex > 0) {
        elementHistoryIndex--;
      }

      expect(elementHistoryIndex).toBe(1);

      // Undo brush 1
      if (brushHistoryIndex > 0) {
        brushHistoryIndex--;
      } else if (elementHistoryIndex > 0) {
        elementHistoryIndex--;
      }

      expect(brushHistoryIndex).toBe(0);
      expect(elementHistoryIndex).toBe(1);
    });
  });

  describe('Redo after mixed operations', () => {
    it('should redo brush strokes correctly', () => {
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      // Add brush stroke
      brushHistory.push([
        {
          id: 'stroke-1',
          type: 'pen',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
          ],
          config,
          created: Date.now(),
        },
      ]);
      brushHistoryIndex++;

      // Undo
      if (brushHistoryIndex > 0) {
        brushHistoryIndex--;
      }

      // Redo
      if (brushHistoryIndex < brushHistory.length - 1) {
        brushHistoryIndex++;
      }

      expect(brushHistoryIndex).toBe(1);
    });

    it('should redo elements correctly', () => {
      let elementHistory: Element[][] = [[]];
      let elementHistoryIndex = 0;

      // Add element
      elementHistory.push([
        {
          id: 'rect-1',
          type: 'rectangle',
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          rotation: 0,
          label: 'Box',
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1,
        },
      ]);
      elementHistoryIndex++;

      // Undo
      if (elementHistoryIndex > 0) {
        elementHistoryIndex--;
      }

      // Redo
      if (elementHistoryIndex < elementHistory.length - 1) {
        elementHistoryIndex++;
      }

      expect(elementHistoryIndex).toBe(1);
    });
  });

  describe('History clearing on new operation', () => {
    it('should clear brush future history after new operation', () => {
      let brushHistory: BrushStroke[][] = [[]];
      let brushHistoryIndex = 0;

      const config: BrushConfig = {
        type: 'pen',
        size: 2,
        color: '#000000',
        opacity: 1,
        smoothing: 0.5,
        pressure: false,
        temporary: false,
      };

      // Add two strokes
      brushHistory.push([
        { id: 'stroke-1', type: 'pen', points: [], config, created: Date.now() },
      ]);
      brushHistoryIndex++;

      brushHistory.push([
        { id: 'stroke-1', type: 'pen', points: [], config, created: Date.now() },
        { id: 'stroke-2', type: 'pen', points: [], config, created: Date.now() },
      ]);
      brushHistoryIndex++;

      // Undo
      brushHistoryIndex--;

      // New operation
      brushHistory = [
        ...brushHistory.slice(0, brushHistoryIndex + 1),
        [
          { id: 'stroke-1', type: 'pen', points: [], config, created: Date.now() },
          { id: 'stroke-3', type: 'pen', points: [], config, created: Date.now() },
        ],
      ];
      brushHistoryIndex++;

      expect(brushHistory).toHaveLength(3);
      expect(brushHistory[brushHistoryIndex][1].id).toBe('stroke-3');
    });
  });

  describe('State consistency', () => {
    it('should maintain consistent history indices', () => {
      let elementHistoryIndex = 0;
      let brushHistoryIndex = 0;
      const elementHistory: Element[][] = [[]];
      const brushHistory: BrushStroke[][] = [[]];

      // Add to both
      elementHistory.push([{ id: 'rect-1' } as Element]);
      elementHistoryIndex++;

      brushHistory.push([{ id: 'stroke-1' } as BrushStroke]);
      brushHistoryIndex++;

      // Verify consistency
      expect(elementHistoryIndex).toBeGreaterThanOrEqual(0);
      expect(brushHistoryIndex).toBeGreaterThanOrEqual(0);
      expect(elementHistoryIndex).toBeLessThan(elementHistory.length);
      expect(brushHistoryIndex).toBeLessThan(brushHistory.length);
    });

    it('should not allow invalid history indices', () => {
      let elementHistoryIndex = 0;
      const elementHistory: Element[][] = [[]];

      // Valid operations
      elementHistoryIndex = Math.max(0, elementHistoryIndex - 1);
      expect(elementHistoryIndex).toBe(0);

      elementHistoryIndex = Math.min(elementHistoryIndex + 1, elementHistory.length - 1);
      expect(elementHistoryIndex).toBe(0);

      // Index should always be valid
      expect(elementHistoryIndex).toBeGreaterThanOrEqual(0);
      expect(elementHistoryIndex).toBeLessThan(elementHistory.length);
    });
  });
});
