import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInstallScope, installedKeys, installOnce, isInstalled } from '../install-once';

describe('installOnce', () => {
  it('runs an install once per target and key', () => {
    const a = {};
    const b = {};
    const install = vi.fn();
    expect(installOnce(a, 'x', install)).toBe(true);
    expect(installOnce(a, 'x', install)).toBe(false);
    expect(installOnce(b, 'x', install)).toBe(true);
    expect(installOnce(a, 'y')).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
    expect(isInstalled(a, 'x')).toBe(true);
    expect(isInstalled(a, 'z')).toBe(false);
    expect(installedKeys(a)).toEqual(['x', 'y']);
  });

  it('keeps its marks out of enumeration and serialisation', () => {
    const a: Record<string, unknown> = { v: 1 };
    installOnce(a, 'x');
    expect(Object.keys(a)).toEqual(['v']);
    expect(JSON.stringify(a)).toBe('{"v":1}');
    expect({ ...a }).toEqual({ v: 1 });
  });

  it('gives page-wide installs separate scopes', () => {
    const s1 = createInstallScope();
    const s2 = createInstallScope();
    expect(installOnce(s1, 'page')).toBe(true);
    expect(installOnce(s2, 'page')).toBe(true);
    expect(installOnce(s1, 'page')).toBe(false);
  });

  it('is the only "install once" scheme in src (no private symbol / WeakSet / flag marks)', () => {
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__') walk(path);
        } else if (name.endsWith('.ts')) {
          const text = readFileSync(path, 'utf8');
          if (/(INSTALLED|Installed)\s*=\s*(new WeakSet|Symbol(\.for)?\()/.test(text) || /^let installed = false\b/m.test(text)) {
            offenders.push(relative(root, path));
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
