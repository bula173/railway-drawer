import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { emit, off, on } from '../event-bus';

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

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

describe('event bus', () => {
  it('delivers the typed detail in registration order and removes listeners', () => {
    const calls: string[] = [];
    const a = (d: { tabId: string }): void => { calls.push(`a:${d.tabId}`); };
    const b = (d: { tabId: string }): void => { calls.push(`b:${d.tabId}`); };
    const offA = on('tab-changed', a);
    on('tab-changed', b);
    on('tab-changed', b); // same listener twice: once, like addEventListener
    emit('tab-changed', { tabId: 't1' });
    offA();
    emit('tab-changed', { tabId: 't2' });
    off('tab-changed', b);
    emit('tab-changed', { tabId: 't3' });
    expect(calls).toEqual(['a:t1', 'b:t1', 'b:t2']);
  });

  it('events without detail need none', () => {
    const fn = vi.fn();
    const dispose = on('share-request', fn);
    emit('share-request');
    dispose();
    emit('share-request');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(undefined);
  });

  it('a throwing listener does not stop the others (window event semantics)', () => {
    const second = vi.fn();
    const onError = vi.fn((e: ErrorEvent) => e.preventDefault());
    window.addEventListener('error', onError);
    const d1 = on('railway-checks-request', () => { throw new Error('boom'); });
    const d2 = on('railway-checks-request', second);
    try {
      emit('railway-checks-request');
    } finally {
      d1();
      d2();
      window.removeEventListener('error', onError);
    }
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('is not a window event any more', () => {
    const fn = vi.fn();
    window.addEventListener('tab-closed', fn);
    emit('tab-closed', { tabId: 'x' });
    window.removeEventListener('tab-closed', fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('no app events outside the bus', () => {
  const busSource = readFileSync(join(SRC, 'core', 'event-bus.ts'), 'utf8');
  const map = busSource.slice(busSource.indexOf('export interface AppEventMap'), busSource.indexOf('export type AppEventName'));
  const names = [...map.matchAll(/^\s+'([a-z-]+)':/gm)].map((m) => m[1]);

  it('reads the event names of AppEventMap', () => {
    expect(names).toEqual(expect.arrayContaining(['tab-changed', 'tab-closed', 'railway-route-request', 'right-panel-view']));
  });

  it('creates no CustomEvent outside core/event-bus.ts', () => {
    const offenders = sourceFiles()
      .filter((f) => relative(SRC, f).replace(/\\/g, '/') !== 'core/event-bus.ts')
      .filter((f) => /new CustomEvent\b/.test(withoutComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('never sends or listens to a bus event name as a DOM event', () => {
    const offenders: string[] = [];
    const re = /\b(addEventListener|removeEventListener)\(\s*'([^']+)'/g;
    for (const f of sourceFiles()) {
      const text = withoutComments(readFileSync(f, 'utf8'));
      for (const m of text.matchAll(re)) {
        if (names.includes(m[2])) offenders.push(`${relative(SRC, f)}: ${m[1]}('${m[2]}')`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
