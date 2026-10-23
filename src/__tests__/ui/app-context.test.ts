import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { appContext, provideAppContext, type AppContext } from '../../ui/app-context';

const SRC = join(__dirname, '..', '..');

afterEach(() => provideAppContext(null));

describe('AppContext', () => {
  it('is provided once by the shell and read where needed', () => {
    expect(appContext()).toBeNull();
    const ctx = { leftPanelTabs: { switchTab: () => undefined } } as unknown as AppContext;
    provideAppContext(ctx);
    expect(appContext()).toBe(ctx);
  });

  it('src sets no window globals (only the dev/e2e fake remote hook)', () => {
    const ALLOWED = new Set(['debug/fake-remote-provider.ts']);
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__') walk(path);
        } else if (name.endsWith('.ts')) {
          const rel = relative(SRC, path).replace(/\\/g, '/');
          if (ALLOWED.has(rel)) continue;
          const code = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
          if (/\(\s*(window|globalThis)\s+as\b[^)]*\)\s*\.__\w+\s*=[^=]|\b(window|globalThis)\.__\w+\s*=[^=]/.test(code)) offenders.push(rel);
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
