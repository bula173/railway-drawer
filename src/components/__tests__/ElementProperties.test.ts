/**
 * @file ElementProperties.test.ts
 * @brief Tests for element properties and transformations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DrawElement } from '../Elements';

describe('Element Properties', () => {
  let element: DrawElement;

  beforeEach(() => {
    element = {
      id: 'elem1',
      type: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      styles: {},
      isLineBased: false,
    };
  });

  describe('Position Properties', () => {
    it('should read element position', () => {
      expect(element.start.x).toBe(0);
      expect(element.start.y).toBe(0);
    });

    it('should update element position', () => {
      element.start.x = 50;
      element.start.y = 50;

      expect(element.start.x).toBe(50);
      expect(element.start.y).toBe(50);
    });

    it('should move element keeping size', () => {
      const width = Math.abs(element.end.x - element.start.x);
      const height = Math.abs(element.end.y - element.start.y);

      element.start.x = 100;
      element.start.y = 100;
      element.end.x = element.start.x + width;
      element.end.y = element.start.y + height;

      expect(Math.abs(element.end.x - element.start.x)).toBe(width);
      expect(Math.abs(element.end.y - element.start.y)).toBe(height);
    });
  });

  describe('Size Properties', () => {
    it('should calculate element width', () => {
      const width = Math.abs(element.end.x - element.start.x);
      expect(width).toBe(100);
    });

    it('should calculate element height', () => {
      const height = Math.abs(element.end.y - element.start.y);
      expect(height).toBe(100);
    });

    it('should resize element', () => {
      element.end.x = 200;
      element.end.y = 200;

      const width = Math.abs(element.end.x - element.start.x);
      const height = Math.abs(element.end.y - element.start.y);

      expect(width).toBe(200);
      expect(height).toBe(200);
    });
  });

  describe('Rotation Properties', () => {
    it('should initialize with no rotation', () => {
      expect(element.rotation).toBeUndefined();
    });

    it('should set rotation angle', () => {
      element.rotation = 45;
      expect(element.rotation).toBe(45);
    });

    it('should normalize rotation to 0-360', () => {
      element.rotation = 450;
      const normalized = element.rotation % 360;
      expect(normalized).toBe(90);
    });

    it('should handle negative rotation', () => {
      element.rotation = -90;
      const normalized = (element.rotation % 360 + 360) % 360;
      expect(normalized).toBe(270);
    });
  });

  describe('Z-Index (Layer) Properties', () => {
    it('should initialize with default zIndex', () => {
      expect(element.zIndex).toBeUndefined();
    });

    it('should set zIndex', () => {
      element.zIndex = 10;
      expect(element.zIndex).toBe(10);
    });

    it('should compare zIndex for layering', () => {
      const elem1 = { ...element, zIndex: 5 };
      const elem2 = { ...element, zIndex: 10 };

      const isElem2OnTop = (elem2.zIndex || 0) > (elem1.zIndex || 0);
      expect(isElem2OnTop).toBe(true);
    });

    it('should increment zIndex', () => {
      element.zIndex = 5;
      element.zIndex++;

      expect(element.zIndex).toBe(6);
    });
  });

  describe('Style Properties', () => {
    it('should initialize with empty styles', () => {
      expect(element.styles).toEqual({});
    });

    it('should set stroke color', () => {
      element.styles.stroke = '#000000';
      expect(element.styles.stroke).toBe('#000000');
    });

    it('should set fill color', () => {
      element.styles.fill = '#FF0000';
      expect(element.styles.fill).toBe('#FF0000');
    });

    it('should set stroke width', () => {
      element.styles.strokeWidth = 2;
      expect(element.styles.strokeWidth).toBe(2);
    });

    it('should set multiple styles', () => {
      element.styles = {
        stroke: '#000000',
        fill: '#FF0000',
        strokeWidth: 2,
      };

      expect(element.styles.stroke).toBe('#000000');
      expect(element.styles.fill).toBe('#FF0000');
      expect(element.styles.strokeWidth).toBe(2);
    });
  });

  describe('Element Type', () => {
    it('should read element type', () => {
      expect(element.type).toBe('rectangle');
    });

    it('should support different element types', () => {
      const types = ['rectangle', 'circle', 'line', 'text'];
      types.forEach(type => {
        element.type = type as any;
        expect(element.type).toBe(type);
      });
    });
  });

  describe('Line-Based Property', () => {
    it('should identify non-line elements', () => {
      element.type = 'rectangle';
      expect(element.isLineBased).toBe(false);
    });

    it('should identify line elements', () => {
      element.type = 'line';
      element.isLineBased = true;
      expect(element.isLineBased).toBe(true);
    });
  });

  describe('Element ID', () => {
    it('should read element ID', () => {
      expect(element.id).toBe('elem1');
    });

    it('should support UUID format IDs', () => {
      element.id = '550e8400-e29b-41d4-a716-446655440000';
      expect(element.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should support numeric IDs', () => {
      element.id = '12345';
      expect(element.id).toBe('12345');
    });
  });

  describe('Label/Text Properties', () => {
    it('should set element label', () => {
      element.label = 'Point A';
      expect(element.label).toBe('Point A');
    });

    it('should update label', () => {
      element.label = 'Original';
      element.label = 'Updated';
      expect(element.label).toBe('Updated');
    });

    it('should handle empty label', () => {
      element.label = '';
      expect(element.label).toBe('');
    });
  });

  describe('Bounding Box Calculation', () => {
    it('should calculate bounding box for normal element', () => {
      const bbox = {
        x: Math.min(element.start.x, element.end.x),
        y: Math.min(element.start.y, element.end.y),
        width: Math.abs(element.end.x - element.start.x),
        height: Math.abs(element.end.y - element.start.y),
      };

      expect(bbox.x).toBe(0);
      expect(bbox.y).toBe(0);
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(100);
    });

    it('should calculate bounding box for flipped element', () => {
      element.end.x = -100;

      const bbox = {
        x: Math.min(element.start.x, element.end.x),
        y: Math.min(element.start.y, element.end.y),
        width: Math.abs(element.end.x - element.start.x),
        height: Math.abs(element.end.y - element.start.y),
      };

      expect(bbox.x).toBe(-100);
      expect(bbox.width).toBe(100);
    });
  });

  describe('Element Bounds Containment', () => {
    it('should check if point is in element bounds', () => {
      const point = { x: 50, y: 50 };
      const minX = Math.min(element.start.x, element.end.x);
      const maxX = Math.max(element.start.x, element.end.x);
      const minY = Math.min(element.start.y, element.end.y);
      const maxY = Math.max(element.start.y, element.end.y);

      const isInside = point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      expect(isInside).toBe(true);
    });

    it('should check if point is outside bounds', () => {
      const point = { x: 150, y: 150 };
      const minX = Math.min(element.start.x, element.end.x);
      const maxX = Math.max(element.start.x, element.end.x);
      const minY = Math.min(element.start.y, element.end.y);
      const maxY = Math.max(element.start.y, element.end.y);

      const isInside = point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      expect(isInside).toBe(false);
    });

    it('should check if point is on boundary', () => {
      const point = { x: 0, y: 0 };
      const minX = Math.min(element.start.x, element.end.x);
      const maxX = Math.max(element.start.x, element.end.x);
      const minY = Math.min(element.start.y, element.end.y);
      const maxY = Math.max(element.start.y, element.end.y);

      const isInside = point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      expect(isInside).toBe(true);
    });
  });

  describe('Element Cloning', () => {
    it('should clone element with same properties', () => {
      const cloned = JSON.parse(JSON.stringify(element));

      expect(cloned.id).toBe(element.id);
      expect(cloned.type).toBe(element.type);
      expect(cloned.start).toEqual(element.start);
      expect(cloned.end).toEqual(element.end);
    });

    it('should clone and modify independently', () => {
      const cloned = JSON.parse(JSON.stringify(element));
      cloned.id = 'elem2';
      cloned.start.x = 50;

      expect(element.id).toBe('elem1');
      expect(element.start.x).toBe(0);
      expect(cloned.id).toBe('elem2');
      expect(cloned.start.x).toBe(50);
    });
  });

  describe('Element Metadata', () => {
    it('should support additional metadata properties', () => {
      (element as any).metadata = {
        created: new Date(),
        author: 'user',
      };

      expect((element as any).metadata.author).toBe('user');
    });

    it('should preserve metadata during updates', () => {
      (element as any).metadata = { created: '2025-01-01' };
      element.label = 'Updated';

      expect((element as any).metadata.created).toBe('2025-01-01');
    });
  });

  describe('Element Validation', () => {
    it('should validate element has required properties', () => {
      const isValid =
        element.id &&
        element.type &&
        element.start &&
        element.end &&
        element.styles !== undefined;

      expect(isValid).toBe(true);
    });

    it('should detect invalid element without ID', () => {
      const invalidElement = { ...element };
      delete (invalidElement as any).id;

      const isValid = (invalidElement as any).id && invalidElement.type;
      expect(isValid).toBeFalsy();
    });

    it('should validate position coordinates are numbers', () => {
      const isValid =
        typeof element.start.x === 'number' &&
        typeof element.start.y === 'number' &&
        typeof element.end.x === 'number' &&
        typeof element.end.y === 'number';

      expect(isValid).toBe(true);
    });
  });
});
