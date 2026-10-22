/**
 * @file headless.ts
 * @brief Installs a jsdom window as the global DOM (maxGraph and the app modules need one), then
 *        loads headless-core.ts. Used by the local MCP server when no browser is connected and
 *        RAILWAY_DRAWER_FILE names a .drawio file.
 */
import type { HeadlessSession } from './headless-core';

let installed = false;

export async function installDomGlobals(): Promise<void> {
  if (installed || typeof (globalThis as { document?: unknown }).document !== 'undefined') {
    installed = true;
    return;
  }
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
  const win = dom.window as unknown as Record<string, unknown>;
  const g = globalThis as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(win)) {
    if (key in g) continue;
    try {
      g[key] = win[key];
    } catch {
      // read-only global
    }
  }
  for (const key of ['window', 'self', 'document', 'navigator', 'location', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    Object.defineProperty(g, key, { value: key === 'window' || key === 'self' ? win : win[key], configurable: true, writable: true });
  }
  installed = true;
}

export async function openHeadless(path: string, publicDir: string, log: (m: string) => void): Promise<HeadlessSession> {
  await installDomGlobals();
  const core = await import('./headless-core');
  return core.openDrawioFile(path, publicDir, log);
}
