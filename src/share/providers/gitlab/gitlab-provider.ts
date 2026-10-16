/**
 * @file gitlab-provider.ts
 * @brief GitLab (gitlab.com or self-hosted) as a StorageProvider (REST API v4).
 *
 * Browse levels: projects (default project, starred, member projects; search) -> branches ->
 * repository folders -> .drawio/.xml/.railwaydrawer files. A file is addressed by project +
 * branch + path; its version is the `last_commit_id` (the last commit that changed the file),
 * which the update sends back so GitLab refuses to overwrite someone else's commit.
 *
 * Every save is a commit: the commit message is asked for (Ctrl+S too), saving to a branch other
 * than the default branch can open a merge request, "Save to …" can create a new branch, and a
 * conflict can be resolved by committing to a new branch made from the version you started from.
 */
import type {
  BrowseEntry,
  BrowseListing,
  ConflictAction,
  ConflictBehavior,
  RemoteAccount,
  RemoteFileContent,
  RemoteFileInfo,
  ResultLink,
  SaveField,
  SaveFieldContext,
  SaveFieldValues,
  SaveResult,
  ShareLinkCapability,
  ShareLinkOptions,
  ShareLinkResult,
  StorageProvider,
} from '../types';
import { GITLAB_PROVIDER_ID, buildGitLabAppLink } from './config';
import type { GitLabLinkTarget } from './config';
import { GitLabApiError, GitLabClient, GitLabConflictError, base64ToUtf8, utf8Length } from './gitlab-client';
import type { GitLabProject } from './gitlab-client';

/**
 * Largest diagram read or written here. GitLab itself accepts writes up to 300 MB by default
 * (and rate-limits > 20 MB); base64 in a JSON body in the browser gets slow long before that.
 */
export const GITLAB_MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface GitLabAuthLike {
  account(): { name: string; username: string } | null;
  signIn(): Promise<{ name: string; username: string }>;
  signOut(): Promise<void>;
}

export interface GitLabProviderOptions {
  client: GitLabClient;
  auth: GitLabAuthLike;
  defaultProject?: string | null;
  /** Base URL of app links (default: this page without query/hash). */
  appBaseUrl?: () => string;
  /** A sign-in that failed while the page was away (redirect flow). */
  redirectError?: string | null;
}

/** RemoteFileInfo.ref */
export interface GitLabFileRef {
  projectId: number;
  projectPath: string;
  branch: string;
  path: string;
  defaultBranch: string | null;
}

type EntryData =
  | { t: 'project'; projectId: number; projectPath: string; defaultBranch: string | null }
  | { t: 'branch'; projectId: number; projectPath: string; branch: string; defaultBranch: string | null }
  | { t: 'folder'; projectId: number; projectPath: string; branch: string; defaultBranch: string | null; path: string }
  | { t: 'file'; projectId: number; projectPath: string; branch: string; defaultBranch: string | null; path: string };

function data(entry: BrowseEntry | undefined): EntryData | null {
  const d = entry?.data as EntryData | undefined;
  return d && typeof d === 'object' && typeof d.t === 'string' ? d : null;
}

function isFileRef(ref: unknown): ref is GitLabFileRef {
  const r = ref as GitLabFileRef | null;
  return !!r && typeof r.projectId === 'number' && typeof r.branch === 'string' && typeof r.path === 'string';
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function dirName(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Git ref name rules (the subset that matters for names typed by people). */
export function branchNameProblem(name: string): string | null {
  if (!name) return 'Enter a branch name.';
  if (/[\s~^:?*[\\]/.test(name) || name.includes('..') || name.includes('@{') || name.includes('//')) {
    return `"${name}" is not a valid branch name (no spaces, ~ ^ : ? * [ \\ or "..").`;
  }
  if (name.startsWith('/') || name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock') || name.startsWith('-')) {
    return `"${name}" is not a valid branch name.`;
  }
  return null;
}

/** "railway-drawer/Station-20261016-0930" */
export function suggestBranchName(fileName: string, now: Date = new Date()): string {
  const stem = fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'diagram';
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `railway-drawer/${stem}-${stamp}`;
}

export class GitLabProvider implements StorageProvider {
  readonly id = GITLAB_PROVIDER_ID;
  readonly label = 'GitLab';
  readonly openExtensions = ['.drawio', '.xml', '.railwaydrawer'];
  readonly shareLinks: ShareLinkCapability = {
    typesLegend: 'Link',
    types: [
      { id: 'app', label: 'Railway Drawer link (opens the file from GitLab in the app)' },
      { id: 'gitlab', label: 'GitLab link (the file page in GitLab)' },
    ],
    audiencesLegend: 'Who can open it',
    audiences: [
      {
        id: 'project',
        label: 'People with access to the project',
        hint: 'GitLab permissions apply: viewers sign in to GitLab and need read access to the repository (Reporter or higher on private projects). Saving needs Developer.',
      },
    ],
  };

  private readonly client: GitLabClient;
  private readonly auth: GitLabAuthLike;
  private readonly defaultProject: string | null;
  private readonly appBaseUrl: () => string;
  private redirectError: string | null;

  constructor(opts: GitLabProviderOptions) {
    this.client = opts.client;
    this.auth = opts.auth;
    this.defaultProject = opts.defaultProject ?? null;
    this.appBaseUrl = opts.appBaseUrl ?? (() => `${window.location.origin}${window.location.pathname}`);
    this.redirectError = opts.redirectError ?? null;
  }

  /** The error of a redirect sign-in that failed, once. */
  takeRedirectError(): string | null {
    const err = this.redirectError;
    this.redirectError = null;
    return err;
  }

  getAccount(): RemoteAccount | null {
    const account = this.auth.account();
    return account ? { name: account.name, username: account.username ? `@${account.username}` : undefined } : null;
  }

  async signIn(): Promise<RemoteAccount> {
    const user = await this.auth.signIn();
    return { name: user.name, username: user.username ? `@${user.username}` : undefined };
  }

  signOut(): Promise<void> {
    return this.auth.signOut();
  }

  // ---- browsing -----------------------------------------------------------------------------

  private projectEntry(project: GitLabProject, detail?: string): BrowseEntry {
    return {
      kind: 'container',
      id: `project:${project.id}`,
      name: project.path_with_namespace,
      detail: detail ?? project.name_with_namespace ?? project.web_url,
      data: {
        t: 'project',
        projectId: project.id,
        projectPath: project.path_with_namespace,
        defaultBranch: project.default_branch ?? null,
      } satisfies EntryData,
    };
  }

  async list(path: BrowseEntry[], opts: { search?: string } = {}): Promise<BrowseListing> {
    const last = data(path[path.length - 1]);
    if (!last) return this.listTop(opts.search?.trim() ?? '');
    switch (last.t) {
      case 'project': {
        const branches = await this.client.listBranches(last.projectId);
        if (branches.length === 0) {
          return { heading: 'This project has no branches yet (empty repository). Push a first commit in GitLab.', entries: [] };
        }
        const sorted = [...branches].sort((a, b) =>
          a.name === last.defaultBranch ? -1 : b.name === last.defaultBranch ? 1 : a.name.localeCompare(b.name)
        );
        return {
          heading: 'Branches',
          entries: sorted.map((branch) => ({
            kind: 'container',
            id: `branch:${branch.name}`,
            name: branch.name,
            detail: [branch.name === last.defaultBranch ? 'default branch' : '', branch.protected ? 'protected' : ''].filter(Boolean).join(' · '),
            data: {
              t: 'branch',
              projectId: last.projectId,
              projectPath: last.projectPath,
              branch: branch.name,
              defaultBranch: last.defaultBranch,
            } satisfies EntryData,
          })),
        };
      }
      case 'branch':
        return this.listFolder(last, '');
      case 'folder':
        return this.listFolder(last, last.path);
      default:
        return { entries: [] };
    }
  }

  private async listTop(search: string): Promise<BrowseListing> {
    const base = { searchable: true, searchPlaceholder: 'Search your GitLab projects' };
    if (search) {
      const projects = await this.client.listProjects({ search });
      return { ...base, heading: `Projects matching "${search}"`, entries: projects.map((p) => this.projectEntry(p)) };
    }
    const entries: BrowseEntry[] = [];
    const seen = new Set<number>();
    const add = (project: GitLabProject, detail?: string): void => {
      if (seen.has(project.id)) return;
      seen.add(project.id);
      entries.push(this.projectEntry(project, detail));
    };
    if (this.defaultProject) {
      try {
        add(await this.client.getProject(this.defaultProject), 'Default project');
      } catch (err) {
        console.warn('[GitLab] Default project not reachable:', this.defaultProject, err);
      }
    }
    const [starred, member] = await Promise.all([this.client.listProjects({ starred: true }), this.client.listProjects()]);
    starred.forEach((p) => add(p, `★ ${p.name_with_namespace ?? p.path_with_namespace}`));
    member.forEach((p) => add(p));
    return { ...base, heading: 'Your projects (default and starred first)', entries };
  }

  private async listFolder(
    at: { projectId: number; projectPath: string; branch: string; defaultBranch: string | null },
    folder: string
  ): Promise<BrowseListing> {
    const tree = await this.client.listTree(at.projectId, at.branch, folder);
    const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);
    const common = { projectId: at.projectId, projectPath: at.projectPath, branch: at.branch, defaultBranch: at.defaultBranch };
    return {
      entries: [
        ...tree
          .filter((e) => e.type === 'tree')
          .sort(byName)
          .map(
            (e): BrowseEntry => ({ kind: 'folder', id: `folder:${e.path}`, name: e.name, data: { t: 'folder', ...common, path: e.path } satisfies EntryData })
          ),
        ...tree
          .filter((e) => e.type === 'blob' && this.isOpenable(e.name))
          .sort(byName)
          .map(
            (e): BrowseEntry => ({ kind: 'file', id: `file:${e.path}`, name: e.name, data: { t: 'file', ...common, path: e.path } satisfies EntryData })
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
    return !!last && (last.t === 'branch' || last.t === 'folder');
  }

  // ---- files --------------------------------------------------------------------------------

  /** [project, branch, ...folders] for a file, also when it was not reached by browsing (links). */
  private parentPathOf(ref: GitLabFileRef): BrowseEntry[] {
    const common = { projectId: ref.projectId, projectPath: ref.projectPath, branch: ref.branch, defaultBranch: ref.defaultBranch };
    const path: BrowseEntry[] = [
      {
        kind: 'container',
        id: `project:${ref.projectId}`,
        name: ref.projectPath,
        data: { t: 'project', projectId: ref.projectId, projectPath: ref.projectPath, defaultBranch: ref.defaultBranch } satisfies EntryData,
      },
      { kind: 'container', id: `branch:${ref.branch}`, name: ref.branch, data: { t: 'branch', ...common } satisfies EntryData },
    ];
    let folder = '';
    for (const segment of dirName(ref.path).split('/').filter(Boolean)) {
      folder = folder ? `${folder}/${segment}` : segment;
      path.push({ kind: 'folder', id: `folder:${folder}`, name: segment, data: { t: 'folder', ...common, path: folder } satisfies EntryData });
    }
    return path;
  }

  webUrl(ref: GitLabFileRef): string {
    const enc = (value: string): string => value.split('/').map(encodeURIComponent).join('/');
    return `${this.client.baseUrl}/${ref.projectPath}/-/blob/${enc(ref.branch)}/${enc(ref.path)}`;
  }

  private toInfo(ref: GitLabFileRef, version: string): RemoteFileInfo {
    return {
      providerId: this.id,
      ref: { ...ref } satisfies GitLabFileRef,
      version,
      name: baseName(ref.path),
      location: `${ref.projectPath} › ${ref.branch} › ${ref.path}`,
      webUrl: this.webUrl(ref),
      parentPath: this.parentPathOf(ref),
    };
  }

  private async read(ref: GitLabFileRef): Promise<RemoteFileContent> {
    const file = await this.client.getFile(ref.projectId, ref.path, ref.branch);
    if (file.size > GITLAB_MAX_FILE_BYTES) {
      throw new Error(`"${file.file_name}" is ${formatSize(file.size)}; Railway Drawer opens files up to ${formatSize(GITLAB_MAX_FILE_BYTES)}.`);
    }
    const xml = file.encoding === 'base64' ? base64ToUtf8(file.content) : file.content;
    return { ...this.toInfo(ref, file.last_commit_id), xml };
  }

  async open(_path: BrowseEntry[], file: BrowseEntry): Promise<RemoteFileContent> {
    const d = data(file);
    if (d?.t !== 'file') throw new Error('Not a file');
    return this.read({ projectId: d.projectId, projectPath: d.projectPath, branch: d.branch, path: d.path, defaultBranch: d.defaultBranch });
  }

  /** `?gitlab=` links: project path or id, branch (empty = default), path. */
  async openRef(target: unknown): Promise<RemoteFileContent> {
    const t = target as GitLabLinkTarget | null;
    if (!t || typeof t.project !== 'string' || typeof t.path !== 'string') throw new Error('Invalid GitLab link');
    let project: GitLabProject;
    try {
      project = await this.client.getProject(t.project);
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 404) {
        throw new Error(`Project "${t.project}" was not found, or your GitLab account has no access to it. Ask the sender to give you access.`);
      }
      throw err;
    }
    const branch = t.branch || project.default_branch;
    if (!branch) throw new Error(`Project "${project.path_with_namespace}" has no default branch (empty repository).`);
    return this.read({
      projectId: project.id,
      projectPath: project.path_with_namespace,
      branch,
      path: t.path,
      defaultBranch: project.default_branch ?? null,
    });
  }

  private checkSize(xml: string): void {
    const bytes = utf8Length(xml);
    if (bytes > GITLAB_MAX_FILE_BYTES) {
      throw new Error(`The diagram is ${formatSize(bytes)}; Railway Drawer saves files up to ${formatSize(GITLAB_MAX_FILE_BYTES)} to GitLab. Download it as a file instead.`);
    }
  }

  private async versionOf(ref: GitLabFileRef): Promise<string> {
    const meta = await this.client.fileMeta(ref.projectId, ref.path, ref.branch);
    if (!meta) throw new Error(`"${ref.path}" was committed but cannot be found on ${ref.branch}`);
    return meta.lastCommitId;
  }

  /** Opens (or finds the open) merge request of `ref.branch` into the default branch. */
  private async mergeRequest(ref: GitLabFileRef, title: string): Promise<{ note?: string; link?: ResultLink }> {
    if (!ref.defaultBranch || ref.branch === ref.defaultBranch) return {};
    try {
      const mr = await this.client.createMergeRequest(ref.projectId, {
        sourceBranch: ref.branch,
        targetBranch: ref.defaultBranch,
        title,
        description: `Changes to \`${ref.path}\`, saved from Railway Drawer.`,
      });
      return { note: `Merge request !${mr.iid} created.`, link: { url: mr.web_url, label: `Merge request !${mr.iid}: ${mr.title}` } };
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 409) {
        const existing = await this.client.findOpenMergeRequest(ref.projectId, ref.branch, ref.defaultBranch).catch(() => null);
        if (existing) {
          return {
            note: `Merge request !${existing.iid} was already open; it now includes this commit.`,
            link: { url: existing.web_url, label: `Merge request !${existing.iid}: ${existing.title}` },
          };
        }
      }
      return { note: `Saved, but the merge request could not be created: ${errorText(err)}` };
    }
  }

  private commitMessage(values: SaveFieldValues | undefined, fallback: string): string {
    const value = values?.commitMessage;
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  saveFields(context: SaveFieldContext): SaveField[] {
    if (context.kind === 'save') {
      if (!isFileRef(context.file.ref)) return [];
      const ref = context.file.ref;
      const fields: SaveField[] = [
        { id: 'commitMessage', kind: 'text', label: 'Commit message', value: `Update ${context.file.name} from Railway Drawer` },
      ];
      if (ref.defaultBranch && ref.branch !== ref.defaultBranch) {
        fields.push({
          id: 'createMergeRequest',
          kind: 'checkbox',
          label: `Create a merge request into ${ref.defaultBranch}`,
          value: false,
          hint: 'If one is already open for this branch, the commit is added to it.',
        });
      }
      return fields;
    }
    const last = data(context.path[context.path.length - 1]);
    if (!last || (last.t !== 'branch' && last.t !== 'folder')) return [];
    return [
      { id: 'commitMessage', kind: 'text', label: 'Commit message', value: '', placeholder: 'Add <file name> from Railway Drawer' },
      {
        id: 'newBranch',
        kind: 'text',
        label: 'New branch (optional)',
        value: '',
        placeholder: `e.g. railway-drawer/my-change`,
        hint: `Created from ${last.branch}. Leave empty to commit to ${last.branch}.`,
      },
      {
        id: 'createMergeRequest',
        kind: 'checkbox',
        label: `Create a merge request into ${last.defaultBranch ?? 'the default branch'}`,
        value: false,
        hint: 'Only when committing to a branch other than the default branch.',
      },
    ];
  }

  async save(file: RemoteFileInfo, xml: string, expectedVersion: string | null, values?: SaveFieldValues): Promise<SaveResult> {
    if (!isFileRef(file.ref)) throw new Error('Invalid GitLab file reference');
    const ref = file.ref;
    this.checkSize(xml);
    const message = this.commitMessage(values, `Update ${file.name} from Railway Drawer`);
    try {
      await this.client.updateFile(ref.projectId, ref.path, { branch: ref.branch, content: xml, commitMessage: message, lastCommitId: expectedVersion });
    } catch (err) {
      if (err instanceof GitLabConflictError) {
        return {
          ok: false,
          reason: 'conflict',
          message: `"${file.name}" was changed in GitLab (branch ${ref.branch}) since you opened or last saved it.`,
        };
      }
      throw err;
    }
    const info = this.toInfo(ref, await this.versionOf(ref));
    const mr = values?.createMergeRequest === true ? await this.mergeRequest(ref, message) : {};
    return { ok: true, file: info, ...mr };
  }

  private async freeName(ref: GitLabFileRef): Promise<string> {
    const dir = dirName(ref.path);
    const match = /^(.*?)(\.[^.]+)?$/.exec(baseName(ref.path));
    const stem = match?.[1] || 'diagram';
    const ext = match?.[2] ?? '.drawio';
    for (let n = 2; n < 100; n++) {
      const candidate = `${dir ? `${dir}/` : ''}${stem} (${n})${ext}`;
      if (!(await this.client.fileMeta(ref.projectId, candidate, ref.branch))) return candidate;
    }
    throw new Error('Could not find a free file name');
  }

  async saveAs(path: BrowseEntry[], name: string, xml: string, conflict: ConflictBehavior, values?: SaveFieldValues): Promise<SaveResult> {
    const last = data(path[path.length - 1]);
    if (!last || (last.t !== 'branch' && last.t !== 'folder')) throw new Error('Choose a branch or folder first');
    if (!name || name.includes('/') || name === '.' || name === '..') throw new Error(`"${name}" is not a valid file name`);
    this.checkSize(xml);
    const folder = last.t === 'folder' ? last.path : '';
    const baseBranch = last.branch;
    const newBranch = typeof values?.newBranch === 'string' ? values.newBranch.trim() : '';
    if (newBranch) {
      const problem = branchNameProblem(newBranch);
      if (problem) throw new Error(problem);
    }
    let ref: GitLabFileRef = {
      projectId: last.projectId,
      projectPath: last.projectPath,
      branch: baseBranch,
      path: folder ? `${folder}/${name}` : name,
      defaultBranch: last.defaultBranch,
    };

    // Before creating a branch: on a new branch the file exists exactly when it exists on the base
    let exists = !!(await this.client.fileMeta(ref.projectId, ref.path, baseBranch));
    if (exists && conflict === 'fail') {
      return { ok: false, reason: 'exists', message: `A file named "${name}" already exists in ${folder || 'the root folder'} on ${baseBranch}.` };
    }
    if (exists && conflict === 'rename') {
      ref = { ...ref, path: await this.freeName(ref) };
      exists = false;
    }
    if (newBranch) {
      try {
        await this.client.createBranch(ref.projectId, newBranch, baseBranch);
      } catch (err) {
        if (err instanceof GitLabApiError && err.status === 400 && /already exists/i.test(err.message)) {
          throw new Error(`Branch "${newBranch}" already exists. Choose another name, or browse into that branch.`);
        }
        throw err;
      }
      ref = { ...ref, branch: newBranch };
    }
    const fileName = baseName(ref.path);
    const message = this.commitMessage(values, `${exists ? 'Update' : 'Add'} ${fileName} from Railway Drawer`);
    try {
      if (exists) {
        await this.client.updateFile(ref.projectId, ref.path, { branch: ref.branch, content: xml, commitMessage: message });
      } else {
        await this.client.createFile(ref.projectId, ref.path, { branch: ref.branch, content: xml, commitMessage: message });
      }
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 400 && /already exists/i.test(err.message)) {
        return { ok: false, reason: 'exists', message: `A file named "${fileName}" was just created in GitLab by someone else.` };
      }
      throw err;
    }
    const info = this.toInfo(ref, await this.versionOf(ref));
    const mr = values?.createMergeRequest === true ? await this.mergeRequest(ref, message) : {};
    return { ok: true, file: info, ...mr };
  }

  conflictActions(file: RemoteFileInfo): ConflictAction[] {
    if (!isFileRef(file.ref)) return [];
    return [
      {
        id: 'new-branch',
        label: 'Save to new branch',
        hint: 'Commits your version to a new branch made from the version you started from; nothing is overwritten and a merge request can bring the changes together.',
        fields: [
          { id: 'branch', kind: 'text', label: 'New branch', value: suggestBranchName(file.name) },
          { id: 'commitMessage', kind: 'text', label: 'Commit message', value: `Update ${file.name} from Railway Drawer` },
          {
            id: 'createMergeRequest',
            kind: 'checkbox',
            label: `Create a merge request into ${file.ref.defaultBranch ?? file.ref.branch}`,
            value: true,
          },
        ],
      },
    ];
  }

  async resolveConflict(file: RemoteFileInfo, xml: string, actionId: string, values: SaveFieldValues): Promise<SaveResult> {
    if (actionId !== 'new-branch') throw new Error(`Unknown action "${actionId}"`);
    if (!isFileRef(file.ref)) throw new Error('Invalid GitLab file reference');
    this.checkSize(xml);
    const branch = typeof values.branch === 'string' ? values.branch.trim() : '';
    const problem = branchNameProblem(branch);
    if (problem) throw new Error(problem);
    // The version you started from: your changes apply to it without overwriting anyone
    const base = file.version || file.ref.branch;
    await this.client.createBranch(file.ref.projectId, branch, base);
    const ref: GitLabFileRef = { ...file.ref, branch, defaultBranch: file.ref.defaultBranch ?? file.ref.branch };
    const message = this.commitMessage(values, `Update ${file.name} from Railway Drawer`);
    await this.client.updateFile(ref.projectId, ref.path, { branch, content: xml, commitMessage: message, lastCommitId: file.version || null });
    const info = this.toInfo(ref, await this.versionOf(ref));
    // the merge request goes into the branch the file came from
    const target: GitLabFileRef = { ...ref, defaultBranch: file.ref.branch };
    const mr = values.createMergeRequest === true ? await this.mergeRequest(target, message) : {};
    return { ok: true, file: info, ...mr };
  }

  // ---- links --------------------------------------------------------------------------------

  async createShareLink(file: RemoteFileInfo, options: ShareLinkOptions): Promise<ShareLinkResult> {
    if (!isFileRef(file.ref)) throw new Error('Invalid GitLab file reference');
    const appLink = buildGitLabAppLink({ project: file.ref.projectPath, branch: file.ref.branch, path: file.ref.path }, this.appBaseUrl());
    const gitlabLink = this.webUrl(file.ref);
    const access = 'Recipients sign in to GitLab and need access to the project.';
    return options.type === 'gitlab'
      ? { url: gitlabLink, note: `Railway Drawer link: ${appLink}. ${access}` }
      : { url: appLink, note: `In GitLab: ${gitlabLink}. ${access}` };
  }
}
