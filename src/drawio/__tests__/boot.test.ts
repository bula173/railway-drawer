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
  it('boots the main editor by default', async () => {
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '' });
    expect(started.mode).toBe('main');
    expect(loadMain).toHaveBeenCalledTimes(1);
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.body.dataset.editor).toBe('main');
  });

  it('mounts the draw.io workspace for ?editor=drawio without booting the main editor', async () => {
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '?editor=drawio' });
    expect(started.mode).toBe('drawio');
    expect(loadMain).not.toHaveBeenCalled();
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
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '' });
    expect(started.mode).toBe('drawio');
    expect(document.querySelector('[data-testid="drawio-embed"]')).not.toBeNull();
  });

  it('lets ?editor=main override the remembered mode', async () => {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, 'drawio');
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '?editor=main' });
    expect(started.mode).toBe('main');
    expect(loadMain).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(EDITOR_MODE_STORAGE_KEY)).toBe('main');
  });

  it('still accepts the former name: ?editor=legacy opens the main editor', async () => {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, 'drawio');
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '?editor=legacy' });
    expect(started.mode).toBe('main');
    expect(loadMain).toHaveBeenCalledTimes(1);
    expect(document.body.dataset.editor).toBe('main');
    expect(localStorage.getItem(EDITOR_MODE_STORAGE_KEY)).toBe('main');
  });

  it('still accepts the former name: a stored "legacy" choice opens the main editor and is migrated', async () => {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, 'legacy');
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '' });
    expect(started.mode).toBe('main');
    expect(loadMain).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(EDITOR_MODE_STORAGE_KEY)).toBe('main');
  });

  it('opens a #R diagram link in the main editor without changing the remembered mode', async () => {
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, 'drawio');
    const loadMain = vi.fn(() => Promise.resolve());
    started = await startEditor({ loadMain, search: '?editor=drawio', hash: '#Rabc' });
    expect(started.mode).toBe('main');
    expect(loadMain).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(EDITOR_MODE_STORAGE_KEY)).toBe('drawio');
  });

  it('mounts into a provided root', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    started = await startEditor({ loadMain: () => Promise.resolve(), search: '?editor=drawio', drawioRoot: root });
    expect(root.querySelector('[data-testid="drawio-embed"]')).not.toBeNull();
    expect(document.getElementById(DRAWIO_ROOT_ID)).toBeNull();
    root.remove();
  });
});
