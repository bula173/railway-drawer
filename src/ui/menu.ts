import { Graph } from '@maxgraph/core';
import { GraphCommandService } from '../services/graph-command-service';
import { SaveLoadController } from './saveload';
import { isRailmlFile, requestRailmlOpen } from '../railml/install-railml';
import { toggleConnectionArrows } from './hover-arrows';
import { setGridShown } from './grid-toggle';
import type { AlignmentController } from './alignment';
import type { ExportImageController } from './export-image';
import type { LeftPanelTabs } from './left-panel-tabs';
import { promptSaveAs, showAboutDialog } from './app-dialogs';
import { applyShortcutHints } from './shortcut-keys';
import { ServiceRegistry } from '../services/service-registry';

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
    // WAI-ARIA menubar roles (idempotent: every tab's controller runs this on the shared DOM)
    setupMenubarAria();

    // Setup menu item clicks to toggle dropdowns
    const menuItems = document.querySelectorAll<HTMLElement>('.menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = item.getAttribute('data-menu');
        this.toggleMenu(menu!);
      });
      item.addEventListener('keydown', (e) => this.onMenubarKeydown(e, item));
    });

    // Setup menu dropdown item clicks (also the generated remote-provider items: delegated)
    document.querySelectorAll<HTMLElement>('.menu-dropdown').forEach((dropdown) => {
      dropdown.addEventListener('click', (e) => {
        const item = (e.target as Element | null)?.closest<HTMLElement>('.menu-dropdown-item');
        if (!item || !dropdown.contains(item)) return;
        e.stopPropagation();
        if (item.getAttribute('aria-disabled') === 'true') return;
        // Items that bring their own handler (File > Open from <provider>…) only close the menu
        if (item.closest('#file-menu-remote-items')) {
          this.closeAllMenus();
          return;
        }
        const action = item.getAttribute('data-action');
        // Close (and give the focus back to the page) before the action opens a dialog
        this.closeAllMenus();
        if (action) {
          this.executeMenuAction(action);
        }
      });
      dropdown.addEventListener('keydown', (e) => this.onMenuKeydown(e, dropdown));
      // Submenu titles: aria-expanded while their list shows (CSS :hover / :focus-within)
      const syncExpanded = (): void => syncSubmenusExpanded(dropdown);
      for (const type of ['focusin', 'focusout', 'mouseover', 'mouseleave']) dropdown.addEventListener(type, () => requestAnimationFrame(syncExpanded));
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

  private toggleMenu(menu: string, focus: 'first' | 'last' | null = null) {
    const dropdown = document.querySelector(`.menu-dropdown[data-menu="${menu}"]`) as HTMLElement;
    if (dropdown) {
      const wasOpen = dropdown.style.display !== 'none';
      // Close all other menus
      this.closeAllMenus();
      if (!wasOpen || focus) this.openMenu(menu, focus);
    }
  }

  /** Opens one dropdown (the others closed) and optionally focuses its first/last item. */
  private openMenu(menu: string, focus: 'first' | 'last' | null): void {
    const dropdown = document.querySelector<HTMLElement>(`.menu-dropdown[data-menu="${menu}"]`);
    const button = document.querySelector<HTMLElement>(`.menu-item[data-menu="${menu}"]`);
    if (!dropdown || !button) return;
    this.closeAllMenus();
    setupMenuItemsAria(dropdown);
    dropdown.style.display = 'block';
    button.setAttribute('aria-expanded', 'true');
    setRovingButton(button);
    if (focus) {
      const items = visibleMenuItems(dropdown);
      (focus === 'first' ? items[0] : items[items.length - 1])?.focus();
    }
  }

  private closeAllMenus(): void {
    const dropdowns = document.querySelectorAll('.menu-dropdown');
    dropdowns.forEach((dropdown) => {
      (dropdown as HTMLElement).style.display = 'none';
    });
    document.querySelectorAll('.menu-item[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  }

  /** The open dropdown's menu name, or null. */
  private openMenuName(): string | null {
    const open = Array.from(document.querySelectorAll<HTMLElement>('.menu-dropdown')).find((d) => d.style.display !== 'none');
    return open?.getAttribute('data-menu') ?? null;
  }

  /** Keys on a menubar button (File, Edit, ...): WAI-ARIA menubar pattern. */
  private onMenubarKeydown(e: KeyboardEvent, button: HTMLElement): void {
    const buttons = menubarButtons();
    const index = buttons.indexOf(button);
    const menu = button.getAttribute('data-menu')!;
    const moveTo = (target: HTMLElement | undefined): void => {
      if (!target) return;
      const wasOpen = this.openMenuName() !== null;
      setRovingButton(target);
      target.focus();
      if (wasOpen) this.openMenu(target.getAttribute('data-menu')!, 'first');
    };
    switch (e.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        this.openMenu(menu, 'first');
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.openMenu(menu, 'last');
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveTo(buttons[(index + 1) % buttons.length]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveTo(buttons[(index - 1 + buttons.length) % buttons.length]);
        break;
      case 'Home':
        e.preventDefault();
        moveTo(buttons[0]);
        break;
      case 'End':
        e.preventDefault();
        moveTo(buttons[buttons.length - 1]);
        break;
      case 'Escape':
        this.closeAllMenus();
        break;
    }
  }

  /** Keys inside an open dropdown (and its submenu). */
  private onMenuKeydown(e: KeyboardEvent, dropdown: HTMLElement): void {
    const target = e.target as HTMLElement;
    const menu = dropdown.getAttribute('data-menu')!;
    const button = document.querySelector<HTMLElement>(`.menu-item[data-menu="${menu}"]`);
    const submenu = target.closest<HTMLElement>('.menu-submenu-list');
    const list = submenu ?? dropdown;
    const items = submenu ? visibleMenuItems(submenu, submenu) : visibleMenuItems(dropdown);
    const index = items.indexOf(target);
    const buttons = menubarButtons();
    const buttonIndex = button ? buttons.indexOf(button) : -1;
    const focusItem = (item: HTMLElement | undefined): void => item?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(items[(index + 1) % items.length]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(items[(index - 1 + items.length) % items.length]);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(items[0]);
        break;
      case 'End':
        e.preventDefault();
        focusItem(items[items.length - 1]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        if (target.classList.contains('menu-submenu-title')) {
          const sub = target.parentElement?.querySelector<HTMLElement>('.menu-submenu-list');
          if (sub) focusItem(visibleMenuItems(sub, sub)[0]);
        } else {
          // Focus back on the menubar first: a dialog opened by the item takes it from there and
          // returns it there when it closes
          button?.focus();
          target.click();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (target.classList.contains('menu-submenu-title')) {
          const sub = target.parentElement?.querySelector<HTMLElement>('.menu-submenu-list');
          if (sub) focusItem(visibleMenuItems(sub, sub)[0]);
        } else if (buttonIndex >= 0) {
          const next = buttons[(buttonIndex + 1) % buttons.length];
          setRovingButton(next);
          this.openMenu(next.getAttribute('data-menu')!, 'first');
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (submenu && list !== dropdown) {
          focusItem(submenu.parentElement?.querySelector<HTMLElement>('.menu-submenu-title') ?? undefined);
        } else if (buttonIndex >= 0) {
          const prev = buttons[(buttonIndex - 1 + buttons.length) % buttons.length];
          setRovingButton(prev);
          this.openMenu(prev.getAttribute('data-menu')!, 'first');
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (submenu) {
          focusItem(submenu.parentElement?.querySelector<HTMLElement>('.menu-submenu-title') ?? undefined);
          e.stopPropagation();
        } else {
          this.closeAllMenus();
          button?.focus();
        }
        break;
      case 'Tab':
        this.closeAllMenus();
        break;
    }
  }

  /** File > Import > draw.io File (New Tab)…: like Open, into a new tab (the current diagram stays). */
  private importDrawioFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.drawio,.xml,.railwaydrawer';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const railml = await isRailmlFile(file);
      if (railml !== null) {
        requestRailmlOpen(railml, file.name);
        return;
      }
      const tabManager = ServiceRegistry.getTabManager();
      if (!tabManager) return;
      const tab = tabManager.openNewTab();
      try {
        await tab.saveLoadController.loadProjectFromFile(file);
      } catch (error) {
        // SaveLoadController showed the error; the new tab stays empty
        console.error('[Menu] Import failed:', error);
      }
    };
    input.click();
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

  /**
   * File > Save As…: asks for the file name in the themed dialog, renames the active tab's project
   * (top-bar title, tab label when it was the project name) and downloads the .drawio file. It always
   * downloads, also for a tab bound to a remote file.
   */
  private async saveProjectAs(): Promise<void> {
    const name = await promptSaveAs(this.saveLoadController.getProjectName() || 'Untitled Diagram');
    if (name === null) return;
    const tabManager = ServiceRegistry.getTabManager();
    if (tabManager) tabManager.renameActiveProject(name);
    else this.saveLoadController.setProjectName(name);
    this.saveLoadController.saveProjectToDisk();
  }

  private executeMenuAction(action: string): void {
    // File > Export Railway Data > ...: main-editor.ts (src/railway) writes the list
    if (action.startsWith('exportRailway:')) {
      window.dispatchEvent(new CustomEvent('railway-export-request', { detail: action.slice('exportRailway:'.length) }));
      return;
    }
    // Railway menu route tools and toggles: src/railway/install-railway-routes.ts
    if (action.startsWith('railwayRoute:')) {
      window.dispatchEvent(new CustomEvent('railway-route-request', { detail: action.slice('railwayRoute:'.length) }));
      return;
    }

    switch (action) {
      case 'new':
        // Like draw.io: a new, empty diagram in its own tab (the current one stays as it is)
        ServiceRegistry.getTabManager()?.openNewTab();
        break;

      case 'open':
        this.openProject();
        break;

      case 'save':
        this.saveLoadController.saveProject();
        break;

      case 'saveAs':
        void this.saveProjectAs();
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
        // Same as the toolbar grid button and Properties > Canvas > Grid: grid shown + snapping
        setGridShown(this.graph, !this.graph.gridEnabled);
        break;

      case 'importDrawio':
        this.importDrawioFile();
        break;

      case 'importImage':
        // src/ui/image-upload.ts: Upload Custom Shape Image dialog
        document.getElementById('btn-upload-image')?.click();
        break;

      case 'railwayScriptEditor':
        (window as WindowWithLeftPanelTabs).__leftPanelTabs?.switchTab('railwayScript');
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

      case 'shortcuts':
        // ShortcutsHelpController (main-editor.ts), also on F1
        window.dispatchEvent(new CustomEvent('shortcuts-help-request'));
        break;

      case 'about':
        showAboutDialog();
        break;
    }

    this.graph.refresh();
  }
}

// ---- WAI-ARIA menubar ---------------------------------------------------------------------------

/** The menubar buttons (File, Edit, View, ...) in order. */
function menubarButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#menu-bar .menu-item[data-menu]'));
}

/** Roving tabindex: only `button` of the menubar is in the Tab order. */
function setRovingButton(button: HTMLElement): void {
  for (const other of menubarButtons()) other.tabIndex = other === button ? 0 : -1;
}

/**
 * Roles of a dropdown's items (also the generated "Open from <provider>…" items): menuitem unless
 * already a menuitemcheckbox, separators, the (nested) submenus; shortcut hints.
 */
function setupMenuItemsAria(dropdown: HTMLElement): void {
  dropdown.querySelectorAll<HTMLElement>('.menu-dropdown-item').forEach((item) => {
    if (!item.getAttribute('role')) item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
  });
  dropdown.querySelectorAll<HTMLElement>('.rd-sep').forEach((sep) => sep.setAttribute('role', 'separator'));
  dropdown.querySelectorAll<HTMLElement>('#file-menu-remote-items').forEach((group) => group.setAttribute('role', 'none'));
  dropdown.querySelectorAll<HTMLElement>('.menu-submenu').forEach((submenu) => {
    submenu.setAttribute('role', 'none');
    submenu.removeAttribute('tabindex');
    const title = submenu.querySelector<HTMLElement>('.menu-submenu-title');
    const list = submenu.querySelector<HTMLElement>('.menu-submenu-list');
    if (title) {
      title.setAttribute('role', 'menuitem');
      title.setAttribute('aria-haspopup', 'menu');
      if (!title.hasAttribute('aria-expanded')) title.setAttribute('aria-expanded', 'false');
      title.tabIndex = -1;
    }
    if (list) {
      list.setAttribute('role', 'menu');
      if (title?.textContent) list.setAttribute('aria-label', title.textContent.trim());
    }
  });
  applyShortcutHints(dropdown.querySelectorAll<HTMLElement>('.menu-dropdown-item[data-action]'));
}

/** Static roles of the menubar, its buttons and dropdowns (idempotent). */
function setupMenubarAria(): void {
  const bar = document.getElementById('menu-bar');
  if (!bar) return;
  bar.setAttribute('role', 'menubar');
  bar.setAttribute('aria-label', 'Main menu');
  bar.querySelectorAll<HTMLElement>('.menu-item-container').forEach((c) => c.setAttribute('role', 'none'));
  menubarButtons().forEach((button, i) => {
    const menu = button.getAttribute('data-menu')!;
    const dropdown = bar.querySelector<HTMLElement>(`.menu-dropdown[data-menu="${menu}"]`);
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-haspopup', 'menu');
    if (!button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded', 'false');
    if (!button.id) button.id = `menu-button-${menu}`;
    if (button.getAttribute('tabindex') === null) button.tabIndex = i === 0 ? 0 : -1;
    if (dropdown) {
      if (!dropdown.id) dropdown.id = `menu-${menu}`;
      dropdown.setAttribute('role', 'menu');
      dropdown.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', dropdown.id);
      setupMenuItemsAria(dropdown);
    }
  });
}

function syncSubmenusExpanded(dropdown: HTMLElement): void {
  dropdown.querySelectorAll<HTMLElement>('.menu-submenu').forEach((submenu) => {
    const list = submenu.querySelector<HTMLElement>(':scope > .menu-submenu-list');
    const open = !!list && list.getClientRects().length > 0;
    submenu.querySelector(':scope > .menu-submenu-title')?.setAttribute('aria-expanded', String(open));
  });
}

function isShown(node: HTMLElement): boolean {
  return node.getClientRects().length > 0 || node.style.display !== 'none' && !node.hidden && !node.closest('[hidden]');
}

/**
 * The focusable items of a menu in order: menuitem / menuitemcheckbox / submenu titles whose
 * nearest menu is `menu` (submenu children belong to their submenu list), not hidden.
 */
function visibleMenuItems(menu: HTMLElement, scope: HTMLElement = menu): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]')).filter(
    (item) => item.parentElement?.closest('[role="menu"]') === menu && item.style.display !== 'none' && isShown(item)
  );
}
