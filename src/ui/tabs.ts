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
}

export class TabManager {
  private tabs: Map<string, TabData> = new Map();
  private activeTabId: string | null = null;
  private tabBarContainer: HTMLElement;
  private graphContainer: HTMLElement;

  constructor(tabBarContainerId: string, graphContainerId: string) {
    this.tabBarContainer = document.getElementById(tabBarContainerId)!;
    this.graphContainer = document.getElementById(graphContainerId)!;
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
    const canvasProperties = new CanvasProperties(graph, 'property-content');

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
    };

    this.tabs.set(tabId, tabData);

    if (!this.activeTabId) {
      this.activeTabId = tabId;
    }

    this.renderTabBar();
    return tabData;
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
      this.renderTabBar();
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
