/**
 * @file remote-session.ts
 * @brief Cloud files per tab: "Open from <provider>…", "Save to <provider>…", Ctrl+S / File > Save
 *        back to the remote file with version (eTag) conflict detection, sharing links, and the
 *        "Stored in:" status-bar item. Provider-agnostic: works on StorageProviderDescriptor /
 *        StorageProvider only.
 *
 * A tab bound to a remote file keeps `RemoteFileInfo` (provider id, ref, version) here, in memory;
 * its SaveLoadController's save handler is redirected to `saveBack`. Bindings do not survive a
 * page reload (the tab cache keeps only the diagram).
 */
import type {
  RemoteFileInfo,
  StorageProvider,
  StorageProviderDescriptor,
} from './providers/types';
import { askSaveConflict, browseRemote, shareLinkDialog } from './ui/remote-dialogs';
import type { BrowseOptions, BrowseResult, ConflictChoice } from './ui/remote-dialogs';

/** What a tab must offer (TabData satisfies it). */
export interface RemoteTab {
  id: string;
  name: string;
  saveLoadController: {
    getProjectXml(): string;
    loadProjectXml(xml: string, sourceName: string, opts?: { quiet?: boolean }): Promise<void>;
    setSaveHandler(handler: (() => void) | null): void;
    markAsSavedToDisk?(): void;
  };
}

export interface RemoteTabHost {
  getActiveTab(): RemoteTab | null;
  getAllTabs(): RemoteTab[];
  createTab(name: string): RemoteTab;
  switchTab(tabId: string): void;
  closeTab(tabId: string): void;
}

export interface RemoteNotifier {
  success(message: string): unknown;
  error(message: string): unknown;
  info(message: string): unknown;
  warning(message: string): unknown;
}

/** The dialogs (replaceable in tests). */
export interface RemoteUi {
  browse(provider: StorageProvider, opts: BrowseOptions): Promise<BrowseResult | null>;
  askConflict(providerLabel: string, message: string): Promise<ConflictChoice>;
  shareLink(provider: StorageProvider, file: RemoteFileInfo): Promise<void>;
}

export interface RemoteSessionOptions {
  host: RemoteTabHost;
  providers: StorageProviderDescriptor[];
  notify: RemoteNotifier;
  ui?: Partial<RemoteUi>;
  /** Status-bar item (`#status-remote-item`) and its value (`#status-remote`). */
  statusItem?: HTMLElement | null;
  statusValue?: HTMLElement | null;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** "Station.drawio" -> "Station (copy).drawio" */
export function copyFileName(name: string): string {
  const match = /^(.*?)(\.[^.]+)?$/.exec(name);
  return `${match?.[1] || 'diagram'} (copy)${match?.[2] ?? '.drawio'}`;
}

function stripExtension(name: string): string {
  return name.replace(/\.(drawio|xml|railwaydrawer)$/i, '') || name;
}

export class RemoteSession {
  private readonly host: RemoteTabHost;
  private readonly providers: StorageProviderDescriptor[];
  private readonly notify: RemoteNotifier;
  private readonly ui: RemoteUi;
  private readonly bindings = new Map<string, RemoteFileInfo>();
  private readonly saving = new Set<string>();
  private readonly statusItem: HTMLElement | null;
  private readonly statusValue: HTMLElement | null;

  constructor(opts: RemoteSessionOptions) {
    this.host = opts.host;
    this.providers = opts.providers;
    this.notify = opts.notify;
    this.ui = {
      browse: browseRemote,
      askConflict: askSaveConflict,
      shareLink: shareLinkDialog,
      ...opts.ui,
    };
    this.statusItem = opts.statusItem ?? null;
    this.statusValue = opts.statusValue ?? null;
  }

  getBinding(tabId: string): RemoteFileInfo | null {
    return this.bindings.get(tabId) ?? null;
  }

  /** The active tab's file, when it belongs to `providerId`. */
  activeBinding(providerId?: string): RemoteFileInfo | null {
    const tab = this.host.getActiveTab();
    const binding = tab ? this.getBinding(tab.id) : null;
    return binding && (!providerId || binding.providerId === providerId) ? binding : null;
  }

  private descriptor(providerId: string): StorageProviderDescriptor {
    const descriptor = this.providers.find((p) => p.id === providerId);
    if (!descriptor) throw new Error(`Unknown storage provider "${providerId}"`);
    return descriptor;
  }

  /** Loads the provider, reporting why it is not usable. */
  private async provider(providerId: string): Promise<StorageProvider | null> {
    const descriptor = this.descriptor(providerId);
    const availability = descriptor.availability();
    if (availability.state !== 'ready') {
      this.notify.warning(`${descriptor.label}: ${availability.reason}`);
      return null;
    }
    try {
      return await descriptor.load();
    } catch (err) {
      this.notify.error(`${descriptor.label} could not be loaded: ${errorText(err)}`);
      return null;
    }
  }

  bind(tab: RemoteTab, file: RemoteFileInfo): void {
    this.bindings.set(tab.id, file);
    tab.saveLoadController.setSaveHandler(() => {
      void this.saveBack(tab.id);
    });
    this.updateStatus();
  }

  unbind(tabId: string): void {
    const tab = this.host.getAllTabs().find((t) => t.id === tabId);
    tab?.saveLoadController.setSaveHandler(null);
    this.bindings.delete(tabId);
    this.updateStatus();
  }

  /** TabManager closed a tab. */
  onTabClosed(tabId: string): void {
    this.bindings.delete(tabId);
    this.updateStatus();
  }

  /** Shows the active tab's remote location in the status bar. */
  updateStatus(): void {
    const binding = this.activeBinding();
    if (this.statusItem) this.statusItem.hidden = !binding;
    if (!this.statusValue) return;
    if (!binding) {
      this.statusValue.textContent = '';
      this.statusValue.removeAttribute('title');
      return;
    }
    const label = this.providers.find((p) => p.id === binding.providerId)?.label ?? binding.providerId;
    this.statusValue.textContent = `${label}: ${binding.location}`;
    this.statusValue.title = binding.webUrl ? `${binding.location}\n${binding.webUrl}` : binding.location;
  }

  /** File > Open from <provider>…: opens the chosen file in a new tab bound to it. */
  async openFrom(providerId: string): Promise<boolean> {
    const provider = await this.provider(providerId);
    if (!provider) return false;
    const choice = await this.ui.browse(provider, { mode: 'open' });
    if (!choice || choice.mode !== 'open') return false;
    let content;
    try {
      content = await provider.open(choice.path, choice.file);
    } catch (err) {
      this.notify.error(`Could not open "${choice.file.name}" from ${provider.label}: ${errorText(err)}`);
      return false;
    }
    const tab = this.host.createTab(stripExtension(content.name));
    try {
      await tab.saveLoadController.loadProjectXml(content.xml, content.name, { quiet: true });
    } catch {
      // loadProjectXml already told the user why
      this.host.closeTab(tab.id);
      return false;
    }
    this.host.switchTab(tab.id);
    const info: RemoteFileInfo & { xml?: string } = { ...content };
    delete info.xml;
    this.bind(tab, info);
    tab.saveLoadController.markAsSavedToDisk?.();
    this.notify.success(`Opened "${content.name}" from ${provider.label}. Ctrl+S saves back to it.`);
    return true;
  }

  /** File > Save to <provider>…: the active tab as a new file; the tab is bound to it. */
  async saveTo(providerId: string): Promise<boolean> {
    const tab = this.host.getActiveTab();
    if (!tab) return false;
    const provider = await this.provider(providerId);
    if (!provider) return false;
    const existing = this.getBinding(tab.id);
    let opts: BrowseOptions = {
      mode: 'save',
      defaultName: existing?.providerId === providerId ? existing.name : `${tab.name || 'diagram'}.drawio`,
      initialPath: existing?.providerId === providerId ? existing.parentPath : undefined,
    };
    for (;;) {
      const choice = await this.ui.browse(provider, opts);
      if (!choice || choice.mode !== 'save') return false;
      try {
        const result = await provider.saveAs(choice.path, choice.name, tab.saveLoadController.getProjectXml(), choice.conflict);
        if (result.ok) {
          this.bind(tab, result.file);
          tab.saveLoadController.markAsSavedToDisk?.();
          this.notify.success(`Saved "${result.file.name}" to ${provider.label}. Ctrl+S saves back to it.`);
          return true;
        }
        // Name exists ("ask me"): back to the dialog with a hint
        opts = { ...opts, initialPath: choice.path, defaultName: choice.name, message: `${result.message} Choose another name or "replace"/"keep both".` };
      } catch (err) {
        this.notify.error(`Could not save to ${provider.label}: ${errorText(err)}`);
        return false;
      }
    }
  }

  /** Ctrl+S / File > Save for a bound tab. */
  async saveBack(tabId: string): Promise<boolean> {
    const binding = this.getBinding(tabId);
    const tab = this.host.getAllTabs().find((t) => t.id === tabId);
    if (!binding || !tab) return false;
    if (this.saving.has(tabId)) return false;
    this.saving.add(tabId);
    try {
      const provider = await this.provider(binding.providerId);
      if (!provider) return false;
      const xml = tab.saveLoadController.getProjectXml();
      let result = await provider.save(binding, xml, binding.version);
      if (!result.ok) {
        const choice = await this.ui.askConflict(provider.label, result.message);
        if (choice === 'cancel') {
          this.notify.info('Not saved. Your changes are still in this tab.');
          return false;
        }
        result =
          choice === 'overwrite'
            ? await provider.save(binding, xml, null)
            : await provider.saveAs(binding.parentPath, copyFileName(binding.name), xml, 'rename');
        if (!result.ok) {
          this.notify.error(result.message);
          return false;
        }
      }
      this.bind(tab, result.file);
      tab.saveLoadController.markAsSavedToDisk?.();
      this.notify.success(`Saved to ${provider.label}: ${result.file.name}`);
      return true;
    } catch (err) {
      this.notify.error(`Could not save to ${this.descriptor(binding.providerId).label}: ${errorText(err)}`);
      return false;
    } finally {
      this.saving.delete(tabId);
    }
  }

  /** "Sharing link…" for the active tab's remote file. */
  async shareLink(providerId: string): Promise<void> {
    const binding = this.activeBinding(providerId);
    const label = this.descriptor(providerId).label;
    if (!binding) {
      this.notify.info(`Save the diagram to ${label} (or open it from there) first, then share it.`);
      return;
    }
    const provider = await this.provider(providerId);
    if (!provider) return;
    await this.ui.shareLink(provider, binding);
  }

  /** Startup: completes a redirect sign-in of any provider and says so. */
  async resumePendingSignIns(): Promise<void> {
    for (const descriptor of this.providers) {
      try {
        const provider = await descriptor.resumePendingSignIn?.();
        const account = provider?.getAccount();
        if (account) this.notify.success(`Signed in to ${descriptor.label} as ${account.name}. Repeat the last action.`);
      } catch (err) {
        this.notify.error(`${descriptor.label} sign-in failed: ${errorText(err)}`);
      }
    }
  }
}
