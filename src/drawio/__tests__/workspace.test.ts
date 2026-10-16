import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { mountDrawioWorkspace } from '../workspace';
import type { DrawioWorkspaceHandle, DrawioWorkspaceOptions } from '../workspace';
import { DRAWIO_AUTOSAVE_KEY, loadAutosave, saveAutosave } from '../drawioStorage';
import { resetErtmsLibraryCache } from '../ertmsLibrary';

const DRAWIO = 'https://embed.diagrams.net';
const DRAWIO_URL = `${DRAWIO}/`;
const OLD_XML = '<mxfile><diagram id="a">old</diagram></mxfile>';
const NEW_XML = '<mxfile><diagram id="b">new</diagram></mxfile>';
const LIBRARY =
  '<mxlibrary>[{"xml":"&lt;mxGraphModel&gt;&lt;root/&gt;&lt;/mxGraphModel&gt;","w":10,"h":10}]</mxlibrary>';

let root: HTMLElement;
let handle: DrawioWorkspaceHandle | null = null;
let postSpy: MockInstance<Window['postMessage']> | null = null;

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(opts: DrawioWorkspaceOptions = {}): DrawioWorkspaceHandle {
  handle = mountDrawioWorkspace(root, {
    drawioUrl: DRAWIO_URL,
    configPromise: Promise.resolve({}),
    onSwitchToLegacy: () => undefined,
    ...opts,
  });
  spyOnIframe();
  return handle;
}

function iframe(): HTMLIFrameElement {
  const frame = root.querySelector('iframe');
  if (!frame) throw new Error('no iframe mounted');
  return frame;
}

function embed(): HTMLElement {
  const node = root.querySelector<HTMLElement>('[data-testid="drawio-embed"]');
  if (!node) throw new Error('no embed mounted');
  return node;
}

/** Spies on postMessage of the currently mounted iframe (a remount creates a new window). */
function spyOnIframe() {
  postSpy = vi.spyOn(iframe().contentWindow as Window, 'postMessage').mockImplementation(() => undefined);
}

function emit(obj: unknown, source: MessageEventSource | null = iframe().contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(obj), origin: DRAWIO, source }));
}

function posted(): Array<Record<string, unknown>> {
  return (postSpy?.mock.calls ?? []).map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
}

/** Runs the configure/init/load handshake and returns the `load` action sent to the editor. */
async function handshake(): Promise<Record<string, unknown>> {
  emit({ event: 'configure' });
  await flush();
  emit({ event: 'init' });
  const load = posted().find((m) => m.action === 'load');
  emit({ event: 'load', xml: '' });
  if (!load) throw new Error('no load action posted');
  return load;
}

function button(name: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === name);
  if (!found) throw new Error(`no button "${name}"`);
  return found;
}

function status(): string {
  return root.querySelector('[role="status"]')?.textContent ?? '';
}

function openFile(name: string, content: string) {
  const input = root.querySelector<HTMLInputElement>('[data-testid="drawio-file-input"]');
  if (!input) throw new Error('no file input');
  const file = new File([content], name, { type: 'application/xml' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

async function waitUntil(condition: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met');
    await flush();
  }
}

beforeEach(() => {
  localStorage.removeItem(DRAWIO_AUTOSAVE_KEY);
  resetErtmsLibraryCache();
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  handle?.dispose();
  handle = null;
  postSpy = null;
  root.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('mountDrawioWorkspace DOM', () => {
  it('renders the toolbar and the draw.io iframe', () => {
    mount();
    const frame = iframe();
    expect(frame.title).toBe('draw.io editor');
    expect(frame.getAttribute('allow')).toBe('clipboard-read; clipboard-write');
    expect(frame.getAttribute('src')).toContain('proto=json');
    expect(frame.getAttribute('src')).toContain('configure=1');
    for (const name of ['New', 'Open…', 'Download .drawio', 'Export SVG', 'maxGraph editor']) {
      expect(button(name)).toBeTruthy();
    }
    expect(root.querySelector('.rdw-title')?.textContent).toBe('Untitled diagram');
    expect(embed().dataset.state).toBe('waiting-configure');
  });

  it('shows the stored title and loads the stored diagram on init', async () => {
    saveAutosave({ xml: OLD_XML, title: 'Station A' });
    mount();
    expect(root.querySelector('.rdw-title')?.textContent).toBe('Station A');
    const load = await handshake();
    expect(load).toMatchObject({ action: 'load', xml: OLD_XML, autosave: 1, title: 'Station A' });
  });

  it('shows the spinner until the editor is ready', async () => {
    mount();
    const spinner = root.querySelector<HTMLElement>('.rdw-spinner-overlay');
    expect(spinner?.hidden).toBe(false);
    await handshake();
    expect(embed().dataset.state).toBe('ready');
    expect(spinner?.hidden).toBe(true);
  });

  it('ignores messages from another window', async () => {
    mount();
    emit({ event: 'configure' }, window);
    await flush();
    expect(posted()).toHaveLength(0);
    expect(embed().dataset.state).toBe('waiting-configure');
  });

  it('shows the unreachable banner with the port/403 hint after 20 s without configure', () => {
    vi.useFakeTimers();
    mount();
    const banner = root.querySelector<HTMLElement>('.rdw-unreachable');
    expect(banner?.hidden).toBe(true);
    vi.advanceTimersByTime(19999);
    expect(banner?.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(banner?.hidden).toBe(false);
    expect(banner?.textContent).toContain('draw.io not reachable at https://embed.diagrams.net/');
    expect(banner?.textContent).toContain('403');
    expect(banner?.textContent).toContain('port');
    expect(root.querySelector<HTMLElement>('.rdw-spinner-overlay')?.hidden).toBe(true);
  });

  it('defaults to the self-hosted draw.io next to the app and accepts its same-origin messages', async () => {
    vi.useFakeTimers();
    handle = mountDrawioWorkspace(root, { configPromise: Promise.resolve({}), onSwitchToLegacy: () => undefined });
    const src = new URL(iframe().src);
    expect(src.origin).toBe(window.location.origin);
    expect(src.pathname).toBe('/drawio/');
    expect(src.searchParams.get('embed')).toBe('1');
    expect(src.searchParams.get('proto')).toBe('json');
    spyOnIframe();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ event: 'configure' }),
        origin: window.location.origin,
        source: iframe().contentWindow,
      })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(posted().some((m) => m.action === 'configure')).toBe(true);
  });

  it('shows the self-hosted hint when the local draw.io copy never answers', () => {
    vi.useFakeTimers();
    handle = mountDrawioWorkspace(root, { configPromise: Promise.resolve({}), onSwitchToLegacy: () => undefined });
    vi.advanceTimersByTime(20000);
    const banner = root.querySelector<HTMLElement>('.rdw-unreachable');
    expect(banner?.hidden).toBe(false);
    expect(banner?.textContent).toContain('draw.io not reachable at /drawio/');
    expect(banner?.textContent).toContain('scripts/drawio-selfhost');
  });

  it('does not show the unreachable banner once the handshake started', async () => {
    mount({ connectTimeoutMs: 50 });
    emit({ event: 'configure' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(root.querySelector<HTMLElement>('.rdw-unreachable')?.hidden).toBe(true);
  });

  it('shows the library banner and still configures draw.io when the library fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('nope', { status: 404 }))));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    handle = mountDrawioWorkspace(root, { drawioUrl: DRAWIO_URL, onSwitchToLegacy: () => undefined });
    spyOnIframe();
    emit({ event: 'configure' });
    await waitUntil(() => posted().some((m) => m.action === 'configure'));
    const configure = posted().find((m) => m.action === 'configure');
    expect((configure?.config as Record<string, unknown>).defaultLibraries).toBe('general');
    const alert = root.querySelector<HTMLElement>('.rdw-library-error');
    expect(alert?.hidden).toBe(false);
    expect(alert?.textContent).toContain('ERTMS shape library could not be loaded');
  });

  it('sends the ERTMS library in the configure reply', async () => {
    const fetchMock = vi.fn((_url: string) => Promise.resolve(new Response(LIBRARY, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    handle = mountDrawioWorkspace(root, { drawioUrl: DRAWIO_URL, onSwitchToLegacy: () => undefined });
    spyOnIframe();
    emit({ event: 'configure' });
    await waitUntil(() => posted().some((m) => m.action === 'configure'));
    const config = posted().find((m) => m.action === 'configure')?.config as Record<string, unknown>;
    expect(config.defaultLibraries).toBe('general;ertms');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/libraries\/ertms\.xml$/);
    expect(root.querySelector<HTMLElement>('.rdw-library-error')?.hidden).toBe(true);
  });
});

describe('mountDrawioWorkspace autosave', () => {
  it('debounces autosave events by 1 s', async () => {
    mount();
    await handshake();
    vi.useFakeTimers();
    emit({ event: 'autosave', xml: OLD_XML });
    vi.advanceTimersByTime(500);
    emit({ event: 'autosave', xml: NEW_XML });
    vi.advanceTimersByTime(999);
    expect(loadAutosave()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(loadAutosave()?.xml).toBe(NEW_XML);
    expect(status()).toMatch(/^Autosaved /);
  });

  it('writes a debounced autosave immediately on pagehide', async () => {
    mount();
    await handshake();
    emit({ event: 'autosave', xml: NEW_XML });
    expect(loadAutosave()).toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    expect(loadAutosave()?.xml).toBe(NEW_XML);
  });

  it('writes a debounced autosave when the page becomes hidden', async () => {
    mount();
    await handshake();
    emit({ event: 'autosave', xml: NEW_XML });
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    visibility.mockRestore();
    expect(loadAutosave()?.xml).toBe(NEW_XML);
  });

  it('flushes the pending autosave on dispose and removes its DOM and listeners', async () => {
    const h = mount();
    await handshake();
    emit({ event: 'autosave', xml: NEW_XML });
    h.dispose();
    expect(loadAutosave()?.xml).toBe(NEW_XML);
    expect(root.childElementCount).toBe(0);
    localStorage.removeItem(DRAWIO_AUTOSAVE_KEY);
    window.dispatchEvent(new Event('pagehide'));
    expect(loadAutosave()).toBeNull();
  });

  it('saves immediately on a save event', async () => {
    mount();
    await handshake();
    emit({ event: 'save', xml: NEW_XML });
    expect(loadAutosave()?.xml).toBe(NEW_XML);
    expect(status()).toMatch(/^Saved /);
  });

  it('reports a quota error in the status line', async () => {
    mount();
    await handshake();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    emit({ event: 'save', xml: NEW_XML });
    expect(status()).toBe('Autosave failed: diagram too large for browser storage – download it');
  });
});

describe('mountDrawioWorkspace New / Open…', () => {
  it('keeps the current diagram when New is cancelled', () => {
    saveAutosave({ xml: OLD_XML, title: 'Current' });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount();
    const before = iframe();
    button('New').click();
    expect(iframe()).toBe(before);
    expect(loadAutosave()?.xml).toBe(OLD_XML);
  });

  it('starts an empty diagram after New is confirmed', async () => {
    saveAutosave({ xml: OLD_XML, title: 'Current' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    const before = iframe();
    button('New').click();
    expect(iframe()).not.toBe(before);
    expect(before.isConnected).toBe(false);
    expect(loadAutosave()).toMatchObject({ xml: '', title: 'Untitled diagram' });
    expect(status()).toBe('New diagram');
    spyOnIframe();
    expect(await handshake()).toMatchObject({ xml: '', title: 'Untitled diagram' });
  });

  it('keeps the current diagram when the user cancels the confirmation', async () => {
    saveAutosave({ xml: OLD_XML, title: 'Current' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount();
    const before = iframe();
    openFile('reference.drawio', NEW_XML);
    await waitUntil(() => confirmSpy.mock.calls.length === 1);
    expect(loadAutosave()?.xml).toBe(OLD_XML);
    expect(iframe()).toBe(before);
    expect(await handshake()).toMatchObject({ xml: OLD_XML });
  });

  it('replaces the diagram after confirmation', async () => {
    saveAutosave({ xml: OLD_XML, title: 'Current' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    const before = iframe();
    openFile('reference.drawio', NEW_XML);
    await waitUntil(() => iframe() !== before);
    expect(loadAutosave()).toMatchObject({ xml: NEW_XML, title: 'reference' });
    expect(root.querySelector('.rdw-title')?.textContent).toBe('reference');
    expect(status()).toBe('Opened reference.drawio');
    spyOnIframe();
    expect(await handshake()).toMatchObject({ xml: NEW_XML, title: 'reference' });
  });

  it('does not ask for confirmation when the file is not a draw.io file', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    openFile('notes.xml', '<notes/>');
    await waitUntil(() => status() === '"notes.xml" is not a draw.io file');
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe('mountDrawioWorkspace exports and mode switch', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  beforeEach(() => {
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('downloads the document XML as .drawio', async () => {
    saveAutosave({ xml: OLD_XML, title: 'Station: A' });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Station_ A.drawio');
    });
    mount();
    await handshake();
    postSpy?.mockClear();
    button('Download .drawio').click();
    expect(posted()).toEqual([{ action: 'export', format: 'xml' }]);
    expect(button('Download .drawio').disabled).toBe(true);
    emit({ event: 'export', format: 'xml', xml: NEW_XML });
    await waitUntil(() => !button('Download .drawio').disabled);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('refuses an SVG export that is not an SVG data URI', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mount();
    await handshake();
    button('Export SVG').click();
    emit({ event: 'export', format: 'xmlsvg', data: 'javascript:alert(1)' });
    await waitUntil(() => status().startsWith('Export failed'));
    expect(status()).toBe('Export failed: draw.io export (svg) returned an unexpected format');
    expect(click).not.toHaveBeenCalled();
  });

  it('reports an export before the editor is ready', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mount();
    button('Export SVG').click();
    await waitUntil(() => status().startsWith('Export failed'));
    expect(status()).toContain('not ready');
  });

  it('flushes the autosave before switching to the maxGraph editor', async () => {
    const onSwitchToLegacy = vi.fn(() => {
      expect(loadAutosave()?.xml).toBe(NEW_XML);
    });
    mount({ onSwitchToLegacy });
    await handshake();
    emit({ event: 'autosave', xml: NEW_XML });
    button('maxGraph editor').click();
    expect(onSwitchToLegacy).toHaveBeenCalledTimes(1);
  });

  it('asks before switching when the autosave flush fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onSwitchToLegacy = vi.fn();
    mount({ onSwitchToLegacy });
    await handshake();
    emit({ event: 'autosave', xml: NEW_XML });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    button('maxGraph editor').click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onSwitchToLegacy).not.toHaveBeenCalled();

    // The failed flush is remembered: the next attempt still asks; OK switches
    confirm.mockReturnValue(true);
    button('maxGraph editor').click();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onSwitchToLegacy).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });
});
