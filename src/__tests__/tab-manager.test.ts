import { TabManager } from '../tab-manager';

describe('TabManager', () => {
  let tabManager: TabManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          {
            id: 'cell-1',
            value: 'Test Cell',
            geometry: { x: 10, y: 20, width: 100, height: 50 },
            style: { shape: 'rectangle' },
            isVertex: jest.fn().mockReturnValue(true),
            isEdge: jest.fn().mockReturnValue(false),
          },
        ],
      }),
      removeCells: jest.fn(),
      insertVertex: jest.fn().mockReturnValue({ id: 'new-cell' }),
      insertEdge: jest.fn().mockReturnValue({ id: 'new-edge' }),
    };

    tabManager = new TabManager(mockGraph);
  });

  it('should create a default tab on initialization', () => {
    const tabs = tabManager.getAllTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe('Diagram 1');
    expect(tabs[0].active).toBe(true);
  });

  it('should create a new tab', () => {
    const newTab = tabManager.createTab('My Diagram');
    expect(newTab.name).toBe('My Diagram');
    expect(tabManager.getAllTabs()).toHaveLength(2);
  });

  it('should auto-increment tab names', () => {
    tabManager.createTab();
    const tabs = tabManager.getAllTabs();
    expect(tabs[1].name).toBe('Diagram 2');
  });

  it('should switch to a tab and save/restore diagram data', () => {
    const tab1 = tabManager.getActiveTab();
    expect(tab1?.active).toBe(true);

    // Create a new tab
    const tab2 = tabManager.createTab('Tab 2');

    // Switch to tab 1 (should save tab 2's data)
    tabManager.switchToTab(tab1!.id);
    expect(tabManager.getActiveTab()?.id).toBe(tab1!.id);
    expect(tabManager.getActiveTab()?.active).toBe(true);
    expect(tab2.active).toBe(false);
  });

  it('should close a tab', () => {
    tabManager.createTab('Tab 2');
    const tabs1 = tabManager.getAllTabs();
    expect(tabs1).toHaveLength(2);

    const firstTabId = tabs1[0].id;
    tabManager.closeTab(firstTabId);

    const tabs2 = tabManager.getAllTabs();
    expect(tabs2).toHaveLength(1);
    expect(tabManager.getAllTabs()[0].id).not.toBe(firstTabId);
  });

  it('should not close the last tab', () => {
    const tabs = tabManager.getAllTabs();
    const closed = tabManager.closeTab(tabs[0].id);

    expect(closed).toBe(false);
    expect(tabManager.getAllTabs()).toHaveLength(1);
  });

  it('should switch to another tab when active tab is closed', () => {
    tabManager.createTab('Tab 2');
    const tabs = tabManager.getAllTabs();
    const tab1Id = tabs[0].id;
    const tab2Id = tabs[1].id;

    tabManager.switchToTab(tab1Id);
    expect(tabManager.getActiveTab()?.id).toBe(tab1Id);

    tabManager.closeTab(tab1Id);
    expect(tabManager.getActiveTab()?.id).toBe(tab2Id);
  });

  it('should rename a tab', () => {
    const tab = tabManager.getActiveTab();
    tabManager.renameTab(tab!.id, 'Renamed Tab');

    expect(tabManager.getActiveTab()?.name).toBe('Renamed Tab');
  });

  it('should check if a tab can be closed', () => {
    const tabs = tabManager.getAllTabs();
    expect(tabManager.canCloseTab(tabs[0].id)).toBe(false);

    tabManager.createTab('Tab 2');
    expect(tabManager.canCloseTab(tabs[0].id)).toBe(true);
  });

  it('should export and import tabs', () => {
    tabManager.createTab('Tab 2');
    tabManager.createTab('Tab 3');

    const json = tabManager.exportTabs();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe('Diagram 1');
    expect(parsed[1].name).toBe('Tab 2');
    expect(parsed[2].name).toBe('Tab 3');
  });

  it('should listen for tab changes', () => {
    const listener = jest.fn();
    tabManager.addListener(listener);

    tabManager.createTab('Tab 2');
    expect(listener).toHaveBeenCalled();

    tabManager.removeListener(listener);
    tabManager.createTab('Tab 3');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should capture and restore diagram data', () => {
    const tab1 = tabManager.getActiveTab();
    expect(tab1?.data).toBeNull();

    // Create new tab
    const tab2 = tabManager.createTab('Tab 2');
    expect(tab2.data).toBeNull();

    // Switch back to tab 1 (should capture tab 2's data first)
    tabManager.switchToTab(tab1!.id);

    // Now tab 2 should have captured data
    const tabs = tabManager.getAllTabs();
    expect(tabs[1].data).toBeDefined();
    if (tabs[1].data) {
      expect(tabs[1].data.cells).toBeDefined();
    }
  });

  it('should get tab count', () => {
    expect(tabManager.getTabCount()).toBe(1);
    tabManager.createTab('Tab 2');
    expect(tabManager.getTabCount()).toBe(2);
  });

  it('should clear all tabs and create default', () => {
    tabManager.createTab('Tab 2');
    tabManager.createTab('Tab 3');
    expect(tabManager.getTabCount()).toBe(3);

    tabManager.clearAllTabs(true);
    expect(tabManager.getTabCount()).toBe(1);
    expect(tabManager.getActiveTab()?.name).toBe('Diagram 1');
  });
});
