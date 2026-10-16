/**
 * @file workspace.ts
 * @brief Framework-free host page for the embedded draw.io editor.
 *
 * Vanilla port of the React `DrawioWorkspace` + `DrawioEmbed` pair:
 * - toolbar: title, New, Open…, Download .drawio, Export SVG, switch to the maxGraph editor, status line
 * - iframe embed with a spinner until the editor is ready and a banner when draw.io never answers
 * - debounced localStorage autosave, flushed on pagehide / hidden tab / dispose
 *
 * Loading a different document disposes the protocol client and remounts the iframe,
 * exactly like changing the React `key`.
 */

import './workspace.css';
import { logger } from './logger';
import { buildEmbedUrl, createDrawioClient, getDrawioOrigin, selfHostedDrawioUrl } from './protocol';
import type { DrawioClient, DrawioClientError, DrawioClientState, DrawioConfig } from './protocol';
import { buildDrawioConfig, loadErtmsLibrary } from './ertmsLibrary';
import {
  DEFAULT_DIAGRAM_TITLE,
  downloadSvgDataUri,
  downloadText,
  loadAutosave,
  looksLikeDrawioXml,
  sanitizeFilename,
  saveAutosave,
  titleFromFilename,
} from './drawioStorage';
import type { SaveResult } from './drawioStorage';
import { switchEditorMode } from './editorMode';

export const DRAWIO_CONNECT_TIMEOUT_MS = 20000;
export const AUTOSAVE_DEBOUNCE_MS = 1000;

const QUOTA_MESSAGE = 'Autosave failed: diagram too large for browser storage – download it';
const UNAVAILABLE_MESSAGE = 'Autosave failed: browser storage unavailable – download it';
const LIBRARY_ERROR_MESSAGE = 'ERTMS shape library could not be loaded – the editor runs without it.';
const PUBLIC_DRAWIO_HOST = 'embed.diagrams.net';

export interface DrawioWorkspaceOptions {
  /** draw.io base URL. Default: `VITE_DRAWIO_URL` or the self-hosted copy at `<BASE_URL>drawio/`. */
  drawioUrl?: string;
  /** Extra URL params, e.g. `offline=1&pwa=0`. Default: `VITE_DRAWIO_PARAMS`. */
  extraParams?: string;
  /** Resolves the draw.io `configure` payload. Default: ERTMS library via `loadErtmsLibrary()`. */
  configPromise?: Promise<DrawioConfig>;
  /** Called by the "maxGraph editor" button after the autosave is flushed. Default: `switchEditorMode('legacy')`. */
  onSwitchToLegacy?: () => void;
  /** Default 20000 ms. */
  connectTimeoutMs?: number;
  /** Default 1000 ms. */
  autosaveDebounceMs?: number;
}

export interface DrawioWorkspaceHandle {
  /** Flushes the pending autosave, disposes the protocol client and removes the DOM. Idempotent. */
  dispose(): void;
}

interface EmbedOptions {
  drawioUrl: string;
  extraParams?: string;
  initialXml: string;
  title: string;
  configPromise: Promise<DrawioConfig>;
  fallbackConfig: DrawioConfig;
  connectTimeoutMs: number;
  onAutosave(xml: string): void;
  onSave(xml: string): void;
  onError(err: DrawioClientError): void;
}

interface Embed {
  requestXml(): Promise<string>;
  exportSvg(): Promise<string>;
  dispose(): void;
}

function describeSave(result: SaveResult, okMessage: string): string {
  if (result.ok) return okMessage;
  return result.reason === 'quota' ? QUOTA_MESSAGE : UNAVAILABLE_MESSAGE;
}

function timeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'rdw-btn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function unreachableHint(drawioUrl: string): string {
  let host = '';
  try {
    host = new URL(drawioUrl, window.location.href).hostname;
  } catch {
    // Unparseable URL: no host-specific hint.
  }
  if (host === PUBLIC_DRAWIO_HOST) {
    return (
      `${PUBLIC_DRAWIO_HOST} answers HTTP 403 to pages served on a non-default port ` +
      '(e.g. the dev server on localhost:3000) and to headless browsers. ' +
      'Serve the app on port 80/443, or set VITE_DRAWIO_URL to a self-hosted draw.io.'
    );
  }
  if (host === window.location.hostname) {
    return (
      'The self-hosted draw.io copy is missing or failed to load. It is prepared by scripts/drawio-selfhost ' +
      '(npm run dev / npm run build download the pinned draw.war; see the server or build log).'
    );
  }
  return 'Check that the draw.io server is running and allows embedding from this page.';
}

/** Mounts the draw.io iframe into `host` and wires the protocol client (vanilla DrawioEmbed). */
function createEmbed(host: HTMLElement, opts: EmbedOptions): Embed {
  const src = buildEmbedUrl(opts.drawioUrl, opts.extraParams);
  const origin = getDrawioOrigin(opts.drawioUrl);
  let latestXml = opts.initialXml;
  let state: DrawioClientState = 'waiting-configure';
  let unreachable = false;

  const container = el('div', 'rdw-embed');
  container.dataset.testid = 'drawio-embed';
  container.dataset.state = state;

  const iframe = el('iframe', 'rdw-iframe');
  iframe.src = src;
  iframe.title = 'draw.io editor';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  // No sandbox: the default self-hosted draw.io is same-origin, where allow-scripts + allow-same-origin
  // (both required by draw.io) would not be a boundary anyway; we trust the pinned, SHA-256-checked copy.
  // embed.diagrams.net (VITE_DRAWIO_URL) is cross-origin and isolated by the browser. See CLAUDE.md.

  const spinner = el('div', 'rdw-spinner-overlay');
  const spinnerInner = el('div', 'rdw-spinner-label');
  spinnerInner.append(el('span', 'rdw-spinner'), document.createTextNode('Loading editor…'));
  spinner.append(spinnerInner);

  const banner = el('div', 'rdw-unreachable');
  banner.setAttribute('role', 'alert');
  banner.append(
    el('div', 'rdw-unreachable-title', `draw.io not reachable at ${opts.drawioUrl}`),
    el('div', 'rdw-unreachable-hint', unreachableHint(opts.drawioUrl))
  );
  banner.hidden = true;

  container.append(iframe, spinner, banner);
  host.append(container);

  const render = () => {
    container.dataset.state = state;
    spinner.hidden = state === 'ready' || state === 'error' || unreachable;
    banner.hidden = !(unreachable && state === 'waiting-configure');
  };
  render();

  let client: DrawioClient | null = createDrawioClient({
    iframe,
    origin,
    getConfig: () => opts.configPromise,
    fallbackConfig: opts.fallbackConfig,
    getXml: () => latestXml,
    title: opts.title,
    onStateChange: (next) => {
      state = next;
      render();
    },
    onAutosave: (xml) => {
      latestXml = xml;
      opts.onAutosave(xml);
    },
    onSave: (xml) => {
      latestXml = xml;
      opts.onSave(xml);
    },
    onError: (err) => opts.onError(err),
  });

  const timer = setTimeout(() => {
    if (client && client.state === 'waiting-configure') {
      logger.error('drawio', 'no configure event received', { origin });
      unreachable = true;
      render();
    }
  }, opts.connectTimeoutMs);

  const notMounted = () => Promise.reject(new Error('draw.io editor not mounted'));

  return {
    requestXml: () => client?.requestXml() ?? notMounted(),
    exportSvg: () => client?.exportSvgDataUri() ?? notMounted(),
    dispose: () => {
      if (!client) return;
      clearTimeout(timer);
      client.dispose();
      client = null;
      container.remove();
    },
  };
}

function defaultConfigPromise(): Promise<DrawioConfig> {
  const promise = loadErtmsLibrary().then((items) => buildDrawioConfig(items));
  // Mark as handled: the embed client awaits it later and reports the failure.
  promise.catch(() => undefined);
  return promise;
}

/** Mounts the draw.io workspace (toolbar + embedded editor) into `root`. */
export function mountDrawioWorkspace(root: HTMLElement, opts: DrawioWorkspaceOptions = {}): DrawioWorkspaceHandle {
  const drawioUrl: string =
    opts.drawioUrl || import.meta.env.VITE_DRAWIO_URL || selfHostedDrawioUrl(import.meta.env.BASE_URL);
  const extraParams: string | undefined = opts.extraParams ?? (import.meta.env.VITE_DRAWIO_PARAMS || undefined);
  const connectTimeoutMs = opts.connectTimeoutMs ?? DRAWIO_CONNECT_TIMEOUT_MS;
  const autosaveDebounceMs = opts.autosaveDebounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  // Library fetch starts on mount; the configure handler awaits it.
  const configPromise = opts.configPromise ?? defaultConfigPromise();
  const fallbackConfig = buildDrawioConfig(null);

  const stored = loadAutosave();
  let title = stored?.title ?? DEFAULT_DIAGRAM_TITLE;
  let disposed = false;

  // ---- DOM ----
  const workspace = el('div', 'rdw-workspace');
  workspace.dataset.testid = 'drawio-workspace';

  const toolbar = el('div', 'rdw-toolbar');
  const titleEl = el('span', 'rdw-title');
  const statusEl = el('span', 'rdw-status');
  statusEl.setAttribute('role', 'status');

  const fileInput = el('input', 'rdw-file-input');
  fileInput.type = 'file';
  fileInput.accept = '.drawio,.xml';
  fileInput.hidden = true;
  fileInput.dataset.testid = 'drawio-file-input';

  const newBtn = button('New', () => handleNew());
  const openBtn = button('Open…', () => fileInput.click());
  const downloadBtn = button('Download .drawio', () => void runExport('drawio'));
  const svgBtn = button('Export SVG', () => void runExport('svg'));
  const legacyBtn = button('maxGraph editor', () => handleLegacy());
  legacyBtn.title = 'Switch to the maxGraph editor (reloads the page)';

  toolbar.append(
    titleEl,
    el('span', 'rdw-sep'),
    newBtn,
    openBtn,
    fileInput,
    downloadBtn,
    svgBtn,
    el('span', 'rdw-sep'),
    legacyBtn,
    statusEl
  );

  const libraryErrorEl = el('div', 'rdw-library-error');
  libraryErrorEl.setAttribute('role', 'alert');
  libraryErrorEl.hidden = true;

  const embedHost = el('div', 'rdw-embed-host');
  workspace.append(toolbar, libraryErrorEl, embedHost);
  root.append(workspace);

  const setTitle = (next: string) => {
    title = next;
    titleEl.textContent = next;
    titleEl.title = next;
  };
  const setStatus = (message: string) => {
    statusEl.textContent = message;
  };
  const setBusy = (busy: boolean) => {
    downloadBtn.disabled = busy;
    svgBtn.disabled = busy;
  };
  setTitle(title);

  // ---- debounced autosave ----
  let pendingXml: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Outcome of the latest write to localStorage; false means the stored copy is behind the editor
  let lastSaveOk = true;

  const cancelPendingAutosave = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingXml = null;
  };

  const flushAutosave = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const xml = pendingXml;
    pendingXml = null;
    if (xml === null) return lastSaveOk;
    const result = saveAutosave({ xml, title });
    lastSaveOk = result.ok;
    setStatus(describeSave(result, `Autosaved ${timeLabel()}`));
    return lastSaveOk;
  };

  const handleAutosave = (xml: string) => {
    pendingXml = xml;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushAutosave, autosaveDebounceMs);
  };

  const handleSave = (xml: string) => {
    cancelPendingAutosave();
    const result = saveAutosave({ xml, title });
    lastSaveOk = result.ok;
    setStatus(describeSave(result, `Saved ${timeLabel()}`));
  };

  const handleError = (err: DrawioClientError) => {
    if (err.kind === 'config') {
      libraryErrorEl.textContent = LIBRARY_ERROR_MESSAGE;
      libraryErrorEl.hidden = false;
    } else if (err.kind === 'load') {
      setStatus('draw.io could not load the diagram');
    } else if (err.kind === 'unknownMessage') {
      logger.warn('drawio', 'editor reported an unknown message', { detail: err.detail });
    }
  };

  // Closing the tab or reloading never runs dispose(): flush the debounced autosave on page hide.
  const onPageHide = () => flushAutosave();
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushAutosave();
  };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // ---- embed (remounted to load another document) ----
  let embed: Embed | null = null;
  const mountEmbed = (initialXml: string) => {
    embed?.dispose();
    embed = createEmbed(embedHost, {
      drawioUrl,
      extraParams,
      initialXml,
      title,
      configPromise,
      fallbackConfig,
      connectTimeoutMs,
      onAutosave: handleAutosave,
      onSave: handleSave,
      onError: handleError,
    });
  };
  mountEmbed(stored?.xml ?? '');

  const replaceDocument = (xml: string, nextTitle: string, message: string) => {
    cancelPendingAutosave();
    const result = saveAutosave({ xml, title: nextTitle });
    setTitle(nextTitle);
    mountEmbed(xml);
    setStatus(describeSave(result, message));
  };

  const confirmDiscard = (what: string) =>
    window.confirm(`${what} The current diagram will be discarded unless you downloaded it.`);

  const handleNew = () => {
    if (!confirmDiscard('Start a new diagram?')) return;
    replaceDocument('', DEFAULT_DIAGRAM_TITLE, 'New diagram');
  };

  const handleOpenFile = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (disposed) return;
      if (!looksLikeDrawioXml(text)) {
        setStatus(`"${file.name}" is not a draw.io file`);
        return;
      }
      if (!confirmDiscard(`Open "${file.name}"?`)) return;
      replaceDocument(text, titleFromFilename(file.name), `Opened ${file.name}`);
    } catch (err) {
      logger.error('drawio', 'file could not be read', { error: err instanceof Error ? err.message : String(err) });
      setStatus(`Could not read "${file.name}"`);
    }
  };
  fileInput.addEventListener('change', () => void handleOpenFile());

  const runExport = async (kind: 'drawio' | 'svg') => {
    const current = embed;
    if (!current) return;
    setBusy(true);
    try {
      const name = sanitizeFilename(title);
      if (kind === 'drawio') {
        downloadText(`${name}.drawio`, await current.requestXml(), 'application/xml');
      } else {
        downloadSvgDataUri(`${name}.drawio.svg`, await current.exportSvg());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('drawio', 'export failed', { kind, error: message });
      setStatus(`Export failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLegacy = () => {
    // A failed write (e.g. storage full) would silently drop the edits on reload
    if (
      !flushAutosave() &&
      !window.confirm(
        'Your latest changes could not be saved to browser storage and will be lost when switching editors. ' +
          'Cancel and use "Download .drawio" first, or OK to switch anyway.'
      )
    ) {
      return;
    }
    if (opts.onSwitchToLegacy) opts.onSwitchToLegacy();
    else switchEditorMode('legacy');
  };

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      flushAutosave();
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      embed?.dispose();
      embed = null;
      workspace.remove();
    },
  };
}
