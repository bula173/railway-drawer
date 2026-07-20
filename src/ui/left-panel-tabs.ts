export type LeftPanelTab = 'stencils' | 'shapes';

export class LeftPanelTabs {
  private container: HTMLElement;
  private tabButtons: Map<LeftPanelTab, HTMLElement> = new Map();
  private tabContents: Map<LeftPanelTab, HTMLElement> = new Map();
  private activeTab: LeftPanelTab = 'shapes';

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

    tabBar.appendChild(shapeTabBtn);
    tabBar.appendChild(stencilTabBtn);

    this.container.insertBefore(tabBar, this.container.firstChild);
  }

  private createTabButton(tabId: LeftPanelTab, label: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'left-panel-tab-btn';
    if (tabId === this.activeTab) {
      btn.classList.add('active');
    }
    btn.textContent = label;

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
}
