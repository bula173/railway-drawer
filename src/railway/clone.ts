/**
 * @file clone.ts
 * @brief The one preparation of cloned / inserted cells before they are added to a model: copy /
 *        paste, Ctrl+D duplicate, palette and template inserts and the hover-arrow clone
 *        (src/ui/hover-arrows.ts still has its own copy with the same contract until it imports
 *        this one). Railway objects keep a railway ID that is free in the model (cut + paste keeps
 *        S1), colliding or missing ones get the next free ID of the same prefix (S1 -> S2, S3, ...)
 *        and references among the cloned objects follow (renumberInsertedObjects). Objects that
 *        got a new ID are new objects: they lose the route list and imported railML ids
 *        (CLONE_DROPPED_ATTRS), so an export never has two objects with one railML id. Other data
 *        (kind, direction, aspects, km, track) is kept.
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import type { KindId } from './catalogue';
import { renumberInsertedObjects } from './insert-ids';
import { getCellKind, isElementValue, readObjectId } from './object-data';

/** Data that belongs to the original object, never to a copy of it. */
export const CLONE_DROPPED_ATTRS = ['rdRoutes', 'rdRailmlId', 'rdRailmlIlId', 'rdRailmlNetElements'] as const;

function subtree(cell: Cell, out: Cell[] = []): Cell[] {
  out.push(cell);
  for (const child of cell.children ?? []) subtree(child, out);
  return out;
}

/**
 * Prepares `cells` (clones NOT in `model` yet; descendants included) for adding to `model`.
 * @returns the renamed IDs per kind (old upper-case ID -> new ID)
 */
export function prepareClonedCells(model: GraphDataModel, cells: Cell[]): Map<KindId, Map<string, string>> {
  const objects = cells.flatMap((c) => subtree(c)).filter((c) => getCellKind(c) !== null && isElementValue(c.getValue()));
  const before = new Map(objects.map((c) => [c, readObjectId(c)]));
  const renamed = renumberInsertedObjects(model, cells);
  for (const cell of objects) {
    const old = before.get(cell) ?? '';
    if (old && readObjectId(cell) === old) continue;
    const value = cell.getValue() as Element;
    if (!CLONE_DROPPED_ATTRS.some((attr) => value.hasAttribute(attr))) continue;
    const next = value.cloneNode(true) as Element;
    for (const attr of CLONE_DROPPED_ATTRS) next.removeAttribute(attr);
    cell.setValue(next);
  }
  return renamed;
}
