/**
 * @file sharepoint-provider.ts
 * @brief SharePoint / OneDrive for Business as a StorageProvider (Microsoft Graph v1.0).
 *
 * Browse levels: top level (OneDrive "My files", the configured default site, followed sites, or
 * site search results) -> document libraries of a site -> folders -> files.
 * Files are addressed by driveId + itemId; the eTag is the version used for conflict detection.
 */
import type {
  BrowseEntry,
  BrowseListing,
  ConflictBehavior,
  RemoteAccount,
  RemoteFileContent,
  RemoteFileInfo,
  SaveResult,
  ShareLinkCapability,
  ShareLinkOptions,
  ShareLinkResult,
  StorageProvider,
} from '../types';
import { GraphClient, GraphConflictError, GraphError } from './graph-client';
import type { GraphDriveItem, GraphSite } from './graph-client';

export const SHAREPOINT_PROVIDER_ID = 'sharepoint';

/** What the provider needs from the sign-in layer (MsalAuth in production). */
export interface SharePointAuth {
  account(): { name?: string; username?: string } | null;
  signIn(): Promise<{ name?: string; username?: string }>;
  signOut(): Promise<void>;
}

export interface SharePointProviderOptions {
  client: GraphClient;
  auth: SharePointAuth;
  /** `hostname:/sites/Name`, listed first. */
  defaultSite?: string | null;
}

/** Provider data stored in BrowseEntry.data. */
type EntryData =
  | { t: 'site'; siteId: string }
  | { t: 'mydrive' }
  | { t: 'drive'; driveId: string }
  | { t: 'folder'; driveId: string; itemId: string }
  | { t: 'file'; driveId: string; itemId: string };

/** RemoteFileInfo.ref */
export interface SharePointFileRef {
  driveId: string;
  itemId: string;
}

function data(entry: BrowseEntry | undefined): EntryData | null {
  const d = entry?.data as EntryData | undefined;
  return d && typeof d === 'object' && typeof d.t === 'string' ? d : null;
}

function siteEntry(site: GraphSite): BrowseEntry {
  return {
    kind: 'container',
    id: `site:${site.id}`,
    name: site.displayName || site.name || site.webUrl || site.id,
    detail: site.webUrl,
    data: { t: 'site', siteId: site.id } satisfies EntryData,
  };
}

function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function locationLabel(path: BrowseEntry[]): string {
  return path.map((entry) => entry.name).join(' › ');
}

function isFileRef(ref: unknown): ref is SharePointFileRef {
  const r = ref as SharePointFileRef | null;
  return !!r && typeof r.driveId === 'string' && typeof r.itemId === 'string';
}

export class SharePointProvider implements StorageProvider {
  readonly id = SHAREPOINT_PROVIDER_ID;
  readonly label = 'SharePoint';
  readonly openExtensions = ['.drawio', '.xml', '.railwaydrawer'];
  readonly shareLinks: ShareLinkCapability = {
    types: [
      { id: 'view', label: 'Can view' },
      { id: 'edit', label: 'Can edit' },
    ],
    audiences: [
      { id: 'organization', label: 'People in your organization' },
      { id: 'users', label: 'Specific people', needsRecipients: true, hint: 'They get an e-mail invitation.' },
      { id: 'anonymous', label: 'Anyone with the link', hint: 'Only if your organization allows it.' },
    ],
  };

  private readonly client: GraphClient;
  private readonly auth: SharePointAuth;
  private readonly defaultSite: string | null;
  private myDriveId: string | null = null;

  constructor(opts: SharePointProviderOptions) {
    this.client = opts.client;
    this.auth = opts.auth;
    this.defaultSite = opts.defaultSite ?? null;
  }

  getAccount(): RemoteAccount | null {
    const account = this.auth.account();
    return account ? { name: account.name || account.username || 'Microsoft account', username: account.username } : null;
  }

  async signIn(): Promise<RemoteAccount> {
    const account = await this.auth.signIn();
    return { name: account.name || account.username || 'Microsoft account', username: account.username };
  }

  signOut(): Promise<void> {
    this.myDriveId = null;
    return this.auth.signOut();
  }

  async list(path: BrowseEntry[], opts: { search?: string } = {}): Promise<BrowseListing> {
    const last = data(path[path.length - 1]);
    if (!last) return this.listTop(opts.search?.trim() ?? '');
    switch (last.t) {
      case 'site': {
        const drives = await this.client.listDrives(last.siteId);
        return {
          heading: 'Document libraries',
          entries: drives.map((drive) => ({
            kind: 'container',
            id: `drive:${drive.id}`,
            name: drive.name,
            detail: drive.webUrl,
            data: { t: 'drive', driveId: drive.id } satisfies EntryData,
          })),
        };
      }
      case 'mydrive':
        return this.listFolder(await this.resolveMyDrive(), 'root');
      case 'drive':
        return this.listFolder(last.driveId, 'root');
      case 'folder':
        return this.listFolder(last.driveId, last.itemId);
      default:
        return { entries: [] };
    }
  }

  private async listTop(search: string): Promise<BrowseListing> {
    const base = { searchable: true, searchPlaceholder: 'Search SharePoint sites' };
    if (search) {
      const sites = await this.client.searchSites(search);
      return { ...base, heading: `Sites matching "${search}"`, entries: sites.map(siteEntry) };
    }
    const entries: BrowseEntry[] = [
      { kind: 'container', id: 'mydrive', name: 'My files (OneDrive)', data: { t: 'mydrive' } satisfies EntryData },
    ];
    const seen = new Set<string>();
    if (this.defaultSite) {
      try {
        const site = await this.client.getSiteByPath(this.defaultSite);
        seen.add(site.id);
        entries.push(siteEntry(site));
      } catch (err) {
        console.warn('[SharePoint] Default site not reachable:', this.defaultSite, err);
      }
    }
    const followed = await this.client.followedSites();
    for (const site of followed) {
      if (!seen.has(site.id)) {
        seen.add(site.id);
        entries.push(siteEntry(site));
      }
    }
    return { ...base, heading: 'Your files, the default site and followed sites', entries };
  }

  private async resolveMyDrive(): Promise<string> {
    if (!this.myDriveId) this.myDriveId = (await this.client.getMyDrive()).id;
    return this.myDriveId;
  }

  private async listFolder(driveId: string, itemId: string): Promise<BrowseListing> {
    const children = await this.client.listChildren(driveId, itemId);
    const folders = children.filter((item) => item.folder);
    const files = children.filter((item) => item.file && this.isOpenable(item.name));
    const byName = (a: GraphDriveItem, b: GraphDriveItem): number => a.name.localeCompare(b.name);
    return {
      entries: [
        ...folders.sort(byName).map(
          (item): BrowseEntry => ({
            kind: 'folder',
            id: `folder:${item.id}`,
            name: item.name,
            data: { t: 'folder', driveId, itemId: item.id } satisfies EntryData,
          })
        ),
        ...files.sort(byName).map(
          (item): BrowseEntry => ({
            kind: 'file',
            id: `file:${item.id}`,
            name: item.name,
            detail: [
              item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).toLocaleString() : '',
              formatSize(item.size),
            ]
              .filter(Boolean)
              .join(' · '),
            data: { t: 'file', driveId, itemId: item.id } satisfies EntryData,
          })
        ),
      ],
    };
  }

  private isOpenable(name: string): boolean {
    const lower = name.toLowerCase();
    return this.openExtensions.some((ext) => lower.endsWith(ext));
  }

  canSaveAt(path: BrowseEntry[]): boolean {
    const last = data(path[path.length - 1]);
    return !!last && (last.t === 'mydrive' || last.t === 'drive' || last.t === 'folder');
  }

  private async resolveFolder(path: BrowseEntry[]): Promise<SharePointFileRef> {
    const last = data(path[path.length - 1]);
    if (last?.t === 'mydrive') return { driveId: await this.resolveMyDrive(), itemId: 'root' };
    if (last?.t === 'drive') return { driveId: last.driveId, itemId: 'root' };
    if (last?.t === 'folder') return { driveId: last.driveId, itemId: last.itemId };
    throw new Error('Choose a document library or folder first');
  }

  private toInfo(item: GraphDriveItem, driveId: string, parentPath: BrowseEntry[]): RemoteFileInfo {
    return {
      providerId: this.id,
      ref: { driveId, itemId: item.id } satisfies SharePointFileRef,
      version: item.eTag ?? '',
      name: item.name,
      location: locationLabel([...parentPath, { kind: 'file', id: item.id, name: item.name, data: null }]),
      webUrl: item.webUrl,
      parentPath,
    };
  }

  async open(path: BrowseEntry[], file: BrowseEntry): Promise<RemoteFileContent> {
    const d = data(file);
    if (d?.t !== 'file') throw new Error('Not a file');
    const { item, text } = await this.client.downloadText(d.driveId, d.itemId);
    return { ...this.toInfo(item, d.driveId, path), xml: text };
  }

  /** "Reload from SharePoint": the bound item's current content and eTag. */
  async reopen(file: RemoteFileInfo): Promise<RemoteFileContent> {
    if (!isFileRef(file.ref)) throw new Error('Invalid SharePoint file reference');
    const { item, text } = await this.client.downloadText(file.ref.driveId, file.ref.itemId);
    return { ...this.toInfo(item, file.ref.driveId, file.parentPath), xml: text };
  }

  async save(file: RemoteFileInfo, xml: string, expectedVersion: string | null): Promise<SaveResult> {
    if (!isFileRef(file.ref)) throw new Error('Invalid SharePoint file reference');
    const { driveId, itemId } = file.ref;
    try {
      const item = await this.client.replaceContent(driveId, itemId, this.blob(xml), expectedVersion);
      return { ok: true, file: this.toInfo(item, driveId, file.parentPath) };
    } catch (err) {
      if (err instanceof GraphConflictError) {
        return {
          ok: false,
          reason: 'conflict',
          message: `"${file.name}" was changed in SharePoint since you opened or last saved it.`,
        };
      }
      throw err;
    }
  }

  async saveAs(path: BrowseEntry[], name: string, xml: string, conflict: ConflictBehavior): Promise<SaveResult> {
    const folder = await this.resolveFolder(path);
    try {
      const item = await this.client.uploadNew(folder.driveId, folder.itemId, name, this.blob(xml), conflict);
      return { ok: true, file: this.toInfo(item, folder.driveId, path) };
    } catch (err) {
      if (err instanceof GraphConflictError) {
        return { ok: false, reason: 'exists', message: `A file named "${name}" already exists in this folder.` };
      }
      throw err;
    }
  }

  async createShareLink(file: RemoteFileInfo, options: ShareLinkOptions): Promise<ShareLinkResult> {
    if (!isFileRef(file.ref)) throw new Error('Invalid SharePoint file reference');
    const { driveId, itemId } = file.ref;
    const type = options.type === 'edit' ? 'edit' : 'view';
    try {
      if (options.audience === 'users') {
        const emails = (options.recipients ?? []).map((e) => e.trim()).filter(Boolean);
        if (emails.length === 0) throw new Error('Enter at least one e-mail address');
        const permissions = await this.client.invite(driveId, itemId, emails, type === 'edit' ? 'write' : 'read', options.message);
        const url = permissions.find((p) => p.link?.webUrl)?.link?.webUrl ?? file.webUrl ?? '';
        return {
          url,
          note: `Invitation sent to ${emails.length === 1 ? emails[0] : `${emails.length} people`}; only they can open the link.`,
        };
      }
      const scope = options.audience === 'anonymous' ? 'anonymous' : 'organization';
      const permission = await this.client.createLink(driveId, itemId, type, scope);
      const url = permission.link?.webUrl;
      if (!url) throw new Error('SharePoint did not return a link');
      return { url };
    } catch (err) {
      if (err instanceof GraphError && (err.status === 403 || err.code === 'accessDenied' || err.code === 'notAllowed')) {
        throw new Error(
          options.audience === 'anonymous'
            ? 'Your organization does not allow "Anyone with the link" sharing. Choose "People in your organization" or "Specific people".'
            : `SharePoint refused to share "${file.name}" (${err.message}). You may not have permission to share it.`
        );
      }
      throw err;
    }
  }

  private blob(xml: string): Blob {
    return new Blob([xml], { type: 'application/xml' });
  }
}
