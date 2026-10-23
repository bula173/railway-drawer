/**
 * @file codec.ts
 * @brief draw.io's compressed-string codec: Graph.compress / Graph.decompress.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Graph.js:3327 (compress/decompress), :3286
 * (stringToArrayBuffer) and mxUtils.zapGremlins.
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Graph.js
 *
 * Format: base64( deflateRaw( encodeURIComponent(xml) ) ). Used by `shape=stencil(...)`
 * styles, compressed library entries and compressed `<diagram>` pages.
 */

import { deflateRawStored, inflateRaw, inflateZlib } from './inflate';

/** Removes control characters except TAB, LF and CR (mxUtils.zapGremlins). */
export function zapGremlins(text: string): string {
  let out = '';
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const keep = (code >= 32 || code === 9 || code === 10 || code === 13) && code !== 0xffff && code !== 0xfffe;
    if (!keep) {
      if (i > last) out += text.substring(last, i);
      last = i + 1;
    }
  }
  return last === 0 ? text : out + text.substring(last);
}

/** atob() result as bytes, one byte per char code (Graph.stringToArrayBuffer). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

/** Bytes as a binary string for btoa (Graph.arrayBufferToString). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

/**
 * Bytes -> string like pako's `{to: 'string'}` (UTF-8, non-fatal). The payload is normally
 * URI-encoded ASCII, so this only matters for streams written without encodeURIComponent.
 */
function bytesToText(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * decodeURIComponent that tolerates a truncated tail (a lenient inflate can stop inside
 * a `%XX` escape) and, failing that, returns the raw string.
 */
function safeDecodeUri(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    const trimmed = text.replace(/%[0-9a-fA-F]?$/, '');
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return text;
    }
  }
}

/**
 * Default cap of decompress's inflated bytes (deflate bombs; the same as the async page/link
 * inflater, services/deflate-stream.ts MAX_INFLATED_BYTES). Stencils and library entries are tiny.
 */
export const MAX_DECOMPRESSED_BYTES = 50 * 1024 * 1024;

export interface DecompressOptions {
  /** Largest inflated size in bytes (default MAX_DECOMPRESSED_BYTES); beyond it InflateLimitError. */
  maxBytes?: number;
  /** true: zlib-wrapped stream (pako.inflate) instead of raw deflate. */
  inflate?: boolean;
  /** true: skip zapGremlins (Graph.decompress `checked`). */
  checked?: boolean;
}

/**
 * Graph.decompress: base64 -> (lenient) inflateRaw -> text -> decodeURIComponent ->
 * zapGremlins. Empty input is returned unchanged. Throws on invalid base64, malformed
 * deflate data or output beyond `maxBytes` (InflateLimitError); truncated streams return what
 * was decoded.
 */
export function decompress(data: string, opts: DecompressOptions = {}): string {
  if (data == null || data.length === 0) return data;
  const bytes = base64ToBytes(data);
  const max = opts.maxBytes ?? MAX_DECOMPRESSED_BYTES;
  const inflated = bytesToText(opts.inflate ? inflateZlib(bytes, max) : inflateRaw(bytes, max));
  const decoded = safeDecodeUri(inflated);
  return opts.checked ? decoded : zapGremlins(decoded);
}

/**
 * Graph.compress (raw form): base64( deflateRaw( encodeURIComponent(data) ) ). The deflate
 * step writes stored blocks: larger than pako's output but readable by draw.io.
 */
export function compress(data: string): string {
  if (data == null || data.length === 0) return data;
  const uri = encodeURIComponent(data);
  const bytes = new Uint8Array(uri.length);
  for (let i = 0; i < uri.length; i++) bytes[i] = uri.charCodeAt(i);
  return bytesToBase64(deflateRawStored(bytes));
}
