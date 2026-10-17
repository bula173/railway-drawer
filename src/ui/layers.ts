/**
 * @file layers.ts
 * @brief Layers panel on the model's real layers (the children of the model root), as draw.io's
 *        Layers dialog: what a .drawio file stores and draw.io shows.
 *
 * - The current layer is the graph's default parent: new and pasted cells go there.
 * - + Layer adds a layer cell on top (one undoable edit), × / Delete removes a layer with its
 *   cells (graph.removeCells([layer], false), undoable), the eye toggles the layer's `visible`
 *   (model.setVisible, undoable, saved as visible="0"), the padlock sets/removes `locked=1` on
 *   the layer cell's style (cell-lock.ts: cells on a locked layer cannot be selected or edited).
 * - Listed top-most first, like draw.io; an unnamed layer shows as "Background".
 */
import { Cell } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import { hasLockedStyle, setCellsLocked } from './cell-lock';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** The layer cell (a child of the model root). */
  cell: Cell;
  /** Number of top-level cells on the layer. */
  cellCount: number;
}

const COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

export class LayersController {
  private graph: Graph;
  private layerListContainer: HTMLElement | null;
  private readonly modelListener = () => this.onModelChange();

  constructor(graph: Graph) {
    this.graph = graph;
    this.layerListContainer = document.getElementById('layers-list');

    this.setupLayerControls();
    this.render();

    this.graph.getDataModel().addListener('change', this.modelListener);
  }

  private setupLayerControls(): void {
    const addLayerBtn = document.getElementById('btn-add-layer');
    if (addLayerBtn) {
      addLayerBtn.addEventListener('click', () => {
        if (this.isActive()) this.addLayer();
      });
    }

    const deleteLayerBtn = document.getElementById('btn-delete-layer');
    if (deleteLayerBtn) {
      deleteLayerBtn.addEventListener('click', () => {
        if (this.isActive()) this.deleteCurrentLayer();
      });
    }
  }

  /** Whether this controller's graph is the one shown (#layers-list is shared by all tabs). */
  private isActive(): boolean {
    const container = this.graph.container;
    return !!container && container.isConnected && container.style.display !== 'none';
  }

  private layerCells(): Cell[] {
    return [...(this.graph.getDataModel().getRoot()?.children ?? [])];
  }

  private findLayer(layerId: string): Cell | null {
    return this.layerCells().find((cell) => cell.getId() === layerId) ?? null;
  }

  private layerName(cell: Cell): string {
    const label = this.graph.convertValueToString(cell);
    return label && label.trim() !== '' ? label : 'Background';
  }

  private toLayer(cell: Cell): Layer {
    return {
      id: String(cell.getId()),
      name: this.layerName(cell),
      visible: cell.isVisible(),
      locked: hasLockedStyle(cell),
      cell,
      cellCount: cell.getChildCount(),
    };
  }

  /** A default parent that left the model (layer deleted, file loaded) falls back to the first layer. */
  private onModelChange(): void {
    const current = this.graph.defaultParent;
    if (current && !this.layerCells().includes(current)) this.graph.setDefaultParent(null);
    if (this.isActive()) this.render();
  }

  /** draw.io addLayer: a new layer on top, made the current layer. One undoable edit. */
  addLayer(): Layer {
    const model = this.graph.getDataModel();
    const root = model.getRoot();
    if (!root) throw new Error('The diagram has no root cell');
    const used = new Set(this.layerCells().map((cell) => this.layerName(cell)));
    let n = root.getChildCount() + 1;
    while (used.has(`Layer ${n}`)) n++;
    const layer = new Cell(`Layer ${n}`);
    model.beginUpdate();
    try {
      model.add(root, layer);
    } finally {
      model.endUpdate();
    }
    this.graph.setDefaultParent(layer);
    this.render();
    return this.toLayer(layer);
  }

  deleteCurrentLayer(): void {
    const current = this.getCurrentLayer();
    if (current) this.deleteLayer(current.id);
  }

  /**
   * Deletes a layer and its cells (after a confirm when it has any) in one undoable model edit;
   * Undo brings both back. The last layer cannot be deleted.
   * @returns true when the layer was deleted
   */
  deleteLayer(layerId: string): boolean {
    const layer = this.findLayer(layerId);
    if (!layer) return false;
    if (this.layerCells().length <= 1) {
      alert('Cannot delete the last layer');
      return false;
    }
    const count = layer.getChildCount();
    if (count > 0 && !confirm(`Layer "${this.layerName(layer)}" contains ${count} cell(s). Delete anyway?`)) {
      return false;
    }
    const removedSelection = this.graph.getSelectionCells().filter((cell) => this.isInside(cell, layer));
    if (removedSelection.length > 0) this.graph.removeSelectionCells(removedSelection);
    // like draw.io's Layers dialog: the layer cell itself, its descendants go with it
    this.graph.removeCells([layer], false);
    if (this.graph.defaultParent === layer) this.graph.setDefaultParent(null);
    this.render();
    return true;
  }

  private isInside(cell: Cell, layer: Cell): boolean {
    for (let c: Cell | null = cell; c; c = c.getParent()) if (c === layer) return true;
    return false;
  }

  renameLayer(layerId: string, newName: string): void {
    const layer = this.findLayer(layerId);
    if (layer) {
      this.graph.getDataModel().setValue(layer, newName);
      this.render();
    }
  }

  toggleLayerVisibility(layerId: string): void {
    const layer = this.findLayer(layerId);
    if (!layer) return;
    const visible = !layer.isVisible();
    if (!visible) {
      const hidden = this.graph.getSelectionCells().filter((cell) => this.isInside(cell, layer));
      if (hidden.length > 0) this.graph.removeSelectionCells(hidden);
    }
    this.graph.getDataModel().setVisible(layer, visible);
    this.render();
  }

  /** Sets/removes `locked=1` on the layer cell (one undoable edit, saved in the file). */
  toggleLayerLock(layerId: string): void {
    const layer = this.findLayer(layerId);
    if (!layer) return;
    setCellsLocked(this.graph, [layer], !hasLockedStyle(layer));
    this.render();
  }

  selectLayer(layerId: string): void {
    const layer = this.findLayer(layerId);
    if (!layer) return;
    this.graph.setDefaultParent(layer);
    this.render();
  }

  private render(): void {
    if (!this.layerListContainer) return;

    this.layerListContainer.innerHTML = '';
    const layers = this.getLayers();
    const currentId = this.getCurrentLayer()?.id ?? null;

    // top-most layer first, like draw.io's Layers dialog
    [...layers].reverse().forEach((layer) => {
      const index = layers.indexOf(layer);
      const layerItem = document.createElement('div');
      layerItem.className = 'layer-item';
      layerItem.dataset.layerId = layer.id;
      layerItem.style.padding = '8px';
      layerItem.style.borderBottom = '1px solid var(--rd-border)';
      layerItem.style.cursor = 'pointer';
      layerItem.style.display = 'flex';
      layerItem.style.alignItems = 'center';
      layerItem.style.gap = '8px';
      layerItem.style.backgroundColor = layer.id === currentId ? 'var(--rd-selected)' : 'transparent';
      layerItem.style.borderLeft = `3px solid ${COLORS[index % COLORS.length]}`;

      // Visibility toggle
      const visibilityBtn = document.createElement('button');
      visibilityBtn.className = 'layer-visibility';
      visibilityBtn.textContent = layer.visible ? '👁' : '🚫';
      visibilityBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
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

      // Lock toggle (locked=1 on the layer cell)
      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-lock';
      lockBtn.textContent = layer.locked ? '🔒' : '🔓';
      lockBtn.title = layer.locked ? 'Unlock layer' : 'Lock layer';
      lockBtn.setAttribute('aria-pressed', String(layer.locked));
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
      nameSpan.className = 'layer-name';
      nameSpan.textContent = `${layer.name} (${layer.cellCount})`;
      nameSpan.style.flex = '1';
      nameSpan.style.fontSize = '12px';
      nameSpan.style.fontWeight = layer.id === currentId ? '600' : '400';

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'layer-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete layer';
      deleteBtn.style.background = 'none';
      deleteBtn.style.border = 'none';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.fontSize = '16px';
      deleteBtn.style.padding = '0';
      deleteBtn.style.width = '24px';
      deleteBtn.style.color = 'var(--rd-danger)';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteLayer(layer.id);
      });

      layerItem.appendChild(visibilityBtn);
      layerItem.appendChild(lockBtn);
      layerItem.appendChild(nameSpan);
      if (layers.length > 1) {
        layerItem.appendChild(deleteBtn);
      }

      layerItem.addEventListener('click', () => this.selectLayer(layer.id));

      this.layerListContainer!.appendChild(layerItem);
    });
  }

  /**
   * Re-renders the shared layers list for this controller's graph.
   * #layers-list is shared by all tabs, so the TabManager calls this when the tab is shown;
   * the rebuilt items act on this graph only.
   */
  refresh(): void {
    this.render();
  }

  /** The current layer (the graph's default parent). */
  getCurrentLayer(): Layer | null {
    const parent = this.graph.getDefaultParent();
    const layers = this.layerCells();
    const index = parent ? layers.indexOf(parent) : -1;
    return index >= 0 ? this.toLayer(layers[index]) : null;
  }

  /** Every layer in model order (bottom first). */
  getLayers(): Layer[] {
    return this.layerCells().map((cell) => this.toLayer(cell));
  }

  destroy(): void {
    // #layers-list is shared with the other tabs: it is left alone here and re-rendered by the
    // tab that is shown next, so closing a background tab does not empty the active tab's list.
    this.graph.getDataModel().removeListener(this.modelListener);
  }
}
