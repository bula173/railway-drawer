/**
 * @file index.ts
 * @brief SharePoint / OneDrive provider descriptor (main bundle). The implementation (MSAL, Graph
 *        client) is a dynamic import that only exists in builds with VITE_MSAL_CLIENT_ID set: the
 *        `define` in vite.config.ts makes the condition below a constant, so unconfigured builds
 *        contain no Microsoft code at all.
 */
import type { StorageProvider, StorageProviderDescriptor } from '../types';
import { readSharePointConfig, sharePointAvailability } from './config';
import type { SharePointEnv } from './config';
import { PENDING_SIGNIN_KEY_NAME } from './pending';

export { isAuthResponseUrl, readSharePointConfig, sharePointAvailability } from './config';

const loadImplementation = import.meta.env.VITE_MSAL_CLIENT_ID ? () => import('./sharepoint-loader') : null;

export interface SharePointDescriptorOptions {
  /** Flush unsaved work before a redirect sign-in leaves the page. */
  beforeRedirect?: () => void;
  /** Tests: configuration values instead of the build-time ones. */
  env?: SharePointEnv;
  location?: Pick<Location, 'protocol' | 'hostname'>;
}

export function createSharePointDescriptor(opts: SharePointDescriptorOptions = {}): StorageProviderDescriptor {
  const config = readSharePointConfig(opts.env);
  let loading: Promise<StorageProvider> | null = null;
  const descriptor: StorageProviderDescriptor = {
    id: 'sharepoint',
    label: 'SharePoint',
    description: 'Save, open and share .drawio files in SharePoint and OneDrive for Business (Microsoft 365 work account).',
    availability: () => sharePointAvailability(config, opts.location ?? window.location),
    load: () => {
      if (descriptor.availability().state !== 'ready' || !config || !loadImplementation) {
        return Promise.reject(new Error('SharePoint is not available in this deployment'));
      }
      loading ??= loadImplementation()
        .then((m) => m.createSharePointProvider(config, { beforeRedirect: opts.beforeRedirect }))
        .catch((err: unknown) => {
          loading = null;
          throw err;
        });
      return loading;
    },
    resumePendingSignIn: async () => {
      let pending = false;
      try {
        pending = sessionStorage.getItem(PENDING_SIGNIN_KEY_NAME) === 'sharepoint';
      } catch {
        pending = false;
      }
      if (!pending || descriptor.availability().state !== 'ready') return null;
      return descriptor.load();
    },
  };
  return descriptor;
}
