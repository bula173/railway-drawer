/**
 * @file rename-id.ts
 * @brief Renames a railway object's ID (`rdId`) in one undoable edit: the ID must be unique per kind (case
 *        insensitive, like the duplicate-id check) and contain no spaces or commas (refLists are comma
 *        separated); every reference to the old ID follows (ref / refList fields whose kinds include the object's,
 *        e.g. a route's entry/exit signal and sections, a balise's group, a signal's routes; a route's required
 *        points text "W1:normal"). A literal label equal to the old ID becomes the new one; `%rdId%` labels
 *        follow by themselves. Used by the in-place ID editor (double-click on a railway object, text-editor.ts).
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import { ID_ATTR, getKind } from './catalogue';
import type { KindId } from './catalogue';
import { allCells, buildDataValue, getCellKind, isElementValue, labelShowsId, readObjectId, usedIds, valueLabel } from './object-data';

export type RenameResult = { ok: true; cells: Cell[]; references: number } | { ok: false; error: string };

/** The railway object a double-click on `cell` means: the cell or its nearest ancestor with a kind. */
export function railwayObjectOf(cell: Cell | null | undefined): Cell | null {
  for (let c: Cell | null | undefined = cell; c; c = c.parent) {
    if (getCellKind(c) && isElementValue(c.getValue())) return c;
  }
  return null;
}

/** Why `next` cannot be the ID of `cell` (null: it can). */
export function idProblem(model: GraphDataModel, cell: Cell, next: string): string | null {
  const kind = getCellKind(cell);
  if (!kind) return 'Not a railway object';
  const id = next.trim();
  if (!id) return 'An ID is required';
  if (/[\s,]/.test(id)) return 'An ID has no spaces or commas';
  const current = readObjectId(cell).toUpperCase();
  if (id.toUpperCase() !== current && usedIds(model, kind).has(id.toUpperCase())) {
    return `${id} is already used by another ${getKind(kind)!.label.toLowerCase()}`;
  }
  return null;
}

function replaceRef(raw: string, from: string, to: string, list: boolean): string {
  if (!list) return raw.trim().toUpperCase() === from ? to : raw;
  return raw
    .split(',')
    .map((part) => (part.trim().toUpperCase() === from ? to : part.trim()))
    .filter(Boolean)
    .join(', ');
}

/** "W1:normal, W2:reverse" with W1 renamed (routes.ts parsePointsList syntax: id, then : / = / space). */
function replacePointsText(raw: string, from: string, to: string): string {
  return raw
    .split(',')
    .map((part) => {
      const m = /^(\s*)([^\s:=]+)(.*)$/.exec(part);
      return m && m[2].toUpperCase() === from ? `${m[1]}${to}${m[3]}` : part;
    })
    .join(',');
}

/** Renames `cell`'s railway ID to `next` (trimmed) and the references to it; one undoable model edit. */
export function renameObjectId(model: GraphDataModel, cell: Cell, next: string): RenameResult {
  const problem = idProblem(model, cell, next);
  if (problem) return { ok: false, error: problem };
  const kind = getCellKind(cell) as KindId;
  const to = next.trim();
  const old = readObjectId(cell);
  if (to === old) return { ok: true, cells: [], references: 0 };
  const from = old.toUpperCase();

  const values = new Map<Cell, unknown>();
  const label = valueLabel(cell.getValue());
  const attrs: Record<string, string | null> = { [ID_ATTR]: to };
  if (old && !labelShowsId(cell) && label.trim() === old) attrs.label = to;
  values.set(cell, buildDataValue(cell.getValue(), { attrs }));

  let references = 0;
  if (old) {
    for (const other of allCells(model)) {
      const def = getKind(getCellKind(other));
      if (!def) continue;
      let current = values.get(other) ?? other.getValue();
      if (!isElementValue(current)) continue;
      const changed: Record<string, string | null> = {};
      for (const field of def.fields) {
        const raw = (current as Element).getAttribute(field.attr) ?? '';
        if (!raw.trim()) continue;
        let updated = raw;
        if ((field.type === 'ref' || field.type === 'refList') && field.refKinds?.includes(kind)) {
          updated = replaceRef(raw, from, to, field.type === 'refList');
        } else if (def.id === 'route' && field.key === 'points' && kind === 'points') {
          updated = replacePointsText(raw, from, to);
        }
        if (updated !== raw) changed[field.attr] = updated;
      }
      if (Object.keys(changed).length > 0) {
        references += Object.keys(changed).length;
        current = buildDataValue(current, { attrs: changed });
        values.set(other, current);
      }
    }
  }

  model.beginUpdate();
  try {
    for (const [c, value] of values) model.setValue(c, value);
  } finally {
    model.endUpdate();
  }
  return { ok: true, cells: [...values.keys()], references };
}
