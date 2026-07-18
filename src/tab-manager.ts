/**
 * Tab Manager
 * Manage multiple diagram tabs
 */

export interface Tab {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  data?: any; // Diagram data for persistence
}

export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private listeners: Array<(tabs: Tab[]) => void> = [];
  private tabCounter = 0;

  constructor(private graph: any) {
    // Create default tab
    this.createTab('Diagram 1');
  }

  /**
   * Create a new tab
   */
  createTab(name?: string): Tab {
    this.tabCounter++;
    const id = `tab-${Date.now()}-${this.tabCounter}`;
    const tabName = name || `Diagram ${this.tabs.size + 1}`;

    const tab: Tab = {
      id,
      name: tabName,
      active: this.tabs.size === 0,
      createdAt: new Date(),
      data: null,
    };

    this.tabs.set(id, tab);

    if (this.tabs.size === 1) {
      this.activeTabId = id;
    }

    this.notifyListeners();
    return tab;
  }

  /**
   * Get active tab
   */
  getActiveTab(): Tab | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  /**
   * Switch to a specific tab
   */
  switchToTab(tabId: string): Tab | null {
    if (!this.tabs.has(tabId)) return null;

    // Save current diagram data before switching
    const currentTab = this.getActiveTab();
    if (currentTab) {
      currentTab.data = this.captureDiagramData();
    }

    // Deactivate all tabs
    this.tabs.forEach((tab) => (tab.active = false));

    // Activate new tab
    const newTab = this.tabs.get(tabId);
    if (newTab) {
      newTab.active = true;
      this.activeTabId = tabId;
      this.notifyListeners();
      return newTab;
    }

    return null;
  }

  /**
   * Close a tab
   */
  closeTab(tabId: string): boolean {
    if (!this.tabs.has(tabId)) return false;
    if (this.tabs.size === 1) return false; // Don't close the last tab

    this.tabs.delete(tabId);

    // If closed tab was active, switch to first available tab
    if (this.activeTabId === tabId) {
      const firstTab = Array.from(this.tabs.values())[0];
      if (firstTab) {
        this.switchToTab(firstTab.id);
      }
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Rename a tab
   */
  renameTab(tabId: string, newName: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.name = newName.trim() || tab.name;
    this.notifyListeners();
    return true;
  }

  /**
   * Get all tabs
   */
  getAllTabs(): Tab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Clear all tabs and create a new one
   */
  clearAllTabs(createDefault: boolean = true): void {
    this.tabs.clear();
    this.activeTabId = null;
    this.tabCounter = 0;

    if (createDefault) {
      this.createTab('Diagram 1');
    }

    this.notifyListeners();
  }

  /**
   * Capture current diagram data
   */
  private captureDiagramData(): any {
    const parent = this.graph.getDefaultParent();
    const cells = parent?.children || [];

    return {
      cells: cells.map((cell: any) => ({
        id: cell.id,
        value: cell.value,
        x: cell.geometry?.x,
        y: cell.geometry?.y,
        width: cell.geometry?.width,
        height: cell.geometry?.height,
        style: cell.style,
        isVertex: cell.isVertex?.(),
        isEdge: cell.isEdge?.(),
      })),
      timestamp: Date.now(),
    };
  }

  /**
   * Restore diagram from tab data
   */
  restoreDiagramData(data: any): void {
    if (!data || !data.cells) return;

    // Clear current diagram
    this.graph.removeCells(this.graph.getDefaultParent().children || []);

    // Recreate cells
    const cellMap = new Map<string, any>();

    // First pass: create vertices
    data.cells.forEach((cellData: any) => {
      if (cellData.isVertex) {
        const cell = this.graph.insertVertex({
          value: cellData.value || '',
          position: [cellData.x, cellData.y],
          size: [cellData.width, cellData.height],
          style: cellData.style || { shape: 'rectangle' },
        });
        cellMap.set(cellData.id, cell);
      }
    });

    // Second pass: create edges
    data.cells.forEach((cellData: any) => {
      if (cellData.isEdge) {
        const sourceCell = Array.from(cellMap.values()).find(
          (c: any) => c.id === cellData.id?.split('-')[0],
        );
        const targetCell = Array.from(cellMap.values()).find(
          (c: any) => c.id === cellData.id?.split('-')[1],
        );

        if (sourceCell && targetCell) {
          this.graph.insertEdge({
            source: sourceCell,
            target: targetCell,
            value: cellData.value || '',
            style: cellData.style || {},
          });
        }
      }
    });
  }

  /**
   * Export tabs to JSON for persistence
   */
  exportTabs(): string {
    const tabsData = this.getAllTabs().map((tab) => ({
      id: tab.id,
      name: tab.name,
      data: tab.data,
      active: tab.active,
    }));

    return JSON.stringify(tabsData, null, 2);
  }

  /**
   * Import tabs from JSON
   */
  importTabs(jsonData: string): boolean {
    try {
      const tabsData = JSON.parse(jsonData);

      this.clearAllTabs(false);

      if (Array.isArray(tabsData)) {
        tabsData.forEach((tabData: any) => {
          const tab = this.createTab(tabData.name);
          tab.data = tabData.data;

          if (tabData.active && !this.activeTabId) {
            this.switchToTab(tab.id);
          }
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to import tabs:', err);
      return false;
    }
  }

  /**
   * Add listener for tab changes
   */
  addListener(callback: (tabs: Tab[]) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (tabs: Tab[]) => void): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const tabs = this.getAllTabs();
    this.listeners.forEach((listener) => listener(tabs));
  }

  /**
   * Get tab count
   */
  getTabCount(): number {
    return this.tabs.size;
  }

  /**
   * Check if can close tab
   */
  canCloseTab(tabId: string): boolean {
    return this.tabs.size > 1 && this.tabs.has(tabId);
  }
}
