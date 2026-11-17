import { Graph, InternalEvent, styleUtils } from '@maxgraph/core';
import { cellAtBackgroundPoint } from './canvas-interaction';
import type { Cell, EventObject } from '@maxgraph/core';
import { logger } from '../drawio/logger';
import { emit } from '../core/event-bus';
import { railwayObjectOf, renameObjectId } from '../railway/rename-id';
import { readObjectId } from '../railway/object-data';
import { getKind } from '../railway/catalogue';
import { getCellKind } from '../railway/object-data';
import { globalNotificationManager } from './notification';

/**
 * Label and ID editors, and how a press outside them ends the edit (draw.io rules):
 * - a press anywhere outside the open editor (label textarea, railway ID field or maxGraph's cell editor)
 *   commits it first (document pointerdown, capture phase: maxGraph cancels the pointerdown of a canvas press,
 *   so no compatibility `mousedown` follows and a mousedown listener never saw canvas presses);
 * - when that press is a click on the empty canvas, the click only ends the edit: the edited cell stays
 *   selected (draw.io), the next click on the empty canvas deselects; a press on another object selects it;
 * - Escape cancels the label / ID editor (the selection stays; a second Escape clears it, edit.ts),
 *   Ctrl/Cmd+Enter commits the label (Enter is a new line, like draw.io).
 */
export class TextEditorController {
  private graph: Graph;
  private currentEditingCell: Cell | null = null;
  private editingInput: HTMLTextAreaElement | null = null;
  /** The current press on the canvas ended an edit: its click must not clear the selection. */
  private keepSelectionOnClick = false;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTextEditingHandlers();
    document.addEventListener('pointerdown', this.onPointerDown, true);
    this.graph.addListener(InternalEvent.CLICK, this.onGraphClick);
  }

  /** Whether a label or ID editor of this controller is open. */
  isEditing(): boolean {
    return !!this.editingInput || !!this.idEditor;
  }

  /** A press outside the open editor commits it (before the graph sees the press). */
  private readonly onPointerDown = (evt: PointerEvent): void => {
    this.keepSelectionOnClick = false;
    const target = evt.target instanceof Node ? evt.target : null;
    const onCanvas = !!target && this.graph.container.contains(target);
    if (this.editingInput && target && !this.editingInput.contains(target)) {
      this.stopEditing();
      this.keepSelectionOnClick = onCanvas;
    } else if (this.idEditor && target !== this.idEditor.input) {
      const input = this.idEditor.input;
      if (!this.idEditor.commit()) {
        // refused ID: the field stays open with the reason, the press does nothing else
        evt.preventDefault();
        evt.stopPropagation();
        setTimeout(() => input.focus());
        return;
      }
      this.keepSelectionOnClick = onCanvas;
    } else if (this.graph.isEditing() && onCanvas && !this.isCellEditorSource(target)) {
      // maxGraph's cell editor (an edge label): committed like draw.io (invokesStopCellEditing)
      this.graph.stopEditing(false);
      this.keepSelectionOnClick = true;
    }
  };

  /** Whether `node` is inside maxGraph's cell editor (its contentEditable). */
  private isCellEditorSource(node: Node | null): boolean {
    const editor = this.graph.getPlugin('CellEditorHandler') as unknown as { textarea?: HTMLElement | null } | undefined;
    return !!node && !!editor?.textarea && editor.textarea.contains(node);
  }

  /** The click of a press that ended an edit on the empty canvas keeps the selection (draw.io). */
  private readonly onGraphClick = (_sender: unknown, evt: EventObject): void => {
    const keep = this.keepSelectionOnClick;
    this.keepSelectionOnClick = false;
    if (keep && !evt.getProperty('cell')) evt.consume();
  };

  private setupTextEditingHandlers(): void {
    // Listen for double-click to start inline text editing
    this.graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: unknown, evt: EventObject) => {
      const cell: Cell | undefined = evt.getProperty('cell');
      // Railway objects (rdKind: signal, track, section, points, balise, ...): the double-click edits the ID in
      // place (references follow, rename-id.ts); Shift+double-click opens the Data panel
      const mouse = evt.getProperty('event') as MouseEvent | undefined;
      // a double-click in a gap of a transparent symbol group (the signal's centre) has no cell: the object
      // whose bounds hold the point, like a press there (canvas-interaction.ts)
      let hit = cell ?? null;
      if (!hit && mouse) {
        const pt = styleUtils.convertPoint(this.graph.container, mouse.clientX, mouse.clientY);
        hit = cellAtBackgroundPoint(this.graph, pt.x, pt.y);
      }
      const object = railwayObjectOf(hit);
      if (object) {
        evt.consume();
        this.graph.setSelectionCell(object);
        if (mouse?.shiftKey) emit('railway-edit-data-request');
        else this.startIdEditing(object);
        return;
      }
      if (cell && cell.isVertex && cell.isVertex()) {
        logger.debug('TextEditor', 'Double-click detected on vertex:', cell.value);
        evt.consume(); // Prevent default behavior
        this.startInlineEditing(cell);
      }
    });

    // Enter / Space on one selected shape: the `edit.startEditing` command (ui/commands/edit.ts)
  }

  /** The label editor of `cell` (double-click, Enter / Space). */
  startInlineEditing(cell: Cell): void {
    logger.debug('TextEditor', 'Starting inline editing for cell:', cell.value);

    // Stop any existing editing
    this.stopEditing();

    this.currentEditingCell = cell;
    const container = this.graph.getContainer();
    const view = this.graph.getView();

    // Get cell state which contains the bounds
    const state = view.getState(cell);
    if (!state) {
      console.error('[TextEditor] Could not get cell state');
      return;
    }

    // CellState has x, y, width, height properties directly
    const bounds = {
      x: state.x || 0,
      y: state.y || 0,
      width: state.width || 80,
      height: state.height || 60,
    };

    logger.debug('TextEditor', 'Cell bounds:', bounds);

    // Create textarea element (supports multi-line text)
    this.editingInput = document.createElement('textarea');
    this.editingInput.className = 'rd-label-editor';

    // convertValueToString: the label of a draw.io UserObject value, not the element itself
    this.editingInput.value = this.graph.convertValueToString(cell);
    this.editingInput.style.position = 'fixed';
    this.editingInput.style.zIndex = '10000';
    this.editingInput.style.border = '2px solid var(--rd-focus)';
    this.editingInput.style.borderRadius = '3px';
    this.editingInput.style.padding = '4px';
    this.editingInput.style.fontFamily = 'Arial, sans-serif';
    this.editingInput.style.fontSize = '14px';
    this.editingInput.style.boxSizing = 'border-box';
    this.editingInput.style.backgroundColor = 'var(--rd-input-bg)';
    this.editingInput.style.color = 'var(--rd-input-text)';
    this.editingInput.style.resize = 'none';
    this.editingInput.style.overflow = 'auto';

    // Get container position for offset calculation
    const containerRect = container.getBoundingClientRect();

    // Position input over the cell (using fixed positioning relative to viewport; the graph div
    // is the scroll container)
    const left = containerRect.left + container.clientLeft + bounds.x - container.scrollLeft + 4;
    const top = containerRect.top + container.clientTop + bounds.y - container.scrollTop + 4;
    const width = Math.max(bounds.width - 8, 100);
    const height = Math.max(bounds.height - 8, 24);

    this.editingInput.style.left = `${left}px`;
    this.editingInput.style.top = `${top}px`;
    this.editingInput.style.width = `${width}px`;
    this.editingInput.style.height = `${height}px`;

    // Add to document
    document.body.appendChild(this.editingInput);

    // Focus and select all text
    this.editingInput.focus();
    this.editingInput.select();

    // Escape cancels, Ctrl/Cmd+Enter commits (Enter is a new line); a press outside commits (onPointerDown)
    this.editingInput.addEventListener('keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        this.cancelEditing();
      } else if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
        evt.preventDefault();
        this.stopEditing();
      }
    });

    logger.debug('TextEditor', 'Inline text input created and focused at', { left, top, width, height });
  }

  /**
   * In-place editor of a railway object's ID: a one-line field over the object, prefilled with its rdId;
   * Enter / a click outside commits (unique per kind, references renumbered, one undo step), Esc cancels. A
   * refused ID keeps the field open with the reason (aria-invalid, title, notification).
   */
  startIdEditing(object: Cell): void {
    this.stopEditing();
    this.cancelIdEditing();
    const state = this.graph.view.getState(object);
    if (!state) return;
    const container = this.graph.getContainer();
    const rect = container.getBoundingClientRect();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rd-input rd-id-editor';
    input.dataset.testid = 'rd-id-editor';
    input.spellcheck = false;
    input.value = readObjectId(object);
    const kind = getKind(getCellKind(object));
    input.setAttribute('aria-label', `${kind?.label ?? 'Object'} ID`);
    input.placeholder = kind ? `${kind.idPrefix}1` : 'ID';
    const width = Math.max(90, Math.min(state.width, 200));
    const cx = rect.left + container.clientLeft + state.x + state.width / 2 - container.scrollLeft;
    const cy = rect.top + container.clientTop + state.y + state.height / 2 - container.scrollTop;
    input.style.cssText = `position: fixed; z-index: 10000; left: ${Math.round(cx - width / 2)}px; top: ${Math.round(cy - 14)}px; width: ${width}px; height: 28px; box-sizing: border-box; border: 2px solid var(--rd-focus); border-radius: 3px; padding: 2px 6px; font: 13px Arial, sans-serif; background: var(--rd-input-bg); color: var(--rd-input-text);`;
    const commit = (): boolean => {
      const result = renameObjectId(this.graph.getDataModel(), object, input.value);
      if (!result.ok) {
        input.setAttribute('aria-invalid', 'true');
        input.title = result.error;
        globalNotificationManager.error(result.error);
        input.focus();
        return false;
      }
      this.cancelIdEditing();
      return true;
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelIdEditing();
      }
    });
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
    this.idEditor = { input, commit };
    document.body.appendChild(input);
    input.focus();
    input.select();
  }

  private idEditor: { input: HTMLInputElement; commit: () => boolean } | null = null;

  private cancelIdEditing(): void {
    if (!this.idEditor) return;
    this.idEditor.input.remove();
    this.idEditor = null;
  }

  private stopEditing(): void {
    if (!this.currentEditingCell || !this.editingInput) {
      return;
    }

    const input = this.editingInput;
    const cell = this.currentEditingCell;
    const newText = input.value;
    logger.debug('TextEditor', 'Saving text:', newText);

    this.editingInput = null;
    this.currentEditingCell = null;
    input.remove();

    // Update cell value; cellLabelChanged keeps the other attributes of a UserObject value. The model
    // change redraws the cell; no graph.refresh(): it would rebuild every shape while the press that
    // ended the edit (onPointerDown) is still being dispatched to them
    this.graph.cellLabelChanged(cell, newText, false);
  }

  /**
   * Ends an edit still open when the tab closes (removes the overlay field) and the `document`
   * pointerdown listener.
   */
  destroy(): void {
    this.cancelEditing();
    this.cancelIdEditing();
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.graph.removeListener(this.onGraphClick);
  }

  private cancelEditing(): void {
    if (this.editingInput) {
      this.editingInput.remove();
      this.editingInput = null;
    }
    this.currentEditingCell = null;
    logger.debug('TextEditor', 'Editing cancelled');
  }
}
