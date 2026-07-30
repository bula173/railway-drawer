export class ShortcutsHelpController {
  private modal: HTMLDivElement | null = null;

  constructor() {
    this.setupHelpButton();
  }

  private setupHelpButton(): void {
    const helpBtn = document.getElementById('btn-shortcuts-help');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showShortcuts());
    }

    // Also support F1 for help
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        this.showShortcuts();
      }
    });
  }

  private showShortcuts(): void {
    if (this.modal) {
      this.modal.style.display = 'flex';
      return;
    }

    this.createModal();
    if (this.modal) {
      (this.modal as HTMLDivElement).style.display = 'flex';
    }
  }

  private createModal(): void {
    this.modal = document.createElement('div') as HTMLDivElement;
    this.modal.style.cssText = `
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

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const title = document.createElement('h2');
    title.textContent = '⌨️ Keyboard Shortcuts';
    title.style.cssText = 'margin: 0 0 20px 0; font-size: 20px; color: #333;';
    modalContent.appendChild(title);

    const shortcuts = [
      { section: 'Selection', items: [
        ['Ctrl+A / Cmd+A', 'Select all objects'],
        ['Escape', 'Deselect all'],
      ]},
      { section: 'Editing', items: [
        ['Ctrl+C / Cmd+C', 'Copy'],
        ['Ctrl+X / Cmd+X', 'Cut'],
        ['Ctrl+V / Cmd+V', 'Paste'],
        ['Delete', 'Delete selected'],
        ['Ctrl+Z / Cmd+Z', 'Undo'],
        ['Ctrl+Y / Cmd+Y', 'Redo'],
      ]},
      { section: 'Zoom', items: [
        ['Ctrl++ / Cmd++', 'Zoom in'],
        ['Ctrl+- / Cmd+-', 'Zoom out'],
        ['Ctrl+0 / Cmd+0', 'Reset zoom (100%)'],
        ['Ctrl+1 / Cmd+1', 'Fit to view'],
        ['Ctrl+Scroll', 'Zoom with mouse wheel'],
      ]},
      { section: 'Alignment', items: [
        ['N/A', 'Use toolbar buttons or right-click menu'],
      ]},
      { section: 'Transform', items: [
        ['Ctrl+H / Cmd+H', 'Flip horizontal'],
        ['Ctrl+J / Cmd+J', 'Flip vertical'],
        ['Ctrl+R / Cmd+R', 'Rotate 90° clockwise'],
        ['Ctrl+Shift+R / Cmd+Shift+R', 'Rotate 90° counter-clockwise'],
      ]},
      { section: 'Organization', items: [
        ['Ctrl+G / Cmd+G', 'Group selected'],
        ['Ctrl+Shift+G / Cmd+Shift+G', 'Ungroup'],
      ]},
      { section: 'Other', items: [
        ['F1', 'Show this help dialog'],
        ['Ctrl+S / Cmd+S', 'Save project'],
      ]},
    ];

    shortcuts.forEach(({ section, items }) => {
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = section;
      sectionTitle.style.cssText = `
        margin: 16px 0 8px 0;
        font-size: 14px;
        color: #666;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;
      modalContent.appendChild(sectionTitle);

      const table = document.createElement('table');
      table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      `;

      items.forEach(([shortcut, description]) => {
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom: 1px solid #eee;';

        const keyCell = document.createElement('td');
        keyCell.textContent = shortcut;
        keyCell.style.cssText = `
          padding: 8px 12px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: 600;
          color: #0066cc;
          width: 200px;
          vertical-align: top;
        `;

        const descCell = document.createElement('td');
        descCell.textContent = description;
        descCell.style.cssText = `
          padding: 8px 12px;
          font-size: 13px;
          color: #555;
          vertical-align: top;
        `;

        row.appendChild(keyCell);
        row.appendChild(descCell);
        table.appendChild(row);
      });

      modalContent.appendChild(table);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close (or press Escape)';
    closeBtn.style.cssText = `
      padding: 10px 16px;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 16px;
    `;
    closeBtn.addEventListener('click', () => this.closeModal());
    modalContent.appendChild(closeBtn);

    this.modal.appendChild(modalContent);
    document.body.appendChild(this.modal);

    // Close on background click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.style.display === 'flex') {
        this.closeModal();
      }
    });
  }

  private closeModal(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  destroy(): void {
    if (this.modal?.parentElement) {
      this.modal.parentElement.removeChild(this.modal);
    }
    this.modal = null;
  }
}
