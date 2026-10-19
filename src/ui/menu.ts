import { Graph } from '@maxgraph/core';
import { GraphCommandService } from '../services/graph-command-service';
import { SaveLoadController } from './saveload';
import { isRailmlFile, requestRailmlOpen } from '../railml/install-railml';
import { toggleConnectionArrows } from './hover-arrows';
import type { AlignmentController } from './alignment';
import type { ExportImageController } from './export-image';
import type { LeftPanelTabs } from './left-panel-tabs';

/** Window global set by main-editor.ts so menu handlers can reach the left panel tabs. */
type WindowWithLeftPanelTabs = Window & { __leftPanelTabs?: LeftPanelTabs };

export class MenuController {
  private graph: Graph;
  private commandService: GraphCommandService;
  private saveLoadController: SaveLoadController;
  private alignmentController: AlignmentController | null = null;
  private exportImageController: ExportImageController | null = null;

  constructor(graph: Graph, commandService: GraphCommandService, saveLoadController: SaveLoadController) {
    this.graph = graph;
    this.commandService = commandService;
    this.saveLoadController = saveLoadController;
    this.setupMenus();
  }

  setAlignmentController(controller: AlignmentController): void {
    this.alignmentController = controller;
  }

  setExportImageController(controller: ExportImageController): void {
    this.exportImageController = controller;
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
    input.accept = '.railwaydrawer,.drawio,.xml,.railml';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      console.log('[Menu] File selected:', target.files);
      const file = target.files?.[0];
      if (file) {
        console.log('[Menu] Loading file:', file.name);
        // railML (root <railML>): imported into a new tab by src/railml
        const railml = await isRailmlFile(file);
        if (railml !== null) {
          requestRailmlOpen(railml, file.name);
          return;
        }
        try {
          await this.saveLoadController.loadProjectFromFile(file);
          console.log('[Menu] File loaded successfully');
        } catch (error) {
          // SaveLoadController already showed the error to the user and kept the current diagram
          console.error('[Menu] Error loading file:', error);
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
    dialog.style.background = 'var(--rd-surface)';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.boxShadow = '0 4px 12px var(--rd-shadow)';
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
    saveBtn.style.background = 'var(--rd-accent)';
    saveBtn.style.color = 'var(--rd-accent-text)';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.flex = '1';
    cancelBtn.style.padding = '8px';
    cancelBtn.style.background = 'var(--rd-hover)';
    cancelBtn.style.border = '1px solid var(--rd-border-strong)';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';

    saveBtn.onclick = () => {
      const name = input.value || 'Untitled';
      this.saveLoadController.setProjectName(name);
      // "Save As" always downloads, also for a tab bound to a remote file
      this.saveLoadController.saveProjectToDisk();
      document.body.removeChild(dialog);
    };

    cancelBtn.onclick = () => {
      document.body.removeChild(dialog);
    };

    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.border = '1px solid var(--rd-border-strong)';
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
    // File > Export Railway Data > ...: main-editor.ts (src/railway) writes the list
    if (action.startsWith('exportRailway:')) {
      window.dispatchEvent(new CustomEvent('railway-export-request', { detail: action.slice('exportRailway:'.length) }));
      return;
    }
    // View/Extras railway route tools: src/railway/install-railway-routes.ts
    if (action.startsWith('railwayRoute:')) {
      window.dispatchEvent(new CustomEvent('railway-route-request', { detail: action.slice('railwayRoute:'.length) }));
      return;
    }

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

      case 'exportPng':
        void this.exportImageController?.exportToPNG();
        break;

      case 'exportSvg':
        void this.exportImageController?.exportToSVG();
        break;

      case 'share':
        // main-editor.ts opens the Share dialog (link with diagram, downloads, cloud providers)
        window.dispatchEvent(new CustomEvent('share-request'));
        break;

      case 'exportScenarioHtml':
        // src/scenarios/install-scenarios.ts exports the scenario shown / the only one / the one picked
        window.dispatchEvent(new CustomEvent('scenario-export-request'));
        break;

      case 'exportScenarioPdf':
      case 'exportScenarioSlides':
        // src/scenarios/install-scenarios.ts: options dialog, then PDF / HTML slideshow
        window.dispatchEvent(new CustomEvent('scenario-export-request', { detail: { format: action === 'exportScenarioPdf' ? 'pdf' : 'slides' } }));
        break;

      case 'importRailml':
      case 'exportRailml':
        // src/railml/install-railml.ts (lazy railml-ui chunk): new tab from railML / railML 3.2 download
        window.dispatchEvent(new CustomEvent('railml-request', { detail: { action: action === 'importRailml' ? 'import' : 'export' } }));
        break;

      case 'importRailwayScript':
      case 'exportRailwayScript':
        // src/railway-script/install-railway-script.ts (lazy script-ui chunk): new tab from a script / .rdl.yaml|.rdl.json download
        window.dispatchEvent(new CustomEvent('railway-script-request', { detail: { action: action === 'importRailwayScript' ? 'import' : 'export' } }));
        break;

      case 'saveAsTemplate':
        // main-editor.ts asks for a name and stores the selection (or the whole diagram)
        window.dispatchEvent(new CustomEvent('save-template-request'));
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

      // Same commands as the canvas context menu (GraphCommandService): one undoable edit each
      case 'toFront':
        this.commandService.toFront();
        break;

      case 'toBack':
        this.commandService.toBack();
        break;

      case 'bringForward':
        this.commandService.bringForward();
        break;

      case 'sendBackward':
        this.commandService.sendBackward();
        break;

      case 'alignLeft':
        if (this.alignmentController) {
          this.alignmentController.alignLeft();
        }
        break;

      case 'alignCenter':
        if (this.alignmentController) {
          this.alignmentController.alignCenter();
        }
        break;

      case 'alignRight':
        if (this.alignmentController) {
          this.alignmentController.alignRight();
        }
        break;

      case 'plantumlEditor': {
        console.log('[Menu] PlantUML editor clicked');
        const leftPanelTabs = (window as WindowWithLeftPanelTabs).__leftPanelTabs;
        if (leftPanelTabs) {
          // If tab is hidden, show it; otherwise switch to it
          if (leftPanelTabs.isTabHidden('plantuml')) {
            console.log('[Menu] Showing hidden plantuml tab');
            leftPanelTabs.showTab('plantuml');
          } else {
            console.log('[Menu] Switching to plantuml tab');
            leftPanelTabs.switchTab('plantuml');
          }
        } else {
          console.error('[Menu] leftPanelTabs not found!');
        }
        break;
      }

      case 'toggleErtmsTab': {
        // Optional left-panel tab with only the ERTMS library; visibility is persisted by main-editor.ts
        const leftPanelTabs = (window as WindowWithLeftPanelTabs).__leftPanelTabs;
        if (leftPanelTabs) {
          if (leftPanelTabs.isTabHidden('ertms')) leftPanelTabs.showTab('ertms');
          else leftPanelTabs.closeTab('ertms');
        }
        break;
      }

      case 'toggleConnectionArrows':
        // draw.io View > Connection Arrows (hover-arrows.ts; persisted, all tabs)
        toggleConnectionArrows();
        break;

      case 'designShapes':
        window.dispatchEvent(new CustomEvent('open-shape-designer'));
        break;

      case 'editData':
        // main-editor.ts (src/railway) shows the Data panel for the selection
        window.dispatchEvent(new CustomEvent('railway-edit-data-request'));
        break;

      case 'railwayChecks':
        window.dispatchEvent(new CustomEvent('railway-checks-request'));
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
