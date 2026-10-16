/**
 * @file registry.ts
 * @brief The cloud storage providers, in the order the UI shows them (SharePoint first).
 *        A new provider (GitLab, ...) adds its descriptor here; the Share dialog, the File menu
 *        items and the Open from/Save to dialogs render every entry generically.
 */
import { createSharePointDescriptor } from './sharepoint';
import type { StorageProviderDescriptor } from './types';

export interface ProviderRegistryOptions {
  /** Flush unsaved work before a sign-in redirect leaves the page. */
  beforeRedirect?: () => void;
}

export function createStorageProviders(opts: ProviderRegistryOptions = {}): StorageProviderDescriptor[] {
  return [createSharePointDescriptor({ beforeRedirect: opts.beforeRedirect })];
}
