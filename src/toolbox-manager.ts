/**
 * Toolbox Manager
 * Manage shape toolbox with drag-drop, keyboard shortcuts, and recent shapes
 */

export interface ToolboxShape {
  name: string;
  label: string;
  category: string;
}

export class ToolboxManager {
  private recentShapes: ToolboxShape[] = [];
  private readonly maxRecentShapes = 5;

  constructor(private graph: any) {}

  /**
   * Add shape to recent shapes history
   */
  addToRecent(shape: ToolboxShape): void {
    // Remove if already exists
    this.recentShapes = this.recentShapes.filter((s) => s.name !== shape.name);

    // Add to front
    this.recentShapes.unshift(shape);

    // Keep only max recent
    if (this.recentShapes.length > this.maxRecentShapes) {
      this.recentShapes.pop();
    }
  }

  /**
   * Get recent shapes
   */
  getRecent(): ToolboxShape[] {
    return [...this.recentShapes];
  }

  /**
   * Clear recent shapes history
   */
  clearRecent(): void {
    this.recentShapes = [];
  }

  /**
   * Create vertex from toolbox shape
   */
  createShape(shapeName: string, x: number, y: number, label?: string): any {
    const cell = this.graph.insertVertex({
      position: [x, y],
      size: [80, 60],
      value: label || shapeName,
      style: { shape: shapeName },
    });

    return cell;
  }

  /**
   * Create shape at center of viewport
   */
  createShapeAtCenter(shapeName: string, label?: string): any {
    const view = this.graph.view;
    const centerX = view.container.clientWidth / 2 - 40; // Half size
    const centerY = view.container.clientHeight / 2 - 30;

    // Adjust for scroll/zoom
    const offset = view.getOrigin();
    const x = (centerX - offset.x) / view.scale;
    const y = (centerY - offset.y) / view.scale;

    return this.createShape(shapeName, x, y, label);
  }

  /**
   * Get common shapes grouped by category
   */
  getCommonShapes(): Map<string, ToolboxShape[]> {
    const commonShapes = new Map<string, ToolboxShape[]>();

    const basicShapes: ToolboxShape[] = [
      { name: 'rectangle', label: 'Rectangle', category: 'Basic' },
      { name: 'ellipse', label: 'Circle', category: 'Basic' },
      { name: 'rhombus', label: 'Diamond', category: 'Basic' },
      { name: 'triangle', label: 'Triangle', category: 'Basic' },
    ];

    const flowchartShapes: ToolboxShape[] = [
      { name: 'cylinder', label: 'Database', category: 'Flowchart' },
      { name: 'cloud', label: 'Cloud', category: 'Flowchart' },
      { name: 'hexagon', label: 'Hexagon', category: 'Flowchart' },
    ];

    commonShapes.set('Basic', basicShapes);
    commonShapes.set('Flowchart', flowchartShapes);

    return commonShapes;
  }

  /**
   * Batch create shapes in grid pattern
   */
  createShapeGrid(
    shapeName: string,
    cols: number,
    rows: number,
    startX: number,
    startY: number,
    spacing: number = 100
  ): any[] {
    const cells: any[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing;
        const y = startY + row * spacing;
        const cell = this.createShape(shapeName, x, y);
        cells.push(cell);
      }
    }

    return cells;
  }

  /**
   * Create connector template
   */
  createConnectorTemplate(): any {
    const parent = this.graph.getDefaultParent();
    if (!parent.children || parent.children.length < 2) {
      return null;
    }

    const source = parent.children.find((c: any) => c.isVertex?.());
    const target = parent.children.find((c: any, i: number) => c.isVertex?.() && parent.children.indexOf(source) !== i);

    if (!source || !target) return null;

    const edge = this.graph.insertEdge({
      source,
      target,
      value: 'Connection',
    });

    return edge;
  }

  /**
   * Export recent shapes as JSON
   */
  exportRecent(): string {
    return JSON.stringify(this.recentShapes);
  }

  /**
   * Import recent shapes from JSON
   */
  importRecent(jsonData: string): boolean {
    try {
      const shapes = JSON.parse(jsonData);
      if (Array.isArray(shapes)) {
        this.recentShapes = shapes.slice(0, this.maxRecentShapes);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
