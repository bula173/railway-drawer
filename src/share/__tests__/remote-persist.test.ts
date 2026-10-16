/**
 * Remote bindings persisted with the tab cache: format (remote-binding.ts), restore + save back
 * (unverified until the next save, sign-in, stored version -> conflict), Reload/Unlink, dirty state.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteSession } from '../remote-session';
import type { RemoteTab, RemoteTabHost, RemoteUi } from '../remote-session';
import { REMOTE_BINDING_FORMAT, contentFingerprint, parseRemoteBinding, serializeRemoteBinding } from '../remote-binding';
import type { BrowseEntry, RemoteFileInfo, SaveResult, StorageProvider, StorageProviderDescriptor } from '../providers/types';

const FOLDER: BrowseEntry = { kind: 'folder', id: 'folder:f1', name: 'Drawings', data: { t: 'folder', driveId: 'd1', itemId: 'f1' } };

function file(version: string, name = 'Plan.drawio'): RemoteFileInfo {
  return {
    providerId: 'fake',
    ref: { driveId: 'd1', itemId: 'i1' },
    version,
    name,
    location: `Site › Drawings › ${name}`,
    webUrl: 'https://example.test/Plan.drawio',
    parentPath: [FOLDER],
  };
}

type TestTab = RemoteTab & {
  handler: (() => void) | null;
  xml: string;
  change(xml: string): void;
  localOpen: Array<() => void>;
};

function makeTab(id: string, name: string, edits: Map<string, () => void>): TestTab {
  const tab: TestTab = {
    id,
    name,
    handler: null,
    xml: `<mxfile><diagram name="${name}">A</diagram></mxfile>`,
    localOpen: [],
    change(xml: string) {
      tab.xml = xml;
      edits.get(id)?.();
    },
    saveLoadController: {
      getProjectXml: () => tab.xml,
      loadProjectXml: vi.fn(async (xml: string) => {
        tab.change(xml);
      }),
      setSaveHandler: (h: (() => void) | null) => {
        tab.handler = h;
      },
      markAsSavedToDisk: vi.fn(),
      onLocalFileOpened: (listener: () => void) => {
        tab.localOpen.push(listener);
        return () => {
          tab.localOpen = tab.localOpen.filter((l) => l !== listener);
        };
      },
    },
  };
  return tab;
}

function setup(provider: Partial<StorageProvider> = {}, opts: { account?: boolean } = {}) {
  const edits = new Map<string, () => void>();
  const tabs: TestTab[] = [makeTab('t1', 'Plan', edits)];
  let active = 't1';
  const host: RemoteTabHost = {
    getActiveTab: () => tabs.find((t) => t.id === active) ?? null,
    getAllTabs: () => tabs,
    createTab: (name) => {
      const tab = makeTab(`t${tabs.length + 1}`, name, edits);
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
  let signedIn = opts.account ?? true;
  const impl = {
    id: 'fake',
    label: 'Fake',
    openExtensions: ['.drawio'],
    getAccount: () => (signedIn ? { name: 'Ann' } : null),
    signIn: vi.fn(async () => {
      signedIn = true;
      return { name: 'Ann' };
    }),
    ...provider,
  } as StorageProvider;
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
  const tabBar = document.createElement('div');
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab-button';
    el.dataset.tabId = tab.id;
    el.innerHTML = `<span class="tab-label">${tab.name}</span>`;
    tabBar.appendChild(el);
  }
  const ui = {
    browse: vi.fn(),
    askConflict: vi.fn<RemoteUi['askConflict']>(),
    shareLink: vi.fn(async () => undefined),
    askSignIn: vi.fn(async (p: StorageProvider) => {
      await p.signIn();
      return true;
    }),
    confirm: vi.fn<RemoteUi['confirm']>(async () => true),
  };
  const onBindingsChanged = vi.fn();
  const confirmClose = vi.fn(() => false);
  const session = new RemoteSession({
    host,
    providers: [descriptor],
    notify,
    ui,
    statusItem,
    statusValue,
    tabBar,
    watchTab: (tab, onChange) => {
      edits.set(tab.id, onChange);
      return () => edits.delete(tab.id);
    },
    onBindingsChanged,
    confirmClose,
  });
  return {
    session,
    tabs,
    notify,
    ui,
    impl,
    statusItem,
    statusValue,
    tabBar,
    edits,
    onBindingsChanged,
    confirmClose,
    signOut: () => {
      signedIn = false;
    },
  };
}

/** What the cache would hold for tab t1 of `s`, through a JSON round trip like localStorage. */
function cached(s: ReturnType<typeof setup>, tabId = 't1'): unknown {
  return JSON.parse(JSON.stringify(s.session.persistedBinding(tabId)));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('remote binding format', () => {
  it('round-trips and is versioned', () => {
    const stored = serializeRemoteBinding(file('e1'), { savedAt: 1234, dirty: false });
    expect(stored).toMatchObject({ v: REMOTE_BINDING_FORMAT, providerId: 'fake', version: 'e1', savedAt: 1234, dirty: false });
    const parsed = parseRemoteBinding(JSON.parse(JSON.stringify(stored)));
    expect(parsed).toEqual({ file: file('e1'), savedAt: 1234, dirty: false });
  });

  it('never stores credential-like keys, also not nested in provider ref data', () => {
    const info = {
      ...file('e1'),
      ref: { driveId: 'd1', accessToken: 'SECRET1', nested: { refresh_token: 'SECRET2', ok: 1 } },
      parentPath: [{ ...FOLDER, data: { t: 'folder', password: 'SECRET3', driveId: 'd1' } }],
    };
    const json = JSON.stringify(serializeRemoteBinding(info, { savedAt: 1, dirty: true }));
    expect(json).not.toMatch(/SECRET|token|password/i);
    expect(json).toContain('"ok":1');
    // and on read, in case something wrote them
    const parsed = parseRemoteBinding({ ...JSON.parse(json), ref: { itemId: 'x', Authorization: 'Bearer SECRET' } });
    expect(JSON.stringify(parsed)).not.toContain('SECRET');
  });

  it('ignores unknown versions and malformed data; unknown dirty = dirty', () => {
    const good = serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: false });
    expect(parseRemoteBinding(undefined)).toBeNull();
    expect(parseRemoteBinding({ ...good, v: 2 })).toBeNull();
    expect(parseRemoteBinding({ ...good, providerId: 5 })).toBeNull();
    expect(parseRemoteBinding({ ...good, name: '' })).toBeNull();
    expect(parseRemoteBinding({ ...good, ref: null })).toBeNull();
    expect(parseRemoteBinding({ ...good, parentPath: [{ kind: 'weird' }] })).toBeNull();
    expect(parseRemoteBinding({ ...good, webUrl: 'javascript:alert(1)' })?.file.webUrl).toBeUndefined();
    const { dirty: _dirty, ...noDirty } = good;
    expect(parseRemoteBinding(noDirty)?.dirty).toBe(true);
  });

  it('fingerprint tells contents apart', () => {
    expect(contentFingerprint('abc')).toBe(contentFingerprint('abc'));
    expect(contentFingerprint('abc')).not.toBe(contentFingerprint('abd'));
  });
});

describe('RemoteSession persistence', () => {
  it('restores a cached binding: status bar, unverified, Ctrl+S saves back with the stored version', async () => {
    const before = setup();
    before.session.bind(before.tabs[0], file('e7'));
    const raw = cached(before);
    expect(JSON.stringify(raw)).toContain('"version":"e7"');

    // "after the reload": a new session, the same content restored from the cache
    const save = vi.fn(async (f: RemoteFileInfo): Promise<SaveResult> => ({ ok: true, file: { ...f, version: 'e8' } }));
    const s = setup({ save });
    expect(s.session.restoreBinding(s.tabs[0], raw)).toBe(true);
    expect(s.session.getBinding('t1')).toEqual(file('e7'));
    expect(s.session.isVerified('t1')).toBe(false);
    expect(s.session.isDirty('t1')).toBe(false);
    expect(s.statusItem.hidden).toBe(false);
    expect(s.statusValue.textContent).toBe('Fake: Site › Drawings › Plan.drawio');
    expect(s.statusItem.dataset.verified).toBe('false');
    expect(s.onBindingsChanged).not.toHaveBeenCalled();

    s.tabs[0].handler!(); // Ctrl+S
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ version: 'e7' }), s.tabs[0].xml, 'e7'));
    await vi.waitFor(() => expect(s.session.getBinding('t1')?.version).toBe('e8'));
    expect(s.session.isVerified('t1')).toBe(true);
    expect(s.statusItem.dataset.verified).toBe('true');
    expect(s.onBindingsChanged).toHaveBeenCalled();
    expect(s.ui.askSignIn).not.toHaveBeenCalled();
  });

  it('restored binding, signed out: Ctrl+S asks to sign in first; declining keeps the changes', async () => {
    const save = vi.fn(async (f: RemoteFileInfo): Promise<SaveResult> => ({ ok: true, file: { ...f, version: 'e2' } }));
    const s = setup({ save }, { account: false });
    s.session.restoreBinding(s.tabs[0], serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: true }));

    s.ui.askSignIn.mockResolvedValueOnce(false);
    expect(await s.session.saveBack('t1')).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(s.notify.info).toHaveBeenCalledWith(expect.stringMatching(/needs a sign-in/));

    expect(await s.session.saveBack('t1')).toBe(true);
    expect(s.ui.askSignIn).toHaveBeenCalledTimes(2);
    expect(s.impl.signIn).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'e1');
  });

  it('a session that ended during the save: sign in again and retry once', async () => {
    let calls = 0;
    const s = setup({
      save: vi.fn(async (f: RemoteFileInfo): Promise<SaveResult> => {
        calls++;
        if (calls === 1) {
          s.signOut();
          throw new Error('Your GitLab session expired. Sign in again.');
        }
        return { ok: true, file: { ...f, version: 'e2' } };
      }),
    });
    s.session.restoreBinding(s.tabs[0], serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: true }));
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(calls).toBe(2);
    expect(s.ui.askSignIn).toHaveBeenCalledTimes(1);
  });

  it('restored binding whose file changed remotely: the conflict dialog, cancel keeps it unverified', async () => {
    const save = vi
      .fn<(f: RemoteFileInfo, xml: string, v: string | null) => Promise<SaveResult>>()
      .mockResolvedValueOnce({ ok: false, reason: 'conflict', message: '"Plan.drawio" was changed' })
      .mockResolvedValueOnce({ ok: false, reason: 'conflict', message: '"Plan.drawio" was changed' })
      .mockResolvedValueOnce({ ok: true, file: file('e9') });
    const s = setup({ save });
    s.session.restoreBinding(s.tabs[0], serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: true }));

    s.ui.askConflict.mockResolvedValueOnce('cancel');
    expect(await s.session.saveBack('t1')).toBe(false);
    expect(s.ui.askConflict).toHaveBeenCalledWith('Fake', '"Plan.drawio" was changed', []);
    expect(save.mock.calls[0][2]).toBe('e1');
    expect(s.session.isVerified('t1')).toBe(false);
    expect(s.session.isDirty('t1')).toBe(true);

    s.ui.askConflict.mockResolvedValueOnce('overwrite');
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(save.mock.calls[2][2]).toBeNull();
    expect(s.session.getBinding('t1')?.version).toBe('e9');
    expect(s.session.isDirty('t1')).toBe(false);
  });

  it('unknown provider in the cache: bound (Unlink works), save explains instead of throwing', async () => {
    const s = setup();
    s.session.restoreBinding(s.tabs[0], serializeRemoteBinding({ ...file('e1'), providerId: 'gone' }, { savedAt: 1, dirty: false }));
    expect(s.statusValue.textContent).toBe('gone: Site › Drawings › Plan.drawio');
    expect(await s.session.saveBack('t1')).toBe(false);
    expect(s.notify.warning).toHaveBeenCalledWith(expect.stringMatching(/not available in this browser/));
    expect(s.session.unlink('t1')).toBe(true);
    expect(s.session.getBinding('t1')).toBeNull();
  });

  it('malformed cached data leaves the tab unbound', () => {
    const s = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(s.session.restoreBinding(s.tabs[0], { v: 1, providerId: 'fake' })).toBe(false);
    expect(s.session.getBinding('t1')).toBeNull();
    expect(s.tabs[0].handler).toBeNull();
    s.session.updateStatus();
    expect(s.statusItem.hidden).toBe(true);
  });
});

describe('RemoteSession Reload / Unlink', () => {
  it('Reload from <provider>: confirm, reads the file again, binding verified and clean', async () => {
    const reopen = vi.fn(async (f: RemoteFileInfo) => ({ ...f, version: 'e5', xml: '<mxfile>REMOTE</mxfile>' }));
    const s = setup({ reopen });
    s.session.restoreBinding(s.tabs[0], serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: true }));

    s.ui.confirm.mockResolvedValueOnce(false);
    expect(await s.session.reloadFromRemote()).toBe(false);
    expect(reopen).not.toHaveBeenCalled();
    expect(s.ui.confirm.mock.calls[0][0]).toMatchObject({ danger: true, message: expect.stringMatching(/Discard the changes/) });

    expect(await s.session.reloadFromRemote()).toBe(true);
    expect(reopen).toHaveBeenCalledWith(file('e1'));
    expect(s.tabs[0].saveLoadController.loadProjectXml).toHaveBeenCalledWith('<mxfile>REMOTE</mxfile>', 'Plan.drawio', { quiet: true });
    expect(s.session.getBinding('t1')?.version).toBe('e5');
    expect(s.session.getBinding('t1')).not.toHaveProperty('xml');
    expect(s.session.isVerified('t1')).toBe(true);
    expect(s.session.isDirty('t1')).toBe(false);
  });

  it('Reload: a failed read keeps the diagram and the binding', async () => {
    const s = setup({ reopen: vi.fn(async () => Promise.reject(new Error('404'))) });
    s.session.bind(s.tabs[0], file('e1'));
    expect(await s.session.reloadFromRemote('t1')).toBe(false);
    expect(s.notify.error).toHaveBeenCalledWith(expect.stringMatching(/Could not reload "Plan.drawio" from Fake: 404/));
    expect(s.tabs[0].saveLoadController.loadProjectXml).not.toHaveBeenCalled();
    expect(s.session.getBinding('t1')?.version).toBe('e1');
  });

  it('Unlink: Ctrl+S downloads again, status bar hidden, cache entry gone', () => {
    const s = setup();
    s.session.bind(s.tabs[0], file('e1'));
    expect(s.tabs[0].handler).not.toBeNull();
    s.onBindingsChanged.mockClear();
    expect(s.session.unlink()).toBe(true);
    expect(s.tabs[0].handler).toBeNull();
    expect(s.statusItem.hidden).toBe(true);
    expect(s.session.persistedBinding('t1')).toBeUndefined();
    expect(s.onBindingsChanged).toHaveBeenCalledTimes(1);
    expect(s.notify.info).toHaveBeenCalledWith(expect.stringMatching(/no longer linked to Fake/));
  });

  it('File > Open from disk into a bound tab unbinds it', () => {
    const s = setup();
    s.session.bind(s.tabs[0], file('e1'));
    s.tabs[0].localOpen.forEach((listener) => listener());
    expect(s.session.getBinding('t1')).toBeNull();
    expect(s.tabs[0].handler).toBeNull();
    expect(s.tabs[0].localOpen).toHaveLength(0);
  });
});

describe('RemoteSession dirty state', () => {
  it('edits mark the tab dirty (dot + status), undoing back to the saved content clears it', async () => {
    vi.useFakeTimers();
    const s = setup({ save: vi.fn(async (f: RemoteFileInfo): Promise<SaveResult> => ({ ok: true, file: { ...f, version: 'e2' } })) });
    const original = s.tabs[0].xml;
    s.session.bind(s.tabs[0], file('e1'));
    const tabEl = s.tabBar.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    expect(tabEl.querySelector('.rd-remote-dirty-dot')).toBeNull();

    s.tabs[0].change('<mxfile>B</mxfile>');
    expect(s.session.isDirty('t1')).toBe(false); // debounced
    vi.advanceTimersByTime(400);
    expect(s.session.isDirty('t1')).toBe(true);
    expect(tabEl.querySelector('.rd-remote-dirty-dot')?.getAttribute('title')).toMatch(/not yet saved to Fake/);
    expect(s.statusItem.dataset.dirty).toBe('true');
    expect(s.session.hasUnsavedRemoteChanges()).toBe(true);

    s.tabs[0].change(original);
    vi.advanceTimersByTime(400);
    expect(s.session.isDirty('t1')).toBe(false);
    expect(tabEl.querySelector('.rd-remote-dirty-dot')).toBeNull();
    expect(s.session.hasUnsavedRemoteChanges()).toBe(false);

    // A pending check is settled when the cache is written (flush before unload)
    s.tabs[0].change('<mxfile>C</mxfile>');
    expect(cached(s)).toMatchObject({ dirty: true });

    vi.useRealTimers();
    expect(await s.session.saveBack('t1')).toBe(true);
    expect(s.session.isDirty('t1')).toBe(false);
    expect(cached(s)).toMatchObject({ dirty: false, version: 'e2' });
  });

  it('dirty state survives a reload; a restored dirty tab stays dirty until saved', () => {
    vi.useFakeTimers();
    const s = setup();
    s.session.restoreBinding(s.tabs[0], serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: true }));
    expect(s.session.isDirty('t1')).toBe(true);
    expect(s.tabBar.querySelector('[data-tab-id="t1"] .rd-remote-dirty-dot')).not.toBeNull();
    s.tabs[0].change('<mxfile>whatever</mxfile>');
    vi.advanceTimersByTime(400);
    expect(s.session.isDirty('t1')).toBe(true);

    // restored clean: the restored content is the saved state
    const c = setup();
    c.session.restoreBinding(c.tabs[0], serializeRemoteBinding(file('e1'), { savedAt: 1, dirty: false }));
    expect(c.session.isDirty('t1')).toBe(false);
    c.tabs[0].change('<mxfile>edited</mxfile>');
    vi.advanceTimersByTime(400);
    expect(c.session.isDirty('t1')).toBe(true);
  });

  it('closing a dirty bound tab asks; clean or unbound tabs close without a question', () => {
    const s = setup();
    expect(s.session.confirmCloseTab('t1')).toBe(true); // unbound
    s.session.bind(s.tabs[0], file('e1'));
    expect(s.session.confirmCloseTab('t1')).toBe(true); // clean
    expect(s.confirmClose).not.toHaveBeenCalled();
    s.tabs[0].xml = '<mxfile>changed</mxfile>';
    expect(s.session.confirmCloseTab('t1')).toBe(false);
    expect(s.confirmClose).toHaveBeenCalledWith(expect.stringMatching(/"Plan" has changes that are not saved to Fake \(Plan.drawio\)/));
    s.confirmClose.mockReturnValueOnce(true);
    expect(s.session.confirmCloseTab('t1')).toBe(true);
    s.session.onTabClosed('t1');
    expect(s.session.hasUnsavedRemoteChanges()).toBe(false);
    expect(s.edits.has('t1')).toBe(false);
  });
});
