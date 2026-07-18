/**
 * Rulers & Guides Manager
 * Visual measurement and alignment guides
 */

export interface Guide {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number; // pixels
  color?: string;
  label?: string;
}

export class RulersGuidesManager {
  private guides: Map<string, Guide> = new Map();
  private showRulers = true;
  private showGuides = true;
  private rulerContainer: HTMLElement | null = null;

  constructor(private graph: any, private container: HTMLElement) {
    this.initializeRulers();
  }

  /**
   * Initialize ruler display
   */
  private initializeRulers(): void {
    // Create ruler containers
    this.rulerContainer = document.createElement('div');
    this.rulerContainer.className = 'rulers-container';
    this.rulerContainer.style.position = 'relative';

    // Horizontal ruler
    const hRuler = document.createElement('div');
    hRuler.className = 'horizontal-ruler';
    hRuler.style.height = '20px';
    hRuler.style.borderBottom = '1px solid #ccc';
    hRuler.style.display = 'flex';
    hRuler.style.overflow = 'hidden';

    // Vertical ruler
    const vRuler = document.createElement('div');
    vRuler.className = 'vertical-ruler';
    vRuler.style.width = '20px';
    vRuler.style.borderRight = '1px solid #ccc';
    vRuler.style.display = 'flex';
    vRuler.style.flexDirection = 'column';
    vRuler.style.overflow = 'hidden';

    this.rulerContainer.appendChild(hRuler);
    this.rulerContainer.appendChild(vRuler);

    if (this.showRulers) {
      this.container.insertBefore(this.rulerContainer, this.container.firstChild);
    }
  }

  /**
   * Add guide
   */
  addGuide(type: 'horizontal' | 'vertical', position: number, label?: string): string {
    const id = `guide-${Date.now()}`;
    const guide: Guide = {
      id,
      type,
      position,
      color: '#00aaff',
      label,
    };

    this.guides.set(id, guide);
    this.renderGuide(guide);
    return id;
  }

  /**
   * Remove guide
   */
  removeGuide(id: string): boolean {
    if (this.guides.delete(id)) {
      const element = document.getElementById(`guide-${id}`);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      return true;
    }
    return false;
  }

  /**
   * Get all guides
   */
  getGuides(): Guide[] {
    return Array.from(this.guides.values());
  }

  /**
   * Clear all guides
   */
  clearGuides(): void {
    this.guides.forEach((_, id) => this.removeGuide(id));
  }

  /**
   * Toggle rulers visibility
   */
  toggleRulers(): boolean {
    this.showRulers = !this.showRulers;
    if (this.rulerContainer) {
      this.rulerContainer.style.display = this.showRulers ? 'block' : 'none';
    }
    return this.showRulers;
  }

  /**
   * Toggle guides visibility
   */
  toggleGuides(): boolean {
    this.showGuides = !this.showGuides;
    const elements = document.querySelectorAll('[class^="guide-"]');
    elements.forEach((el) => {
      (el as HTMLElement).style.display = this.showGuides ? 'block' : 'none';
    });
    return this.showGuides;
  }

  /**
   * Snap position to guides
   */
  snapToGuide(position: number, threshold: number = 5): number {
    let closest = position;
    let closestDistance = threshold;

    this.guides.forEach((guide) => {
      const distance = Math.abs(position - guide.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = guide.position;
      }
    });

    return closest;
  }

  /**
   * Get guides at position
   */
  getGuidesAtPosition(position: number, threshold: number = 2): Guide[] {
    return this.getGuides().filter((guide) => Math.abs(guide.position - position) <= threshold);
  }

  /**
   * Align selected cells to guide
   */
  alignToGuide(guideId: string): boolean {
    const guide = this.guides.get(guideId);
    if (!guide) return false;

    const cells = this.graph.getSelectionModel().cells || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        const geo = cell.geometry;
        if (guide.type === 'horizontal') {
          geo.y = guide.position;
        } else {
          geo.x = guide.position;
        }
      }
    });

    this.graph.view.refresh();
    return true;
  }

  /**
   * Create guides from selected cells
   */
  createGuidesFromSelection(): void {
    const cells = this.graph.getSelectionModel().cells || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        const geo = cell.geometry;
        // Add vertical guide
        this.addGuide('vertical', geo.x + geo.width / 2, cell.value);
        // Add horizontal guide
        this.addGuide('horizontal', geo.y + geo.height / 2, cell.value);
      }
    });
  }

  /**
   * Render guide on canvas
   */
  private renderGuide(guide: Guide): void {
    if (!this.showGuides) return;

    const line = document.createElement('div');
    line.id = `guide-${guide.id}`;
    line.className = `guide-${guide.type}`;
    line.style.position = 'absolute';
    line.style.backgroundColor = guide.color || '#00aaff';
    line.style.opacity = '0.5';
    line.style.zIndex = '100';
    line.style.cursor = 'move';

    if (guide.type === 'horizontal') {
      line.style.width = '100%';
      line.style.height = '1px';
      line.style.top = `${guide.position}px`;
      line.style.left = '0';
    } else {
      line.style.width = '1px';
      line.style.height = '100%';
      line.style.left = `${guide.position}px`;
      line.style.top = '0';
    }

    if (guide.label) {
      const label = document.createElement('span');
      label.textContent = guide.label || '';
      label.style.fontSize = '10px';
      label.style.color = '#000';
      label.style.backgroundColor = guide.color || '#00aaff';
      label.style.padding = '2px 4px';
      label.style.position = 'absolute';
      line.appendChild(label);
    }

    this.container.appendChild(line);
  }

  /**
   * Export guides as JSON
   */
  exportGuides(): string {
    const guidesArray = Array.from(this.guides.values());
    return JSON.stringify(guidesArray);
  }

  /**
   * Import guides from JSON
   */
  importGuides(jsonData: string): boolean {
    try {
      const guides = JSON.parse(jsonData) as Guide[];
      guides.forEach((guide) => {
        if (guide.id) {
          this.guides.set(guide.id, guide);
          this.renderGuide(guide);
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}
