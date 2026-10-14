/**
 * @file protocol.ts
 * @brief Framework-free client for the draw.io (diagrams.net) embed postMessage protocol.
 *
 * Handshake (proto=json, configure=1):
 *   editor -> {event:'configure'}  host -> {action:'configure', config}
 *   editor -> {event:'init'}       host -> {action:'load', xml, autosave:1, title}
 *   editor -> {event:'load'}       => ready
 *
 * Gotchas encoded here:
 * - Every outgoing message MUST be a JSON string; objects are silently dropped by draw.io.
 * - draw.io posts with targetOrigin '*', so every incoming message is checked for
 *   origin AND source (the iframe's contentWindow) before it is parsed.
 * - Never pass `xml` in an export request: it replaces the open diagram.
 */

import { logger } from './logger';

export interface Rect { x: number; y: number; width: number; height: number }

/** Fields draw.io adds to load/autosave/save/export events (createLoadMessage). */
export interface DrawioViewState {
  pageVisible?: boolean;
  translate?: { x: number; y: number };
  bounds?: Rect;
  currentPage?: number;
  scale?: number;
  page?: unknown;
  modelBounds?: Rect;
  containerSize?: { width: number; height: number; offsetWidth: number; offsetHeight: number };
}

// ---- editor -> host ----
export type DrawioEvent =
  | { event: 'configure' }
  | { event: 'init' }
  /** `xml` is the echo of the loaded input, NOT normalized output; null for ''. */
  | ({ event: 'load'; xml: string | null; error?: unknown } & DrawioViewState)
  | ({ event: 'autosave'; xml?: string; patch?: unknown; checksum?: string } & DrawioViewState)
  /** `exit` is only set with saveAndExit=1. */
  | ({ event: 'save'; xml: string; exit?: true } & DrawioViewState)
  /** format 'xml' has no `data`. */
  | ({
      event: 'export';
      format: string;
      xml?: string;
      data?: string;
      svg?: string;
      message?: unknown;
      exit?: boolean;
    } & DrawioViewState)
  | { event: 'exit'; modified?: boolean }
  | { event: 'merge'; message?: unknown; error?: unknown }
  | { event: 'openLink'; href: string; target?: string; allowOpener?: boolean };

export interface DrawioErrorReply { error: string; data?: string; message?: unknown }
/** Forward compatibility: unknown events are accepted by the parser and ignored by the client. */
export interface DrawioUnknownEvent { event: string; [k: string]: unknown }
export type DrawioIncoming = DrawioEvent | DrawioErrorReply | DrawioUnknownEvent;

// ---- host -> editor ----
export interface Resource { main: string; [lang: string]: string }
export interface LibraryItem {
  xml: string;
  w: number;
  h: number;
  title?: string;
  aspect?: string;
  tags?: string;
}
export type CustomLib =
  /** Parsed array, not an <mxlibrary> string. */
  | { title: Resource; data: LibraryItem[]; expand?: boolean }
  /** Must be absolute and on the iframe origin, otherwise draw.io proxies it. */
  | { title: Resource; url: string; expand?: boolean; preload?: boolean };
export interface CustomLibrarySection {
  title: Resource;
  entries: Array<{ id: string; title: Resource; desc?: Resource; preview?: string; libs: CustomLib[] }>;
}
export interface DrawioConfig {
  version?: string;
  settingsName?: string;
  override?: boolean;
  compressXml?: boolean;
  defaultLibraries?: string;
  enabledLibraries?: string[] | null;
  enableCustomLibraries?: boolean;
  appendCustomLibraries?: boolean;
  expandLibraries?: boolean;
  libraries?: CustomLibrarySection[];
  [key: string]: unknown;
}

/** Passing xml in an export REPLACES the open diagram, so the type forbids it. */
type ExportCommon = { xml?: never };
export type DrawioExportAction = ExportCommon & (
  | { action: 'export'; format: 'xml' }
  | {
      action: 'export';
      format: 'svg' | 'xmlsvg';
      embedImages?: boolean;
      embedFonts?: boolean;
      embedCellMetadata?: boolean;
      asText?: boolean;
      scale?: number;
      border?: number;
      background?: string;
    }
  | {
      action: 'export';
      format: 'png' | 'xmlpng';
      scale?: number;
      border?: number;
      transparent?: boolean;
      background?: string;
      spin?: string;
    });

export type DrawioAction =
  | { action: 'configure'; config: DrawioConfig; colorSchemeMeta?: boolean }
  | {
      action: 'load';
      xml: string;
      autosave?: 0 | 1;
      title?: string;
      /** ';'-separated */
      libs?: string;
      noExitBtn?: 0 | 1;
      noSaveBtn?: 0 | 1;
      saveAndExit?: 0 | 1;
    }
  | DrawioExportAction
  | { action: 'merge'; xml: string }
  | { action: 'status'; message?: string; messageKey?: string; modified?: boolean }
  | { action: 'spinner'; show: boolean; message?: string }
  | { action: 'invokeAction'; actionName: string }
  | { action: 'getDiff' };

export type DrawioClientState =
  | 'waiting-configure'
  | 'configuring'
  | 'waiting-init'
  | 'loading'
  | 'ready'
  | 'error';

export type DrawioErrorKind = 'unknownMessage' | 'config' | 'load' | 'timeout';
export interface DrawioClientError { kind: DrawioErrorKind; detail?: unknown }

export interface DrawioClientOptions {
  iframe: HTMLIFrameElement;
  origin: string;
  /** Awaited on 'configure'. On reject the client replies with `fallbackConfig` and reports a 'config' error. */
  getConfig: () => Promise<DrawioConfig>;
  /** Sent on 'configure' when getConfig rejects (default `{}`). draw.io waits forever for a reply. */
  fallbackConfig?: DrawioConfig;
  /** Called on every 'init' so an iframe reload receives the latest document. */
  getXml: () => string;
  title?: string;
  /** Deadline for getConfig(); on expiry the client replies with `fallbackConfig`. Default 10000 ms. */
  configTimeoutMs?: number;
  /** Default 15000 ms. */
  exportTimeoutMs?: number;
  onStateChange?(s: DrawioClientState): void;
  onAutosave?(xml: string): void;
  onSave?(xml: string): void;
  onError?(err: DrawioClientError): void;
}

export interface DrawioClient {
  readonly state: DrawioClientState;
  /** Uncompressed document XML (export format 'xml'). Rejects before 'ready'. */
  requestXml(): Promise<string>;
  /** Editable SVG (export format 'xmlsvg') as a data URI. Rejects before 'ready'. */
  exportSvgDataUri(): Promise<string>;
  setStatus(message: string, modified?: boolean): void;
  /** Removes the message listener and rejects pending exports. */
  dispose(): void;
}

export const DEFAULT_DRAWIO_URL = 'https://embed.diagrams.net/';
const DEFAULT_EXPORT_TIMEOUT_MS = 15000;
export const DEFAULT_CONFIG_TIMEOUT_MS = 10000;

/** An SVG export must be a data:image/svg+xml URI; anything else (e.g. javascript:) is refused. */
const SVG_DATA_URI_RE = /^data:image\/svg\+xml[;,]/i;

export function isSvgDataUri(value: string): boolean {
  return SVG_DATA_URI_RE.test(value);
}

/** Embed parameters required by the host. `libs` is never set: it overrides stored sidebar settings. */
const EMBED_PARAMS: ReadonlyArray<[string, string]> = [
  ['embed', '1'],
  ['proto', 'json'],
  ['configure', '1'],
  ['spin', '1'],
  ['noExitBtn', '1'],
  ['saveAndExit', '0'],
  ['libraries', '1'],
  ['plugins', '0'],
  ['lang', 'en'],
];

function baseHref(): string {
  return typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
}

/** Origin of the draw.io editor; works for absolute and relative (self-hosted) URLs. */
export function getDrawioOrigin(url: string): string {
  return new URL(url, baseHref()).origin;
}

/** Builds the iframe URL: base URL (path kept) + embed params + optional extra params. */
export function buildEmbedUrl(base: string, extraParams?: string): string {
  const url = new URL(base, baseHref());
  for (const [key, value] of EMBED_PARAMS) url.searchParams.set(key, value);
  if (extraParams) {
    const extra = new URLSearchParams(extraParams.replace(/^[?&]/, ''));
    extra.forEach((value, key) => url.searchParams.set(key, value));
  }
  url.searchParams.delete('libs');
  return url.toString();
}

/** Serializes a host action. draw.io silently drops non-string messages. */
export function serializeAction(action: DrawioAction): string {
  return JSON.stringify(action);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and parses an incoming message. Returns null unless the message comes from
 * the expected origin AND window, is a string, and parses to an event or error reply.
 */
export function parseDrawioMessage(
  e: MessageEvent,
  expected: { origin: string; source: MessageEventSource | null }
): DrawioIncoming | null {
  if (!expected.source || e.source !== expected.source) return null;
  if (e.origin !== expected.origin) return null;
  if (typeof e.data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(e.data);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.event === 'string') {
    // Events may carry an `error` field (e.g. load); shape is validated per event by the client.
    return parsed as DrawioUnknownEvent;
  }
  if (typeof parsed.error === 'string') {
    return {
      error: parsed.error,
      data: typeof parsed.data === 'string' ? parsed.data : undefined,
      message: parsed.message,
    };
  }
  return null;
}

interface PendingExport {
  kind: 'xml' | 'svg';
  resolve(value: string): void;
  reject(err: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/** Creates the handshake state machine and export queue for one iframe. */
export function createDrawioClient(opts: DrawioClientOptions): DrawioClient {
  const exportTimeoutMs = opts.exportTimeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS;
  const configTimeoutMs = opts.configTimeoutMs ?? DEFAULT_CONFIG_TIMEOUT_MS;
  let state: DrawioClientState = 'waiting-configure';
  let disposed = false;
  const pending: PendingExport[] = [];

  const setState = (next: DrawioClientState) => {
    if (state === next) return;
    state = next;
    logger.debug('drawio', `state -> ${next}`);
    opts.onStateChange?.(next);
  };

  const post = (action: DrawioAction) => {
    if (disposed) return;
    const target = opts.iframe.contentWindow;
    if (!target) {
      logger.warn('drawio', 'iframe has no contentWindow; message dropped', { action: action.action });
      return;
    }
    target.postMessage(serializeAction(action), opts.origin);
  };

  const handleConfigure = async () => {
    setState('configuring');
    let config: DrawioConfig;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    // draw.io sends nothing until it gets the configure reply, so a stalled getConfig() must not block it.
    const timeout = new Promise<never>((_, reject) => {
      deadline = setTimeout(
        () => reject(new Error(`config not available after ${configTimeoutMs} ms`)),
        configTimeoutMs
      );
    });
    try {
      config = await Promise.race([opts.getConfig(), timeout]);
    } catch (err) {
      if (disposed) return;
      logger.error('drawio', 'config unavailable; configuring without libraries', {
        error: err instanceof Error ? err.message : String(err),
      });
      opts.onError?.({ kind: 'config', detail: err });
      config = opts.fallbackConfig ?? {};
    } finally {
      clearTimeout(deadline);
    }
    if (disposed) return;
    post({ action: 'configure', config });
    setState('waiting-init');
  };

  const handleInit = () => {
    setState('loading');
    post({ action: 'load', xml: opts.getXml(), autosave: 1, title: opts.title });
  };

  const handleExport = (msg: Record<string, unknown>) => {
    const next = pending.shift();
    if (!next) {
      logger.debug('drawio', 'export event without a pending request ignored');
      return;
    }
    clearTimeout(next.timer);
    const value = next.kind === 'xml' ? msg.xml : msg.data;
    if (typeof value !== 'string' || value.length === 0) {
      next.reject(new Error(`draw.io export (${next.kind}) returned no data`));
    } else if (next.kind === 'svg' && !isSvgDataUri(value)) {
      logger.warn('drawio', 'SVG export is not an SVG data URI; refused', { prefix: value.slice(0, 32) });
      next.reject(new Error('draw.io export (svg) returned an unexpected format'));
    } else {
      next.resolve(value);
    }
  };

  const onMessage = (e: MessageEvent) => {
    if (disposed) return;
    const msg = parseDrawioMessage(e, { origin: opts.origin, source: opts.iframe.contentWindow });
    if (!msg) return;
    // Error replies ({error:'unknownMessage'}) have no `event` field.
    if (!('event' in msg)) {
      logger.warn('drawio', 'editor rejected a message', { error: msg.error });
      opts.onError?.({ kind: 'unknownMessage', detail: msg });
      return;
    }
    const record = msg as Record<string, unknown>;
    switch (msg.event) {
      case 'configure':
        void handleConfigure();
        break;
      case 'init':
        handleInit();
        break;
      case 'load':
        if (record.error !== undefined && record.error !== null) {
          opts.onError?.({ kind: 'load', detail: record.error });
          setState('error');
        } else {
          setState('ready');
        }
        break;
      case 'autosave':
        if (typeof record.xml === 'string') opts.onAutosave?.(record.xml);
        break;
      case 'save':
        if (typeof record.xml === 'string') opts.onSave?.(record.xml);
        break;
      case 'export':
        handleExport(record);
        break;
      default:
        // Unknown or unhandled events (exit, openLink, ...) are ignored.
        break;
    }
  };

  window.addEventListener('message', onMessage);
  opts.onStateChange?.(state);

  const enqueueExport = (kind: PendingExport['kind'], action: DrawioExportAction): Promise<string> => {
    if (disposed) return Promise.reject(new Error('draw.io client disposed'));
    if (state !== 'ready') return Promise.reject(new Error(`draw.io editor not ready (state: ${state})`));
    return new Promise<string>((resolve, reject) => {
      const entry: PendingExport = {
        kind,
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = pending.indexOf(entry);
          if (index >= 0) pending.splice(index, 1);
          opts.onError?.({ kind: 'timeout', detail: kind });
          reject(new Error(`draw.io export (${kind}) timed out after ${exportTimeoutMs} ms`));
        }, exportTimeoutMs),
      };
      pending.push(entry);
      post(action);
    });
  };

  return {
    get state() {
      return state;
    },
    requestXml: () => enqueueExport('xml', { action: 'export', format: 'xml' }),
    exportSvgDataUri: () =>
      enqueueExport('svg', { action: 'export', format: 'xmlsvg', embedImages: true, asText: false }),
    setStatus: (message, modified) => post({ action: 'status', message, modified }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('message', onMessage);
      for (const entry of pending.splice(0)) {
        clearTimeout(entry.timer);
        entry.reject(new Error('draw.io client disposed'));
      }
    },
  };
}
