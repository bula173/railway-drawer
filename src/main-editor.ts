/**
 * @file main-editor.ts
 * @brief Boot of the main Railway Drawer editor (maxGraph)
 * @details
 * Imported by main.ts (through drawio/boot.ts) only in the 'main' editor mode, so the
 * draw.io mode never loads maxGraph. Initializes the entire Railway Drawer application including:
 * - Shape registration and toolbars
 * - Tab management for multiple diagrams
 * - UI components (stencils, panels, editors)
 * - Event handling (keyboard shortcuts, drag-drop)
 * - Application lifecycle management
 *
 * The application follows a modular architecture where each UI component
 * is responsible for its own initialization and event handling.
 *
 * @author Marcin Kwiatkowski
 * @version 0.6.0
 */

import '@maxgraph/core/css/common.css';
import './style.css';
import type { CellStyle } from '@maxgraph/core';
import { registerShapes, shapeRegistry, ShapeToolbar } from './shapes';
import { ShortcutsHelpController } from './ui/shortcuts-help';
import { TabManager } from './ui/tabs';
import { LeftPanelTabs } from './ui/left-panel-tabs';
import { CacheService } from './services/cache-service';
import { ProjectNameEditor } from './ui/project-name-editor';
import { ResizablePanels } from './ui/resizable-panels';
import { BUILD_ID, BUILD_TIME } from './config/build-id';
import type { ShapeDesignerController } from './ui/shape-designer';
import { CustomShapeToolbar } from './ui/custom-shape-toolbar';
import { globalNotificationManager } from './ui/notification';
import { globalSaveStatusIndicator } from './ui/save-status';
import { ServiceRegistry } from './services/service-registry';
import { globalErrorHandler } from './services/error-handler';
import { shouldIgnoreGraphShortcut } from './ui/delete';
import { registerDrawioCodecs } from './services/drawio-xml';
import { switchEditorMode } from './drawio/editorMode';
import type { EditorMode } from './drawio/editorMode';
import { ensureStencilsForXml, installDrawioCompat, installStencilEngine, parseMxLibrary } from './drawio-shapes/engine';
import { PALETTES, loadPalette } from './drawio-shapes/palettes';
import { createDrawioPaletteView, ertmsPaletteSource, loadErtmsTemplates, setDrawioPaletteEngine } from './ui/drawio-palette';
import { createTemplatesPanel, openTemplateAsNewDiagram, saveAsTemplate, TemplateStore } from './ui/templates';
import { installParityHook } from './debug/parity-hook';
import { installDarkModeToggle } from './drawio-shapes/theme/dark-mode';
import { installSharing } from './share/install-sharing';
import { installScenarios } from './scenarios/install-scenarios';
import { assignKindForInsertedShape, installRailwayData, prepareRailwayInsert } from './railway/install-railway-data';
import { installRailwayRoutes } from './railway/install-railway-routes';

/**
 * @brief Register all built-in shape definitions
 * @details Initializes the global shape registry with railway, UML, flowchart,
 * and other predefined shapes. This must be called before creating any diagrams.
 */
// Codecs for reading draw.io files; before any file or cache is loaded
registerDrawioCodecs();

// draw.io stencils: shape=stencil(...), named stencil sets from public/stencils/, JS shapes win
installStencilEngine({ baseUrl: import.meta.env.BASE_URL });
setDrawioPaletteEngine({ ensureStencilsForXml, installDrawioCompat, parseMxLibrary });

try {
  registerShapes();
  globalNotificationManager.success('✓ Railway Drawer initialized');
} catch (error) {
  globalErrorHandler.handleShapeError(error instanceof Error ? error : new Error(String(error)), true);
  globalNotificationManager.error('Failed to load shapes - some shapes may be unavailable');
}

/**
 * @brief Initialize keyboard shortcuts help dialog
 * @details Provides a modal dialog showing all available keyboard shortcuts
 * and commands to the user.
 */
new ShortcutsHelpController();

// ============= PROJECT NAME EDITOR =============

/**
 * @brief Initialize project name editor
 * @details Allows users to edit and display the current project name
 * in the application header.
 */
new ProjectNameEditor();

// ============= RESIZABLE PANELS =============

/**
 * @brief Initialize resizable panel system
 * @details Enables users to resize and rearrange the left panel, right panel,
 * and main graph canvas area using drag-enabled dividers.
 */
new ResizablePanels();

// ============= TAB MANAGER =============

/**
 * @brief Initialize tab manager for multi-diagram support
 * @details Manages multiple diagram tabs, allowing users to create, switch,
 * save, and load different diagrams within the same session.
 * The active tab provides access to the graph instance and command services.
 */
installDarkModeToggle();
const tabManager = new TabManager('tabs-container', 'graph-container');
// Register with service registry instead of polluting window object
ServiceRegistry.setTabManager(tabManager);
ServiceRegistry.setNotificationManager(globalNotificationManager);
ServiceRegistry.setSaveStatusIndicator(globalSaveStatusIndicator);
// Register error handler (it's active via global event listeners)
ServiceRegistry.register('errorHandler', globalErrorHandler);

/**
 * @brief Restore previous session from cache or create new diagram
 * @details If the application was previously used, restores all tabs and their
 * content from browser cache. Otherwise, creates a new empty diagram for the user.
 */
try {
  if (CacheService.exists()) {
    // Read before restoring: autosave clears the marker once a save succeeds again
    const staleSince = CacheService.getStaleSince();
    if (tabManager.restoreFromCache()) {
      if (staleSince === null) {
        globalNotificationManager.success('Restored previous diagrams');
      } else {
        // Autosave failed (e.g. storage full) after the restored snapshot was written
        globalNotificationManager.warning(
          `Restored diagrams may be out of date: autosave failed from ${new Date(staleSince).toLocaleString()}, ` +
            'so later changes were not kept.'
        );
      }
    } else {
      // Corrupt or old-version cache: CacheService dropped it
      globalNotificationManager.warning('Saved session could not be restored. Starting fresh.');
    }
  }
} catch (error) {
  console.error('Failed to restore from cache:', error);
  globalNotificationManager.error('Failed to restore diagrams. Starting fresh.');
}
// Always end up with at least one tab (and so with the tab bar's "+" button)
if (tabManager.getAllTabs().length === 0) {
  tabManager.createTab('Diagram 1');
}

/**
 * @brief Set build ID and timestamp in status bar
 * @details Displays the current build identifier (git commit hash or 'dev')
 * and the build timestamp (date and time)
 */
const activeTab = tabManager.getActiveTab();
if (activeTab?.statusBarController) {
  activeTab.statusBarController.setBuildId(BUILD_ID);
  activeTab.statusBarController.setBuildDate(BUILD_TIME);
}

// ============= SCENARIOS =============

/**
 * @brief Scenarios of the active tab (right panel "Scenarios", next to Properties)
 * @details Each step is a snapshot of the drawing, saved as its own draw.io page. Clicking a step
 * shows it read-only on the canvas (the live drawing is only hidden); ←/→ step, Esc goes back.
 */
const graphContainer = document.getElementById('graph-container')!;
const scenarios = installScenarios(tabManager, globalNotificationManager, graphContainer);

// ============= RAILWAY OBJECT DATA =============

/**
 * @brief Railway object data (right panel "Data" and "Checks")
 * @details Signals, balises, track sections, points, ... carry typed data stored as draw.io object
 * attributes (`rdKind`, `rdId`, ...). ERTMS library entries and the app's railway shapes get their
 * kind on insert; Checks validates the data live; File > Export Railway Data writes CSV/xlsx lists.
 */
installRailwayData(tabManager, globalNotificationManager, { showPanel: scenarios.showPanel });
// Route tool, route/interlocking tables, snap to track, km ruler (src/railway/install-railway-routes.ts)
installRailwayRoutes(tabManager, globalNotificationManager);

// ============= GLOBAL KEYBOARD SHORTCUTS =============

/**
 * @brief Global keyboard shortcut handler
 * @details Manages application-wide keyboard shortcuts:
 * - Ctrl/Cmd+Z: Undo
 * - Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: Redo
 * - Ctrl/Cmd+C: Copy
 * - Ctrl/Cmd+X: Cut
 * - Ctrl/Cmd+V: Paste
 * - Ctrl/Cmd+A: Select all
 * - Ctrl/Cmd+S: Save project to disk
 * - Delete/Backspace: Delete selected items
 * - Escape: Clear selection
 *
 * This is the single dispatcher for these shortcuts: each runs once, on the active tab
 * (the per-tab clipboard, delete and save controllers no longer listen on `document`).
 * Graph shortcuts are ignored while the user edits text (inputs, contentEditable, cell editor).
 */
document.addEventListener('keydown', (e) => {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab) return;

  const mod = e.ctrlKey || e.metaKey;
  // Shift turns e.key into upper case ('Z'), so compare case-insensitively
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  // Save works from anywhere, including while typing in a field
  if (mod && key === 's') {
    e.preventDefault();
    activeTab.saveLoadController.saveProject();
    return;
  }

  // Scenario view: ←/→/Home/End/Esc navigate, editing shortcuts are blocked (the drawing is hidden)
  if (scenarios.handleKeydown(e)) {
    return;
  }

  if (shouldIgnoreGraphShortcut(e, activeTab.graph)) {
    return;
  }

  if (mod && key === 'z' && !e.shiftKey) {
    e.preventDefault();
    activeTab.graphCommandService.undo();
  }
  if (mod && (key === 'y' || (e.shiftKey && key === 'z'))) {
    e.preventDefault();
    activeTab.graphCommandService.redo();
  }
  if (mod && key === 'c') {
    e.preventDefault();
    activeTab.graphCommandService.copy();
  }
  if (mod && key === 'x') {
    e.preventDefault();
    activeTab.graphCommandService.cut();
  }
  if (mod && key === 'v') {
    e.preventDefault();
    activeTab.graphCommandService.paste();
  }
  if (mod && key === 'a') {
    e.preventDefault();
    activeTab.graph.selectAll();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && activeTab.graph.getSelectionCount() > 0) {
    e.preventDefault();
    activeTab.graphCommandService.delete();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    activeTab.graph.clearSelection();
  }
}, true);

/**
 * @brief Application cleanup handler
 * @details Ensures all resources are properly released when the page is unloaded,
 * including disposing of graphs, removing event listeners, and clearing cached data.
 */
window.addEventListener('beforeunload', () => {
  try {
    // The 5 s autosave interval may not have run since the last edit
    tabManager.flushCache();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});
// Teardown only once the page really goes: beforeunload can be cancelled (install-sharing.ts asks
// when remote-bound tabs have unsaved changes), and the page must stay usable then
window.addEventListener('pagehide', (evt) => {
  if (evt.persisted) return;
  try {
    tabManager.destroy();
    globalSaveStatusIndicator.destroy();
    globalNotificationManager.destroy();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

// ============= EDITOR MODE SWITCH =============

/**
 * @brief Switch to another editor (reloads the page)
 * @details Saves pending changes to the browser cache first: the autosave runs only every 5 s.
 * Triggered by the top-bar "Editor" toggle and by View > "Open in draw.io (compatibility view)"
 * (MenuController dispatches `editor-switch-request`).
 */
function switchEditor(mode: EditorMode): void {
  if (mode === 'main') return;
  // A failed write (e.g. storage full) would silently drop the edits since the last good autosave
  if (
    !tabManager.flushCache() &&
    !window.confirm(
      'Your latest changes could not be saved to browser storage and will be lost when switching editors. ' +
        'Cancel and save to disk (Ctrl+S) first, or OK to switch anyway.'
    )
  ) {
    return;
  }
  switchEditorMode(mode);
}

document.querySelectorAll<HTMLButtonElement>('.editor-toggle [data-editor-mode]').forEach((btn) => {
  btn.addEventListener('click', () => switchEditor(btn.dataset.editorMode as EditorMode));
});
window.addEventListener('editor-switch-request', (e) => {
  const mode = (e as CustomEvent<EditorMode>).detail;
  if (mode === 'drawio' || mode === 'main') switchEditor(mode);
});

// ============= DROP HANDLER =============

/**
 * @brief Handle drag-and-drop of shapes onto the canvas
 * @details Enables users to drag shapes from the toolbox or stencils panel
 * and drop them onto the graph canvas. The shape is inserted at the drop location.
 */
/**
 * @brief Process drop event for shape insertion
 * @details Converts the drag coordinates to graph coordinates and creates
 * a new cell (vertex or shape) at the drop location.
 * @param {DragEvent} evt - The drop event with shape data in dataTransfer
 */
graphContainer.addEventListener('drop', (evt) => {
  graphContainer.classList.remove('drag-over');

  const shapeJson = evt.dataTransfer?.getData('application/x-shape-json');
  const customShapeJson = evt.dataTransfer?.getData('application/x-custom-shape');

  if (shapeJson || customShapeJson) {
    evt.preventDefault();

    const activeTab = tabManager.getActiveTab();
    if (!activeTab) return;

    // Convert to graph coordinates
    const pt = activeTab.graph.getPointForEvent(evt);

    activeTab.graph.batchUpdate(() => {
      if (shapeJson) {
        const shape = JSON.parse(shapeJson);
        if (shape.type === 'vertex') {
          const cell = activeTab.graph.insertVertex(
            activeTab.graph.getDefaultParent(),
            null,
            '',
            pt.x - shape.width / 2,
            pt.y - shape.height / 2,
            shape.width,
            shape.height,
            shape.style as CellStyle
          );
          // Railway shapes (signal, rail, points, ...) become railway objects with their kind
          assignKindForInsertedShape(activeTab.graph, cell);
          activeTab.graph.setSelectionCells([cell]);
        }
      } else if (customShapeJson) {
        // Handle custom shape drop
        const customShape = JSON.parse(customShapeJson);
        const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(
          `<svg viewBox="0 0 ${customShape.width} ${customShape.height}" xmlns="http://www.w3.org/2000/svg">
            <path d="${customShape.svgPath}" fill="${customShape.fillColor}" stroke="${customShape.strokeColor}" stroke-width="${customShape.strokeWidth}"/>
          </svg>`
        )}`;

        const cell = activeTab.graph.insertVertex(
          activeTab.graph.getDefaultParent(),
          null,
          '',
          pt.x - customShape.width / 2,
          pt.y - customShape.height / 2,
          customShape.width,
          customShape.height,
          {
            shape: 'image',
            image: svgDataUrl,
            html: false,
          } as CellStyle
        );
        activeTab.graph.setSelectionCells([cell]);
      }
    });
  }
}, false);

/**
 * @brief Handle drag-over to enable drop zone highlighting
 * @details Prevents default drag behavior and adds visual feedback
 * to indicate the canvas is a valid drop target.
 * @param {DragEvent} evt - The dragover event
 */
graphContainer.addEventListener('dragover', (evt) => {
  evt.preventDefault();
  graphContainer.classList.add('drag-over');
}, false);

/**
 * @brief Handle drag-leave to remove drop zone highlighting
 * @details Removes visual feedback when the user drags away from the canvas.
 * @param {DragEvent} evt - The dragleave event
 */
graphContainer.addEventListener('dragleave', (evt) => {
  if (evt.target === graphContainer) {
    graphContainer.classList.remove('drag-over');
  }
}, false);

// ============= LEFT PANEL TABS =============

/**
 * @brief Initialize left sidebar tab system
 * @details One Shapes tab (app shapes, custom shapes and the draw.io palettes), plus Layers
 * and PlantUML. Library visibility is controlled from the palette's "More shapes…" menu.
 */
const leftPanelTabs = new LeftPanelTabs('leftpanel-container');
leftPanelTabs.registerTabContent('shapes', 'shapes-container');
leftPanelTabs.registerTabContent('ertms', 'ertms-panel');
leftPanelTabs.registerTabContent('templates', 'templates-panel');
leftPanelTabs.registerTabContent('layers', 'layers-panel');
leftPanelTabs.registerTabContent('plantuml', 'plantuml-panel');

// Make leftPanelTabs globally accessible for menu handlers
(window as Window & { __leftPanelTabs?: LeftPanelTabs }).__leftPanelTabs = leftPanelTabs;

// ============= SHAPES TAB =============

/**
 * @brief App shape groups (Basic, ERTMS, ...) at the top of the Shapes tab
 * @details Draggable items that can be dropped onto the canvas. Hidden groups are stored in
 * localStorage and toggled from the "More shapes…" menu together with the draw.io palettes.
 */
const APP_GROUPS_HIDDEN_KEY = 'railway-drawer-hidden-shape-groups';
const hiddenAppGroups = new Set<string>(readStringArray(APP_GROUPS_HIDDEN_KEY));
const shapeToolbar = new ShapeToolbar(document.getElementById('app-shapes-container')!, shapeRegistry);
const applyAppGroupVisibility = (): void => {
  shapeToolbar.setEnabledGroups(new Set(shapeRegistry.getGroups().filter((g) => !hiddenAppGroups.has(g))));
};
if (hiddenAppGroups.size > 0) applyAppGroupVisibility();

function readStringArray(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @brief draw.io shape palettes (General, Misc, Advanced, Basic, Arrows, Flowchart, ERTMS, ...)
 * @details Same entries, titles, sizes and styles as draw.io (jgraph/drawio v32.4.1); inserted
 * cells keep draw.io's style strings, so saved files open 1:1 in draw.io. ERTMS is the draw.io
 * library public/libraries/ertms.xml. Click inserts at the view centre, drag drops at the pointer.
 */
createDrawioPaletteView({
  container: document.getElementById('drawio-palette-container')!,
  getGraph: () => tabManager.getActiveTab()?.graph ?? null,
  palettes: PALETTES.map((meta) => ({ ...meta, load: () => loadPalette(meta.id) })),
  extraLibraries: [ertmsPaletteSource(import.meta.env.BASE_URL)],
  dropTarget: graphContainer,
  onError: (message) => globalNotificationManager.error(message),
  prepareInsert: prepareRailwayInsert,
  extraMenuItems: shapeRegistry.getGroups().map((group) => ({
    id: `app-${group}`,
    title: `${group} (Railway Drawer)`,
    isChecked: () => !hiddenAppGroups.has(group),
    setChecked: (checked: boolean) => {
      if (checked) hiddenAppGroups.delete(group);
      else hiddenAppGroups.add(group);
      try {
        localStorage.setItem(APP_GROUPS_HIDDEN_KEY, JSON.stringify([...hiddenAppGroups]));
      } catch {
        // storage blocked or full: the choice still applies for this session
      }
      applyAppGroupVisibility();
    },
  })),
});

/**
 * @brief Optional ERTMS-only tab (View > ERTMS Tab)
 * @details Shows just the ERTMS library (public/libraries/ertms.xml), with its own expanded
 * state and without user libraries. Created on first show; drops of its entries onto the canvas
 * are handled by the Shapes tab palette view (same palette/entry ids). Shown/hidden state is
 * persisted in localStorage.
 */
const ERTMS_TAB_KEY = 'railway-drawer-ertms-tab';
let ertmsTabCreated = false;
const ensureErtmsTabView = (): void => {
  if (ertmsTabCreated) return;
  ertmsTabCreated = true;
  createDrawioPaletteView({
    container: document.getElementById('ertms-panel')!,
    getGraph: () => tabManager.getActiveTab()?.graph ?? null,
    palettes: [],
    extraLibraries: [ertmsPaletteSource(import.meta.env.BASE_URL)],
    defaultExpanded: ['ertms'],
    userLibraries: false,
    showMoreMenu: false,
    storageKeySuffix: '.ertmsTab',
    onError: (message) => globalNotificationManager.error(message),
    prepareInsert: prepareRailwayInsert,
  });
};
const syncErtmsMenuItem = (visible: boolean): void => {
  document
    .querySelectorAll('[data-action="toggleErtmsTab"]')
    .forEach((item) => item.setAttribute('aria-checked', String(visible)));
};
leftPanelTabs.onTabVisibilityChange((tabId, visible) => {
  if (tabId !== 'ertms') return;
  if (visible) ensureErtmsTabView();
  syncErtmsMenuItem(visible);
  try {
    localStorage.setItem(ERTMS_TAB_KEY, visible ? '1' : '0');
  } catch {
    // storage blocked: the choice applies for this session only
  }
});
let ertmsTabWanted = false;
try {
  ertmsTabWanted = localStorage.getItem(ERTMS_TAB_KEY) === '1';
} catch {
  ertmsTabWanted = false;
}
if (ertmsTabWanted) {
  ensureErtmsTabView();
  syncErtmsMenuItem(true);
} else {
  leftPanelTabs.closeTab('ertms');
}

// ============= TEMPLATES TAB =============

/**
 * @brief Templates tab: built-in ERTMS templates and the user's own templates
 * @details The complex scenario diagrams of public/libraries/ertms.xml are listed as "ERTMS
 * templates" (the ERTMS palettes show only the simple elements). "Save as Template…" (File menu,
 * canvas context menu, the tab's Save… button) stores the selection or the whole diagram in
 * localStorage `railway-drawer-templates`. Tiles insert at the view centre, open as a new tab, or
 * are dragged onto the canvas.
 */
const templateStore = new TemplateStore();
if (templateStore.loadWarning) globalNotificationManager.warning(templateStore.loadWarning);
const requestSaveAsTemplate = (): void => {
  const graph = tabManager.getActiveTab()?.graph;
  if (!graph) return;
  void saveAsTemplate({
    graph,
    store: templateStore,
    notify: globalNotificationManager,
    onShow: () => leftPanelTabs.switchTab('templates'),
  });
};
window.addEventListener('save-template-request', requestSaveAsTemplate);
createTemplatesPanel({
  container: document.getElementById('templates-panel')!,
  store: templateStore,
  loadBuiltIns: () => loadErtmsTemplates(import.meta.env.BASE_URL),
  getGraph: () => tabManager.getActiveTab()?.graph ?? null,
  openAsNewDiagram: (template) => {
    openTemplateAsNewDiagram(tabManager, template);
  },
  saveAsTemplate: requestSaveAsTemplate,
  parseLibrary: parseMxLibrary,
  notify: globalNotificationManager,
  dropTarget: graphContainer,
});

// Visual parity harness hook (dev server / ?parity=1 only)
installParityHook();

// ============= SHARING =============

/**
 * @brief Share dialog, diagram links, cloud storage providers
 * @details Top-bar Share button and File > Share…: link with the diagram in the URL hash (`#R…`,
 * also as an app.diagrams.net link), .drawio/PNG/SVG downloads, Web Share; SharePoint/OneDrive
 * (disabled until VITE_MSAL_CLIENT_ID is set, see docs/SHAREPOINT.md). A `#R` link in the start URL
 * opens as new tabs. Tabs opened from / saved to a provider save back there with Ctrl+S.
 */
installSharing(tabManager, globalNotificationManager);

// ============= CUSTOM SHAPES =============

/**
 * @brief Initialize custom shape designer and toolbar
 * @details Allows users to create and manage custom shapes with visual editor
 * and real-time preview. Custom shapes are stored persistently and can be
 * dragged onto the canvas like built-in shapes.
 */
const activeTabForShapes = tabManager.getActiveTab();
if (activeTabForShapes) {
  // The designer (a large, rarely used module) is loaded on first use
  const designerGraph = activeTabForShapes.graph;
  let shapeDesigner: Promise<ShapeDesignerController> | null = null;
  const openShapeDesigner = (shapeId?: string): void => {
    shapeDesigner ??= import('./ui/shape-designer').then((m) => new m.ShapeDesignerController(designerGraph));
    shapeDesigner.then((designer) => designer.openDesigner(shapeId)).catch((error: unknown) => {
      shapeDesigner = null;
      console.error('[ShapeDesigner] could not be loaded', error);
      ServiceRegistry.getNotificationManager()?.error('The shape designer could not be loaded. Check the connection and try again.');
    });
  };
  const customShapeToolbar = new CustomShapeToolbar('custom-shapes-container');

  // Wire up event listeners for opening shape designer
  document.getElementById('btn-shape-designer')?.addEventListener('click', () => openShapeDesigner());
  window.addEventListener('open-shape-designer', () => openShapeDesigner());
  window.addEventListener('edit-custom-shape', (e) => {
    openShapeDesigner((e as CustomEvent<{ shapeId?: string } | undefined>).detail?.shapeId);
  });

  // Refresh custom shapes when tab changes
  window.addEventListener('tab-changed', () => {
    customShapeToolbar.refresh();
  });

  // Services are registered in ServiceRegistry, no need for window globals
  ServiceRegistry.register('customShapeToolbar', customShapeToolbar);
}

/**
 * @brief Application initialization complete
 * @details All major components have been initialized and are ready for user interaction.
 * The application is now fully functional.
 */
console.log('✓ Railway Drawer with tabs, stencils, and custom shapes initialized');
