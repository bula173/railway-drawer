/**
 * @file shapeLibraryManager.test.ts
 * @brief Unit tests for ShapeLibraryManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShapeLibraryManager } from '../shapeLibraryManager';
import { ComposedShape, PrimitiveElement } from '../../types/shapeComposer';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ShapeLibraryManager', () => {
  let manager: ShapeLibraryManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new ShapeLibraryManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Shape CRUD Operations', () => {
    it('should create a new shape', () => {
      const shape = createTestShape('shape1', 'Test Shape');
      const created = manager.createShape(shape);

      expect(created.id).toBe('shape1');
      expect(created.name).toBe('Test Shape');
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('should retrieve a shape by ID', () => {
      const shape = createTestShape('shape1', 'Test Shape');
      manager.createShape(shape);

      const retrieved = manager.getShape('shape1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Test Shape');
    });

    it('should return null for non-existent shape', () => {
      const shape = manager.getShape('nonexistent');
      expect(shape).toBeNull();
    });

    it('should update a shape', () => {
      const shape = createTestShape('shape1', 'Original Name');
      const created = manager.createShape(shape);

      manager.updateShape('shape1', { name: 'Updated Name' });
      const updated = manager.getShape('shape1');

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
    });

    it('should throw error updating non-existent shape', () => {
      expect(() => {
        manager.updateShape('nonexistent', { name: 'New Name' });
      }).toThrow('not found');
    });

    it('should delete a shape', () => {
      const shape = createTestShape('shape1', 'Test Shape');
      manager.createShape(shape);

      expect(manager.getShape('shape1')).not.toBeNull();
      manager.deleteShape('shape1');
      expect(manager.getShape('shape1')).toBeNull();
    });

    it('should throw error deleting non-existent shape', () => {
      expect(() => {
        manager.deleteShape('nonexistent');
      }).toThrow('not found');
    });
  });

  describe('Bulk Operations', () => {
    it('should get all shapes', () => {
      manager.createShape(createTestShape('shape1', 'Shape 1'));
      manager.createShape(createTestShape('shape2', 'Shape 2'));

      const all = manager.getAllShapes();
      expect(all).toHaveLength(2);
    });

    it('should get shapes by group', () => {
      const shape1 = createTestShape('shape1', 'Shape 1');
      shape1.group = 'Infrastructure';
      const shape2 = createTestShape('shape2', 'Shape 2');
      shape2.group = 'Infrastructure';
      const shape3 = createTestShape('shape3', 'Shape 3');
      shape3.group = 'Signals';

      manager.createShape(shape1);
      manager.createShape(shape2);
      manager.createShape(shape3);

      const infrastructure = manager.getShapesByGroup('Infrastructure');
      expect(infrastructure).toHaveLength(2);
    });

    it('should get all unique groups', () => {
      const shape1 = createTestShape('shape1', 'Shape 1');
      shape1.group = 'Infrastructure';
      const shape2 = createTestShape('shape2', 'Shape 2');
      shape2.group = 'Signals';

      manager.createShape(shape1);
      manager.createShape(shape2);

      const groups = manager.getAllGroups();
      expect(groups).toContain('Infrastructure');
      expect(groups).toContain('Signals');
    });

    it('should clear all shapes', () => {
      manager.createShape(createTestShape('shape1', 'Shape 1'));
      manager.createShape(createTestShape('shape2', 'Shape 2'));

      manager.clearAll();
      const all = manager.getAllShapes();
      expect(all).toHaveLength(0);
    });
  });

  describe('Export/Import', () => {
    it('should export library as JSON', () => {
      manager.createShape(createTestShape('shape1', 'Test Shape'));

      const exported = manager.exportLibrary();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBe('1.0');
      expect(parsed.shapes).toHaveLength(1);
      expect(parsed.shapes[0].name).toBe('Test Shape');
    });

    it('should export single shape as JSON', () => {
      manager.createShape(createTestShape('shape1', 'Test Shape'));

      const exported = manager.exportShape('shape1');
      const parsed = JSON.parse(exported);

      expect(parsed.id).toBe('shape1');
      expect(parsed.name).toBe('Test Shape');
    });

    it('should throw error exporting non-existent shape', () => {
      expect(() => {
        manager.exportShape('nonexistent');
      }).toThrow('not found');
    });

    it('should import library in merge mode', () => {
      manager.createShape(createTestShape('shape1', 'Shape 1'));

      const newLibrary = {
        version: '1.0',
        shapes: [createTestShape('shape2', 'Shape 2')],
      };

      manager.importLibrary(JSON.stringify(newLibrary), 'merge');
      const all = manager.getAllShapes();

      expect(all).toHaveLength(2);
    });

    it('should import library in replace mode', () => {
      manager.createShape(createTestShape('shape1', 'Shape 1'));

      const newLibrary = {
        version: '1.0',
        shapes: [createTestShape('shape2', 'Shape 2')],
      };

      manager.importLibrary(JSON.stringify(newLibrary), 'replace');
      const all = manager.getAllShapes();

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('shape2');
    });

    it('should avoid duplicate IDs when merging', () => {
      manager.createShape(createTestShape('shape1', 'Shape 1'));

      const newLibrary = {
        version: '1.0',
        shapes: [createTestShape('shape1', 'Duplicate ID')],
      };

      manager.importLibrary(JSON.stringify(newLibrary), 'merge');
      const all = manager.getAllShapes();

      expect(all).toHaveLength(1);
    });

    it('should import single shape', () => {
      const shape = createTestShape('imported_shape', 'Imported Shape');
      manager.importShape(JSON.stringify(shape));

      const imported = manager.getShape('imported_shape');
      expect(imported?.name).toBe('Imported Shape');
    });

    it('should rename imported shape on ID conflict', () => {
      manager.createShape(createTestShape('shape1', 'Original'));

      const shape = createTestShape('shape1', 'Duplicate');
      manager.importShape(JSON.stringify(shape));

      const all = manager.getAllShapes();
      expect(all).toHaveLength(2);
    });

    it('should reject invalid library JSON', () => {
      expect(() => {
        manager.importLibrary('invalid json');
      }).toThrow();
    });

    it('should reject library with missing shapes array', () => {
      expect(() => {
        manager.importLibrary('{"version": "1.0"}');
      }).toThrow('Invalid library format');
    });
  });

  describe('Validation', () => {
    it('should reject shape with missing ID', () => {
      const shape = createTestShape('shape1', 'Test');
      shape.id = '';

      expect(() => manager.createShape(shape)).toThrow('id');
    });

    it('should reject shape with missing name', () => {
      const shape = createTestShape('shape1', 'Test');
      shape.name = '';

      expect(() => manager.createShape(shape)).toThrow('name');
    });

    it('should reject shape with invalid dimensions', () => {
      const shape = createTestShape('shape1', 'Test');
      shape.width = -10;

      expect(() => manager.createShape(shape)).toThrow('width');
    });

    it('should reject shape with missing elements', () => {
      const shape = createTestShape('shape1', 'Test');
      (shape as any).elements = null;

      expect(() => manager.createShape(shape)).toThrow('elements');
    });
  });

  describe('Persistence', () => {
    it('should persist shapes to localStorage', () => {
      manager.createShape(createTestShape('shape1', 'Test Shape'));

      const stored = localStorage.getItem('railway_drawer_custom_shapes');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.shapes).toHaveLength(1);
    });

    it('should load shapes from localStorage on initialization', () => {
      // Create manager and add shape
      let mgr = new ShapeLibraryManager();
      mgr.createShape(createTestShape('shape1', 'Test Shape'));

      // Create new manager (should load from storage)
      mgr = new ShapeLibraryManager();
      const loaded = mgr.getShape('shape1');

      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('Test Shape');
    });

    it('should handle storage quota exceeded', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        manager.createShape(createTestShape('shape1', 'Test'));
      }).toThrow('Unable to save');

      localStorage.setItem = originalSetItem;
    });
  });
});

// Helper function to create test shape
function createTestShape(id: string, name: string): ComposedShape {
  const circle: PrimitiveElement = {
    id: 'elem1',
    type: 'circle',
    x: 50,
    y: 50,
    circle: { radius: 30 },
    fill: '#ff0000',
  };

  return {
    id,
    name,
    elements: [circle],
    width: 100,
    height: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
