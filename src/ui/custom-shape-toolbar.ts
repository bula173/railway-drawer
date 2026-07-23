/**
 * @file custom-shape-toolbar.ts
 * @brief Displays custom shapes in the toolbar
 * @details
 * Manages the display and drag-drop functionality of user-created shapes
 * in the shapes toolbar. Custom shapes are rendered with previews and can
 * be dragged onto the canvas just like built-in shapes.
 */

import { customShapeRegistry, CustomShape } from '../services/custom-shape-registry';

export class CustomShapeToolbar {
  private shapesContainer: HTMLElement | null = null;

  constructor(_shapesContainerId: string = 'shapes-container') {
    this.shapesContainer = document.getElementById(_shapesContainerId);
    this.render();

    // Listen for shape changes
    this.setupAutoRefresh();
  }

  /**
   * @brief Render custom shapes in toolbar
   */
  render(): void {
    if (!this.shapesContainer) return;

    // Find or create custom shapes group
    let customGroup = this.shapesContainer.querySelector('[data-group="Custom Shapes"]');
    if (!customGroup) {
      customGroup = document.createElement('div');
      customGroup.className = 'shape-group';
      customGroup.setAttribute('data-group', 'Custom Shapes');
      customGroup.innerHTML = `
        <div class="shape-group-title">
          Custom Shapes
          <button class="shape-group-action" title="Add new shape">+</button>
        </div>
        <div class="shape-group-items"></div>
      `;
      this.shapesContainer.appendChild(customGroup);

      // Wire up the + button
      customGroup.querySelector('.shape-group-action')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('open-shape-designer'));
      });
    }

    // Clear existing items
    const itemsContainer = customGroup.querySelector('.shape-group-items');
    if (itemsContainer) {
      itemsContainer.innerHTML = '';

      // Add each custom shape
      const shapes = customShapeRegistry.getAll();
      shapes.forEach((shape) => {
        this.addShapeItem(itemsContainer, shape);
      });

      // Show/hide group based on whether there are shapes
      if (shapes.length === 0) {
        (customGroup as HTMLElement).style.display = 'none';
      } else {
        (customGroup as HTMLElement).style.display = 'block';
      }
    }
  }

  /**
   * @brief Add a single shape item to toolbar
   */
  private addShapeItem(container: Element, shape: CustomShape): void {
    const item = document.createElement('div');
    item.className = 'shape-item';
    item.title = `${shape.name}\n${shape.description}`;
    item.draggable = true;

    // Create preview SVG
    const preview = document.createElement('div');
    preview.className = 'shape-preview';
    preview.innerHTML = `
      <svg viewBox="0 0 ${shape.width} ${shape.height}" width="40" height="40">
        <path
          d="${shape.svgPath}"
          fill="${shape.fillColor}"
          stroke="${shape.strokeColor}"
          stroke-width="${shape.strokeWidth}"
        />
      </svg>
    `;

    const label = document.createElement('div');
    label.className = 'shape-label';
    label.textContent = shape.name;

    item.appendChild(preview);
    item.appendChild(label);

    // Drag handler
    item.addEventListener('dragstart', (e) => {
      const shapeData = {
        type: 'custom',
        id: shape.id,
        name: shape.name,
        width: shape.width,
        height: shape.height,
        svgPath: shape.svgPath,
        fillColor: shape.fillColor,
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
      };

      const dataTransfer = (e as DragEvent).dataTransfer;
      if (dataTransfer) {
        dataTransfer.effectAllowed = 'copy';
        dataTransfer.setData('application/x-custom-shape', JSON.stringify(shapeData));
      }
    });

    // Context menu for editing/deleting
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = document.createElement('div');
      menu.className = 'shape-context-menu';
      menu.style.position = 'fixed';
      menu.style.top = `${(e as MouseEvent).clientY}px`;
      menu.style.left = `${(e as MouseEvent).clientX}px`;
      menu.style.background = 'white';
      menu.style.border = '1px solid #ccc';
      menu.style.borderRadius = '4px';
      menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      menu.style.zIndex = '10000';
      menu.innerHTML = `
        <div style="padding: 4px 0;">
          <div class="menu-item" data-action="edit" style="padding: 6px 16px; cursor: pointer; font-size: 12px;">
            ✏️ Edit
          </div>
          <div class="menu-item" data-action="delete" style="padding: 6px 16px; cursor: pointer; font-size: 12px; color: #f44336;">
            🗑️ Delete
          </div>
        </div>
      `;

      document.body.appendChild(menu);

      const editBtn = menu.querySelector('[data-action="edit"]');
      const deleteBtn = menu.querySelector('[data-action="delete"]');

      editBtn?.addEventListener('click', () => {
        document.body.removeChild(menu);
        window.dispatchEvent(
          new CustomEvent('edit-custom-shape', { detail: { shapeId: shape.id } })
        );
      });

      deleteBtn?.addEventListener('click', () => {
        document.body.removeChild(menu);
        if (confirm(`Delete shape "${shape.name}"?`)) {
          customShapeRegistry.delete(shape.id);
          this.render();
        }
      });

      // Close menu on click elsewhere
      const closeMenu = () => {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', closeMenu);
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    });

    container.appendChild(item);
  }

  /**
   * @brief Setup auto-refresh when custom shapes change
   */
  private setupAutoRefresh(): void {
    window.addEventListener('custom-shapes-updated', () => {
      this.render();
    });
  }

  /**
   * @brief Manually trigger refresh
   */
  refresh(): void {
    this.render();
  }

  destroy(): void {
    // Cleanup if needed
  }
}
