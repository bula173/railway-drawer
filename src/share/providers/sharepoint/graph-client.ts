/**
 * @file graph-client.ts
 * @brief Small typed Microsoft Graph v1.0 REST client for SharePoint / OneDrive files (fetch only,
 *        no Graph SDK). Tokens come from an injected provider (MSAL in production, a stub in tests).
 *
 * Scopes (delegated, requested incrementally per call):
 * - Sites.Read.All: site search, followed sites, document libraries, folder listings.
 * - Files.ReadWrite.All: file content, upload, save back, sharing links and invitations.
 */

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
export const SCOPE_SITES_READ = 'Sites.Read.All';
export const SCOPE_FILES_READWRITE = 'Files.ReadWrite.All';

/** Files up to this size are uploaded with one PUT; larger ones through an upload session. */
export const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;
/** Upload session fragment size: a multiple of 320 KiB, as Graph requires. */
export const UPLOAD_CHUNK_SIZE = 320 * 1024 * 10;
/** Largest file opened from SharePoint. */
export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
/** Safety cap on followed @odata.nextLink pages. */
const MAX_PAGES = 50;
const MAX_RETRIES = 2;

export type TokenProvider = (scopes: string[]) => Promise<string>;

export interface GraphSite {
  id: string;
  name?: string;
  displayName?: string;
  webUrl?: string;
}

export interface GraphDrive {
  id: string;
  name: string;
  driveType?: string;
  webUrl?: string;
}

export interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  eTag?: string;
  cTag?: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  parentReference?: { driveId?: string; id?: string; path?: string };
}

export interface GraphPermission {
  id: string;
  roles?: string[];
  link?: { type?: string; scope?: string; webUrl?: string };
  grantedToIdentitiesV2?: unknown[];
}

export type GraphConflictBehavior = 'fail' | 'replace' | 'rename';
export type GraphLinkType = 'view' | 'edit';
export type GraphLinkScope = 'organization' | 'anonymous' | 'users';

/** A Graph error response (`{ error: { code, message } }`) or a network failure. */
export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = ''
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

/** 412 (eTag mismatch) or 409 (name exists with conflictBehavior=fail). */
export class GraphConflictError extends GraphError {
  constructor(message: string, status: number, code = '') {
    super(message, status, code);
    this.name = 'GraphConflictError';
  }
}

export interface GraphClientOptions {
  getToken: TokenProvider;
  fetch?: typeof fetch;
  baseUrl?: string;
  /** Waits before a retry (tests replace it). */
  sleep?: (ms: number) => Promise<void>;
}

interface RequestOptions {
  method?: string;
  scopes: string[];
  body?: BodyInit | null;
  json?: unknown;
  headers?: Record<string, string>;
  /** Absolute URL (nextLink, upload URL); default = baseUrl + path. */
  absolute?: boolean;
  /** No Authorization header (pre-authenticated upload URLs must not get one). */
  anonymous?: boolean;
}

/** Path segment for `/items/{parent}:/{name}:`: each segment URI-encoded. */
export function encodeItemPath(name: string): string {
  return name
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export class GraphClient {
  private readonly getToken: TokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: GraphClientOptions) {
    this.getToken = opts.getToken;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.baseUrl = opts.baseUrl ?? GRAPH_BASE_URL;
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  // ---------------------------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------------------------

  private async request(path: string, opts: RequestOptions): Promise<Response> {
    const url = opts.absolute ? path : `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (!opts.anonymous) headers.Authorization = `Bearer ${await this.getToken(opts.scopes)}`;
    let body = opts.body ?? null;
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, { method: opts.method ?? 'GET', headers, body });
      } catch (err) {
        throw new GraphError(
          `Could not reach Microsoft Graph (${err instanceof Error ? err.message : String(err)})`,
          0,
          'networkError'
        );
      }
      // Throttling / transient: honour Retry-After (capped), a couple of times
      if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        await this.sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000, 10_000));
        continue;
      }
      if (!res.ok) throw await GraphClient.toError(res);
      return res;
    }
  }

  private static async toError(res: Response): Promise<GraphError> {
    let code = '';
    let message = '';
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } };
      code = data.error?.code ?? '';
      message = data.error?.message ?? '';
    } catch {
      // not JSON
    }
    const text = message || `${res.status} ${res.statusText || 'error'}`;
    if (res.status === 412 || res.status === 409) return new GraphConflictError(text, res.status, code);
    return new GraphError(text, res.status, code);
  }

  private async getJson<T>(path: string, scopes: string[], absolute = false): Promise<T> {
    const res = await this.request(path, { scopes, absolute });
    return (await res.json()) as T;
  }

  /** GET a collection and follow @odata.nextLink. */
  async getAll<T>(path: string, scopes: string[]): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = path;
    let absolute = false;
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const data: { value?: T[]; '@odata.nextLink'?: string } = await this.getJson(next, scopes, absolute);
      out.push(...(data.value ?? []));
      next = data['@odata.nextLink'];
      absolute = true;
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------
  // Sites, drives, folders
  // ---------------------------------------------------------------------------------------

  searchSites(query: string): Promise<GraphSite[]> {
    return this.getAll<GraphSite>(
      `/sites?search=${encodeURIComponent(query)}&$select=id,name,displayName,webUrl`,
      [SCOPE_SITES_READ]
    );
  }

  followedSites(): Promise<GraphSite[]> {
    return this.getAll<GraphSite>('/me/followedSites?$select=id,name,displayName,webUrl', [SCOPE_SITES_READ]);
  }

  /** `contoso.sharepoint.com:/sites/Rail` */
  getSiteByPath(spec: string): Promise<GraphSite> {
    const [host, ...rest] = spec.split(':');
    const sitePath = rest.join(':');
    return this.getJson<GraphSite>(
      `/sites/${encodeURIComponent(host)}:${encodeItemPath(sitePath)}?$select=id,name,displayName,webUrl`,
      [SCOPE_SITES_READ]
    );
  }

  listDrives(siteId: string): Promise<GraphDrive[]> {
    return this.getAll<GraphDrive>(
      `/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,driveType,webUrl`,
      [SCOPE_SITES_READ]
    );
  }

  /** The signed-in user's OneDrive. */
  getMyDrive(): Promise<GraphDrive> {
    return this.getJson<GraphDrive>('/me/drive?$select=id,name,driveType,webUrl', [SCOPE_FILES_READWRITE]);
  }

  listChildren(driveId: string, itemId: string = 'root'): Promise<GraphDriveItem[]> {
    return this.getAll<GraphDriveItem>(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children` +
        '?$top=200&$select=id,name,size,eTag,webUrl,lastModifiedDateTime,file,folder,parentReference',
      [SCOPE_SITES_READ]
    );
  }

  getItem(driveId: string, itemId: string): Promise<GraphDriveItem> {
    return this.getJson<GraphDriveItem>(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}` +
        '?$select=id,name,size,eTag,webUrl,lastModifiedDateTime,file,folder,parentReference',
      [SCOPE_FILES_READWRITE]
    );
  }

  // ---------------------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------------------

  /** File metadata (with the eTag the text belongs to) and its text. */
  async downloadText(driveId: string, itemId: string): Promise<{ item: GraphDriveItem; text: string }> {
    const item = await this.getItem(driveId, itemId);
    if (item.folder) throw new GraphError(`"${item.name}" is a folder`, 400, 'notAFile');
    if ((item.size ?? 0) > MAX_DOWNLOAD_BYTES) {
      throw new GraphError(`"${item.name}" is too large to open (over ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB)`, 413);
    }
    const res = await this.request(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
      { scopes: [SCOPE_FILES_READWRITE] }
    );
    return { item, text: await res.text() };
  }

  /**
   * Creates (or, with `replace`, overwrites) `name` in folder `parentId`.
   * `fail` + existing name -> GraphConflictError (409).
   */
  uploadNew(
    driveId: string,
    parentId: string,
    name: string,
    content: Blob,
    conflict: GraphConflictBehavior
  ): Promise<GraphDriveItem> {
    const itemPath = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}:/${encodeItemPath(name)}:`;
    if (content.size <= SIMPLE_UPLOAD_LIMIT) {
      return this.putContent(
        `${itemPath}/content?@microsoft.graph.conflictBehavior=${conflict}`,
        content,
        null
      );
    }
    return this.uploadLarge(`${itemPath}/createUploadSession`, content, null, {
      item: { '@microsoft.graph.conflictBehavior': conflict, name },
    });
  }

  /**
   * Overwrites an existing file. With `eTag`, Graph answers 412 when the file changed since
   * (thrown as GraphConflictError); null overwrites unconditionally.
   */
  replaceContent(driveId: string, itemId: string, content: Blob, eTag: string | null): Promise<GraphDriveItem> {
    const itemPath = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
    if (content.size <= SIMPLE_UPLOAD_LIMIT) {
      return this.putContent(`${itemPath}/content`, content, eTag);
    }
    return this.uploadLarge(`${itemPath}/createUploadSession`, content, eTag, {
      item: { '@microsoft.graph.conflictBehavior': 'replace' },
    });
  }

  private async putContent(path: string, content: Blob, eTag: string | null): Promise<GraphDriveItem> {
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
    if (eTag) headers['If-Match'] = eTag;
    const res = await this.request(path, { method: 'PUT', scopes: [SCOPE_FILES_READWRITE], body: content, headers });
    return (await res.json()) as GraphDriveItem;
  }

  private async uploadLarge(
    sessionPath: string,
    content: Blob,
    eTag: string | null,
    body: unknown
  ): Promise<GraphDriveItem> {
    const headers: Record<string, string> = {};
    if (eTag) headers['If-Match'] = eTag;
    const sessionRes = await this.request(sessionPath, {
      method: 'POST',
      scopes: [SCOPE_FILES_READWRITE],
      json: body,
      headers,
    });
    const session = (await sessionRes.json()) as { uploadUrl?: string };
    if (!session.uploadUrl) throw new GraphError('Graph did not return an upload URL', 500, 'noUploadUrl');
    const total = content.size;
    let item: GraphDriveItem | null = null;
    try {
      for (let start = 0; start < total; start += UPLOAD_CHUNK_SIZE) {
        const end = Math.min(start + UPLOAD_CHUNK_SIZE, total);
        // The upload URL is pre-authenticated: no Authorization header
        const res = await this.request(session.uploadUrl, {
          method: 'PUT',
          scopes: [],
          absolute: true,
          anonymous: true,
          body: content.slice(start, end),
          headers: { 'Content-Range': `bytes ${start}-${end - 1}/${total}` },
        });
        if (res.status === 200 || res.status === 201) item = (await res.json()) as GraphDriveItem;
      }
    } catch (err) {
      // Release the session; the error is what the caller needs
      this.request(session.uploadUrl, { method: 'DELETE', scopes: [], absolute: true, anonymous: true }).catch(
        () => undefined
      );
      throw err;
    }
    if (!item) throw new GraphError('The upload did not complete', 500, 'uploadIncomplete');
    return item;
  }

  // ---------------------------------------------------------------------------------------
  // Sharing
  // ---------------------------------------------------------------------------------------

  /** Sharing link (`scope: anonymous` only works when the tenant allows "Anyone" links). */
  async createLink(driveId: string, itemId: string, type: GraphLinkType, scope: 'organization' | 'anonymous'): Promise<GraphPermission> {
    const res = await this.request(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/createLink`,
      { method: 'POST', scopes: [SCOPE_FILES_READWRITE], json: { type, scope } }
    );
    return (await res.json()) as GraphPermission;
  }

  /** Grants specific people access (sends them an invitation). */
  invite(
    driveId: string,
    itemId: string,
    emails: string[],
    role: 'read' | 'write',
    message?: string
  ): Promise<GraphPermission[]> {
    return this.request(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/invite`, {
      method: 'POST',
      scopes: [SCOPE_FILES_READWRITE],
      json: {
        recipients: emails.map((email) => ({ email })),
        roles: [role],
        requireSignIn: true,
        sendInvitation: true,
        ...(message ? { message } : {}),
      },
    })
      .then((res) => res.json() as Promise<{ value?: GraphPermission[] }>)
      .then((data) => data.value ?? []);
  }
}
