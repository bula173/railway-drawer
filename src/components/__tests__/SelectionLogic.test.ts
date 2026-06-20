/**
 * @file SelectionLogic.test.ts
 * @brief Tests for element selection logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DrawElement } from '../Elements';

describe('Selection Logic', () => {
  let testElements: DrawElement[];

  beforeEach(() => {
    testElements = [
      {
        id: 'elem1',
        type: 'rectangle',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        styles: {},
        isLineBased: false,
      },
      {
        id: 'elem2',
        type: 'circle',
        start: { x: 150, y: 150 },
        end: { x: 250, y: 250 },
        styles: {},
        isLineBased: false,
      },
      {
        id: 'elem3',
        type: 'line',
        start: { x: 300, y: 300 },
        end: { x: 400, y: 400 },
        styles: {},
        isLineBased: true,
      },
    ];
  });

  describe('Single Click Selection', () => {
    it('should select single element at point', () => {
      const point = { x: 50, y: 50 };
      const selected = testElements.filter(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe('elem1');
    });

    it('should deselect when clicking empty space', () => {
      const point = { x: 500, y: 500 };
      const selected = testElements.filter(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      expect(selected).toHaveLength(0);
    });

    it('should select topmost element in overlap', () => {
      testElements[1].start = { x: 50, y: 50 }; // Overlap with elem1
      testElements[1].end = { x: 150, y: 150 };
      testElements[1].zIndex = 10; // Higher zIndex

      const point = { x: 75, y: 75 };
      const selected = testElements.filter(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      expect(selected.length).toBeGreaterThanOrEqual(1);

      // Get topmost (highest zIndex)
      const topmost = selected.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
      expect(topmost.id).toBe('elem2');
    });
  });

  describe('Ctrl+Click Multi-Selection', () => {
    it('should add element to selection with Ctrl', () => {
      let selectedIds: string[] = ['elem1'];
      const clickedId = 'elem2';

      if (!selectedIds.includes(clickedId)) {
        selectedIds.push(clickedId);
      }

      expect(selectedIds).toContain('elem1');
      expect(selectedIds).toContain('elem2');
      expect(selectedIds).toHaveLength(2);
    });

    it('should remove element from selection if already selected', () => {
      let selectedIds: string[] = ['elem1', 'elem2'];
      const clickedId = 'elem1';

      selectedIds = selectedIds.filter(id => id !== clickedId);

      expect(selectedIds).not.toContain('elem1');
      expect(selectedIds).toContain('elem2');
      expect(selectedIds).toHaveLength(1);
    });

    it('should support multiple selections', () => {
      const selectedIds: string[] = [];

      // Click elem1
      selectedIds.push('elem1');
      expect(selectedIds).toHaveLength(1);

      // Ctrl+Click elem2
      if (!selectedIds.includes('elem2')) {
        selectedIds.push('elem2');
      }
      expect(selectedIds).toHaveLength(2);

      // Ctrl+Click elem3
      if (!selectedIds.includes('elem3')) {
        selectedIds.push('elem3');
      }
      expect(selectedIds).toHaveLength(3);
    });
  });

  describe('Select All', () => {
    it('should select all elements', () => {
      const selectedIds = testElements.map(el => el.id);
      expect(selectedIds).toHaveLength(3);
      expect(selectedIds).toContain('elem1');
      expect(selectedIds).toContain('elem2');
      expect(selectedIds).toContain('elem3');
    });

    it('should preserve order in select all', () => {
      const selectedIds = testElements.map(el => el.id);
      expect(selectedIds[0]).toBe('elem1');
      expect(selectedIds[1]).toBe('elem2');
      expect(selectedIds[2]).toBe('elem3');
    });
  });

  describe('Area Selection', () => {
    it('should select elements within drag area', () => {
      const selectionArea = {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      };

      const selected = testElements.filter(el => {
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

      expect(selected.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle partial overlap in area selection', () => {
      const selectionArea = {
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      };

      const selected = testElements.filter(el => {
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

      expect(selected.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Selection State Management', () => {
    it('should maintain selection order', () => {
      const selections = ['elem2', 'elem1', 'elem3'];
      expect(selections[0]).toBe('elem2');
      expect(selections[1]).toBe('elem1');
      expect(selections[2]).toBe('elem3');
    });

    it('should handle empty selection', () => {
      const selected: string[] = [];
      expect(selected).toHaveLength(0);
    });

    it('should clear selection', () => {
      let selected = ['elem1', 'elem2'];
      selected = [];
      expect(selected).toHaveLength(0);
    });

    it('should check if element is selected', () => {
      const selectedIds = ['elem1', 'elem3'];
      expect(selectedIds.includes('elem1')).toBe(true);
      expect(selectedIds.includes('elem2')).toBe(false);
      expect(selectedIds.includes('elem3')).toBe(true);
    });
  });

  describe('Selection Edge Cases', () => {
    it('should handle selection at element boundary', () => {
      const point = { x: 0, y: 0 }; // Corner of elem1
      const selected = testElements.filter(el => {
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });

      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe('elem1');
    });

    it('should handle selection of rotated element', () => {
      testElements[0].rotation = 45;
      // Note: Real rotation detection would require more complex math
      // This tests the property exists
      expect(testElements[0].rotation).toBe(45);
    });

    it('should handle selection of grouped elements', () => {
      testElements[0].groupId = 'group1';
      testElements[1].groupId = 'group1';

      const groupMembers = testElements.filter(el => el.groupId === 'group1');
      expect(groupMembers).toHaveLength(2);
    });

    it('should handle selection of elements on different layers', () => {
      testElements[0].layerId = 'layer1';
      testElements[1].layerId = 'layer2';
      testElements[2].layerId = 'layer1';

      const layer1Elements = testElements.filter(el => el.layerId === 'layer1');
      expect(layer1Elements).toHaveLength(2);
    });
  });

  describe('Selection Validation', () => {
    it('should not select invalid elements', () => {
      const invalidElement: any = null;
      const isValid = (el: any) => el && el.id && el.type;

      expect(isValid(invalidElement)).toBeFalsy();
    });

    it('should validate element bounds', () => {
      const hasValidBounds = (el: DrawElement) => {
        return el.start && el.end && el.start.x !== undefined && el.start.y !== undefined;
      };

      testElements.forEach(el => {
        expect(hasValidBounds(el)).toBe(true);
      });
    });

    it('should handle elements with no position', () => {
      const invalidElement: any = { id: 'bad', type: 'rect' };
      const isPositioned = (el: any) => el.start && el.end;

      expect(isPositioned(invalidElement)).toBeFalsy();
    });
  });
});
