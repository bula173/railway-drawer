/**
 * Layer Manager
 * Manage visibility and locking of cells in layers
 */

export interface LayerItem {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean;
}

export class LayerManager {
  private layers: Map<string, LayerItem> = new Map();
  private listeners: Array<(layers: LayerItem[]) => void> = [];

  constructor(private graph: any) {}

  /**
   * Add or update a layer from a cell
   */
  addLayer(cell: any, label?: string): LayerItem {
    if (this.layers.has(cell.id)) {
      return this.layers.get(cell.id)!;
    }

    const layer: LayerItem = {
      id: cell.id,
      label: label || cell.value || `Layer ${this.layers.size + 1}`,
      visible: true,
      locked: false,
    };

    this.layers.set(cell.id, layer);
    this.notifyListeners();
    return layer;
  }

  /**
   * Get all layers
   */
  getAllLayers(): LayerItem[] {
    return Array.from(this.layers.values());
  }

  /**
   * Toggle layer visibility
   */
  toggleVisibility(cellId: string): boolean {
    const layer = this.layers.get(cellId);
    if (!layer) return false;

    const cell = this.findCellById(cellId);
    if (cell) {
      layer.visible = !layer.visible;
      // Update cell visibility in graph
      cell.style = cell.style || {};
      cell.style.opacity = layer.visible ? '1' : '0.3';
      this.graph.view.refresh();
      this.notifyListeners();
    }

    return layer.visible;
  }

  /**
   * Toggle layer lock
   */
  toggleLock(cellId: string): boolean {
    const layer = this.layers.get(cellId);
    if (!layer) return false;

    layer.locked = !layer.locked;
    this.notifyListeners();
    return layer.locked;
  }

  /**
   * Show all layers
   */
  showAll(): void {
    this.layers.forEach((layer) => {
      layer.visible = true;
      const cell = this.findCellById(layer.id);
      if (cell) {
        cell.style = cell.style || {};
        cell.style.opacity = '1';
      }
    });
    this.graph.view.refresh();
    this.notifyListeners();
  }

  /**
   * Hide all layers
   */
  hideAll(): void {
    this.layers.forEach((layer) => {
      layer.visible = false;
      const cell = this.findCellById(layer.id);
      if (cell) {
        cell.style = cell.style || {};
        cell.style.opacity = '0.3';
      }
    });
    this.graph.view.refresh();
    this.notifyListeners();
  }

  /**
   * Isolate layer (show only this layer)
   */
  isolate(cellId: string): void {
    this.layers.forEach((layer) => {
      const isTarget = layer.id === cellId;
      layer.visible = isTarget;
      const cell = this.findCellById(layer.id);
      if (cell) {
        cell.style = cell.style || {};
        cell.style.opacity = isTarget ? '1' : '0.3';
      }
    });
    this.graph.view.refresh();
    this.notifyListeners();
  }

  /**
   * Check if cell is locked
   */
  isLocked(cellId: string): boolean {
    return this.layers.get(cellId)?.locked ?? false;
  }

  /**
   * Check if cell is visible
   */
  isVisible(cellId: string): boolean {
    return this.layers.get(cellId)?.visible ?? true;
  }

  /**
   * Rename layer
   */
  renameLayer(cellId: string, newName: string): boolean {
    const layer = this.layers.get(cellId);
    if (!layer) return false;

    layer.label = newName.trim() || layer.label;
    this.notifyListeners();
    return true;
  }

  /**
   * Remove layer
   */
  removeLayer(cellId: string): boolean {
    return this.layers.delete(cellId);
  }

  /**
   * Initialize layers from current graph
   */
  initializeFromGraph(): void {
    this.layers.clear();
    const parent = this.graph.getDefaultParent();

    if (parent && parent.children) {
      parent.children.forEach((cell: any, index: number) => {
        if (cell.isVertex?.()) {
          this.addLayer(cell, cell.value || `Shape ${index + 1}`);
        }
      });
    }
  }

  /**
   * Add listener for layer changes
   */
  addListener(callback: (layers: LayerItem[]) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (layers: LayerItem[]) => void): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /**
   * Private: find cell by id
   */
  private findCellById(cellId: string): any {
    const parent = this.graph.getDefaultParent();
    if (!parent || !parent.children) return null;

    return parent.children.find((cell: any) => cell.id === cellId) || null;
  }

  /**
   * Private: notify listeners
   */
  private notifyListeners(): void {
    const layers = this.getAllLayers();
    this.listeners.forEach((listener) => listener(layers));
  }
}
