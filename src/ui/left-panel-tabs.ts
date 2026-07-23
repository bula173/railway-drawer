export type LeftPanelTab = 'stencils' | 'shapes' | 'layers' | 'plantuml';
export type CloseableTab = 'plantuml';

export class LeftPanelTabs {
  private container: HTMLElement;
  private tabButtons: Map<LeftPanelTab, HTMLElement> = new Map();
  private tabContents: Map<LeftPanelTab, HTMLElement> = new Map();
  private activeTab: LeftPanelTab = 'shapes';
  private hiddenTabs: Set<CloseableTab> = new Set();

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;
    this.createTabBar();
  }

  private createTabBar() {
    const tabBar = document.createElement('div');
    tabBar.className = 'left-panel-tabbar';

    const shapeTabBtn = this.createTabButton('shapes', 'Shapes');
    const stencilTabBtn = this.createTabButton('stencils', 'Stencils');
    const layerTabBtn = this.createTabButton('layers', 'Layers');
    const plantumlTabBtn = this.createTabButton('plantuml', '🌿 PlantUML');

    tabBar.appendChild(shapeTabBtn);
    tabBar.appendChild(stencilTabBtn);
    tabBar.appendChild(layerTabBtn);
    tabBar.appendChild(plantumlTabBtn);

    this.container.insertBefore(tabBar, this.container.firstChild);
  }

  private createTabButton(tabId: LeftPanelTab, label: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'left-panel-tab-btn';
    if (tabId === this.activeTab) {
      btn.classList.add('active');
    }

    // Create tab label container
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);

    // Add close button for closeable tabs
    const closeableTabs: CloseableTab[] = ['plantuml'];
    if (closeableTabs.includes(tabId as CloseableTab)) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close-btn';
      closeBtn.textContent = '×';
      closeBtn.style.marginLeft = '4px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontSize = '16px';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tabId as CloseableTab);
      });
      btn.appendChild(closeBtn);
    }

    btn.addEventListener('click', () => this.switchTab(tabId));

    this.tabButtons.set(tabId, btn);
    return btn;
  }

  registerTabContent(tabId: LeftPanelTab, contentId: string) {
    const el = document.getElementById(contentId);
    if (!el) throw new Error(`Tab content ${contentId} not found`);

    this.tabContents.set(tabId, el);

    if (tabId !== this.activeTab) {
      el.style.display = 'none';
    }
  }

  switchTab(tabId: LeftPanelTab) {
    if (tabId === this.activeTab) return;

    // Hide current tab
    const currentContent = this.tabContents.get(this.activeTab);
    if (currentContent) {
      currentContent.style.display = 'none';
    }

    const currentBtn = this.tabButtons.get(this.activeTab);
    if (currentBtn) {
      currentBtn.classList.remove('active');
    }

    // Show new tab
    const newContent = this.tabContents.get(tabId);
    if (newContent) {
      newContent.style.display = 'block';
    }

    const newBtn = this.tabButtons.get(tabId);
    if (newBtn) {
      newBtn.classList.add('active');
    }

    this.activeTab = tabId;
  }

  getActiveTab(): LeftPanelTab {
    return this.activeTab;
  }

  /**
   * Close (hide) a tab
   */
  closeTab(tabId: CloseableTab): void {
    console.log('[LeftPanelTabs] Closing tab:', tabId);
    this.hiddenTabs.add(tabId);

    const btn = this.tabButtons.get(tabId);
    if (btn) {
      btn.style.display = 'none';
    }

    // If this was the active tab, switch to another one
    if (this.activeTab === tabId) {
      const defaultTab: LeftPanelTab = 'shapes';
      this.switchTab(defaultTab);
    }
  }

  /**
   * Show (reopen) a hidden tab
   */
  showTab(tabId: CloseableTab): void {
    console.log('[LeftPanelTabs] Showing tab:', tabId);
    this.hiddenTabs.delete(tabId);

    const btn = this.tabButtons.get(tabId);
    if (btn) {
      btn.style.display = 'block';
    }

    // Switch to the newly shown tab
    this.switchTab(tabId);
  }

  /**
   * Check if a tab is hidden
   */
  isTabHidden(tabId: CloseableTab): boolean {
    return this.hiddenTabs.has(tabId);
  }
}
