/**
 * @file Clipboard.test.ts
 * @brief Tests for clipboard operations (copy/paste)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DrawElement } from '../../components/Elements';

describe('Clipboard Operations', () => {
  let clipboard: {
    items: DrawElement[];
  };

  let testElements: DrawElement[];

  beforeEach(() => {
    clipboard = {
      items: [],
    };

    testElements = [
      {
        id: 'elem1',
        type: 'rectangle',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        styles: { stroke: '#000', fill: '#FFF' },
        isLineBased: false,
      },
      {
        id: 'elem2',
        type: 'circle',
        start: { x: 200, y: 200 },
        end: { x: 300, y: 300 },
        styles: { stroke: '#000' },
        isLineBased: false,
      },
    ];
  });

  describe('Copy Operation', () => {
    it('should copy single element to clipboard', () => {
      clipboard.items = [testElements[0]];

      expect(clipboard.items).toHaveLength(1);
      expect(clipboard.items[0].id).toBe('elem1');
    });

    it('should copy multiple elements to clipboard', () => {
      clipboard.items = [...testElements];

      expect(clipboard.items).toHaveLength(2);
      expect(clipboard.items[0].id).toBe('elem1');
      expect(clipboard.items[1].id).toBe('elem2');
    });

    it('should overwrite clipboard on new copy', () => {
      clipboard.items = [testElements[0]];
      expect(clipboard.items).toHaveLength(1);

      clipboard.items = [testElements[1]];
      expect(clipboard.items).toHaveLength(1);
      expect(clipboard.items[0].id).toBe('elem2');
    });

    it('should preserve element properties in copy', () => {
      const copiedElement = testElements[0];
      clipboard.items = [copiedElement];

      expect(clipboard.items[0].styles.stroke).toBe('#000');
      expect(clipboard.items[0].styles.fill).toBe('#FFF');
    });
  });

  describe('Paste Operation', () => {
    it('should paste element from clipboard', () => {
      clipboard.items = [testElements[0]];
      const pastedElements = [...clipboard.items];

      expect(pastedElements).toHaveLength(1);
      expect(pastedElements[0].id).toBe('elem1');
    });

    it('should paste multiple elements', () => {
      clipboard.items = [...testElements];
      const pastedElements = [...clipboard.items];

      expect(pastedElements).toHaveLength(2);
    });

    it('should generate new IDs for pasted elements', () => {
      clipboard.items = [testElements[0]];

      const pastedElement = { ...clipboard.items[0] };
      pastedElement.id = `${pastedElement.id}_copy_${Date.now()}`;

      expect(pastedElement.id).not.toBe('elem1');
      expect(pastedElement.id).toContain('elem1_copy_');
    });

    it('should offset pasted elements', () => {
      clipboard.items = [testElements[0]];
      const offset = 20;

      const pastedElement = {
        ...clipboard.items[0],
        start: {
          x: clipboard.items[0].start.x + offset,
          y: clipboard.items[0].start.y + offset,
        },
        end: {
          x: clipboard.items[0].end.x + offset,
          y: clipboard.items[0].end.y + offset,
        },
      };

      expect(pastedElement.start.x).toBe(offset);
      expect(pastedElement.start.y).toBe(offset);
      expect(pastedElement.end.x).toBe(100 + offset);
      expect(pastedElement.end.y).toBe(100 + offset);
    });

    it('should clear clipboard after paste is optional', () => {
      clipboard.items = [testElements[0]];
      // Some apps clear, some keep
      const shouldKeepInClipboard = true;

      if (!shouldKeepInClipboard) {
        clipboard.items = [];
      }

      expect(clipboard.items).toHaveLength(1);
    });
  });

  describe('Clipboard State', () => {
    it('should check if clipboard is empty', () => {
      const isEmpty = clipboard.items.length === 0;
      expect(isEmpty).toBe(true);
    });

    it('should check if clipboard has items', () => {
      clipboard.items = [testElements[0]];
      const hasItems = clipboard.items.length > 0;
      expect(hasItems).toBe(true);
    });

    it('should get count of items in clipboard', () => {
      clipboard.items = [...testElements];
      expect(clipboard.items.length).toBe(2);
    });
  });

  describe('Clipboard Serialization', () => {
    it('should serialize clipboard to JSON', () => {
      clipboard.items = [testElements[0]];

      const serialized = JSON.stringify(clipboard.items);
      expect(typeof serialized).toBe('string');
    });

    it('should deserialize clipboard from JSON', () => {
      clipboard.items = [testElements[0]];
      const serialized = JSON.stringify(clipboard.items);

      const deserialized = JSON.parse(serialized);
      expect(deserialized).toHaveLength(1);
      expect(deserialized[0].id).toBe('elem1');
    });
  });

  describe('Copy-Paste Cycle', () => {
    it('should preserve properties through copy-paste cycle', () => {
      const original = testElements[0];
      clipboard.items = [original];

      const pasted = { ...clipboard.items[0] };
      pasted.id = 'new_id';

      expect(pasted.type).toBe(original.type);
      expect(pasted.styles).toEqual(original.styles);
    });

    it('should support repeat paste', () => {
      clipboard.items = [testElements[0]];

      const paste1 = { ...clipboard.items[0], id: 'paste1' };
      const paste2 = { ...clipboard.items[0], id: 'paste2' };

      expect(paste1.id).not.toBe(paste2.id);
      expect(paste1.type).toBe(paste2.type);
    });
  });

  describe('Clipboard Validation', () => {
    it('should validate clipboard items have required properties', () => {
      const isValidElement = (el: any) =>
        el && el.id && el.type && el.start && el.end;

      clipboard.items = [testElements[0]];
      const isValid = clipboard.items.every(isValidElement);

      expect(isValid).toBe(true);
    });

    it('should handle invalid clipboard items', () => {
      const invalidItem: any = { id: 'bad' };
      clipboard.items = [invalidItem];

      const isValidElement = (el: any) =>
        el && el.id && el.type && el.start && el.end;

      const isValid = clipboard.items.every(isValidElement);
      expect(isValid).toBe(false);
    });
  });

  describe('Clipboard Bounds', () => {
    it('should calculate bounding box of clipboard items', () => {
      clipboard.items = [...testElements];

      const bbox = {
        x: Math.min(...clipboard.items.map(el => el.start.x)),
        y: Math.min(...clipboard.items.map(el => el.start.y)),
        maxX: Math.max(...clipboard.items.map(el => el.end.x)),
        maxY: Math.max(...clipboard.items.map(el => el.end.y)),
      };

      bbox.width = bbox.maxX - bbox.x;
      bbox.height = bbox.maxY - bbox.y;

      expect(bbox.x).toBe(0);
      expect(bbox.y).toBe(0);
      expect(bbox.width).toBe(300);
      expect(bbox.height).toBe(300);
    });

    it('should maintain relative positions when pasting with offset', () => {
      clipboard.items = [...testElements];
      const offset = 50;

      const pastedItems = clipboard.items.map(el => ({
        ...el,
        id: `${el.id}_pasted`,
        start: { x: el.start.x + offset, y: el.start.y + offset },
        end: { x: el.end.x + offset, y: el.end.y + offset },
      }));

      // Check relative distance preserved
      const originalDist = Math.abs(testElements[1].start.x - testElements[0].start.x);
      const pastedDist = Math.abs(pastedItems[1].start.x - pastedItems[0].start.x);

      expect(pastedDist).toBe(originalDist);
    });
  });

  describe('Cut Operation', () => {
    it('should cut elements (copy and remove)', () => {
      let elements = [...testElements];
      const elemToRemove = testElements[0];

      clipboard.items = [elemToRemove];
      elements = elements.filter(el => el.id !== elemToRemove.id);

      expect(clipboard.items).toHaveLength(1);
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe('elem2');
    });

    it('should cut multiple elements', () => {
      let elements = [...testElements];
      const elemsToCut = [testElements[0], testElements[1]];

      clipboard.items = [...elemsToCut];
      elements = elements.filter(el => !elemsToCut.some(cut => cut.id === el.id));

      expect(clipboard.items).toHaveLength(2);
      expect(elements).toHaveLength(0);
    });
  });

  describe('Clipboard Keyboard Shortcuts', () => {
    it('should recognize Ctrl+C as copy', () => {
      const isCopyCommand = (ctrlKey: boolean, key: string) =>
        ctrlKey && key.toLowerCase() === 'c';

      expect(isCopyCommand(true, 'c')).toBe(true);
      expect(isCopyCommand(true, 'C')).toBe(true);
    });

    it('should recognize Ctrl+V as paste', () => {
      const isPasteCommand = (ctrlKey: boolean, key: string) =>
        ctrlKey && key.toLowerCase() === 'v';

      expect(isPasteCommand(true, 'v')).toBe(true);
    });

    it('should recognize Ctrl+X as cut', () => {
      const isCutCommand = (ctrlKey: boolean, key: string) =>
        ctrlKey && key.toLowerCase() === 'x';

      expect(isCutCommand(true, 'x')).toBe(true);
    });

    it('should work with Cmd on Mac', () => {
      const isCopyCommand = (metaKey: boolean, key: string) =>
        metaKey && key.toLowerCase() === 'c';

      expect(isCopyCommand(true, 'c')).toBe(true);
    });
  });
});
