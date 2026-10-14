/**
 * @file stencil-registry.ts
 * @brief draw.io stencil support for maxGraph: `shape=stencil(<base64 deflate>)` and named
 * stencils (`mxgraph.basic.*`, `mxgraph.flowchart.*`, ...) loaded from stencil XML sets.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Graph.js:22182-22510 (createShape for stencil(...),
 * mxStencilRegistry.getStencil, getBasenameForStencil, parseStencilSet) and
 * src/main/webapp/js/diagramly/Editor.js:12789-12852 (mxStencilRegistry.libraries).
 * Sources: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Graph.js
 *          https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/diagramly/Editor.js
 *
 * Differences from draw.io: stencil sets are never loaded with synchronous XHR. Callers
 * preload them (preloadStencilSets / ensureStencilsForXml) and then call graph.refresh().
 * A JS shape registered in CellRenderer.defaultShapes always wins over a stencil of the
 * same name.
 */

import { CellRenderer, Shape, StencilShape, StencilShapeRegistry } from '@maxgraph/core';
import type { CellState } from '@maxgraph/core';
import { logger } from '../../drawio/logger';
import { decompress } from './codec';
import { installStencilArcFix } from './stencil-fixes';

const LOG = 'drawio-stencils';
const STENCIL_PREFIX = 'stencil(';

/**
 * Basename -> stencil XML files (relative to `<baseUrl>stencils/`), the subset of draw.io's
 * mxStencilRegistry.libraries (Editor.js:12789-12852) we vendor. The JS files listed there
 * (mxBasic.js, mxArrows.js, mxFlowchart.js) are ported and registered statically, so they
 * are not listed. A basename that is missing here loads `<basename with _-_ -> _>.xml`,
 * as draw.io does.
 */
export const STENCIL_LIBRARIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // mxStencilRegistry.libraries['arrows2'] = [SHAPES_PATH + '/mxArrows.js'] (JS only)
  arrows2: [],
  // mxStencilRegistry.libraries['basic'] = [SHAPES_PATH + '/mxBasic.js', STENCIL_PATH + '/basic.xml']
  basic: ['basic.xml'],
  // mxStencilRegistry.libraries['flowchart'] = [SHAPES_PATH + '/mxFlowchart.js', STENCIL_PATH + '/flowchart.xml']
  flowchart: ['flowchart.xml'],
});

export interface StencilEngineOptions {
  /** Base URL that `stencils/<basename>.xml` is resolved against. Default import.meta.env.BASE_URL. */
  baseUrl?: string;
}

const MAX_INLINE_CACHE = 1000;

let installed = false;
let baseUrl = defaultBaseUrl();
/** Decoded `stencil(...)` styles; null = failed to decode (logged once). */
const inlineCache = new Map<string, StencilShape | null>();
/** Preload promise per stencil file path. */
const filePromises = new Map<string, Promise<void>>();

function defaultBaseUrl(): string {
  try {
    return import.meta.env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** True when a JS shape (CellRenderer.registerShape) exists under this exact name. */
function isJsShape(name: string): boolean {
  return hasOwn(CellRenderer.defaultShapes, name);
}

/** Replaces the registry object with a prototype-less copy, so `__proto__` etc. are plain keys. */
function ensureNullPrototypeStore(): Record<string, StencilShape> {
  const current = StencilShapeRegistry.stencils as Record<string, StencilShape>;
  if (Object.getPrototypeOf(current) === null) return current;
  const store = Object.create(null) as Record<string, StencilShape>;
  for (const key of Object.keys(current)) store[key] = current[key];
  StencilShapeRegistry.stencils = store;
  return store;
}

/** Registered stencil for `name` (exact, then lowercase), or null. JS shapes win. */
export function lookupStencil(name: unknown): StencilShape | null {
  if (typeof name !== 'string' || name === '' || isJsShape(name)) return null;
  const store = ensureNullPrototypeStore();
  if (hasOwn(store, name)) return store[name];
  const lower = name.toLowerCase();
  if (lower !== name && hasOwn(store, lower)) return store[lower];
  return null;
}

/** Adds a stencil under its lowercase name. */
export function addStencil(name: string, stencil: StencilShape): void {
  ensureNullPrototypeStore()[name.toLowerCase()] = stencil;
}

/**
 * Decodes `stencil(<base64>)` into a StencilShape (cached by the full style value).
 * Returns null, and logs once, when it cannot be decoded.
 */
export function getInlineStencil(shape: string): StencilShape | null {
  if (inlineCache.has(shape)) return inlineCache.get(shape) ?? null;
  let stencil: StencilShape | null = null;
  try {
    const end = shape.endsWith(')') ? shape.length - 1 : shape.length;
    const xml = decompress(shape.substring(STENCIL_PREFIX.length, end));
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (!doc.documentElement || doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('stencil XML is not well-formed');
    }
    stencil = new StencilShape(doc.documentElement);
  } catch (err) {
    logger.error(LOG, 'Error in shape: cannot decode stencil(...)', {
      error: err instanceof Error ? err.message : String(err),
      head: shape.slice(0, 48),
    });
  }
  if (inlineCache.size >= MAX_INLINE_CACHE) {
    const oldest = inlineCache.keys().next().value;
    if (oldest !== undefined) inlineCache.delete(oldest);
  }
  inlineCache.set(shape, stencil);
  return stencil;
}

/**
 * Installs the engine (idempotent; a later call only updates `baseUrl`):
 * - CellRenderer.prototype.createShape renders `shape=stencil(...)`;
 * - StencilShapeRegistry.getStencil looks names up case-insensitively, in a prototype-less
 *   store, and returns null when a JS shape of that name is registered.
 */
export function installStencilEngine(options: StencilEngineOptions = {}): void {
  if (options.baseUrl !== undefined) baseUrl = options.baseUrl;
  if (installed) return;
  installed = true;

  installStencilArcFix();
  ensureNullPrototypeStore();
  // Typed as returning StencilShape, but maxGraph itself returns undefined for unknown names
  StencilShapeRegistry.getStencil = ((name: string) => lookupStencil(name)) as typeof StencilShapeRegistry.getStencil;

  const proto = CellRenderer.prototype;
  const baseCreateShape = proto.createShape;
  proto.createShape = function createShape(this: CellRenderer, state: CellState): Shape {
    const shape = state.style?.shape as unknown;
    if (typeof shape === 'string' && shape.startsWith(STENCIL_PREFIX)) {
      const stencil = getInlineStencil(shape);
      if (stencil) return new Shape(stencil);
    }
    return baseCreateShape.call(this, state);
  };
}

/** True once installStencilEngine has run. */
export function isStencilEngineInstalled(): boolean {
  return installed;
}

/**
 * Basename of the stencil set that defines `name`, or null when no file must be loaded
 * (Graph.js:22223ff): `mxgraph.mscae.enterprise.x` -> `mscae/enterprise`.
 */
export function getBasenameForStencil(name: string): string | null {
  if (typeof name !== 'string') return null;
  const parts = name.split('.');
  if (parts.length > 0 && parts[0] === 'mxgraph') {
    let tmp = parts[1];
    for (let i = 2; i < parts.length - 1; i++) tmp += `/${parts[i]}`;
    return tmp ?? null;
  }
  return null;
}

/** Stencil XML files (relative to `stencils/`) for a basename. */
export function stencilFilesForBasename(basename: string): readonly string[] {
  if (hasOwn(STENCIL_LIBRARIES, basename)) return STENCIL_LIBRARIES[basename];
  return [`${basename.replace('_-_', '_')}.xml`];
}

export type StencilLoadCallback = (packageName: string, stencilName: string, name: string, w: number, h: number) => void;

/**
 * Registers every shape of a `<shapes name="pkg">` (or `<stencils>` of several) as
 * lowercase(pkg) + '.' + lowercase(name with spaces -> '_') (Graph.js:22450-22509).
 * Returns the registered names.
 */
export function parseStencilSet(
  root: Element | Document,
  onShape?: StencilLoadCallback,
  install = true
): string[] {
  const el = 'documentElement' in root ? root.documentElement : root;
  const names: string[] = [];
  if (!el) return names;
  if (el.nodeName === 'stencils') {
    for (let child = el.firstChild; child; child = child.nextSibling) {
      if (child.nodeName === 'shapes') names.push(...parseStencilSet(child as Element, onShape, install));
    }
    return names;
  }
  const pkgAttr = el.getAttribute('name');
  const packageName = pkgAttr != null ? `${pkgAttr}.`.toLowerCase() : '';
  for (let node = el.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1) continue;
    const shape = node as Element;
    const name = shape.getAttribute('name');
    if (name == null) continue;
    const stencilName = name.replace(/ /g, '_');
    const fullName = packageName + stencilName.toLowerCase();
    if (install) {
      addStencil(fullName, new StencilShape(shape));
      names.push(fullName);
    }
    if (onShape) {
      const w = shape.getAttribute('w');
      const h = shape.getAttribute('h');
      onShape(packageName, stencilName, name, w == null ? 80 : parseInt(w, 10), h == null ? 80 : parseInt(h, 10));
    }
  }
  return names;
}

function loadStencilFile(file: string): Promise<void> {
  const url = `${withSlash(baseUrl)}stencils/${file}`;
  let promise = filePromises.get(url);
  if (!promise) {
    promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          logger.warn(LOG, `Stencil set not available (HTTP ${response.status})`, { url });
          return;
        }
        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        if (!doc.documentElement || doc.getElementsByTagName('parsererror').length > 0) {
          logger.warn(LOG, 'Stencil set is not well-formed XML', { url });
          return;
        }
        const names = parseStencilSet(doc);
        logger.debug(LOG, 'Stencil set loaded', { url, stencils: names.length });
      } catch (err) {
        logger.warn(LOG, 'Stencil set failed to load', {
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    filePromises.set(url, promise);
  }
  return promise;
}

/**
 * Fetches the stencil sets for the given basenames (each file once; failures and 404s are
 * logged and swallowed). Call graph.refresh() afterwards.
 */
export async function preloadStencilSets(basenames: readonly string[]): Promise<void> {
  const files = new Set<string>();
  for (const basename of basenames) {
    if (!basename) continue;
    for (const file of stencilFilesForBasename(basename)) files.add(file);
  }
  await Promise.all(Array.from(files, (file) => loadStencilFile(file)));
}

const SHAPE_RE = /(?:^|[;"'\s{,])shape=([^;"'&<>\s]+)/g;

/** All `shape=` values in a model/library XML string or a list of style strings. */
export function collectShapeNames(xmlOrStyles: string | readonly string[]): string[] {
  const texts = typeof xmlOrStyles === 'string' ? [xmlOrStyles] : xmlOrStyles;
  const names = new Set<string>();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    SHAPE_RE.lastIndex = 0;
    for (let m = SHAPE_RE.exec(text); m; m = SHAPE_RE.exec(text)) names.add(m[1]);
  }
  return Array.from(names);
}

/**
 * Preloads the stencil sets that the named shapes of a model, library or style list need
 * (shapes already registered, JS shapes and `stencil(...)` are skipped). Resolves with the
 * basenames it loaded; the caller then calls graph.refresh().
 */
export async function ensureStencilsForXml(xmlOrStyles: string | readonly string[]): Promise<string[]> {
  const basenames = new Set<string>();
  for (const name of collectShapeNames(xmlOrStyles)) {
    if (name.startsWith(STENCIL_PREFIX) || isJsShape(name) || lookupStencil(name)) continue;
    // Not lowercased: draw.io basenames are case-sensitive (e.g. 'rackGeneral')
    const basename = getBasenameForStencil(name);
    if (basename) basenames.add(basename);
  }
  const list = Array.from(basenames);
  if (list.length > 0) await preloadStencilSets(list);
  return list;
}

/** Test helper: forgets decoded inline stencils and preload promises. */
export function resetStencilEngineCaches(): void {
  inlineCache.clear();
  filePromises.clear();
}
