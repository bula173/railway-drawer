import { Graph } from '@maxgraph/core';
import { setupGraph, teardownGraph } from './setup-graph';
import { createSessionViews, type SessionViews } from './session-views';
import { setActiveSession, type DiagramSession } from './session';
import { ClipboardController } from './clipboard';
import { DeleteController } from './delete';
import { PanController } from './pan';
import { GridController } from './grid';
import { GRID_SETTINGS_EVENT, syncGridUi } from './grid-toggle';
import type { DiagramDocument } from '../document/diagram-document';
import { emit, off, on } from '../core/event-bus';
import { createTabDocument, SaveLoadController } from './saveload';
import { ContextMenuController } from './context-menu';

import { CacheService, CacheSaveResult, type CachedTabJson } from '../services/cache-service';
import { runWhenIdle } from '../core/idle';
import { globalSaveStatusIndicator } from './save-status';
import { globalNotificationManager } from './notification';
import { GraphCommandService } from '../services/graph-command-service';

import { TextEditorController } from './text-editor';

import { HoverArrowsController } from './hover-arrows';
import { ImageUploadController } from './image-upload';
import { PasteImageController } from './paste-image';
import { AlignmentController } from './alignment';
import { GroupingController } from './grouping';
import { TransformController } from './transform';
import { GridSnapController } from './grid-snap';
import { DuplicateOffsetController } from './duplicate-offset';
import { ExportImageController } from './export-image';
import { PlantUmlEditorController } from './plantuml-editor';
import { logger } from '../drawio/logger';

export interface TabData extends DiagramSession {
  id: string;
  name: string;
  graph: Graph;
  graphCommandService: GraphCommandService;
  /** The tab's document (model, project, pages, sections, remote binding, autosave state). */
  document: DiagramDocument;
  clipboardController: ClipboardController;
  deleteController: DeleteController;
  panController: PanController;
  gridController: GridController;
  saveLoadController: SaveLoadController;
  contextMenuController: ContextMenuController;
  imageUploadController: ImageUploadController;
  pasteImageController: PasteImageController;
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

/** TabData whose graph references are released (nulled) when the tab is destroyed. */
type ReleasableTabData = Omit<TabData, 'graph' | 'graphCommandService'> & {
  graph: Graph | null;
  graphCommandService: GraphCommandService | null;
};

/** A tab controller that may expose an optional destroy() hook. */
type MaybeDestroyable = { destroy?: unknown } | null | undefined;

/**
 * A DOM listener that a tab's controllers registered outside the tab's own graph element
 * (on `document`, `window`, or shared UI such as the menu bar, toolbar and properties panel).
 */
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
  /** The shell's panels, created once and bound to the active tab's session (session-views.ts). */
  readonly views: SessionViews;
  /**
   * Shared-DOM listeners per tab. Only the active tab's listeners are attached, so every global
   * UI action (menu, toolbar, shortcuts, properties) runs once and against the active tab.
   * They are removed for good when the tab is closed.
   */
  private tabListeners: Map<string, TabScopedListener[]> = new Map();
  private cacheSaveFailed = false;
  /**
   * Supplies each tab's remote binding for the cache once the remote session exists (until then the
   * binding restored from the cache, kept by the tab's document, is written back).
   */
  private remoteCacheWriter: ((tabId: string) => unknown) | null = null;
  /** Asked before the user closes a tab with its × button; false keeps the tab. */
  private closeGuard: ((tabId: string) => boolean | Promise<boolean>) | null = null;
  /** Decorates each rendered tab element (unsaved-changes dot of remote-bound tabs). */
  private tabDecorator: ((tabId: string, element: HTMLElement) => void) | null = null;
  /** Cancels the autosave scheduled for the next idle period. */
  private cancelIdleSave: (() => void) | null = null;

  constructor(tabBarContainerId: string, graphContainerId: string) {
    this.tabBarContainer = document.getElementById(tabBarContainerId)!;
    this.graphContainer = document.getElementById(graphContainerId)!;
    this.views = createSessionViews();
    this.startAutoSave();
    on(GRID_SETTINGS_EVENT, this.onGridSettings);
  }

  /** A load applied a file's grid to a tab: the shared controls follow when it is the active one. */
  private readonly onGridSettings = ({ graph }: { graph?: Graph }): void => {
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
    tab.document.setProjectName(tab.name);
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

    // Defaults, rendering compat, editing behaviour, connections, panning: the ordered installer
    // list of setup-graph.ts (shared with the scenario view and the palette thumbnails)
    const graph = new Graph(graphDiv);
    setupGraph(graph, 'editor');
    // Initialize centralized command service, and the tab's document (load / save / autosave state)
    const graphCommandService = new GraphCommandService(graph);
    const diagramDocument = createTabDocument(graph, graphCommandService);

    // Controllers bind to shared DOM and `document`; record those listeners so they are only
    // attached while this tab is active (see captureSharedListeners).
    const sharedListeners: TabScopedListener[] = [];
    this.tabListeners.set(tabId, sharedListeners);
    const controllers = this.captureSharedListeners(graphDiv, sharedListeners, () => {
      // Configure double-click text editing
      const textEditorController = new TextEditorController(graph);

      // Configure edge/connector properties

      // Initialize UI controllers
      const clipboardController = new ClipboardController(graph);
      const deleteController = new DeleteController(graph);
      const panController = new PanController(graph);
      const gridController = new GridController(graph, 10);
      const saveLoadController = new SaveLoadController(diagramDocument);
      const contextMenuController = new ContextMenuController(graph);
      const imageUploadController = new ImageUploadController(graph);
      const pasteImageController = new PasteImageController(graph);
      const alignmentController = new AlignmentController(graph);
      const groupingController = new GroupingController(graph);
      const plantumlEditorController = new PlantUmlEditorController(graph);
      const transformController = new TransformController(graph);
      const gridSnapController = new GridSnapController(graph);
      const duplicateOffsetController = new DuplicateOffsetController(graph);
      // File > Export as PNG/SVG: the tab's model, file named after the tab
      const exportImageController = new ExportImageController({
        getModelXml: () => diagramDocument.serializeToXml(),
        getName: () => this.tabs.get(tabId)?.name ?? name,
      });

      return {
        clipboardController,
        deleteController,
        panController,
        gridController,
        saveLoadController,
        contextMenuController,
        imageUploadController,
        pasteImageController,
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
    // draw.io hover arrows (hover-arrows.ts): after ConnectionHandler, whose plugin it wraps. Built
    // outside captureSharedListeners: its listeners are on the graph div and its own arrow elements.
    const hoverArrowsController = new HoverArrowsController(graph);

    const tabData: TabData = {
      id: tabId,
      name,
      graph,
      graphCommandService,
      document: diagramDocument,
      ...controllers,
      hoverArrowsController,
    };

    this.tabs.set(tabId, tabData);

    if (!this.activeTabId) {
      this.activeTabId = tabId;
      // the first tab is the shown one: the session views bind to it
      setActiveSession(tabData);
    } else {
      // Created in the background: its shared-DOM listeners stay detached until it is shown
      this.detachTabListeners(tabId);
      // (the session views stay on the shown tab)
    }

    this.renderTabBar();
    return tabData;
  }

  private startAutoSave(): void {
    // Every 5 seconds, in the next idle period (only the tabs that changed are serialised)
    this.autoSaveInterval = setInterval(() => this.scheduleIdleSave(), 5000);
  }

  private scheduleIdleSave(): void {
    if (this.cancelIdleSave) return;
    this.cancelIdleSave = runWhenIdle(() => {
      this.cancelIdleSave = null;
      this.saveToCache();
    });
  }

  /** The tab's cache entry (CacheData['tabs'][number]) as JSON (only what changed is serialised again). */
  private tabCacheJson(tab: TabData, now: number): string {
    return tab.document.cacheEntryJson({ id: tab.id, name: tab.name, now, active: tab.id === this.activeTabId }, this.remoteCacheValue(tab));
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
    this.cancelIdleSave?.();
    this.cancelIdleSave = null;
    if (this.tabs.size === 0 || !this.activeTabId) return true;

    const now = Date.now();
    const tabs: CachedTabJson[] = Array.from(this.tabs.values()).map((tab) => ({ id: tab.id, json: this.tabCacheJson(tab, now) }));
    const result = CacheService.saveSession({ projectName: this.getProjectName(), activeTabId: this.activeTabId, timestamp: now }, tabs);
    this.reportCacheSaveResult(result);
    return result === 'saved';
  }

  /** The remote binding of a tab for the cache (undefined / null: not bound). */
  private remoteCacheValue(tab: TabData): unknown {
    try {
      return this.remoteCacheWriter ? this.remoteCacheWriter(tab.id) : tab.document.peekRestoredRemote();
    } catch (error) {
      console.error('[TabManager] Remote binding not cached:', error);
      return undefined;
    }
  }

  /** Supplies each tab's remote binding for the cache (replaces the restored entries). */
  setRemoteCacheWriter(writer: ((tabId: string) => unknown) | null): void {
    this.remoteCacheWriter = writer;
  }

  /** The cached remote binding of a restored tab, once (undefined when it had none). */
  takeCachedRemote(tabId: string): unknown {
    return this.tabs.get(tabId)?.document.takeRestoredRemote();
  }

  setCloseGuard(guard: ((tabId: string) => boolean | Promise<boolean>) | null): void {
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
      // Pages 2..n, scenarios, Railway Script and the tab's own project name (caches of earlier
      // versions: only the active tab's, set below) are kept even when the drawing cannot be restored
      tabData.document.restoreCacheEntry(tabCache);
      try {
        tabData.document.load(tabCache.graphXml);
        if (CacheService.isLegacyGraphXml(tabCache.graphXml)) migratedTabs++;
        // Old app layers (rdLayerId) became draw.io layers: unsaved, and cached right away
        if (tabData.document.hasUnsavedLoadChanges()) {
          migratedTabs++;
          layerMigratedTabs++;
        }
      } catch (error) {
        failedTabs++;
        console.error('[TabManager] Failed to restore tab from cache:', tabCache.name, error);
        // autosave writes the cached XML back unchanged until the tab is edited
        tabData.document.keepUnrestoredXml(tabCache.graphXml);
      }
      // Claimed by the remote session (install-sharing.ts) once it exists
      if (tabCache.remote !== undefined && tabCache.remote !== null) tabData.document.setRestoredRemote(tabCache.remote);

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
      active.document.setProjectName(cacheData.projectName);
    }
    if (active) this.showProjectName(active);

    // Diagrams cached by earlier versions (<GraphDataModel>) are rewritten in the draw.io
    // format right away instead of at the next autosave. Tabs that failed keep their XML.
    if (migratedTabs > 0) {
      logger.debug('TabManager', 'Migrating', [migratedTabs, 'cached diagram(s) to the draw.io format']);
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

    logger.debug('TabManager', 'Restored from cache');
    return this.tabs.size > 0;
  }

  clearCache(): void {
    CacheService.clear();
  }

  /** The active tab's project name (the cache's top-level `projectName`, for older readers). */
  private getProjectName(): string {
    return this.getActiveTab()?.document.getProjectName() || 'Untitled Diagram';
  }

  /** Puts `tab`'s project name on the top-bar title (each tab has its own project). */
  private showProjectName(tab: TabData): void {
    const titleElement = document.querySelector('.document-title') as HTMLElement | null;
    // Not while the title is being edited (its input lives inside the element)
    if (titleElement && !titleElement.querySelector('input')) {
      titleElement.textContent = tab.document.getProjectName();
    }
  }

  /**
   * Renames the active tab's project (top-bar title, also File > Save As…): file name of Save/Export
   * and `<diagram name>`. A tab labelled with the old project name (tabs opened from a file or link
   * are named after it) is relabelled too; other labels are the user's own and stay. Cached at once.
   * The mirror rule: renaming a tab label (double-click) that equals its project's name renames the
   * project too (editTabName).
   */
  renameActiveProject(newName: string): void {
    const tab = this.getActiveTab();
    if (!tab) return;
    const oldName = tab.document.getProjectName();
    if (newName === oldName) return;
    tab.document.setProjectName(newName);
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
      // the session views (panels, menu state) rebind to the shown tab (session.ts)
      setActiveSession(newTab);
      this.showProjectName(newTab);
    }
    // Only the highlight changes: keep the tab elements, so a double-click that started on an
    // inactive tab still reaches the same label and opens the rename editor
    this.updateActiveTabHighlight();
    // Global listeners (custom shapes toolbar, remote-file status) follow the active tab
    emit('tab-changed', { tabId });
  }

  private updateActiveTabHighlight(): void {
    this.tabBarContainer.querySelectorAll<HTMLElement>('.tab-button').forEach((tabElement) => {
      const isActive = tabElement.dataset.tabId === this.activeTabId;
      tabElement.classList.toggle('active', isActive);
      tabElement.setAttribute('aria-selected', String(isActive));
    });
  }

  closeTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return;
    if (this.tabs.size === 1) return; // Keep at least one tab

    // The views let go of the shown tab before its graph is destroyed (switchTab below binds the next)
    if (this.activeTabId === tabId) setActiveSession(null);
    // Destroy the tab and clean up resources
    this.destroyTab(tabId);
    this.tabs.delete(tabId);
    emit('tab-closed', { tabId });

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
      tab.document.setProjectName(newName);
      this.renderTabBar();
    }
  }

  destroy(): void {
    // the views let go of the shown tab before the graphs are destroyed
    setActiveSession(null);
    off(GRID_SETTINGS_EVENT, this.onGridSettings);
    // Clear auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    this.cancelIdleSave?.();
    this.cancelIdleSave = null;

    // Clean up all tabs
    Array.from(this.tabs.keys()).forEach((tabId) => {
      this.destroyTab(tabId);
    });

    this.tabs.clear();
    this.activeTabId = null;
    this.views.destroy();
  }

  private destroyTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Unbind the tab's shared-DOM listeners (menu, toolbar, document shortcuts, ...) for good
    this.detachTabListeners(tabId);
    this.tabListeners.delete(tabId);

    try {
      // Clean up controller destroy methods if they exist (before the graph they use is destroyed)
      const controllers = [
        tab.graphCommandService,
        tab.clipboardController,
        tab.deleteController,
        tab.panController,
        tab.gridController,
        tab.saveLoadController,
        tab.contextMenuController,
        tab.imageUploadController,
        tab.pasteImageController,
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

      // The document's model / section listeners (autosave state)
      tab.document.dispose();

      // Dispose graph (removes event listeners, clears model, disposes view)
      if (tab.graph) {
        teardownGraph(tab.graph);
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
          const allowed = this.closeGuard ? this.closeGuard(tab.id) : true;
          // a themed confirmation answers later; a plain answer closes at once
          if (allowed === true) this.closeTab(tab.id);
          else if (allowed !== false) void allowed.then((ok) => ok && this.tabs.has(tab.id) && this.closeTab(tab.id));
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
    logger.debug('TabManager', 'Editing tab name:', tab.name);

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
        // Mirror of renameActiveProject: a label that is the project's name renames the project too
        // (top-bar title, Save/Export file name, <diagram name>); other projects keep their name
        if (tab.document.getProjectName() === tab.name) {
          tab.document.setProjectName(newName);
          if (tab.id === this.activeTabId) this.showProjectName(tab);
        }
        tab.name = newName;
        logger.debug('TabManager', 'Tab name changed to:', newName);
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
