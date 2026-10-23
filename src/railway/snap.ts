/**
 * @file snap.ts
 * @brief Snap to track: signals, balises, axle counters and LEUs that are placed or moved close to
 *        a track are put onto its centre line and get their track reference (`rdTrackId`) and,
 *        when the track has km start/end, their km.
 *
 * Balises and axle counters sit centred on the line. Signals sit beside it on the right-hand side
 * of their direction of travel (nominal = increasing x, see topology.ts: below a left-to-right
 * track; reverse: above), LEUs on the nominal side; the gap between the line and the shape is
 * SNAP_GAP. The snap is part of the move/insert edit (model BEFORE_UNDO, like maxGraph's layout
 * manager), so one Ctrl+Z undoes both. View > Snap to Track switches it (localStorage
 * `rd.railway.snapToTrack`, default on).
 *
 * Predictable (draw.io feel): an object snaps only when its shape comes within SNAP_RADIUS_PX
 * screen pixels of the line (gap between the shape's side facing the line and the line, so the
 * radius does not depend on the symbol size or the zoom), and only perpendicular to the track: an
 * object beyond the end of a track (by more than half its size) is never pulled sideways along it. Alt held while dragging (or
 * at the drop) disables it, like draw.io's Alt disables grid and guides. Arrow-key nudges never
 * move an object back onto the line (they only refresh km/track of an object already on it).
 */
import { onModelChange, onModelEvent } from '../core/graph-events';
import { CellHighlight, ChildChange, GeometryChange, InternalEvent, RootChange } from '@maxgraph/core';
import type { Cell, EventObject, EventSource, Graph, GraphDataModel, InternalMouseEvent, SelectionHandler } from '@maxgraph/core';
import type { KindId } from './catalogue';
import { formatStoredNumber } from './catalogue';
import type { Box, Pt } from './geometry';
import { absoluteBounds } from './geometry';
import { kmAtPoint, kmScaleOf } from './km';
import { setRailwayData } from './object-data';
import { isNominalDirection, linkLine, projectPoint } from './topology';
import type { RailObject } from './validation';
import { collectObjects } from './validation';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export const SNAP_KINDS: ReadonlySet<KindId> = new Set<KindId>(['signal', 'balise', 'axleCounter', 'leu']);
/**
 * Max distance from an object's centre to a track line for it to belong to the track (Railway
 * Script km sync and the like). Snapping itself uses SNAP_RADIUS_PX.
 */
export const SNAP_DISTANCE = 40;
/** Max gap (screen pixels) between a symbol and a track line for the symbol to snap onto it. */
export const SNAP_RADIUS_PX = 15;
/** Gap between the track line and a signal/LEU beside it. */
export const SNAP_GAP = 4;
export const SNAP_KEY = STORAGE_KEYS.railwaySnapToTrack;

/** Max gap in graph units at `scale` (SNAP_RADIUS_PX screen pixels). */
export function snapGapAtScale(scale: number): number {
  return SNAP_RADIUS_PX / (scale > 0 ? scale : 1);
}

export interface SnapTarget {
  o: RailObject;
  line: Pt[];
}

export interface SnapResult {
  /** New absolute top-left of the object. */
  x: number;
  y: number;
  target: RailObject;
  /** Nearest point on the line. */
  point: Pt;
}

/** Track lines objects can snap to: tracks and track sections (not points legs, not routes). */
export function snapTargets(objects: RailObject[]): SnapTarget[] {
  const out: SnapTarget[] = [];
  for (const o of objects) {
    if (o.kind.id !== 'track' && o.kind.id !== 'trackSection') continue;
    const line = linkLine(o);
    if (line) out.push({ o, line });
  }
  return out;
}

/** Side offset of an object's centre from the line (unit normal * distance), or 0 when centred. */
export function snapOffset(kind: KindId, direction: string, box: Box, dir: Pt): Pt {
  if (kind !== 'signal' && kind !== 'leu') return { x: 0, y: 0 };
  // Travel direction of the object: nominal = the line direction made nominal
  const nominal = isNominalDirection(dir) ? dir : { x: -dir.x, y: -dir.y };
  const travel = kind === 'signal' && direction === 'reverse' ? { x: -nominal.x, y: -nominal.y } : nominal;
  // Right-hand side of the travel direction in screen coordinates (y down)
  const n = { x: -travel.y, y: travel.x };
  const half = Math.abs(n.x) * (box.width / 2) + Math.abs(n.y) * (box.height / 2);
  const d = half + SNAP_GAP;
  return { x: n.x * d, y: n.y * d };
}

/** Unit normal of `dir` pointing from `point` towards `c` (any normal when `c` is on the line). */
function normalTowards(dir: Pt, point: Pt, c: Pt): Pt {
  const n = { x: -dir.y, y: dir.x };
  return (c.x - point.x) * n.x + (c.y - point.y) * n.y < 0 ? { x: -n.x, y: -n.y } : n;
}

/**
 * Where an object snaps (null: no track close enough). `maxGap` (graph units) is the largest gap
 * between the object's shape and the line (centre distance minus the shape's half extent across
 * the line) that still snaps. Objects whose nearest line point is an end of the track and that lie
 * beyond it are not snapped (the snap only moves perpendicular to the track). Ties within 2 units
 * prefer a track over a track section drawn on top of it.
 */
export function computeSnap(box: Box, kind: KindId, direction: string, targets: SnapTarget[], maxGap = SNAP_RADIUS_PX): SnapResult | null {
  if (!SNAP_KINDS.has(kind)) return null;
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  let best: { t: SnapTarget; pr: ReturnType<typeof projectPoint>; gap: number } | null = null;
  for (const t of targets) {
    const pr = projectPoint(c, t.line);
    if (!Number.isFinite(pr.distance)) continue;
    // beyond an end of the track (the centre farther past the end than half the shape): no
    // sideways pull along the line
    const along = (c.x - pr.point.x) * pr.dir.x + (c.y - pr.point.y) * pr.dir.y;
    const first = t.line[0];
    const last = t.line[t.line.length - 1];
    const atEnd = (pr.point.x === first.x && pr.point.y === first.y) || (pr.point.x === last.x && pr.point.y === last.y);
    const halfAlong = Math.abs(pr.dir.x) * (box.width / 2) + Math.abs(pr.dir.y) * (box.height / 2);
    if (atEnd && Math.abs(along) > Math.max(1, halfAlong)) continue;
    const n = normalTowards(pr.dir, pr.point, c);
    const half = Math.abs(n.x) * (box.width / 2) + Math.abs(n.y) * (box.height / 2);
    const gap = Math.max(0, pr.distance - half);
    if (gap > maxGap) continue;
    if (!best || pr.distance < best.pr.distance - 2 || (Math.abs(pr.distance - best.pr.distance) <= 2 && t.o.kind.id === 'track' && best.t.o.kind.id !== 'track')) {
      best = { t, pr, gap };
    }
  }
  if (!best) return null;
  const off = snapOffset(kind, direction, box, best.pr.dir);
  const cx = best.pr.point.x + off.x;
  const cy = best.pr.point.y + off.y;
  const r = (n: number): number => Math.round(n * 100) / 100;
  return { x: r(cx - box.width / 2), y: r(cy - box.height / 2), target: best.t.o, point: { x: r(best.pr.point.x), y: r(best.pr.point.y) } };
}

/**
 * Snap of `box` as shown during a drag (the same rule as the drop), or null. Used by the track
 * highlight while dragging (snap-feedback.ts).
 */
export interface SnapContext {
  byCell: Map<Cell, RailObject>;
  targets: SnapTarget[];
}

/** The railway objects and snap targets of `model` (collected once per drag by the feedback). */
export function snapContext(model: GraphDataModel): SnapContext {
  const objects = collectObjects(model);
  return { byCell: new Map(objects.map((o) => [o.cell, o])), targets: snapTargets(objects) };
}

export function previewSnap(model: GraphDataModel, moved: Array<{ cell: Cell; box: Box }>, maxGap: number,
  context: SnapContext = snapContext(model)): SnapResult | null {
  const { byCell } = context;
  const targets = context.targets.filter((t) => !moved.some((m) => m.cell === t.o.cell));
  if (targets.length === 0) return null;
  for (const { cell, box } of moved) {
    const o = byCell.get(cell);
    if (!o || !SNAP_KINDS.has(o.kind.id) || !cell.isVertex()) continue;
    const snap = computeSnap(box, o.kind.id, o.values.direction ?? '', targets, maxGap);
    if (snap) return snap;
  }
  return null;
}

export function readSnapEnabled(): boolean {
  try {
    return readItem(SNAP_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeSnapEnabled(on: boolean): void {
  try {
    writeItem(SNAP_KEY, on ? '1' : '0');
  } catch {
    // session only
  }
}

/**
 * Snaps the given cells (those of a snap kind) inside the current model update.
 * @returns the cells that moved or got a new track/km
 */
export interface SnapOptions {
  /** Max gap in graph units (default SNAP_RADIUS_PX: scale 1). */
  maxGap?: number;
  /** Only refresh track/km of objects already on a line; never move anything (arrow-key nudges). */
  dataOnly?: boolean;
  /**
   * Tracks that are not snap targets: those moved/added in the same edit as the objects (a
   * template, a whole selection dragged together keeps its layout instead of pulling its signals
   * onto their tracks).
   */
  excludeTargets?: ReadonlySet<Cell>;
}

export function snapCells(model: GraphDataModel, cells: Cell[], options: SnapOptions = {}): Cell[] {
  const objects = collectObjects(model);
  const byCell = new Map(objects.map((o) => [o.cell, o]));
  const excluded = options.excludeTargets;
  const targets = excluded ? snapTargets(objects).filter((t) => !excluded.has(t.o.cell)) : snapTargets(objects);
  if (targets.length === 0) return [];
  const changed: Cell[] = [];
  model.beginUpdate();
  try {
    for (const cell of cells) {
      const o = byCell.get(cell);
      if (!o || !SNAP_KINDS.has(o.kind.id) || !cell.isVertex()) continue;
      const box = absoluteBounds(cell);
      const geo = cell.getGeometry();
      if (!box || !geo) continue;
      const snap = computeSnap(box, o.kind.id, o.values.direction ?? '', targets, options.maxGap ?? SNAP_RADIUS_PX);
      if (!snap) continue;
      let did = false;
      const dx = snap.x - box.x;
      const dy = snap.y - box.y;
      const moves = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
      if (options.dataOnly && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) continue;
      if (moves && !options.dataOnly) {
        const next = geo.clone();
        next.x = (Number(geo.x) || 0) + dx;
        next.y = (Number(geo.y) || 0) + dy;
        model.setGeometry(cell, next);
        did = true;
      }
      const values: Record<string, string> = {};
      if ((o.values.trackId ?? '').trim() !== snap.target.id && snap.target.id) values.trackId = snap.target.id;
      const scale = kmScaleOf(snap.target);
      if (scale && o.kind.fields.some((f) => f.key === 'km')) {
        const km = kmAtPoint(scale, snap.point, 1);
        if (km !== null && formatStoredNumber(km) !== (o.values.km ?? '').trim()) values.km = formatStoredNumber(km);
      }
      if (Object.keys(values).length > 0) {
        setRailwayData(model, [cell], { values });
        did = true;
      }
      if (did) changed.push(cell);
    }
  } finally {
    model.endUpdate();
  }
  return changed;
}

/** Cells an edit added or moved (no root changes: loads, scenario snapshots). */
function editedCells(changes: unknown[]): Cell[] | null {
  const cells = new Set<Cell>();
  for (const change of changes) {
    if (change instanceof RootChange) return null;
    if (change instanceof GeometryChange && change.cell) cells.add(change.cell);
    else if (change instanceof ChildChange && change.child && change.parent && !change.previous) {
      cells.add(change.child);
    }
  }
  return [...cells];
}

let suspended = 0;
let dataOnly = 0;

/** Runs `fn` with snapping limited to track/km data (no geometry change): arrow-key nudges. */
export function withSnapDataOnly<T>(fn: () => T): T {
  dataOnly++;
  try {
    return fn();
  } finally {
    dataOnly--;
  }
}

/** Alt state of the last pointer/key event (draw.io: Alt while dragging disables snapping). */
let altDown = false;
let altTrackingInstalled = false;

function installAltTracking(): void {
  if (altTrackingInstalled || typeof window === 'undefined') return;
  altTrackingInstalled = true;
  const track = (e: MouseEvent | KeyboardEvent): void => {
    altDown = e.altKey;
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'keydown', 'keyup', 'drop', 'dragover']) {
    window.addEventListener(type, track as EventListener, true);
  }
  window.addEventListener('blur', () => {
    altDown = false;
  });
}

/** Test hook: sets the tracked Alt state. */
export function setSnapAltDownForTest(on: boolean): void {
  altDown = on;
}

/**
 * Runs `fn` without snapping (for edits that place objects exactly, such as the Railway Script's
 * generated drawing: its km come from the script, not from the position).
 */
export function withSnapSuspended<T>(fn: () => T): T {
  suspended++;
  try {
    return fn();
  } finally {
    suspended--;
  }
}

/** Snaps objects moved or inserted on `graph` while `enabled()`; returns the uninstaller. */
export function installSnapToTrack(graph: Graph, enabled: () => boolean): () => void {
  const model = graph.getDataModel();
  installAltTracking();
  let busy = false;
  const onBeforeUndo = (_sender: EventSource, evt: EventObject): void => {
    if (busy || suspended > 0 || !enabled() || altDown) return;
    const edit = evt.getProperty('edit') as { changes?: unknown[] } | undefined;
    const cells = editedCells(edit?.changes ?? []);
    if (!cells || cells.length === 0) return;
    busy = true;
    try {
      snapCells(model, cells, { maxGap: snapGapAtScale(graph.view?.scale ?? 1), dataOnly: dataOnly > 0, excludeTargets: new Set(cells) });
    } finally {
      busy = false;
    }
  };
  const offBeforeUndo = onModelEvent(graph, InternalEvent.BEFORE_UNDO, onBeforeUndo);
  const uninstallFeedback = installSnapFeedback(graph, enabled);
  return () => {
    offBeforeUndo();
    uninstallFeedback();
  };
}

/** Colour of the track highlight while a drag will snap (draw.io's connect/drop target blue). */
export const SNAP_HIGHLIGHT_COLOR = '#00a8ff';

/**
 * While cells are dragged (maxGraph SelectionHandler), the track they will snap onto at the drop
 * is outlined, so the snap is predictable. Nothing is shown with Alt held or snapping off.
 * `graph.container` carries `data-rd-track-snap="<track id or cell id>"` while shown.
 */
function installSnapFeedback(graph: Graph, enabled: () => boolean): () => void {
  let highlight: CellHighlight | null = null;
  let shownFor: Cell | null = null;
  let context: SnapContext | null = null;
  const hide = (): void => {
    if (highlight) highlight.hide();
    shownFor = null;
    graph.container?.removeAttribute('data-rd-track-snap');
  };
  const show = (track: Cell, id: string): void => {
    const state = graph.view.getState(track);
    if (!state) return hide();
    highlight ??= new CellHighlight(graph, SNAP_HIGHLIGHT_COLOR, 4);
    if (shownFor !== track) highlight.highlight(state);
    shownFor = track;
    if (highlight.shape?.node) highlight.shape.node.classList.add('rd-track-snap-highlight');
    graph.container?.setAttribute('data-rd-track-snap', id);
  };
  const update = (me: InternalMouseEvent): void => {
    const handler = graph.getPlugin('SelectionHandler') as (SelectionHandler & { cells: Cell[] | null; first: unknown }) | undefined;
    const evt = me.getEvent() as MouseEvent | undefined;
    if (!handler || !handler.cells || !handler.first || !graph.isMouseDown || suspended > 0 || !enabled() || evt?.altKey ||
      (handler.currentDx === 0 && handler.currentDy === 0)) {
      hide();
      return;
    }
    const scale = graph.view.scale || 1;
    const moved: Array<{ cell: Cell; box: Box }> = [];
    for (const cell of handler.cells) {
      const b = absoluteBounds(cell);
      if (b && cell.isVertex()) {
        moved.push({ cell, box: { x: b.x + handler.currentDx / scale, y: b.y + handler.currentDy / scale, width: b.width, height: b.height } });
      }
    }
    // the objects and targets are collected once per drag (the model does not change while the
    // selection is dragged; a model change drops them), not on every mouse move
    if (moved.length > 0) context ??= snapContext(graph.getDataModel());
    const snap = moved.length > 0 && context ? previewSnap(graph.getDataModel(), moved, snapGapAtScale(scale), context) : null;
    if (snap) show(snap.target.cell, snap.target.id || String(snap.target.cell.id));
    else hide();
  };
  const listener = {
    mouseDown: (): void => { context = null; hide(); },
    mouseMove: (_sender: EventSource, me: InternalMouseEvent): void => update(me),
    mouseUp: (): void => { context = null; hide(); },
  };
  graph.addMouseListener(listener);
  const offModel = onModelChange(graph, (): void => { context = null; });
  return () => {
    graph.removeMouseListener(listener);
    offModel();
    hide();
    highlight?.destroy();
    highlight = null;
  };
}
