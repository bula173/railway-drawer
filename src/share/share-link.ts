/**
 * @file share-link.ts
 * @brief "Copy link with diagram": the diagram travels compressed in the URL hash (`#R<data>`),
 *        like draw.io's raw-file links, so it never reaches a server.
 *
 * draw.io's format (jgraph/drawio v32.4.1, EditorUi.js:9545 and App.js:6669):
 *   link   = '#R' + encodeURIComponent(Graph.compress(xml))
 *   Graph.compress(xml) = btoa(pako.deflateRaw(encodeURIComponent(xml)))      (Graph.js:3327)
 *   reader: data = decodeURIComponent(hash.substring(2));
 *           if (data.charAt(0) != '<') data = Graph.decompress(data)          (App.js:6677)
 *
 * The app's own links use the same payload in base64url without padding (`-`/`_` instead of
 * `+`/`/`, which encodeURIComponent would turn into 3-character `%2B`/`%2F` escapes). The reader
 * accepts both alphabets and also raw `#R<url-encoded xml>`, so app.diagrams.net links work too.
 *
 * Incoming data is untrusted: size caps on the hash, the inflated stream and the decoded text;
 * the result is plain XML that goes through the normal file loader (never evaluated).
 */

/** Prefix of a diagram link hash. */
export const SHARE_HASH_PREFIX = '#R';

/** Links longer than this get a "may be truncated" warning (chat apps, mail clients, Office). */
export const SHARE_LINK_WARN_LENGTH = 32_000;

/** Largest decoded diagram (UTF-8 bytes) a link may carry. */
export const MAX_SHARED_XML_BYTES = 5 * 1024 * 1024;

/** draw.io's web app; `#R` links open there. */
export const DRAWIO_APP_URL = 'https://app.diagrams.net/';

export class ShareLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareLinkError';
  }
}

// ------------------------------------------------------------------------------------------
// Bytes <-> base64
// ------------------------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64 or base64url (with or without padding) -> standard padded base64. */
export function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 1) throw new ShareLinkError('The link data is not valid base64');
  return pad === 0 ? b64 : b64 + '='.repeat(4 - pad);
}

// ------------------------------------------------------------------------------------------
// Deflate / inflate (CompressionStream 'deflate-raw', same bitstream as pako.deflateRaw)
// ------------------------------------------------------------------------------------------

async function readAll(
  readable: ReadableStream<Uint8Array>,
  limit: number,
  onLimit: () => Error
): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw onLimit();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function pipeThrough(
  input: Uint8Array,
  stream: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> },
  limit: number,
  onLimit: () => Error
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const write = (async () => {
    await writer.write(input as Uint8Array<ArrayBuffer>);
    await writer.close();
  })();
  // A failed write (corrupt input) also errors the readable side; read() reports it
  write.catch(() => undefined);
  const [, out] = await Promise.all([write, readAll(stream.readable, limit, onLimit)]);
  return out;
}

export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new ShareLinkError('This browser cannot compress data (no CompressionStream)');
  }
  return pipeThrough(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER, () => new Error());
}

export async function inflateRaw(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ShareLinkError('This browser cannot open diagram links (no DecompressionStream)');
  }
  let tooLarge = false;
  try {
    return await pipeThrough(bytes, new DecompressionStream('deflate-raw'), limit, () => {
      tooLarge = true;
      return new ShareLinkError('too large');
    });
  } catch {
    if (tooLarge) throw tooLargeError();
    throw new ShareLinkError('The diagram data in the link is corrupt or incomplete');
  }
}

function tooLargeError(): ShareLinkError {
  return new ShareLinkError(
    `The diagram in the link is too large (over ${Math.round(MAX_SHARED_XML_BYTES / (1024 * 1024))} MB)`
  );
}

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

// ------------------------------------------------------------------------------------------
// Encode
// ------------------------------------------------------------------------------------------

/** draw.io's Graph.compress: standard base64 of deflateRaw(encodeURIComponent(xml)). */
export async function drawioCompress(xml: string): Promise<string> {
  return bytesToBase64(await deflateRaw(asciiBytes(encodeURIComponent(xml))));
}

/** The app's link payload: Graph.compress in base64url without padding. */
export async function encodeShareData(xml: string): Promise<string> {
  return toBase64Url(await drawioCompress(xml));
}

/** Page URL without query parameters and hash (`https://host/railway-drawer/`). */
export function appBaseUrl(location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${location.origin}${location.pathname}`;
}

/** Link that opens `xml` in this app. */
export async function buildAppShareLink(xml: string, baseUrl: string = appBaseUrl()): Promise<string> {
  return `${baseUrl}${SHARE_HASH_PREFIX}${await encodeShareData(xml)}`;
}

/** Link that opens `xml` in app.diagrams.net (draw.io's exact `#R` encoding). */
export async function buildDrawioShareLink(xml: string, drawioUrl: string = DRAWIO_APP_URL): Promise<string> {
  return `${drawioUrl}${SHARE_HASH_PREFIX}${encodeURIComponent(await drawioCompress(xml))}`;
}

// ------------------------------------------------------------------------------------------
// Decode
// ------------------------------------------------------------------------------------------

/** True when `hash` (location.hash) is a diagram link. */
export function isShareHash(hash: string | null | undefined): boolean {
  return typeof hash === 'string' && hash.startsWith(SHARE_HASH_PREFIX) && hash.length > SHARE_HASH_PREFIX.length;
}

export interface DecodeOptions {
  /** Largest decoded XML in UTF-8 bytes (default MAX_SHARED_XML_BYTES). */
  maxBytes?: number;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Decodes a `#R...` hash (or just the data after `#R`) to the diagram XML.
 * Throws ShareLinkError with a user-readable message for anything that is not a diagram.
 */
export async function decodeShareHash(hash: string, opts: DecodeOptions = {}): Promise<string> {
  const maxBytes = opts.maxBytes ?? MAX_SHARED_XML_BYTES;
  let data = hash.startsWith(SHARE_HASH_PREFIX) ? hash.slice(SHARE_HASH_PREFIX.length) : hash;
  data = data.trim();
  if (!data) throw new ShareLinkError('The link contains no diagram');
  // Compressed data is ~1/4 of the XML; raw XML links are URI-encoded (up to 9 chars per character)
  if (data.length > maxBytes * 9) throw tooLargeError();

  try {
    data = decodeURIComponent(data);
  } catch {
    throw new ShareLinkError('The link is damaged (invalid URL encoding); it may have been cut off');
  }

  let xml: string;
  if (data.charAt(0) === '<') {
    // draw.io also writes raw XML links ('#R' + encodeURIComponent(xml)) for multi-page files
    xml = data;
  } else {
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(fromBase64Url(data.replace(/\s+/g, '')));
    } catch {
      throw new ShareLinkError('The link is damaged (the diagram data is not valid base64)');
    }
    // The inflated text is URI-encoded: each UTF-8 byte is at most 3 characters
    const inflated = await inflateRaw(bytes, maxBytes * 3);
    let text = '';
    for (let i = 0; i < inflated.length; i += 0x8000) {
      text += String.fromCharCode.apply(null, Array.from(inflated.subarray(i, i + 0x8000)));
    }
    try {
      xml = decodeURIComponent(text);
    } catch {
      // Very old draw.io links compressed the XML without URI-encoding it first
      xml = new TextDecoder().decode(inflated);
    }
  }

  if (utf8Length(xml) > maxBytes) throw tooLargeError();
  xml = xml.trim();
  if (!xml.startsWith('<')) throw new ShareLinkError('The link does not contain a diagram');
  return xml;
}

/** Removes the `#R...` hash from the address bar without reloading or adding a history entry. */
export function stripShareHash(win: Window = window): void {
  if (!isShareHash(win.location.hash)) return;
  try {
    win.history.replaceState(win.history.state, '', `${win.location.pathname}${win.location.search}`);
  } catch {
    // history unavailable (sandboxed iframe): leave the hash
  }
}
