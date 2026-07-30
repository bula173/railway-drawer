import { Graph, InternalEvent } from '@maxgraph/core';

export class TextEditorController {
  private graph: Graph;
  private currentEditingCell: any = null;
  private editingInput: HTMLInputElement | null = null;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTextEditingHandlers();
  }

  private setupTextEditingHandlers(): void {
    // Listen for double-click to start inline text editing
    this.graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: any, evt: any) => {
      const cell = evt.getProperty('cell');
      if (cell && cell.isVertex && cell.isVertex()) {
        console.log('[TextEditor] Double-click detected on vertex:', cell.value);
        evt.consume(); // Prevent default behavior
        this.startInlineEditing(cell);
      }
    });

    // Listen for Enter/Space key on selected shapes
    document.addEventListener('keydown', (evt: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (evt.target instanceof HTMLInputElement || evt.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (evt.key === 'Enter' || evt.key === ' ') {
        const cells = this.graph.getSelectionCells();
        if (cells.length === 1 && cells[0].isVertex && cells[0].isVertex()) {
          console.log('[TextEditor] Enter/Space pressed, starting edit for:', cells[0].value);
          evt.preventDefault();
          this.startInlineEditing(cells[0]);
        }
      }
    });
  }

  private startInlineEditing(cell: any): void {
    console.log('[TextEditor] Starting inline editing for cell:', cell.value);

    // Stop any existing editing
    this.stopEditing();

    this.currentEditingCell = cell;
    const container = this.graph.getContainer();
    const view = (this.graph as any).getView();

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

    console.log('[TextEditor] Cell bounds:', bounds);

    // Create textarea element (supports multi-line text)
    this.editingInput = document.createElement('textarea') as any;
    if (!this.editingInput) {
      console.error('[TextEditor] Failed to create textarea element');
      return;
    }

    this.editingInput.value = cell.value || '';
    this.editingInput.style.position = 'fixed';
    this.editingInput.style.zIndex = '10000';
    this.editingInput.style.border = '2px solid #2196F3';
    this.editingInput.style.borderRadius = '3px';
    this.editingInput.style.padding = '4px';
    this.editingInput.style.fontFamily = 'Arial, sans-serif';
    this.editingInput.style.fontSize = '14px';
    this.editingInput.style.boxSizing = 'border-box';
    this.editingInput.style.backgroundColor = '#fff';
    this.editingInput.style.resize = 'none';
    this.editingInput.style.overflow = 'auto';

    // Get container position for offset calculation
    const containerRect = container.getBoundingClientRect();

    // Position input over the cell (using fixed positioning relative to viewport)
    const left = containerRect.left + bounds.x + 4;
    const top = containerRect.top + bounds.y + 4;
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
    (this.editingInput as any).__clickOutsideHandler = handleClickOutside;

    console.log('[TextEditor] Inline text input created and focused at', { left, top, width, height });
  }

  private stopEditing(): void {
    if (!this.currentEditingCell || !this.editingInput) {
      return;
    }

    const input = this.editingInput;
    const cell = this.currentEditingCell;
    const newText = input.value;
    console.log('[TextEditor] Saving text:', newText);

    // Remove click outside handler
    const handler = (input as any).__clickOutsideHandler;
    if (handler) {
      document.removeEventListener('mousedown', handler);
    }

    // Clean up - check if element is still in DOM before removing
    if (input.parentNode) {
      input.remove();
    }

    // Update cell value
    this.graph.model.setValue(cell, newText);
    this.graph.refresh();

    this.editingInput = null;
    this.currentEditingCell = null;
  }

  private cancelEditing(): void {
    if (this.editingInput) {
      const input = this.editingInput;

      // Remove click outside handler
      const handler = (input as any).__clickOutsideHandler;
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
    console.log('[TextEditor] Editing cancelled');
  }
}
