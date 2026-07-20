export interface ShapeConfig {
  id: string;
  label: string;
  icon: string;
  group: string;
  width: number;
  height: number;
  style: any;
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
}

export const shapeRegistry = new ShapeRegistry();
