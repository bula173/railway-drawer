/**
 * Lazy loading of the vendored draw.io shape libraries (src/drawio-shapes/vendor/*.js, one chunk
 * each) and of the stencil sets draw.io's mxStencilRegistry.libraries (Editor.js) pairs with them.
 * Nothing here is part of the main chunk: the stencil engine imports this module dynamically the
 * first time a drawing, palette or library uses a shape name it does not know yet.
 */
import { reportLoadFailure } from '../../core/load-failure';
import { logger } from '../../drawio/logger';
import { flushHandleFactories, getMxShim } from './mx-shim';

const LOG = 'drawio-vendor';

interface VendorModule {
  default: (mx: Record<string, unknown>) => void;
  id: string;
}

export interface VendorIndex {
  drawioTag: string;
  modules: Array<{ id: string; source: string; deps: string[]; stencils: string[]; shapes: string[]; handles: number }>;
  /** mxStencilRegistry.libraries: basename -> stencil files (relative to stencils/) and modules. */
  libraries: Record<string, { stencils: string[]; modules: string[] }>;
}

const MODULES = import.meta.glob<VendorModule>('../vendor/*.js');

let indexPromise: Promise<VendorIndex> | null = null;
let shapeToModule: Map<string, string> | null = null;
const installed = new Map<string, Promise<void>>();

/** The generated index (module -> shapes, stencil libraries); fetched once. */
export function loadVendorIndex(): Promise<VendorIndex> {
  if (!indexPromise) {
    indexPromise = import('../vendor/index.json').then((m) => {
      const index = (m as unknown as { default: VendorIndex }).default ?? (m as unknown as VendorIndex);
      shapeToModule = new Map();
      for (const mod of index.modules) for (const s of mod.shapes) if (!shapeToModule.has(s)) shapeToModule.set(s, mod.id);
      return index;
    });
  }
  return indexPromise;
}

/** Ids of all vendored modules (for tests and diagnostics). */
export function vendorModuleIds(): string[] {
  return Object.keys(MODULES).map((p) => p.replace(/^.*\/(.+)\.js$/, '$1')).sort();
}

/** Installs a vendored module (its dependencies first); each module runs once. */
export function loadVendorModule(id: string): Promise<void> {
  let p = installed.get(id);
  if (!p) {
    p = (async () => {
      const index = await loadVendorIndex();
      const info = index.modules.find((m) => m.id === id);
      if (!info) throw new Error(`unknown draw.io shape module ${id}`);
      for (const dep of info.deps) await loadVendorModule(dep);
      const load = MODULES[`../vendor/${id}.js`];
      if (!load) throw new Error(`draw.io shape module ${id} is missing`);
      const mod = await load();
      mod.default(getMxShim());
      flushHandleFactories();
      logger.debug(LOG, 'draw.io shape library loaded', { id, shapes: info.shapes.length });
    })();
    installed.set(id, p);
    p.catch((err: unknown) => {
      installed.delete(id);
      reportLoadFailure('warn', LOG, 'draw.io shape library failed to load', err, { id });
    });
  }
  return p;
}

/**
 * What draw.io would load for these shape names / stencil basenames: the modules registering
 * the JS shapes and, per basename, mxStencilRegistry.libraries[basename] (or `<basename>.xml`).
 */
export async function resolveDrawioShapes(
  names: readonly string[],
  basenames: readonly string[],
): Promise<{ modules: string[]; stencilFiles: string[] }> {
  const index = await loadVendorIndex();
  const modules = new Set<string>();
  const files = new Set<string>();
  for (const n of names) {
    const m = shapeToModule?.get(n);
    if (m) modules.add(m);
  }
  for (const b of basenames) {
    const lib = Object.prototype.hasOwnProperty.call(index.libraries, b) ? index.libraries[b] : null;
    if (lib) {
      lib.modules.forEach((m) => modules.add(m));
      lib.stencils.forEach((f) => files.add(f));
    } else {
      files.add(`${b.replace('_-_', '_')}.xml`);
    }
  }
  // stencils the modules (and their dependencies) draw themselves, e.g. mxgraph.basic.cloud_callout
  const seen = new Set<string>();
  const addStencilsOf = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const info = index.modules.find((m) => m.id === id);
    if (!info) return;
    info.stencils.forEach((f) => files.add(f));
    info.deps.forEach(addStencilsOf);
  };
  [...modules].forEach(addStencilsOf);
  return { modules: [...modules], stencilFiles: [...files] };
}

/** Loads the given modules; resolves true when at least one was newly installed. */
export async function loadVendorModules(ids: readonly string[]): Promise<boolean> {
  let fresh = false;
  await Promise.all(ids.map(async (id) => {
    const was = installed.has(id);
    try {
      await loadVendorModule(id);
      if (!was) fresh = true;
    } catch {
      // logged in loadVendorModule
    }
  }));
  return fresh;
}
