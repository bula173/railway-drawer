/**
 * @file types.ts
 * @brief Cloud storage provider abstraction (SharePoint/OneDrive now, GitLab next).
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

export type SaveResult =
  | { ok: true; file: RemoteFileInfo }
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
  /** Saves back to `file`; `expectedVersion` null overwrites whatever is there. */
  save(file: RemoteFileInfo, xml: string, expectedVersion: string | null): Promise<SaveResult>;
  saveAs(path: BrowseEntry[], name: string, xml: string, conflict: ConflictBehavior): Promise<SaveResult>;
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
}
