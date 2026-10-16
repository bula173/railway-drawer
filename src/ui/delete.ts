import { Graph } from '@maxgraph/core';

/**
 * True when keyboard focus is in a native text control or a contentEditable element
 * (this includes maxGraph's in-place label editor, which is a contentEditable div).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Shared focus guard for graph keyboard shortcuts (Delete/Backspace, Ctrl+C/X/V/A, ...).
 * Returns true when the key event belongs to text editing and must be left to the browser:
 * the event target (or the focused element) is editable, or the graph's cell editor is active.
 */
export function shouldIgnoreGraphShortcut(event: KeyboardEvent, graph?: Graph | null): boolean {
  if (event.isComposing) return true;
  if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return true;
  return !!graph && graph.isEditing();
}

/**
 * Deletes the selected cells of one graph.
 * Keyboard handling (Delete/Backspace) is dispatched once, to the active tab, by the global
 * shortcut handler in main-editor.ts; this controller no longer binds to `document` itself, because
 * one listener per tab acted on every tab (including hidden ones) and ignored text editing.
 */
export class DeleteController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  deleteSelection() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    this.graph.batchUpdate(() => {
      this.graph.removeCells(cells);
    });

    console.log('[Delete] Deleted', cells.length, 'cell(s)');
  }
}
