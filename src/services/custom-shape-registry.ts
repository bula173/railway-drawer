/**
 * @file custom-shape-registry.ts
 * @brief Manages user-created custom shapes
 * @details
 * Provides persistent storage and CRUD operations for custom shapes.
 * Shapes are stored in localStorage and can be exported/imported.
 */

export interface CustomShape {
  id: string;
  name: string;
  description: string;
  svgPath: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  icon?: string; // Base64 thumbnail
}

const STORAGE_KEY = 'railway-drawer-custom-shapes';

export class CustomShapeRegistryService {
  private shapes: Map<string, CustomShape> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * @brief Create a new custom shape
   */
  create(shape: Omit<CustomShape, 'id' | 'createdAt' | 'updatedAt'>): CustomShape {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newShape: CustomShape = {
      ...shape,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.shapes.set(id, newShape);
    this.saveToStorage();
    return newShape;
  }

  /**
   * @brief Get shape by ID
   */
  getById(id: string): CustomShape | undefined {
    return this.shapes.get(id);
  }

  /**
   * @brief Get all custom shapes
   */
  getAll(): CustomShape[] {
    return Array.from(this.shapes.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * @brief Update existing shape
   */
  update(id: string, updates: Partial<Omit<CustomShape, 'id' | 'createdAt'>>): CustomShape | undefined {
    const shape = this.shapes.get(id);
    if (!shape) return undefined;

    const updated: CustomShape = {
      ...shape,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.shapes.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * @brief Delete shape by ID
   */
  delete(id: string): boolean {
    const deleted = this.shapes.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * @brief Export all shapes as JSON
   */
  exportJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * @brief Import shapes from JSON
   */
  importJson(jsonData: string): number {
    try {
      const shapes = JSON.parse(jsonData) as CustomShape[];
      let count = 0;

      shapes.forEach((shape) => {
        // Use existing ID if provided, otherwise generate new one
        const id = shape.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.shapes.set(id, {
          ...shape,
          id,
          createdAt: shape.createdAt || new Date().toISOString(),
          updatedAt: shape.updatedAt || new Date().toISOString(),
        });
        count++;
      });

      this.saveToStorage();
      return count;
    } catch (error) {
      console.error('[CustomShapeRegistry] Import failed:', error);
      return 0;
    }
  }

  /**
   * @brief Persist shapes to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(this.getAll());
      localStorage.setItem(STORAGE_KEY, data);
      console.log('[CustomShapeRegistry] Saved', this.shapes.size, 'shapes');
    } catch (error) {
      console.error('[CustomShapeRegistry] Save failed:', error);
    }
  }

  /**
   * @brief Load shapes from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const shapes = JSON.parse(data) as CustomShape[];
        shapes.forEach((shape) => {
          this.shapes.set(shape.id, shape);
        });
        console.log('[CustomShapeRegistry] Loaded', this.shapes.size, 'shapes');
      }
    } catch (error) {
      console.error('[CustomShapeRegistry] Load failed:', error);
    }
  }

  /**
   * @brief Clear all custom shapes
   */
  clearAll(): void {
    this.shapes.clear();
    localStorage.removeItem(STORAGE_KEY);
    console.log('[CustomShapeRegistry] Cleared all shapes');
  }
}

export const customShapeRegistry = new CustomShapeRegistryService();
