import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteSession } from '../remote-session';
import type { RemoteTab, RemoteTabHost } from '../remote-session';
import { openShareDialog } from '../share-dialog';
import type { ShareDialogHost } from '../share-dialog';
import { createGitLabDescriptor } from '../providers/gitlab';
import { createStorageProviders } from '../providers/registry';
import { askSaveConflict, askSaveOptions, renderSaveFields } from '../ui/remote-dialogs';
import type { IncomingLink, RemoteFileContent, RemoteFileInfo, SaveResult, StorageProvider, StorageProviderDescriptor } from '../providers/types';

function file(version: string, name = 'Plan.drawio'): RemoteFileInfo {
  return { providerId: 'fake', ref: { id: 1 }, version, name, location: `rail/ertms › main › ${name}`, parentPath: [] };
}

function makeTab(id: string, name = id): RemoteTab & { handler: (() => void) | null } {
  const tab = {
    id,
    name,
    handler: null as (() => void) | null,
    saveLoadController: {
      getProjectXml: () => '<mxfile/>',
      loadProjectXml: vi.fn(async () => undefined),
      setSaveHandler: (h: (() => void) | null) => {
        tab.handler = h;
      },
      markAsSavedToDisk: vi.fn(),
    },
  };
  return tab;
}

function setup(provider: Partial<StorageProvider>, descriptorOverrides: Partial<StorageProviderDescriptor> = {}) {
  const tabs = [makeTab('t1', 'Plan')];
  let active = 't1';
  const host: RemoteTabHost = {
    getActiveTab: () => tabs.find((t) => t.id === active) ?? null,
    getAllTabs: () => tabs,
    createTab: (name) => {
      const tab = makeTab(`t${tabs.length + 1}`, name);
      tabs.push(tab);
      return tab;
    },
    switchTab: (id) => {
      active = id;
    },
    closeTab: (id) => {
      tabs.splice(
        tabs.findIndex((t) => t.id === id),
        1
      );
    },
  };
  const impl = { id: 'fake', label: 'GitLab', openExtensions: ['.drawio'], getAccount: () => ({ name: 'Ann' }), ...provider } as StorageProvider;
  const descriptor: StorageProviderDescriptor = {
    id: 'fake',
    label: 'GitLab',
    description: '',
    availability: () => ({ state: 'ready' }),
    load: async () => impl,
    ...descriptorOverrides,
  };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const ui = {
    browse: vi.fn(),
    askConflict: vi.fn(),
    shareLink: vi.fn(async () => undefined),
    askOptions: vi.fn(),
    showLink: vi.fn(async () => undefined),
    askSignIn: vi.fn(),
  };
  const session = new RemoteSession({ host, providers: [descriptor], notify, ui });
  return { session, tabs, notify, ui, impl };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  document.querySelectorAll('.rd-share-overlay').forEach((n) => n.remove());
});

describe('RemoteSession with provider save fields (GitLab)', () => {
  const commitField = [{ id: 'commitMessage', kind: 'text' as const, label: 'Commit message', value: 'Update Plan.drawio' }];

  it('Ctrl+S asks for the commit message; cancel does not save; the MR link is shown', async () => {
    const save = vi.fn(async (f: RemoteFileInfo): Promise<SaveResult> => ({
      ok: true,
      file: { ...f, version: 'c2' },
      note: 'Merge request !3 created.',
      link: { url: 'https://gitlab/mr/3', label: 'Merge request !3' },
    }));
    const s = setup({ save, saveFields: () => commitField });
    s.session.bind(s.tabs[0], file('c1'));

    s.ui.askOptions.mockResolvedValueOnce(null);
    expect(await s.session.saveBack('t1')).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(s.notify.info).toHaveBeenCalledWith(expect.stringMatching(/Not saved/));

    s.ui.askOptions.mockResolvedValueOnce({ commitMessage: 'Move S1', createMergeRequest: true });
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(s.ui.askOptions.mock.calls[1][0]).toMatchObject({ title: 'Save to GitLab', intro: 'rail/ertms › main › Plan.drawio', fields: commitField });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ version: 'c1' }), '<mxfile/>', 'c1', { commitMessage: 'Move S1', createMergeRequest: true });
    expect(s.notify.success).toHaveBeenCalledWith('Saved to GitLab: Plan.drawio. Merge request !3 created.');
    expect(s.ui.showLink).toHaveBeenCalledWith('Saved to GitLab', 'Merge request !3 created.', { url: 'https://gitlab/mr/3', label: 'Merge request !3' });
    expect(s.session.getBinding('t1')?.version).toBe('c2');
  });

  it('conflict: provider action "Save to new branch" with its own fields', async () => {
    const save = vi.fn(async (): Promise<SaveResult> => ({ ok: false, reason: 'conflict', message: 'changed' }));
    const resolveConflict = vi.fn(async (): Promise<SaveResult> => ({ ok: true, file: { ...file('c9'), location: 'rail/ertms › rd/mine › Plan.drawio' } }));
    const actions = [{ id: 'new-branch', label: 'Save to new branch', fields: [{ id: 'branch', kind: 'text' as const, label: 'New branch', value: 'rd/x' }] }];
    const s = setup({ save, saveFields: () => commitField, conflictActions: () => actions, resolveConflict });
    s.session.bind(s.tabs[0], file('c1'));
    s.ui.askOptions.mockResolvedValueOnce({ commitMessage: 'Mine' }).mockResolvedValueOnce({ branch: 'rd/mine' });
    s.ui.askConflict.mockResolvedValueOnce('action:new-branch');
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(s.ui.askConflict).toHaveBeenCalledWith('GitLab', 'changed', actions);
    expect(s.ui.askOptions.mock.calls[1][0]).toMatchObject({ title: 'Save to new branch', fields: actions[0].fields });
    expect(resolveConflict).toHaveBeenCalledWith(expect.objectContaining({ version: 'c1' }), '<mxfile/>', 'new-branch', { branch: 'rd/mine' });
    expect(s.session.getBinding('t1')?.location).toBe('rail/ertms › rd/mine › Plan.drawio');

    // "save as copy" keeps the commit message
    const saveAs = vi.fn(async (): Promise<SaveResult> => ({ ok: true, file: file('c10', 'Plan (copy).drawio') }));
    s.impl.saveAs = saveAs;
    s.ui.askOptions.mockResolvedValueOnce({ commitMessage: 'Copy' });
    s.ui.askConflict.mockResolvedValueOnce('copy');
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(saveAs).toHaveBeenCalledWith([], 'Plan (copy).drawio', '<mxfile/>', 'rename', { commitMessage: 'Copy' });
  });

  it('Save to…: the browse dialog values reach saveAs', async () => {
    const saveAs = vi.fn(async (): Promise<SaveResult> => ({ ok: true, file: file('c1') }));
    const s = setup({ saveAs });
    s.ui.browse.mockResolvedValueOnce({ mode: 'save', path: [], name: 'Plan.drawio', conflict: 'fail', values: { newBranch: 'rd/a' } });
    expect(await s.session.saveTo('fake')).toBe(true);
    expect(saveAs).toHaveBeenCalledWith([], 'Plan.drawio', '<mxfile/>', 'fail', { newBranch: 'rd/a' });
  });

  it('incoming link: sign in first, then open into a bound tab; declined sign-in clears it', async () => {
    let link: IncomingLink | null = { ref: { project: 'rail/ertms', branch: 'main', path: 'a.drawio' }, label: 'rail/ertms › main › a.drawio' };
    let account: { name: string } | null = null;
    const openRef = vi.fn(async (): Promise<RemoteFileContent> => ({ ...file('c1', 'a.drawio'), xml: '<mxfile/>' }));
    const clearIncomingLink = vi.fn(() => {
      link = null;
    });
    const s = setup({ openRef, getAccount: () => account }, { incomingLink: () => link, clearIncomingLink });
    s.ui.askSignIn.mockImplementationOnce(async () => {
      account = { name: 'Ann' };
      return true;
    });
    expect(await s.session.openIncomingLinks()).toBe(1);
    expect(s.ui.askSignIn.mock.calls[0][1]).toContain('rail/ertms › main › a.drawio');
    expect(openRef).toHaveBeenCalledWith({ project: 'rail/ertms', branch: 'main', path: 'a.drawio' });
    expect(s.tabs[1].name).toBe('a');
    expect(s.session.getBinding(s.tabs[1].id)?.version).toBe('c1');
    expect(clearIncomingLink).toHaveBeenCalled();
    expect(await s.session.openIncomingLinks()).toBe(0);

    link = { ref: {}, label: 'x' };
    account = null;
    s.ui.askSignIn.mockResolvedValueOnce(false);
    expect(await s.session.openIncomingLinks()).toBe(0);
    expect(link).toBeNull();
    expect(s.notify.info).toHaveBeenCalledWith(expect.stringMatching(/needs a GitLab sign-in/));
  });

  it('incoming link while the provider is not configured: kept, with a hint', async () => {
    const link: IncomingLink = { ref: {}, label: 'rail/ertms › main › a.drawio' };
    const clearIncomingLink = vi.fn();
    const s = setup(
      {},
      {
        availability: () => ({ state: 'not-configured', reason: 'Not configured.' }),
        incomingLink: () => link,
        clearIncomingLink,
      }
    );
    expect(await s.session.openIncomingLinks()).toBe(0);
    expect(clearIncomingLink).not.toHaveBeenCalled();
    expect(s.notify.warning).toHaveBeenCalledWith(expect.stringContaining('Share > GitLab'));
  });
});

describe('Remote dialogs: save fields and conflict actions', () => {
  it('renderSaveFields keeps typed values across re-renders', () => {
    const fields = [
      { id: 'commitMessage', kind: 'text' as const, label: 'Commit message', value: 'default' },
      { id: 'mr', kind: 'checkbox' as const, label: 'MR', value: false, hint: 'h' },
    ];
    const first = renderSaveFields(fields);
    expect(first.values()).toEqual({ commitMessage: 'default', mr: false });
    const again = renderSaveFields(fields, { commitMessage: 'typed', mr: true });
    expect(again.values()).toEqual({ commitMessage: 'typed', mr: true });
    expect(again.element.querySelector('label')?.textContent).toBe('Commit message');
  });

  it('askSaveOptions resolves the values on Save, null on Cancel; conflict dialog offers the actions', async () => {
    const answer = askSaveOptions({ title: 'Save to GitLab', fields: [{ id: 'commitMessage', kind: 'text', label: 'Commit message', value: 'x' }] });
    const input = document.querySelector<HTMLInputElement>('[data-testid="remote-save-options-dialog"] input')!;
    input.value = 'Ł';
    document.querySelector<HTMLButtonElement>('[data-testid="remote-save-options-confirm"]')!.click();
    expect(await answer).toEqual({ commitMessage: 'Ł' });

    const cancelled = askSaveOptions({ title: 't', fields: [] });
    document.querySelector<HTMLButtonElement>('[data-testid="remote-save-options-dialog"] .rd-share-modal-footer button')!.click();
    expect(await cancelled).toBeNull();

    const choice = askSaveConflict('GitLab', 'changed', [{ id: 'new-branch', label: 'Save to new branch', hint: 'safe' }]);
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="remote-conflict-dialog"] button[data-action="new-branch"]')!;
    expect(btn.textContent).toBe('Save to new branch');
    btn.click();
    expect(await choice).toBe('action:new-branch');
  });
});

describe('Share dialog: GitLab section', () => {
  function host(providers: StorageProviderDescriptor[], overrides: Partial<ShareDialogHost> = {}): ShareDialogHost {
    return {
      getShareXml: () => '<mxfile/>',
      getTabCount: () => 1,
      getFileBaseName: () => 'x',
      downloadDrawio: vi.fn(),
      exportPng: vi.fn(async () => undefined),
      exportSvg: vi.fn(async () => undefined),
      providers,
      hasRemoteFile: () => false,
      onProviderAction: vi.fn(),
      notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
      baseUrl: 'https://rd.example/',
      share: null,
      copy: vi.fn(async () => true),
      ...overrides,
    };
  }
  const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('registry: SharePoint first, then GitLab', () => {
    expect(createStorageProviders().map((p) => p.id)).toEqual(['sharepoint', 'gitlab']);
  });

  it('"Not configured" + docs link + open settings form; saving makes the actions appear', () => {
    const loadModule = vi.fn();
    const gitlab = createGitLabDescriptor({
      env: {},
      location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3000', pathname: '/', search: '', hash: '' },
      loadModule,
    });
    const onProviderSettingsChanged = vi.fn();
    const h = host([gitlab], { onProviderSettingsChanged });
    openShareDialog(h);
    expect(q('share-provider-gitlab-status')!.textContent).toBe('Not configured');
    const help = q('share-provider-gitlab')!.querySelector('a')!;
    expect(help.textContent).toBe('How to enable');
    expect(help.href).toContain('docs/GITLAB.md');
    const settings = q('share-provider-gitlab-settings') as HTMLDetailsElement;
    expect(settings.open).toBe(true);
    expect(settings.textContent).toContain('http://localhost:3000/');

    const set = (id: string, value: string) => {
      (settings.querySelector(`input[data-setting="${id}"]`) as HTMLInputElement).value = value;
    };
    set('url', 'not a url');
    set('clientId', 'abc');
    q('share-provider-gitlab-settings-save')!.click();
    expect(settings.querySelector('.rd-share-error')!.textContent).toMatch(/must start with/);
    expect(onProviderSettingsChanged).not.toHaveBeenCalled();

    set('url', 'http://gitlab.local');
    q('share-provider-gitlab-settings-save')!.click();
    expect(onProviderSettingsChanged).toHaveBeenCalledWith('gitlab');
    expect(q('share-provider-gitlab-status')).toBeNull();
    expect(q('share-provider-gitlab-open')!.textContent).toBe('Open from GitLab…');
    expect((q('share-provider-gitlab-settings') as HTMLDetailsElement).open).toBe(false);
    expect(loadModule).not.toHaveBeenCalled();
  });
});
