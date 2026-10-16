/**
 * @file types.ts
 * @brief Cloud storage provider abstraction (SharePoint/OneDrive, GitLab).
 *
 * Two layers, so an unconfigured provider costs nothing:
 * - `StorageProviderDescriptor` lives in the main bundle: id, label, availability (configured?
 *   https?) and `load()`, a dynamic import of the real provider (auth library, API client).
 * - `StorageProvider` is the loaded implementation: account, browsing, open/save/save-as and the
 *   optional sharing-link capability.
 *
 * The UI (Share dialog, Open from/Save to dialogs, Ctrl+S save-back, status bar) only uses these
 * types; nothing provider-specific is imported outside `providers/<id>/`.
 */

/** Whether a provider can be used on this deployment. */
export type ProviderAvailability =
  | { state: 'ready' }
  /** Build-time configuration missing (e.g. no Entra app registration yet). */
  | { state: 'not-configured'; reason: string; helpUrl?: string }
  /** Configured, but not usable here (e.g. plain http). */
  | { state: 'unavailable'; reason: string; helpUrl?: string };

export interface RemoteAccount {
  /** Display name. */
  name: string;
  /** Sign-in name / e-mail, when known. */
  username?: string;
}

/**
 * One entry of a browse listing. A location is the path of entries from the top level
 * (`[]` = top level), e.g. SharePoint: [site, library, folder, ...].
 * `data` is provider-specific and must be JSON-serializable.
 */
export interface BrowseEntry {
  kind: 'container' | 'folder' | 'file';
  /** Unique among its siblings. */
  id: string;
  name: string;
  /** Secondary line (URL, modified date, size, ...). */
  detail?: string;
  data: unknown;
}

export interface BrowseListing {
  entries: BrowseEntry[];
  /** The provider supports `search` at this level (e.g. SharePoint site search at the top). */
  searchable?: boolean;
  /** Placeholder of the search box. */
  searchPlaceholder?: string;
  /** Shown above the list (e.g. "Followed sites"). */
  heading?: string;
}

/** A file in a provider, as remembered per tab for saving back. */
export interface RemoteFileInfo {
  providerId: string;
  /** Provider-specific, JSON-serializable address of the file (SharePoint: driveId + itemId). */
  ref: unknown;
  /** Version token for conflict detection (SharePoint: eTag; GitLab: last commit/blob id). */
  version: string;
  /** File name ("Station.drawio"). */
  name: string;
  /** Human-readable location ("Site › Library › Folder"), for the status bar. */
  location: string;
  /** Where the file can be opened in the browser, when known. */
  webUrl?: string;
  /** The folder the file is in, for "save as copy" next to it. */
  parentPath: BrowseEntry[];
}

export interface RemoteFileContent extends RemoteFileInfo {
  xml: string;
}

/** What to do when a file of that name already exists (Save to …). */
export type ConflictBehavior = 'fail' | 'replace' | 'rename';

/** Something the user can open after a save (e.g. a GitLab merge request). */
export interface ResultLink {
  url: string;
  label: string;
}

export type SaveResult =
  | {
      ok: true;
      file: RemoteFileInfo;
      /** Extra information ("Merge request !12 created"). */
      note?: string;
      link?: ResultLink;
    }
  /** The file changed remotely (version mismatch) or the name exists with `conflict: 'fail'`. */
  | { ok: false; reason: 'conflict' | 'exists'; message: string };

export interface ShareLinkAudienceOption {
  id: string;
  label: string;
  /** Needs recipients (e-mail addresses). */
  needsRecipients?: boolean;
  hint?: string;
}

export interface ShareLinkCapability {
  /** Link permission kinds, e.g. view / edit. */
  types: Array<{ id: string; label: string }>;
  audiences: ShareLinkAudienceOption[];
  /** Legend of the `types` group (default "People with the link"). */
  typesLegend?: string;
  /** Legend of the `audiences` group (default "Who"). */
  audiencesLegend?: string;
}

/**
 * An extra input of a save (commit message, new branch, "create merge request"). Providers
 * without such options (SharePoint) return none and no dialog is shown.
 */
export interface SaveField {
  id: string;
  label: string;
  kind: 'text' | 'checkbox';
  /** Initial value. */
  value?: string | boolean;
  placeholder?: string;
  hint?: string;
}

export type SaveFieldValues = Record<string, string | boolean>;

export type SaveFieldContext =
  /** Ctrl+S back to a bound file. */
  | { kind: 'save'; file: RemoteFileInfo }
  /** "Save to …" into the folder `path` (called again whenever the dialog's location changes). */
  | { kind: 'saveAs'; path: BrowseEntry[] };

/** A provider-specific answer to a save conflict, besides Overwrite / Save as copy / Cancel. */
export interface ConflictAction {
  id: string;
  label: string;
  hint?: string;
  /** Asked before `resolveConflict` runs. */
  fields?: SaveField[];
}

/** A file referenced by a link the app was opened with (e.g. `?gitlab=group/project:main:a.drawio`). */
export interface IncomingLink {
  /** Passed to `StorageProvider.openRef`. */
  ref: unknown;
  /** For messages ("group/project › main › a.drawio"). */
  label: string;
}

/** A runtime setting of a provider (stored in the browser), shown in the Share dialog. */
export interface ProviderSettingField {
  id: string;
  label: string;
  kind: 'text' | 'checkbox';
  placeholder?: string;
  hint?: string;
}

export interface ProviderSettings {
  fields: ProviderSettingField[];
  /** Current values (runtime overrides, else the build-time defaults). */
  values(): SaveFieldValues;
  /** Validates and stores; throws an Error with a user-facing message when invalid. */
  save(values: SaveFieldValues): void;
  /** Forgets the runtime overrides (back to the build-time defaults). */
  reset(): void;
  /** Shown under the fields (e.g. the redirect URI to register). */
  hint?(): string;
}

export interface ShareLinkOptions {
  type: string;
  audience: string;
  recipients?: string[];
  message?: string;
}

export interface ShareLinkResult {
  url: string;
  /** Extra information for the user ("Invitation sent to 2 people"). */
  note?: string;
}

/** A loaded provider. */
export interface StorageProvider {
  readonly id: string;
  readonly label: string;
  /** File name extensions that can be opened (lower case, with dot). */
  readonly openExtensions: string[];
  getAccount(): RemoteAccount | null;
  signIn(): Promise<RemoteAccount>;
  signOut(): Promise<void>;
  /** Entries at `path` (`[]` = top level). `search` only where the listing is `searchable`. */
  list(path: BrowseEntry[], opts?: { search?: string }): Promise<BrowseListing>;
  /** Whether a file can be created at `path` (e.g. inside a library, not in the site list). */
  canSaveAt(path: BrowseEntry[]): boolean;
  open(path: BrowseEntry[], file: BrowseEntry): Promise<RemoteFileContent>;
  /**
   * Saves back to `file`; `expectedVersion` null overwrites whatever is there. `values` are the
   * answers to `saveFields({ kind: 'save' })`, when the provider has any.
   */
  save(file: RemoteFileInfo, xml: string, expectedVersion: string | null, values?: SaveFieldValues): Promise<SaveResult>;
  saveAs(path: BrowseEntry[], name: string, xml: string, conflict: ConflictBehavior, values?: SaveFieldValues): Promise<SaveResult>;
  /** Optional: extra inputs of a save (none = no extra dialog). */
  saveFields?(context: SaveFieldContext): SaveField[];
  /** Optional: extra answers to a save conflict (e.g. GitLab "Save to new branch"). */
  conflictActions?(file: RemoteFileInfo): ConflictAction[];
  resolveConflict?(file: RemoteFileInfo, xml: string, actionId: string, values: SaveFieldValues): Promise<SaveResult>;
  /** Optional: opens the file of an `IncomingLink`. */
  openRef?(ref: unknown): Promise<RemoteFileContent>;
  /**
   * Optional: reads a bound file again by its `RemoteFileInfo` (ref), e.g. for "Reload from
   * <provider>" after a page reload, when no browse entry of it exists.
   */
  reopen?(file: RemoteFileInfo): Promise<RemoteFileContent>;
  /** Optional: sharing links / invitations. */
  readonly shareLinks?: ShareLinkCapability;
  createShareLink?(file: RemoteFileInfo, options: ShareLinkOptions): Promise<ShareLinkResult>;
}

/** The cheap, always-loaded part of a provider. */
export interface StorageProviderDescriptor {
  readonly id: string;
  readonly label: string;
  /** One line for the Share dialog ("Save, open and share .drawio files in SharePoint and OneDrive"). */
  readonly description: string;
  availability(): ProviderAvailability;
  /** Loads the implementation (dynamic import); only called when available and used. */
  load(): Promise<StorageProvider>;
  /**
   * Called once at startup when available: finishes a sign-in that left the page (redirect
   * flow). Returns the provider when such a sign-in was pending, so the UI can confirm it.
   */
  resumePendingSignIn?(): Promise<StorageProvider | null>;
  /** Optional: settings the user can change at runtime (Share dialog), e.g. the GitLab URL. */
  readonly settings?: ProviderSettings;
  /** Optional: a file link the app was started with, still to be opened. */
  incomingLink?(): IncomingLink | null;
  clearIncomingLink?(): void;
}
