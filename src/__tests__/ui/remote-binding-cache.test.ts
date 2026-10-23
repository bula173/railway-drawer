/**
 * Remote-file bindings in the tab cache with the real TabManager + installSharing (startup order of
 * main-editor.ts: restoreFromCache, then installSharing), using the dev-only test provider
 * (src/debug/fake-remote-provider.ts; vitest runs with import.meta.env.DEV = true).
 */
import { storedAutosave } from './autosave-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import { CacheService } from '../../services/cache-service';
import { installSharing } from '../../share/install-sharing';
import type { SharingHandle } from '../../share/install-sharing';
import { FAKE_REMOTE_ID } from '../../debug/fake-remote-provider';
import type { RemoteFileInfo } from '../../share/providers/types';
import { loadAppDom, clearAppDom } from './app-dom';
const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

function startApp(): { tabManager: TabManager; sharing: SharingHandle } {
  const tabManager = new TabManager('tabs-container', 'graph-container');
  if (CacheService.exists()) tabManager.restoreFromCache();
  if (tabManager.getAllTabs().length === 0) tabManager.createTab('Diagram 1');
  const sharing = installSharing(tabManager, notify);
  return { tabManager, sharing };
}

function remoteFile(version: string): RemoteFileInfo {
  return {
    providerId: FAKE_REMOTE_ID,
    ref: { path: 'Station.drawio' },
    version,
    name: 'Station.drawio',
    location: 'Test repo › Station.drawio',
    parentPath: [{ kind: 'container', id: 'repo', name: 'Test repo', data: { t: 'repo' } }],
  };
}

function cachedTabs(): Array<Record<string, unknown>> {
  return storedAutosave()!.data.tabs;
}

describe('remote bindings in the tab cache', () => {
  let apps: TabManager[] = [];

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
    sessionStorage.clear();
    localStorage.setItem('rd.fakeRemote', '1');
    sessionStorage.setItem('rd.fakeRemote.account', '1');
  });

  afterEach(() => {
    apps.forEach((app) => app.destroy());
    apps = [];
    localStorage.clear();
    sessionStorage.clear();
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Simulates a page reload: the old app goes, the DOM is rebuilt, the same storage stays. */
  function reload(old: TabManager): { tabManager: TabManager; sharing: SharingHandle } {
    old.flushCache();
    old.destroy();
    apps = apps.filter((a) => a !== old);
    clearAppDom();
    loadAppDom();
    const app = startApp();
    apps.push(app.tabManager);
    return app;
  }

  it('an old cache without bindings restores unbound and stays without `remote`', () => {
    const first = new TabManager('tabs-container', 'graph-container');
    const tab = first.createTab('Old');
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'A', 0, 0, 40, 40);
    CacheService.save({
      projectName: 'P',
      tabs: [{ id: tab.id, name: tab.name, graphXml: tab.saveLoadController.serializeToXml() }],
      activeTabId: tab.id,
      timestamp: Date.now(),
    });
    first.destroy();
    clearAppDom();
    loadAppDom();

    const { tabManager, sharing } = startApp();
    apps.push(tabManager);
    const restored = tabManager.getActiveTab()!;
    expect(restored.name).toBe('Old');
    expect(sharing.remoteSession.getBinding(restored.id)).toBeNull();
    expect(document.getElementById('status-remote-item')!.hidden).toBe(true);
    tabManager.flushCache();
    expect(cachedTabs()[0]).not.toHaveProperty('remote');
  });

  it('round trip: binding cached (no tokens), restored after a reload, Ctrl+S saves back with the stored version', async () => {
    const first = startApp();
    apps.push(first.tabManager);
    const tab = first.tabManager.getActiveTab()!;
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'Signal', 10, 10, 40, 40);
    // the "remote" file, as if opened from Test storage at version v3
    localStorage.setItem('rd.fakeRemote.files', JSON.stringify({ 'Station.drawio': { xml: tab.saveLoadController.getProjectXml(), version: 'v3' } }));
    first.sharing.remoteSession.bind(tab, remoteFile('v3'));
    // bindings are written at once
    const stored = cachedTabs()[0].remote as Record<string, unknown>;
    expect(stored).toMatchObject({ v: 1, providerId: FAKE_REMOTE_ID, version: 'v3', name: 'Station.drawio', dirty: false });
    expect(JSON.stringify(stored)).not.toMatch(/token/i);

    const { tabManager, sharing } = reload(first.tabManager);
    const restored = tabManager.getActiveTab()!;
    expect(sharing.remoteSession.getBinding(restored.id)).toMatchObject({ version: 'v3', location: 'Test repo › Station.drawio' });
    expect(sharing.remoteSession.isVerified(restored.id)).toBe(false);
    expect(sharing.remoteSession.isDirty(restored.id)).toBe(false);
    const statusItem = document.getElementById('status-remote-item')!;
    expect(statusItem.hidden).toBe(false);
    expect(document.getElementById('status-remote')!.textContent).toBe('Test storage: Test repo › Station.drawio');
    // File menu offers Reload / Unlink for the restored file
    const items = Array.from(document.querySelectorAll<HTMLElement>('#file-menu-remote-items [data-remote-action]')).map((n) => n.textContent);
    expect(items).toEqual(expect.arrayContaining(['Reload from Test storage…', 'Unlink from Test storage']));

    // edit -> dirty (persisted), then Ctrl+S
    restored.graph.insertVertex(restored.graph.getDefaultParent(), null, 'Balise', 80, 10, 40, 40);
    expect(sharing.remoteSession.checkDirty(restored.id)).toBe(true);
    expect(document.querySelector(`.tab-button[data-tab-id="${restored.id}"] .rd-remote-dirty-dot`)).not.toBeNull();
    tabManager.flushCache();
    expect(cachedTabs()[0].remote).toMatchObject({ dirty: true });

    restored.saveLoadController.saveProject();
    await vi.waitFor(() => expect(sharing.remoteSession.getBinding(restored.id)?.version).toBe('v4'));
    const files = JSON.parse(localStorage.getItem('rd.fakeRemote.files')!) as Record<string, { xml: string; version: string }>;
    expect(files['Station.drawio'].version).toBe('v4');
    expect(files['Station.drawio'].xml).toContain('Balise');
    const log = JSON.parse(localStorage.getItem('rd.fakeRemote.log')!) as Array<Record<string, unknown>>;
    expect(log.find((e) => e.op === 'save')).toMatchObject({ expectedVersion: 'v3', version: 'v4' });
    expect(sharing.remoteSession.isVerified(restored.id)).toBe(true);
    expect(sharing.remoteSession.isDirty(restored.id)).toBe(false);
    expect(cachedTabs()[0].remote).toMatchObject({ version: 'v4', dirty: false });
  });

  it('closing a tab with unsaved remote changes asks first (the tab stays when declined)', async () => {
    const app = startApp();
    apps.push(app.tabManager);
    const bound = app.tabManager.getActiveTab()!;
    app.tabManager.createTab('Other');
    app.sharing.remoteSession.bind(bound, remoteFile('v1'));
    bound.graph.insertVertex(bound.graph.getDefaultParent(), null, 'X', 0, 0, 20, 20);

    // the themed confirmation (no native confirm())
    const nativeConfirm = vi.spyOn(window, 'confirm');
    const closeBtn = document.querySelector<HTMLElement>(`.tab-button[data-tab-id="${bound.id}"] .tab-close-btn`)!;
    closeBtn.click();
    const dialog = document.querySelector<HTMLElement>('[data-testid="remote-confirm-dialog"]')!;
    expect(dialog.textContent).toMatch(/not saved to Test storage/);
    Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(app.tabManager.getAllTabs()).toHaveLength(2);

    // beforeunload asks too
    const evt = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);

    document.querySelector<HTMLElement>(`.tab-button[data-tab-id="${bound.id}"] .tab-close-btn`)!.click();
    document.querySelector<HTMLElement>('[data-testid="remote-confirm-ok"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(app.tabManager.getAllTabs()).toHaveLength(1);
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
