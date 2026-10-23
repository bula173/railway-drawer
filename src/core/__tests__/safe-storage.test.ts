import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  getStorage,
  parseStringArray,
  readFlag,
  readItem,
  readJson,
  removeItem,
  writeFlag,
  writeItem,
  writeItemOrThrow,
  writeItemResult,
  writeJson,
} from '../safe-storage';
import { STORAGE_KEYS } from '../storage-keys';

const SRC = join(__dirname, '..', '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__') walk(path);
      } else if (name.endsWith('.ts')) out.push(path);
    }
  };
  walk(SRC);
  return out;
}

/** Code without comments and string literals (so prose and messages may say "localStorage"). */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('safe-storage', () => {
  it('reads, writes and removes in both areas', () => {
    expect(writeItem('t.k', 'v')).toBe(true);
    expect(readItem('t.k')).toBe('v');
    expect(readItem('t.k', 'session')).toBeNull();
    expect(writeItem('t.k', 's', 'session')).toBe(true);
    expect(readItem('t.k', 'session')).toBe('s');
    expect(removeItem('t.k')).toBe(true);
    expect(readItem('t.k')).toBeNull();
  });

  it('never throws when storage throws, and reports the write error', () => {
    const quota = new DOMException('full', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota; });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readItem('t.k')).toBeNull();
    expect(writeItem('t.k', 'v')).toBe(false);
    expect(writeItemResult('t.k', 'v')).toEqual({ ok: false, error: quota });
    expect(() => writeItemOrThrow('t.k', 'v')).toThrow(quota);
    expect(removeItem('t.k')).toBe(false);
    expect(readFlag('t.k', true)).toBe(true);
    expect(readJson('t.k', parseStringArray)).toBeNull();
  });

  it('survives storage that cannot even be accessed', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    expect(getStorage('local')).toBeNull();
    expect(readItem('t.k')).toBeNull();
    expect(writeItem('t.k', 'v')).toBe(false);
  });

  it('validates JSON with the caller parser', () => {
    expect(writeJson('t.j', ['a', 1, 'b'])).toBe(true);
    expect(readJson('t.j', parseStringArray)).toEqual(['a', 'b']);
    writeItem('t.j', '{not json');
    expect(readJson('t.j', parseStringArray)).toBeNull();
    writeItem('t.j', '{"a":1}');
    expect(readJson('t.j', parseStringArray)).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(writeJson('t.j', cyclic)).toBe(false);
  });

  it("reads '1'/'0' flags with a fallback for anything else", () => {
    expect(readFlag('t.f', true)).toBe(true);
    expect(readFlag('t.f', false)).toBe(false);
    writeFlag('t.f', false);
    expect(readFlag('t.f', true)).toBe(false);
    writeFlag('t.f', true);
    expect(readFlag('t.f', false)).toBe(true);
    writeItem('t.f', 'garbage');
    expect(readFlag('t.f', true)).toBe(true);
    expect(readFlag('t.f', false)).toBe(false);
  });
});

describe('storage key registry', () => {
  it('keeps the stored key strings (compatibility with existing browser data)', () => {
    // A rename here loses users' data: these strings are stored in browsers and read by index.html / e2e specs
    expect(STORAGE_KEYS.cache).toBe('railway-drawer-cache');
    expect(STORAGE_KEYS.cacheStale).toBe('railway-drawer-cache-stale');
    expect(STORAGE_KEYS.theme).toBe('rd.theme');
    expect(STORAGE_KEYS.templates).toBe('railway-drawer-templates');
    expect(STORAGE_KEYS.shapeToolbarGroupOrder).toBe('shapeToolbarGroupOrder');
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(v).toMatch(/^(railway-drawer-[a-z-]+|rd\.[A-Za-z.]+|shapeToolbarGroupOrder)$/);
  });

  it('every stored key string is defined only in storage-keys.ts', () => {
    const keys = new Set<string>(Object.values(STORAGE_KEYS));
    const offenders: string[] = [];
    for (const f of sourceFiles()) {
      const rel = relative(SRC, f).replace(/\\/g, '/');
      if (rel === 'core/storage-keys.ts') continue;
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
      for (const m of text.matchAll(/'([^'\n]+)'|"([^"\n]+)"/g)) {
        const lit = m[1] ?? m[2];
        if (keys.has(lit)) offenders.push(`${rel}: ${lit}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('no raw Web Storage access outside safe-storage.ts', () => {
  /**
   * Allowed exceptions (each needs a reason):
   * - gitlab/auth-bridge.ts runs on the OAuth bridge page against an injected `win` (testable without globals).
   */
  const ALLOWED = new Set(['core/safe-storage.ts', 'share/providers/gitlab/auth-bridge.ts']);

  it('finds no localStorage / sessionStorage identifiers in code', () => {
    const offenders: string[] = [];
    for (const f of sourceFiles()) {
      const rel = relative(SRC, f).replace(/\\/g, '/');
      if (ALLOWED.has(rel)) continue;
      const code = codeOnly(readFileSync(f, 'utf8'));
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (/\b(localStorage|sessionStorage)\b/.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
