import { EventObject, EventSource, Graph, InternalEvent, UndoManager, styleUtils } from '@maxgraph/core';
import { ClipboardService } from './clipboard-service';
import { withSnapDataOnly } from '../core/snap-mode';
import type { Cell } from '@maxgraph/core';
import { copyPasteStyle, pasteStyleToCells } from './style-edit';
import type { StyleRecord } from './style-edit';
import { logger } from '../drawio/logger';

/**
 * The z-order of `children` after moving every selected cell one step up (`step` 1) or down (-1).
 * A cell only swaps with an unselected neighbour, so adjacent selected cells move together and a
 * cell already at the end (or blocked by such a cell) stays.
 */
export function stepOrder(children: readonly Cell[], selected: ReadonlySet<Cell>, step: 1 | -1): Cell[] {
  const order = [...children];
  const n = order.length;
  const swap = (i: number, j: number): void => {
    [order[i], order[j]] = [order[j], order[i]];
  };
  if (step === 1) {
    for (let i = n - 2; i >= 0; i--) {
      if (selected.has(order[i]) && !selected.has(order[i + 1])) swap(i, i + 1);
    }
  } else {
    for (let i = 1; i < n; i++) {
      if (selected.has(order[i]) && !selected.has(order[i - 1])) swap(i, i - 1);
    }
  }
  return order;
}

export class GraphCommandService {
  private graph: Graph;
  private undoManager: UndoManager;
  private clipboardService: ClipboardService;
  private listeners: Map<string, Set<() => void>> = new Map();

  /** Records completed edits from the model and view (fired once per endUpdate, never by undo/redo). */
  private readonly onUndoableEdit = (_sender: EventSource, evt: EventObject): void => {
    const edit = evt.getProperty('edit');
    if (edit) {
      this.undoManager.undoableEditHappened(edit);
    }
  };

  /** Keeps the selection in sync with the cells touched by an undo/redo (as maxGraph's Editor does). */
  private readonly onHistoryNavigated = (_sender: EventSource, evt: EventObject): void => {
    const edit = evt.getProperty('edit');
    if (edit?.changes) {
      this.graph.setSelectionCells(this.graph.getSelectionCellsForChanges(edit.changes));
    }
  };

  private readonly onHistoryChanged = (): void => {
    this.notifyListeners('stateChanged');
  };

  constructor(graph: Graph) {
    this.graph = graph;
    this.undoManager = new UndoManager();
    this.clipboardService = ClipboardService.getInstance();
    this.setupUndoHandler();
  }

  /**
   * Wires the undo manager the way maxGraph's Editor.installUndoHandler does.
   * The model/view fire InternalEvent.UNDO only for new edits; replaying an edit through
   * UndoManager.undo()/redo() fires CHANGE but not UNDO, so undo/redo is not re-recorded.
   */
  private setupUndoHandler(): void {
    this.graph.getDataModel().addListener(InternalEvent.UNDO, this.onUndoableEdit);
    this.graph.getView().addListener(InternalEvent.UNDO, this.onUndoableEdit);

    this.undoManager.addListener(InternalEvent.UNDO, this.onHistoryNavigated);
    this.undoManager.addListener(InternalEvent.REDO, this.onHistoryNavigated);

    this.undoManager.addListener(InternalEvent.ADD, this.onHistoryChanged);
    this.undoManager.addListener(InternalEvent.UNDO, this.onHistoryChanged);
    this.undoManager.addListener(InternalEvent.REDO, this.onHistoryChanged);
    this.undoManager.addListener(InternalEvent.CLEAR, this.onHistoryChanged);
  }

  /** Clears the undo history (e.g. after loading a file, so the load itself is not undoable). */
  clearHistory(): void {
    this.undoManager.clear();
  }

  /** Detaches the undo handler from the graph and drops all subscribers. */
  destroy(): void {
    this.graph.getDataModel().removeListener(this.onUndoableEdit);
    this.graph.getView().removeListener(this.onUndoableEdit);
    this.undoManager.removeListener(this.onHistoryNavigated);
    this.undoManager.removeListener(this.onHistoryChanged);
    this.listeners.clear();
  }

  undo(): void {
    if (this.undoManager.canUndo()) {
      this.undoManager.undo();
      logger.debug('GraphCommand', 'Undo executed');
    }
  }

  redo(): void {
    if (this.undoManager.canRedo()) {
      this.undoManager.redo();
      logger.debug('GraphCommand', 'Redo executed');
    }
  }

  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  canRedo(): boolean {
    return this.undoManager.canRedo();
  }

  /** The edit the next undo() would undo (null: none). Lets the AI chat undo exactly its own edits. */
  nextUndoEdit(): object | null {
    const m = this.undoManager;
    return m.indexOfNextAdd > 0 ? (m.history[m.indexOfNextAdd - 1] ?? null) : null;
  }

  copy(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.clipboardService.copy(cells, this.graph);
      this.notifyListeners('clipboardChanged');
      logger.debug('GraphCommand', 'Copy executed');
    }
  }

  cut(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.clipboardService.cut(cells, this.graph);
      this.notifyListeners('clipboardChanged');
      logger.debug('GraphCommand', 'Cut executed');
    }
  }

  paste(): void {
    this.clipboardService.paste(this.graph);
    this.notifyListeners('stateChanged');
    logger.debug('GraphCommand', 'Paste executed');
  }

  canPaste(): boolean {
    return this.clipboardService.hasContent();
  }

  delete(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      // locked cells (locked=1) are not deleted, nor are their edges (draw.io deleteCells)
      this.graph.removeCells(this.graph.getDeletableCells(cells));
      this.notifyListeners('stateChanged');
      logger.debug('GraphCommand', 'Delete executed');
    }
  }

  /**
   * Arrow keys (draw.io nudge): moves the selection by (dx, dy) as one undoable edit. Only movable
   * cells move: locked cells (`locked=1` on them, a group or their layer) stay put; children of a
   * selected group move with it (only the topmost selected cells are moved).
   * @returns whether anything moved
   */
  nudge(dx: number, dy: number): boolean {
    const selection = this.graph.getSelectionCells();
    const topmost = selection.filter((cell) => {
      for (let p = cell.getParent(); p; p = p.getParent()) if (selection.includes(p)) return false;
      return true;
    });
    const cells = this.graph.getMovableCells(topmost);
    if (cells.length === 0 || (dx === 0 && dy === 0)) return false;
    // draw.io nudge: exactly (dx, dy); snap to track never pulls the cells back onto a line
    withSnapDataOnly(() => this.graph.moveCells(cells, dx, dy));
    return true;
  }

  /**
   * Edit > Select All / Ctrl+A, like draw.io's `selectAll` action (`graph.selectAll(null, true)`):
   * every displayed cell of the default layer, descendants included; nothing when the layer is locked.
   */
  selectAll(): void {
    const parent = this.graph.getDefaultParent();
    const locked = (this.graph.getCellStyle(parent) as Record<string, unknown>).locked;
    if (locked === true || locked === 1 || locked === '1') return;
    this.graph.selectAll(parent, true);
  }

  clearSelection(): void {
    this.graph.clearSelection();
    logger.debug('GraphCommand', 'Clear Selection executed');
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

  /** Arrange > To Front: the selected cells on top of their parents, keeping their relative order. */
  toFront(): void {
    this.orderSelection(false);
  }

  /** Arrange > To Back: the selected cells at the bottom of their parents, keeping their relative order. */
  toBack(): void {
    this.orderSelection(true);
  }

  /** Arrange > Bring Forward: each selected cell one step up within its parent (one undoable edit). */
  bringForward(): void {
    this.stepSelection(1);
  }

  /** Arrange > Send Backward: each selected cell one step down within its parent (one undoable edit). */
  sendBackward(): void {
    this.stepSelection(-1);
  }

  /**
   * draw.io's toFront/toBack (`graph.orderCells(back)` on the sorted selection). maxGraph 0.10's
   * orderCells never sorts the selection itself, so the cells are passed in model order.
   */
  private orderSelection(back: boolean): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;
    this.graph.orderCells(back, styleUtils.sortCells(cells, true));
    this.notifyListeners('stateChanged');
  }

  private stepSelection(step: 1 | -1): void {
    const byParent = new Map<Cell, Set<Cell>>();
    for (const cell of this.graph.getSelectionCells()) {
      const parent = cell.getParent();
      if (!parent) continue;
      if (!byParent.has(parent)) byParent.set(parent, new Set());
      byParent.get(parent)!.add(cell);
    }
    if (byParent.size === 0) return;
    const model = this.graph.getDataModel();
    model.batchUpdate(() => {
      for (const [parent, selected] of byParent) {
        const target = stepOrder(parent.children, selected, step);
        // Earlier positions are final, so each add moves the wanted cell down to index k
        target.forEach((cell, k) => {
          if (parent.children[k] !== cell) model.add(parent, cell, k);
        });
      }
    });
    this.notifyListeners('stateChanged');
  }

  /**
   * Copy style from selected cells for format painter
   */
  private copiedStyle: StyleRecord | null = null;

  /** Edit > Copy Style / format painter: the visual keys of the first selected cell (draw.io). */
  copyStyle(): void {
    const cell = this.graph.getSelectionCells().find((c) => c.isVertex() || c.isEdge());
    if (!cell) return;
    this.copiedStyle = copyPasteStyle(this.graph, cell);
    this.notifyListeners('styleChanged');
  }

  /**
   * Paste Style: only the copied visual keys change on the selected cells (draw.io pasteStyle;
   * shape, stencil, lock and railway data stay), locked cells are skipped, one undo step.
   */
  pasteStyle(): void {
    if (!this.copiedStyle) return;
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;
    const changed = pasteStyleToCells(this.graph, cells, this.copiedStyle);
    if (changed.length) this.notifyListeners('stateChanged');
  }

  /**
   * Get copied style (for format painter UI)
   */
  hasCopiedStyle(): boolean {
    return this.copiedStyle !== null;
  }
}
