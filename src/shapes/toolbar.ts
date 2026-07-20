import { Cell, Geometry } from '@maxgraph/core';
import { ShapeRegistry, ShapeConfig } from './registry';
import { getSvgIcon } from '../utils/svg-icons';

export class ShapeToolbar {
  private container: HTMLElement;
  private registry: ShapeRegistry;
  private enabledGroups: Set<string> = new Set();
  private collapsedGroups: Set<string> = new Set();

  constructor(toolbarContainer: HTMLElement, registry: ShapeRegistry) {
    this.container = toolbarContainer;
    this.registry = registry;

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

      const isCollapsed = this.collapsedGroups.has(group);

      const groupHeader = document.createElement('div');
      groupHeader.className = 'shapes-group-header';

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
      groupHeader.addEventListener('click', () => this.toggleGroup(group));

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

  private createShapeItem(shape: ShapeConfig): HTMLElement {
    const prototype = new Cell(shape.label, new Geometry(0, 0, shape.width, shape.height), shape.style as any);
    prototype.setVertex(true);

    const item = document.createElement('div');
    item.className = 'shape-icon-only';
    item.draggable = true;
    item.title = shape.label;

    // Use SVG icon if available, otherwise get from icon system
    const svgContent = shape.svgIcon || getSvgIcon(shape.id);
    item.innerHTML = `<div class="shape-icon-svg">${svgContent}</div>`;

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
