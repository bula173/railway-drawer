import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { RemoteSession, copyFileName } from '../remote-session';
import type { RemoteTab, RemoteTabHost } from '../remote-session';
import type { BrowseEntry, RemoteFileInfo, SaveResult, StorageProvider, StorageProviderDescriptor } from '../providers/types';
import { SharePointProvider } from '../providers/sharepoint/sharepoint-provider';
import { GraphClient, GraphConflictError, GraphError } from '../providers/sharepoint/graph-client';
import { isAuthResponseUrl, readSharePointConfig, sharePointAvailability, sharePointRedirectUri } from '../providers/sharepoint/config';
import { openSharedDiagram } from '../share-open';
import { encodeShareData } from '../share-link';
import { buildShareMxfile } from '../share-mxfile';

const FOLDER: BrowseEntry = { kind: 'folder', id: 'folder:f1', name: 'Drawings', data: { t: 'folder', driveId: 'd1', itemId: 'f1' } };

function file(version: string, name = 'Plan.drawio'): RemoteFileInfo {
  return { providerId: 'fake', ref: { id: 1 }, version, name, location: `Site › Drawings › ${name}`, parentPath: [FOLDER] };
}

function makeTab(id: string, name = id): RemoteTab & { handler: (() => void) | null; xml: string } {
  const tab = {
    id,
    name,
    handler: null as (() => void) | null,
    xml: `<mxfile><diagram name="${name}"/></mxfile>`,
    saveLoadController: {
      getProjectXml: () => tab.xml,
      loadProjectXml: vi.fn(async (_xml: string) => undefined),
      setSaveHandler: (h: (() => void) | null) => {
        tab.handler = h;
      },
      markAsSavedToDisk: vi.fn(),
    },
  };
  return tab;
}

function setup(provider: Partial<StorageProvider>) {
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
  const impl = { id: 'fake', label: 'Fake', openExtensions: ['.drawio'], getAccount: () => ({ name: 'Ann' }), ...provider } as StorageProvider;
  const descriptor: StorageProviderDescriptor = {
    id: 'fake',
    label: 'Fake',
    description: '',
    availability: () => ({ state: 'ready' }),
    load: async () => impl,
  };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const statusItem = document.createElement('div');
  const statusValue = document.createElement('span');
  const ui = { browse: vi.fn(), askConflict: vi.fn(), shareLink: vi.fn(async () => undefined) };
  const session = new RemoteSession({ host, providers: [descriptor], notify, ui, statusItem, statusValue });
  return { session, tabs, host, notify, ui, statusItem, statusValue, impl };
}

describe('RemoteSession', () => {
  it('Save to…: uploads, binds the tab, Ctrl+S then saves back with the version', async () => {
    const save = vi.fn(async (f: RemoteFileInfo): Promise<SaveResult> => ({ ok: true, file: { ...f, version: 'v3' } }));
    const saveAs = vi.fn(async (): Promise<SaveResult> => ({ ok: true, file: file('v2') }));
    const s = setup({ save, saveAs });
    s.ui.browse.mockResolvedValueOnce({ mode: 'save', path: [FOLDER], name: 'Plan.drawio', conflict: 'fail' });
    expect(await s.session.saveTo('fake')).toBe(true);
    expect(saveAs).toHaveBeenCalledWith([FOLDER], 'Plan.drawio', s.tabs[0].xml, 'fail');
    expect(s.ui.browse.mock.calls[0][1]).toMatchObject({ mode: 'save', defaultName: 'Plan.drawio' });
    expect(s.session.getBinding('t1')?.version).toBe('v2');
    expect(s.statusItem.hidden).toBe(false);
    expect(s.statusValue.textContent).toBe('Fake: Site › Drawings › Plan.drawio');

    // Ctrl+S goes through the save handler
    s.tabs[0].handler!();
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ version: 'v2' }), s.tabs[0].xml, 'v2'));
    await vi.waitFor(() => expect(s.session.getBinding('t1')?.version).toBe('v3'));
  });

  it('Save to…: an existing name with "ask me" reopens the dialog', async () => {
    const saveAs = vi
      .fn<() => Promise<SaveResult>>()
      .mockResolvedValueOnce({ ok: false, reason: 'exists', message: 'A file named "Plan.drawio" already exists.' })
      .mockResolvedValueOnce({ ok: true, file: file('v1') });
    const s = setup({ saveAs });
    s.ui.browse
      .mockResolvedValueOnce({ mode: 'save', path: [FOLDER], name: 'Plan.drawio', conflict: 'fail' })
      .mockResolvedValueOnce({ mode: 'save', path: [FOLDER], name: 'Plan.drawio', conflict: 'replace' });
    expect(await s.session.saveTo('fake')).toBe(true);
    expect(s.ui.browse.mock.calls[1][1].message).toMatch(/already exists/);
    expect(s.ui.browse.mock.calls[1][1].initialPath).toEqual([FOLDER]);
  });

  it('save-back conflict: overwrite, save as copy, cancel', async () => {
    const conflict: SaveResult = { ok: false, reason: 'conflict', message: 'changed' };
    const save = vi.fn<(f: RemoteFileInfo, xml: string, v: string | null) => Promise<SaveResult>>();
    const saveAs = vi.fn(async (): Promise<SaveResult> => ({ ok: true, file: file('c1', 'Plan (copy).drawio') }));
    const s = setup({ save, saveAs });
    s.session.bind(s.tabs[0], file('v1'));

    save.mockResolvedValueOnce(conflict).mockResolvedValueOnce({ ok: true, file: file('v5') });
    s.ui.askConflict.mockResolvedValueOnce('overwrite');
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(save.mock.calls[1][2]).toBeNull();
    expect(s.session.getBinding('t1')?.version).toBe('v5');

    save.mockResolvedValueOnce(conflict);
    s.ui.askConflict.mockResolvedValueOnce('copy');
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(saveAs).toHaveBeenCalledWith([FOLDER], 'Plan (copy).drawio', expect.any(String), 'rename');
    expect(s.session.getBinding('t1')?.name).toBe('Plan (copy).drawio');

    save.mockResolvedValueOnce(conflict);
    s.ui.askConflict.mockResolvedValueOnce('cancel');
    expect(await s.session.saveBack('t1')).toBe(false);
    expect(s.notify.info).toHaveBeenCalledWith(expect.stringMatching(/Not saved/));
  });

  it('Open from…: loads into a new bound tab; a failed load closes it', async () => {
    const open = vi.fn(async () => ({ ...file('v9', 'Station.drawio'), xml: '<mxfile/>' }));
    const s = setup({ open });
    const fileEntry: BrowseEntry = { kind: 'file', id: 'file:1', name: 'Station.drawio', data: {} };
    s.ui.browse.mockResolvedValueOnce({ mode: 'open', path: [FOLDER], file: fileEntry });
    expect(await s.session.openFrom('fake')).toBe(true);
    const tab = s.tabs[1];
    expect(tab.name).toBe('Station');
    expect(tab.saveLoadController.loadProjectXml).toHaveBeenCalledWith('<mxfile/>', 'Station.drawio', { quiet: true });
    expect(s.session.getBinding(tab.id)).toMatchObject({ version: 'v9', name: 'Station.drawio' });
    expect(s.session.getBinding(tab.id)).not.toHaveProperty('xml');
    expect(tab.handler).not.toBeNull();

    s.ui.browse.mockResolvedValueOnce({ mode: 'open', path: [FOLDER], file: fileEntry });
    s.host.createTab = (name) => {
      const t = makeTab('bad', name);
      t.saveLoadController.loadProjectXml = vi.fn(async () => {
        throw new Error('broken');
      });
      s.tabs.push(t);
      return t;
    };
    expect(await s.session.openFrom('fake')).toBe(false);
    expect(s.tabs.find((t) => t.id === 'bad')).toBeUndefined();
  });

  it('closing a tab drops its binding; sharing needs a bound tab', async () => {
    const s = setup({});
    await s.session.shareLink('fake');
    expect(s.notify.info).toHaveBeenCalledWith(expect.stringMatching(/Save the diagram to Fake/));
    s.session.bind(s.tabs[0], file('v1'));
    await s.session.shareLink('fake');
    expect(s.ui.shareLink).toHaveBeenCalled();
    s.session.onTabClosed('t1');
    expect(s.session.getBinding('t1')).toBeNull();
    expect(s.statusItem.hidden).toBe(true);
  });

  it('copyFileName', () => {
    expect(copyFileName('Plan.drawio')).toBe('Plan (copy).drawio');
    expect(copyFileName('noext')).toBe('noext (copy).drawio');
  });
});

describe('SharePointProvider', () => {
  function provider(responder: (url: string, init?: RequestInit) => Response) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => responder(String(input), init));
    const client = new GraphClient({ getToken: async () => 't', fetch: fetchMock as unknown as typeof fetch });
    const auth = { account: () => ({ name: 'Ann', username: 'ann@contoso.com' }), signIn: vi.fn(), signOut: vi.fn(async () => undefined) };
    return { p: new SharePointProvider({ client, auth, defaultSite: 'contoso.sharepoint.com:/sites/Rail' }), fetchMock };
  }
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('top level: OneDrive, default site, followed sites (deduplicated); folders before matching files', async () => {
    const { p } = provider((url) => {
      if (url.includes('/sites/contoso.sharepoint.com:')) return ok({ id: 's1', displayName: 'Rail' });
      if (url.includes('followedSites')) return ok({ value: [{ id: 's1', displayName: 'Rail' }, { id: 's2', displayName: 'Ops' }] });
      return ok({
        value: [
          { id: 'x', name: 'notes.txt', file: {} },
          { id: 'b', name: 'b.drawio', file: {}, size: 2048 },
          { id: 'f', name: 'Sub', folder: { childCount: 0 } },
          { id: 'a', name: 'A.xml', file: {} },
        ],
      });
    });
    const top = await p.list([]);
    expect(top.entries.map((e) => e.name)).toEqual(['My files (OneDrive)', 'Rail', 'Ops']);
    expect(top.searchable).toBe(true);
    expect(p.canSaveAt([])).toBe(false);
    expect(p.canSaveAt([top.entries[1]])).toBe(false);
    const drive: BrowseEntry = { kind: 'container', id: 'drive:d1', name: 'Documents', data: { t: 'drive', driveId: 'd1' } };
    expect(p.canSaveAt([top.entries[1], drive])).toBe(true);
    const listing = await p.list([top.entries[1], drive]);
    expect(listing.entries.map((e) => `${e.kind}:${e.name}`)).toEqual(['folder:Sub', 'file:A.xml', 'file:b.drawio']);
    expect(p.getAccount()).toEqual({ name: 'Ann', username: 'ann@contoso.com' });
  });

  it('save maps 412 to a conflict result; saveAs maps 409 to "exists"; 403 on anyone-links is explained', async () => {
    const { p } = provider((url) => {
      if (url.endsWith('/content')) return new Response(JSON.stringify({ error: { code: 'resourceModified', message: 'x' } }), { status: 412 });
      if (url.includes('conflictBehavior')) return new Response(JSON.stringify({ error: { code: 'nameAlreadyExists', message: 'x' } }), { status: 409 });
      return new Response(JSON.stringify({ error: { code: 'accessDenied', message: 'nope' } }), { status: 403 });
    });
    const info: RemoteFileInfo = { providerId: 'sharepoint', ref: { driveId: 'd1', itemId: 'i1' }, version: 'e1', name: 'a.drawio', location: '', parentPath: [] };
    expect(await p.save(info, '<mxfile/>', 'e1')).toMatchObject({ ok: false, reason: 'conflict' });
    const drive: BrowseEntry = { kind: 'container', id: 'drive:d1', name: 'Docs', data: { t: 'drive', driveId: 'd1' } };
    expect(await p.saveAs([drive], 'a.drawio', '<mxfile/>', 'fail')).toMatchObject({ ok: false, reason: 'exists' });
    await expect(p.createShareLink(info, { type: 'view', audience: 'anonymous' })).rejects.toThrow(/does not allow "Anyone with the link"/);
    await expect(p.createShareLink(info, { type: 'view', audience: 'users', recipients: [] })).rejects.toThrow(/e-mail/);
    expect(GraphConflictError.prototype).toBeInstanceOf(GraphError);
  });
});

describe('SharePoint configuration', () => {
  it('reads the env and decides availability', () => {
    expect(readSharePointConfig({})).toBeNull();
    expect(readSharePointConfig({ VITE_MSAL_CLIENT_ID: ' id ' })).toEqual({ clientId: 'id', tenantId: 'organizations', defaultSite: null });
    expect(
      readSharePointConfig({ VITE_MSAL_CLIENT_ID: 'id', VITE_MSAL_TENANT_ID: 'contoso.onmicrosoft.com', VITE_SHAREPOINT_DEFAULT_SITE: 'contoso.sharepoint.com:/sites/Rail' })
    ).toEqual({ clientId: 'id', tenantId: 'contoso.onmicrosoft.com', defaultSite: 'contoso.sharepoint.com:/sites/Rail' });
    expect(readSharePointConfig({ VITE_MSAL_CLIENT_ID: 'id', VITE_SHAREPOINT_DEFAULT_SITE: 'https://bad' })?.defaultSite).toBeNull();
    const config = readSharePointConfig({ VITE_MSAL_CLIENT_ID: 'id' });
    expect(sharePointAvailability(null, { protocol: 'https:', hostname: 'x' }).state).toBe('not-configured');
    expect(sharePointAvailability(config, { protocol: 'https:', hostname: 'railwaydrawer.mksystemdesign.org' }).state).toBe('ready');
    expect(sharePointAvailability(config, { protocol: 'http:', hostname: 'localhost' }).state).toBe('ready');
    expect(sharePointAvailability(config, { protocol: 'http:', hostname: '192.168.10.22' })).toMatchObject({
      state: 'unavailable',
      reason: 'SharePoint requires HTTPS — use https://railwaydrawer.mksystemdesign.org',
    });
  });

  it('redirect URI and auth response detection', () => {
    expect(sharePointRedirectUri({ origin: 'https://rd.example', pathname: '/' })).toBe('https://rd.example/');
    expect(sharePointRedirectUri({ origin: 'http://localhost:3000', pathname: '/index.html' })).toBe('http://localhost:3000/');
    expect(isAuthResponseUrl({ hash: '#code=abc&state=xyz', search: '' })).toBe(true);
    expect(isAuthResponseUrl({ hash: '', search: '?error=access_denied&state=xyz' })).toBe(true);
    expect(isAuthResponseUrl({ hash: '#Rabc', search: '' })).toBe(false);
    expect(isAuthResponseUrl({ hash: '', search: '?editor=drawio' })).toBe(false);
  });
});

describe('openSharedDiagram', () => {
  const model = (v: string) => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="${v}" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell></root></mxGraphModel>`;

  type Load = Mock<(xml: string, sourceName: string, opts?: { quiet?: boolean }) => Promise<void>>;
  function host(emptyFirst: boolean) {
    const tabs: Array<{ id: string; name: string; saveLoadController: { loadProjectXml: Load } }> = [
      { id: 'orig', name: 'Diagram 1', saveLoadController: { loadProjectXml: vi.fn(async () => undefined) as Load } },
    ];
    let active = 'orig';
    return {
      tabs,
      get active() {
        return active;
      },
      getAllTabs: () => tabs,
      createTab: (name: string) => {
        const tab = { id: `t${tabs.length}`, name, saveLoadController: { loadProjectXml: vi.fn(async () => undefined) as Load } };
        tabs.push(tab);
        return tab;
      },
      switchTab: (id: string) => {
        active = id;
      },
      closeTab: (id: string) => {
        tabs.splice(
          tabs.findIndex((t) => t.id === id),
          1
        );
      },
      isTabEmpty: () => emptyFirst,
    };
  }

  it('opens each page in a new tab and replaces a lone empty tab', async () => {
    const xml = buildShareMxfile([
      { name: 'Łódź', modelXml: model('a') },
      { name: 'Kraków', modelXml: model('b') },
    ]);
    const h = host(true);
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    expect(await openSharedDiagram(`#R${await encodeShareData(xml)}`, h, notify)).toBe(2);
    expect(h.tabs.map((t) => t.name)).toEqual(['Łódź', 'Kraków']);
    expect(h.active).toBe(h.tabs[0].id);
    expect(h.tabs[0].saveLoadController.loadProjectXml.mock.calls[0][0]).toContain('value="a"');
    expect(notify.success).toHaveBeenCalled();
  });

  it('keeps existing work and reports broken links', async () => {
    const h = host(false);
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    expect(await openSharedDiagram(`#R${await encodeShareData(buildShareMxfile([{ name: 'P', modelXml: model('x') }]))}`, h, notify)).toBe(1);
    expect(h.tabs.map((t) => t.id)).toContain('orig');
    expect(await openSharedDiagram('#Rgarbage%%', h, notify)).toBe(0);
    expect(notify.error).toHaveBeenCalledWith(expect.stringMatching(/Could not open the shared diagram/));
  });
});
