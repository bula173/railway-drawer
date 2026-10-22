/**
 * @file mxlibrary.ts
 * @brief Reads draw.io library files (`<mxlibrary>[JSON]</mxlibrary>`) for the maxGraph editor.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/diagramly/EditorUi.js:5199-5217 (compressed entries) and :5794
 * (image entry style).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/diagramly/EditorUi.js
 *
 * An entry carries either `xml` (an mxGraphModel: plain, entity-escaped, or compressed with
 * Graph.compress) or `data` (an image URL / data URI). Cells are inserted with the importer
 * in src/services/drawio-xml.ts; this module only turns entries into mxGraphModel XML.
 */

import { logger } from '../../drawio/logger';
import { decompress } from './codec';

const LOG = 'drawio-library';

export interface LibraryEntry {
  title: string;
  w: number;
  h: number;
  aspect?: string;
  tags?: string;
  /** Decoded `<mxGraphModel>` XML. */
  xml?: string;
  /** Image URL or data URI. */
  data?: string;
}

/** Size used when an entry has no usable w/h. */
const DEFAULT_SIZE = 80;

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function unescapeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Decodes an entry's `xml` field: plain, entity-escaped or compressed. Null if unusable. */
export function decodeEntryXml(raw: string): string | null {
  const text = raw.trim();
  if (text.startsWith('<')) return text;
  if (text.startsWith('&lt;')) return unescapeEntities(text).trim();
  try {
    const xml = decompress(text).trim();
    return xml.startsWith('<') ? xml : null;
  } catch {
    return null;
  }
}

export function readLibraryJson(text: string): unknown {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Library is not well-formed XML');
  }
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'mxlibrary') {
    throw new Error(`Expected <mxlibrary> root, got <${root?.nodeName ?? 'none'}>`);
  }
  // textContent decodes the entity-escaped XML of each entry
  try {
    return JSON.parse(root.textContent ?? '');
  } catch (err) {
    throw new Error(`Library body is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Parses a draw.io library: an `<mxlibrary>` document or a bare JSON array. Throws when the
 * file itself is unreadable; entries that cannot be decoded are skipped with a warning.
 */
export function parseMxLibrary(text: string): LibraryEntry[] {
  const raw = readLibraryJson(text);
  if (!Array.isArray(raw)) throw new Error('Library body must be a JSON array');
  const entries: LibraryEntry[] = [];
  raw.forEach((item: unknown, index) => {
    if (typeof item !== 'object' || item === null) {
      logger.warn(LOG, 'Library entry is not an object; skipped', { index });
      return;
    }
    const rec = item as Record<string, unknown>;
    const entry: LibraryEntry = {
      title: typeof rec.title === 'string' ? rec.title : '',
      w: toNumber(rec.w) ?? DEFAULT_SIZE,
      h: toNumber(rec.h) ?? DEFAULT_SIZE,
    };
    if (typeof rec.aspect === 'string') entry.aspect = rec.aspect;
    if (typeof rec.tags === 'string') entry.tags = rec.tags;
    if (typeof rec.xml === 'string' && rec.xml.trim() !== '') {
      const xml = decodeEntryXml(rec.xml);
      if (xml === null) {
        logger.warn(LOG, 'Library entry xml cannot be decoded; skipped', { index, title: entry.title });
        return;
      }
      entry.xml = xml;
    } else if (typeof rec.data === 'string' && rec.data.trim() !== '') {
      entry.data = rec.data.trim();
    } else {
      logger.warn(LOG, 'Library entry has neither xml nor data; skipped', { index, title: entry.title });
      return;
    }
    entries.push(entry);
  });
  return entries;
}

/** Fetches and parses a library. Throws on HTTP errors and unreadable files. */
export async function loadMxLibraryFromUrl(url: string, init?: RequestInit): Promise<LibraryEntry[]> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
  return parseMxLibrary(await response.text());
}

function readBlobText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Cannot read file'));
    reader.readAsText(file);
  });
}

/** Parses a library file chosen by the user (Import library…). */
export async function loadMxLibraryFromFile(file: Blob): Promise<LibraryEntry[]> {
  return parseMxLibrary(await readBlobText(file));
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** draw.io's EditorUi.convertDataUri: `;base64,` -> `,` (`;` would end the style value). */
function convertDataUri(data: string): string {
  return data.startsWith('data:') ? data.replace(';base64,', ',') : data;
}

/**
 * The entry as `<mxGraphModel>` XML ready for the draw.io importer. `<root>` content is
 * wrapped; an image entry becomes one `shape=image` vertex (draw.io's image entry style).
 */
export function entryToCells(entry: LibraryEntry): string {
  if (entry.xml) {
    const xml = entry.xml.trim();
    if (/^<mxGraphModel[\s>/]/.test(xml)) return xml;
    if (/^<root[\s>/]/.test(xml)) return `<mxGraphModel>${xml}</mxGraphModel>`;
    return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${xml}</root></mxGraphModel>`;
  }
  const style =
    'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=' +
    convertDataUri(entry.data ?? '');
  return (
    '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
    `<mxCell id="2" value="" style="${escapeAttr(style)}" vertex="1" parent="1">` +
    `<mxGeometry width="${entry.w}" height="${entry.h}" as="geometry"/></mxCell>` +
    '</root></mxGraphModel>'
  );
}
