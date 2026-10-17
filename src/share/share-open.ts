/**
 * @file share-open.ts
 * @brief Opens a diagram link (`#R…`) on startup and when the hash changes: every page of the
 *        shared file becomes a new tab (existing tabs are kept, so no unsaved work is replaced;
 *        a single empty tab is closed), then the hash is removed from the address bar.
 */
import { decodeShareHash, isShareHash, stripShareHash } from './share-link';
import { splitSharedFile } from './share-mxfile';

export interface ShareOpenTab {
  id: string;
  saveLoadController: {
    loadProjectXml(xml: string, sourceName: string, opts?: { quiet?: boolean }): Promise<void>;
  };
}

export interface ShareOpenHost {
  getAllTabs(): ShareOpenTab[];
  createTab(name: string): ShareOpenTab;
  switchTab(tabId: string): void;
  closeTab(tabId: string): void;
  /** True for a tab without any diagram content. */
  isTabEmpty(tabId: string): boolean;
}

export interface ShareOpenNotifier {
  success(message: string): unknown;
  error(message: string): unknown;
  warning(message: string): unknown;
}

/** Wording of the notifications of `openDiagramFile`. */
export interface OpenDiagramMessages {
  /** e.g. 'the shared diagram' */
  what: string;
  /** Appended to the success message. */
  successHint: string;
}

export interface OpenDiagramResult {
  opened: number;
  failed: number;
  /** The file was not a readable draw.io file (nothing was opened). */
  invalid: boolean;
}

const SHARED_MESSAGES: OpenDiagramMessages = {
  what: 'the shared diagram',
  successHint: 'Save it (Ctrl+S) to keep your own copy.',
};

/**
 * Opens every page group of a draw.io file (<mxfile> or <mxGraphModel>) as new tabs. Resolves with
 * the number of tabs opened, of pages that could not be read, and whether the file itself was
 * unreadable. With `skipEmpty`, pages without any content are not kept (and not counted).
 */
export async function openDiagramFile(
  fileXml: string,
  fallbackName: string,
  host: ShareOpenHost,
  notify: ShareOpenNotifier,
  messages: OpenDiagramMessages = SHARED_MESSAGES,
  opts: { skipEmpty?: boolean } = {}
): Promise<OpenDiagramResult> {
  let pages;
  try {
    pages = splitSharedFile(fileXml, fallbackName);
  } catch (err) {
    notify.error(`Could not open ${messages.what}: ${err instanceof Error ? err.message : String(err)}`);
    return { opened: 0, failed: 0, invalid: true };
  }

  const before = host.getAllTabs();
  const lonelyEmptyTab = before.length === 1 && host.isTabEmpty(before[0].id) ? before[0] : null;
  const opened: string[] = [];
  let failed = 0;
  for (const page of pages) {
    const tab = host.createTab(page.name);
    try {
      await tab.saveLoadController.loadProjectXml(page.fileXml, page.name, { quiet: true });
      if (opts.skipEmpty && host.isTabEmpty(tab.id)) host.closeTab(tab.id);
      else opened.push(tab.id);
    } catch {
      // loadProjectXml showed the reason
      failed++;
      host.closeTab(tab.id);
    }
  }
  if (opened.length === 0) return { opened: 0, failed, invalid: false };
  host.switchTab(opened[0]);
  if (lonelyEmptyTab) host.closeTab(lonelyEmptyTab.id);
  const where = opened.length === 1 ? 'a new tab' : `${opened.length} new tabs`;
  if (failed > 0) notify.warning(`Opened ${messages.what} in ${where}; ${failed} page(s) could not be read.`);
  else notify.success(`Opened ${messages.what} in ${where}. ${messages.successHint}`);
  return { opened: opened.length, failed, invalid: false };
}

/** Opens the diagram in `hash`; resolves with the number of tabs opened (0 on failure). */
export async function openSharedDiagram(hash: string, host: ShareOpenHost, notify: ShareOpenNotifier): Promise<number> {
  let fileXml: string;
  try {
    fileXml = await decodeShareHash(hash);
  } catch (err) {
    notify.error(`Could not open the shared diagram: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
  return (await openDiagramFile(fileXml, 'Shared diagram', host, notify)).opened;
}

/**
 * Handles the current location's `#R…` hash and later hash changes (a link pasted into the
 * address bar of an open app). The hash is removed first, so a reload does not open it again.
 */
export function installShareLinkHandler(host: ShareOpenHost, notify: ShareOpenNotifier, win: Window = window): Promise<number> {
  const handle = (): Promise<number> => {
    const hash = win.location.hash;
    if (!isShareHash(hash)) return Promise.resolve(0);
    stripShareHash(win);
    return openSharedDiagram(hash, host, notify);
  };
  win.addEventListener('hashchange', () => {
    void handle();
  });
  return handle();
}
