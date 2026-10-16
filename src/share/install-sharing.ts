/**
 * @file install-sharing.ts
 * @brief Wires sharing into the legacy editor (called once from legacy-main.ts):
 *        Share button + File > Share…, File menu items of the cloud providers, the remote-file
 *        session (Ctrl+S save-back, status bar), incoming `#R` diagram links, pending sign-ins.
 */
import type { TabData, TabManager } from '../ui/tabs';
import { renderXmlToPngBlob, renderXmlToSvgDocument } from '../ui/diagram-image-export';
import { createStorageProviders } from './providers/registry';
import { RemoteSession } from './remote-session';
import { openShareDialog } from './share-dialog';
import type { ShareDialogHandle } from './share-dialog';
import { buildShareMxfile } from './share-mxfile';
import { installShareLinkHandler } from './share-open';
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

  const remoteSession = new RemoteSession({
    host: tabManager,
    providers,
    notify,
    statusItem: document.getElementById('status-remote-item'),
    statusValue: document.getElementById('status-remote'),
  });
  window.addEventListener('tab-changed', () => remoteSession.updateStatus());
  window.addEventListener('tab-closed', (evt) => {
    const tabId = (evt as CustomEvent<{ tabId: string }>).detail?.tabId;
    if (tabId) remoteSession.onTabClosed(tabId);
  });

  const shareXml = (): string =>
    buildShareMxfile(
      tabManager.getAllTabs().map((tab) => {
        const { extraPages, pageId } = tab.saveLoadController.getPreservedPages();
        return { name: tab.name, modelXml: tab.saveLoadController.serializeToXml(), extraPages, pageId };
      })
    );
  const activeModelXml = (): string => {
    const tab = tabManager.getActiveTab();
    if (!tab) throw new Error('No diagram is open');
    return tab.saveLoadController.serializeToXml();
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
      notify,
    });

  document.getElementById('share-btn')?.addEventListener('click', () => {
    showShareDialog();
  });
  window.addEventListener('share-request', () => {
    showShareDialog();
  });

  // File menu: "Open from <provider>…" / "Save to <provider>…" for every usable provider
  const menuAnchor = document.getElementById('file-menu-remote-items');
  if (menuAnchor) {
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
  }

  void remoteSession.resumePendingSignIns();

  const sharedLinkHandled = installShareLinkHandler(
    {
      getAllTabs: () => tabManager.getAllTabs(),
      createTab: (name) => tabManager.createTab(name),
      switchTab: (id) => tabManager.switchTab(id),
      closeTab: (id) => tabManager.closeTab(id),
      isTabEmpty: (id) => {
        const tab = tabManager.getAllTabs().find((t) => t.id === id);
        return !!tab && isTabEmpty(tab);
      },
    },
    notify
  );

  return { remoteSession, openShareDialog: showShareDialog, sharedLinkHandled };
}
