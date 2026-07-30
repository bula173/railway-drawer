import { Graph } from '@maxgraph/core';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  cells: any[];
}

export class LayersController {
  private graph: Graph;
  private layers: Map<string, Layer> = new Map();
  private currentLayerId: string | null = null;
  private layerListContainer: HTMLElement | null;

  constructor(graph: Graph) {
    this.graph = graph;
    this.layerListContainer = document.getElementById('layers-list');

    this.initializeDefaultLayer();
    this.setupLayerControls();
    this.render();

    // Update when cells change
    this.graph.model.addListener('change', () => {
      this.updateLayerCells();
    });
  }

  private initializeDefaultLayer(): void {
    const defaultLayer: Layer = {
      id: 'layer-0',
      name: 'Layer 1',
      visible: true,
      locked: false,
      color: '#3498db',
      cells: [],
    };
    this.layers.set(defaultLayer.id, defaultLayer);
    this.currentLayerId = defaultLayer.id;
  }

  private setupLayerControls(): void {
    const addLayerBtn = document.getElementById('btn-add-layer');
    if (addLayerBtn) {
      addLayerBtn.addEventListener('click', () => this.addLayer());
    }

    const deleteLayerBtn = document.getElementById('btn-delete-layer');
    if (deleteLayerBtn) {
      deleteLayerBtn.addEventListener('click', () => this.deleteCurrentLayer());
    }
  }

  addLayer(): void {
    const layerNum = this.layers.size + 1;
    const newLayerId = `layer-${Date.now()}`;
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const newLayer: Layer = {
      id: newLayerId,
      name: `Layer ${layerNum}`,
      visible: true,
      locked: false,
      color: colors[this.layers.size % colors.length],
      cells: [],
    };
    this.layers.set(newLayerId, newLayer);
    this.currentLayerId = newLayerId;
    this.render();
  }

  deleteCurrentLayer(): void {
    if (!this.currentLayerId || this.layers.size <= 1) {
      alert('Cannot delete the last layer');
      return;
    }

    const layer = this.layers.get(this.currentLayerId);
    if (layer && layer.cells.length > 0) {
      if (!confirm(`Layer "${layer.name}" contains ${layer.cells.length} cell(s). Delete anyway?`)) {
        return;
      }
      // Move cells to default layer or delete them
      this.graph.batchUpdate(() => {
        layer.cells.forEach((cell) => {
          this.graph.model.remove(cell);
        });
      });
    }

    this.layers.delete(this.currentLayerId);
    this.currentLayerId = Array.from(this.layers.keys())[0] || null;
    this.render();
  }

  renameLayer(layerId: string, newName: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.name = newName;
      this.render();
    }
  }

  toggleLayerVisibility(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = !layer.visible;
      this.updateLayerCellsVisibility(layerId);
      this.render();
    }
  }

  toggleLayerLock(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.locked = !layer.locked;
      this.render();
    }
  }

  selectLayer(layerId: string): void {
    this.currentLayerId = layerId;
    this.render();
  }

  addCellToLayer(cell: any, layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer && !layer.cells.includes(cell)) {
      layer.cells.push(cell);
      (cell as any).__layerId = layerId;
    }
  }

  removeCellFromLayer(cell: any, layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      const index = layer.cells.indexOf(cell);
      if (index > -1) {
        layer.cells.splice(index, 1);
      }
    }
  }

  getCellLayer(cell: any): string | null {
    return (cell as any).__layerId || Array.from(this.layers.keys())[0];
  }

  private updateLayerCells(): void {
    // Get all cells from the graph
    const allCells = this.graph.model.cells;
    const graphCells = Object.values(allCells || {}).filter((c: any) => c.isVertex && c.isVertex());

    // Clear all layer cells
    this.layers.forEach((layer) => {
      layer.cells = [];
    });

    // Assign cells to layers
    graphCells.forEach((cell: any) => {
      const layerId = this.getCellLayer(cell);
      if (layerId) {
        this.addCellToLayer(cell, layerId);
      } else {
        // Add to default layer
        const defaultLayerId = Array.from(this.layers.keys())[0];
        if (defaultLayerId) {
          this.addCellToLayer(cell, defaultLayerId);
        }
      }
    });
  }

  private updateLayerCellsVisibility(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    this.graph.batchUpdate(() => {
      layer.cells.forEach((cell) => {
        if (layer.visible) {
          cell.setVisible(true);
        } else {
          cell.setVisible(false);
        }
      });
    });
    this.graph.refresh();
  }

  private render(): void {
    if (!this.layerListContainer) return;

    this.layerListContainer.innerHTML = '';

    this.layers.forEach((layer) => {
      const layerItem = document.createElement('div');
      layerItem.className = 'layer-item';
      layerItem.style.padding = '8px';
      layerItem.style.borderBottom = '1px solid #e0e0e0';
      layerItem.style.cursor = 'pointer';
      layerItem.style.display = 'flex';
      layerItem.style.alignItems = 'center';
      layerItem.style.gap = '8px';
      layerItem.style.backgroundColor = layer.id === this.currentLayerId ? '#e3f2fd' : 'transparent';
      layerItem.style.borderLeft = `3px solid ${layer.color}`;

      // Visibility toggle
      const visibilityBtn = document.createElement('button');
      visibilityBtn.textContent = layer.visible ? '👁' : '🚫';
      visibilityBtn.style.background = 'none';
      visibilityBtn.style.border = 'none';
      visibilityBtn.style.cursor = 'pointer';
      visibilityBtn.style.fontSize = '14px';
      visibilityBtn.style.padding = '0';
      visibilityBtn.style.width = '24px';
      visibilityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayerVisibility(layer.id);
      });

      // Lock toggle
      const lockBtn = document.createElement('button');
      lockBtn.textContent = layer.locked ? '🔒' : '🔓';
      lockBtn.style.background = 'none';
      lockBtn.style.border = 'none';
      lockBtn.style.cursor = 'pointer';
      lockBtn.style.fontSize = '14px';
      lockBtn.style.padding = '0';
      lockBtn.style.width = '24px';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayerLock(layer.id);
      });

      // Layer name
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${layer.name} (${layer.cells.length})`;
      nameSpan.style.flex = '1';
      nameSpan.style.fontSize = '12px';
      nameSpan.style.fontWeight = layer.id === this.currentLayerId ? '600' : '400';

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.style.background = 'none';
      deleteBtn.style.border = 'none';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.fontSize = '16px';
      deleteBtn.style.padding = '0';
      deleteBtn.style.width = '24px';
      deleteBtn.style.color = '#d32f2f';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.layers.size > 1) {
          this.removeCellFromLayer(layer, layer.id);
          this.layers.delete(layer.id);
          if (this.currentLayerId === layer.id) {
            this.currentLayerId = Array.from(this.layers.keys())[0] || null;
          }
          this.render();
        }
      });

      layerItem.appendChild(visibilityBtn);
      layerItem.appendChild(lockBtn);
      layerItem.appendChild(nameSpan);
      if (this.layers.size > 1) {
        layerItem.appendChild(deleteBtn);
      }

      layerItem.addEventListener('click', () => this.selectLayer(layer.id));

      this.layerListContainer!.appendChild(layerItem);
    });
  }

  getCurrentLayer(): Layer | null {
    return this.currentLayerId ? this.layers.get(this.currentLayerId) || null : null;
  }

  getLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  destroy(): void {
    // Clear all event listeners and references
    if (this.layerListContainer) {
      this.layerListContainer.innerHTML = '';
    }
    this.layers.clear();
    this.currentLayerId = null;
  }
}
