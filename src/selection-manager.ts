/**
 * Selection Manager
 * Handles multi-select, marquee selection, and selection state
 */

export class SelectionManager {
  private selectedCells: Map<string, any> = new Map();
  private listeners: Array<(cells: any[]) => void> = [];
  private isMarqueeActive = false;
  private marqueeStart: [number, number] | null = null;
  private marqueeElement: HTMLDivElement | null = null;

  constructor(private graph: any) {}

  selectCell(cell: any, multiSelect: boolean = false): void {
    if (!cell) {
      if (!multiSelect) this.clearSelection();
      return;
    }

    if (multiSelect) {
      // Toggle selection if already selected
      if (this.selectedCells.has(cell.id)) {
        this.selectedCells.delete(cell.id);
      } else {
        this.selectedCells.set(cell.id, cell);
      }
    } else {
      // Single select mode: clear and select only this cell
      this.clearSelection();
      this.selectedCells.set(cell.id, cell);
    }

    this.notifyListeners();
  }

  selectCells(cells: any[]): void {
    this.clearSelection();
    cells.forEach((cell) => {
      this.selectedCells.set(cell.id, cell);
    });
    this.notifyListeners();
  }

  toggleCell(cell: any): void {
    this.selectCell(cell, true);
  }

  clearSelection(): void {
    this.selectedCells.clear();
    this.notifyListeners();
  }

  getSelectedCells(): any[] {
    return Array.from(this.selectedCells.values());
  }

  isSelected(cell: any): boolean {
    return this.selectedCells.has(cell.id);
  }

  getSelectionCount(): number {
    return this.selectedCells.size;
  }

  startMarquee(x: number, y: number, _container: HTMLElement): void {
    this.isMarqueeActive = true;
    this.marqueeStart = [x, y];

    // Create marquee element
    this.marqueeElement = document.createElement('div');
    this.marqueeElement.style.position = 'fixed';
    this.marqueeElement.style.border = '2px dotted #0066cc';
    this.marqueeElement.style.backgroundColor = 'rgba(0, 102, 204, 0.1)';
    this.marqueeElement.style.pointerEvents = 'none';
    this.marqueeElement.style.zIndex = '999';
    this.marqueeElement.style.display = 'none';

    document.body.appendChild(this.marqueeElement);
  }

  updateMarquee(x: number, y: number): void {
    if (!this.isMarqueeActive || !this.marqueeStart || !this.marqueeElement) return;

    const [startX, startY] = this.marqueeStart;
    const minX = Math.min(startX, x);
    const minY = Math.min(startY, y);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);

    this.marqueeElement.style.left = minX + 'px';
    this.marqueeElement.style.top = minY + 'px';
    this.marqueeElement.style.width = width + 'px';
    this.marqueeElement.style.height = height + 'px';
    this.marqueeElement.style.display = 'block';
  }

  endMarquee(container: HTMLElement): any[] {
    if (!this.isMarqueeActive || !this.marqueeStart || !this.marqueeElement) {
      this.clearMarquee();
      return [];
    }

    const rect = container.getBoundingClientRect();
    const marqueeRect = this.marqueeElement.getBoundingClientRect();

    // Convert to container-relative coordinates
    const marqueeX = marqueeRect.left - rect.left;
    const marqueeY = marqueeRect.top - rect.top;
    const marqueeWidth = marqueeRect.width;
    const marqueeHeight = marqueeRect.height;

    // Find all cells within marquee
    const cellsInMarquee: any[] = [];
    const parent = this.graph.getDefaultParent();

    if (parent && parent.children) {
      parent.children.forEach((cell: any) => {
        if (cell.isVertex && cell.isVertex() && cell.geometry) {
          const geo = cell.geometry;
          const scale = this.graph.view.scale;
          const translate = this.graph.view.translate;

          const cellX = (geo.x + translate.x) * scale;
          const cellY = (geo.y + translate.y) * scale;
          const cellWidth = geo.width * scale;
          const cellHeight = geo.height * scale;

          // Check if cell is within marquee
          if (
            cellX < marqueeX + marqueeWidth &&
            cellX + cellWidth > marqueeX &&
            cellY < marqueeY + marqueeHeight &&
            cellY + cellHeight > marqueeY
          ) {
            cellsInMarquee.push(cell);
          }
        }
      });
    }

    this.clearMarquee();
    this.selectCells(cellsInMarquee);
    return cellsInMarquee;
  }

  clearMarquee(): void {
    this.isMarqueeActive = false;
    this.marqueeStart = null;
    if (this.marqueeElement && document.body.contains(this.marqueeElement)) {
      document.body.removeChild(this.marqueeElement);
    }
    this.marqueeElement = null;
  }

  isMarqueeSelecting(): boolean {
    return this.isMarqueeActive;
  }

  addListener(callback: (cells: any[]) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (cells: any[]) => void): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  private notifyListeners(): void {
    const cells = this.getSelectedCells();
    this.listeners.forEach((listener) => listener(cells));
  }
}
