import { Graph, RubberBandHandler, CellEditorHandler, InternalEvent } from '@maxgraph/core';
import { configureDiagramRendering } from './diagram-graph-setup';
import { PropertiesPanel } from './properties';
import { StatusBarController } from './statusbar';
import { ClipboardController } from './clipboard';
import { DeleteController } from './delete';
import { UndoRedoController } from './undoredo';
import { PanController } from './pan';
import { GridController } from './grid';
import { GRID_SETTINGS_EVENT, syncGridUi } from './grid-toggle';
import { SaveLoadController } from './saveload';
import { CanvasProperties } from './canvas-properties';
import { ContextMenuController } from './context-menu';
import { MenuController } from './menu';
import { InteractiveUIController } from './interactive-ui';
import { installDrawioBehaviour } from '../drawio-shapes/behaviour';
import { installDrawioHandles } from '../drawio-shapes/handles';
import { installStencilAutoload } from './drawio-stencil-autoload';
import { CacheService, CacheData, CacheSaveResult } from '../services/cache-service';
import { sanitizeScenarios } from '../scenarios/scenario-model';
import { sanitizeCachedScript } from '../railway-script/script-store';
import { globalSaveStatusIndicator } from './save-status';
import { globalNotificationManager } from './notification';
import { GraphCommandService } from '../services/graph-command-service';
import { ConnectionHandler } from './connections';
import { TextEditorController } from './text-editor';
import { EdgePropertiesController } from './edge-properties';
import { LayersController } from './layers';
import { installCellLocking } from './cell-lock';
import { installGroupBackgroundHit, installRailwaySplitRules } from './canvas-interaction';
import { installCanvasScroll, uninstallCanvasScroll } from './canvas-scroll';
import { HoverArrowsController } from './hover-arrows';
import { ImageUploadController } from './image-upload';
import { PasteImageController } from './paste-image';
import { ZoomController } from './zoom';
import { AlignmentController } from './alignment';
import { GroupingController } from './grouping';
import { TransformController } from './transform';
import { GridSnapController } from './grid-snap';
import { DuplicateOffsetController } from './duplicate-offset';
import { ExportImageController } from './export-image';
import { PlantUmlEditorController } from './plantuml-editor';

export interface TabData {
  id: string;
  name: string;
  graph: Graph;
  graphCommandService: GraphCommandService;
  propertiesPanel: PropertiesPanel;
  statusBarController: StatusBarController;
  clipboardController: ClipboardController;
  deleteController: DeleteController;
  undoRedoController: UndoRedoController;
  panController: PanController;
  gridController: GridController;
  saveLoadController: SaveLoadController;
  canvasProperties: CanvasProperties;
  contextMenuController: ContextMenuController;
  menuController: MenuController;
  interactiveUIController: InteractiveUIController;
  layersController: LayersController;
  imageUploadController: ImageUploadController;
  pasteImageController: PasteImageController;
  zoomController: ZoomController;
  alignmentController: AlignmentController;
  groupingController: GroupingController;
  transformController: TransformController;
  gridSnapController: GridSnapController;
  duplicateOffsetController: DuplicateOffsetController;
  exportImageController: ExportImageController;
  plantumlEditorController: PlantUmlEditorController;
  textEditorController: TextEditorController;
  /** draw.io connection arrows around the hovered shape (hover-arrows.ts) */
  hoverArrowsController: HoverArrowsController;
}

/**
 * A DOM listener that a tab's controllers registered outside the tab's own graph element
 * (on `document`, `window`, or shared UI such as the menu bar, toolbar and properties panel).
 */
/** TabData whose graph references are released (nulled) when the tab is destroyed. */
type ReleasableTabData = Omit<TabData, 'graph' | 'graphCommandService'> & {
  graph: Graph | null;
  graphCommandService: GraphCommandService | null;
};

/** A tab controller that may expose an optional destroy() hook. */
type MaybeDestroyable = { destroy?: unknown } | null | undefined;

interface TabScopedListener {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

export class TabManager {
  private tabs: Map<string, TabData> = new Map();
  private activeTabId: string | null = null;
  private tabBarContainer: HTMLElement;
  private graphContainer: HTMLElement;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private saveLoadControllers: Map<string, SaveLoadController> = new Map();
  /**
   * Shared-DOM listeners per tab. Only the active tab's listeners are attached, so every global
   * UI action (menu, toolbar, shortcuts, properties) runs once and against the active tab.
   * They are removed for good when the tab is closed.
   */
  private tabListeners: Map<string, TabScopedListener[]> = new Map();
  private cacheSaveFailed = false;
  /**
   * Cached diagram XML of tabs that could not be restored, by tab id. Until the user edits such
   * a tab, autosave writes this XML back unchanged instead of the tab's empty model, so the
   * diagram is not destroyed and a later fix or version can still recover it.
   */
  private unrestoredTabXml: Map<string, string> = new Map();
  /**
   * Remote-file binding data per tab (`CacheData.tabs[].remote`, opaque here). Filled by
   * restoreFromCache, which runs before sharing is installed; the remote session claims each entry
   * (takeCachedRemote) and from then on supplies it through the writer (setRemoteCacheWriter).
   */
  private cachedRemote: Map<string, unknown> = new Map();
  private remoteCacheWriter: ((tabId: string) => unknown) | null = null;
  /** Asked before the user closes a tab with its × button; false keeps the tab. */
  private closeGuard: ((tabId: string) => boolean) | null = null;
  /** Decorates each rendered tab element (unsaved-changes dot of remote-bound tabs). */
  private tabDecorator: ((tabId: string, element: HTMLElement) => void) | null = null;

  constructor(tabBarContainerId: string, graphContainerId: string) {
    this.tabBarContainer = document.getElementById(tabBarContainerId)!;
    this.graphContainer = document.getElementById(graphContainerId)!;
    this.startAutoSave();
    window.addEventListener(GRID_SETTINGS_EVENT, this.onGridSettings);
  }

  /** A load applied a file's grid to a tab: the shared controls follow when it is the active one. */
  private readonly onGridSettings = (e: Event): void => {
    const graph = (e as CustomEvent<{ graph?: Graph }>).detail?.graph;
    if (graph && graph === this.getActiveTab()?.graph) syncGridUi(graph);
  };

  /** Unique tab id; crypto.randomUUID is unavailable outside secure contexts (plain-http deploys). */
  private generateTabId(): string {
    let tabId: string;
    do {
      const unique =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      tabId = `tab-${unique}`;
    } while (this.tabs.has(tabId));
    return tabId;
  }

  /**
   * Runs `build` (the construction of one tab's controllers) and records every listener it adds
   * to a target outside `tabElement`. The controllers bind to shared DOM and `document` directly;
   * recording those bindings lets the TabManager attach them only while the tab is active and
   * remove them when the tab closes, without each controller having to track that itself.
   * `once` listeners are not recorded, since re-attaching them would re-arm them.
   *
   * Only listeners added while `build` runs are seen. A controller that binds to shared DOM or
   * `document` later (when a dialog opens, an edit starts, ...) must scope that listener itself:
   * remove it when the dialog/edit ends and in its destroy() (see DuplicateOffsetController and
   * TextEditorController), or bind it to an element it creates and removes.
   */
  private captureSharedListeners<T>(tabElement: HTMLElement, sink: TabScopedListener[], build: () => T): T {
    const proto = EventTarget.prototype;
    const nativeAddEventListener = proto.addEventListener;
    proto.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ): void {
      nativeAddEventListener.call(this, type, listener, options);
      if (!listener) return;
      if (this instanceof Node && tabElement.contains(this)) return;
      if (typeof options === 'object' && options.once) return;
      sink.push({ target: this, type, listener, options });
    };
    try {
      return build();
    } finally {
      proto.addEventListener = nativeAddEventListener;
    }
  }

  private attachTabListeners(tabId: string): void {
    const listeners = this.tabListeners.get(tabId);
    if (!listeners) return;
    // Drop listeners whose AbortSignal already fired (their controller disposed them)
    const live = listeners.filter(
      ({ options }) => !(typeof options === 'object' && options.signal?.aborted)
    );
    this.tabListeners.set(tabId, live);
    live.forEach(({ target, type, listener, options }) => {
      target.addEventListener(type, listener, options);
    });
  }

  private detachTabListeners(tabId: string): void {
    this.tabListeners.get(tabId)?.forEach(({ target, type, listener, options }) => {
      target.removeEventListener(type, listener, options);
    });
  }

  /** "Diagram <n>" with the lowest n that no open tab uses (the default name of new tabs). */
  nextDefaultTabName(): string {
    const used = new Set(Array.from(this.tabs.values(), (tab) => tab.name));
    let n = 1;
    while (used.has(`Diagram ${n}`)) n++;
    return `Diagram ${n}`;
  }

  /**
   * New empty diagram in its own tab, shown at once (tab bar "+", File > New): named "Diagram <n>",
   * its project too, so the top-bar title, the tab label and the file name agree.
   */
  openNewTab(): TabData {
    const tab = this.createTab();
    tab.saveLoadController.setProjectName(tab.name);
    this.switchTab(tab.id);
    // The title follows the shown tab (setProjectName ran while the tab was still hidden)
    this.showProjectName(tab);
    return tab;
  }

  createTab(name: string = this.nextDefaultTabName()): TabData {
    const tabId = this.generateTabId();

    // Create new graph container
    const graphDiv = document.createElement('div');
    graphDiv.id = `graph-${tabId}`;
    graphDiv.style.width = '100%';
    graphDiv.style.height = '100%';
    // Positioned: overlays (hover arrows, previews) are absolute children of the graph div, which
    // is also the scroll container (.rd-graph-canvas, canvas-scroll.ts), so they scroll with it
    graphDiv.style.position = 'relative';
    graphDiv.classList.add('rd-graph-canvas');
    graphDiv.style.display = this.activeTabId ? 'none' : 'block';
    this.graphContainer.appendChild(graphDiv);

    // Initialize graph with defaults
    const graph = new Graph(graphDiv);
    graph.cellsMovable = true;
    graph.cellsResizable = true;
    graph.cellsEditable = true;
    graph.cellsSelectable = true;
    graph.setConnectable(true);
    graph.dropEnabled = true;
    graph.setMultigraph(false);

    // Enable rubber band selection - drag to select multiple objects
    new RubberBandHandler(graph);

    // Enable text editing on double-click
    const cellEditorHandler = new CellEditorHandler(graph);
    // Store on graph for access by TextEditorController
    (graph as Graph & { cellEditorHandler?: CellEditorHandler }).cellEditorHandler = cellEditorHandler;

    // Configure scrolling behavior
    graph.ignoreScrollbars = false; // Use native scrollbars
    graph.translateToScrollPosition = false; // Don't convert scroll to translate

    // Styles and rendering compat shared with the scenario view graph (diagram-graph-setup.ts)
    configureDiagramRendering(graph);
    installDrawioBehaviour(graph);
    // draw.io lock: locked=1 on cells and layers (cell-lock.ts)
    installCellLocking(graph);
    // A press in a gap of a transparent group (ERTMS symbols) moves the group (canvas-interaction.ts)
    installGroupBackgroundHit(graph);
    // No edge split when a railway symbol is dropped on a track (or with Alt/Shift, like draw.io)
    installRailwaySplitRules(graph);
    installDrawioHandles(graph);
    // Named stencils (mxgraph.basic.*, ...) are fetched when cells using them arrive (load, paste, insert)
    installStencilAutoload(graph);
    // draw.io scrolling canvas: padding around the content, zoom around the focus (canvas-scroll.ts)
    installCanvasScroll(graph);

    // Controllers bind to shared DOM and `document`; record those listeners so they are only
    // attached while this tab is active (see captureSharedListeners).
    const sharedListeners: TabScopedListener[] = [];
    this.tabListeners.set(tabId, sharedListeners);
    const controllers = this.captureSharedListeners(graphDiv, sharedListeners, () => {
      // Configure connection points on shapes
      new ConnectionHandler(graph);

      // Configure double-click text editing
      const textEditorController = new TextEditorController(graph);

      // Configure edge/connector properties
      new EdgePropertiesController(graph);

      // Initialize centralized command service
      const graphCommandService = new GraphCommandService(graph);

      // Initialize UI controllers
      const propertiesPanel = new PropertiesPanel(graph);
      const statusBarController = new StatusBarController(graph);
      const clipboardController = new ClipboardController(graph);
      const deleteController = new DeleteController(graph);
      const undoRedoController = new UndoRedoController(graph, graphCommandService);
      const panController = new PanController(graph);
      const gridController = new GridController(graph, 10);
      const saveLoadController = new SaveLoadController(graph, graphCommandService);
      const canvasProperties = new CanvasProperties(graph);
      const contextMenuController = new ContextMenuController(graph);
      const menuController = new MenuController(graph, graphCommandService, saveLoadController);
      const interactiveUIController = new InteractiveUIController(graph, graphCommandService);
      const layersController = new LayersController(graph);
      const imageUploadController = new ImageUploadController(graph);
      const pasteImageController = new PasteImageController(graph);
      const zoomController = new ZoomController(graph);
      const alignmentController = new AlignmentController(graph);
      const groupingController = new GroupingController(graph);
      const plantumlEditorController = new PlantUmlEditorController(graph);
      contextMenuController.setGroupingController(groupingController);
      contextMenuController.setCommandService(graphCommandService);
      menuController.setAlignmentController(alignmentController);
      const transformController = new TransformController(graph);
      const gridSnapController = new GridSnapController(graph);
      const duplicateOffsetController = new DuplicateOffsetController(graph);
      // File > Export as PNG/SVG: the tab's model, file named after the tab
      const exportImageController = new ExportImageController({
        getModelXml: () => saveLoadController.serializeToXml(),
        getName: () => this.tabs.get(tabId)?.name ?? name,
      });
      menuController.setExportImageController(exportImageController);

      return {
        graphCommandService,
        propertiesPanel,
        statusBarController,
        clipboardController,
        deleteController,
        undoRedoController,
        panController,
        gridController,
        saveLoadController,
        canvasProperties,
        contextMenuController,
        menuController,
        interactiveUIController,
        layersController,
        imageUploadController,
        pasteImageController,
        zoomController,
        alignmentController,
        groupingController,
        transformController,
        gridSnapController,
        duplicateOffsetController,
        exportImageController,
        plantumlEditorController,
        textEditorController,
      };
    });
    const { saveLoadController } = controllers;
    // draw.io hover arrows (hover-arrows.ts): after ConnectionHandler, whose plugin it wraps. Built
    // outside captureSharedListeners: its listeners are on the graph div and its own arrow elements.
    const hoverArrowsController = new HoverArrowsController(graph);

    const tabData: TabData = {
      id: tabId,
      name,
      graph,
      ...controllers,
      hoverArrowsController,
    };

    this.tabs.set(tabId, tabData);
    this.saveLoadControllers.set(tabId, saveLoadController);

    if (!this.activeTabId) {
      this.activeTabId = tabId;
    } else {
      // Created in the background: its shared-DOM listeners stay detached until it is shown
      this.detachTabListeners(tabId);
      tabData.undoRedoController.setActive(false);
      // Its constructors rendered into the shared panels; point them back at the active tab
      const activeTab = this.getActiveTab();
      if (activeTab) this.refreshSharedPanels(activeTab);
    }

    this.renderTabBar();
    return tabData;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveToCache();
    }, 5000); // Auto-save every 5 seconds
  }

  /**
   * Writes all tabs to the browser cache now, instead of waiting for the next 5 s autosave.
   * Call before the page goes away (reload, editor switch) so the latest edits are kept.
   * @returns false when the write failed (e.g. storage full): edits since the last good save are not cached.
   */
  flushCache(): boolean {
    return this.saveToCache();
  }

  private saveToCache(): boolean {
    if (this.tabs.size === 0 || !this.activeTabId) return true;

    const cacheData: CacheData = {
      projectName: this.getProjectName(),
      tabs: Array.from(this.tabs.values()).map((tab) => {
        const { extraPages, pageId } = tab.saveLoadController.getPreservedPages();
        const scenarios = tab.saveLoadController.getScenarios().toJSON();
        const railwayScript = tab.saveLoadController.getRailwayScript().get();
        return {
          id: tab.id,
          name: tab.name,
          projectName: tab.saveLoadController.getProjectName(),
          graphXml: this.unrestoredTabXml.get(tab.id) ?? tab.saveLoadController.serializeToXml(),
          // Only written when there is something to keep, so single-page caches stay as they were
          ...(extraPages.length > 0 ? { extraPages } : {}),
          ...(pageId ? { pageId } : {}),
          ...(scenarios.length > 0 ? { scenarios } : {}),
          ...(railwayScript.trim() ? { railwayScript } : {}),
          ...this.remoteCacheEntry(tab.id),
        };
      }),
      activeTabId: this.activeTabId,
      timestamp: Date.now(),
    };

    const result = CacheService.save(cacheData);
    this.reportCacheSaveResult(result);
    return result === 'saved';
  }

  /** `{ remote }` of a tab for the cache, or nothing when it is not bound. */
  private remoteCacheEntry(tabId: string): { remote?: unknown } {
    let remote: unknown;
    try {
      remote = this.remoteCacheWriter ? this.remoteCacheWriter(tabId) : this.cachedRemote.get(tabId);
    } catch (error) {
      console.error('[TabManager] Remote binding not cached:', error);
      remote = undefined;
    }
    return remote === undefined || remote === null ? {} : { remote };
  }

  /** Supplies each tab's remote binding for the cache (replaces the restored entries). */
  setRemoteCacheWriter(writer: ((tabId: string) => unknown) | null): void {
    this.remoteCacheWriter = writer;
  }

  /** The cached remote binding of a restored tab, once (undefined when it had none). */
  takeCachedRemote(tabId: string): unknown {
    const remote = this.cachedRemote.get(tabId);
    this.cachedRemote.delete(tabId);
    return remote;
  }

  setCloseGuard(guard: ((tabId: string) => boolean) | null): void {
    this.closeGuard = guard;
  }

  setTabDecorator(decorator: ((tabId: string, element: HTMLElement) => void) | null): void {
    this.tabDecorator = decorator;
    this.renderTabBar();
  }

  /**
   * Shows autosave failures (typically a full localStorage quota) in the save-status indicator.
   * Reported once per failure streak so the 5 s autosave does not repeat the notification.
   */
  private reportCacheSaveResult(result: CacheSaveResult): void {
    if (result === 'saved') {
      if (this.cacheSaveFailed) {
        this.cacheSaveFailed = false;
        globalSaveStatusIndicator.setSaved();
      }
      return;
    }
    if (this.cacheSaveFailed) return;
    this.cacheSaveFailed = true;
    globalSaveStatusIndicator.setError(
      result === 'quota-exceeded'
        ? 'Browser storage is full, autosave paused. Save to disk (Ctrl+S).'
        : 'Autosave to browser storage failed. Save to disk (Ctrl+S).'
    );
  }

  /**
   * Recreates the tabs stored in the cache. Returns false when there was no usable cache
   * (missing, corrupt or from an older version), so the caller can start with a fresh tab.
   * A tab whose diagram cannot be decoded is kept empty and reported to the user.
   */
  restoreFromCache(): boolean {
    const cacheData = CacheService.load();
    if (!cacheData) return false;

    let activeTabId: string | null = null;
    let failedTabs = 0;
    let migratedTabs = 0;
    let layerMigratedTabs = 0;

    for (const tabCache of cacheData.tabs) {
      const tabData = this.createTab(tabCache.name);
      // Pages 2..n of the opened file are kept even when page 1 cannot be restored
      const extraPages = Array.isArray(tabCache.extraPages)
        ? tabCache.extraPages.filter((page): page is string => typeof page === 'string')
        : [];
      const pageId = typeof tabCache.pageId === 'string' && tabCache.pageId ? tabCache.pageId : null;
      tabData.saveLoadController.setPreservedPages(extraPages, pageId);
      // Scenarios are kept even when the drawing itself cannot be restored
      tabData.saveLoadController.getScenarios().replaceAll(sanitizeScenarios(tabCache.scenarios));
      tabData.saveLoadController.getRailwayScript().set(sanitizeCachedScript(tabCache.railwayScript), 'load');
      // Each tab's own project (caches of earlier versions: only the active tab's, set below)
      if (typeof tabCache.projectName === 'string' && tabCache.projectName) {
        tabData.saveLoadController.setProjectName(tabCache.projectName);
      }
      try {
        tabData.saveLoadController.load(tabCache.graphXml);
        if (CacheService.isLegacyGraphXml(tabCache.graphXml)) migratedTabs++;
        // Old app layers (rdLayerId) became draw.io layers: unsaved, and cached right away
        if (tabData.saveLoadController.hasUnsavedLoadChanges()) {
          migratedTabs++;
          layerMigratedTabs++;
        }
      } catch (error) {
        failedTabs++;
        console.error('[TabManager] Failed to restore tab from cache:', tabCache.name, error);
        this.keepUnrestoredXml(tabData, tabCache.graphXml);
      }
      // Claimed by the remote session (install-sharing.ts) once it exists
      if (tabCache.remote !== undefined && tabCache.remote !== null) this.cachedRemote.set(tabData.id, tabCache.remote);

      // Track the first tab as active, or the tab matching the cached active tab
      if (activeTabId === null || tabCache.id === cacheData.activeTabId) {
        activeTabId = tabData.id;
      }
    }

    // Switch to the appropriate tab (first tab by default)
    if (activeTabId) {
      this.switchTab(activeTabId);
    }
    // Caches of earlier versions kept one project name (the top-bar title): the active tab's
    const active = this.getActiveTab();
    const activeCache = cacheData.tabs.find((t) => t.id === cacheData.activeTabId) ?? cacheData.tabs[0];
    if (active && typeof activeCache?.projectName !== 'string' && cacheData.projectName) {
      active.saveLoadController.setProjectName(cacheData.projectName);
    }
    if (active) this.showProjectName(active);

    // Diagrams cached by earlier versions (<GraphDataModel>) are rewritten in the draw.io
    // format right away instead of at the next autosave. Tabs that failed keep their XML.
    if (migratedTabs > 0) {
      console.log('[TabManager] Migrating', migratedTabs, 'cached diagram(s) to the draw.io format');
      this.saveToCache();
    }
    if (layerMigratedTabs > 0) {
      globalSaveStatusIndicator.setUnsaved();
      globalNotificationManager.info(
        `The layers of ${layerMigratedTabs} diagram(s) from an earlier version were converted to draw.io layers ` +
          '(see the Layers panel). Save to keep the change in your files.'
      );
    }

    if (failedTabs > 0) {
      globalNotificationManager.warning(
        `${failedTabs} cached diagram(s) could not be restored and were opened empty. ` +
          'Their saved data is kept in browser storage until you edit those tabs.'
      );
    }

    console.log('[TabManager] Restored from cache');
    return this.tabs.size > 0;
  }

  /**
   * Keeps the cached XML of a tab that failed to restore, so autosave does not overwrite it with
   * the empty model. The first edit of the tab (any model change) makes it a normal tab again.
   */
  private keepUnrestoredXml(tab: TabData, graphXml: string): void {
    this.unrestoredTabXml.set(tab.id, graphXml);
    const model = tab.graph.getDataModel();
    const onFirstEdit = () => {
      this.unrestoredTabXml.delete(tab.id);
      model.removeListener(onFirstEdit);
    };
    model.addListener(InternalEvent.CHANGE, onFirstEdit);
  }

  clearCache(): void {
    CacheService.clear();
  }

  /** The active tab's project name (the cache's top-level `projectName`, for older readers). */
  private getProjectName(): string {
    return this.getActiveTab()?.saveLoadController.getProjectName() || 'Untitled Diagram';
  }

  /** Puts `tab`'s project name on the top-bar title (each tab has its own project). */
  private showProjectName(tab: TabData): void {
    const titleElement = document.querySelector('.document-title') as HTMLElement | null;
    // Not while the title is being edited (its input lives inside the element)
    if (titleElement && !titleElement.querySelector('input')) {
      titleElement.textContent = tab.saveLoadController.getProjectName();
    }
  }

  /**
   * Renames the active tab's project (top-bar title): file name of Save/Export and `<diagram
   * name>`. A tab labelled with the old project name (tabs opened from a file or link are named
   * after it) is relabelled too; other labels are the user's own and stay. Cached at once.
   */
  renameActiveProject(newName: string): void {
    const tab = this.getActiveTab();
    if (!tab) return;
    const oldName = tab.saveLoadController.getProjectName();
    if (newName === oldName) return;
    tab.saveLoadController.setProjectName(newName);
    if (tab.name === oldName) {
      tab.name = newName;
      this.renderTabBar();
    }
    this.saveToCache();
  }

  switchTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return;

    // Clicking the active tab is a no-op. Re-rendering here would replace the tab's label between
    // the two clicks of a double-click, so the rename (dblclick) handler never ran on a live label.
    if (this.activeTabId === tabId) return;

    // Hide previous tab and unbind its shared-DOM listeners
    if (this.activeTabId) {
      const prevGraphDiv = document.getElementById(`graph-${this.activeTabId}`);
      if (prevGraphDiv) prevGraphDiv.style.display = 'none';
      this.detachTabListeners(this.activeTabId);
    }

    // Show new tab and bind its shared-DOM listeners
    const newGraphDiv = document.getElementById(`graph-${tabId}`);
    if (newGraphDiv) newGraphDiv.style.display = 'block';
    this.attachTabListeners(tabId);

    this.activeTabId = tabId;
    const newTab = this.tabs.get(tabId);
    if (newTab) {
      this.refreshSharedPanels(newTab);
      this.showProjectName(newTab);
    }
    // Only the highlight changes: keep the tab elements, so a double-click that started on an
    // inactive tab still reaches the same label and opens the rename editor
    this.updateActiveTabHighlight();
    // Global listeners (custom shapes toolbar, remote-file status) follow the active tab
    window.dispatchEvent(new CustomEvent('tab-changed', { detail: { tabId } }));
  }

  private updateActiveTabHighlight(): void {
    this.tabBarContainer.querySelectorAll<HTMLElement>('.tab-button').forEach((tabElement) => {
      const isActive = tabElement.dataset.tabId === this.activeTabId;
      tabElement.classList.toggle('active', isActive);
      tabElement.setAttribute('aria-selected', String(isActive));
    });
  }

  /**
   * Shows `tab`'s state in the shared panels whose content is per tab. Hidden tabs ignore
   * selection/history events and a background tab's constructors render into these panels,
   * so they are refreshed whenever the active tab changes.
   */
  private refreshSharedPanels(tab: TabData): void {
    this.tabs.forEach((other) => other.undoRedoController.setActive(other === tab));
    tab.layersController.refresh();
    tab.propertiesPanel.update();
    tab.statusBarController.syncZoom();
    // View > Grid, toolbar and Properties > Canvas show this tab's grid (per tab, from its file)
    syncGridUi(tab.graph);
  }

  closeTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return;
    if (this.tabs.size === 1) return; // Keep at least one tab

    // Destroy the tab and clean up resources
    this.destroyTab(tabId);
    this.tabs.delete(tabId);
    this.saveLoadControllers.delete(tabId);
    window.dispatchEvent(new CustomEvent('tab-closed', { detail: { tabId } }));

    // Switch to another tab if the closed tab was active
    if (this.activeTabId === tabId) {
      const nextTabId = this.tabs.keys().next().value;
      if (nextTabId) {
        this.switchTab(nextTabId);
      } else {
        this.activeTabId = null;
      }
    }

    this.renderTabBar();
  }

  getActiveTab(): TabData | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }

  getAllTabs(): TabData[] {
    return Array.from(this.tabs.values());
  }

  renameTab(tabId: string, newName: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.name = newName;
      const saveLoadController = this.saveLoadControllers.get(tabId);
      if (saveLoadController) {
        saveLoadController.setProjectName(newName);
      }
      this.renderTabBar();
    }
  }

  destroy(): void {
    window.removeEventListener(GRID_SETTINGS_EVENT, this.onGridSettings);
    // Clear auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Clean up all tabs
    Array.from(this.tabs.keys()).forEach((tabId) => {
      this.destroyTab(tabId);
    });

    this.tabs.clear();
    this.saveLoadControllers.clear();
    this.activeTabId = null;
  }

  private destroyTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Unbind the tab's shared-DOM listeners (menu, toolbar, document shortcuts, ...) for good
    this.detachTabListeners(tabId);
    this.tabListeners.delete(tabId);
    this.unrestoredTabXml.delete(tabId);
    this.cachedRemote.delete(tabId);

    try {
      // Clean up controller destroy methods if they exist (before the graph they use is destroyed)
      const controllers = [
        tab.graphCommandService,
        tab.propertiesPanel,
        tab.statusBarController,
        tab.clipboardController,
        tab.deleteController,
        tab.undoRedoController,
        tab.panController,
        tab.gridController,
        tab.saveLoadController,
        tab.canvasProperties,
        tab.contextMenuController,
        tab.menuController,
        tab.interactiveUIController,
        tab.layersController,
        tab.imageUploadController,
        tab.pasteImageController,
        tab.zoomController,
        tab.alignmentController,
        tab.groupingController,
        tab.transformController,
        tab.gridSnapController,
        tab.duplicateOffsetController,
        tab.exportImageController,
        tab.plantumlEditorController,
        tab.textEditorController,
        tab.hoverArrowsController,
      ];

      controllers.forEach((item) => {
        const controller = item as MaybeDestroyable;
        if (controller && typeof controller.destroy === 'function') {
          try {
            (controller as { destroy: () => void }).destroy();
          } catch (e) {
            console.warn('[TabManager] Error destroying controller:', e);
          }
        }
      });

      // Dispose graph (removes event listeners, clears model, disposes view)
      if (tab.graph) {
        uninstallCanvasScroll(tab.graph);
        tab.graph.destroy();
      }

      // Remove graph DOM element
      const graphDiv = document.getElementById(`graph-${tabId}`);
      if (graphDiv) {
        graphDiv.remove();
      }

      // Nullify references for garbage collection
      const released: ReleasableTabData = tab;
      released.graph = null;
      released.graphCommandService = null;
    } catch (e) {
      console.error('[TabManager] Error destroying tab:', tabId, e);
    }
  }

  private renderTabBar(): void {
    this.tabBarContainer.innerHTML = '';

    // Render tabs
    this.tabBarContainer.setAttribute('role', 'tablist');
    this.tabs.forEach((tab: TabData) => {
      // A focusable element with the tab role rather than a <button>: the rename editor puts an
      // <input> (and the close button sits) inside it, and interactive content inside a <button>
      // does not get its own clicks/keys in every browser (Firefox targets the button itself).
      const tabButton = document.createElement('div');
      tabButton.className = 'tab-button';
      tabButton.dataset.tabId = tab.id;
      tabButton.setAttribute('role', 'tab');
      tabButton.tabIndex = 0;
      const isActive = tab.id === this.activeTabId;
      tabButton.classList.toggle('active', isActive);
      tabButton.setAttribute('aria-selected', String(isActive));

      const tabLabel = document.createElement('span');
      tabLabel.className = 'tab-label';
      tabLabel.textContent = tab.name;

      // Add double-click to edit tab name
      tabLabel.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.editTabName(tab, tabLabel);
      });

      tabButton.appendChild(tabLabel);

      if (this.tabs.size > 1) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close-btn';
        closeBtn.textContent = '×';

        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.closeGuard && !this.closeGuard(tab.id)) return;
          this.closeTab(tab.id);
        });

        tabButton.appendChild(closeBtn);
      }

      this.tabDecorator?.(tab.id, tabButton);
      tabButton.addEventListener('click', () => this.switchTab(tab.id));
      tabButton.addEventListener('keydown', (e) => {
        // Keyboard activation like a button; keys typed in the rename input are not for the tab
        if (e.target !== tabButton) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Keep the keypress from reaching graph-level document handlers (label editor etc.)
          e.stopPropagation();
          this.switchTab(tab.id);
        }
      });
      this.tabBarContainer.appendChild(tabButton);
    });

    // Add new tab button
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'tab-new-btn';
    newTabBtn.textContent = '+';
    newTabBtn.title = 'New diagram';
    newTabBtn.setAttribute('aria-label', 'New diagram');

    newTabBtn.addEventListener('click', () => {
      this.openNewTab();
    });

    this.tabBarContainer.appendChild(newTabBtn);
  }

  private editTabName(tab: TabData, labelElement: HTMLSpanElement): void {
    console.log('[TabManager] Editing tab name:', tab.name);

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = tab.name;
    input.style.padding = '2px 4px';
    input.style.border = '1px solid var(--rd-focus)';
    input.style.borderRadius = '3px';
    input.style.fontSize = '12px';
    input.style.fontWeight = '500';
    input.style.width = `${Math.max(tab.name.length * 7, 60)}px`;

    // The input sits inside the tab element: keep its clicks from reaching the tab's switchTab
    // handler and the close button's neighbours (they are for the tab, not for the text field)
    const stopAtInput = (evt: Event) => evt.stopPropagation();
    input.addEventListener('click', stopAtInput);
    input.addEventListener('mousedown', stopAtInput);
    input.addEventListener('dblclick', stopAtInput);

    // A label already detached by a re-render cannot host the editor
    if (!labelElement.isConnected) return;

    // Replace label with input
    labelElement.replaceWith(input);
    input.focus();
    input.select();

    // Enter, Escape and blur each end the edit. Removing the input fires blur again, so only the
    // first of them may act (otherwise Escape would still save). The label is put back in place
    // instead of re-rendering the whole tab bar: a blur caused by pressing another tab must not
    // destroy that tab's element before its click arrives.
    let finished = false;
    const finish = (save: boolean) => {
      if (finished) return;
      finished = true;
      const newName = input.value.trim();
      if (save && newName && newName !== tab.name && this.tabs.get(tab.id) === tab) {
        tab.name = newName;
        console.log('[TabManager] Tab name changed to:', newName);
        // Save the current session (re-saving the stored copy with only the name patched would
        // mark an out-of-date cache as current after a failed autosave)
        this.saveToCache();
      }
      labelElement.textContent = tab.name;
      if (input.isConnected) input.replaceWith(labelElement);
    };

    // Handle Enter key
    input.addEventListener('keydown', (evt: KeyboardEvent) => {
      // Typing here is for the field only, not for the tab's keyboard activation
      evt.stopPropagation();
      if (evt.key === 'Enter') {
        evt.preventDefault();
        finish(true);
      } else if (evt.key === 'Escape') {
        evt.preventDefault();
        finish(false);
      }
    });

    // Handle blur
    input.addEventListener('blur', () => finish(true));
  }
}
