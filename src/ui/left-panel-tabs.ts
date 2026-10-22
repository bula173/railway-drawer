export type LeftPanelTab = 'shapes' | 'ertms' | 'templates' | 'layers' | 'plantuml' | 'railwayScript';
export type CloseableTab = 'plantuml' | 'ertms';

const CLOSEABLE: readonly CloseableTab[] = ['plantuml', 'ertms'];

function isCloseable(tabId: LeftPanelTab): tabId is CloseableTab {
  return (CLOSEABLE as readonly LeftPanelTab[]).includes(tabId);
}

/**
 * The left panel's tab strip: one row; the tabs that do not fit go into the "»" overflow menu
 * (`.left-panel-tab-more` -> `.left-panel-overflow-menu` with `.left-panel-overflow-item[data-tab]`).
 * The active tab always stays in the row. Each tab is a `.left-panel-tab-btn[data-tab]` wrapper (no
 * button nesting) holding the tab's `button.left-panel-tab-label`; PlantUML and ERTMS also get a sibling
 * `button.tab-close-btn` ("Close <tab> tab", focusable; Delete on the tab closes it too) and in the »
 * menu a `.left-panel-overflow-close[data-tab]` item. Reopened from Extras > PlantUML Editor / View >
 * ERTMS Tab.
 */
export class LeftPanelTabs {
  private container: HTMLElement;
  private tabBar!: HTMLElement;
  private moreButton!: HTMLButtonElement;
  private overflowMenu!: HTMLElement;
  private tabButtons: Map<LeftPanelTab, HTMLElement> = new Map();
  private tabLabels: Map<LeftPanelTab, string> = new Map();
  private tabContents: Map<LeftPanelTab, HTMLElement> = new Map();
  private activeTab: LeftPanelTab = 'shapes';
  private hiddenTabs: Set<CloseableTab> = new Set();
  private overflowTabs: LeftPanelTab[] = [];
  private visibilityListeners: Array<(tabId: CloseableTab, visible: boolean) => void> = [];
  private switchListeners: Array<(tabId: LeftPanelTab) => void> = [];

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;
    this.createTabBar();
  }

  private createTabBar() {
    const tabBar = document.createElement('div');
    tabBar.className = 'left-panel-tabbar';
    this.tabBar = tabBar;

    const shapeTabBtn = this.createTabButton('shapes', 'Shapes');
    const ertmsTabBtn = this.createTabButton('ertms', 'ERTMS');
    ertmsTabBtn.title = 'ERTMS library only (optional: View > ERTMS Tab)';
    const templatesTabBtn = this.createTabButton('templates', 'Templates');
    templatesTabBtn.title = 'ERTMS templates and my templates';
    const layerTabBtn = this.createTabButton('layers', 'Layers');
    const plantumlTabBtn = this.createTabButton('plantuml', 'PlantUML');
    plantumlTabBtn.title = 'PlantUML editor (also Extras > PlantUML Editor)';
    const scriptTabBtn = this.createTabButton('railwayScript', 'Railway Script');
    scriptTabBtn.title = 'Railway Script: describe the layout as YAML/JSON text (also Railway > Railway Script Editor)';

    tabBar.append(shapeTabBtn, ertmsTabBtn, templatesTabBtn, layerTabBtn, plantumlTabBtn, scriptTabBtn);

    // "»": the tabs that do not fit
    this.moreButton = document.createElement('button');
    this.moreButton.type = 'button';
    this.moreButton.className = 'left-panel-tab-more';
    this.moreButton.textContent = '»';
    this.moreButton.setAttribute('aria-label', 'More tabs');
    this.moreButton.title = 'More tabs';
    this.moreButton.setAttribute('aria-haspopup', 'menu');
    this.moreButton.setAttribute('aria-expanded', 'false');
    this.moreButton.hidden = true;
    this.overflowMenu = document.createElement('div');
    this.overflowMenu.className = 'left-panel-overflow-menu';
    this.overflowMenu.setAttribute('role', 'menu');
    this.overflowMenu.setAttribute('aria-label', 'More tabs');
    this.overflowMenu.hidden = true;
    this.moreButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.overflowMenu.hidden) this.openOverflowMenu();
      else this.closeOverflowMenu(false);
    });
    this.moreButton.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.openOverflowMenu();
      }
    });
    this.overflowMenu.addEventListener('keydown', (e) => this.onOverflowKeydown(e));
    document.addEventListener('click', (e) => {
      if (!this.overflowMenu.contains(e.target as Node)) this.closeOverflowMenu(false);
    });
    tabBar.append(this.moreButton);

    this.container.insertBefore(tabBar, this.container.firstChild);
    this.container.append(this.overflowMenu);

    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.layoutTabs()).observe(tabBar);
    this.layoutTabs();
  }

  private createTabButton(tabId: LeftPanelTab, label: string): HTMLElement {
    // Wrapper (layout, active / overflow state, title) with the tab button and, for closeable tabs,
    // a separate close button: a button inside a button is invalid HTML and not keyboard reachable
    const tab = document.createElement('div');
    tab.className = 'left-panel-tab-btn';
    tab.dataset.tab = tabId;
    if (tabId === this.activeTab) {
      tab.classList.add('active');
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'left-panel-tab-label';
    btn.dataset.tab = tabId;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);
    tab.appendChild(btn);
    this.tabLabels.set(tabId, label);

    if (isCloseable(tabId)) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'tab-close-btn';
      closeBtn.textContent = '×';
      closeBtn.title = `Close the ${label} tab`;
      closeBtn.setAttribute('aria-label', `Close ${label} tab`);
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTabFromUi(tabId);
      });
      tab.appendChild(closeBtn);
      btn.setAttribute('aria-keyshortcuts', 'Delete');
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'Delete') return;
        // the tab, not the diagram selection (the global dispatcher must not delete cells)
        e.preventDefault();
        e.stopPropagation();
        this.closeTabFromUi(tabId);
      });
    }

    // a click anywhere on the tab (except its close button) switches to it
    tab.addEventListener('click', () => this.switchTab(tabId));

    this.tabButtons.set(tabId, tab);
    return tab;
  }

  /** Closes a tab from its × / Delete / the » menu and keeps the keyboard focus in the strip. */
  private closeTabFromUi(tabId: CloseableTab): void {
    this.closeTab(tabId);
    this.focusTab(this.activeTab);
  }

  /** Focuses the tab's own button (in the row). */
  focusTab(tabId: LeftPanelTab): void {
    this.tabButtons.get(tabId)?.querySelector<HTMLElement>('.left-panel-tab-label')?.focus();
  }

  /** One row: hides the tabs that do not fit (the active one always stays) behind "»". */
  layoutTabs(): void {
    if (!this.tabBar) return;
    const shown = Array.from(this.tabButtons.entries()).filter(([id]) => !this.hiddenTabs.has(id as CloseableTab));
    for (const [, btn] of shown) btn.classList.remove('rd-tab-overflow');
    this.moreButton.hidden = true;
    const available = this.tabBar.clientWidth;
    const widths = shown.map(([, btn]) => btn.getBoundingClientRect().width);
    const total = widths.reduce((s, w) => s + w, 0);
    this.overflowTabs = [];
    if (available <= 0 || total <= available + 0.5) {
      this.closeOverflowMenu(false);
      return;
    }
    this.moreButton.hidden = false;
    const room = available - this.moreButton.getBoundingClientRect().width;
    const activeIndex = shown.findIndex(([id]) => id === this.activeTab);
    const activeWidth = activeIndex >= 0 ? widths[activeIndex] : 0;
    let used = activeWidth;
    shown.forEach(([id, btn], i) => {
      if (i === activeIndex) return;
      if (used + widths[i] <= room + 0.5) {
        used += widths[i];
      } else {
        btn.classList.add('rd-tab-overflow');
        this.overflowTabs.push(id);
      }
    });
    if (!this.overflowMenu.hidden) this.renderOverflowMenu();
  }

  private renderOverflowMenu(): void {
    this.overflowMenu.replaceChildren(
      ...this.overflowTabs.flatMap((id) => {
        const label = this.tabLabels.get(id) ?? id;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'left-panel-overflow-item';
        item.dataset.tab = id;
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;
        item.textContent = label;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeOverflowMenu(false);
          this.switchTab(id);
          this.focusTab(id);
        });
        if (!isCloseable(id)) return [item];
        // closeable tabs: a "Close <tab>" item right after it (Delete on the tab item does the same)
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'left-panel-overflow-close';
        close.dataset.tab = id;
        close.setAttribute('role', 'menuitem');
        close.tabIndex = -1;
        close.textContent = `Close ${label}`;
        close.setAttribute('aria-label', `Close ${label} tab`);
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeOverflowMenu(false);
          this.closeTab(id);
          if (this.moreButton.hidden) this.focusTab(this.activeTab);
          else this.moreButton.focus();
        });
        return [item, close];
      })
    );
  }

  private openOverflowMenu(): void {
    this.renderOverflowMenu();
    const bar = this.container.getBoundingClientRect();
    const more = this.moreButton.getBoundingClientRect();
    this.overflowMenu.style.top = `${Math.round(more.bottom - bar.top)}px`;
    this.overflowMenu.hidden = false;
    this.moreButton.setAttribute('aria-expanded', 'true');
    this.overflowMenu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }

  private closeOverflowMenu(focusButton: boolean): void {
    if (this.overflowMenu.hidden) return;
    this.overflowMenu.hidden = true;
    this.moreButton.setAttribute('aria-expanded', 'false');
    if (focusButton) this.moreButton.focus();
  }

  private onOverflowKeydown(e: KeyboardEvent): void {
    const items = Array.from(this.overflowMenu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focus = (to: number): void => {
      e.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (e.key === 'ArrowDown') focus(i + 1);
    else if (e.key === 'ArrowUp') focus(i - 1);
    else if (e.key === 'Home') focus(0);
    else if (e.key === 'End') focus(items.length - 1);
    else if (e.key === 'Delete') {
      const id = (document.activeElement as HTMLElement | null)?.dataset.tab as LeftPanelTab | undefined;
      if (id && isCloseable(id)) {
        e.preventDefault();
        e.stopPropagation();
        this.closeOverflowMenu(false);
        this.closeTab(id);
        if (this.moreButton.hidden) this.focusTab(this.activeTab);
        else this.moreButton.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closeOverflowMenu(true);
    } else if (e.key === 'Tab') this.closeOverflowMenu(false);
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
      currentContent.classList.remove('visible');
    }

    const currentBtn = this.tabButtons.get(this.activeTab);
    if (currentBtn) {
      currentBtn.classList.remove('active');
    }

    // Show new tab
    const newContent = this.tabContents.get(tabId);
    if (newContent) {
      newContent.style.display = 'block';
      newContent.classList.add('visible');
    }

    const newBtn = this.tabButtons.get(tabId);
    if (newBtn) {
      newBtn.classList.add('active');
    }

    this.activeTab = tabId;
    this.layoutTabs();
    this.switchListeners.forEach((listener) => listener(tabId));
  }

  /** Called after the active tab changed (e.g. to create a panel's content on first show). */
  onTabSwitch(listener: (tabId: LeftPanelTab) => void): void {
    this.switchListeners.push(listener);
  }

  getActiveTab(): LeftPanelTab {
    return this.activeTab;
  }

  /**
   * Close (hide) a tab
   */
  closeTab(tabId: CloseableTab): void {
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
    this.layoutTabs();
    this.visibilityListeners.forEach((listener) => listener(tabId, false));
  }

  /**
   * Show (reopen) a hidden tab
   */
  showTab(tabId: CloseableTab): void {
    this.hiddenTabs.delete(tabId);

    const btn = this.tabButtons.get(tabId);
    if (btn) {
      btn.style.display = '';
    }

    const content = this.tabContents.get(tabId);
    if (content) {
      content.style.display = 'block';
      content.classList.add('visible');
    }

    // Switch to the newly shown tab
    this.switchTab(tabId);
    this.layoutTabs();
    this.visibilityListeners.forEach((listener) => listener(tabId, true));
  }

  /**
   * Called when a closeable tab is shown or closed (e.g. to persist an optional tab)
   */
  onTabVisibilityChange(listener: (tabId: CloseableTab, visible: boolean) => void): void {
    this.visibilityListeners.push(listener);
  }

  /**
   * Check if a tab is hidden
   */
  isTabHidden(tabId: CloseableTab): boolean {
    return this.hiddenTabs.has(tabId);
  }
}
