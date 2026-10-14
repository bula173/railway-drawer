/**
 * @file entries.ts
 * @brief Collects the draw.io parity entries (Node side).
 *
 * Sources: src/drawio-shapes/palettes/data/*.json (draw.io v32.4.1 palettes) and the
 * ERTMS library public/libraries/ertms.xml (<mxlibrary>, parsed here with node:zlib so
 * the harness does not depend on the browser engine). Every entry becomes one
 * mxGraphModel XML at its native size with its top-left content at (20,20).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as zlibConstants, inflateRawSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');
export const PALETTE_DATA_DIR = resolve(REPO_ROOT, 'src/drawio-shapes/palettes/data');
export const ERTMS_LIBRARY = resolve(REPO_ROOT, 'public/libraries/ertms.xml');
export const EXPECTED_MISMATCH_FILE = resolve(HERE, 'expected-mismatch.json');
export const ORIGIN = 20;

/** draw.io palette order (Sidebar.js), then the library. */
export const PALETTE_ORDER = ['general', 'misc', 'advanced', 'basic', 'arrows2', 'flowchart', 'arrows', 'ertms'];

export interface ParityEntry {
  /** Stable id: palette entry id, or ertms-<index>-<slug(title)>. */
  id: string;
  palette: string;
  title: string;
  kind: 'vertex' | 'edge' | 'cells';
  cls?: string;
  width: number;
  height: number;
  /** mxGraphModel XML rendered on both sides. */
  xml: string;
  /** Reason when listed in expected-mismatch.json (reported, never failing). */
  expectedMismatch?: string;
}

interface RawPaletteEntry {
  id: string;
  title: string;
  kind: 'vertex' | 'edge' | 'cells';
  width: number;
  height: number;
  style?: string;
  value?: string;
  xml?: string;
  cls?: string;
}

interface RawPalette {
  id: string;
  title: string;
  entries: RawPaletteEntry[];
}

export interface LibraryEntry {
  title: string;
  w: number;
  h: number;
  aspect?: string;
  xml?: string;
  data?: string;
}

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry'
  );
}

export function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#xa;');
}

export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g, (_m, e: string) => {
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'amp') return '&';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });
}

/**
 * draw.io's base64 + raw-deflate + encodeURIComponent compression (Graph.decompress),
 * lenient: Z_SYNC_FLUSH returns what was inflated when the final block is missing.
 */
export function decompressDrawio(b64: string): string {
  const bytes = inflateRawSync(Buffer.from(b64, 'base64'), { finishFlush: zlibConstants.Z_SYNC_FLUSH });
  const text = bytes.toString('latin1');
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Parses an <mxlibrary>[JSON]</mxlibrary> document (or a bare JSON array). */
export function parseMxLibraryNode(text: string): LibraryEntry[] {
  const trimmed = text.trim();
  const m = /^<mxlibrary[^>]*>([\s\S]*)<\/mxlibrary>\s*$/.exec(trimmed);
  const json = m ? decodeXmlEntities(m[1]) : trimmed;
  const raw = JSON.parse(json) as LibraryEntry[];
  return raw.map((e) => {
    const entry: LibraryEntry = { ...e, title: e.title ?? '', w: Number(e.w ?? 80), h: Number(e.h ?? 80) };
    if (typeof e.xml === 'string') {
      const x = e.xml.trim();
      entry.xml = x.startsWith('<') ? x : decompressDrawio(x);
    }
    return entry;
  });
}

const EMPTY_ROOT = '<mxCell id="0"/><mxCell id="1" parent="0"/>';

function model(cells: string): string {
  return `<mxGraphModel><root>${EMPTY_ROOT}${cells}</root></mxGraphModel>`;
}

export function vertexXml(style: string, value: string, width: number, height: number): string {
  return model(
    `<mxCell id="2" value="${escapeAttr(value)}" style="${escapeAttr(style)}" vertex="1" parent="1">` +
      `<mxGeometry x="${ORIGIN}" y="${ORIGIN}" width="${width}" height="${height}" as="geometry"/></mxCell>`
  );
}

/** Same geometry as Sidebar.createEdgeTemplateEntry: source (0,h) → target (w,0). */
export function edgeXml(style: string, value: string, width: number, height: number): string {
  return model(
    `<mxCell id="2" value="${escapeAttr(value)}" style="${escapeAttr(style)}" edge="1" parent="1">` +
      `<mxGeometry width="${width}" height="${height}" relative="1" as="geometry">` +
      `<mxPoint x="${ORIGIN}" y="${ORIGIN + height}" as="sourcePoint"/>` +
      `<mxPoint x="${ORIGIN + width}" y="${ORIGIN}" as="targetPoint"/>` +
      `</mxGeometry></mxCell>`
  );
}

const CELL_RE = /<mxCell\b([^>]*?)(\/>|>([\s\S]*?)<\/mxCell>)/g;

function attr(attrs: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
}

function setAttr(attrs: string, name: string, value: number): string {
  const re = new RegExp(`(^|\\s)${name}="[^"]*"`);
  return re.test(attrs) ? attrs.replace(re, `$1${name}="${value}"`) : `${attrs} ${name}="${value}"`;
}

/** Top-left of the layer-1 cells (vertex x/y, edge points). */
function topLeft(xml: string): { x: number; y: number } {
  let x = Infinity;
  let y = Infinity;
  for (const m of xml.matchAll(CELL_RE)) {
    if (attr(m[1], 'parent') !== '1' || !m[3]) continue;
    const geo = /<mxGeometry\b([^>]*?)(\/>|>([\s\S]*?)<\/mxGeometry>)/.exec(m[3]);
    if (!geo) continue;
    if (attr(geo[1], 'relative') === '1') {
      for (const p of (geo[3] ?? '').matchAll(/<mxPoint\b([^>]*?)\/>/g)) {
        if (attr(p[1], 'as') === 'offset') continue;
        x = Math.min(x, Number(attr(p[1], 'x') ?? 0));
        y = Math.min(y, Number(attr(p[1], 'y') ?? 0));
      }
    } else {
      x = Math.min(x, Number(attr(geo[1], 'x') ?? 0));
      y = Math.min(y, Number(attr(geo[1], 'y') ?? 0));
    }
  }
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

/** Moves the layer-1 cells of a model so that its top-left lands at (ORIGIN, ORIGIN). */
export function placeAtOrigin(xml: string): string {
  const wrapped = /^\s*<mxGraphModel\b/.test(xml) ? xml : /^\s*<root\b/.test(xml) ? `<mxGraphModel>${xml}</mxGraphModel>` : model(xml);
  const tl = topLeft(wrapped);
  const dx = ORIGIN - tl.x;
  const dy = ORIGIN - tl.y;
  if (dx === 0 && dy === 0) return wrapped;
  return wrapped.replace(CELL_RE, (whole, attrs: string, _tail: string, body: string | undefined) => {
    if (attr(attrs, 'parent') !== '1' || !body) return whole;
    const newBody = body.replace(
      /<mxGeometry\b([^>]*?)(\/>|>([\s\S]*?)<\/mxGeometry>)/,
      (_g, gattrs: string, gtail: string, gbody: string | undefined) => {
        if (attr(gattrs, 'relative') === '1') {
          const pts = (gbody ?? '').replace(/<mxPoint\b([^>]*?)\/>/g, (pm, pattrs: string) => {
            if (attr(pattrs, 'as') === 'offset') return pm;
            let a = setAttr(pattrs, 'x', Number(attr(pattrs, 'x') ?? 0) + dx);
            a = setAttr(a, 'y', Number(attr(pattrs, 'y') ?? 0) + dy);
            return `<mxPoint${a}/>`;
          });
          return gtail === '/>' ? `<mxGeometry${gattrs}/>` : `<mxGeometry${gattrs}>${pts}</mxGeometry>`;
        }
        let a = setAttr(gattrs, 'x', Number(attr(gattrs, 'x') ?? 0) + dx);
        a = setAttr(a, 'y', Number(attr(gattrs, 'y') ?? 0) + dy);
        return gtail === '/>' ? `<mxGeometry${a}/>` : `<mxGeometry${a}>${gbody ?? ''}</mxGeometry>`;
      }
    );
    return `<mxCell${attrs}>${newBody}</mxCell>`;
  });
}

export interface ExpectedMismatchConfig {
  /** Entry id → reason. */
  ids: Record<string, string>;
  /** Substring of the entry XML → reason (e.g. "sketch=1"). */
  xmlIncludes: Record<string, string>;
}

export function loadExpectedMismatch(file = EXPECTED_MISMATCH_FILE): ExpectedMismatchConfig {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<ExpectedMismatchConfig>;
  return { ids: raw.ids ?? {}, xmlIncludes: raw.xmlIncludes ?? {} };
}

export function expectedMismatchReason(entry: ParityEntry, cfg: ExpectedMismatchConfig): string | undefined {
  if (cfg.ids[entry.id]) return cfg.ids[entry.id];
  for (const [needle, reason] of Object.entries(cfg.xmlIncludes)) {
    if (entry.xml.includes(needle)) return reason;
  }
  return undefined;
}

function paletteEntries(p: RawPalette): ParityEntry[] {
  return p.entries.map((e) => {
    let xml: string;
    if (e.kind === 'cells' && e.xml) xml = placeAtOrigin(e.xml);
    else if (e.kind === 'edge') xml = edgeXml(e.style ?? '', e.value ?? '', e.width, e.height);
    else xml = vertexXml(e.style ?? '', e.value ?? '', e.width, e.height);
    return { id: e.id, palette: p.id, title: e.title, kind: e.kind, cls: e.cls, width: e.width, height: e.height, xml };
  });
}

/** Library entries as draw.io inserts them (Sidebar.addLibraryEntries). */
export function libraryEntries(entries: LibraryEntry[], palette: string): ParityEntry[] {
  return entries.map((e, i) => {
    const title = e.title || `${palette} ${i}`;
    const xml = e.xml
      ? placeAtOrigin(e.xml)
      : vertexXml(
          'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=' + (e.data ?? ''),
          '',
          e.w,
          e.h
        );
    return { id: `${palette}-${i}-${slug(title)}`, palette, title, kind: 'cells' as const, width: e.w, height: e.h, xml };
  });
}

export interface CollectOptions {
  /** Palette id or entry-id substring (PARITY_FILTER). */
  filter?: string;
  /** Max entries per palette (PARITY_LIMIT). */
  limit?: number;
}

/** All parity entries grouped by palette, in PALETTE_ORDER. */
export function collectEntries(opts: CollectOptions = {}): Map<string, ParityEntry[]> {
  const cfg = existsSync(EXPECTED_MISMATCH_FILE) ? loadExpectedMismatch() : { ids: {}, xmlIncludes: {} };
  const groups = new Map<string, ParityEntry[]>();
  const add = (palette: string, list: ParityEntry[]): void => {
    const filter = opts.filter?.trim().toLowerCase();
    let selected = filter && filter !== palette ? list.filter((e) => e.id.toLowerCase().includes(filter)) : list;
    if (opts.limit && opts.limit > 0) selected = selected.slice(0, opts.limit);
    for (const e of selected) e.expectedMismatch = expectedMismatchReason(e, cfg);
    if (selected.length) groups.set(palette, selected);
  };
  if (existsSync(PALETTE_DATA_DIR)) {
    const files = readdirSync(PALETTE_DATA_DIR).filter((f) => f.endsWith('.json'));
    const palettes = files.map((f) => JSON.parse(readFileSync(resolve(PALETTE_DATA_DIR, f), 'utf8')) as RawPalette);
    palettes.sort((a, b) => rank(a.id) - rank(b.id));
    for (const p of palettes) add(p.id, paletteEntries(p));
  }
  if (existsSync(ERTMS_LIBRARY)) add('ertms', libraryEntries(parseMxLibraryNode(readFileSync(ERTMS_LIBRARY, 'utf8')), 'ertms'));
  return groups;
}

function rank(id: string): number {
  const i = PALETTE_ORDER.indexOf(id);
  return i < 0 ? PALETTE_ORDER.length : i;
}
