import { Graph } from '@maxgraph/core';

export class DuplicateOffsetController {
  private graph: Graph;
  private defaultOffset = 20;

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
    const modal = document.createElement('div');
    modal.style.cssText = `
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Duplicate Multiple Times';
    title.style.cssText = 'margin: 0 0 16px 0; color: #333;';
    content.appendChild(title);

    // Number of duplicates
    const countLabel = document.createElement('label');
    countLabel.textContent = 'Number of copies:';
    countLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600; color: #333;';
    content.appendChild(countLabel);

    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.value = '3';
    countInput.min = '1';
    countInput.max = '10';
    countInput.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
      margin-bottom: 16px;
    `;
    content.appendChild(countInput);

    // Offset
    const offsetLabel = document.createElement('label');
    offsetLabel.textContent = 'Offset (px):';
    offsetLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600; color: #333;';
    content.appendChild(offsetLabel);

    const offsetInput = document.createElement('input');
    offsetInput.type = 'number';
    offsetInput.value = this.defaultOffset.toString();
    offsetInput.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
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
      background: #1976d2;
      color: white;
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
        modal.remove();
      }
    });
    buttonContainer.appendChild(createBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.style.cssText = `
      padding: 10px 16px;
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    `;
    closeBtn.addEventListener('click', () => modal.remove());
    buttonContainer.appendChild(closeBtn);

    content.appendChild(buttonContainer);
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Focus on count input
    countInput.focus();
    countInput.select();

    // Close on background click or escape
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') modal.remove();
    });
  }

  private duplicateWithOffset(cells: any[], count: number, offset: number): void {
    const selected = cells.filter((cell: any) => !cell.isEdge?.());
    if (selected.length === 0) return;

    const duplicated: any[] = [];

    this.graph.batchUpdate(() => {
      for (let i = 0; i < count; i++) {
        const cloned = this.graph.cloneCells(selected);
        const imported = this.graph.importCells(cloned, offset * (i + 1), offset * (i + 1));
        duplicated.push(...imported);
      }
      this.graph.setSelectionCells(duplicated);
    });

    console.log(`[DuplicateOffset] Created ${count} duplicates with ${offset}px offset`);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
