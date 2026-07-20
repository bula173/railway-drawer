import { Cell, Geometry } from '@maxgraph/core';
import { ShapeRegistry, ShapeConfig } from './registry';

export class ShapeToolbar {
  private container: HTMLElement;
  private registry: ShapeRegistry;
  private enabledGroups: Set<string> = new Set();

  constructor(toolbarContainer: HTMLElement, registry: ShapeRegistry) {
    this.container = toolbarContainer;
    this.registry = registry;

    // Enable all groups by default
    this.registry.getGroups().forEach((group) => {
      this.enabledGroups.add(group);
    });

    this.buildToolbar();
  }

  setEnabledGroups(groups: Set<string>) {
    this.enabledGroups = groups;
    this.buildToolbar();
  }

  private buildToolbar(): void {
    this.container.innerHTML = '';

    const groups = this.registry.getGroups();
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

      const groupTitle = document.createElement('div');
      groupTitle.className = 'shapes-group-title';
      groupTitle.textContent = group;
      this.container.appendChild(groupTitle);

      const shapes = this.registry.getShapesByGroup(group);
      const shapeGroup = document.createElement('div');
      shapeGroup.className = 'shapes-group-icons';

      shapes.forEach((shape: ShapeConfig) => {
        const item = this.createShapeItem(shape);
        shapeGroup.appendChild(item);
      });

      this.container.appendChild(shapeGroup);
    });
  }

  private createShapeItem(shape: ShapeConfig): HTMLElement {
    const prototype = new Cell(shape.label, new Geometry(0, 0, shape.width, shape.height), shape.style as any);
    prototype.setVertex(true);

    const item = document.createElement('div');
    item.className = 'shape-icon-only';
    item.draggable = true;
    item.title = shape.label;

    item.innerHTML = shape.icon;

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
