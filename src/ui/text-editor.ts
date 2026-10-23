import { Graph, InternalEvent, styleUtils } from '@maxgraph/core';
import { cellAtBackgroundPoint } from './canvas-interaction';
import type { Cell, EventObject } from '@maxgraph/core';
import { shouldIgnoreGraphShortcut } from './delete';
import { logger } from '../drawio/logger';
import { railwayObjectOf, renameObjectId } from '../railway/rename-id';
import { readObjectId } from '../railway/object-data';
import { getKind } from '../railway/catalogue';
import { getCellKind } from '../railway/object-data';
import { globalNotificationManager } from './notification';

/** Inline editor textarea carrying its document mousedown handler for later removal. */
type EditingTextArea = HTMLTextAreaElement & { __clickOutsideHandler?: (evt: MouseEvent) => void };

export class TextEditorController {
  private graph: Graph;
  private currentEditingCell: Cell | null = null;
  private editingInput: EditingTextArea | null = null;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTextEditingHandlers();
  }

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
        if (mouse?.shiftKey) window.dispatchEvent(new CustomEvent('railway-edit-data-request'));
        else this.startIdEditing(object);
        return;
      }
      if (cell && cell.isVertex && cell.isVertex()) {
        logger.debug('TextEditor', 'Double-click detected on vertex:', cell.value);
        evt.consume(); // Prevent default behavior
        this.startInlineEditing(cell);
      }
    });

    // Listen for Enter/Space key on selected shapes
    document.addEventListener('keydown', (evt: KeyboardEvent) => {
      // Ignore text editing (inputs, selects, contentEditable, active cell editor)
      if (shouldIgnoreGraphShortcut(evt, this.graph)) {
        return;
      }

      if (evt.key === 'Enter' || evt.key === ' ') {
        const cells = this.graph.getSelectionCells();
        if (cells.length === 1 && cells[0].isVertex && cells[0].isVertex()) {
          logger.debug('TextEditor', 'Enter/Space pressed, starting edit for:', cells[0].value);
          evt.preventDefault();
          this.startInlineEditing(cells[0]);
        }
      }
    });
  }

  private startInlineEditing(cell: Cell): void {
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
    this.editingInput = document.createElement('textarea') as EditingTextArea;
    if (!this.editingInput) {
      console.error('[TextEditor] Failed to create textarea element');
      return;
    }

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

    // Handle Escape to cancel editing
    this.editingInput.addEventListener('keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        this.cancelEditing();
      }
    });

    // Handle click outside to close editing
    const handleClickOutside = (evt: MouseEvent) => {
      if (this.editingInput && evt.target && !this.editingInput.contains(evt.target as Node)) {
        this.stopEditing();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    // Store handler so we can remove it later
    this.editingInput.__clickOutsideHandler = handleClickOutside;

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
    const outside = (e: MouseEvent): void => {
      if (e.target !== input && !commit()) e.preventDefault();
    };
    document.addEventListener('mousedown', outside, true);
    this.idEditor = { input, outside };
    document.body.appendChild(input);
    input.focus();
    input.select();
  }

  private idEditor: { input: HTMLInputElement; outside: (e: MouseEvent) => void } | null = null;

  private cancelIdEditing(): void {
    if (!this.idEditor) return;
    document.removeEventListener('mousedown', this.idEditor.outside, true);
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

    // Remove click outside handler
    const handler = input.__clickOutsideHandler;
    if (handler) {
      document.removeEventListener('mousedown', handler);
    }

    // Clean up - check if element is still in DOM before removing
    if (input.parentNode) {
      input.remove();
    }

    // Update cell value; cellLabelChanged keeps the other attributes of a UserObject value
    this.graph.cellLabelChanged(cell, newText, false);
    this.graph.refresh();

    this.editingInput = null;
    this.currentEditingCell = null;
  }

  /**
   * Ends an edit still open when the tab closes: removes the overlay textarea and its
   * `document` mousedown listener, which are added per edit and so not managed by the TabManager.
   */
  destroy(): void {
    this.cancelEditing();
    this.cancelIdEditing();
  }

  private cancelEditing(): void {
    if (this.editingInput) {
      const input = this.editingInput;

      // Remove click outside handler
      const handler = input.__clickOutsideHandler;
      if (handler) {
        document.removeEventListener('mousedown', handler);
      }

      // Check if element is still in DOM before removing
      if (input.parentNode) {
        input.remove();
      }
      this.editingInput = null;
    }
    this.currentEditingCell = null;
    logger.debug('TextEditor', 'Editing cancelled');
  }
}
