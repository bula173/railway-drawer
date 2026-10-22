/**
 * @file insert-ids.ts
 * @brief Railway IDs of inserted content (built-in templates): IDs that are free in the diagram are
 *        kept (TC3 stays TC3), colliding or missing ones get the next free ID with the same prefix
 *        (S2 -> S5, TC1 -> TC9), and references between the inserted objects (balise -> balise group,
 *        section/signal -> track, ...) follow the new IDs. Runs on the new cells before they are added,
 *        so the insert stays one undoable edit.
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import type { KindId } from './catalogue';
import { ID_ATTR, getKind } from './catalogue';
import { getCellKind, isElementValue, readObjectId, usedIds } from './object-data';

function subtree(cell: Cell): Cell[] {
  const out = [cell];
  for (const child of cell.children ?? []) out.push(...subtree(child));
  return out;
}

/** Letters before the number of an ID (`TC` of `TC12`, `S` of `S12_EXTERNAL`), else the kind's prefix. */
function prefixOf(id: string, kind: KindId): string {
  const m = /^([A-Za-z]+)\d/.exec(id);
  return m ? m[1] : getKind(kind)!.idPrefix;
}

function nextFree(prefix: string, taken: Set<string>): string {
  for (let n = 1; ; n++) {
    const id = `${prefix}${n}`;
    if (!taken.has(id.toUpperCase())) return id;
  }
}

/**
 * Makes the railway IDs of `cells` (not yet in `model`; descendants included) unique in `model`.
 * @returns the renamed IDs per kind (old upper-case ID -> new ID)
 */
export function renumberInsertedObjects(model: GraphDataModel, cells: Cell[]): Map<KindId, Map<string, string>> {
  const objects = cells.flatMap(subtree).filter((c) => getCellKind(c) !== null && isElementValue(c.getValue()));
  const taken = new Map<KindId, Set<string>>();
  const takenFor = (kind: KindId): Set<string> => {
    let set = taken.get(kind);
    if (!set) {
      set = usedIds(model, kind);
      taken.set(kind, set);
    }
    return set;
  };
  const renamed = new Map<KindId, Map<string, string>>();
  const values = new Map<Cell, Element>();
  for (const cell of objects) {
    const kind = getCellKind(cell)!;
    const id = readObjectId(cell);
    const set = takenFor(kind);
    if (id && !set.has(id.toUpperCase())) {
      set.add(id.toUpperCase());
      continue;
    }
    const next = nextFree(prefixOf(id, kind), set);
    set.add(next.toUpperCase());
    if (id) {
      let map = renamed.get(kind);
      if (!map) renamed.set(kind, (map = new Map()));
      map.set(id.toUpperCase(), next);
    }
    const value = (cell.getValue() as Element).cloneNode(true) as Element;
    value.setAttribute(ID_ATTR, next);
    values.set(cell, value);
  }
  if (renamed.size > 0) {
    // references between the inserted objects follow
    for (const cell of objects) {
      const def = getKind(getCellKind(cell));
      if (!def) continue;
      for (const field of def.fields) {
        if ((field.type !== 'ref' && field.type !== 'refList') || !field.refKinds) continue;
        const current = values.get(cell) ?? (cell.getValue() as Element);
        const raw = current.getAttribute(field.attr) ?? '';
        if (!raw.trim()) continue;
        const map = (ref: string): string => {
          for (const kind of field.refKinds!) {
            const to = renamed.get(kind)?.get(ref.trim().toUpperCase());
            if (to) return to;
          }
          return ref.trim();
        };
        const next = field.type === 'ref' ? map(raw) : raw.split(',').map(map).filter(Boolean).join(', ');
        if (next === raw) continue;
        const value = values.get(cell) ?? ((cell.getValue() as Element).cloneNode(true) as Element);
        value.setAttribute(field.attr, next);
        values.set(cell, value);
      }
    }
  }
  for (const [cell, value] of values) cell.setValue(value);
  return renamed;
}
