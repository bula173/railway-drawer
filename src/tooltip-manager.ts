/**
 * Tooltip Manager
 * Manage hover tooltips for shapes and edges
 */

export class TooltipManager {
  private tooltips = new Map<string, string>();
  private currentTooltip: HTMLElement | null = null;
  private hideTimeout: NodeJS.Timeout | null = null;

  constructor(private graph: any, private container: HTMLElement) {
    this.setupTooltipHandling();
  }

  /**
   * Add tooltip to cell
   */
  addTooltip(cell: any, text: string): void {
    if (!cell || !text) return;

    this.tooltips.set(cell.id, text);

    // Also store on cell for persistence
    if (!cell.data) {
      cell.data = {};
    }
    cell.data.tooltip = text;
  }

  /**
   * Get tooltip for cell
   */
  getTooltip(cell: any): string | null {
    return this.tooltips.get(cell.id) || cell?.data?.tooltip || null;
  }

  /**
   * Remove tooltip from cell
   */
  removeTooltip(cell: any): void {
    if (!cell) return;

    this.tooltips.delete(cell.id);
    if (cell.data) {
      cell.data.tooltip = null;
    }
  }

  /**
   * Check if cell has tooltip
   */
  hasTooltip(cell: any): boolean {
    return !!this.getTooltip(cell);
  }

  /**
   * Show tooltip at position
   */
  private showTooltip(text: string, x: number, y: number): void {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
    tooltip.style.zIndex = '10001';
    tooltip.style.padding = '8px 12px';
    tooltip.style.backgroundColor = '#333';
    tooltip.style.color = '#fff';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.maxWidth = '300px';
    tooltip.style.wordWrap = 'break-word';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;
  }

  /**
   * Hide current tooltip
   */
  hideTooltip(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.currentTooltip && document.body.contains(this.currentTooltip)) {
      document.body.removeChild(this.currentTooltip);
      this.currentTooltip = null;
    }
  }

  /**
   * Setup tooltip event handling
   */
  private setupTooltipHandling(): void {
    // Listen for mouse move on graph
    const canvas = this.graph.view.canvas;

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const cell = this.graph.getCellAt(e.clientX - this.container.getBoundingClientRect().left, e.clientY - this.container.getBoundingClientRect().top);

      if (cell && this.hasTooltip(cell)) {
        const tooltip = this.getTooltip(cell);
        if (tooltip) {
          this.showTooltip(tooltip, e.clientX, e.clientY);
        }
      } else {
        this.hideTooltip();
      }
    });

    canvas.addEventListener('mouseout', () => {
      this.hideTooltip();
    });

    canvas.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  /**
   * Apply tooltips to multiple cells
   */
  applyTooltipsToSelection(text: string): void {
    const cells = this.graph.getSelectionModel().cells;

    cells.forEach((cell: any) => {
      this.addTooltip(cell, text);
    });
  }

  /**
   * Remove tooltips from selection
   */
  removeTooltipsFromSelection(): void {
    const cells = this.graph.getSelectionModel().cells;

    cells.forEach((cell: any) => {
      this.removeTooltip(cell);
    });
  }

  /**
   * Export tooltips as JSON
   */
  exportTooltips(): Map<string, string> {
    return new Map(this.tooltips);
  }

  /**
   * Import tooltips from map
   */
  importTooltips(tooltips: Map<string, string>): void {
    tooltips.forEach((text, cellId) => {
      const parent = this.graph.getDefaultParent();
      if (parent && parent.children) {
        const cell = parent.children.find((c: any) => c.id === cellId);
        if (cell) {
          this.addTooltip(cell, text);
        }
      }
    });
  }

  /**
   * Clear all tooltips
   */
  clearAll(): void {
    this.hideTooltip();
    this.tooltips.clear();
  }
}
