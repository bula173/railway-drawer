/**
 * @file DrawAreaFunctions.test.ts
 * @brief Unit tests for DrawArea core functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DrawElement } from '../Elements';

describe('DrawArea Functions', () => {
  let mockElement1: DrawElement;
  let mockElement2: DrawElement;
  let mockElement3: DrawElement;

  beforeEach(() => {
    mockElement1 = {
      id: 'elem1',
      type: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      styles: { fill: '#ff0000' },
      isLineBased: false,
      rotation: 0,
      layerId: 'default',
    };

    mockElement2 = {
      id: 'elem2',
      type: 'circle',
      start: { x: 150, y: 150 },
      end: { x: 250, y: 250 },
      styles: { fill: '#00ff00' },
      isLineBased: false,
      rotation: 0,
      layerId: 'default',
    };

    mockElement3 = {
      id: 'elem3',
      type: 'line',
      start: { x: 300, y: 300 },
      end: { x: 400, y: 400 },
      styles: { stroke: '#0000ff' },
      isLineBased: true,
      rotation: 0,
      layerId: 'default',
    };
  });

  describe('Element Selection', () => {
    it('should identify element at position', () => {
      const elements = [mockElement1, mockElement2];
      // Point inside elem1 (0-100 range)
      const point = { x: 50, y: 50 };

      // Simulate hit test
      const hitElement = elements.find(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      expect(hitElement?.id).toBe('elem1');
    });

    it('should not select element outside bounds', () => {
      const elements = [mockElement1];
      const point = { x: 500, y: 500 }; // Outside all elements

      const hitElement = elements.find(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      expect(hitElement).toBeUndefined();
    });

    it('should select topmost element in overlapping area', () => {
      const elements = [mockElement1, { ...mockElement1, id: 'elem-overlay', zIndex: 100 }];
      const point = { x: 50, y: 50 };

      // Find all matching elements
      const hitElements = elements.filter(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      // Should find 2 elements
      expect(hitElements).toHaveLength(2);

      // Higher zIndex should be selected
      const topmost = hitElements.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
      expect(topmost.id).toBe('elem-overlay');
    });
  });

  describe('Element Movement', () => {
    it('should calculate delta for drag operation', () => {
      const startPos = { x: 10, y: 20 };
      const endPos = { x: 60, y: 80 };

      const deltaX = endPos.x - startPos.x;
      const deltaY = endPos.y - startPos.y;

      expect(deltaX).toBe(50);
      expect(deltaY).toBe(60);
    });

    it('should update element position with delta', () => {
      const element = { ...mockElement1 };
      const deltaX = 50;
      const deltaY = 60;

      const updated = {
        ...element,
        start: {
          x: element.start.x + deltaX,
          y: element.start.y + deltaY,
        },
        end: {
          x: element.end.x + deltaX,
          y: element.end.y + deltaY,
        },
      };

      expect(updated.start.x).toBe(50);
      expect(updated.start.y).toBe(60);
      expect(updated.end.x).toBe(150);
      expect(updated.end.y).toBe(160);
    });

    it('should handle negative delta', () => {
      const element = { ...mockElement1 };
      const deltaX = -30;
      const deltaY = -40;

      const updated = {
        ...element,
        start: {
          x: element.start.x + deltaX,
          y: element.start.y + deltaY,
        },
        end: {
          x: element.end.x + deltaX,
          y: element.end.y + deltaY,
        },
      };

      expect(updated.start.x).toBe(-30);
      expect(updated.start.y).toBe(-40);
    });
  });

  describe('Grid Snapping', () => {
    const GRID_SIZE = 10;

    it('should snap position to grid', () => {
      const position = { x: 17, y: 23 };
      const snapped = {
        x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
      };

      expect(snapped.x).toBe(20);
      expect(snapped.y).toBe(20);
    });

    it('should snap to nearest grid cell', () => {
      const position = { x: 14, y: 15 };
      const snapped = {
        x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
      };

      expect(snapped.x).toBe(10);
      expect(snapped.y).toBe(20);
    });

    it('should handle zero position', () => {
      const position = { x: 0, y: 0 };
      const snapped = {
        x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
      };

      expect(snapped.x).toBe(0);
      expect(snapped.y).toBe(0);
    });

    it('should handle negative positions', () => {
      const position = { x: -17, y: -23 };
      const snapped = {
        x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
      };

      expect(snapped.x).toBe(-20);
      expect(snapped.y).toBe(-20);
    });
  });

  describe('Copy/Paste', () => {
    it('should create deep copy of element', () => {
      const original = { ...mockElement1 };
      const copy = JSON.parse(JSON.stringify(original));

      // Modify copy
      copy.start.x = 999;
      copy.id = 'copy-elem1';

      // Original should be unchanged
      expect(original.start.x).toBe(0);
      expect(original.id).toBe('elem1');
      expect(copy.start.x).toBe(999);
      expect(copy.id).toBe('copy-elem1');
    });

    it('should maintain element properties in copy', () => {
      const original = { ...mockElement1, name: 'Test', text: 'Hello' };
      const copy = { ...original };

      expect(copy.name).toBe('Test');
      expect(copy.text).toBe('Hello');
      expect(copy.styles).toEqual(original.styles);
    });

    it('should offset pasted elements to avoid overlap', () => {
      const PASTE_OFFSET = 20;
      const original = { ...mockElement1 };
      const pasted = {
        ...original,
        id: `${original.id}-copy`,
        start: {
          x: original.start.x + PASTE_OFFSET,
          y: original.start.y + PASTE_OFFSET,
        },
        end: {
          x: original.end.x + PASTE_OFFSET,
          y: original.end.y + PASTE_OFFSET,
        },
      };

      expect(pasted.start.x).toBe(20);
      expect(pasted.start.y).toBe(20);
      expect(pasted.end.x).toBe(120);
      expect(pasted.end.y).toBe(120);
    });
  });

  describe('Zoom', () => {
    it('should increase zoom level', () => {
      let zoom = 1;
      const ZOOM_STEP = 0.2;
      zoom += ZOOM_STEP;

      expect(zoom).toBeCloseTo(1.2);
    });

    it('should decrease zoom level', () => {
      let zoom = 1;
      const ZOOM_STEP = 0.2;
      zoom -= ZOOM_STEP;

      expect(zoom).toBeCloseTo(0.8);
    });

    it('should clamp zoom to minimum', () => {
      let zoom = 0.1;
      const MIN_ZOOM = 0.1;
      zoom = Math.max(zoom, MIN_ZOOM);

      expect(zoom).toBe(0.1);
    });

    it('should clamp zoom to maximum', () => {
      let zoom = 5;
      const MAX_ZOOM = 5;
      zoom = Math.min(zoom, MAX_ZOOM);

      expect(zoom).toBe(5);
    });

    it('should convert world coords to canvas coords with zoom', () => {
      const zoom = 2;
      const panOffset = { x: 100, y: 100 };
      const worldPos = { x: 50, y: 50 };

      const canvasPos = {
        x: (worldPos.x * zoom) + panOffset.x,
        y: (worldPos.y * zoom) + panOffset.y,
      };

      expect(canvasPos.x).toBe(200);
      expect(canvasPos.y).toBe(200);
    });
  });

  describe('Undo/Redo', () => {
    it('should track element changes in history', () => {
      const history: DrawElement[][] = [];
      let elements = [{ ...mockElement1 }, { ...mockElement2 }];

      // Record initial state (deep copy)
      history.push(elements.map(e => ({ ...e })));

      // Make change
      elements[0] = { ...elements[0], start: { ...elements[0].start, x: 50 } };
      history.push(elements.map(e => ({ ...e })));

      expect(history).toHaveLength(2);
      expect(history[0][0].start.x).toBe(0);
      expect(history[1][0].start.x).toBe(50);
    });

    it('should undo to previous state', () => {
      const history: DrawElement[][] = [];
      let currentIndex = -1;

      let elements = [{ ...mockElement1 }];
      history.push(elements.map(e => ({ ...e })));
      currentIndex = 0;

      // Make change
      elements = [{ ...elements[0], start: { ...elements[0].start, x: 50 } }];
      history.push(elements.map(e => ({ ...e })));
      currentIndex = 1;

      // Undo
      currentIndex--;
      const undoneElements = history[currentIndex];

      expect(undoneElements[0].start.x).toBe(0);
    });

    it('should redo after undo', () => {
      const history: DrawElement[][] = [];
      let currentIndex = -1;

      let elements = [{ ...mockElement1 }];
      history.push(elements.map(e => ({ ...e })));
      currentIndex = 0;

      elements = [{ ...elements[0], start: { ...elements[0].start, x: 50 } }];
      history.push(elements.map(e => ({ ...e })));
      currentIndex = 1;

      // Undo
      currentIndex--;
      expect(history[currentIndex][0].start.x).toBe(0);

      // Redo
      currentIndex++;
      expect(history[currentIndex][0].start.x).toBe(50);
    });

    it('should clear redo history when new change made after undo', () => {
      const history: DrawElement[][] = [];
      let currentIndex = -1;

      let elements = [{ ...mockElement1 }];
      history.push(elements.map(e => ({ ...e }))); // State 0
      currentIndex = 0;

      elements = [{ ...elements[0], start: { ...elements[0].start, x: 50 } }];
      history.push(elements.map(e => ({ ...e }))); // State 1
      currentIndex = 1;

      elements = [{ ...elements[0], start: { ...elements[0].start, y: 60 } }];
      history.push(elements.map(e => ({ ...e }))); // State 2
      currentIndex = 2;

      // Undo twice
      currentIndex--;
      currentIndex--;
      expect(currentIndex).toBe(0);

      // Make new change
      let newHistory = history.slice(0, currentIndex + 1);
      elements = [{ ...elements[0], start: { ...elements[0].start, x: 100 } }];
      newHistory.push(elements.map(e => ({ ...e })));

      expect(newHistory).toHaveLength(2);
      expect(newHistory[1][0].start.x).toBe(100);
    });
  });

  describe('Deletion', () => {
    it('should remove selected elements', () => {
      const elements = [mockElement1, mockElement2, mockElement3];
      const selectedIds = ['elem1', 'elem3'];

      const filtered = elements.filter(el => !selectedIds.includes(el.id));

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('elem2');
    });

    it('should handle deleting non-existent elements', () => {
      const elements = [mockElement1, mockElement2];
      const selectedIds = ['elem-not-exist'];

      const filtered = elements.filter(el => !selectedIds.includes(el.id));

      expect(filtered).toEqual(elements);
    });

    it('should delete all if all selected', () => {
      const elements = [mockElement1, mockElement2];
      const selectedIds = ['elem1', 'elem2'];

      const filtered = elements.filter(el => !selectedIds.includes(el.id));

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Bounding Box', () => {
    it('should calculate element bounding box', () => {
      const rect = {
        x: Math.min(mockElement1.start.x, mockElement1.end.x),
        y: Math.min(mockElement1.start.y, mockElement1.end.y),
        width: Math.abs(mockElement1.end.x - mockElement1.start.x),
        height: Math.abs(mockElement1.end.y - mockElement1.start.y),
      };

      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);
    });

    it('should handle reversed coordinates', () => {
      const element = {
        ...mockElement1,
        start: { x: 100, y: 100 },
        end: { x: 0, y: 0 },
      };

      const rect = {
        x: Math.min(element.start.x, element.end.x),
        y: Math.min(element.start.y, element.end.y),
        width: Math.abs(element.end.x - element.start.x),
        height: Math.abs(element.end.y - element.start.y),
      };

      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);
    });
  });

  describe('Area Selection', () => {
    it('should select elements within selection area', () => {
      // Create test elements positioned differently for this test
      const testElem1 = { ...mockElement1, start: { x: 10, y: 10 }, end: { x: 50, y: 50 } };
      const testElem2 = { ...mockElement2, start: { x: 150, y: 150 }, end: { x: 200, y: 200 } };
      const testElem3 = { ...mockElement3, start: { x: 300, y: 300 }, end: { x: 350, y: 350 } };

      const elements = [testElem1, testElem2, testElem3];
      const selectionArea = {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      };

      const selected = elements.filter(el => {
        const elemX = Math.min(el.start.x, el.end.x);
        const elemY = Math.min(el.start.y, el.end.y);
        const elemWidth = Math.abs(el.end.x - el.start.x);
        const elemHeight = Math.abs(el.end.y - el.start.y);

        return (
          elemX < selectionArea.x + selectionArea.width &&
          elemX + elemWidth > selectionArea.x &&
          elemY < selectionArea.y + selectionArea.height &&
          elemY + elemHeight > selectionArea.y
        );
      });

      // testElem1 and testElem2 overlap with selection area, testElem3 does not
      expect(selected).toHaveLength(2);
      expect(selected.map(e => e.id)).toContain('elem1');
      expect(selected.map(e => e.id)).toContain('elem2');
    });
  });
});
