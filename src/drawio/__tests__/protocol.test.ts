import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  buildEmbedUrl,
  createDrawioClient,
  getDrawioOrigin,
  parseDrawioMessage,
  selfHostedDrawioUrl,
} from '../protocol';
import type { DrawioClient, DrawioClientOptions, DrawioClientState, DrawioConfig } from '../protocol';
import { buildDrawioConfig } from '../ertmsLibrary';

const DRAWIO = 'https://embed.diagrams.net';

let iframe: HTMLIFrameElement;
let target: Window;
let postSpy: MockInstance<Window['postMessage']>;
let client: DrawioClient | null = null;

interface EmitOptions {
  origin?: string;
  source?: MessageEventSource | null;
  raw?: boolean;
}

function emit(obj: unknown, { origin = DRAWIO, source = target, raw = false }: EmitOptions = {}) {
  window.dispatchEvent(
    new MessageEvent('message', { data: raw ? obj : JSON.stringify(obj), origin, source })
  );
}

/** Parsed payloads of every postMessage call made to the iframe. */
function posted(): Array<Record<string, unknown>> {
  return postSpy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const sampleConfig: DrawioConfig = buildDrawioConfig([{ xml: '<mxGraphModel/>', w: 10, h: 10, tags: 'ertms' }]);

function makeClient(overrides: Partial<DrawioClientOptions> = {}): DrawioClient {
  client = createDrawioClient({
    iframe,
    origin: DRAWIO,
    getConfig: () => Promise.resolve(sampleConfig),
    getXml: () => '',
    ...overrides,
  });
  return client;
}

async function makeReadyClient(overrides: Partial<DrawioClientOptions> = {}): Promise<DrawioClient> {
  const c = makeClient(overrides);
  emit({ event: 'configure' });
  await flush();
  emit({ event: 'init' });
  emit({ event: 'load', xml: '' });
  expect(c.state).toBe('ready');
  postSpy.mockClear();
  return c;
}

beforeEach(() => {
  iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  target = iframe.contentWindow as Window;
  postSpy = vi.spyOn(target, 'postMessage').mockImplementation(() => undefined);
});

afterEach(() => {
  client?.dispose();
  client = null;
  iframe.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('buildEmbedUrl / getDrawioOrigin', () => {
  it('adds the embed handshake parameters and never libs=', () => {
    const url = new URL(buildEmbedUrl('https://embed.diagrams.net/'));
    const p = url.searchParams;
    expect(p.get('embed')).toBe('1');
    expect(p.get('proto')).toBe('json');
    expect(p.get('configure')).toBe('1');
    expect(p.get('noExitBtn')).toBe('1');
    expect(p.get('saveAndExit')).toBe('0');
    expect(p.has('libs')).toBe(false);
    expect(url.toString()).not.toMatch(/[?&]libs=/);
  });

  it('keeps the path of a self-hosted editor', () => {
    const url = new URL(buildEmbedUrl('https://host/drawio/index.html'));
    expect(url.origin + url.pathname).toBe('https://host/drawio/index.html');
    expect(url.searchParams.get('embed')).toBe('1');
  });

  it('appends extra parameters (VITE_DRAWIO_PARAMS) but drops libs', () => {
    const url = new URL(buildEmbedUrl('https://embed.diagrams.net/', 'offline=1&pwa=0&libs=general'));
    expect(url.searchParams.get('offline')).toBe('1');
    expect(url.searchParams.get('pwa')).toBe('0');
    expect(url.searchParams.has('libs')).toBe(false);
  });

  it('builds the self-hosted URL relative to the app base (dev "/", relative build "./")', () => {
    expect(selfHostedDrawioUrl('/')).toBe('/drawio/');
    expect(selfHostedDrawioUrl('./')).toBe('./drawio/');
    expect(selfHostedDrawioUrl('/railway-drawer')).toBe('/railway-drawer/drawio/');
    expect(selfHostedDrawioUrl('')).toBe('./drawio/');
    // ./drawio/ resolves next to the app, also when it is served from a sub-folder (LAN /railway-drawer/)
    expect(new URL('./drawio/', 'http://lan/railway-drawer/?editor=drawio').href).toBe('http://lan/railway-drawer/drawio/');
  });

  it('resolves the origin of absolute and relative URLs', () => {
    expect(getDrawioOrigin('https://embed.diagrams.net/')).toBe(DRAWIO);
    expect(getDrawioOrigin('/drawio/index.html')).toBe(window.location.origin);
  });
});

describe('parseDrawioMessage', () => {
  const parse = (data: unknown, origin = DRAWIO, source: MessageEventSource | null = target) =>
    parseDrawioMessage(new MessageEvent('message', { data, origin, source }), { origin: DRAWIO, source: target });

  it('rejects wrong origin, wrong source, non-string data and invalid JSON', () => {
    const msg = JSON.stringify({ event: 'init' });
    expect(parse(msg, 'https://evil.example')).toBeNull();
    expect(parse(msg, DRAWIO, window)).toBeNull();
    expect(parse(msg, DRAWIO, null)).toBeNull();
    expect(parse({ event: 'init' })).toBeNull();
    expect(parse('{not json')).toBeNull();
    expect(parse('42')).toBeNull();
  });

  it('accepts events and the unknownMessage error reply', () => {
    expect(parse(JSON.stringify({ event: 'init' }))).toEqual({ event: 'init' });
    expect(parse(JSON.stringify({ error: 'unknownMessage', data: '{}' }))).toMatchObject({ error: 'unknownMessage' });
  });
});

describe('createDrawioClient handshake', () => {
  it('answers configure with exactly one JSON string after getConfig resolves', async () => {
    makeClient();
    emit({ event: 'configure' });
    await flush();
    expect(postSpy).toHaveBeenCalledTimes(1);
    const [payload, targetOrigin] = postSpy.mock.calls[0];
    expect(typeof payload).toBe('string');
    expect(targetOrigin).toBe(DRAWIO);
    const msg = posted()[0] as { action: string; config: DrawioConfig };
    expect(msg.action).toBe('configure');
    expect(msg.config.compressXml).toBe(false);
    expect(msg.config.libraries?.[0].entries[0].id).toBe('ertms');
    expect(msg.config.defaultLibraries).toContain('ertms');
  });

  it('still replies to configure (without libraries) when getConfig rejects', async () => {
    const onError = vi.fn();
    makeClient({
      getConfig: () => Promise.reject(new Error('offline')),
      fallbackConfig: buildDrawioConfig(null),
      onError,
    });
    emit({ event: 'configure' });
    await flush();
    expect(postSpy).toHaveBeenCalledTimes(1);
    const msg = posted()[0] as { action: string; config: DrawioConfig };
    expect(msg.action).toBe('configure');
    expect(msg.config.libraries).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'config' }));
  });

  it('answers every init with the current getXml() value', async () => {
    let xml = '<mxfile>one</mxfile>';
    makeClient({ getXml: () => xml, title: 'Station A' });
    emit({ event: 'configure' });
    await flush();
    emit({ event: 'init' });
    expect(posted()[1]).toEqual({ action: 'load', xml: '<mxfile>one</mxfile>', autosave: 1, title: 'Station A' });
    xml = '<mxfile>two</mxfile>';
    emit({ event: 'init' }); // iframe reload
    expect(posted()[2]).toMatchObject({ action: 'load', xml: '<mxfile>two</mxfile>', autosave: 1 });
  });

  it('reports state transitions in order up to ready', async () => {
    const states: DrawioClientState[] = [];
    makeClient({ onStateChange: (s) => states.push(s) });
    emit({ event: 'configure' });
    await flush();
    emit({ event: 'init' });
    emit({ event: 'load', xml: null });
    expect(states).toEqual(['waiting-configure', 'configuring', 'waiting-init', 'loading', 'ready']);
  });

  it('forwards autosave and save', async () => {
    const onAutosave = vi.fn();
    const onSave = vi.fn();
    await makeReadyClient({ onAutosave, onSave });
    emit({ event: 'autosave', xml: '<mxfile>a</mxfile>' });
    emit({ event: 'save', xml: '<mxfile>s</mxfile>' });
    expect(onAutosave).toHaveBeenCalledWith('<mxfile>a</mxfile>');
    expect(onSave).toHaveBeenCalledWith('<mxfile>s</mxfile>');
  });

  it('reports unknownMessage error replies and ignores unknown events', async () => {
    const onError = vi.fn();
    const onAutosave = vi.fn();
    await makeReadyClient({ onError, onAutosave });
    emit({ event: 'somethingNew', xml: 'x' });
    expect(onError).not.toHaveBeenCalled();
    emit({ error: 'unknownMessage', data: '{"action":"nope"}' });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unknownMessage' }));
  });
});

describe('createDrawioClient exports', () => {
  it('requestXml posts an export without xml and resolves with the reply', async () => {
    const c = await makeReadyClient();
    const promise = c.requestXml();
    const msg = posted()[0];
    expect(msg).toEqual({ action: 'export', format: 'xml' });
    expect('xml' in msg).toBe(false);
    emit({ event: 'export', format: 'xml', xml: '<mxfile/>' });
    await expect(promise).resolves.toBe('<mxfile/>');
  });

  it('exportSvgDataUri resolves with the data URI', async () => {
    const c = await makeReadyClient();
    const promise = c.exportSvgDataUri();
    expect(posted()[0]).toMatchObject({ action: 'export', format: 'xmlsvg', embedImages: true });
    emit({ event: 'export', format: 'xmlsvg', data: 'data:image/svg+xml;base64,AAA' });
    await expect(promise).resolves.toBe('data:image/svg+xml;base64,AAA');
  });

  it('resolves concurrent requests in FIFO order', async () => {
    const c = await makeReadyClient();
    const first = c.requestXml();
    const second = c.requestXml();
    emit({ event: 'export', format: 'xml', xml: '<mxfile>1</mxfile>' });
    emit({ event: 'export', format: 'xml', xml: '<mxfile>2</mxfile>' });
    await expect(first).resolves.toBe('<mxfile>1</mxfile>');
    await expect(second).resolves.toBe('<mxfile>2</mxfile>');
  });

  it('rejects with a timeout when draw.io does not answer', async () => {
    const c = await makeReadyClient({ exportTimeoutMs: 1000 });
    vi.useFakeTimers();
    const promise = c.requestXml();
    const assertion = expect(promise).rejects.toThrow(/timed out/);
    vi.advanceTimersByTime(1001);
    await assertion;
  });

  it('rejects requestXml before ready', async () => {
    const c = makeClient();
    await expect(c.requestXml()).rejects.toThrow(/not ready/);
    expect(postSpy).not.toHaveBeenCalled();
  });
});

describe('createDrawioClient isolation and dispose', () => {
  it('ignores messages from another origin or source while ready', async () => {
    const onAutosave = vi.fn();
    await makeReadyClient({ onAutosave });
    emit({ event: 'autosave', xml: '<mxfile/>' }, { origin: 'https://evil.example' });
    emit({ event: 'autosave', xml: '<mxfile/>' }, { source: window });
    emit({ event: 'autosave', xml: '<mxfile/>' }, { raw: true });
    expect(onAutosave).not.toHaveBeenCalled();
  });

  it('dispose() ignores later events and rejects pending exports', async () => {
    const onAutosave = vi.fn();
    const c = await makeReadyClient({ onAutosave });
    const pending = c.requestXml();
    c.dispose();
    await expect(pending).rejects.toThrow(/disposed/);
    emit({ event: 'autosave', xml: '<mxfile/>' });
    emit({ event: 'configure' });
    await flush();
    expect(onAutosave).not.toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledTimes(1); // only the export request
  });
});

describe('createDrawioClient regressions', () => {
  it('replies with the fallback config when getConfig never settles', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const c = makeClient({
      getConfig: () => new Promise<DrawioConfig>(() => undefined),
      fallbackConfig: buildDrawioConfig(null),
      configTimeoutMs: 5000,
      onError,
    });
    emit({ event: 'configure' });
    await vi.advanceTimersByTimeAsync(4999);
    expect(postSpy).not.toHaveBeenCalled();
    expect(c.state).toBe('configuring');
    await vi.advanceTimersByTimeAsync(1);
    expect(postSpy).toHaveBeenCalledTimes(1);
    const msg = posted()[0] as { action: string; config: DrawioConfig };
    expect(msg.action).toBe('configure');
    expect(msg.config.libraries).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'config' }));
    expect(c.state).toBe('waiting-init');
  });

  it('does not report a config timeout once getConfig resolved in time', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    makeClient({ configTimeoutMs: 5000, onError });
    emit({ event: 'configure' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('refuses an SVG export that is not an SVG data URI', async () => {
    const c = await makeReadyClient();
    const promise = c.exportSvgDataUri();
    emit({ event: 'export', format: 'xmlsvg', data: 'javascript:alert(document.domain)' });
    await expect(promise).rejects.toThrow(/unexpected format/);
  });

  it('refuses a non-SVG data URI for the SVG export', async () => {
    const c = await makeReadyClient();
    const promise = c.exportSvgDataUri();
    emit({ event: 'export', format: 'xmlsvg', data: 'data:text/html,<script>alert(1)</script>' });
    await expect(promise).rejects.toThrow(/unexpected format/);
  });
});
