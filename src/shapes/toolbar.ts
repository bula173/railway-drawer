import { Cell, Geometry } from '@maxgraph/core';
import { ShapeRegistry, ShapeConfig } from './registry';

export class ShapeToolbar {
  private container: HTMLElement;
  private registry: ShapeRegistry;

  constructor(toolbarContainer: HTMLElement, registry: ShapeRegistry) {
    this.container = toolbarContainer;
    this.registry = registry;
    this.buildToolbar();
  }

  private buildToolbar(): void {
    const groups = this.registry.getGroups();

    groups.forEach((group: string, index: number) => {
      if (index > 0) {
        this.addSeparator();
      }

      const groupTitle = document.createElement('div');
      groupTitle.style.fontSize = '11px';
      groupTitle.style.fontWeight = '600';
      groupTitle.style.color = '#666';
      groupTitle.style.padding = '8px 8px 4px';
      groupTitle.style.textTransform = 'uppercase';
      groupTitle.style.letterSpacing = '0.5px';
      groupTitle.textContent = group;
      this.container.appendChild(groupTitle);

      const shapes = this.registry.getShapesByGroup(group);
      const shapeGrid = document.createElement('div');
      shapeGrid.style.display = 'grid';
      shapeGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      shapeGrid.style.gap = '6px';
      shapeGrid.style.padding = '0 8px 8px';

      shapes.forEach((shape: ShapeConfig) => {
        const item = this.createShapeItem(shape);
        shapeGrid.appendChild(item);
      });

      this.container.appendChild(shapeGrid);
    });
  }

  private createShapeItem(shape: ShapeConfig): HTMLElement {
    const prototype = new Cell(shape.label, new Geometry(0, 0, shape.width, shape.height), shape.style);
    prototype.setVertex(true);

    const item = document.createElement('div');
    item.draggable = true;
    item.style.display = 'flex';
    item.style.flexDirection = 'column';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.style.gap = '4px';
    item.style.padding = '8px';
    item.style.background = '#f9f9f9';
    item.style.border = '1px solid #e0e0e0';
    item.style.borderRadius = '4px';
    item.style.cursor = 'grab';
    item.style.transition = 'all 0.2s';
    item.style.userSelect = 'none';
    item.title = shape.label;

    const iconDiv = document.createElement('div');
    iconDiv.style.fontSize = '20px';
    iconDiv.style.lineHeight = '1';
    iconDiv.innerHTML = shape.icon;

    const labelDiv = document.createElement('div');
    labelDiv.style.fontSize = '10px';
    labelDiv.style.color = '#666';
    labelDiv.style.textAlign = 'center';
    labelDiv.textContent = shape.label;

    item.appendChild(iconDiv);
    item.appendChild(labelDiv);

    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.background = '#f0f8ff';
      item.style.borderColor = '#0066cc';
      item.style.cursor = 'grab';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = '#f9f9f9';
      item.style.borderColor = '#e0e0e0';
    });

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
