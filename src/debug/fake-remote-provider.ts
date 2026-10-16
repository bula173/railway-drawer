/**
 * @file fake-remote-provider.ts
 * @brief TEST-ONLY storage provider for the Playwright specs (tests/e2e/remote-persist.spec.ts).
 *
 * Registered by install-sharing.ts only when `import.meta.env.DEV` (Vite dev server, which is what
 * Playwright runs) AND localStorage `rd.fakeRemote` is `'1'`. Production builds replace
 * `import.meta.env.DEV` with `false`, so the call and this module are dropped from the bundle.
 *
 * The "remote" store is localStorage `rd.fakeRemote.files` = `{ [path]: { xml, version } }`
 * (version = "v<n>", +1 per save; a save with another expected version is a conflict), so it
 * survives page reloads like a real server. "Signed in" lives in sessionStorage
 * `rd.fakeRemote.account` (a test can clear it to get the sign-in prompt). `window.__rdFakeRemote`
 * lets a test read/modify the store.
 */
import type {
  BrowseEntry,
  BrowseListing,
  ConflictBehavior,
  RemoteAccount,
  RemoteFileContent,
  RemoteFileInfo,
  SaveResult,
  StorageProvider,
  StorageProviderDescriptor,
} from '../share/providers/types';

export const FAKE_REMOTE_ID = 'fake-remote';
const ENABLE_KEY = 'rd.fakeRemote';
const FILES_KEY = 'rd.fakeRemote.files';
const ACCOUNT_KEY = 'rd.fakeRemote.account';
const LOG_KEY = 'rd.fakeRemote.log';

interface FakeFile {
  xml: string;
  version: string;
}

interface FakeRef {
  path: string;
}

function readFiles(): Record<string, FakeFile> {
  try {
    const raw = JSON.parse(localStorage.getItem(FILES_KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Record<string, FakeFile>) : {};
  } catch {
    return {};
  }
}

function writeFiles(files: Record<string, FakeFile>): void {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

function log(entry: Record<string, unknown>): void {
  try {
    const list = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as unknown[];
    list.push({ ...entry, at: Date.now() });
    localStorage.setItem(LOG_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function nextVersion(version: string | undefined): string {
  const n = Number(/^v(\d+)$/.exec(version ?? '')?.[1] ?? 0);
  return `v${n + 1}`;
}

const ROOT: BrowseEntry = { kind: 'container', id: 'repo', name: 'Test repo', data: { t: 'repo' } };

class FakeRemoteProvider implements StorageProvider {
  readonly id = FAKE_REMOTE_ID;
  readonly label = 'Test storage';
  readonly openExtensions = ['.drawio', '.xml'];

  getAccount(): RemoteAccount | null {
    try {
      return sessionStorage.getItem(ACCOUNT_KEY) ? { name: 'Test user' } : null;
    } catch {
      return null;
    }
  }

  async signIn(): Promise<RemoteAccount> {
    sessionStorage.setItem(ACCOUNT_KEY, '1');
    log({ op: 'signIn' });
    return { name: 'Test user' };
  }

  async signOut(): Promise<void> {
    sessionStorage.removeItem(ACCOUNT_KEY);
  }

  private requireAccount(): void {
    if (!this.getAccount()) throw new Error('Not signed in to Test storage');
  }

  async list(path: BrowseEntry[]): Promise<BrowseListing> {
    this.requireAccount();
    if (path.length === 0) return { entries: [ROOT] };
    const entries = Object.keys(readFiles())
      .sort()
      .map((name): BrowseEntry => ({ kind: 'file', id: `file:${name}`, name, data: { path: name } }));
    return { entries };
  }

  canSaveAt(path: BrowseEntry[]): boolean {
    return path.length === 1;
  }

  private info(path: string, version: string): RemoteFileInfo {
    return { providerId: this.id, ref: { path } satisfies FakeRef, version, name: path, location: `Test repo › ${path}`, parentPath: [ROOT] };
  }

  private read(path: string): RemoteFileContent {
    this.requireAccount();
    const file = readFiles()[path];
    if (!file) throw new Error(`"${path}" not found`);
    log({ op: 'open', path, version: file.version });
    return { ...this.info(path, file.version), xml: file.xml };
  }

  async open(_path: BrowseEntry[], file: BrowseEntry): Promise<RemoteFileContent> {
    return this.read((file.data as FakeRef).path);
  }

  async reopen(file: RemoteFileInfo): Promise<RemoteFileContent> {
    return this.read((file.ref as FakeRef).path);
  }

  async save(file: RemoteFileInfo, xml: string, expectedVersion: string | null): Promise<SaveResult> {
    this.requireAccount();
    const path = (file.ref as FakeRef).path;
    const files = readFiles();
    const current = files[path];
    if (expectedVersion !== null && current && current.version !== expectedVersion) {
      log({ op: 'conflict', path, expectedVersion, current: current.version });
      return { ok: false, reason: 'conflict', message: `"${path}" was changed in Test storage since you opened or last saved it.` };
    }
    const version = nextVersion(current?.version);
    files[path] = { xml, version };
    writeFiles(files);
    log({ op: 'save', path, expectedVersion, version });
    return { ok: true, file: this.info(path, version) };
  }

  async saveAs(_path: BrowseEntry[], name: string, xml: string, conflict: ConflictBehavior): Promise<SaveResult> {
    this.requireAccount();
    const files = readFiles();
    let path = name;
    if (files[path]) {
      if (conflict === 'fail') return { ok: false, reason: 'exists', message: `A file named "${name}" already exists.` };
      if (conflict === 'rename') {
        const stem = name.replace(/\.[^.]+$/, '');
        const ext = /\.[^.]+$/.exec(name)?.[0] ?? '.drawio';
        for (let n = 2; files[path]; n++) path = `${stem} (${n})${ext}`;
      }
    }
    const version = nextVersion(files[path]?.version);
    files[path] = { xml, version };
    writeFiles(files);
    log({ op: 'saveAs', path, version });
    return { ok: true, file: this.info(path, version) };
  }
}

export interface FakeRemoteHandle {
  files(): Record<string, FakeFile>;
  put(path: string, xml: string): string;
  log(): unknown[];
}

/** The test provider when enabled (dev server + localStorage `rd.fakeRemote` = '1'), else null. */
export function createFakeRemoteDescriptor(): StorageProviderDescriptor | null {
  try {
    if (localStorage.getItem(ENABLE_KEY) !== '1') return null;
  } catch {
    return null;
  }
  const provider = new FakeRemoteProvider();
  const handle: FakeRemoteHandle = {
    files: readFiles,
    /** Writes a file as "someone else" (new version), returns the version. */
    put: (path, xml) => {
      const files = readFiles();
      const version = nextVersion(files[path]?.version);
      files[path] = { xml, version };
      writeFiles(files);
      return version;
    },
    log: () => JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as unknown[],
  };
  (window as unknown as { __rdFakeRemote?: FakeRemoteHandle }).__rdFakeRemote = handle;
  console.warn('[FakeRemote] Test storage provider enabled (dev only)');
  return {
    id: FAKE_REMOTE_ID,
    label: provider.label,
    description: 'Test-only provider (dev server)',
    availability: () => ({ state: 'ready' }),
    load: async () => provider,
  };
}
