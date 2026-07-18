/**
 * Smart Duplicate Manager
 * Intelligent duplication with pattern detection
 */

export class SmartDuplicateManager {
  constructor(private graph: any, _history?: any) {}

  /**
   * Detect duplication pattern and duplicate accordingly
   */
  smartDuplicate(cells: any[], count: number = 1): any[] {
    if (!cells || cells.length === 0) return [];

    const duplicated: any[] = [];

    for (let i = 0; i < count; i++) {
      const offset = this.calculateOffsetForIteration(i, cells);
      duplicated.push(...this.duplicateWithOffset(cells, offset.x, offset.y));
    }

    return duplicated;
  }

  /**
   * Duplicate in grid pattern
   */
  duplicateInGrid(cells: any[], rows: number, cols: number, spacing: number = 100): any[] {
    if (!cells || cells.length === 0) return [];

    const duplicated: any[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const offsetX = col * spacing;
        const offsetY = row * spacing;
        duplicated.push(...this.duplicateWithOffset(cells, offsetX, offsetY));
      }
    }

    return duplicated;
  }

  /**
   * Duplicate in circular pattern
   */
  duplicateInCircle(cells: any[], count: number, radius: number = 200): any[] {
    if (!cells || cells.length === 0) return [];

    const duplicated: any[] = [];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;

      duplicated.push(...this.duplicateWithOffset(cells, offsetX, offsetY));
    }

    return duplicated;
  }

  /**
   * Duplicate along path (linear with angle)
   */
  duplicateAlongPath(cells: any[], count: number, angleInDegrees: number = 0, spacing: number = 100): any[] {
    if (!cells || cells.length === 0) return [];

    const angleInRadians = (angleInDegrees * Math.PI) / 180;
    const duplicated: any[] = [];

    for (let i = 1; i < count; i++) {
      const offsetX = Math.cos(angleInRadians) * spacing * i;
      const offsetY = Math.sin(angleInRadians) * spacing * i;

      duplicated.push(...this.duplicateWithOffset(cells, offsetX, offsetY));
    }

    return duplicated;
  }

  /**
   * Get suggestions for duplication based on pattern
   */
  getSuggestions(cells: any[]): { type: string; label: string; params: any }[] {
    if (!cells || cells.length === 0) return [];

    const bounds = this.getBounds(cells);
    const suggestions = [];

    // Grid suggestion
    suggestions.push({
      type: 'grid',
      label: 'Duplicate in Grid (3x3)',
      params: { rows: 3, cols: 3, spacing: Math.max(bounds.width, bounds.height) + 20 },
    });

    // Circular suggestion
    suggestions.push({
      type: 'circle',
      label: 'Duplicate in Circle (5 items)',
      params: { count: 5, radius: 250 },
    });

    // Linear suggestion
    suggestions.push({
      type: 'line',
      label: 'Duplicate in Line (5 items)',
      params: { count: 5, angleInDegrees: 0, spacing: bounds.width + 20 },
    });

    // Horizontal line suggestion
    suggestions.push({
      type: 'line',
      label: 'Duplicate Horizontally (5 items)',
      params: { count: 5, angleInDegrees: 0, spacing: bounds.width + 40 },
    });

    // Vertical line suggestion
    suggestions.push({
      type: 'line',
      label: 'Duplicate Vertically (5 items)',
      params: { count: 5, angleInDegrees: 90, spacing: bounds.height + 40 },
    });

    return suggestions;
  }

  /**
   * Duplicate with offset
   */
  private duplicateWithOffset(cells: any[], offsetX: number, offsetY: number): any[] {
    const duplicated: any[] = [];
    const idMap = new Map<string, string>();

    // Duplicate vertices
    cells.forEach((cell) => {
      if (cell.isVertex?.()) {
        const geo = cell.geometry;
        const newCell = this.graph.insertVertex({
          position: [geo.x + offsetX, geo.y + offsetY],
          size: [geo.width, geo.height],
          value: cell.value,
          style: { ...cell.style },
        });

        idMap.set(cell.id, newCell.id);
        duplicated.push(newCell);
      }
    });

    // Duplicate edges
    cells.forEach((cell) => {
      if (cell.isEdge?.()) {
        const sourceId = cell.source?.id;
        const targetId = cell.target?.id;

        if (sourceId && targetId) {
          const newSourceId = idMap.get(sourceId) || sourceId;
          const newTargetId = idMap.get(targetId) || targetId;

          const parent = this.graph.getDefaultParent();
          const sourceCell = parent.children?.find((c: any) => c.id === newSourceId);
          const targetCell = parent.children?.find((c: any) => c.id === newTargetId);

          if (sourceCell && targetCell) {
            const newEdge = this.graph.insertEdge({
              source: sourceCell,
              target: targetCell,
              value: cell.value,
              style: { ...cell.style },
            });

            duplicated.push(newEdge);
          }
        }
      }
    });

    this.graph.view.refresh();
    return duplicated;
  }

  /**
   * Calculate offset for iteration
   */
  private calculateOffsetForIteration(iteration: number, _cells?: any[]): { x: number; y: number } {
    // Default: stagger diagonally
    const offset = 20;
    return {
      x: offset * (iteration + 1),
      y: offset * (iteration + 1),
    };
  }

  /**
   * Get bounding box of cells
   */
  private getBounds(cells: any[]): { x: number; y: number; width: number; height: number } {
    if (cells.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    cells.forEach((cell) => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
        minY = Math.min(minY, cell.geometry.y);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
