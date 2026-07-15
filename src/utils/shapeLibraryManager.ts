/**
 * @file shapeLibraryManager.ts
 * @brief Manages persistence and CRUD operations for custom shapes
 *
 * Handles localStorage storage, import/export, shape lifecycle management
 */

import { logger } from './logger';
import type { ComposedShape, ShapeLibrary, ComposerValidationResult } from '../types';

const STORAGE_KEY = 'railway_drawer_custom_shapes';
const LIBRARY_VERSION = '1.0';

/**
 * Manages custom shape library storage and operations
 */
export class ShapeLibraryManager {
  private library: ShapeLibrary;

  constructor() {
    this.library = this.loadFromStorage();
  }

  /**
   * Load library from localStorage or return empty library
   */
  private loadFromStorage(): ShapeLibrary {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        logger.debug('ShapeLibraryManager', 'No existing library in storage, creating new');
        return this.createEmptyLibrary();
      }

      const parsed = JSON.parse(stored) as ShapeLibrary;
      logger.debug('ShapeLibraryManager', 'Loaded library from storage', {
        shapeCount: parsed.shapes.length,
      });
      return parsed;
    } catch (error) {
      logger.error('ShapeLibraryManager', 'Failed to load library from storage', { error });
      return this.createEmptyLibrary();
    }
  }

  /**
   * Save library to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.library));
      logger.debug('ShapeLibraryManager', 'Saved library to storage', {
        shapeCount: this.library.shapes.length,
      });
    } catch (error) {
      logger.error('ShapeLibraryManager', 'Failed to save library to storage', { error });
      throw new Error('Unable to save shapes library (storage quota may be exceeded)');
    }
  }

  /**
   * Create an empty library structure
   */
  private createEmptyLibrary(): ShapeLibrary {
    return {
      version: LIBRARY_VERSION,
      shapes: [],
      metadata: {
        createdBy: 'Railway Drawer',
        exportedAt: Date.now(),
      },
    };
  }

  /**
   * Create a new shape in library
   */
  createShape(shape: ComposedShape): ComposedShape {
    const validation = this.validateShape(shape);
    if (!validation.isValid) {
      const errors = validation.errors.join(', ');
      throw new Error(`Cannot create shape: ${errors}`);
    }

    const now = Date.now();
    const newShape: ComposedShape = {
      ...shape,
      createdAt: now,
      updatedAt: now,
    };

    this.library.shapes.push(newShape);
    this.saveToStorage();

    logger.debug('ShapeLibraryManager', 'Created new shape', {
      id: newShape.id,
      name: newShape.name,
      elementCount: newShape.elements.length,
    });

    return newShape;
  }

  /**
   * Update existing shape
   */
  updateShape(id: string, updates: Partial<ComposedShape>): ComposedShape {
    const shape = this.library.shapes.find(s => s.id === id);
    if (!shape) {
      throw new Error(`Shape with id "${id}" not found`);
    }

    const updated: ComposedShape = {
      ...shape,
      ...updates,
      id: shape.id,                  // Keep original ID
      createdAt: shape.createdAt,    // Keep original creation time
      updatedAt: Date.now(),
    };

    const validation = this.validateShape(updated);
    if (!validation.isValid) {
      throw new Error(`Cannot update shape: ${validation.errors.join(', ')}`);
    }

    const index = this.library.shapes.indexOf(shape);
    this.library.shapes[index] = updated;
    this.saveToStorage();

    logger.debug('ShapeLibraryManager', 'Updated shape', {
      id: updated.id,
      name: updated.name,
    });

    return updated;
  }

  /**
   * Delete shape by ID
   */
  deleteShape(id: string): void {
    const index = this.library.shapes.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error(`Shape with id "${id}" not found`);
    }

    const deleted = this.library.shapes[index];
    this.library.shapes.splice(index, 1);
    this.saveToStorage();

    logger.debug('ShapeLibraryManager', 'Deleted shape', {
      id: deleted.id,
      name: deleted.name,
    });
  }

  /**
   * Get shape by ID
   */
  getShape(id: string): ComposedShape | null {
    return this.library.shapes.find(s => s.id === id) || null;
  }

  /**
   * Get all shapes
   */
  getAllShapes(): ComposedShape[] {
    return [...this.library.shapes];
  }

  /**
   * Get shapes by group
   */
  getShapesByGroup(group: string): ComposedShape[] {
    return this.library.shapes.filter(s => s.group === group);
  }

  /**
   * Get all unique groups
   */
  getAllGroups(): string[] {
    const groups = new Set(this.library.shapes.map(s => s.group || 'Custom'));
    return Array.from(groups);
  }

  /**
   * Clear all shapes
   */
  clearAll(): void {
    this.library.shapes = [];
    this.saveToStorage();
    logger.debug('ShapeLibraryManager', 'Cleared all shapes');
  }

  /**
   * Export entire library as JSON string
   */
  exportLibrary(): string {
    const exported: ShapeLibrary = {
      version: this.library.version,
      shapes: this.library.shapes,
      metadata: {
        ...this.library.metadata,
        exportedAt: Date.now(),
      },
    };
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Export single shape as JSON string
   */
  exportShape(id: string): string {
    const shape = this.getShape(id);
    if (!shape) {
      throw new Error(`Shape with id "${id}" not found`);
    }
    return JSON.stringify(shape, null, 2);
  }

  /**
   * Import library from JSON string
   * Merges with existing shapes (doesn't replace)
   */
  importLibrary(jsonString: string, mode: 'merge' | 'replace' = 'merge'): ShapeLibrary {
    try {
      const imported = JSON.parse(jsonString) as ShapeLibrary;

      // Validate imported library
      if (!imported.shapes || !Array.isArray(imported.shapes)) {
        throw new Error('Invalid library format: missing shapes array');
      }

      // Validate each shape
      for (const shape of imported.shapes) {
        const validation = this.validateShape(shape);
        if (!validation.isValid) {
          throw new Error(`Invalid shape "${shape.name}": ${validation.errors.join(', ')}`);
        }
      }

      if (mode === 'replace') {
        this.library.shapes = imported.shapes;
      } else {
        // Merge: avoid duplicates by ID
        const existingIds = new Set(this.library.shapes.map(s => s.id));
        for (const shape of imported.shapes) {
          if (!existingIds.has(shape.id)) {
            this.library.shapes.push(shape);
          }
        }
      }

      this.library.metadata = {
        ...this.library.metadata,
        ...imported.metadata,
      };

      this.saveToStorage();

      logger.debug('ShapeLibraryManager', `Imported library (${mode} mode)`, {
        shapesImported: imported.shapes.length,
        totalShapes: this.library.shapes.length,
      });

      return this.library;
    } catch (error) {
      logger.error('ShapeLibraryManager', 'Failed to import library', { error });
      throw error;
    }
  }

  /**
   * Import single shape
   */
  importShape(jsonString: string): ComposedShape {
    try {
      const shape = JSON.parse(jsonString) as ComposedShape;

      const validation = this.validateShape(shape);
      if (!validation.isValid) {
        throw new Error(`Invalid shape: ${validation.errors.join(', ')}`);
      }

      // Check for ID conflict
      if (this.getShape(shape.id)) {
        shape.id = `${shape.id}_${Date.now()}`;
        logger.debug('ShapeLibraryManager', 'Renamed imported shape to avoid ID conflict', {
          newId: shape.id,
        });
      }

      return this.createShape(shape);
    } catch (error) {
      logger.error('ShapeLibraryManager', 'Failed to import shape', { error });
      throw error;
    }
  }

  /**
   * Validate shape structure and content
   */
  private validateShape(shape: ComposedShape): ComposerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!shape.id || typeof shape.id !== 'string') {
      errors.push('Missing or invalid id');
    }
    if (!shape.name || typeof shape.name !== 'string') {
      errors.push('Missing or invalid name');
    }
    if (!Array.isArray(shape.elements)) {
      errors.push('Missing or invalid elements array');
    }
    if (typeof shape.width !== 'number' || shape.width <= 0) {
      errors.push('Invalid width (must be positive number)');
    }
    if (typeof shape.height !== 'number' || shape.height <= 0) {
      errors.push('Invalid height (must be positive number)');
    }

    // Warn if no elements
    if (Array.isArray(shape.elements) && shape.elements.length === 0) {
      warnings.push('Shape has no elements');
    }

    // Warn if too many elements
    if (Array.isArray(shape.elements) && shape.elements.length > 100) {
      warnings.push(`Shape has ${shape.elements.length} elements (may affect performance)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export library to file
   */
  downloadLibraryFile(filename: string = 'railway_shapes.json'): void {
    const content = this.exportLibrary();
    this.downloadFile(content, filename, 'application/json');
    logger.debug('ShapeLibraryManager', 'Downloaded library file', { filename });
  }

  /**
   * Export shape to file
   */
  downloadShapeFile(id: string, filename?: string): void {
    const shape = this.getShape(id);
    if (!shape) {
      throw new Error(`Shape with id "${id}" not found`);
    }

    const content = this.exportShape(id);
    const defaultFilename = `${shape.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    this.downloadFile(content, filename || defaultFilename, 'application/json');
  }

  /**
   * Helper to trigger file download
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const shapeLibraryManager = new ShapeLibraryManager();
