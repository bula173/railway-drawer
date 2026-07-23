import { Graph, UndoManager } from '@maxgraph/core';
import { ClipboardService } from './clipboard-service';

export class GraphCommandService {
  private graph: Graph;
  private undoManager: UndoManager;
  private clipboardService: ClipboardService;
  private listeners: Map<string, Set<() => void>> = new Map();

  constructor(graph: Graph) {
    this.graph = graph;
    this.undoManager = new UndoManager();
    this.clipboardService = ClipboardService.getInstance();
    this.setupModelListener();
  }

  private setupModelListener(): void {
    (this.graph as any).model.addListener('change', (_sender: any, evt: any) => {
      const edit = evt.getProperty('edit');
      if (edit) {
        this.undoManager.undoableEditHappened(edit);
        this.notifyListeners('stateChanged');
      }
    });

    this.undoManager.addListener('undoableEdit', () => {
      this.notifyListeners('stateChanged');
    });
  }

  undo(): void {
    if (this.undoManager.canUndo()) {
      this.undoManager.undo();
      this.notifyListeners('stateChanged');
      console.log('[GraphCommand] Undo executed');
    }
  }

  redo(): void {
    if (this.undoManager.canRedo()) {
      this.undoManager.redo();
      this.notifyListeners('stateChanged');
      console.log('[GraphCommand] Redo executed');
    }
  }

  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  canRedo(): boolean {
    return this.undoManager.canRedo();
  }

  copy(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.clipboardService.copy(cells, this.graph);
      this.notifyListeners('clipboardChanged');
      console.log('[GraphCommand] Copy executed');
    }
  }

  cut(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.clipboardService.cut(cells, this.graph);
      this.notifyListeners('clipboardChanged');
      console.log('[GraphCommand] Cut executed');
    }
  }

  paste(): void {
    this.clipboardService.paste(this.graph);
    this.notifyListeners('stateChanged');
    console.log('[GraphCommand] Paste executed');
  }

  canPaste(): boolean {
    return this.clipboardService.hasContent();
  }

  delete(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.graph.removeCells(cells);
      this.notifyListeners('stateChanged');
      console.log('[GraphCommand] Delete executed');
    }
  }

  selectAll(): void {
    const parent = this.graph.getDefaultParent();
    const children = (this.graph.model as any).getChildren(parent) || [];
    this.graph.setSelectionCells(children);
    console.log('[GraphCommand] Select All executed');
  }

  clearSelection(): void {
    this.graph.clearSelection();
    console.log('[GraphCommand] Clear Selection executed');
  }

  alignShapes(alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    const cells = this.graph.getSelectionCells().filter((c) => !c.isEdge());
    if (cells.length < 2) {
      console.warn('[GraphCommand] Need at least 2 shapes to align');
      return;
    }

    const bounds = cells.map((c) => c.getGeometry());
    let alignValue = 0;

    this.graph.batchUpdate(() => {
      switch (alignment) {
        case 'left':
          alignValue = Math.min(...bounds.map((b) => b?.x || 0));
          cells.forEach((cell) => {
            const geo = cell.getGeometry();
            if (geo) {
              geo.x = alignValue;
              cell.setGeometry(geo);
            }
          });
          break;
        case 'center':
          alignValue = bounds.reduce((sum, b) => sum + (b?.x || 0) + (b?.width || 0) / 2, 0) / cells.length;
          cells.forEach((cell) => {
            const geo = cell.getGeometry();
            if (geo) {
              geo.x = alignValue - (geo.width || 0) / 2;
              cell.setGeometry(geo);
            }
          });
          break;
        case 'right':
          alignValue = Math.max(...bounds.map((b) => (b?.x || 0) + (b?.width || 0)));
          cells.forEach((cell) => {
            const geo = cell.getGeometry();
            if (geo) {
              geo.x = alignValue - (geo.width || 0);
              cell.setGeometry(geo);
            }
          });
          break;
        case 'top':
          alignValue = Math.min(...bounds.map((b) => b?.y || 0));
          cells.forEach((cell) => {
            const geo = cell.getGeometry();
            if (geo) {
              geo.y = alignValue;
              cell.setGeometry(geo);
            }
          });
          break;
        case 'middle':
          alignValue = bounds.reduce((sum, b) => sum + (b?.y || 0) + (b?.height || 0) / 2, 0) / cells.length;
          cells.forEach((cell) => {
            const geo = cell.getGeometry();
            if (geo) {
              geo.y = alignValue - (geo.height || 0) / 2;
              cell.setGeometry(geo);
            }
          });
          break;
        case 'bottom':
          alignValue = Math.max(...bounds.map((b) => (b?.y || 0) + (b?.height || 0)));
          cells.forEach((cell) => {
            const geo = cell.getGeometry();
            if (geo) {
              geo.y = alignValue - (geo.height || 0);
              cell.setGeometry(geo);
            }
          });
          break;
      }
    });

    this.graph.refresh();
    this.notifyListeners('stateChanged');
    console.log(`[GraphCommand] Shapes aligned to ${alignment}`);
  }

  distributeShapes(direction: 'horizontal' | 'vertical'): void {
    const cells = this.graph.getSelectionCells().filter((c) => !c.isEdge());
    if (cells.length < 3) {
      console.warn('[GraphCommand] Need at least 3 shapes to distribute');
      return;
    }

    const bounds = cells.map((c) => c.getGeometry());

    this.graph.batchUpdate(() => {
      if (direction === 'horizontal') {
        const sortedByX = cells
          .map((cell, i) => ({ cell, x: bounds[i]?.x || 0 }))
          .sort((a, b) => a.x - b.x);

        const minX = bounds.reduce((min, b) => Math.min(min, b?.x || 0), Infinity);
        const maxX = bounds.reduce((max, b) => Math.max(max, (b?.x || 0) + (b?.width || 0)), -Infinity);
        const totalWidth = maxX - minX;
        const spacing = totalWidth / (cells.length - 1);

        sortedByX.forEach((item, i) => {
          const geo = item.cell.getGeometry();
          if (geo) {
            geo.x = minX + i * spacing;
            item.cell.setGeometry(geo);
          }
        });
      } else {
        const sortedByY = cells
          .map((cell, i) => ({ cell, y: bounds[i]?.y || 0 }))
          .sort((a, b) => a.y - b.y);

        const minY = bounds.reduce((min, b) => Math.min(min, b?.y || 0), Infinity);
        const maxY = bounds.reduce((max, b) => Math.max(max, (b?.y || 0) + (b?.height || 0)), -Infinity);
        const totalHeight = maxY - minY;
        const spacing = totalHeight / (cells.length - 1);

        sortedByY.forEach((item, i) => {
          const geo = item.cell.getGeometry();
          if (geo) {
            geo.y = minY + i * spacing;
            item.cell.setGeometry(geo);
          }
        });
      }
    });

    this.graph.refresh();
    this.notifyListeners('stateChanged');
    console.log(`[GraphCommand] Shapes distributed ${direction}ly`);
  }

  addListener(event: string, callback: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  removeListener(event: string, callback: () => void): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private notifyListeners(event: string): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback());
    }
  }

  /**
   * Move selected cells to front (top z-order)
   */
  toFront(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (!cell.isEdge()) {
          this.graph.orderCells(true, [cell]);
        }
      });
    });

    this.notifyListeners('stateChanged');
    console.log('[GraphCommand] Move to Front executed');
  }

  /**
   * Move selected cells to back (bottom z-order)
   */
  toBack(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (!cell.isEdge()) {
          this.graph.orderCells(false, [cell]);
        }
      });
    });

    this.notifyListeners('stateChanged');
    console.log('[GraphCommand] Move to Back executed');
  }

  /**
   * Bring selected cells forward one step
   */
  bringForward(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    const parent = cells[0].getParent();
    if (!parent) return;

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (!cell.isEdge()) {
          const index = (this.graph.model as any).getChildCount(parent) - 1;
          (this.graph.model as any).setChildAt(cell, Math.max(0, index - 1));
        }
      });
    });

    this.notifyListeners('stateChanged');
    console.log('[GraphCommand] Bring Forward executed');
  }

  /**
   * Send selected cells backward one step
   */
  sendBackward(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    const parent = cells[0].getParent();
    if (!parent) return;

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (!cell.isEdge()) {
          const index = (this.graph.model as any).getChildIndex(cell);
          (this.graph.model as any).setChildAt(cell, Math.min(index + 1, (this.graph.model as any).getChildCount(parent) - 1));
        }
      });
    });

    this.notifyListeners('stateChanged');
    console.log('[GraphCommand] Send Backward executed');
  }

  /**
   * Copy style from selected cells for format painter
   */
  private copiedStyle: any = null;

  copyStyle(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) {
      console.warn('[GraphCommand] No cells selected for copy style');
      return;
    }

    this.copiedStyle = cells[0].getStyle();
    this.notifyListeners('styleChanged');
    console.log('[GraphCommand] Style copied');
  }

  /**
   * Paste style to selected cells
   */
  pasteStyle(): void {
    if (!this.copiedStyle) {
      console.warn('[GraphCommand] No style copied');
      return;
    }

    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) {
      console.warn('[GraphCommand] No cells selected for paste style');
      return;
    }

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (!cell.isEdge()) {
          cell.setStyle(this.copiedStyle);
        }
      });
    });

    this.notifyListeners('stateChanged');
    console.log('[GraphCommand] Style pasted');
  }

  /**
   * Get copied style (for format painter UI)
   */
  hasCopiedStyle(): boolean {
    return this.copiedStyle !== null;
  }

  destroy(): void {
    this.listeners.clear();
  }
}
