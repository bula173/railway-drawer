/**
 * @file remote-binding.ts
 * @brief The persisted form of a tab's remote-file binding (stored with the tab in the browser
 *        cache, `CacheData.tabs[].remote`), so Ctrl+S still saves back after a page reload.
 *
 * Format version 1:
 *   { v: 1, providerId, ref, version, name, location, webUrl?, parentPath, savedAt, dirty }
 * - `ref` / `parentPath[].data` are the provider's JSON-serializable address data (no secrets:
 *   providers keep tokens in their own storage). As a guard, keys that look like credentials are
 *   dropped on both write and read.
 * - `savedAt`: time of the last successful open/save from/to the provider.
 * - `dirty`: the tab had changes not yet saved to the provider when it was cached.
 * Unknown versions and malformed entries are ignored (the tab opens unbound, the diagram is kept).
 */
import type { BrowseEntry, RemoteFileInfo } from './providers/types';

export const REMOTE_BINDING_FORMAT = 1;

export interface PersistedRemoteBinding {
  v: typeof REMOTE_BINDING_FORMAT;
  providerId: string;
  ref: unknown;
  version: string;
  name: string;
  location: string;
  webUrl?: string;
  parentPath: BrowseEntry[];
  savedAt: number;
  dirty: boolean;
}

export interface RestoredRemoteBinding {
  file: RemoteFileInfo;
  savedAt: number;
  dirty: boolean;
}

/** Keys never written to the cache, whatever a provider put into its ref data. */
const SECRET_KEY = /token|secret|password|passwd|credential|authorization|bearer|cookie|^code_?verifier$/i;
const MAX_DEPTH = 8;
/** A binding is small; anything bigger is not one. */
const MAX_JSON_LENGTH = 64 * 1024;

/** A JSON-only copy without credential-like keys; undefined when not JSON data. */
function cleanJson(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value.map((item) => cleanJson(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) continue;
      const cleaned = cleanJson(item, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanPath(value: unknown): BrowseEntry[] | null {
  if (!Array.isArray(value)) return null;
  const path: BrowseEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { kind, id, name } = entry;
    if ((kind !== 'container' && kind !== 'folder' && kind !== 'file') || typeof id !== 'string' || typeof name !== 'string') return null;
    path.push({
      kind,
      id,
      name,
      ...(typeof entry.detail === 'string' ? { detail: entry.detail } : {}),
      data: cleanJson(entry.data) ?? null,
    });
  }
  return path;
}

/** The cache form of a binding. */
export function serializeRemoteBinding(file: RemoteFileInfo, state: { savedAt: number; dirty: boolean }): PersistedRemoteBinding {
  return {
    v: REMOTE_BINDING_FORMAT,
    providerId: file.providerId,
    ref: cleanJson(file.ref) ?? null,
    version: file.version,
    name: file.name,
    location: file.location,
    ...(file.webUrl ? { webUrl: file.webUrl } : {}),
    parentPath: cleanPath(file.parentPath) ?? [],
    savedAt: state.savedAt,
    dirty: state.dirty,
  };
}

/** Reads a cached binding; null when missing, malformed or of an unknown format version. */
export function parseRemoteBinding(raw: unknown): RestoredRemoteBinding | null {
  if (!isRecord(raw) || raw.v !== REMOTE_BINDING_FORMAT) return null;
  try {
    if (JSON.stringify(raw).length > MAX_JSON_LENGTH) return null;
  } catch {
    return null;
  }
  const { providerId, version, name, location } = raw;
  if (typeof providerId !== 'string' || !providerId) return null;
  if (typeof version !== 'string' || typeof name !== 'string' || !name || typeof location !== 'string') return null;
  const parentPath = cleanPath(raw.parentPath ?? []);
  if (!parentPath) return null;
  const ref = cleanJson(raw.ref);
  if (ref === undefined || ref === null) return null;
  const savedAt = typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : 0;
  return {
    file: {
      providerId,
      ref,
      version,
      name,
      location,
      ...(typeof raw.webUrl === 'string' && /^https?:\/\//i.test(raw.webUrl) ? { webUrl: raw.webUrl } : {}),
      parentPath,
    },
    savedAt,
    // Unknown = assume unsaved changes (the safe side: a warning too many, never lost work)
    dirty: raw.dirty !== false,
  };
}

/** Cheap content fingerprint (FNV-1a 32 + length) to tell "changed since the last remote save". */
export function contentFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}
