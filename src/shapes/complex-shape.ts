/**
 * @file complex-shape.ts
 * @brief Base class for complex/composite shapes
 * @details
 * Allows shapes to be composed of multiple editable components
 * Each component can have its own style, geometry, and properties
 * Used for importing complex draw.io shapes
 */

import { RectangleShape } from '@maxgraph/core';

export interface ShapeComponent {
  id: string;
  type: 'vertex' | 'edge' | 'text';
  style?: string;
  value?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  editable?: boolean;
}

/**
 * @class ComplexShape
 * @brief Base class for shapes composed of multiple editable components
 */
export class ComplexShape extends RectangleShape {
  /** Shape components that can be edited */
  protected components: Map<string, ShapeComponent> = new Map();

  /** Track which components are visible */
  protected visibleComponents: Set<string> = new Set();

  constructor() {
    super();
  }

  /**
   * Register a component in the shape
   */
  registerComponent(component: ShapeComponent): void {
    this.components.set(component.id, component);
    this.visibleComponents.add(component.id);
  }

  /**
   * Update component style
   */
  updateComponent(id: string, updates: Partial<ShapeComponent>): void {
    const component = this.components.get(id);
    if (component) {
      Object.assign(component, updates);
    }
  }

  /**
   * Get component by ID
   */
  getComponent(id: string): ShapeComponent | undefined {
    return this.components.get(id);
  }

  /**
   * Get all components
   */
  getAllComponents(): ShapeComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Toggle component visibility
   */
  toggleComponent(id: string): void {
    if (this.visibleComponents.has(id)) {
      this.visibleComponents.delete(id);
    } else {
      this.visibleComponents.add(id);
    }
  }

  /**
   * Export component configuration
   */
  exportComponents(): Record<string, ShapeComponent> {
    const result: Record<string, ShapeComponent> = {};
    this.components.forEach((comp, id) => {
      result[id] = { ...comp };
    });
    return result;
  }

  /**
   * Import component configuration
   */
  importComponents(config: Record<string, ShapeComponent>): void {
    this.components.clear();
    this.visibleComponents.clear();

    Object.entries(config).forEach(([id, component]) => {
      this.registerComponent({ ...component, id });
    });
  }

  /**
   * Render composite shape
   * Override in subclasses to implement specific rendering
   */
  paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Default: draw simple rectangle with component info
    c.setFillColor('#f5f5f5');
    c.setStrokeColor('#404040');
    c.rect(x, y, w, h);
    c.fillAndStroke();

    // Draw component labels for editing
    let textY = y + 15;
    c.setFontSize(10);
    c.setFillColor('#666');

    this.components.forEach((comp) => {
      if (this.visibleComponents.has(comp.id)) {
        c.drawString(`${comp.id}: ${comp.type}`, x + 5, textY);
        textY += 12;
      }
    });
  }

  /**
   * Get editable properties for Properties Panel
   */
  getEditableProperties(): Record<string, any> {
    return {
      components: this.exportComponents(),
    };
  }

  /**
   * Serialize shape state
   */
  serialize(): string {
    return JSON.stringify({
      components: this.exportComponents(),
      visible: Array.from(this.visibleComponents),
    });
  }

  /**
   * Deserialize shape state
   */
  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.importComponents(parsed.components);
      this.visibleComponents = new Set(parsed.visible || []);
    } catch (error) {
      console.error('[ComplexShape] Failed to deserialize:', error);
    }
  }
}
