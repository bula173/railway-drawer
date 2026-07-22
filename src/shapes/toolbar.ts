import { Cell, Geometry } from '@maxgraph/core';
import { ShapeRegistry, ShapeConfig } from './registry';

export class ShapeToolbar {
  private container: HTMLElement;
  private registry: ShapeRegistry;
  private enabledGroups: Set<string> = new Set();
  private collapsedGroups: Set<string> = new Set();
  private groupOrder: string[] = [];
  private draggedGroup: string | null = null;

  constructor(toolbarContainer: HTMLElement, registry: ShapeRegistry) {
    this.container = toolbarContainer;
    this.registry = registry;

    // Load custom group order from localStorage or use default
    this.loadGroupOrder();

    // If no custom order yet, set default order (railway groups at bottom)
    if (this.groupOrder.length === 0) {
      this.setDefaultGroupOrder();
    }

    // Enable all groups by default
    this.registry.getGroups().forEach((group) => {
      this.enabledGroups.add(group);
      // Collapse all groups except "Basic"
      if (group !== 'Basic') {
        this.collapsedGroups.add(group);
      }
    });

    this.buildToolbar();
  }

  setEnabledGroups(groups: Set<string>) {
    this.enabledGroups = groups;
    this.buildToolbar();
  }

  private toggleGroup(groupName: string) {
    if (this.collapsedGroups.has(groupName)) {
      this.collapsedGroups.delete(groupName);
    } else {
      this.collapsedGroups.add(groupName);
    }
    this.buildToolbar();
  }

  private buildToolbar(): void {
    this.container.innerHTML = '';

    // Use custom group order
    const groups = this.getOrderedGroups();
    let isFirstGroup = true;

    groups.forEach((group: string) => {
      // Skip disabled groups
      if (!this.enabledGroups.has(group)) {
        return;
      }

      if (!isFirstGroup) {
        this.addSeparator();
      }
      isFirstGroup = false;

      const isCollapsed = this.collapsedGroups.has(group);

      const groupHeader = document.createElement('div');
      groupHeader.className = 'shapes-group-header';
      groupHeader.draggable = true;
      groupHeader.dataset.group = group;
      groupHeader.style.cursor = 'grab';

      const groupTitle = document.createElement('div');
      groupTitle.className = 'shapes-group-title';

      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'shapes-group-toggle';
      toggleIcon.textContent = isCollapsed ? '▶' : '▼';
      toggleIcon.style.marginRight = '4px';
      toggleIcon.style.cursor = 'pointer';

      groupTitle.appendChild(toggleIcon);
      groupTitle.appendChild(document.createTextNode(group));

      groupHeader.appendChild(groupTitle);

      // Handle toggle click
      groupHeader.addEventListener('click', (e) => {
        // Only toggle if clicking on the header area, not dragging
        if ((e.target as HTMLElement).closest('.shapes-group-toggle')) {
          this.toggleGroup(group);
        }
      });

      // Handle drag events for reordering
      this.attachDragHandlers(groupHeader, group);

      this.container.appendChild(groupHeader);

      if (!isCollapsed) {
        const shapes = this.registry.getShapesByGroup(group);
        const shapeGroup = document.createElement('div');
        shapeGroup.className = 'shapes-group-icons';

        shapes.forEach((shape: ShapeConfig) => {
          const item = this.createShapeItem(shape);
          shapeGroup.appendChild(item);
        });

        this.container.appendChild(shapeGroup);
      }
    });
  }

  private getOrderedGroups(): string[] {
    const allGroups = this.registry.getGroups();

    // If custom order exists and contains all groups, use it
    if (this.groupOrder.length === allGroups.length && allGroups.every(g => this.groupOrder.includes(g))) {
      return this.groupOrder;
    }

    // Otherwise return default order
    return allGroups;
  }

  private attachDragHandlers(groupHeader: HTMLElement, groupName: string): void {
    groupHeader.addEventListener('dragstart', (e) => {
      this.draggedGroup = groupName;
      (e as DragEvent).dataTransfer!.effectAllowed = 'move';
      groupHeader.style.opacity = '0.5';
    });

    groupHeader.addEventListener('dragend', () => {
      groupHeader.style.opacity = '1';
      this.draggedGroup = null;
    });

    groupHeader.addEventListener('dragover', (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'move';
      groupHeader.style.borderTop = '2px solid #0066cc';
    });

    groupHeader.addEventListener('dragleave', () => {
      groupHeader.style.borderTop = 'none';
    });

    groupHeader.addEventListener('drop', (e) => {
      e.preventDefault();
      groupHeader.style.borderTop = 'none';

      if (this.draggedGroup && this.draggedGroup !== groupName) {
        this.reorderGroups(this.draggedGroup, groupName);
      }
    });
  }

  private reorderGroups(fromGroup: string, toGroup: string): void {
    const ordered = this.getOrderedGroups();
    const fromIndex = ordered.indexOf(fromGroup);
    const toIndex = ordered.indexOf(toGroup);

    if (fromIndex !== -1 && toIndex !== -1) {
      // Swap groups
      [ordered[fromIndex], ordered[toIndex]] = [ordered[toIndex], ordered[fromIndex]];
      this.groupOrder = ordered;
      this.saveGroupOrder();
      this.buildToolbar();
    }
  }

  private loadGroupOrder(): void {
    const stored = localStorage.getItem('shapeToolbarGroupOrder');
    if (stored) {
      try {
        this.groupOrder = JSON.parse(stored);
      } catch {
        this.groupOrder = [];
      }
    }
  }

  private saveGroupOrder(): void {
    localStorage.setItem('shapeToolbarGroupOrder', JSON.stringify(this.groupOrder));
  }

  private setDefaultGroupOrder(): void {
    const allGroups = this.registry.getGroups();
    const railwayGroups = ['Railway', 'Track Circuit', 'Rolling Stock', 'Signaling', 'Infrastructure'];
    const genericGroups = allGroups.filter((g) => !railwayGroups.includes(g));

    // Place generic groups first, then railway groups
    this.groupOrder = [...genericGroups, ...railwayGroups.filter((g) => allGroups.includes(g))];
    this.saveGroupOrder();
  }

  private createShapeItem(shape: ShapeConfig): HTMLElement {
    const prototype = new Cell(shape.label, new Geometry(0, 0, shape.width, shape.height), shape.style as any);
    prototype.setVertex(true);

    const item = document.createElement('div');
    item.className = 'shape-icon-only';
    item.draggable = true;
    item.title = shape.label;

    // Display icon - either SVG string (for svg type) or emoji (for vertex type)
    item.innerHTML = `<div class="shape-icon-svg">${shape.icon}</div>`;

    // Drag event - store shape data
    item.addEventListener('dragstart', (evt) => {
      (evt as DragEvent).dataTransfer!.effectAllowed = 'copy';
      (evt as DragEvent).dataTransfer!.setData('application/x-shape-json', JSON.stringify(shape));
    });

    return item;
  }

  private addSeparator(): void {
    const hr = document.createElement('hr');
    hr.style.maxHeight = '0';
    hr.style.minWidth = '100%';
    hr.style.margin = '4px 0';
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid #e0e0e0';
    this.container.appendChild(hr);
  }
}
