/**
 * @file state-apply.ts
 * @brief Applies runtime states (states.ts) to cells: the state attribute AND the style keys of
 *        its look, in ONE undoable model edit.
 *
 * The look goes into the cells' own styles (so draw.io, image exports and scenario snapshots show
 * it): `strokeColor` / `fillColor` / `dashed` / `dashPattern` / `opacity` of the object cell, of its
 * drawn parts (groups such as the ERTMS TC marker) or of a signal's lamps. Every key a state
 * changes is remembered with its drawn value in `rdBaseStyle` on the object (per part path,
 * `""` = the object cell, `"0.2"` = children[0].children[2]); a state without a look (free,
 * reset) puts exactly those values back and drops the attribute. Style keys keep their order and
 * the remembered draw.io style string (style-edit.ts), so a reset saves byte-identical styles.
 */
import type { Cell, Graph } from '@maxgraph/core';
import { applyStyleToCells, effectiveColor, resolvedStyle } from '../ui/style-edit';
import { splitRefList } from './catalogue';
import type { KindId } from './catalogue';
import { absoluteBounds, projectOnPolyline, trackPolyline } from './geometry';
import type { Pt } from './geometry';
import { allCells, getCellKind, isElementValue, readAttr, readObjectId, setRailwayData } from './object-data';
import { parsePointsList } from './routes';
import type { BaseStyles, DimensionScheme, SchemeId, StateDimension, TargetRole } from './states';
import {
  BASE_STYLE_ATTR,
  DIMENSION_ATTR,
  ROUTE_RESTORE_ATTR,
  STATE_DIMENSIONS,
  composeVisual,
  parseBaseStyles,
  schemeDimensions,
  schemeIdFor,
  serializeBaseStyles,
  stateOption,
  visualStyleKeys,
} from './states';

/** A change of an object's state values: a value sets it, null removes it (default), undefined keeps it. */
export interface StateChange {
  state?: string | null;
  aspect?: string | null;
  position?: string | null;
  /** Extra raw attributes written in the same edit ('' / null removes). */
  attrs?: Record<string, string | null>;
}

export interface StateItem {
  cell: Cell;
  change: StateChange;
  /** Dimensions whose value stays but is not drawn (reset keeps the points position data). */
  lookless?: StateDimension[];
}

/** The state scheme of a cell (by kind; signals by type), or null. */
export function cellSchemeId(cell: Cell | null | undefined): SchemeId | null {
  const kind = getCellKind(cell);
  return schemeIdFor(kind, kind === 'signal' ? readAttr(cell, 'rdSignalType') : '');
}

/** The dimensions a cell's scheme has (empty for cells without runtime states). */
export function cellDimensions(cell: Cell): DimensionScheme[] {
  const id = cellSchemeId(cell);
  return id ? schemeDimensions(id) : [];
}

/** The stored state values of a cell ('' = missing). */
export function readStates(cell: Cell): Record<StateDimension, string> {
  return {
    state: readAttr(cell, DIMENSION_ATTR.state).trim(),
    aspect: readAttr(cell, DIMENSION_ATTR.aspect).trim(),
    position: readAttr(cell, DIMENSION_ATTR.position).trim(),
  };
}

/** True when the cell carries any runtime state (attribute or remembered style). */
export function hasRuntimeState(cell: Cell): boolean {
  const id = cellSchemeId(cell);
  if (readAttr(cell, BASE_STYLE_ATTR)) return true;
  if (!id) return false;
  return schemeDimensions(id).some((d) => d.dimension !== 'position' && readAttr(cell, DIMENSION_ATTR[d.dimension]).trim() !== '');
}

// ---------------------------------------------------------------------------------------------
// Targets: the parts of an object that take the look
// ---------------------------------------------------------------------------------------------

interface Target {
  path: string;
  cell: Cell;
  role: TargetRole;
}

function isTextCell(graph: Graph, cell: Cell): boolean {
  const own = cell.getStyle() as unknown;
  if (typeof own === 'string' && /^text(;|$)/.test(own)) return true;
  const names = own && typeof own === 'object' ? ((own as { baseStyleNames?: unknown }).baseStyleNames as unknown[] | undefined) : undefined;
  if (Array.isArray(names) && names.includes('text')) return true;
  return resolvedStyle(graph, cell).shape === 'text';
}

function descendants(cell: Cell, prefix = ''): Array<{ path: string; cell: Cell }> {
  const out: Array<{ path: string; cell: Cell }> = [];
  (cell.children ?? []).forEach((child, i) => {
    const path = prefix ? `${prefix}.${i}` : String(i);
    out.push({ path, cell: child });
    out.push(...descendants(child, path));
  });
  return out;
}

/** How a single drawn part takes a line look: its stroke, else (solid parts) its fill. */
function lineRole(graph: Graph, cell: Cell): TargetRole | null {
  if (cell.isEdge()) return 'stroke';
  if (!cell.isVertex() || isTextCell(graph, cell)) return null;
  const resolved = resolvedStyle(graph, cell);
  if (effectiveColor(resolved, 'strokeColor') !== 'none') return 'stroke';
  if (effectiveColor(resolved, 'fillColor') !== 'none') return 'fill';
  return null;
}

/** Line objects (sections, tracks, points, routes, level crossings, equipment). */
function lineTargets(graph: Graph, cell: Cell): Target[] {
  if (!cell.children || cell.children.length === 0) {
    const role = lineRole(graph, cell);
    return role ? [{ path: '', cell, role }] : [];
  }
  const out: Target[] = [];
  for (const d of descendants(cell)) {
    const role = lineRole(graph, d.cell);
    if (role) out.push({ path: d.path, cell: d.cell, role });
  }
  return out;
}

/**
 * The lamps of a signal symbol: round-ish filled parts (the ERTMS signals are groups of 9x9 lamp
 * stencils on a mast drawn with lines). A signal without such parts gets its own fill tinted.
 */
export function signalLamps(graph: Graph, cell: Cell): Cell[] {
  return lampTargets(graph, cell).filter((t) => t.path !== '').map((t) => t.cell);
}

function lampTargets(graph: Graph, cell: Cell): Target[] {
  const lamps: Target[] = [];
  for (const d of descendants(cell)) {
    const c = d.cell;
    if (!c.isVertex() || (c.children?.length ?? 0) > 0 || isTextCell(graph, c)) continue;
    const geo = c.getGeometry();
    const w = Number(geo?.width) || 0;
    const h = Number(geo?.height) || 0;
    if (w <= 0 || h <= 0 || Math.abs(w - h) > 0.25 * Math.max(w, h)) continue;
    if (effectiveColor(resolvedStyle(graph, c), 'fillColor') === 'none') continue;
    lamps.push({ path: d.path, cell: c, role: 'lamp' });
  }
  return lamps.length > 0 ? lamps : [{ path: '', cell, role: 'lamp' }];
}

function targetsFor(graph: Graph, cell: Cell, scheme: SchemeId): Target[] {
  return scheme === 'signal' ? lampTargets(graph, cell) : lineTargets(graph, cell);
}

function cellAtPath(cell: Cell, path: string): Cell | null {
  if (path === '') return cell;
  let c: Cell | null = cell;
  for (const part of path.split('.')) {
    c = c?.children?.[Number(part)] ?? null;
    if (!c) return null;
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------------------------

/** Puts the look of `values` on the object's parts; returns the new remembered drawn values. */
function applyLook(graph: Graph, cell: Cell, scheme: SchemeId, values: Record<StateDimension, string>): BaseStyles {
  const base = parseBaseStyles(readAttr(cell, BASE_STYLE_ATTR));
  const visual = composeVisual(scheme, values);
  const desired = new Map<string, { cell: Cell; keys: Record<string, unknown> }>();
  for (const t of targetsFor(graph, cell, scheme)) {
    const keys = visualStyleKeys(visual, t.role);
    if (Object.keys(keys).length > 0) desired.set(t.path, { cell: t.cell, keys });
  }
  const paths = new Set([...Object.keys(base), ...desired.keys()]);
  const next: BaseStyles = {};
  for (const path of paths) {
    const target = desired.get(path)?.cell ?? cellAtPath(cell, path);
    if (!target) continue; // the part is gone (ungrouped / deleted): nothing to restore
    const remembered = { ...(base[path] ?? {}) };
    const keys = desired.get(path)?.keys ?? {};
    applyStyleToCells(graph, [target], (style) => {
      // keys of the old look that the new one does not set: back to the drawn value
      for (const key of Object.keys(remembered)) {
        if (key in keys) continue;
        style[key] = remembered[key] === null ? undefined : remembered[key];
        delete remembered[key];
      }
      for (const [key, value] of Object.entries(keys)) {
        if (!(key in remembered)) remembered[key] = style[key] === undefined ? null : style[key];
        style[key] = value;
      }
    });
    if (Object.keys(remembered).length > 0) next[path] = remembered;
  }
  return next;
}

function normalizeValue(scheme: SchemeId, dimension: StateDimension, value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const v = value.trim();
  if (v === '') return null;
  return stateOption(scheme, dimension, v) ? v : undefined; // unknown values are ignored
}

/**
 * Sets state values on objects: the attributes, the look (style keys of the object, its parts or
 * a signal's lamps) and `rdBaseStyle`, all in ONE undoable edit. Cells without a state scheme
 * only get `attrs`. Returns the cells whose value or style changed.
 */
export function applyObjectStates(graph: Graph, items: StateItem[]): Cell[] {
  const model = graph.getDataModel();
  const changed = new Set<Cell>();
  if (items.length === 0) return [];
  model.beginUpdate();
  try {
    for (const { cell, change, lookless } of items) {
      if (!model.contains(cell)) continue;
      const scheme = cellSchemeId(cell);
      const attrs: Record<string, string | null> = { ...(change.attrs ?? {}) };
      if (scheme) {
        const values = readStates(cell);
        for (const d of STATE_DIMENSIONS) {
          if (!schemeDimensions(scheme).some((x) => x.dimension === d)) continue;
          const v = normalizeValue(scheme, d, change[d]);
          if (v === undefined) continue;
          values[d] = v ?? '';
          attrs[DIMENSION_ATTR[d]] = v;
        }
        const styleBefore = new Map(descendants(cell).map((x) => [x.cell, x.cell.getStyle()]));
        styleBefore.set(cell, cell.getStyle());
        const drawn = { ...values };
        for (const d of lookless ?? []) drawn[d] = '';
        const base = applyLook(graph, cell, scheme, drawn);
        attrs[BASE_STYLE_ATTR] = serializeBaseStyles(base) || null;
        for (const [c, s] of styleBefore) if (c.getStyle() !== s) changed.add(c);
      }
      if (Object.keys(attrs).length > 0 && isElementValue(cell.getValue())) {
        for (const c of setRailwayData(model, [cell], { attrs })) changed.add(c);
      }
    }
  } finally {
    model.endUpdate();
  }
  return [...changed];
}

/** Sets one dimension on every cell whose scheme has that value (multi-selection). */
export function setStateOnCells(graph: Graph, cells: Cell[], dimension: StateDimension, value: string): Cell[] {
  const items = applicableCells(cells, dimension, value).map((cell) => ({ cell, change: { [dimension]: value } as StateChange }));
  return applyObjectStates(graph, items);
}

/** The cells whose scheme allows `value` on `dimension`. */
export function applicableCells(cells: Cell[], dimension: StateDimension, value?: string): Cell[] {
  return cells.filter((cell) => {
    const id = cellSchemeId(cell);
    if (!id) return false;
    return value === undefined ? schemeDimensions(id).some((d) => d.dimension === dimension) : !!stateOption(id, dimension, value);
  });
}

/**
 * Back to the drawn look: state and aspect removed, the remembered style put back. The points
 * position stays (it is also the points' data, e.g. `rdPosition="normal"` in the templates); only
 * its look goes.
 */
export function resetObjectStates(graph: Graph, cells: Cell[]): Cell[] {
  const items: StateItem[] = cells
    .filter((cell) => hasRuntimeState(cell) || !!readAttr(cell, ROUTE_RESTORE_ATTR))
    .map((cell) => ({ cell, change: { state: null, aspect: null, attrs: { [ROUTE_RESTORE_ATTR]: null } }, lookless: ['position'] }));
  return applyObjectStates(graph, items);
}

/** Every object of the diagram with a runtime state, back to its drawn look. */
export function resetAllStates(graph: Graph): Cell[] {
  return resetObjectStates(graph, allCells(graph.getDataModel()));
}

// ---------------------------------------------------------------------------------------------
// Routes: set / release / occupy
// ---------------------------------------------------------------------------------------------

const SECTION_KINDS: KindId[] = ['trackSection', 'track'];

function cellsById(graph: Graph, kinds: KindId[]): Map<string, Cell[]> {
  const out = new Map<string, Cell[]>();
  for (const cell of allCells(graph.getDataModel())) {
    const kind = getCellKind(cell);
    if (!kind || !kinds.includes(kind)) continue;
    const id = readObjectId(cell).toUpperCase();
    if (!id) continue;
    out.set(id, [...(out.get(id) ?? []), cell]);
  }
  return out;
}

export interface RouteStateResult {
  /** Route IDs / object IDs that were not found in the drawing. */
  missing: string[];
  /** Cells whose value or style changed. */
  changed: Cell[];
}

export type RouteCommandId = 'set' | 'release' | 'occupy';

/**
 * Route commands on a route object (one undoable edit each):
 * - set: route edge "Set" (green), its sections reserved, overlap sections overlap, its points in
 *   the required positions (previous positions remembered on the route in `rdRouteRestore`),
 *   entry signal proceed;
 * - occupy: route edge "In use" (red), its sections occupied, entry signal back to stop;
 * - release: route edge, sections and overlap free, entry signal stop, points back to the
 *   remembered positions.
 */
export function runRouteCommand(graph: Graph, route: Cell, command: RouteCommandId): RouteStateResult {
  const sectionCells = cellsById(graph, SECTION_KINDS);
  const pointsCells = cellsById(graph, ['points']);
  const signalCells = cellsById(graph, ['signal']);
  const missing: string[] = [];
  const items: StateItem[] = [];
  const add = (map: Map<string, Cell[]>, id: string, change: StateChange): void => {
    const cells = map.get(id.trim().toUpperCase());
    if (!cells) {
      if (id.trim() && !missing.includes(id.trim())) missing.push(id.trim());
      return;
    }
    for (const cell of cells) items.push({ cell, change });
  };
  const sections = splitRefList(readAttr(route, 'rdSections'));
  const overlap = splitRefList(readAttr(route, 'rdOverlap')).filter((id) => !sections.some((s) => s.toUpperCase() === id.toUpperCase()));
  const points = parsePointsList(readAttr(route, 'rdPoints')).entries;
  const entry = readAttr(route, 'rdEntrySignal').trim();

  if (command === 'set') {
    const restore = readAttr(route, ROUTE_RESTORE_ATTR);
    const previous: Record<string, string> = {};
    for (const p of points) {
      const cell = pointsCells.get(p.id.toUpperCase())?.[0];
      if (cell) previous[p.id] = readAttr(cell, DIMENSION_ATTR.position).trim();
    }
    items.push({ cell: route, change: { state: 'reserved', attrs: restore ? {} : { [ROUTE_RESTORE_ATTR]: JSON.stringify(previous) } } });
    for (const id of sections) add(sectionCells, id, { state: 'reserved' });
    for (const id of overlap) add(sectionCells, id, { state: 'overlap' });
    for (const p of points) add(pointsCells, p.id, { position: p.position });
    if (entry) add(signalCells, entry, { aspect: 'proceed' });
  } else if (command === 'occupy') {
    items.push({ cell: route, change: { state: 'occupied' } });
    for (const id of sections) add(sectionCells, id, { state: 'occupied' });
    if (entry) add(signalCells, entry, { aspect: 'stop' });
  } else {
    let previous: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(readAttr(route, ROUTE_RESTORE_ATTR) || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) previous = parsed as Record<string, unknown>;
    } catch {
      previous = {};
    }
    items.push({ cell: route, change: { state: 'free', attrs: { [ROUTE_RESTORE_ATTR]: null } } });
    for (const id of [...sections, ...overlap]) add(sectionCells, id, { state: 'free' });
    for (const [id, pos] of Object.entries(previous)) add(pointsCells, id, { position: typeof pos === 'string' && pos ? pos : null });
    if (entry) add(signalCells, entry, { aspect: 'stop' });
  }
  return { missing, changed: applyObjectStates(graph, items) };
}

// ---------------------------------------------------------------------------------------------
// Train placement: the sections under a train
// ---------------------------------------------------------------------------------------------

/** Distance within which a section line counts as "under" the train's base line. */
export const TRAIN_SECTION_DISTANCE = 30;

/**
 * The track sections under a train (its base line sampled every 10 units, sections whose centre
 * line comes within TRAIN_SECTION_DISTANCE); tracks when no section lies there.
 */
export function sectionsUnderTrain(graph: Graph, train: Cell): Cell[] {
  const b = absoluteBounds(train);
  if (!b) return [];
  const samples: Pt[] = [];
  const steps = Math.max(1, Math.ceil(b.width / 10));
  for (let i = 0; i <= steps; i++) samples.push({ x: b.x + (b.width * i) / steps, y: b.y + b.height });
  const near = (kind: KindId): Cell[] =>
    allCells(graph.getDataModel()).filter((cell) => {
      if (getCellKind(cell) !== kind) return false;
      const line = trackPolyline(cell);
      if (!line || line.length < 2) return false;
      const length = line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - line[i].x, p.y - line[i].y), 0);
      if (length < 15) return false; // a TC marker, not a section line
      return samples.some((p) => projectOnPolyline(p, line).distance <= TRAIN_SECTION_DISTANCE);
    });
  const sections = near('trackSection');
  return sections.length > 0 ? sections : near('track');
}

/** Occupies (or frees) the sections under the given trains. */
export function occupyUnderTrains(graph: Graph, trains: Cell[], occupied: boolean): Cell[] {
  const cells = new Set<Cell>();
  for (const t of trains) for (const s of sectionsUnderTrain(graph, t)) cells.add(s);
  return applyObjectStates(
    graph,
    [...cells].map((cell) => ({ cell, change: { state: occupied ? 'occupied' : 'free' } }))
  );
}
