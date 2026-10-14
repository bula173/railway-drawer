import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAWIO_ROOT_ID, startEditor } from '../boot';
import type { StartedEditor } from '../boot';
import { EDITOR_MODE_STORAGE_KEY } from '../editorMode';
import { resetErtmsLibraryCache } from '../ertmsLibrary';

const LIBRARY =
  '<mxlibrary>[{"xml":"&lt;mxGraphModel&gt;&lt;root/&gt;&lt;/mxGraphModel&gt;","w":10,"h":10}]</mxlibrary>';

let started: StartedEditor | null = null;

beforeEach(() => {
  localStorage.removeItem(EDITOR_MODE_STORAGE_KEY);
  resetErtmsLibraryCache();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(LIBRARY, { status: 200 }))));
});

afterEach(() => {
  started?.drawio?.dispose();
  started = null;
  document.getElementById(DRAWIO_ROOT_ID)?.remove();
  delete document.body.dataset.editor;
  localStorage.removeItem(EDITOR_MODE_STORAGE_KEY);
  vi.unstubAllGlobals();
});

describe('startEditor', () => {
  it('boots the legacy editor by default', async () => {
    const loadLegacy = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadLegacy, search: '' });
    expect(started.mode).toBe('legacy');
    expect(loadLegacy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.body.dataset.editor).toBe('legacy');
  });

  it('mounts the draw.io workspace for ?editor=drawio without booting legacy', async () => {
    const loadLegacy = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadLegacy, search: '?editor=drawio' });
    expect(started.mode).toBe('drawio');
    expect(loadLegacy).not.toHaveBeenCalled();
    const embed = document.querySelector(`#${DRAWIO_ROOT_ID} [data-testid="drawio-embed"]`);
    const iframe = embed?.querySelector('iframe[title="draw.io editor"]');
    expect(iframe?.getAttribute('src')).toContain('proto=json');
    const labels = Array.from(document.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toContain('Download .drawio');
    expect(document.body.dataset.editor).toBe('drawio');
    expect(localStorage.getItem(EDITOR_MODE_STORAGE_KEY)).toBe('drawio');
  });

  it('uses the remembered mode when the URL has no editor parameter', async () => {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, 'drawio');
    const loadLegacy = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadLegacy, search: '' });
    expect(started.mode).toBe('drawio');
    expect(document.querySelector('[data-testid="drawio-embed"]')).not.toBeNull();
  });

  it('lets ?editor=legacy override the remembered mode', async () => {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, 'drawio');
    const loadLegacy = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadLegacy, search: '?editor=legacy' });
    expect(started.mode).toBe('legacy');
    expect(loadLegacy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(EDITOR_MODE_STORAGE_KEY)).toBe('legacy');
  });

  it('mounts into a provided root', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    started = await startEditor({ loadLegacy: () => Promise.resolve(), search: '?editor=drawio', drawioRoot: root });
    expect(root.querySelector('[data-testid="drawio-embed"]')).not.toBeNull();
    expect(document.getElementById(DRAWIO_ROOT_ID)).toBeNull();
    root.remove();
  });
});
