import { Graph, type Cell } from '@maxgraph/core';
import { prepareClonedCells } from '../railway/clone';
import { openModal } from '../core/modal';

export class DuplicateOffsetController {
  private graph: Graph;
  private defaultOffset = 20;
  /** Closes the open "Duplicate Multiple Times" dialog and removes its listeners */
  private closeOpenDialog: (() => void) | null = null;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  duplicateOnce(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.duplicateWithOffset(selected, 1, this.defaultOffset);
  }

  /** The "Duplicate Multiple Times" dialog (count and offset). */
  showDuplicateDialog(): void {
    this.closeOpenDialog?.();
    const modal = document.createElement('div');
    const closeDialog = () => {
      handle.close();
      if (this.closeOpenDialog === closeDialog) this.closeOpenDialog = null;
    };
    modal.style.cssText = `
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--rd-overlay);
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--rd-surface);
      border-radius: 8px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 2px 12px var(--rd-shadow);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Duplicate Multiple Times';
    title.style.cssText = 'margin: 0 0 16px 0; color: var(--rd-text);';
    content.appendChild(title);

    // Number of duplicates
    const countLabel = document.createElement('label');
    countLabel.textContent = 'Number of copies:';
    countLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600; color: var(--rd-text);';
    content.appendChild(countLabel);

    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.value = '3';
    countInput.min = '1';
    countInput.max = '10';
    countInput.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid var(--rd-border-strong);
      border-radius: 4px;
      box-sizing: border-box;
      margin-bottom: 16px;
    `;
    content.appendChild(countInput);

    // Offset
    const offsetLabel = document.createElement('label');
    offsetLabel.textContent = 'Offset (px):';
    offsetLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600; color: var(--rd-text);';
    content.appendChild(offsetLabel);

    const offsetInput = document.createElement('input');
    offsetInput.type = 'number';
    offsetInput.value = this.defaultOffset.toString();
    offsetInput.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid var(--rd-border-strong);
      border-radius: 4px;
      box-sizing: border-box;
      margin-bottom: 16px;
    `;
    content.appendChild(offsetInput);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create Duplicates';
    createBtn.style.cssText = `
      padding: 10px 16px;
      background: var(--rd-accent);
      color: var(--rd-accent-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    `;
    createBtn.addEventListener('click', () => {
      const count = parseInt(countInput.value, 10);
      const offset = parseInt(offsetInput.value, 10);

      if (count > 0) {
        const selected = this.graph.getSelectionCells();
        this.duplicateWithOffset(selected, count, offset);
        closeDialog();
      }
    });
    buttonContainer.appendChild(createBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.style.cssText = `
      padding: 10px 16px;
      background: var(--rd-surface-3);
      color: var(--rd-text);
      border: 1px solid var(--rd-border-strong);
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    `;
    closeBtn.addEventListener('click', () => closeDialog());
    buttonContainer.appendChild(closeBtn);

    content.appendChild(buttonContainer);
    modal.appendChild(content);
    // Esc / backdrop close it; focus trap and return, keys kept from the diagram shortcuts: the
    // app's modal primitive (core/modal.ts), released with the dialog
    const handle = openModal({ overlay: modal, dialog: content, labelledBy: title, backdropEvent: 'click', onCancel: closeDialog });

    // Focus on count input
    countInput.focus();
    countInput.select();

    this.closeOpenDialog = closeDialog;
  }

  private duplicateWithOffset(cells: Cell[], count: number, offset: number): void {
    duplicateCells(this.graph, cells, count, offset);
  }

  destroy(): void {
    // A dialog left open when the tab closes goes with the tab, with its document listener
    this.closeOpenDialog?.();
  }
}

/**
 * Duplicates the vertices among `cells` (selected edges are skipped, like before) `count` times, `offset` px
 * apart, in one undo step and selects the copies.
 * Railway IDs stay unique (each round sees the previous one), copies lose route / railML ids
 * (src/railway/clone.ts). Ctrl/Cmd+D, Edit > Duplicate and the context menu use it.
 */
export function duplicateCells(graph: Graph, cells: Cell[], count = 1, offset = 20): Cell[] {
  const selected = cells.filter((cell: Cell) => !cell.isEdge?.());
  if (selected.length === 0) return [];

  const duplicated: Cell[] = [];

  graph.batchUpdate(() => {
    for (let i = 0; i < count; i++) {
      const cloned = graph.cloneCells(selected);
      prepareClonedCells(graph.getDataModel(), cloned);
      const imported = graph.importCells(cloned, offset * (i + 1), offset * (i + 1));
      duplicated.push(...imported);
    }
    graph.setSelectionCells(duplicated);
  });
  return duplicated;
}
