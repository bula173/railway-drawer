/**
 * @file gitlab-client.ts
 * @brief Small typed GitLab REST v4 client (fetch): projects, branches, repository tree, files,
 *        merge requests. Bearer token from the sign-in layer; one refresh + retry on 401.
 *
 * - Pagination: follows `X-Next-Page` (offset pagination) or `Link: <…>; rel="next"` (keyset),
 *   both exposed to browsers by GitLab's CORS configuration, up to a page cap per listing.
 * - File content goes as base64 of the UTF-8 bytes (`encoding: base64`), so non-ASCII text
 *   (Polish ą ę ł ó ś ż ź ć ń) survives byte-exact.
 * - Errors: 400 "…has changed since you started editing it" (stale `last_commit_id`) ->
 *   `GitLabConflictError`; 413 / "too large" -> `GitLabTooLargeError`; else `GitLabApiError`.
 */

export class GitLabApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'GitLabApiError';
  }
}

/** The file changed since `last_commit_id` (someone else committed). */
export class GitLabConflictError extends GitLabApiError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'GitLabConflictError';
  }
}

export class GitLabTooLargeError extends GitLabApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'GitLabTooLargeError';
  }
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace?: string;
  path_with_namespace: string;
  default_branch?: string | null;
  web_url?: string;
  last_activity_at?: string;
  star_count?: number;
}

export interface GitLabBranch {
  name: string;
  default?: boolean;
  protected?: boolean;
  commit?: { id: string; committed_date?: string };
}

export interface GitLabTreeEntry {
  id: string;
  name: string;
  type: 'tree' | 'blob' | 'commit';
  path: string;
  mode?: string;
}

export interface GitLabFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

export interface GitLabFileMeta {
  lastCommitId: string;
  blobId: string;
  size: number | null;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  state?: string;
}

export interface GitLabClientOptions {
  /** Base URL of the GitLab instance (no trailing slash). */
  baseUrl: string;
  getToken(): Promise<string>;
  /** Called after a 401: a fresh token, or throws when the session is over. */
  refreshToken?(): Promise<string>;
  fetch?: typeof fetch;
}

/** Projects: `group/sub/project` or a numeric id, as a path segment. Dots are encoded too. */
export function encodeId(id: string | number): string {
  return encodeURIComponent(String(id)).replace(/\./g, '%2E');
}

/**
 * File paths as one segment: `/` -> %2F and `.` -> %2E, as GitLab's documentation shows
 * (lib%2Fclass%2Erb); otherwise an extension such as `.xml` can be taken as the response format.
 */
export function encodeFilePath(path: string): string {
  return encodeURIComponent(path).replace(/\./g, '%2E');
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Byte length of `text` as UTF-8. */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** GitLab's `message`: a string, a list, or `{ field: [errors] }`. */
function messageText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? body : null;
  const b = body as { message?: unknown; error?: unknown; error_description?: unknown };
  const m = b.message ?? b.error_description ?? b.error;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.map(String).join('; ');
  if (m && typeof m === 'object') {
    return Object.entries(m as Record<string, unknown>)
      .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join('; ');
  }
  return null;
}

const CONFLICT_PATTERN = /changed since you started editing/i;
const TOO_LARGE_PATTERN = /too large|exceeds|maximum (file )?size/i;

/** Maximum pages a listing follows (each up to 100 entries). */
const MAX_PAGES = { projects: 3, branches: 5, tree: 20 } as const;

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="?next"?/.exec(part);
    if (match) return match[1];
  }
  return null;
}

type Query = Record<string, string | number | boolean | undefined>;

export class GitLabClient {
  readonly baseUrl: string;
  private readonly opts: GitLabClientOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GitLabClientOptions) {
    this.opts = opts;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  private url(path: string, query: Query = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return `${this.baseUrl}/api/v4${path}${qs ? `?${qs}` : ''}`;
  }

  /** Raw request against a full URL; throws GitLab*Error for non-2xx answers. */
  private async send(method: string, url: string, body?: unknown): Promise<Response> {
    const attempt = async (token: string): Promise<Response> => {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      try {
        return await this.fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      } catch (err) {
        throw new GitLabApiError(
          `Could not reach ${this.baseUrl} (${err instanceof Error ? err.message : String(err)}). Check the network and the GitLab URL.`,
          0
        );
      }
    };
    let res = await attempt(await this.opts.getToken());
    if (res.status === 401 && this.opts.refreshToken) {
      res = await attempt(await this.opts.refreshToken());
    }
    if (res.ok) return res;
    let parsed: unknown = null;
    try {
      const text = await res.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    } catch {
      parsed = null;
    }
    const message = messageText(parsed) ?? `HTTP ${res.status}`;
    if (res.status === 400 && CONFLICT_PATTERN.test(message)) throw new GitLabConflictError(message);
    if (res.status === 413 || ((res.status === 400 || res.status === 422) && TOO_LARGE_PATTERN.test(message))) {
      throw new GitLabTooLargeError(
        `GitLab rejected the file as too large (${res.status === 413 ? 'HTTP 413' : message}). ` +
          'Reduce the diagram (e.g. split it into several files) or ask the GitLab administrator about the request size limit.',
        res.status
      );
    }
    if (res.status === 401) throw new GitLabApiError('GitLab did not accept the sign-in (HTTP 401). Sign in again.', 401);
    if (res.status === 403) throw new GitLabApiError(`GitLab refused the request (403 Forbidden): ${message}. You may lack permission in this project.`, 403);
    if (res.status === 404) throw new GitLabApiError(`Not found in GitLab (404): ${message}`, 404);
    throw new GitLabApiError(`GitLab error ${res.status}: ${message}`, res.status);
  }

  private async json<T>(method: string, path: string, query?: Query, body?: unknown): Promise<T> {
    const res = await this.send(method, this.url(path, query), body);
    return (await res.json()) as T;
  }

  /** All pages (up to `maxPages`) of a list endpoint. */
  async paged<T>(path: string, query: Query, maxPages: number): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = this.url(path, { per_page: 100, ...query });
    for (let page = 0; url && page < maxPages; page++) {
      const res = await this.send('GET', url);
      items.push(...((await res.json()) as T[]));
      const nextPage = res.headers.get('x-next-page');
      if (nextPage) url = this.url(path, { per_page: 100, ...query, page: nextPage });
      else url = nextLink(res.headers.get('link'));
    }
    return items;
  }

  currentUser(): Promise<{ id: number; name: string; username: string; web_url?: string }> {
    return this.json('GET', '/user');
  }

  listProjects(opts: { search?: string; starred?: boolean } = {}): Promise<GitLabProject[]> {
    return this.paged<GitLabProject>(
      '/projects',
      {
        ...(opts.starred ? { starred: true } : { membership: true }),
        simple: true,
        archived: false,
        order_by: 'last_activity_at',
        search: opts.search,
      },
      MAX_PAGES.projects
    );
  }

  getProject(idOrPath: string | number): Promise<GitLabProject> {
    return this.json('GET', `/projects/${encodeId(idOrPath)}`);
  }

  listBranches(projectId: number, search?: string): Promise<GitLabBranch[]> {
    return this.paged<GitLabBranch>(`/projects/${projectId}/repository/branches`, { search }, MAX_PAGES.branches);
  }

  createBranch(projectId: number, branch: string, ref: string): Promise<GitLabBranch> {
    return this.json('POST', `/projects/${projectId}/repository/branches`, { branch, ref });
  }

  listTree(projectId: number, ref: string, path: string): Promise<GitLabTreeEntry[]> {
    return this.paged<GitLabTreeEntry>(`/projects/${projectId}/repository/tree`, { ref, path: path || undefined }, MAX_PAGES.tree);
  }

  getFile(projectId: number, path: string, ref: string): Promise<GitLabFile> {
    return this.json('GET', `/projects/${projectId}/repository/files/${encodeFilePath(path)}`, { ref });
  }

  /** HEAD: version headers without the content; null when the file does not exist. */
  async fileMeta(projectId: number, path: string, ref: string): Promise<GitLabFileMeta | null> {
    let res: Response;
    try {
      res = await this.send('HEAD', this.url(`/projects/${projectId}/repository/files/${encodeFilePath(path)}`, { ref }));
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 404) return null;
      throw err;
    }
    const lastCommitId = res.headers.get('x-gitlab-last-commit-id');
    if (!lastCommitId) {
      // headers not exposed (unusual proxy): fall back to the JSON answer
      const file = await this.getFile(projectId, path, ref);
      return { lastCommitId: file.last_commit_id, blobId: file.blob_id, size: file.size };
    }
    const size = Number(res.headers.get('x-gitlab-size'));
    return { lastCommitId, blobId: res.headers.get('x-gitlab-blob-id') ?? '', size: Number.isFinite(size) ? size : null };
  }

  createFile(
    projectId: number,
    path: string,
    opts: { branch: string; content: string; commitMessage: string }
  ): Promise<{ file_path: string; branch: string }> {
    return this.json('POST', `/projects/${projectId}/repository/files/${encodeFilePath(path)}`, undefined, {
      branch: opts.branch,
      content: utf8ToBase64(opts.content),
      encoding: 'base64',
      commit_message: opts.commitMessage,
    });
  }

  /** `lastCommitId` set: GitLab refuses (400, GitLabConflictError) when the file changed since. */
  updateFile(
    projectId: number,
    path: string,
    opts: { branch: string; content: string; commitMessage: string; lastCommitId?: string | null }
  ): Promise<{ file_path: string; branch: string }> {
    return this.json('PUT', `/projects/${projectId}/repository/files/${encodeFilePath(path)}`, undefined, {
      branch: opts.branch,
      content: utf8ToBase64(opts.content),
      encoding: 'base64',
      commit_message: opts.commitMessage,
      ...(opts.lastCommitId ? { last_commit_id: opts.lastCommitId } : {}),
    });
  }

  createMergeRequest(
    projectId: number,
    opts: { sourceBranch: string; targetBranch: string; title: string; description?: string }
  ): Promise<GitLabMergeRequest> {
    return this.json('POST', `/projects/${projectId}/merge_requests`, undefined, {
      source_branch: opts.sourceBranch,
      target_branch: opts.targetBranch,
      title: opts.title,
      description: opts.description,
      remove_source_branch: true,
    });
  }

  async findOpenMergeRequest(projectId: number, sourceBranch: string, targetBranch: string): Promise<GitLabMergeRequest | null> {
    const list = await this.json<GitLabMergeRequest[]>('GET', `/projects/${projectId}/merge_requests`, {
      state: 'opened',
      source_branch: sourceBranch,
      target_branch: targetBranch,
    });
    return list[0] ?? null;
  }
}
