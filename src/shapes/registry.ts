/**
 * Shape types:
 * - 'vertex': Native maxGraph shape extending Shape class (RectangleShape, EllipseShape, etc.)
 *   Rendered directly on canvas with custom paint logic
 *   Icon: scaled version of the vertex shape
 *
 * - 'svg': Pure SVG definition rendered via maxGraph image shape
 *   Rendered as image element with SVG data URL
 *   Icon: raw SVG string scaled for toolbar
 */
export type ShapeType = 'vertex' | 'svg';

export interface ShapeConfig {
  id: string;
  label: string;
  type: ShapeType;
  icon: string; // Either emoji (vertex) or SVG string (svg)
  group: string;
  width: number;
  height: number;
  style: any; // maxGraph style object
}

export class ShapeRegistry {
  private shapes: Map<string, ShapeConfig> = new Map();

  register(shape: ShapeConfig): void {
    this.shapes.set(shape.id, shape);
  }

  getShape(id: string): ShapeConfig | undefined {
    return this.shapes.get(id);
  }

  getAllShapes(): ShapeConfig[] {
    return Array.from(this.shapes.values());
  }

  getShapesByGroup(group: string): ShapeConfig[] {
    return Array.from(this.shapes.values()).filter((s) => s.group === group);
  }

  getGroups(): string[] {
    const groups = new Set(Array.from(this.shapes.values()).map((s) => s.group));
    return Array.from(groups);
  }

  getShapesByType(type: ShapeType): ShapeConfig[] {
    return Array.from(this.shapes.values()).filter((s) => s.type === type);
  }
}

export const shapeRegistry = new ShapeRegistry();
