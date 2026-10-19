/**
 * @file apply.ts
 * @brief Puts a generated drawing (build.ts scratch model) into a tab's live model as ONE undoable
 *        edit, touching only generated cells: cells whose `rdScript` names an object that is gone
 *        are removed, new objects are added (in the generated order among the existing ones),
 *        objects drawn with another symbol (`rdScriptShape`) are replaced, the rest get the new
 *        geometry and data (user attributes, label and style of a generated cell are kept). A
 *        railway object without `rdScript` whose kind and ID match a script object (inserted from
 *        the palette, or drawn before "Generate from drawing") is adopted: replaced by the
 *        generated cell. Applying the same script twice changes nothing (no undo entry).
 */
import type { Cell, Geometry, Graph, GraphDataModel, Point } from '@maxgraph/core';
import { ALL_DATA_ATTRS } from '../railway/catalogue';
import { allCells, getCellKind, isElementValue, readObjectId } from '../railway/object-data';
import { ROUTES_LAYER_ID, ensureRoutesLayer } from '../railway/route-store';
import { withSnapSuspended } from '../railway/snap';
import { SCRIPT_ATTR, SCRIPT_SHAPE_ATTR } from './build';
import { EXTRA_ATTRS, matchKey } from './language';

export interface ApplyCounts {
  added: number;
  updated: number;
  replaced: number;
  removed: number;
}

/** Attributes a generated cell's data owns (replaced on apply); others (the user's) are kept. */
const OWNED_ATTRS: ReadonlySet<string> = new Set([
  ...ALL_DATA_ATTRS,
  SCRIPT_ATTR,
  SCRIPT_SHAPE_ATTR,
  ...Object.values(EXTRA_ATTRS).flatMap((m) => Object.values(m ?? {})),
]);

export function scriptKeyOf(cell: Cell): string {
  const v = cell.getValue();
  return isElementValue(v) ? v.getAttribute(SCRIPT_ATTR) ?? '' : '';
}

function isLayer(model: GraphDataModel, cell: Cell | null): boolean {
  return !!cell && cell.getParent() === model.getRoot();
}

/** Generated cells of a model by `rdScript` key (top cells only; duplicates in `extra`). */
export function generatedCells(model: GraphDataModel): { byKey: Map<string, Cell>; extra: Cell[] } {
  const byKey = new Map<string, Cell>();
  const extra: Cell[] = [];
  for (const cell of allCells(model)) {
    const key = scriptKeyOf(cell);
    if (!key) continue;
    if (byKey.has(key)) extra.push(cell);
    else byKey.set(key, cell);
  }
  return { byKey, extra };
}

/** Unmarked railway objects on a layer, by match key (`kind:ID`), for adoption. */
export function adoptableCells(model: GraphDataModel): Map<string, Cell> {
  const out = new Map<string, Cell>();
  for (const cell of allCells(model)) {
    if (scriptKeyOf(cell) || !isLayer(model, cell.getParent())) continue;
    const kind = getCellKind(cell);
    const id = kind ? readObjectId(cell) : '';
    if (kind && id && !out.has(matchKey(kind, id))) out.set(matchKey(kind, id), cell);
  }
  return out;
}

function cloneDeep(cell: Cell): Cell {
  const c = cell.clone();
  const id = cell.getId();
  if (id !== null) c.setId(id);
  const v = cell.getValue();
  c.setValue(isElementValue(v) ? v.cloneNode(true) : v);
  c.setGeometry(cell.getGeometry()?.clone() ?? null);
  for (const child of cell.children ?? []) {
    const cc = cloneDeep(child);
    c.insert(cc);
  }
  return c;
}

const near = (a: number | undefined | null, b: number | undefined | null): boolean => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.01;

function samePoint(a: Point | null | undefined, b: Point | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return near(a.x, b.x) && near(a.y, b.y);
}

function sameGeometry(a: Geometry | null, b: Geometry | null): boolean {
  if (!a || !b) return !a && !b;
  if (!near(a.x, b.x) || !near(a.y, b.y) || !near(a.width, b.width) || !near(a.height, b.height)) return false;
  if (!!a.relative !== !!b.relative) return false;
  if (!samePoint(a.sourcePoint, b.sourcePoint) || !samePoint(a.targetPoint, b.targetPoint)) return false;
  const pa = a.points ?? [];
  const pb = b.points ?? [];
  return pa.length === pb.length && pa.every((p, i) => samePoint(p, pb[i]));
}

/** The desired value merged with the user's own attributes (and the current label) of `current`. */
function mergedValue(current: unknown, desired: Element): Element | null {
  const next = desired.cloneNode(true) as Element;
  if (isElementValue(current)) {
    for (const attr of Array.from(current.attributes)) {
      if (attr.name === 'label' || attr.name === 'placeholders' || !OWNED_ATTRS.has(attr.name)) next.setAttribute(attr.name, attr.value);
    }
    for (const name of ['label', 'placeholders']) if (!current.hasAttribute(name)) next.removeAttribute(name);
    if (next.attributes.length === current.attributes.length && Array.from(next.attributes).every((a) => current.getAttribute(a.name) === a.value)) return null;
  }
  return next;
}

/**
 * Applies the generated drawing `scratch` to `graph`'s model (one undoable edit; no edit when
 * nothing changes). New non-route cells go to the layer of the existing generated cells, else the
 * graph's current layer; routes to the Routes layer.
 */
export function applyGenerated(graph: Graph, scratch: GraphDataModel): ApplyCounts {
  const model = graph.getDataModel();
  const counts: ApplyCounts = { added: 0, updated: 0, replaced: 0, removed: 0 };
  const desired: Array<{ key: string; cell: Cell; route: boolean }> = [];
  for (const layer of scratch.getRoot()?.children ?? []) {
    for (const cell of layer.children ?? []) {
      const key = scriptKeyOf(cell);
      if (key) desired.push({ key, cell, route: layer.getId() === ROUTES_LAYER_ID });
    }
  }
  const wanted = new Set(desired.map((d) => d.key));
  const { byKey, extra } = generatedCells(model);
  const adoptable = adoptableCells(model);
  withSnapSuspended(() => {
    model.beginUpdate();
    try {
      for (const cell of extra) {
        model.remove(cell);
        counts.removed++;
      }
      for (const [key, cell] of byKey) {
        if (!wanted.has(key)) {
          model.remove(cell);
          byKey.delete(key);
          counts.removed++;
        }
      }
      const existingLayer = [...byKey.values()].map((c) => c.getParent()).find((p) => isLayer(model, p) && p?.getId() !== ROUTES_LAYER_ID) ?? null;
      const drawingLayer = (): Cell => existingLayer ?? graph.getDefaultParent() ?? model.getRoot()!.getChildAt(0);
      desired.forEach((d, i) => {
        const marked = byKey.get(d.key) ?? null;
        const [kind, ...idParts] = d.key.split(':');
        const current = marked ?? adoptable.get(matchKey(kind, idParts.join(':'))) ?? null;
        const desiredValue = d.cell.getValue() as Element;
        if (current && marked && readShape(current) === desiredValue.getAttribute(SCRIPT_SHAPE_ATTR)) {
          let changed = false;
          const geo = d.cell.getGeometry();
          if (!sameGeometry(current.getGeometry(), geo)) {
            model.setGeometry(current, geo!.clone());
            changed = true;
          }
          const value = mergedValue(current.getValue(), desiredValue);
          if (value) {
            model.setValue(current, value);
            changed = true;
          }
          if (changed) counts.updated++;
          byKey.set(d.key, current);
          return;
        }
        const clone = cloneDeep(d.cell);
        if (current) {
          // another symbol (or an adopted cell): replace in place, keeping user attributes
          const value = mergedValue(current.getValue(), desiredValue);
          if (value) clone.setValue(value);
          const parent = current.getParent()!;
          const index = parent.getIndex(current);
          model.remove(current);
          model.add(parent, clone, Math.min(index, parent.getChildCount()));
          counts.replaced++;
        } else {
          const parent = d.route ? ensureRoutesLayer(model) : drawingLayer();
          // keep the generated order: before the next generated cell already in this parent
          let index = parent.getChildCount();
          for (const next of desired.slice(i + 1)) {
            const c = byKey.get(next.key);
            if (c && c.getParent() === parent) {
              index = parent.getIndex(c);
              break;
            }
          }
          model.add(parent, clone, index);
          counts.added++;
        }
        byKey.set(d.key, clone);
      });
    } finally {
      model.endUpdate();
    }
  });
  return counts;
}

function readShape(cell: Cell): string {
  const v = cell.getValue();
  return isElementValue(v) ? v.getAttribute(SCRIPT_SHAPE_ATTR) ?? '' : '';
}

/** Removes every generated cell (one undoable edit). */
export function removeGenerated(model: GraphDataModel): number {
  const { byKey, extra } = generatedCells(model);
  const cells = [...byKey.values(), ...extra];
  if (cells.length === 0) return 0;
  model.beginUpdate();
  try {
    for (const c of cells) model.remove(c);
  } finally {
    model.endUpdate();
  }
  return cells.length;
}
