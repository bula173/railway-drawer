/**
 * @file index.ts
 * @brief GitLab provider descriptor (main bundle): availability from the build-time env and the
 *        runtime settings, the settings form, `?gitlab=` links, and the lazy implementation chunk
 *        (OAuth + REST client), which is only downloaded when GitLab is configured and used.
 */
import { PENDING_SIGNIN_KEY_NAME } from '../pending';
import type { IncomingLink, ProviderSettings, SaveFieldValues, StorageProvider, StorageProviderDescriptor } from '../types';
import {
  GITLAB_PENDING_OPEN_KEY,
  GITLAB_PROVIDER_ID,
  buildTimeGitLabEnv,
  clearGitLabTokens,
  gitLabAvailability,
  gitLabRedirectUri,
  isValidProjectRef,
  moveGitLabTokens,
  normalizeGitLabUrl,
  parseGitLabLinkParam,
  readGitLabSettings,
  resolveGitLabConfig,
  stripGitLabLinkParam,
  writeGitLabSettings,
} from './config';
import type { GitLabConfig, GitLabEnv, GitLabLinkTarget } from './config';
import { getStorage } from '../../../core/safe-storage';

export {
  buildGitLabAppLink,
  isGitLabAuthResponseUrl,
  parseGitLabLinkParam,
  resolveGitLabConfig,
  gitLabAvailability,
} from './config';

type LoadedProvider = StorageProvider & { takeRedirectError?(): string | null };

interface GitLabProviderModule {
  createGitLabProvider(config: GitLabConfig, opts: { beforeRedirect?: () => void }): Promise<LoadedProvider>;
}

export interface GitLabDescriptorOptions {
  beforeRedirect?: () => void;
  /** Tests: build-time values instead of import.meta.env. */
  env?: GitLabEnv;
  location?: Pick<Location, 'protocol' | 'hostname' | 'origin' | 'pathname' | 'search' | 'hash'>;
  history?: Pick<History, 'replaceState' | 'state'>;
  /** Tests: replaces the dynamic import. */
  loadModule?: () => Promise<GitLabProviderModule>;
}

function session(): Storage | null {
  try {
    return getStorage('session');
  } catch {
    return null;
  }
}

function text(values: SaveFieldValues, key: string): string {
  const value = values[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function createGitLabDescriptor(opts: GitLabDescriptorOptions = {}): StorageProviderDescriptor {
  const env = opts.env ?? buildTimeGitLabEnv();
  const location = opts.location ?? window.location;
  const loadModule = opts.loadModule ?? ((): Promise<GitLabProviderModule> => import('./gitlab-loader'));
  const config = (): GitLabConfig | null => resolveGitLabConfig(env, readGitLabSettings());
  let loaded: { key: string; promise: Promise<LoadedProvider> } | null = null;
  const loadProvider = (): Promise<LoadedProvider> => {
    const current = config();
    if (!current || gitLabAvailability(current, location).state !== 'ready') {
      return Promise.reject(new Error('GitLab is not configured'));
    }
    const key = `${current.url}|${current.clientId}|${current.defaultProject ?? ''}|${current.staySignedIn}`;
    if (loaded?.key !== key) {
      const promise = loadModule()
        .then((m) => m.createGitLabProvider(current, { beforeRedirect: opts.beforeRedirect }))
        .catch((err: unknown) => {
          if (loaded?.promise === promise) loaded = null;
          throw err;
        });
      loaded = { key, promise };
    }
    return loaded.promise;
  };

  // A `?gitlab=` link: remembered for this tab (it survives a sign-in redirect), removed from the URL
  const target = parseGitLabLinkParam(location.search);
  if (target) {
    try {
      session()?.setItem(GITLAB_PENDING_OPEN_KEY, JSON.stringify(target));
    } catch {
      // storage blocked: the link still opens in this page load
    }
    stripGitLabLinkParam({ location, history: opts.history ?? window.history } as Pick<Window, 'location' | 'history'>);
  }
  let memoryTarget: GitLabLinkTarget | null = target;

  const settings: ProviderSettings = {
    fields: [
      { id: 'url', label: 'GitLab URL', kind: 'text', placeholder: 'https://gitlab.com or http://gitlab.local' },
      { id: 'clientId', label: 'OAuth application ID', kind: 'text', placeholder: 'Application ID of the GitLab OAuth application' },
      { id: 'defaultProject', label: 'Default project (optional)', kind: 'text', placeholder: 'group/project' },
      {
        id: 'staySignedIn',
        label: 'Stay signed in on this computer',
        kind: 'checkbox',
        hint:
          'Keeps the GitLab token in this browser (localStorage) after the tab is closed. Anyone using this browser ' +
          'profile, and any script running on this site, could use it until it expires or you sign out. ' +
          'Leave it off on shared computers; then the sign-in lasts until the tab is closed.',
      },
    ],
    values: () => {
      const s = readGitLabSettings();
      return {
        url: s.url ?? env.VITE_GITLAB_URL ?? '',
        clientId: s.clientId ?? env.VITE_GITLAB_CLIENT_ID ?? '',
        defaultProject: s.defaultProject ?? env.VITE_GITLAB_DEFAULT_PROJECT ?? '',
        staySignedIn: s.staySignedIn === true,
      };
    },
    save: (values) => {
      const url = text(values, 'url');
      const clientId = text(values, 'clientId');
      const defaultProject = text(values, 'defaultProject');
      if (url && !normalizeGitLabUrl(url)) throw new Error('The GitLab URL must start with https:// or http:// (e.g. https://gitlab.com).');
      if (defaultProject && !isValidProjectRef(defaultProject)) throw new Error('The default project must be group/project or a numeric project id.');
      if (clientId && !/^[\w-]+$/.test(clientId)) throw new Error('The application ID contains unexpected characters.');
      const before = config();
      const same = (value: string, fallback: string | undefined): string | undefined => (value && value !== (fallback ?? '').trim() ? value : undefined);
      const staySignedIn = values.staySignedIn === true;
      // Only differences from the build-time defaults are stored, so a rebuilt default still applies
      writeGitLabSettings({
        url: same(url, env.VITE_GITLAB_URL),
        clientId: same(clientId, env.VITE_GITLAB_CLIENT_ID),
        defaultProject: same(defaultProject, env.VITE_GITLAB_DEFAULT_PROJECT),
        staySignedIn,
      });
      const after = config();
      if (before?.url !== after?.url || before?.clientId !== after?.clientId) clearGitLabTokens();
      else if ((before?.staySignedIn ?? false) !== staySignedIn) moveGitLabTokens(staySignedIn);
    },
    reset: () => {
      writeGitLabSettings({});
      clearGitLabTokens();
    },
    hint: () =>
      `Register this redirect URI in the GitLab application: ${gitLabRedirectUri(location)} — scope "api", ` +
      '"Confidential" off. These settings are stored in this browser only.' +
      (env.VITE_GITLAB_URL ? ` Build-time default: ${env.VITE_GITLAB_URL}.` : ''),
  };

  const descriptor: StorageProviderDescriptor = {
    id: GITLAB_PROVIDER_ID,
    label: 'GitLab',
    description: 'Open and save .drawio files in GitLab repositories (gitlab.com or your own GitLab): every save is a commit; branches and merge requests.',
    availability: () => gitLabAvailability(config(), location),
    load: loadProvider,
    resumePendingSignIn: async () => {
      let pending = false;
      try {
        pending = session()?.getItem(PENDING_SIGNIN_KEY_NAME) === GITLAB_PROVIDER_ID;
      } catch {
        pending = false;
      }
      if (!pending || descriptor.availability().state !== 'ready') return null;
      const provider = await loadProvider();
      const error = provider.takeRedirectError?.();
      if (error) throw new Error(error);
      return provider;
    },
    settings,
    incomingLink: (): IncomingLink | null => {
      let t: GitLabLinkTarget | null = memoryTarget;
      try {
        const raw = session()?.getItem(GITLAB_PENDING_OPEN_KEY);
        if (raw) t = JSON.parse(raw) as GitLabLinkTarget;
      } catch {
        // keep the in-memory one
      }
      if (!t || typeof t.project !== 'string' || typeof t.path !== 'string') return null;
      return { ref: t, label: `${t.project} › ${t.branch || 'default branch'} › ${t.path}` };
    },
    clearIncomingLink: () => {
      memoryTarget = null;
      try {
        session()?.removeItem(GITLAB_PENDING_OPEN_KEY);
      } catch {
        // ignore
      }
    },
  };
  return descriptor;
}
