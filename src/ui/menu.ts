import { Graph } from '@maxgraph/core';
import { GraphCommandService } from '../services/graph-command-service';
import { SaveLoadController } from './saveload';

export class MenuController {
  private graph: Graph;
  private commandService: GraphCommandService;
  private saveLoadController: SaveLoadController;

  constructor(graph: Graph, commandService: GraphCommandService, saveLoadController: SaveLoadController) {
    this.graph = graph;
    this.commandService = commandService;
    this.saveLoadController = saveLoadController;
    this.setupMenus();
  }

  private setupMenus() {
    // Setup menu item clicks to toggle dropdowns
    const menuItems = document.querySelectorAll('.menu-item');
    console.log('[Menu] Found', menuItems.length, 'menu items');
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = item.getAttribute('data-menu');
        this.toggleMenu(menu!);
      });
    });

    // Setup menu dropdown item clicks
    const dropdownItems = document.querySelectorAll('.menu-dropdown-item');
    console.log('[Menu] Found', dropdownItems.length, 'dropdown items');
    dropdownItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        console.log('[Menu] Dropdown item clicked:', action);
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

  private closeAllMenus(): void {
    const dropdowns = document.querySelectorAll('.menu-dropdown');
    dropdowns.forEach((dropdown) => {
      (dropdown as HTMLElement).style.display = 'none';
    });
  }

  private openProject(): void {
    console.log('[Menu] Opening file dialog...');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.railwaydrawer,.drawio,.xml';
    input.onchange = async (e: any) => {
      console.log('[Menu] File selected:', e.target.files);
      const file = e.target.files?.[0];
      if (file) {
        console.log('[Menu] Loading file:', file.name);
        try {
          await this.saveLoadController.loadProjectFromFile(file);
          console.log('[Menu] File loaded successfully');
        } catch (error) {
          console.error('[Menu] Error loading file:', error);
          alert('Error loading file: ' + error);
        }
      } else {
        console.log('[Menu] No file selected');
      }
    };
    input.click();
  }

  private saveProjectAs(): void {
    const titleElement = document.querySelector('.document-title');
    const currentName = titleElement?.textContent || this.saveLoadController.getProjectName() || 'Untitled';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.placeholder = 'Project name';

    const dialog = document.createElement('div');
    dialog.style.position = 'fixed';
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.background = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    dialog.style.zIndex = '10001';
    dialog.style.minWidth = '300px';

    const label = document.createElement('div');
    label.textContent = 'Enter project name:';
    label.style.marginBottom = '10px';
    label.style.fontWeight = '600';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginTop = '16px';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.flex = '1';
    saveBtn.style.padding = '8px';
    saveBtn.style.background = '#1976d2';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.flex = '1';
    cancelBtn.style.padding = '8px';
    cancelBtn.style.background = '#f0f0f0';
    cancelBtn.style.border = '1px solid #ccc';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';

    saveBtn.onclick = () => {
      const name = input.value || 'Untitled';
      this.saveLoadController.setProjectName(name);
      this.saveLoadController.saveProject();
      document.body.removeChild(dialog);
    };

    cancelBtn.onclick = () => {
      document.body.removeChild(dialog);
    };

    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';
    input.style.boxSizing = 'border-box';

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);

    dialog.appendChild(label);
    dialog.appendChild(input);
    dialog.appendChild(buttonContainer);
    document.body.appendChild(dialog);

    input.focus();
    input.select();
  }

  private executeMenuAction(action: string): void {
    const cells = this.graph.getSelectionCells();

    switch (action) {
      case 'new':
        if (confirm('Create a new diagram? Any unsaved changes will be lost.')) {
          this.graph.model.clear();
          console.log('[Menu] New diagram');
        }
        break;

      case 'open':
        this.openProject();
        break;

      case 'save':
        this.saveLoadController.saveProject();
        break;

      case 'saveAs':
        this.saveProjectAs();
        break;

      case 'export':
        this.saveLoadController.save();
        break;

      case 'print':
        window.print();
        break;

      case 'undo':
        this.commandService.undo();
        break;

      case 'redo':
        this.commandService.redo();
        break;

      case 'cut':
        this.commandService.cut();
        break;

      case 'copy':
        this.commandService.copy();
        break;

      case 'paste':
        this.commandService.paste();
        break;

      case 'delete':
        this.commandService.delete();
        break;

      case 'selectAll':
        this.commandService.selectAll();
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
        if (cells.length > 0) {
          (this.graph as any).orderCells(false, cells);
        }
        break;

      case 'toBack':
        if (cells.length > 0) {
          (this.graph as any).orderCells(true, cells);
        }
        break;

      case 'bringForward':
        if (cells.length > 0) {
          const model = this.graph.model as any;
          this.graph.batchUpdate(() => {
            cells.forEach((cell) => {
              const parent = model.getParent(cell);
              if (parent) {
                let index = -1;
                for (let i = 0; i < model.getChildCount(parent); i++) {
                  if (model.getChildAt(parent, i) === cell) {
                    index = i;
                    break;
                  }
                }
                if (index >= 0 && index < model.getChildCount(parent) - 1) {
                  const temp = model.getChildAt(parent, index + 1);
                  model.add(parent, temp, index);
                  model.add(parent, cell, index + 1);
                }
              }
            });
          });
          this.graph.refresh();
        }
        break;

      case 'sendBackward':
        if (cells.length > 0) {
          const model = this.graph.model as any;
          this.graph.batchUpdate(() => {
            cells.forEach((cell) => {
              const parent = model.getParent(cell);
              if (parent) {
                let index = -1;
                for (let i = 0; i < model.getChildCount(parent); i++) {
                  if (model.getChildAt(parent, i) === cell) {
                    index = i;
                    break;
                  }
                }
                if (index > 0) {
                  const temp = model.getChildAt(parent, index - 1);
                  model.add(parent, temp, index);
                  model.add(parent, cell, index - 1);
                }
              }
            });
          });
          this.graph.refresh();
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
