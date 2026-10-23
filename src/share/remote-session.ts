/**
 * @file remote-session.ts
 * @brief Cloud files per tab: "Open from <provider>…", "Save to <provider>…", Ctrl+S / File > Save
 *        back to the remote file with version (eTag) conflict detection, sharing links, and the
 *        "Stored in:" status-bar item. Provider-agnostic: works on StorageProviderDescriptor /
 *        StorageProvider only.
 *
 * A tab bound to a remote file keeps `RemoteFileInfo` (provider id, ref, version) here; its
 * SaveLoadController's save handler is redirected to `saveBack`. The binding is also persisted with
 * the tab in the browser cache (`persistedBinding` / `restoreBinding`, format in remote-binding.ts;
 * never any token), so Ctrl+S still saves back after a page reload. A restored binding is
 * "unverified" until its next save: that save signs in if needed and sends the stored version, so a
 * file changed remotely meanwhile still ends in the conflict dialog.
 *
 * Dirty tracking: a fingerprint of the tab's file content at the last successful open/save; edits
 * (`watchTab`) re-check it (debounced), so undoing back to the saved state is clean again. A tab
 * restored with unsaved changes stays dirty until it is saved (or reloaded from the provider).
 */
import type {
  ConflictAction,
  RemoteFileContent,
  RemoteFileInfo,
  ResultLink,
  SaveField,
  SaveFieldValues,
  SaveResult,
  StorageProvider,
  StorageProviderDescriptor,
} from './providers/types';
import { askConfirm, askSaveConflict, askSaveOptions, askSignIn, browseRemote, shareLinkDialog, showResultLink } from './ui/remote-dialogs';
import { contentFingerprint, parseRemoteBinding, serializeRemoteBinding } from './remote-binding';
import type { PersistedRemoteBinding } from './remote-binding';
import type { BrowseOptions, BrowseResult, ConflictChoice } from './ui/remote-dialogs';

/** What a tab must offer (TabData satisfies it). */
export interface RemoteTab {
  id: string;
  name: string;
  /** The tab's document (document/diagram-document.ts): file content and the remote save handler. */
  document: {
    getProjectXml(): string;
    setSaveHandler(handler: (() => void) | null): void;
    /** True when the last open changed the diagram against the file (old app layers migrated). */
    hasUnsavedLoadChanges?(): boolean;
  };
  /** File I/O (ui/saveload.ts). */
  saveLoadController: {
    loadProjectXml(xml: string, sourceName: string, opts?: { quiet?: boolean }): Promise<void>;
    markAsSavedToDisk?(target?: string): void;
    /** Called after a file from disk was opened into the tab (File > Open): the tab is unbound. */
    onLocalFileOpened?(listener: () => void): () => void;
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
  askConflict(providerLabel: string, message: string, actions?: ConflictAction[]): Promise<ConflictChoice>;
  shareLink(provider: StorageProvider, file: RemoteFileInfo): Promise<void>;
  /** Provider save fields (commit message, ...); null = cancelled. */
  askOptions(opts: { title: string; intro?: string; fields: SaveField[]; confirmLabel?: string }): Promise<SaveFieldValues | null>;
  showLink(title: string, message: string, link: ResultLink): Promise<void>;
  /** Sign-in prompt (incoming link, save back; the click allows the popup); true when signed in. */
  askSignIn(provider: StorageProvider, message: string): Promise<boolean>;
  /** Yes/no question (Reload from <provider>); true = confirmed. */
  confirm(opts: { title: string; message: string; confirmLabel: string; danger?: boolean }): Promise<boolean>;
}

export interface RemoteSessionOptions {
  host: RemoteTabHost;
  providers: StorageProviderDescriptor[];
  notify: RemoteNotifier;
  ui?: Partial<RemoteUi>;
  /** Status-bar item (`#status-remote-item`) and its value (`#status-remote`). */
  statusItem?: HTMLElement | null;
  statusValue?: HTMLElement | null;
  /** The tab bar (`.tab-button[data-tab-id]`), for the unsaved-changes dot. */
  tabBar?: HTMLElement | null;
  /** Calls `onChange` after every edit of the tab (model, scenarios); returns the unsubscribe function. */
  watchTab?(tab: RemoteTab, onChange: () => void): () => void;
  /** A binding was added, changed or removed (persist the cache, rebuild menus). */
  onBindingsChanged?(): void;
  /** Synchronous question before closing a tab with unsaved remote changes (default window.confirm). */
  confirmClose?(message: string): boolean | Promise<boolean>;
}

/** Per-binding state besides the file info. */
interface BindingState {
  /** False after a restore from the cache, until the next successful save/reload. */
  verified: boolean;
  /** Last successful open/save from/to the provider. */
  savedAt: number;
  /** Fingerprint of the content at `savedAt`; null = unknown (restored with unsaved changes). */
  savedHash: string | null;
  dirty: boolean;
}

/** Debounce of the dirty check after an edit. */
const DIRTY_CHECK_DELAY_MS = 300;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** "Station.drawio" -> "Station (copy).drawio" */
export function copyFileName(name: string): string {
  const match = /^(.*?)(\.[^.]+)?$/.exec(name);
  return `${match?.[1] || 'diagram'} (copy)${match?.[2] ?? '.drawio'}`;
}

/** `values` as an extra argument only when there are any (providers without save fields get the old call). */
function withValues(values: SaveFieldValues | undefined): [] | [SaveFieldValues] {
  return values ? [values] : [];
}

function withoutXml(content: RemoteFileContent): RemoteFileInfo {
  const info: RemoteFileInfo & { xml?: string } = { ...content };
  delete info.xml;
  return info;
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
  private readonly tabBar: HTMLElement | null;
  private readonly watchTab: RemoteSessionOptions['watchTab'];
  private readonly onBindingsChanged: () => void;
  private readonly confirmClose: (message: string) => boolean | Promise<boolean>;
  private readonly states = new Map<string, BindingState>();
  /** Unsubscribe functions of the edit/local-open watchers, per bound tab. */
  private readonly watchers = new Map<string, () => void>();
  private readonly pendingChecks = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(opts: RemoteSessionOptions) {
    this.host = opts.host;
    this.providers = opts.providers;
    this.notify = opts.notify;
    this.ui = {
      browse: browseRemote,
      askConflict: askSaveConflict,
      shareLink: shareLinkDialog,
      askOptions: askSaveOptions,
      showLink: showResultLink,
      askSignIn,
      confirm: askConfirm,
      ...opts.ui,
    };
    this.statusItem = opts.statusItem ?? null;
    this.statusValue = opts.statusValue ?? null;
    this.tabBar = opts.tabBar ?? null;
    this.watchTab = opts.watchTab;
    this.onBindingsChanged = opts.onBindingsChanged ?? (() => undefined);
    this.confirmClose =
      opts.confirmClose ?? ((message) => this.ui.confirm({ title: 'Close the tab?', message, confirmLabel: 'Close and discard', danger: true }));
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

  /** The provider's label, also for bindings of a provider this build/browser does not have. */
  providerLabel(providerId: string): string {
    return this.providers.find((p) => p.id === providerId)?.label ?? providerId;
  }

  /** Loads the provider, reporting why it is not usable. */
  private async provider(providerId: string): Promise<StorageProvider | null> {
    if (!this.providers.some((p) => p.id === providerId)) {
      this.notify.warning(
        `This tab is linked to "${providerId}", which is not available in this browser. Use File > Unlink to save it elsewhere.`
      );
      return null;
    }
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

  /** Binds `tab` to `file` as just opened/saved: verified, no unsaved changes. */
  bind(tab: RemoteTab, file: RemoteFileInfo, savedXml?: string): void {
    // Just opened, but the open migrated the file (old app layers): unsaved until saved back
    const changedOnOpen = savedXml === undefined && tab.document.hasUnsavedLoadChanges?.() === true;
    this.setBinding(tab, file, {
      verified: true,
      savedAt: Date.now(),
      savedHash: changedOnOpen ? '' : contentFingerprint(savedXml ?? tab.document.getProjectXml()),
      dirty: changedOnOpen,
    });
    // Edits made while a save was running are still unsaved
    if (savedXml !== undefined) this.scheduleCheck(tab.id);
    this.onBindingsChanged();
  }

  private setBinding(tab: RemoteTab, file: RemoteFileInfo, state: BindingState): void {
    this.bindings.set(tab.id, file);
    this.states.set(tab.id, state);
    tab.document.setSaveHandler(() => {
      void this.saveBack(tab.id);
    });
    if (!this.watchers.has(tab.id)) {
      const stopEdits = this.watchTab?.(tab, () => this.scheduleCheck(tab.id));
      const stopLocal = tab.saveLoadController.onLocalFileOpened?.(() => this.onLocalFileOpened(tab.id));
      this.watchers.set(tab.id, () => {
        stopEdits?.();
        stopLocal?.();
      });
    }
    this.updateStatus();
    this.updateDirtyMarks();
  }

  private forget(tabId: string): void {
    this.bindings.delete(tabId);
    this.states.delete(tabId);
    this.watchers.get(tabId)?.();
    this.watchers.delete(tabId);
    const pending = this.pendingChecks.get(tabId);
    if (pending !== undefined) clearTimeout(pending);
    this.pendingChecks.delete(tabId);
  }

  unbind(tabId: string): void {
    const tab = this.host.getAllTabs().find((t) => t.id === tabId);
    tab?.document.setSaveHandler(null);
    const had = this.bindings.has(tabId);
    this.forget(tabId);
    this.updateStatus();
    this.updateDirtyMarks();
    if (had) this.onBindingsChanged();
  }

  /** TabManager closed a tab. */
  onTabClosed(tabId: string): void {
    this.forget(tabId);
    this.updateStatus();
  }

  /** File > Open (from disk) replaced the tab's content: it is no longer the remote file. */
  private onLocalFileOpened(tabId: string): void {
    const binding = this.getBinding(tabId);
    if (!binding) return;
    this.unbind(tabId);
    this.notify.info(
      `This tab is no longer linked to ${this.providerLabel(binding.providerId)} ("${binding.name}"): Ctrl+S downloads the opened file.`
    );
  }

  // ---- persistence (tab cache) ----------------------------------------------------------------

  /** The binding of `tabId` as stored in the tab cache (undefined: not bound). Never contains tokens. */
  persistedBinding(tabId: string): PersistedRemoteBinding | undefined {
    const file = this.bindings.get(tabId);
    if (!file) return undefined;
    if (this.pendingChecks.has(tabId)) this.checkDirty(tabId);
    const state = this.states.get(tabId);
    return serializeRemoteBinding(file, { savedAt: state?.savedAt ?? 0, dirty: state?.dirty ?? true });
  }

  /**
   * Restores a binding read from the tab cache onto `tab` (after its diagram was restored). It is
   * unverified until the next save. Returns false (tab stays unbound) for malformed/unknown data.
   */
  restoreBinding(tab: RemoteTab, raw: unknown): boolean {
    const restored = parseRemoteBinding(raw);
    if (!restored) {
      if (raw !== undefined && raw !== null) console.warn('[RemoteSession] Ignoring an unreadable cached remote binding of tab', tab.name);
      return false;
    }
    let savedHash: string | null = null;
    if (!restored.dirty) {
      try {
        savedHash = contentFingerprint(tab.document.getProjectXml());
      } catch {
        savedHash = null;
      }
    }
    this.setBinding(tab, restored.file, {
      verified: false,
      savedAt: restored.savedAt,
      savedHash,
      dirty: restored.dirty || savedHash === null,
    });
    return true;
  }

  /** False while a restored binding has not been saved/reloaded since the page load. */
  isVerified(tabId: string): boolean {
    return this.states.get(tabId)?.verified ?? false;
  }

  // ---- dirty tracking -------------------------------------------------------------------------

  private scheduleCheck(tabId: string): void {
    if (!this.bindings.has(tabId)) return;
    const pending = this.pendingChecks.get(tabId);
    if (pending !== undefined) clearTimeout(pending);
    this.pendingChecks.set(
      tabId,
      setTimeout(() => {
        this.pendingChecks.delete(tabId);
        this.checkDirty(tabId);
      }, DIRTY_CHECK_DELAY_MS)
    );
  }

  /** Recomputes whether `tabId` has changes not saved to its provider. */
  checkDirty(tabId: string): boolean {
    const pending = this.pendingChecks.get(tabId);
    if (pending !== undefined) clearTimeout(pending);
    this.pendingChecks.delete(tabId);
    const state = this.states.get(tabId);
    const tab = this.host.getAllTabs().find((t) => t.id === tabId);
    if (!state || !tab) return false;
    let dirty = true;
    if (state.savedHash !== null) {
      try {
        dirty = contentFingerprint(tab.document.getProjectXml()) !== state.savedHash;
      } catch {
        dirty = state.dirty;
      }
    }
    if (dirty !== state.dirty) {
      state.dirty = dirty;
      this.updateDirtyMarks();
      this.updateStatus();
    }
    return dirty;
  }

  /** Whether `tabId` is bound and has changes since its last successful remote save. */
  isDirty(tabId: string): boolean {
    return this.states.get(tabId)?.dirty ?? false;
  }

  /** For `beforeunload`: any bound tab with unsaved remote changes. */
  hasUnsavedRemoteChanges(): boolean {
    for (const tabId of Array.from(this.pendingChecks.keys())) {
      try {
        this.checkDirty(tabId);
      } catch {
        // tab already torn down: keep the last known state
      }
    }
    return Array.from(this.states.values()).some((state) => state.dirty);
  }

  /**
   * Before the user closes a tab: true = close it (asks with a themed dialog when it has unsaved
   * remote changes; then the answer is a promise).
   */
  confirmCloseTab(tabId: string): boolean | Promise<boolean> {
    const binding = this.getBinding(tabId);
    if (!binding || !this.checkDirty(tabId)) return true;
    const tab = this.host.getAllTabs().find((t) => t.id === tabId);
    const label = this.providerLabel(binding.providerId);
    return this.confirmClose(
      `"${tab?.name ?? binding.name}" has changes that are not saved to ${label} (${binding.name}). Close the tab and lose them?`
    );
  }

  /** Adds/removes the unsaved-changes dot of one tab element (TabManager tab decorator). */
  decorateTab(tabId: string, element: HTMLElement): void {
    const dirty = this.isDirty(tabId);
    let dot = element.querySelector<HTMLElement>('.rd-remote-dirty-dot');
    element.classList.toggle('rd-remote-dirty', dirty);
    if (!dirty) {
      dot?.remove();
      return;
    }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'rd-remote-dirty-dot';
      const label = element.querySelector('.tab-label');
      if (label) label.after(dot);
      else element.appendChild(dot);
    }
    const binding = this.getBinding(tabId);
    const text = `Unsaved changes (not yet saved to ${binding ? this.providerLabel(binding.providerId) : 'the remote file'})`;
    dot.title = text;
    dot.setAttribute('aria-label', text);
    dot.setAttribute('role', 'img');
  }

  private updateDirtyMarks(): void {
    this.tabBar?.querySelectorAll<HTMLElement>('.tab-button[data-tab-id]').forEach((element) => {
      this.decorateTab(element.dataset.tabId ?? '', element);
    });
  }

  /** Shows the active tab's remote location in the status bar. */
  updateStatus(): void {
    const binding = this.activeBinding();
    const tabId = this.host.getActiveTab()?.id ?? '';
    if (this.statusItem) {
      this.statusItem.hidden = !binding;
      this.statusItem.classList.toggle('rd-remote-clickable', !!binding);
      if (binding) {
        this.statusItem.dataset.dirty = String(this.isDirty(tabId));
        this.statusItem.dataset.verified = String(this.isVerified(tabId));
      } else {
        delete this.statusItem.dataset.dirty;
        delete this.statusItem.dataset.verified;
      }
    }
    if (!this.statusValue) return;
    if (!binding) {
      this.statusValue.textContent = '';
      this.statusValue.removeAttribute('title');
      return;
    }
    const label = this.providerLabel(binding.providerId);
    this.statusValue.textContent = `${label}: ${binding.location}`;
    const lines = [binding.location];
    if (binding.webUrl) lines.push(binding.webUrl);
    if (this.isDirty(tabId)) lines.push(`Unsaved changes: Ctrl+S saves them to ${label}.`);
    if (!this.isVerified(tabId)) lines.push(`Restored after a reload: the next save signs in if needed and checks for changes in ${label}.`);
    lines.push('Click for Reload / Unlink.');
    this.statusValue.title = lines.join('\n');
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
    return this.openContent(provider, content);
  }

  /** Loads `content` into a new tab bound to the remote file. */
  private async openContent(provider: StorageProvider, content: RemoteFileContent): Promise<boolean> {
    const tab = this.host.createTab(stripExtension(content.name));
    try {
      await tab.saveLoadController.loadProjectXml(content.xml, content.name, { quiet: true });
    } catch {
      // loadProjectXml already told the user why
      this.host.closeTab(tab.id);
      return false;
    }
    this.host.switchTab(tab.id);
    this.bind(tab, withoutXml(content));
    tab.saveLoadController.markAsSavedToDisk?.(provider.label);
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
        const xml = tab.document.getProjectXml();
        const result = await provider.saveAs(choice.path, choice.name, xml, choice.conflict, ...withValues(choice.values));
        if (result.ok) {
          this.bind(tab, result.file, xml);
          tab.saveLoadController.markAsSavedToDisk?.(provider.label);
          this.reportSaved(provider, result, `Saved "${result.file.name}" to ${provider.label}. Ctrl+S saves back to it.`);
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
      // Restored binding / expired session: sign in first (a dialog, so the popup has a click)
      const signInWhy = `Sign in to ${provider.label} to save "${binding.name}" back to ${binding.location}.`;
      if (!(await this.ensureSignedIn(provider, signInWhy))) {
        this.notify.info(`Not saved: saving to ${provider.label} needs a sign-in. Your changes are still in this tab.`);
        return false;
      }
      const xml = tab.document.getProjectXml();
      // Provider save fields (GitLab: commit message, merge request)
      const fields = provider.saveFields?.({ kind: 'save', file: binding }) ?? [];
      let values: SaveFieldValues | undefined;
      if (fields.length > 0) {
        values = (await this.ui.askOptions({ title: `Save to ${provider.label}`, intro: binding.location, fields })) ?? undefined;
        if (!values) {
          this.notify.info('Not saved. Your changes are still in this tab.');
          return false;
        }
      }
      // The stored version (also after a reload) detects remote changes made meanwhile
      let result: SaveResult = await this.withSignIn(provider, signInWhy, () => provider.save(binding, xml, binding.version, ...withValues(values)));
      if (!result.ok) {
        const actions = provider.conflictActions?.(binding) ?? [];
        const choice = await this.ui.askConflict(provider.label, result.message, actions);
        if (choice === 'cancel') {
          this.notify.info('Not saved. Your changes are still in this tab.');
          return false;
        }
        if (choice === 'overwrite') {
          result = await provider.save(binding, xml, null, ...withValues(values));
        } else if (choice === 'copy') {
          result = await provider.saveAs(binding.parentPath, copyFileName(binding.name), xml, 'rename', ...withValues(values));
        } else {
          const action = actions.find((a) => `action:${a.id}` === choice);
          if (!action || !provider.resolveConflict) return false;
          const answers = action.fields?.length ? await this.ui.askOptions({ title: action.label, fields: action.fields }) : {};
          if (!answers) {
            this.notify.info('Not saved. Your changes are still in this tab.');
            return false;
          }
          result = await provider.resolveConflict(binding, xml, action.id, answers);
        }
        if (!result.ok) {
          this.notify.error(result.message);
          return false;
        }
      }
      // The tab may have been closed or unlinked while the save ran
      if (this.bindings.has(tabId)) this.bind(tab, result.file, xml);
      tab.saveLoadController.markAsSavedToDisk?.(provider.label);
      this.reportSaved(provider, result, `Saved to ${provider.label}: ${result.file.name}`);
      return true;
    } catch (err) {
      this.notify.error(`Could not save to ${this.providerLabel(binding.providerId)}: ${errorText(err)}`);
      return false;
    } finally {
      this.saving.delete(tabId);
    }
  }

  /** True when signed in to `provider`, asking the user (dialog + provider sign-in) when not. */
  private async ensureSignedIn(provider: StorageProvider, why: string): Promise<boolean> {
    if (provider.getAccount()) return true;
    return this.ui.askSignIn(provider, why);
  }

  /**
   * Runs a provider call; when it fails because the session ended meanwhile (the provider has no
   * account any more: GitLab refresh token expired, ...), asks to sign in and runs it once more.
   */
  private async withSignIn<T>(provider: StorageProvider, why: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (provider.getAccount() || !(await this.ui.askSignIn(provider, why))) throw err;
      return run();
    }
  }

  /** The active tab's id when `tabId` is not given. */
  private resolveTab(tabId?: string): { tab: RemoteTab; binding: RemoteFileInfo } | null {
    const tab = tabId ? this.host.getAllTabs().find((t) => t.id === tabId) : this.host.getActiveTab();
    const binding = tab ? this.getBinding(tab.id) : null;
    return tab && binding ? { tab, binding } : null;
  }

  /**
   * "Reload from <provider>": replaces the tab's content with the file's current remote version
   * (after a confirm; local changes are discarded). The binding is verified and clean afterwards.
   */
  async reloadFromRemote(tabId?: string): Promise<boolean> {
    const target = this.resolveTab(tabId);
    if (!target) return false;
    const { tab, binding } = target;
    const label = this.providerLabel(binding.providerId);
    const dirty = this.checkDirty(tab.id);
    const confirmed = await this.ui.confirm({
      title: `Reload from ${label}`,
      message: dirty
        ? `Discard the changes in "${tab.name}" and load "${binding.name}" again from ${label}? Changes not saved to ${label} are lost.`
        : `Load "${binding.name}" again from ${label}? The tab shows the latest version of the file.`,
      confirmLabel: dirty ? 'Discard changes and reload' : 'Reload',
      danger: dirty,
    });
    if (!confirmed) return false;
    const provider = await this.provider(binding.providerId);
    if (!provider) return false;
    if (!provider.reopen) {
      this.notify.warning(`${label} cannot reload a file here; open it again with File > Open from ${label}….`);
      return false;
    }
    const why = `Sign in to ${provider.label} to reload "${binding.name}".`;
    if (!(await this.ensureSignedIn(provider, why))) {
      this.notify.info(`Not reloaded: ${provider.label} needs a sign-in.`);
      return false;
    }
    let content: RemoteFileContent;
    try {
      content = await this.withSignIn(provider, why, () => provider.reopen!(binding));
    } catch (err) {
      this.notify.error(`Could not reload "${binding.name}" from ${provider.label}: ${errorText(err)}`);
      return false;
    }
    if (this.getBinding(tab.id) !== binding) return false; // unlinked/closed meanwhile
    try {
      await tab.saveLoadController.loadProjectXml(content.xml, content.name, { quiet: true });
    } catch {
      // loadProjectXml already told the user why; the diagram is unchanged
      return false;
    }
    this.bind(tab, withoutXml(content));
    tab.saveLoadController.markAsSavedToDisk?.(provider.label);
    this.notify.success(`Reloaded "${content.name}" from ${provider.label}.`);
    return true;
  }

  /** "Unlink from <provider>": the tab keeps its content, Ctrl+S downloads again. */
  unlink(tabId?: string): boolean {
    const target = this.resolveTab(tabId);
    if (!target) return false;
    const label = this.providerLabel(target.binding.providerId);
    this.unbind(target.tab.id);
    this.notify.info(
      `"${target.tab.name}" is no longer linked to ${label} (${target.binding.location}). Ctrl+S downloads it; File > Save to ${label}… stores it there again.`
    );
    return true;
  }

  /** Success message (+ the provider's note), and the result link (merge request) in a dialog. */
  private reportSaved(provider: StorageProvider, result: SaveResult, message: string): void {
    if (!result.ok) return;
    this.notify.success(result.note ? `${message}. ${result.note}` : message);
    if (result.link) void this.ui.showLink(`Saved to ${provider.label}`, result.note ?? message, result.link);
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

  /**
   * Startup (and after provider settings change): opens files of incoming provider links
   * (`?gitlab=…`), asking to sign in first when needed. Resolves with the number of files opened.
   */
  async openIncomingLinks(): Promise<number> {
    let opened = 0;
    for (const descriptor of this.providers) {
      const link = descriptor.incomingLink?.();
      if (!link) continue;
      const availability = descriptor.availability();
      if (availability.state !== 'ready') {
        if (availability.state === 'not-configured') {
          // kept: it opens once the provider is set up (Share > settings)
          this.notify.warning(
            `This link opens "${link.label}" from ${descriptor.label}, but ${descriptor.label} is not set up in this browser. ` +
              `Enter its settings under Share > ${descriptor.label}; the file opens afterwards.`
          );
        } else {
          descriptor.clearIncomingLink?.();
          this.notify.warning(`Could not open "${link.label}": ${descriptor.label}: ${availability.reason}`);
        }
        continue;
      }
      const provider = await this.provider(descriptor.id);
      if (!provider?.openRef) {
        descriptor.clearIncomingLink?.();
        continue;
      }
      const prompt = `Sign in to ${provider.label} to open "${link.label}". You need access to the project.`;
      if (!provider.getAccount() && !(await this.ui.askSignIn(provider, prompt))) {
        descriptor.clearIncomingLink?.();
        this.notify.info(`Not opened: "${link.label}" needs a ${provider.label} sign-in.`);
        continue;
      }
      let content: RemoteFileContent | null = null;
      try {
        content = await provider.openRef(link.ref);
      } catch (err) {
        // The stored session may have expired meanwhile: one more sign-in, then retry
        if (!provider.getAccount() && (await this.ui.askSignIn(provider, prompt))) {
          content = await provider.openRef(link.ref).catch((again: unknown) => {
            this.notify.error(`Could not open "${link.label}" from ${provider.label}: ${errorText(again)}`);
            return null;
          });
        } else {
          this.notify.error(`Could not open "${link.label}" from ${provider.label}: ${errorText(err)}`);
        }
      }
      descriptor.clearIncomingLink?.();
      if (content && (await this.openContent(provider, content))) opened++;
    }
    return opened;
  }
}
