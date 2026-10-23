/**
 * @file main-editor.ts
 * @brief Boot of the main Railway Drawer editor (maxGraph)
 * @details
 * Imported lazily by main.ts (sign-in answer pages never load it). Initializes the entire
 * Railway Drawer application including:
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
import { installGlobalGraphPatches } from './ui/setup-graph';
import { on } from './core/event-bus';
import { LeftPanelTabs } from './ui/left-panel-tabs';
import { CacheService } from './services/cache-service';
import { ProjectNameEditor } from './ui/project-name-editor';
import { ensurePanelShown, installSidePanels, togglePanel } from './ui/side-panels';
import { APP_VERSION, BUILD_ID, BUILD_TIME } from './config/build-id';
import type { ShapeDesignerController } from './ui/shape-designer';
import { CustomShapeToolbar } from './ui/custom-shape-toolbar';
import { globalNotificationManager } from './ui/notification';
import { globalSaveStatusIndicator } from './ui/save-status';
import { ServiceRegistry } from './services/service-registry';
import { globalErrorHandler } from './services/error-handler';
import { shouldIgnoreGraphShortcut } from './ui/delete';
import { registerDrawioCodecs } from './services/drawio-xml';
import { ensureStencilsForXml, installDrawioCompat, installStencilEngine, parseMxLibrary } from './drawio-shapes/engine';
import {
  APP_GROUPS_HIDDEN_KEY,
  createDrawioPaletteView,
  ertmsPaletteSource,
  loadErtmsTemplates,
  MERGED_APP_GROUPS,
  migrateMergedPaletteFlags,
  setDrawioPaletteEngine,
  shapesTabPalettes,
} from './ui/drawio-palette';
import { createTemplatesPanel, openTemplateAsNewDiagram, saveAsTemplate, TemplateStore } from './ui/templates';
import { installDarkModeToggle } from './drawio-shapes/theme/dark-mode';
import { installSharing } from './share/install-sharing';
import { installAccessIdentity } from './ui/access-identity';
import { confirmDialog } from './ui/app-dialogs';
import { installScenarios } from './scenarios/install-scenarios';
import { assignKindForInsertedShape, installRailwayData, prepareRailwayInsert } from './railway/install-railway-data';
import { installRailwayRoutes } from './railway/install-railway-routes';
import { installRailwayStates } from './railway/install-railway-states';
import { installRailml, isRailmlFile, requestRailmlOpen } from './railml/install-railml';
import { installRailwayScript } from './railway-script/install-railway-script';
import { installAi } from './ai/install-ai';
import { syncConnectionArrowsMenu, toggleConnectionArrows } from './ui/hover-arrows';
import { withErtmsDisplayTitles } from './ui/ertms-display';
import { RAILWAY_LIBRARIES, railwayLibrarySources } from './ui/railway-libraries';
import { installToolbar } from './ui/toolbar';
import { clickInsertPlacement } from './ui/click-insert';
import { createStartCard } from './ui/start-card';
import { installNarrowScreen } from './ui/narrow-screen';
import { scrollSelectionIntoView } from './ui/canvas-scroll';
import { logger } from './drawio/logger';
import { readItem, writeItem } from './core/safe-storage';
import { STORAGE_KEYS } from './core/storage-keys';

/**
 * @brief Register all built-in shape definitions
 * @details Initializes the global shape registry with railway, UML, flowchart,
 * and other predefined shapes. This must be called before creating any diagrams.
 */
// Codecs for reading draw.io files; before any file or cache is loaded
registerDrawioCodecs();

// draw.io stencils: shape=stencil(...), named stencil sets from public/stencils/, JS shapes win
installStencilEngine({ baseUrl: import.meta.env.BASE_URL });
// Page-wide maxGraph prototype patches (Cell.prototype.isConnectable), once (setup-graph.ts)
installGlobalGraphPatches();
setDrawioPaletteEngine({ ensureStencilsForXml, installDrawioCompat, parseMxLibrary });

try {
  registerShapes();
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

// ============= SIDE PANELS =============

// Collapsible, resizable left/right panels; widths and collapsed state remembered (src/ui/side-panels.ts)
installSidePanels();

// Toolbar chrome: SVG icons, names + shortcut tooltips, Align / distribute dropdown (src/ui/toolbar.ts)
installToolbar();

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
  // "Diagram 1", its project (top-bar title) too
  tabManager.openNewTab();
}

// ============= PROJECT NAME EDITOR =============

/**
 * @brief Project name in the top bar (click to rename)
 * @details The name goes to the active tab's project (Save/Export file names) and the tab cache.
 */
new ProjectNameEditor(tabManager);

/**
 * @brief Set build ID and timestamp in status bar
 * @details Displays the current build identifier (git commit hash or 'dev')
 * and the build timestamp (date and time)
 */
const activeTab = tabManager.getActiveTab();
if (activeTab?.statusBarController) {
  // One source for the status bar and Help > About (config/build-id.ts, package.json version)
  activeTab.statusBarController.setVersion(APP_VERSION);
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
installRailwayStates(tabManager, globalNotificationManager);
// railML 3.2 import/export (File menu, File > Open and file drops of railML; lazy chunk)
installRailml(tabManager, globalNotificationManager);

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
 * - Escape: Clear selection (and hide the connection arrows)
 * - Alt+Shift+A: View > Connection Arrows on/off (draw.io)
 * - Arrow keys: Move the selection by 1 px (Shift: by the grid size); locked cells stay
 *
 * This is the single dispatcher for these shortcuts: each runs once, on the active tab
 * (the per-tab clipboard, delete and save controllers no longer listen on `document`).
 * Graph shortcuts are ignored while the user edits text (inputs, contentEditable, cell editor).
 */
/** Arrow key -> unit move (draw.io nudge). */
const ARROW_NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

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
  // Keys on the menu bar / context menu / toolbar dropdowns navigate the menu (menu.ts, context-menu.ts,
  // toolbar.ts, left-panel-tabs.ts), not the diagram (Escape there must not clear the selection)
  if (e.target instanceof Element && e.target.closest('#menu-bar, #context-menu, .rd-toolbar-menu, .left-panel-overflow-menu')) {
    return;
  }
  // Delete / Backspace on a left-panel tab closes that tab (left-panel-tabs.ts), never the diagram selection
  if ((e.key === 'Delete' || e.key === 'Backspace') && e.target instanceof Element && e.target.closest('.left-panel-tabbar')) {
    return;
  }

  // Side panels like draw.io: Ctrl/Cmd+Shift+K = Shapes, Ctrl/Cmd+Shift+P = Format (src/ui/side-panels.ts)
  if (mod && e.shiftKey && !e.altKey && (key === 'k' || key === 'p')) {
    e.preventDefault();
    togglePanel(key === 'k' ? 'left' : 'right');
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
    // Same command as Edit > Select All (draw.io: the layer's cells and their descendants)
    activeTab.graphCommandService.selectAll();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && activeTab.graph.getSelectionCount() > 0) {
    e.preventDefault();
    activeTab.graphCommandService.delete();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    // hides the connection arrows and cancels a connection dragged from one (hover-arrows.ts)
    activeTab.hoverArrowsController.escape();
    activeTab.graph.clearSelection();
  }
  // draw.io's View > Connection Arrows shortcut (e.code: Alt changes e.key on macOS)
  if (e.altKey && e.shiftKey && !mod && e.code === 'KeyA') {
    e.preventDefault();
    toggleConnectionArrows();
  }
  // Arrow keys nudge the selection like draw.io: 1 px, Shift: one grid step; locked cells stay
  // (not while the focus is on a panel control that uses the arrows itself: lists, buttons, ...)
  const nudge = ARROW_NUDGE[e.key];
  const focus = document.activeElement;
  const focusOnCanvas = !focus || focus === document.body || activeTab.graph.container.contains(focus);
  if (nudge && focusOnCanvas && !mod && !e.altKey && activeTab.graph.getSelectionCount() > 0) {
    e.preventDefault();
    const step = e.shiftKey ? activeTab.graph.getGridSize() || 10 : 1;
    // Like draw.io, the nudged selection stays in view (scrolls at the canvas edge)
    if (activeTab.graphCommandService.nudge(nudge[0] * step, nudge[1] * step)) scrollSelectionIntoView(activeTab.graph);
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

  // A railML file dropped on the canvas opens in a new tab (src/railml)
  const droppedFile = evt.dataTransfer?.files?.[0];
  if (droppedFile && /\.(railml|xml)$/i.test(droppedFile.name)) {
    evt.preventDefault();
    void isRailmlFile(droppedFile).then((text) => {
      if (text !== null) requestRailmlOpen(text, droppedFile.name);
      else globalNotificationManager.warning(`${droppedFile.name} is not a railML file: use File > Open for draw.io files`);
    });
    return;
  }

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
leftPanelTabs.registerTabContent('railwayScript', 'railway-script-panel');
// Railway Script: layout as YAML/JSON text, two-way with the drawing (src/railway-script; lazy chunk)
installRailwayScript(tabManager, globalNotificationManager, leftPanelTabs, document.getElementById('railway-script-panel')!);
// AI assistant: right panel view "AI" (src/ai; lazy chunk, docs/AI.md)
installAi(tabManager, globalNotificationManager);

// Make leftPanelTabs globally accessible for menu handlers
(window as Window & { __leftPanelTabs?: LeftPanelTabs }).__leftPanelTabs = leftPanelTabs;

// ============= SHAPES TAB =============

/**
 * @brief App shape groups at the top of the Shapes tab (none by default)
 * @details The app's "Basic" group is merged into the palette's "General" section
 * (shapes-tab-palettes.ts), so it is not shown here; any other registered group is. Hidden groups
 * are stored in localStorage and toggled from the "More shapes…" menu with the draw.io palettes.
 * Stored flags of the merged palettes/groups are moved to "General" first.
 */
migrateMergedPaletteFlags();
const hiddenAppGroups = new Set<string>(readStringArray(APP_GROUPS_HIDDEN_KEY));
const separateAppGroups = (): string[] => shapeRegistry.getGroups().filter((g) => !MERGED_APP_GROUPS.includes(g));
const shapeToolbar = new ShapeToolbar(document.getElementById('app-shapes-container')!, shapeRegistry);
const applyAppGroupVisibility = (): void => {
  shapeToolbar.setEnabledGroups(new Set(separateAppGroups().filter((g) => !hiddenAppGroups.has(g))));
};
applyAppGroupVisibility();

function readStringArray(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(readItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @brief Shape palettes: ERTMS first, then draw.io's (General, Misc, Advanced, Arrows, Flowchart)
 * @details ERTMS (the railway symbols, captioned tiles) is the first section and, like General,
 * expanded for new users (stored expanded/visible flags still win). "General" also holds draw.io's Basic palette and the app's Basic shapes that draw.io
 * has no equivalent for (one section, see shapes-tab-palettes.ts). Otherwise the same entries,
 * titles, sizes and styles as draw.io (jgraph/drawio v32.4.1); inserted
 * cells keep draw.io's style strings, so saved files open 1:1 in draw.io. ERTMS is the draw.io
 * library public/libraries/ertms.xml. Click inserts at the view centre, drag drops at the pointer.
 */
const shapesPaletteView = createDrawioPaletteView({
  container: document.getElementById('drawio-palette-container')!,
  getGraph: () => tabManager.getActiveTab()?.graph ?? null,
  palettes: [
    withErtmsDisplayTitles(ertmsPaletteSource(import.meta.env.BASE_URL)),
    // ERTMS/ETCS extra, Polish signalling (PKP PLK), Track layout (src/ui/railway-libraries.ts)
    ...railwayLibrarySources(import.meta.env.BASE_URL),
    ...shapesTabPalettes(() => MERGED_APP_GROUPS.flatMap((g) => shapeRegistry.getShapesByGroup(g))),
  ],
  defaultExpanded: ['ertms', 'general'],
  // draw.io's Basic palette is part of the merged General section
  skipCataloguePalettes: ['basic'],
  captionPalettes: ['ertms', ...RAILWAY_LIBRARIES.map((lib) => lib.id)],
  dropTarget: graphContainer,
  onError: (message) => globalNotificationManager.error(message),
  prepareInsert: prepareRailwayInsert,
  clickPlacement: clickInsertPlacement,
  extraMenuItems: separateAppGroups().map((group) => ({
    id: `app-${group}`,
    title: `${group} (Railway Drawer)`,
    isChecked: () => !hiddenAppGroups.has(group),
    setChecked: (checked: boolean) => {
      if (checked) hiddenAppGroups.delete(group);
      else hiddenAppGroups.add(group);
      try {
        writeItem(APP_GROUPS_HIDDEN_KEY, JSON.stringify([...hiddenAppGroups]));
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
const ERTMS_TAB_KEY = STORAGE_KEYS.ertmsTab;
let ertmsTabCreated = false;
const ensureErtmsTabView = (): void => {
  if (ertmsTabCreated) return;
  ertmsTabCreated = true;
  createDrawioPaletteView({
    container: document.getElementById('ertms-panel')!,
    getGraph: () => tabManager.getActiveTab()?.graph ?? null,
    palettes: [],
    extraLibraries: [withErtmsDisplayTitles(ertmsPaletteSource(import.meta.env.BASE_URL))],
    defaultExpanded: ['ertms'],
    captionPalettes: ['ertms'],
    userLibraries: false,
    showMoreMenu: false,
    storageKeySuffix: '.ertmsTab',
    onError: (message) => globalNotificationManager.error(message),
    prepareInsert: prepareRailwayInsert,
    clickPlacement: clickInsertPlacement,
  });
};
// View > Connection Arrows check mark from the stored setting (hover-arrows.ts)
syncConnectionArrowsMenu();
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
    writeItem(ERTMS_TAB_KEY, visible ? '1' : '0');
  } catch {
    // storage blocked: the choice applies for this session only
  }
});
let ertmsTabWanted = false;
try {
  ertmsTabWanted = readItem(ERTMS_TAB_KEY) === '1';
} catch {
  ertmsTabWanted = false;
}
if (ertmsTabWanted) {
  ensureErtmsTabView();
  syncErtmsMenuItem(true);
} else {
  leftPanelTabs.closeTab('ertms');
}

// ============= NARROW SCREENS =============

// < 900 px: body.rd-narrow (side panels hidden, canvas keeps the width) + a dismissible banner
installNarrowScreen();

// ============= START CARD =============

/**
 * @brief Start card over the canvas of an empty tab (src/ui/start-card.ts)
 * @details Insert ERTMS symbols (Shapes tab, ERTMS section expanded and focused), Open
 * template… (Templates tab), Open file… / Import railML… (the File menu actions), Railway
 * Script… (its tab), F1 shortcuts. Rechecked on tab switches and new tabs.
 */
const focusErtmsPalette = (): void => {
  // the palette lives in the left panel: hidden on narrow screens (body.rd-narrow) or collapsed
  ensurePanelShown('left');
  leftPanelTabs.switchTab('shapes');
  shapesPaletteView.setPaletteVisible('ertms', true);
  shapesPaletteView.setExpanded('ertms', true);
  const section = document.querySelector<HTMLElement>('#drawio-palette-container section[data-palette-id="ertms"]');
  section?.scrollIntoView({ block: 'start' });
  void shapesPaletteView.ready.then(() => section?.querySelector<HTMLElement>('.rd-dp-item')?.focus());
};
const runMenuAction = (action: string): void => {
  document.querySelector<HTMLElement>(`.menu-dropdown-item[data-action="${action}"]`)?.click();
};
const startCard = createStartCard({
  container: graphContainer,
  getActive: () => {
    const tab = tabManager.getActiveTab();
    return tab ? { id: tab.id, graph: tab.graph } : null;
  },
  onAction: (action) => {
    if (action === 'ertms') focusErtmsPalette();
    else if (action === 'template') {
      ensurePanelShown('left');
      leftPanelTabs.switchTab('templates');
    }
    else if (action === 'open') runMenuAction('open');
    else if (action === 'railml') runMenuAction('importRailml');
    else if (action === 'script') {
      ensurePanelShown('left');
      leftPanelTabs.switchTab('railwayScript');
    }
    else if (action === 'shortcuts') window.dispatchEvent(new CustomEvent('shortcuts-help-request'));
  },
});
on('tab-changed', () => startCard.update());

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

// ============= SHARING =============

/**
 * @brief Share dialog, diagram links, cloud storage providers
 * @details Top-bar Share button and File > Share…: link with the diagram in the URL hash (`#R…`,
 * also as an app.diagrams.net link), .drawio/PNG/SVG downloads, Web Share; SharePoint/OneDrive
 * (disabled until VITE_MSAL_CLIENT_ID is set, see docs/SHAREPOINT.md). A `#R` link in the start URL
 * opens as new tabs. Tabs opened from / saved to a provider save back there with Ctrl+S.
 */
const sharing = installSharing(tabManager, globalNotificationManager);

// ============= CLOUDFLARE ACCESS USER =============

/**
 * @brief Top-bar email + Log out of Cloudflare Access (production only, see access-identity.ts)
 * @details Asynchronous after boot; nothing shown (and nothing logged) without Access.
 */
void installAccessIdentity({
  container: document.querySelector<HTMLElement>('.top-bar-right'),
  unsavedRemoteTabs: () => sharing.unsavedRemoteTabs(),
  confirm: (opts) => confirmDialog(opts),
  allowLeave: () => sharing.allowLeave(),
});

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
  window.addEventListener('open-shape-designer', () => openShapeDesigner());
  window.addEventListener('edit-custom-shape', (e) => {
    openShapeDesigner((e as CustomEvent<{ shapeId?: string } | undefined>).detail?.shapeId);
  });

  // Refresh custom shapes when tab changes
  on('tab-changed', () => {
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
logger.debug('main-editor', '✓ Railway Drawer with tabs, stencils, and custom shapes initialized');
