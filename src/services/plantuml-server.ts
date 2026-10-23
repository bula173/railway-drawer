/**
 * @file plantuml-server.ts
 * @brief Optional PlantUML server rendering (for diagram types the local renderer does not draw).
 *
 * Scenario steps render sequence diagrams locally (plantuml-sequence-svg.ts). Other PlantUML diagram
 * types can be rendered by a PlantUML server, but only when the user has configured one: there is
 * no default server, so nothing is sent anywhere unless a server URL was entered (localStorage
 * `rd.plantuml.server`) and a diagram of another type is rendered (step editor preview, step view,
 * scenario export).
 *
 * Request: GET `<server>/svg/<encoded>`; encoding = PlantUML's text encoding: UTF-8 -> raw DEFLATE
 * -> PlantUML's base64 variant (alphabet `0-9A-Za-z-_`, 3 bytes -> 4 characters, no padding).
 * The returned SVG is sanitized (scripts, event handlers, foreign content and external references
 * removed) before it is shown or exported.
 */

import { InvalidSvgError, sanitizeSvgMarkup as sanitizeSvg } from '../security/sanitize';

export const PLANTUML_SERVER_KEY = 'rd.plantuml.server';
export const PLANTUML_SERVER_CHANGED_EVENT = 'rd-plantuml-server-changed';
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

export class PlantUmlServerError extends Error {
  constructor(
    message: string,
    /** offline: no answer (network, CORS, timeout); http: error status; invalid: not an SVG. */
    readonly kind: 'offline' | 'http' | 'invalid'
  ) {
    super(message);
  }
}

/** PlantUML's base64 variant (plantuml.com/text-encoding `encode64`). */
export function encodePlantUmlBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALPHABET[b1 >> 2];
    out += ALPHABET[((b1 & 0x3) << 4) | (b2 >> 4)];
    out += ALPHABET[((b2 & 0xf) << 2) | (b3 >> 6)];
    out += ALPHABET[b3 & 0x3f];
  }
  return out;
}

/** Inverse of encodePlantUmlBase64 (tests, debugging). */
export function decodePlantUmlBase64(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => Math.max(0, ALPHABET.indexOf(text[i + k] ?? '0')));
    bytes.push((c[0] << 2) | (c[1] >> 4), ((c[1] & 0xf) << 4) | (c[2] >> 2), ((c[2] & 0x3) << 6) | c[3]);
  }
  return new Uint8Array(bytes);
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'function') throw new Error('This browser cannot compress data (CompressionStream missing)');
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  const write = (async () => {
    await writer.write(data as Uint8Array<ArrayBuffer>);
    await writer.close();
  })();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await write;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** PlantUML text -> the URL-safe string of `<server>/svg/<encoded>`. */
export async function encodePlantUml(text: string): Promise<string> {
  return encodePlantUmlBase64(await deflateRaw(new TextEncoder().encode(text)));
}

/** A server URL as entered (trimmed, no trailing slash) or null when it is not an http(s) URL. */
export function normalizeServerUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** The configured PlantUML server ('' = none, the default). */
export function getPlantUmlServer(): string {
  try {
    return normalizeServerUrl(localStorage.getItem(PLANTUML_SERVER_KEY) ?? '') ?? '';
  } catch {
    return '';
  }
}

/** Stores the server URL ('' removes it). Throws on an invalid URL. */
export function setPlantUmlServer(value: string): string {
  const url = normalizeServerUrl(value);
  if (url === null) throw new Error('Enter an http(s) URL, e.g. https://www.plantuml.com/plantuml');
  try {
    if (url) localStorage.setItem(PLANTUML_SERVER_KEY, url);
    else localStorage.removeItem(PLANTUML_SERVER_KEY);
  } catch {
    // storage blocked: the setting lasts until the page is reloaded
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PLANTUML_SERVER_CHANGED_EVENT, { detail: { url } }));
  return url;
}

/** Sanitizes SVG markup from a server (DOMPurify SVG profile): the cleaned `<svg>` or throws. */
export function sanitizeSvgMarkup(markup: string): string {
  try {
    return sanitizeSvg(markup);
  } catch (error) {
    if (error instanceof InvalidSvgError) throw new PlantUmlServerError('The PlantUML server did not return an SVG image', 'invalid');
    throw error;
  }
}

export interface ServerRenderOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Renders PlantUML text on `server`; resolves the sanitized SVG markup. */
export async function renderOnPlantUmlServer(text: string, server: string, opts: ServerRenderOptions = {}): Promise<string> {
  const base = normalizeServerUrl(server);
  if (!base) throw new PlantUmlServerError('No PlantUML server is configured', 'offline');
  const url = `${base}/svg/${await encodePlantUml(text)}`;
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), opts.timeoutMs ?? 15_000);
  let response: Response;
  try {
    response = await doFetch(url, { signal: controller?.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (error) {
    throw new PlantUmlServerError(
      `PlantUML server not reachable (${base}): ${error instanceof Error ? error.message : String(error)}`,
      'offline'
    );
  } finally {
    clearTimeout(timer);
  }
  const body = await response.text().catch(() => '');
  // PlantUML answers syntax errors with HTTP 400 and an SVG describing the error: show that image
  if (!response.ok && !body.includes('<svg')) {
    throw new PlantUmlServerError(`PlantUML server answered HTTP ${response.status}`, 'http');
  }
  return sanitizeSvgMarkup(body.slice(body.indexOf('<svg')));
}
