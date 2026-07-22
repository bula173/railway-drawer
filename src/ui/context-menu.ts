import { Graph } from '@maxgraph/core';
import { ClipboardService } from '../services/clipboard-service';

export class ContextMenuController {
  private graph: Graph;
  private contextMenu: HTMLElement | null;
  private currentCell: any = null;
  private clipboardService: ClipboardService;
  private lastContextX = 0;
  private lastContextY = 0;

  constructor(graph: Graph) {
    this.graph = graph;
    this.contextMenu = document.getElementById('context-menu');
    this.clipboardService = ClipboardService.getInstance();
    this.setupContextMenu();
    this.setupClipboardListener();
  }

  private setupClipboardListener(): void {
    this.clipboardService.subscribe((hasContent) => {
      const pasteItem = this.contextMenu?.querySelector('[data-action="paste"]') as HTMLElement;
      if (pasteItem) {
        pasteItem.style.opacity = hasContent ? '1' : '0.5';
        pasteItem.style.pointerEvents = hasContent ? 'auto' : 'none';
      }
    });
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

        this.lastContextX = e.clientX;
        this.lastContextY = e.clientY;

        // Get cell at click position
        const cell = this.graph.getCellAt(x, y);
        if (cell && !cell.isEdge?.()) {
          this.currentCell = cell;
          this.graph.setSelectionCells([cell]);
          this.showContextMenu(e.clientX, e.clientY, 'cell');
        } else {
          // Empty canvas clicked - show canvas context menu
          this.currentCell = null;
          this.graph.setSelectionCells([]);
          this.showContextMenu(e.clientX, e.clientY, 'canvas');
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

  private showContextMenu(x: number, y: number, type: 'cell' | 'canvas' = 'cell') {
    if (!this.contextMenu) return;

    // Store context position for paste operation
    this.lastContextX = x;
    this.lastContextY = y;

    // Update menu items visibility based on type
    const deleteItem = this.contextMenu.querySelector('[data-action="delete"]') as HTMLElement;
    const lockItem = this.contextMenu.querySelector('[data-action="lock"]') as HTMLElement;
    const pasteItem = this.contextMenu.querySelector('[data-action="paste"]') as HTMLElement;
    const zOrderItems = this.contextMenu.querySelectorAll('[data-action^="to"], [data-action^="bring"], [data-action^="send"]');

    if (type === 'canvas') {
      // For empty canvas, hide cell-specific items and show only paste
      if (deleteItem) deleteItem.style.display = 'none';
      if (lockItem) lockItem.style.display = 'none';
      zOrderItems.forEach((item) => {
        (item as HTMLElement).style.display = 'none';
      });
      if (pasteItem) pasteItem.style.display = this.clipboardService.hasContent() ? 'block' : 'none';
    } else {
      // For cells, show all items
      if (deleteItem) deleteItem.style.display = 'block';
      if (lockItem) lockItem.style.display = 'block';
      zOrderItems.forEach((item) => {
        (item as HTMLElement).style.display = 'block';
      });
      if (pasteItem) pasteItem.style.display = this.clipboardService.hasContent() ? 'block' : 'none';
    }

    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
  }

  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  private executeAction(action: string): void {
    switch (action) {
      case 'delete':
        if (this.currentCell) {
          this.graph.removeCells([this.currentCell]);
        }
        break;

      case 'cut':
        if (this.currentCell) {
          this.clipboardService.cut([this.currentCell], this.graph);
        }
        break;

      case 'copy':
        if (this.currentCell) {
          this.clipboardService.copy([this.currentCell], this.graph);
        }
        break;

      case 'paste':
        {
          const rect = document.getElementById('graph-container')?.getBoundingClientRect();
          const offsetX = rect ? this.lastContextX - rect.left : 20;
          const offsetY = rect ? this.lastContextY - rect.top : 20;
          this.clipboardService.paste(this.graph, offsetX, offsetY);
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
