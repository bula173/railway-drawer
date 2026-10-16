/**
 * @file object-data.ts
 * @brief Reads and writes railway object data on cells, stored the draw.io way.
 *
 * A railway object's value is a draw.io `<object label="..." rdKind="signal" rdId="S12" .../>`
 * element (an existing `<UserObject>` keeps its name), so files stay 1:1 compatible with draw.io:
 * the attributes appear in draw.io's Edit Data dialog and survive its saves. Cells without data
 * keep their plain string values; removing the kind turns a value that has nothing but a label
 * back into a plain string.
 *
 * Every write goes through the model inside one update (one undoable edit), and values are never
 * changed in place: the old element stays intact for undo.
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import type { FieldDef, KindDef, KindId, KindPreset } from './catalogue';
import { ALL_DATA_ATTRS, ID_ATTR, KIND_ATTR, getKind, isKindId } from './catalogue';

export function isElementValue(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

let xmlDoc: XMLDocument | null = null;

function createValueElement(): Element {
  // No namespace: draw.io writes `<object>` in lower case and reads it by node name
  xmlDoc ??= document.implementation.createDocument(null, null, null);
  return xmlDoc.createElement('object');
}

/** The raw `rdKind` attribute of a cell (also unknown kinds), or null. */
export function getRawKind(cell: Cell | null | undefined): string | null {
  const value = cell?.getValue();
  if (!isElementValue(value)) return null;
  const kind = value.getAttribute(KIND_ATTR);
  return kind ? kind : null;
}

/** The catalogue kind of a cell, or null (no data, or a kind this version does not know). */
export function getCellKind(cell: Cell | null | undefined): KindId | null {
  const kind = getRawKind(cell);
  return isKindId(kind) ? kind : null;
}

export function getKindDef(cell: Cell | null | undefined): KindDef | null {
  return getKind(getCellKind(cell));
}

/** A data attribute of a cell ('' when missing). */
export function readAttr(cell: Cell | null | undefined, attr: string): string {
  const value = cell?.getValue();
  return isElementValue(value) ? value.getAttribute(attr) ?? '' : '';
}

export function readField(cell: Cell, fieldDef: FieldDef): string {
  return readAttr(cell, fieldDef.attr);
}

/** The object ID (`rdId`), trimmed. */
export function readObjectId(cell: Cell): string {
  return readAttr(cell, ID_ATTR).trim();
}

/** All catalogue values of a cell, by field key (only non-empty ones). */
export function readObjectValues(cell: Cell): Record<string, string> {
  const def = getKindDef(cell);
  const out: Record<string, string> = {};
  if (!def) return out;
  for (const f of def.fields) {
    const v = readField(cell, f);
    if (v !== '') out[f.key] = v;
  }
  return out;
}

/** The label text of a value (plain string or the `label` attribute). */
export function valueLabel(value: unknown): string {
  if (isElementValue(value)) return value.getAttribute('label') ?? '';
  return value === null || value === undefined ? '' : String(value);
}

export interface DataChange {
  /** New kind; null removes all railway data; undefined keeps the kind. */
  kind?: KindId | null;
  /** Field values by key; '' removes the attribute. */
  values?: Record<string, string>;
  /** Raw attributes to set ('' or null removes). */
  attrs?: Record<string, string | null>;
}

/**
 * The value a cell gets after `change` (a new object; `current` is not modified).
 * Returns `current` itself when nothing changes.
 */
export function buildDataValue(current: unknown, change: DataChange): unknown {
  const element = isElementValue(current) ? (current.cloneNode(true) as Element) : null;

  if (change.kind === null) {
    if (!element) return current;
    for (const attr of ALL_DATA_ATTRS) element.removeAttribute(attr);
    applyAttrs(element, change.attrs);
    if (sameAttributes(element, current as Element)) return current;
    // Only a label left: back to a plain string value, as before the data was added
    const names = Array.from(element.attributes).map((a) => a.name);
    if (names.every((n) => n === 'label')) return element.getAttribute('label') ?? '';
    return element;
  }

  const target = element ?? createValueElement();
  if (!element) target.setAttribute('label', valueLabel(current));

  const previousKind = getKind(target.getAttribute(KIND_ATTR));
  if (change.kind !== undefined) {
    const nextKind = getKind(change.kind);
    if (!nextKind) throw new Error(`Unknown railway object kind "${String(change.kind)}"`);
    target.setAttribute(KIND_ATTR, nextKind.id);
    // Drop fields the new kind does not have (keeps the ID and shared fields such as km)
    if (previousKind && previousKind.id !== nextKind.id) {
      const keep = new Set(nextKind.fields.map((f) => f.attr));
      for (const f of previousKind.fields) if (!keep.has(f.attr)) target.removeAttribute(f.attr);
    }
  }
  const kind = getKind(target.getAttribute(KIND_ATTR));
  if (change.values) {
    if (!kind) throw new Error('Set a kind before setting railway object values');
    for (const [key, raw] of Object.entries(change.values)) {
      const f = kind.fields.find((x) => x.key === key);
      if (!f) throw new Error(`${kind.label} has no field "${key}"`);
      if (raw === '' || raw === null || raw === undefined) target.removeAttribute(f.attr);
      else target.setAttribute(f.attr, raw);
    }
  }
  applyAttrs(target, change.attrs);
  if (element && sameAttributes(target, current as Element)) return current;
  return target;
}

function applyAttrs(element: Element, attrs: Record<string, string | null> | undefined): void {
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === '') element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}

function sameAttributes(a: Element, b: Element): boolean {
  if (a.attributes.length !== b.attributes.length) return false;
  for (const attr of Array.from(a.attributes)) {
    if (b.getAttribute(attr.name) !== attr.value) return false;
  }
  return true;
}

/** Every cell of the model below the root (layers included), depth first. */
export function allCells(model: GraphDataModel): Cell[] {
  const out: Cell[] = [];
  const root = model.getRoot();
  if (!root) return out;
  const visit = (cell: Cell): void => {
    for (const child of cell.children ?? []) {
      out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
}

/** Cells with railway data (a known kind). */
export function railwayCells(model: GraphDataModel): Cell[] {
  return allCells(model).filter((c) => getCellKind(c) !== null);
}

/** IDs in use by objects of `kind` (upper case). */
export function usedIds(model: GraphDataModel, kind: KindId): Set<string> {
  const ids = new Set<string>();
  for (const cell of allCells(model)) {
    if (getCellKind(cell) === kind) {
      const id = readObjectId(cell);
      if (id) ids.add(id.toUpperCase());
    }
  }
  return ids;
}

/** The first free generated ID of a kind (`S1`, `S2`, ...), not in `taken` (upper case). */
export function nextFreeId(kind: KindId, taken: Set<string>): string {
  const prefix = getKind(kind)!.idPrefix;
  for (let n = 1; ; n++) {
    const id = `${prefix}${n}`;
    if (!taken.has(id.toUpperCase())) return id;
  }
}

/**
 * Applies `change` to each cell through the model (one undoable edit). With `autoId`, cells that
 * end up with a kind but no ID get the next free generated one.
 * @returns the cells whose value changed
 */
export function setRailwayData(
  model: GraphDataModel,
  cells: Cell[],
  change: DataChange | ((cell: Cell) => DataChange),
  options: { autoId?: boolean } = {}
): Cell[] {
  const changed: Cell[] = [];
  if (cells.length === 0) return changed;
  const takenByKind = new Map<KindId, Set<string>>();
  const taken = (kind: KindId): Set<string> => {
    let set = takenByKind.get(kind);
    if (!set) {
      set = usedIds(model, kind);
      takenByKind.set(kind, set);
    }
    return set;
  };
  model.beginUpdate();
  try {
    for (const cell of cells) {
      const c = typeof change === 'function' ? change(cell) : change;
      let next = buildDataValue(cell.getValue(), c);
      if (options.autoId && isElementValue(next)) {
        const kind = next.getAttribute(KIND_ATTR);
        if (isKindId(kind) && !(next.getAttribute(ID_ATTR) ?? '').trim()) {
          const id = nextFreeId(kind, taken(kind));
          taken(kind).add(id.toUpperCase());
          next = next === cell.getValue() ? (next.cloneNode(true) as Element) : next;
          (next as Element).setAttribute(ID_ATTR, id);
        }
      }
      if (next === cell.getValue()) continue;
      model.setValue(cell, next);
      changed.push(cell);
    }
  } finally {
    model.endUpdate();
  }
  return changed;
}

/**
 * Gives new cells (not yet in a model) a kind with its preset values and a free generated ID.
 * Used on insert, before the cells are added, so the insert stays one undoable edit.
 */
export function applyPresetToNewCells(model: GraphDataModel, cells: Cell[], preset: KindPreset): void {
  const taken = usedIds(model, preset.kind);
  for (const cell of cells) {
    let value = buildDataValue(cell.getValue(), { kind: preset.kind, values: preset.values ?? {} }) as Element;
    if (!(value.getAttribute(ID_ATTR) ?? '').trim()) {
      const id = nextFreeId(preset.kind, taken);
      taken.add(id.toUpperCase());
      if (value === cell.getValue()) value = value.cloneNode(true) as Element;
      value.setAttribute(ID_ATTR, id);
    }
    cell.setValue(value);
  }
}

// ---------------------------------------------------------------------------------------------
// Label with the ID (draw.io placeholders)
// ---------------------------------------------------------------------------------------------

export const ID_PLACEHOLDER = `%${ID_ATTR}%`;

/** True when the cell's label shows its ID through the `%rdId%` placeholder. */
export function labelShowsId(cell: Cell): boolean {
  const value = cell.getValue();
  return isElementValue(value) && value.getAttribute('placeholders') === '1' && (value.getAttribute('label') ?? '').includes(ID_PLACEHOLDER);
}

/**
 * The change that makes a label show (or stop showing) the ID: `%rdId%` with `placeholders="1"`
 * (draw.io semantics, so draw.io renders it too). An empty label becomes just the ID; an
 * existing label gets the ID appended. Labels with other placeholders keep `placeholders="1"`.
 */
export function labelIdChange(cell: Cell, show: boolean): DataChange {
  const value = cell.getValue();
  const label = valueLabel(value);
  if (show) {
    if (labelShowsId(cell)) return {};
    const next = label.includes(ID_PLACEHOLDER) ? label : label.trim() === '' ? ID_PLACEHOLDER : `${label} ${ID_PLACEHOLDER}`;
    return { attrs: { label: next, placeholders: '1' } };
  }
  if (!label.includes(ID_PLACEHOLDER)) return {};
  const next = label.split(ID_PLACEHOLDER).join('').replace(/\s{2,}/g, ' ').trim();
  const otherPlaceholders = /%[^%{}"'=;\s]+%/.test(next);
  return { attrs: { label: next, placeholders: otherPlaceholders ? '1' : null } };
}
