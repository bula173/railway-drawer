/**
 * Regressions in TabManager's per-tab lifecycle:
 * - a cached tab whose XML fails to load must not have that XML overwritten by autosave
 * - a failed autosave leaves the old entry marked as out of date and shows the error
 * - shared toolbar buttons (Undo/Redo) act on the active tab only, and not after a tab closed
 * - per-tab subscriptions (clipboard) and editors (label textarea) go with the tab
 * - tab rename by double-click works, also when the double-click starts on an inactive tab
 */
import { isAutosaveKey, storedAutosave, storedAutosaveText } from './autosave-store';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import { CacheService } from '../../services/cache-service';
import { ClipboardService } from '../../services/clipboard-service';
import { globalNotificationManager } from '../../ui/notification';
import { globalSaveStatusIndicator } from '../../ui/save-status';
import { loadAppDom, clearAppDom } from './app-dom';
import { installShellForTest } from './shell-harness';

describe('TabManager tab lifecycle', () => {
  let tabManager: TabManager | null = null;
  let uninstallShell: (() => void) | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
    loadAppDom();
    localStorage.clear();
    // toolbar buttons and keys run the commands on the active tab (main-editor.ts wiring)
    uninstallShell = installShellForTest(() => tabManager?.getActiveTab() ?? null);
  });

  afterEach(() => {
    uninstallShell?.();
    uninstallShell = null;
    tabManager?.destroy();
    tabManager = null;
    localStorage.clear();
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const autosave = (tm: TabManager) => (tm as unknown as { saveToCache(): void }).saveToCache();
  const storedTabs = () => storedAutosave()!.data.tabs as Array<{ name: string; graphXml: string }>;

  it('the session views listen to the shown tab only; closing it hands them to the next one', () => {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const first = tabManager.createTab('One');
    const second = tabManager.createTab('Two');
    const listeners = (graph: typeof first.graph): number =>
      (graph.getSelectionModel() as unknown as { eventListeners: unknown[] }).eventListeners.length;
    const firstShown = listeners(first.graph);
    const secondHidden = listeners(second.graph);
    tabManager.switchTab(second.id);
    // Properties, status bar, connector and property fields moved to the shown tab
    expect(listeners(second.graph)).toBeGreaterThanOrEqual(secondHidden + 4);
    expect(listeners(first.graph)).toBeLessThanOrEqual(firstShown - 4);
    tabManager.closeTab(second.id);
    expect(listeners(first.graph)).toBe(firstShown);
  });

  it('keeps the cached XML of a tab that failed to restore and tells the user', () => {
    const warning = vi.spyOn(globalNotificationManager, 'warning');
    const brokenXml = '<mxGraphModel><root><mxCell id="0"/><broken';
    CacheService.save({
      projectName: 'P',
      tabs: [{ id: 'a', name: 'Broken', graphXml: brokenXml }],
      activeTabId: 'a',
      timestamp: Date.now(),
    });

    tabManager = new TabManager('tabs-container', 'graph-container');
    expect(tabManager.restoreFromCache()).toBe(true);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('could not be restored'));

    autosave(tabManager);
    expect(storedTabs()[0].graphXml).toBe(brokenXml);

    // Once the user works in the tab, it is an ordinary tab again
    const tab = tabManager.getActiveTab()!;
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'New', 0, 0, 40, 40);
    autosave(tabManager);
    expect(storedTabs()[0].graphXml).toContain('New');
  });

  it('marks the stored session as out of date when autosave hits the storage quota', () => {
    const setError = vi.spyOn(globalSaveStatusIndicator, 'setError');
    tabManager = new TabManager('tabs-container', 'graph-container');
    const tab = tabManager.createTab('One');
    autosave(tabManager);
    const before = storedAutosaveText();
    expect(CacheService.getStaleSince()).toBeNull();

    const nativeSetItem = Storage.prototype.setItem;
    const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (isAutosaveKey(key)) throw new DOMException('full', 'QuotaExceededError');
      nativeSetItem.call(this, key, value);
    });
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'Lost', 0, 0, 40, 40);
    autosave(tabManager);
    autosave(tabManager);

    expect(storedAutosaveText()).toBe(before);
    expect(CacheService.getStaleSince()).not.toBeNull();
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError.mock.calls[0][0]).toMatch(/storage is full/i);

    quota.mockRestore();
    autosave(tabManager);
    expect(CacheService.getStaleSince()).toBeNull();
    expect(storedTabs()[0].graphXml).toContain('Lost');
  });

  it('Undo/Redo buttons act on the active tab only, and never for a closed tab', () => {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const first = tabManager.createTab('First');
    const second = tabManager.createTab('Second');
    const undoFirst = vi.spyOn(first.graphCommandService, 'undo');
    const undoSecond = vi.spyOn(second.graphCommandService, 'undo');
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    // Empty histories disable the button; enable it so the click is delivered
    const press = () => {
      undoBtn.disabled = false;
      undoBtn.click();
    };

    press();
    expect(undoFirst).toHaveBeenCalledTimes(1);
    expect(undoSecond).not.toHaveBeenCalled();

    tabManager.switchTab(second.id);
    press();
    expect(undoFirst).toHaveBeenCalledTimes(1);
    expect(undoSecond).toHaveBeenCalledTimes(1);

    tabManager.closeTab(second.id);
    press();
    expect(undoSecond).toHaveBeenCalledTimes(1);
    expect(undoFirst).toHaveBeenCalledTimes(2);
  });

  it('closing a tab releases its clipboard subscription and open label editor', () => {
    const clipboard = ClipboardService.getInstance() as unknown as { listeners: unknown[] };
    const baseline = clipboard.listeners.length;
    tabManager = new TabManager('tabs-container', 'graph-container');
    tabManager.createTab('First');
    const second = tabManager.createTab('Second');
    expect(clipboard.listeners.length).toBe(baseline + 2);

    tabManager.switchTab(second.id);
    const cell = second.graph.insertVertex(second.graph.getDefaultParent(), null, 'A', 0, 0, 40, 40);
    second.graph.setSelectionCell(cell);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('body > textarea')).not.toBeNull();

    tabManager.closeTab(second.id);
    expect(clipboard.listeners.length).toBe(baseline + 1);
    expect(document.querySelector('body > textarea')).toBeNull();
  });

  it.each(['Enter', ' '])(
    'activating a tab with %j switches tab without opening the label editor of the selected shape',
    (key) => {
      tabManager = new TabManager('tabs-container', 'graph-container');
      const first = tabManager.createTab('First');
      const second = tabManager.createTab('Second');
      tabManager.switchTab(first.id);
      const cell = second.graph.insertVertex(second.graph.getDefaultParent(), null, 'A', 0, 0, 40, 40);
      second.graph.setSelectionCell(cell);
      const tabFor = (name: string) =>
        Array.from(document.querySelectorAll<HTMLElement>('#tabs-container .tab-button')).find(
          (el) => el.querySelector('.tab-label')?.textContent === name
        )!;

      // Inactive tab: switches, and the new tab's graph shortcuts must not see this keypress
      tabFor('Second').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(tabManager.getActiveTab()?.id).toBe(second.id);
      expect(document.querySelector('body > textarea')).toBeNull();

      // Already active tab: nothing to switch, still no label editor
      tabFor('Second').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(document.querySelector('body > textarea')).toBeNull();
    }
  );

  describe('tab rename', () => {
    const tabElement = (name: string) =>
      Array.from(document.querySelectorAll<HTMLElement>('#tabs-container .tab-button')).find(
        (el) => el.querySelector('.tab-label')?.textContent === name || el.querySelector('input')?.value === name
      )!;

    /** A real double-click: two clicks on the element under the pointer, then dblclick */
    const doubleClick = (target: HTMLElement) => {
      for (let i = 0; i < 2; i++) {
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    };

    it('renames an inactive tab by double-clicking its label', () => {
      tabManager = new TabManager('tabs-container', 'graph-container');
      tabManager.createTab('First');
      const second = tabManager.createTab('Second');

      const label = tabElement('Second').querySelector<HTMLElement>('.tab-label')!;
      doubleClick(label);

      expect(tabManager.getActiveTab()?.id).toBe(second.id);
      const input = tabElement('Second').querySelector('input')!;
      expect(input).not.toBeNull();
      expect(input.isConnected).toBe(true);

      // Typing (including Space) and clicking in the field stay in the field
      const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      input.dispatchEvent(space);
      expect(space.defaultPrevented).toBe(false);
      input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(input.isConnected).toBe(true);

      input.value = 'Renamed';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      expect(second.name).toBe('Renamed');
      expect(tabElement('Renamed').querySelector('.tab-label')?.textContent).toBe('Renamed');
      expect(document.querySelector('#tabs-container input')).toBeNull();
    });

    it('a label equal to the project name renames the project too; another label leaves it', () => {
      tabManager = new TabManager('tabs-container', 'graph-container');
      const tab = tabManager.createTab('Station A');
      tabManager.switchTab(tab.id);
      // tabs opened from a file / link / File > New are named after their project
      tab.document.setProjectName('Station A');
      const rename = (from: string, to: string): void => {
        doubleClick(tabElement(from).querySelector<HTMLElement>('.tab-label')!);
        const input = tabElement(from).querySelector('input')!;
        input.value = to;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      };
      rename('Station A', 'Station B');
      expect(tab.name).toBe('Station B');
      expect(tab.document.getProjectName()).toBe('Station B');
      tab.document.setProjectName('Project X');
      rename('Station B', 'My label');
      expect(tab.name).toBe('My label');
      expect(tab.document.getProjectName()).toBe('Project X');
    });

    it('Escape cancels the rename even though removing the field blurs it', () => {
      tabManager = new TabManager('tabs-container', 'graph-container');
      const tab = tabManager.createTab('Keep');

      doubleClick(tabElement('Keep').querySelector<HTMLElement>('.tab-label')!);
      const input = tabElement('Keep').querySelector('input')!;
      input.value = 'Discarded';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      input.dispatchEvent(new FocusEvent('blur'));

      expect(tab.name).toBe('Keep');
      expect(tabElement('Keep').querySelector('.tab-label')?.textContent).toBe('Keep');
    });

    it('a blur caused by pressing another tab saves the name and still switches to that tab', () => {
      tabManager = new TabManager('tabs-container', 'graph-container');
      const first = tabManager.createTab('First');
      const second = tabManager.createTab('Second');

      doubleClick(tabElement('First').querySelector<HTMLElement>('.tab-label')!);
      const input = tabElement('First').querySelector('input')!;
      input.value = 'Edited';
      const secondElement = tabElement('Second');
      input.dispatchEvent(new FocusEvent('blur'));
      secondElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(first.name).toBe('Edited');
      expect(secondElement.isConnected).toBe(true);
      expect(tabManager.getActiveTab()?.id).toBe(second.id);
      expect(secondElement.classList.contains('active')).toBe(true);
    });
  });
});
