import { Graph, type Cell } from '@maxgraph/core';
import { shouldIgnoreGraphShortcut } from './delete';
import { prepareClonedCells } from '../railway/clone';

export class DuplicateOffsetController {
  private graph: Graph;
  private defaultOffset = 20;
  /** Closes the open "Duplicate Multiple Times" dialog and removes its listeners */
  private closeOpenDialog: (() => void) | null = null;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupButtons();
    this.setupKeyboardShortcuts();
  }

  private setupButtons(): void {
    const duplicateBtn = document.getElementById('btn-duplicate');
    const duplicateMultiBtn = document.getElementById('btn-duplicate-multi');

    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', () => this.duplicateOnce());
    }
    if (duplicateMultiBtn) {
      duplicateMultiBtn.addEventListener('click', () => this.showDuplicateDialog());
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (shouldIgnoreGraphShortcut(e, this.graph)) {
        return;
      }

      // Ctrl/Cmd + D for duplicate with offset
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.duplicateOnce();
      }
    });
  }

  duplicateOnce(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.duplicateWithOffset(selected, 1, this.defaultOffset);
  }

  private showDuplicateDialog(): void {
    this.closeOpenDialog?.();
    const modal = document.createElement('div');
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    const closeDialog = () => {
      document.removeEventListener('keydown', onEscape);
      modal.remove();
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
    document.body.appendChild(modal);

    // Focus on count input
    countInput.focus();
    countInput.select();

    // Close on background click or escape
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDialog();
    });

    // Registered after construction, so the TabManager's per-tab listener swap does not see it:
    // it lives exactly as long as the dialog and is removed with it (it used to stay on
    // `document` for good, one more per dialog opened, in every tab)
    document.addEventListener('keydown', onEscape);
    this.closeOpenDialog = closeDialog;
  }

  private duplicateWithOffset(cells: Cell[], count: number, offset: number): void {
    const selected = cells.filter((cell: Cell) => !cell.isEdge?.());
    if (selected.length === 0) return;

    const duplicated: Cell[] = [];

    this.graph.batchUpdate(() => {
      for (let i = 0; i < count; i++) {
        const cloned = this.graph.cloneCells(selected);
        // railway IDs unique (each round sees the previous one), copies lose route / railML ids
        prepareClonedCells(this.graph.getDataModel(), cloned);
        const imported = this.graph.importCells(cloned, offset * (i + 1), offset * (i + 1));
        duplicated.push(...imported);
      }
      this.graph.setSelectionCells(duplicated);
    });
  }

  destroy(): void {
    // A dialog left open when the tab closes goes with the tab, with its document listener
    this.closeOpenDialog?.();
  }
}
