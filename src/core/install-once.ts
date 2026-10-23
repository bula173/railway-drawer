/**
 * @file install-once.ts
 * @brief The one idempotency helper for "install once" patches (graph method wrappers, handler
 *        augmentations, page-wide setup).
 *
 * Replaces the earlier per-module schemes (private `Symbol()` / `Symbol.for()` marks on the
 * graph, module-level `WeakSet`s and `let installed` flags). A mark is a named key stored on the
 * target object itself under one shared registered symbol, so it survives module re-evaluation
 * (Vite HMR, `vi.resetModules()`) exactly like the former `Symbol.for` marks did, and it is
 * released with the target (no module-level registry that keeps graphs alive).
 *
 * Page-wide installs (prototype patches, document listeners) use a module-local scope object:
 * `const PAGE = createInstallScope()` + `installOnce(PAGE, 'name')`. That keeps the old
 * `let installed = false` semantics (re-armed when the module itself is re-evaluated).
 */

const MARKS = Symbol.for('rd.installOnce');

type Marked = { [MARKS]?: Set<string> };

function marksOf(target: object, create: boolean): Set<string> | undefined {
  const t = target as Marked;
  let marks = t[MARKS];
  if (!marks && create) {
    marks = new Set<string>();
    // Non-enumerable: never serialised, never shown by spread/Object.keys
    Object.defineProperty(target, MARKS, { value: marks, enumerable: false, configurable: true });
  }
  return marks;
}

/**
 * Marks `target` as having `key` installed. Returns true the first time (the caller installs now)
 * and false when it already was. With `install`, runs it on the first call only.
 */
export function installOnce(target: object, key: string, install?: () => void): boolean {
  const marks = marksOf(target, true)!;
  if (marks.has(key)) return false;
  marks.add(key);
  install?.();
  return true;
}

/** Whether `installOnce(target, key)` has run. */
export function isInstalled(target: object, key: string): boolean {
  return marksOf(target, false)?.has(key) ?? false;
}

/** The installed keys of `target`, in installation order (tests, diagnostics). */
export function installedKeys(target: object): string[] {
  return Array.from(marksOf(target, false) ?? []);
}

/** A scope object for page-wide installs that should re-arm when their module is re-evaluated. */
export function createInstallScope(): object {
  return {};
}
