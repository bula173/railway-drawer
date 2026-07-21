import { Graph } from '@maxgraph/core';

export class MenuController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupMenus();
  }

  private setupMenus() {
    // Setup menu item clicks to toggle dropdowns
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = item.getAttribute('data-menu');
        this.toggleMenu(menu!);
      });
    });

    // Setup menu dropdown item clicks
    const dropdownItems = document.querySelectorAll('.menu-dropdown-item');
    dropdownItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        if (action) {
          this.executeMenuAction(action);
        }
        this.closeAllMenus();
      });
    });

    // Close menus when clicking elsewhere
    document.addEventListener('click', () => {
      this.closeAllMenus();
    });

    // Close menus on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllMenus();
      }
    });
  }

  private toggleMenu(menu: string) {
    const dropdown = document.querySelector(`.menu-dropdown[data-menu="${menu}"]`) as HTMLElement;
    if (dropdown) {
      // Close all other menus
      this.closeAllMenus();
      // Toggle this menu
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
  }

  private closeAllMenus() {
    const dropdowns = document.querySelectorAll('.menu-dropdown');
    dropdowns.forEach((dropdown) => {
      (dropdown as HTMLElement).style.display = 'none';
    });
  }

  private executeMenuAction(action: string) {
    const cells = this.graph.getSelectionCells();

    switch (action) {
      case 'new':
        if (confirm('Create a new diagram? Any unsaved changes will be lost.')) {
          this.graph.model.clear();
          console.log('[Menu] New diagram');
        }
        break;

      case 'open':
        console.log('[Menu] Open - Not yet implemented');
        break;

      case 'save':
        console.log('[Menu] Save - Document saved');
        break;

      case 'saveAs':
        console.log('[Menu] Save As - Not yet implemented');
        break;

      case 'export':
        console.log('[Menu] Export As - Not yet implemented');
        break;

      case 'print':
        window.print();
        break;

      case 'undo':
        const undoMgr = (this.graph as any).undoManager;
        if (undoMgr) {
          undoMgr.undo();
        }
        break;

      case 'redo':
        const redoMgr = (this.graph as any).undoManager;
        if (redoMgr) {
          redoMgr.redo();
        }
        break;

      case 'cut':
        console.log('[Menu] Cut');
        break;

      case 'copy':
        console.log('[Menu] Copy');
        break;

      case 'paste':
        console.log('[Menu] Paste');
        break;

      case 'delete':
        this.graph.removeCells(cells);
        break;

      case 'selectAll':
        {
          const parent = this.graph.getDefaultParent();
          const allCells = (this.graph.model as any).getChildren(parent) || [];
          this.graph.setSelectionCells(allCells);
        }
        break;

      case 'zoomIn':
        this.graph.zoomIn();
        break;

      case 'zoomOut':
        this.graph.zoomOut();
        break;

      case 'zoomActual':
        this.graph.zoomActual();
        break;

      case 'fitWindow':
        this.graph.fit(10);
        break;

      case 'showGrid':
        this.graph.gridEnabled = !this.graph.gridEnabled;
        console.log('[Menu] Grid', this.graph.gridEnabled ? 'enabled' : 'disabled');
        break;

      case 'toFront':
        {
          if (cells.length === 0) break;
          const model = this.graph.model as any;
          const parent = model.getParent(cells[0]);
          if (parent) {
            const index = model.getChildCount(parent) - 1;
            model.add(parent, cells[0], index);
          }
        }
        break;

      case 'toBack':
        {
          if (cells.length === 0) break;
          const model = this.graph.model as any;
          const parent = model.getParent(cells[0]);
          if (parent) {
            model.add(parent, cells[0], 0);
          }
        }
        break;

      case 'bringForward':
        {
          if (cells.length === 0) break;
          const model = this.graph.model as any;
          const parent = model.getParent(cells[0]);
          if (parent) {
            let index = -1;
            for (let i = 0; i < model.getChildCount(parent); i++) {
              if (model.getChildAt(parent, i) === cells[0]) {
                index = i;
                break;
              }
            }
            if (index < model.getChildCount(parent) - 1) {
              model.add(parent, cells[0], index + 1);
            }
          }
        }
        break;

      case 'sendBackward':
        {
          if (cells.length === 0) break;
          const model = this.graph.model as any;
          const parent = model.getParent(cells[0]);
          if (parent) {
            let index = -1;
            for (let i = 0; i < model.getChildCount(parent); i++) {
              if (model.getChildAt(parent, i) === cells[0]) {
                index = i;
                break;
              }
            }
            if (index > 0) {
              model.add(parent, cells[0], index - 1);
            }
          }
        }
        break;

      case 'alignLeft':
        console.log('[Menu] Align Left - Not yet implemented');
        break;

      case 'alignCenter':
        console.log('[Menu] Align Center - Not yet implemented');
        break;

      case 'alignRight':
        console.log('[Menu] Align Right - Not yet implemented');
        break;

      case 'editData':
        console.log('[Menu] Edit Data - Not yet implemented');
        break;

      case 'editStyle':
        {
          const styleTab = document.querySelector('.prop-tab[data-tab="style"]') as HTMLElement;
          if (styleTab) styleTab.click();
        }
        break;

      case 'preferences':
        console.log('[Menu] Preferences - Not yet implemented');
        break;

      case 'shortcuts':
        console.log('[Menu] Keyboard Shortcuts - Not yet implemented');
        break;

      case 'about':
        alert('Railway Drawer v0.1.0\nA professional diagram editor built with maxGraph');
        break;
    }

    this.graph.refresh();
  }
}
