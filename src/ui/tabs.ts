import { Graph } from '@maxgraph/core';
import { PropertiesPanel } from './properties';
import { ToolbarController } from './toolbar';
import { StatusBarController } from './statusbar';
import { ClipboardController } from './clipboard';
import { DeleteController } from './delete';
import { UndoRedoController } from './undoredo';
import { PanController } from './pan';
import { GridController } from './grid';
import { SaveLoadController } from './saveload';
import { CanvasProperties } from './canvas-properties';
import { ContextMenuController } from './context-menu';
import { MenuController } from './menu';
import { InteractiveUIController } from './interactive-ui';
import { CacheService, CacheData } from '../services/cache-service';

export interface TabData {
  id: string;
  name: string;
  graph: Graph;
  propertiesPanel: PropertiesPanel;
  toolbarController: ToolbarController;
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
}

export class TabManager {
  private tabs: Map<string, TabData> = new Map();
  private activeTabId: string | null = null;
  private tabBarContainer: HTMLElement;
  private graphContainer: HTMLElement;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private saveLoadControllers: Map<string, SaveLoadController> = new Map();

  constructor(tabBarContainerId: string, graphContainerId: string) {
    this.tabBarContainer = document.getElementById(tabBarContainerId)!;
    this.graphContainer = document.getElementById(graphContainerId)!;
    this.startAutoSave();
  }

  createTab(name: string = 'Untitled'): TabData {
    const tabId = `tab-${Date.now()}`;

    // Create new graph container
    const graphDiv = document.createElement('div');
    graphDiv.id = `graph-${tabId}`;
    graphDiv.style.width = '100%';
    graphDiv.style.height = '100%';
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

    // Initialize UI controllers
    const propertiesPanel = new PropertiesPanel(graph);
    const toolbarController = new ToolbarController(graph);
    const statusBarController = new StatusBarController(graph);
    const clipboardController = new ClipboardController(graph);
    const deleteController = new DeleteController(graph);
    const undoRedoController = new UndoRedoController(graph);
    const panController = new PanController(graph);
    const gridController = new GridController(graph, 10);
    const saveLoadController = new SaveLoadController(graph);
    const canvasProperties = new CanvasProperties(graph);
    const contextMenuController = new ContextMenuController(graph);
    const menuController = new MenuController(graph);
    const interactiveUIController = new InteractiveUIController(graph);

    const tabData: TabData = {
      id: tabId,
      name,
      graph,
      propertiesPanel,
      toolbarController,
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
    };

    this.tabs.set(tabId, tabData);
    this.saveLoadControllers.set(tabId, saveLoadController);

    if (!this.activeTabId) {
      this.activeTabId = tabId;
    }

    this.renderTabBar();
    return tabData;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveToCache();
    }, 5000); // Auto-save every 5 seconds
  }

  private saveToCache(): void {
    if (this.tabs.size === 0 || !this.activeTabId) return;

    const cacheData: CacheData = {
      projectName: this.getProjectName(),
      tabs: Array.from(this.tabs.values()).map((tab) => ({
        id: tab.id,
        name: tab.name,
        graphXml: tab.saveLoadController.serializeToXml(),
      })),
      activeTabId: this.activeTabId,
      timestamp: Date.now(),
    };

    CacheService.save(cacheData);
  }

  restoreFromCache(): void {
    const cacheData = CacheService.load();
    if (!cacheData) return;

    this.restoreProjectName(cacheData.projectName);

    let activeTabId: string | null = null;
    let tabIndex = 0;

    cacheData.tabs.forEach((tabCache) => {
      const tabData = this.createTab(tabCache.name);
      tabData.saveLoadController.load(tabCache.graphXml);

      // Track the first tab as active, or use the index matching the cached active tab
      if (tabIndex === 0 || (cacheData.activeTabId && tabIndex === cacheData.tabs.findIndex(t => t.id === cacheData.activeTabId))) {
        activeTabId = tabData.id;
      }
      tabIndex++;
    });

    // Switch to the appropriate tab (first tab by default)
    if (activeTabId) {
      this.switchTab(activeTabId);
    }

    console.log('[TabManager] Restored from cache');
  }

  clearCache(): void {
    CacheService.clear();
  }

  private getProjectName(): string {
    const titleElement = document.querySelector('.document-title');
    return titleElement?.textContent || 'Untitled Diagram';
  }

  private restoreProjectName(name: string): void {
    const titleElement = document.querySelector('.document-title') as HTMLElement;
    if (titleElement) {
      titleElement.textContent = name;
    }
  }

  switchTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return;

    // Hide previous tab
    if (this.activeTabId) {
      const prevGraphDiv = document.getElementById(`graph-${this.activeTabId}`);
      if (prevGraphDiv) prevGraphDiv.style.display = 'none';
    }

    // Show new tab
    const newGraphDiv = document.getElementById(`graph-${tabId}`);
    if (newGraphDiv) newGraphDiv.style.display = 'block';

    this.activeTabId = tabId;
    this.renderTabBar();
  }

  closeTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return;
    if (this.tabs.size === 1) return; // Keep at least one tab

    const graphDiv = document.getElementById(`graph-${tabId}`);
    if (graphDiv) graphDiv.remove();

    this.tabs.delete(tabId);

    if (this.activeTabId === tabId) {
      const nextTabId = this.tabs.keys().next().value;
      if (nextTabId) {
        this.switchTab(nextTabId);
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
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }

  private renderTabBar(): void {
    this.tabBarContainer.innerHTML = '';

    // Render tabs
    this.tabs.forEach((tab: TabData) => {
      const tabButton = document.createElement('button');
      tabButton.className = 'tab-button';
      if (tab.id === this.activeTabId) {
        tabButton.classList.add('active');
      }

      const tabLabel = document.createElement('span');
      tabLabel.className = 'tab-label';
      tabLabel.textContent = tab.name;

      tabButton.appendChild(tabLabel);

      if (this.tabs.size > 1) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close-btn';
        closeBtn.textContent = '×';

        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeTab(tab.id);
        });

        tabButton.appendChild(closeBtn);
      }

      tabButton.addEventListener('click', () => this.switchTab(tab.id));
      this.tabBarContainer.appendChild(tabButton);
    });

    // Add new tab button
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'tab-new-btn';
    newTabBtn.textContent = '+';

    newTabBtn.addEventListener('click', () => {
      this.createTab();
    });

    this.tabBarContainer.appendChild(newTabBtn);
  }
}
