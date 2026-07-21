import { Graph } from '@maxgraph/core';

export class ContextMenuController {
  private graph: Graph;
  private contextMenu: HTMLElement | null;
  private currentCell: any = null;
  private clipboard: any[] = [];

  constructor(graph: Graph) {
    this.graph = graph;
    this.contextMenu = document.getElementById('context-menu');
    this.setupContextMenu();
  }

  private setupContextMenu() {
    // Show context menu on right-click
    document.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#graph-container')) {
        e.preventDefault();
        const rect = document.getElementById('graph-container')!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Get cell at click position
        const cell = this.graph.getCellAt(x, y);
        if (cell) {
          this.currentCell = cell;
          this.graph.setSelectionCells([cell]);
          this.showContextMenu(e.clientX, e.clientY);
        }
      }
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // Hide context menu on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
      }
    });

    // Setup menu item clicks
    const menuItems = document.querySelectorAll('.context-menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        if (action) {
          this.executeAction(action);
        }
        this.hideContextMenu();
      });
    });
  }

  private showContextMenu(x: number, y: number) {
    if (!this.contextMenu) return;
    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
  }

  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  private executeAction(action: string) {
    if (!this.currentCell) return;

    switch (action) {
      case 'delete':
        this.graph.removeCells([this.currentCell]);
        break;

      case 'cut':
        this.clipboard = this.graph.cloneCells([this.currentCell]);
        this.graph.removeCells([this.currentCell]);
        break;

      case 'copy':
        this.clipboard = this.graph.cloneCells([this.currentCell]);
        break;

      case 'paste':
        if (this.clipboard.length > 0) {
          const imported = this.graph.importCells(this.clipboard, 20, 20);
          this.graph.setSelectionCells(imported);
        }
        break;

      case 'duplicate':
        const cloned = this.graph.cloneCells([this.currentCell]);
        const imported = this.graph.importCells(cloned, 20, 20);
        this.graph.setSelectionCells(imported);
        break;

      case 'lock':
        this.currentCell.locked = !this.currentCell.locked;
        break;

      case 'setDefaultStyle':
        console.log('[ContextMenu] Set as Default Style - Not yet implemented');
        break;

      case 'toFront':
        {
          const model = this.graph.model as any;
          const parent = model.getParent(this.currentCell);
          if (parent) {
            const index = model.getChildCount(parent) - 1;
            model.add(parent, this.currentCell, index);
          }
        }
        break;

      case 'toBack':
        {
          const model = this.graph.model as any;
          const parent = model.getParent(this.currentCell);
          if (parent) {
            model.add(parent, this.currentCell, 0);
          }
        }
        break;

      case 'bringForward':
        {
          const model = this.graph.model as any;
          const parent = model.getParent(this.currentCell);
          if (parent) {
            let index = -1;
            for (let i = 0; i < model.getChildCount(parent); i++) {
              if (model.getChildAt(parent, i) === this.currentCell) {
                index = i;
                break;
              }
            }
            if (index < model.getChildCount(parent) - 1) {
              model.add(parent, this.currentCell, index + 1);
            }
          }
        }
        break;

      case 'sendBackward':
        {
          const model = this.graph.model as any;
          const parent = model.getParent(this.currentCell);
          if (parent) {
            let index = -1;
            for (let i = 0; i < model.getChildCount(parent); i++) {
              if (model.getChildAt(parent, i) === this.currentCell) {
                index = i;
                break;
              }
            }
            if (index > 0) {
              model.add(parent, this.currentCell, index - 1);
            }
          }
        }
        break;

      case 'editStyle':
        console.log('[ContextMenu] Edit Style - Selecting Text tab');
        const textTab = document.querySelector('.prop-tab[data-tab="style"]') as HTMLElement;
        if (textTab) textTab.click();
        break;

      case 'editData':
        console.log('[ContextMenu] Edit Data - Not yet implemented');
        break;
    }

    this.graph.refresh();
  }
}
