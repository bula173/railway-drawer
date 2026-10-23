/**
 * @file install-sharing.ts
 * @brief Wires sharing into the main editor (called once from main-editor.ts):
 *        Share button + File > Share…, File menu items of the cloud providers, the remote-file
 *        session (Ctrl+S save-back, status bar), incoming `#R` diagram links, provider file links
 *        (`?gitlab=`), pending sign-ins; remote bindings persisted with the tab cache (Reload/Unlink,
 *        unsaved-changes dot, close/leave warnings).
 */
import { on } from '../core/event-bus';
import { InternalEvent } from '@maxgraph/core';
import type { TabData, TabManager } from '../ui/tabs';
import { createFakeRemoteDescriptor } from '../debug/fake-remote-provider';
import { openPopupMenu } from './ui/remote-menu';
import type { PopupMenuItem } from './ui/remote-menu';
import { renderXmlToPngBlob, renderXmlToSvgDocument } from '../ui/diagram-image-export';
import { createStorageProviders } from './providers/registry';
import { RemoteSession } from './remote-session';
import { openShareDialog } from './share-dialog';
import type { ShareDialogHandle } from './share-dialog';
import { buildShareMxfile } from './share-mxfile';
import { buildScenarioPages, scenarioIndexAttributes } from '../scenarios/scenario-format';
import { railwayScriptAttributes } from '../railway-script/script-store';
import { installShareLinkHandler, openDiagramFile } from './share-open';
import type { ShareOpenHost } from './share-open';
import { discardRetiredDrawioDocument, readRetiredDrawioDocument } from '../services/retired-drawio-mode';
import { downloadBlob, el, safeFileName } from './ui/modal';

export interface SharingNotifier {
  success(message: string): unknown;
  error(message: string): unknown;
  info(message: string): unknown;
  warning(message: string): unknown;
}

export interface SharingHandle {
  remoteSession: RemoteSession;
  openShareDialog(): ShareDialogHandle;
  /** Resolves once a `#R` link in the start URL was handled (number of tabs opened). */
  sharedLinkHandled: Promise<number>;
  /** Number of open tabs with changes not saved to their remote provider. */
  unsavedRemoteTabs(): number;
  /** The next page leave skips the "Leave site?" prompt (the user already confirmed, e.g. Log out). */
  allowLeave(): void;
}

function documentTitle(): string {
  return document.querySelector('.document-title')?.textContent?.trim() || 'diagram';
}

function isTabEmpty(tab: TabData): boolean {
  const cells = (tab.graph.getDataModel() as unknown as { cells?: Record<string, unknown> }).cells ?? {};
  // root + default layer
  return Object.keys(cells).length <= 2;
}

export function installSharing(tabManager: TabManager, notify: SharingNotifier): SharingHandle {
  const providers = createStorageProviders({ beforeRedirect: () => tabManager.flushCache() });
  // Test-only provider for the e2e specs: dev server + localStorage flag; dropped from production builds
  if (import.meta.env.DEV) {
    const fake = createFakeRemoteDescriptor();
    if (fake) providers.push(fake);
  }

  const statusItem = document.getElementById('status-remote-item');
  let installed = false;
  const remoteSession = new RemoteSession({
    host: tabManager,
    providers,
    notify,
    statusItem,
    statusValue: document.getElementById('status-remote'),
    tabBar: document.getElementById('tabs-container'),
    watchTab: (remoteTab, onChange) => {
      const tab = tabManager.getAllTabs().find((t) => t.id === remoteTab.id);
      if (!tab) return () => undefined;
      const model = tab.graph.getDataModel();
      const listener = (): void => onChange();
      model.addListener(InternalEvent.CHANGE, listener);
      const stopScenarios = tab.document.scenarios.subscribe(onChange);
      const stopScript = tab.document.railwayScript.subscribe(() => onChange());
      return () => {
        model.removeListener(listener);
        stopScenarios();
        stopScript();
      };
    },
    onBindingsChanged: () => {
      if (!installed) return;
      renderProviderMenuItems();
      // The new version/binding must survive a reload right away (not only at the next autosave)
      tabManager.flushCache();
    },
  });
  on('tab-changed', () => {
    remoteSession.updateStatus();
    renderProviderMenuItems();
  });
  on('tab-closed', ({ tabId }) => {
    if (tabId) remoteSession.onTabClosed(tabId);
    renderProviderMenuItems();
  });

  // Bindings restored from the tab cache (restoreFromCache ran before this), then persisted with it
  for (const tab of tabManager.getAllTabs()) {
    const cached = tabManager.takeCachedRemote(tab.id);
    if (cached !== undefined) remoteSession.restoreBinding(tab, cached);
  }
  tabManager.setRemoteCacheWriter((tabId) => remoteSession.persistedBinding(tabId));
  tabManager.setCloseGuard((tabId) => remoteSession.confirmCloseTab(tabId));
  tabManager.setTabDecorator((tabId, element) => remoteSession.decorateTab(tabId, element));
  remoteSession.updateStatus();

  // Leaving the page with changes not saved to SharePoint/GitLab: the browser's "Leave site?" prompt
  let leaveAllowed = false;
  window.addEventListener('beforeunload', (evt) => {
    if (leaveAllowed || !remoteSession.hasUnsavedRemoteChanges()) return;
    evt.preventDefault();
    // Older browsers need returnValue set
    evt.returnValue = '';
  });

  // Status bar "Stored in:" item: Reload / Unlink / open in the provider
  const remoteActions = (): PopupMenuItem[] => {
    const tab = tabManager.getActiveTab();
    const binding = remoteSession.activeBinding();
    if (!tab || !binding) return [];
    const label = remoteSession.providerLabel(binding.providerId);
    const items: PopupMenuItem[] = [];
    if (remoteSession.isDirty(tab.id)) items.push({ note: `Unsaved changes: Ctrl+S saves them to ${label}.` });
    if (!remoteSession.isVerified(tab.id)) {
      items.push({ note: `Restored after a reload: the next save signs in if needed and checks for changes in ${label}.` });
    }
    items.push(
      { label: `Save to ${label} now`, action: 'save-back', onSelect: () => void remoteSession.saveBack(tab.id) },
      { label: `Reload from ${label}…`, action: 'reload', onSelect: () => void remoteSession.reloadFromRemote(tab.id) },
      { label: `Unlink from ${label}`, action: 'unlink', onSelect: () => remoteSession.unlink(tab.id) }
    );
    if (binding.webUrl) items.push({ label: `Open in ${label} ↗`, action: 'web', href: binding.webUrl });
    return items;
  };
  if (statusItem) {
    statusItem.tabIndex = 0;
    statusItem.setAttribute('role', 'button');
    statusItem.setAttribute('aria-haspopup', 'menu');
    const open = (): void => {
      const items = remoteActions();
      if (items.length > 0) openPopupMenu(statusItem, items);
    };
    statusItem.addEventListener('click', open);
    statusItem.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        open();
      }
    });
  }

  const shareXml = (): string =>
    buildShareMxfile(
      tabManager.getAllTabs().map((tab) => {
        const { extraPages, pageId } = tab.document.getPreservedPages();
        const scenarios = tab.document.scenarios.list();
        return {
          name: tab.name,
          modelXml: tab.document.serializeToXml(),
          extraPages,
          pageId,
          // Scenarios travel with the link: index on the page, one page per step after it
          pageAttributes: { ...scenarioIndexAttributes(scenarios), ...railwayScriptAttributes(tab.document.railwayScript.get()) },
          scenarioPages: buildScenarioPages(scenarios, new Set()),
        };
      })
    );
  const activeModelXml = (): string => {
    const tab = tabManager.getActiveTab();
    if (!tab) throw new Error('No diagram is open');
    return tab.document.serializeToXml();
  };
  const imageName = (): string => safeFileName(tabManager.getActiveTab()?.name || documentTitle());

  const runProviderAction = (providerId: string, action: 'open' | 'save' | 'link'): void => {
    if (action === 'open') void remoteSession.openFrom(providerId);
    else if (action === 'save') void remoteSession.saveTo(providerId);
    else void remoteSession.shareLink(providerId);
  };

  const showShareDialog = (): ShareDialogHandle =>
    openShareDialog({
      getShareXml: shareXml,
      getTabCount: () => tabManager.getAllTabs().length,
      getFileBaseName: () => safeFileName(documentTitle()),
      downloadDrawio: () => {
        downloadBlob(new Blob([shareXml()], { type: 'application/xml' }), `${safeFileName(documentTitle())}.drawio`);
      },
      exportPng: async () => {
        downloadBlob(await renderXmlToPngBlob(activeModelXml()), `${imageName()}.png`);
      },
      exportSvg: async () => {
        const svg = await renderXmlToSvgDocument(activeModelXml());
        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${imageName()}.svg`);
      },
      renderPngFile: async () =>
        new File([await renderXmlToPngBlob(activeModelXml())], `${imageName()}.png`, { type: 'image/png' }),
      providers,
      hasRemoteFile: (providerId) => !!remoteSession.activeBinding(providerId),
      remoteFileName: (providerId) => remoteSession.activeBinding(providerId)?.name ?? null,
      onProviderAction: runProviderAction,
      onProviderSettingsChanged: () => {
        renderProviderMenuItems();
        void remoteSession.openIncomingLinks();
      },
      notify,
    });

  document.getElementById('share-btn')?.addEventListener('click', () => {
    showShareDialog();
  });
  on('share-request', () => {
    showShareDialog();
  });

  // File menu: "Open from <provider>…" / "Save to <provider>…" for every usable provider
  // (rebuilt when runtime provider settings change)
  const menuAnchor = document.getElementById('file-menu-remote-items');
  function renderProviderMenuItems(): void {
    if (!menuAnchor) return;
    menuAnchor.replaceChildren();
    for (const provider of providers) {
      if (provider.availability().state !== 'ready') continue;
      for (const [action, label] of [
        ['open', `Open from ${provider.label}…`],
        ['save', `Save to ${provider.label}…`],
      ] as const) {
        const item = el('div', 'menu-dropdown-item', label);
        item.dataset.remoteAction = action;
        item.dataset.provider = provider.id;
        item.addEventListener('click', () => runProviderAction(provider.id, action));
        menuAnchor.appendChild(item);
      }
    }
    // The active tab's remote file (also when its provider is not usable here: Unlink still works)
    const tab = tabManager.getActiveTab();
    const binding = remoteSession.activeBinding();
    if (tab && binding) {
      const label = remoteSession.providerLabel(binding.providerId);
      const reload = el('div', 'menu-dropdown-item', `Reload from ${label}…`);
      reload.dataset.remoteAction = 'reload';
      reload.dataset.provider = binding.providerId;
      reload.title = `Discard local changes and load ${binding.name} again`;
      reload.addEventListener('click', () => void remoteSession.reloadFromRemote(tab.id));
      const unlink = el('div', 'menu-dropdown-item', `Unlink from ${label}`);
      unlink.dataset.remoteAction = 'unlink';
      unlink.dataset.provider = binding.providerId;
      unlink.title = 'Keep the diagram, stop saving it back (Ctrl+S downloads again)';
      unlink.addEventListener('click', () => remoteSession.unlink(tab.id));
      menuAnchor.append(reload, unlink);
    }
  }
  renderProviderMenuItems();
  installed = true;

  // Redirect sign-ins first (they may be what an incoming link was waiting for)
  void remoteSession.resumePendingSignIns().then(() => remoteSession.openIncomingLinks());

  const openHost: ShareOpenHost = {
    getAllTabs: () => tabManager.getAllTabs(),
    createTab: (name) => tabManager.createTab(name),
    switchTab: (id) => tabManager.switchTab(id),
    closeTab: (id) => tabManager.closeTab(id),
    isTabEmpty: (id) => {
      const tab = tabManager.getAllTabs().find((t) => t.id === id);
      return !!tab && isTabEmpty(tab);
    },
  };
  const sharedLinkHandled = installShareLinkHandler(openHost, notify);

  // The removed draw.io view kept its own autosaved document: open it once as new tabs (blank pages
  // are skipped), then drop it. Dropped after any attempt, so a broken one does not reopen on every start.
  void sharedLinkHandled.then(async () => {
    const retired = readRetiredDrawioDocument();
    if (retired) {
      await openDiagramFile(
        retired.xml,
        retired.title,
        openHost,
        notify,
        { what: 'the diagram of the former draw.io view', successHint: 'Save it (Ctrl+S) to keep it as a file.' },
        { skipEmpty: true }
      );
    }
    discardRetiredDrawioDocument();
  });

  const unsavedRemoteTabs = (): number => {
    if (!remoteSession.hasUnsavedRemoteChanges()) return 0;
    return tabManager.getAllTabs().filter((t) => remoteSession.isDirty(t.id)).length || 1;
  };
  return {
    remoteSession,
    openShareDialog: showShareDialog,
    sharedLinkHandled,
    unsavedRemoteTabs,
    allowLeave: () => {
      leaveAllowed = true;
    },
  };
}
