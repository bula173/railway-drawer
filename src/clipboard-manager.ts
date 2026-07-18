/**
 * Clipboard Manager
 * Handle copy/paste with smart positioning and history
 */

import { InsertCellCommand } from './command-history';

export interface ClipboardData {
  cells: any[];
  timestamp: number;
  description?: string;
}

export class ClipboardManager {
  private clipboard: ClipboardData | null = null;
  private pasteOffset = 20; // pixels offset for each paste

  constructor(private graph: any, private history: any) {}

  /**
   * Copy selected cells to clipboard
   */
  copyCells(cells: any[]): boolean {
    if (!cells || cells.length === 0) return false;

    // Serialize cells to data
    const cellsData = cells.map((cell) => ({
      id: cell.id,
      value: cell.value,
      geometry: {
        x: cell.geometry?.x,
        y: cell.geometry?.y,
        width: cell.geometry?.width,
        height: cell.geometry?.height,
      },
      style: { ...cell.style },
      isVertex: cell.isVertex?.(),
      isEdge: cell.isEdge?.(),
    }));

    this.clipboard = {
      cells: cellsData,
      timestamp: Date.now(),
    };

    return true;
  }

  /**
   * Cut selected cells (copy + delete)
   */
  cutCells(cells: any[]): boolean {
    if (!this.copyCells(cells)) return false;

    // Delete the cells
    this.graph.removeCells(cells);
    return true;
  }

  /**
   * Paste clipboard contents at specified position
   */
  pasteCells(x: number, y: number): any[] {
    if (!this.clipboard || this.clipboard.cells.length === 0) {
      return [];
    }

    const pastedCells: any[] = [];
    const idMap = new Map<string, string>(); // Map old IDs to new IDs

    // Create new cells with offset position
    this.clipboard.cells.forEach((cellData) => {
      if (!cellData.isEdge) {
        // Create vertex
        const newCell = this.graph.insertVertex({
          position: [cellData.geometry.x + x, cellData.geometry.y + y],
          size: [cellData.geometry.width, cellData.geometry.height],
          value: cellData.value,
          style: cellData.style,
        });

        idMap.set(cellData.id, newCell.id);
        pastedCells.push(newCell);

        // Add to history
        const command = new InsertCellCommand(newCell, this.graph, this.graph.getDefaultParent());
        this.history.execute(command);
      }
    });

    // Create edges for pasted cells
    this.clipboard.cells.forEach((cellData) => {
      if (cellData.isEdge && cellData.sourceId && cellData.targetId) {
        const sourceId = idMap.get(cellData.sourceId);
        const targetId = idMap.get(cellData.targetId);

        if (sourceId && targetId) {
          const sourceCell = this.graph.getDefaultParent().children?.find((c: any) => c.id === sourceId);
          const targetCell = this.graph.getDefaultParent().children?.find((c: any) => c.id === targetId);

          if (sourceCell && targetCell) {
            const newEdge = this.graph.insertEdge({
              source: sourceCell,
              target: targetCell,
              value: cellData.value,
              style: cellData.style,
            });

            pastedCells.push(newEdge);

            const command = new InsertCellCommand(newEdge, this.graph, this.graph.getDefaultParent());
            this.history.execute(command);
          }
        }
      }
    });

    return pastedCells;
  }

  /**
   * Paste at center of viewport
   */
  pasteAtCenter(): any[] {
    const view = this.graph.view;
    const centerX = (view.container.clientWidth / 2) / view.scale - view.translate.x;
    const centerY = (view.container.clientHeight / 2) / view.scale - view.translate.y;

    return this.pasteCells(centerX, centerY);
  }

  /**
   * Paste with smart offset (next to last pasted location)
   */
  pasteWithSmartOffset(): any[] {
    const x = this.pasteOffset;
    const y = this.pasteOffset;
    this.pasteOffset += 20; // Increase offset for next paste

    return this.pasteCells(x, y);
  }

  /**
   * Check if clipboard has content
   */
  hasContent(): boolean {
    return this.clipboard !== null && this.clipboard.cells.length > 0;
  }

  /**
   * Get clipboard info
   */
  getClipboardInfo(): { count: number; time: Date } | null {
    if (!this.clipboard) return null;

    return {
      count: this.clipboard.cells.length,
      time: new Date(this.clipboard.timestamp),
    };
  }

  /**
   * Clear clipboard
   */
  clearClipboard(): void {
    this.clipboard = null;
    this.pasteOffset = 20;
  }

  /**
   * Get clipboard cells
   */
  getClipboard(): ClipboardData | null {
    return this.clipboard;
  }

  /**
   * Duplicate selected cells with offset
   */
  duplicateCells(cells: any[], offsetX = 20, offsetY = 20): any[] {
    if (!cells || cells.length === 0) return [];

    const duplicated: any[] = [];
    const idMap = new Map<string, string>();

    // Copy vertices
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

        const command = new InsertCellCommand(newCell, this.graph, this.graph.getDefaultParent());
        this.history.execute(command);
      }
    });

    // Copy edges
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

            const command = new InsertCellCommand(newEdge, this.graph, this.graph.getDefaultParent());
            this.history.execute(command);
          }
        }
      }
    });

    return duplicated;
  }

  /**
   * Export clipboard to JSON
   */
  exportToJSON(): string {
    if (!this.clipboard) return '{}';
    return JSON.stringify(this.clipboard);
  }

  /**
   * Import clipboard from JSON
   */
  importFromJSON(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.cells && Array.isArray(data.cells)) {
        this.clipboard = data;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
