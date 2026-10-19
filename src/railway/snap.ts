/**
 * @file snap.ts
 * @brief Snap to track: signals, balises, axle counters and LEUs that are placed or moved near a
 *        track are put onto its centre line and get their track reference (`rdTrackId`) and,
 *        when the track has km start/end, their km.
 *
 * Balises and axle counters sit centred on the line. Signals sit beside it on the right-hand side
 * of their direction of travel (nominal = increasing x, see topology.ts: below a left-to-right
 * track; reverse: above), LEUs on the nominal side; the gap between the line and the shape is
 * SNAP_GAP. The snap is part of the move/insert edit (model BEFORE_UNDO, like maxGraph's layout
 * manager), so one Ctrl+Z undoes both. View > Snap to Track switches it (localStorage
 * `rd.railway.snapToTrack`, default on).
 */
import { ChildChange, GeometryChange, InternalEvent, RootChange } from '@maxgraph/core';
import type { Cell, EventObject, EventSource, Graph, GraphDataModel } from '@maxgraph/core';
import type { KindId } from './catalogue';
import { formatStoredNumber } from './catalogue';
import type { Box, Pt } from './geometry';
import { absoluteBounds } from './geometry';
import { kmAtPoint, kmScaleOf } from './km';
import { setRailwayData } from './object-data';
import { isNominalDirection, linkLine, projectPoint } from './topology';
import type { RailObject } from './validation';
import { collectObjects } from './validation';

export const SNAP_KINDS: ReadonlySet<KindId> = new Set<KindId>(['signal', 'balise', 'axleCounter', 'leu']);
/** Max distance from an object's centre to a track line for it to snap. */
export const SNAP_DISTANCE = 40;
/** Gap between the track line and a signal/LEU beside it. */
export const SNAP_GAP = 4;
export const SNAP_KEY = 'rd.railway.snapToTrack';

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

/**
 * Where an object snaps (null: no track within SNAP_DISTANCE). Ties within 2 units prefer a
 * track over a track section drawn on top of it.
 */
export function computeSnap(box: Box, kind: KindId, direction: string, targets: SnapTarget[], maxDistance = SNAP_DISTANCE): SnapResult | null {
  if (!SNAP_KINDS.has(kind)) return null;
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  let best: { t: SnapTarget; pr: ReturnType<typeof projectPoint> } | null = null;
  for (const t of targets) {
    const pr = projectPoint(c, t.line);
    if (pr.distance > maxDistance) continue;
    if (!best || pr.distance < best.pr.distance - 2 || (Math.abs(pr.distance - best.pr.distance) <= 2 && t.o.kind.id === 'track' && best.t.o.kind.id !== 'track')) {
      best = { t, pr };
    }
  }
  if (!best) return null;
  const off = snapOffset(kind, direction, box, best.pr.dir);
  const cx = best.pr.point.x + off.x;
  const cy = best.pr.point.y + off.y;
  const r = (n: number): number => Math.round(n * 100) / 100;
  return { x: r(cx - box.width / 2), y: r(cy - box.height / 2), target: best.t.o, point: { x: r(best.pr.point.x), y: r(best.pr.point.y) } };
}

export function readSnapEnabled(): boolean {
  try {
    return localStorage.getItem(SNAP_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeSnapEnabled(on: boolean): void {
  try {
    localStorage.setItem(SNAP_KEY, on ? '1' : '0');
  } catch {
    // session only
  }
}

/**
 * Snaps the given cells (those of a snap kind) inside the current model update.
 * @returns the cells that moved or got a new track/km
 */
export function snapCells(model: GraphDataModel, cells: Cell[]): Cell[] {
  const objects = collectObjects(model);
  const byCell = new Map(objects.map((o) => [o.cell, o]));
  const targets = snapTargets(objects);
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
      const snap = computeSnap(box, o.kind.id, o.values.direction ?? '', targets);
      if (!snap) continue;
      let did = false;
      const dx = snap.x - box.x;
      const dy = snap.y - box.y;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
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
  let busy = false;
  const onBeforeUndo = (_sender: EventSource, evt: EventObject): void => {
    if (busy || suspended > 0 || !enabled()) return;
    const edit = evt.getProperty('edit') as { changes?: unknown[] } | undefined;
    const cells = editedCells(edit?.changes ?? []);
    if (!cells || cells.length === 0) return;
    busy = true;
    try {
      snapCells(model, cells);
    } finally {
      busy = false;
    }
  };
  (model as unknown as EventSource).addListener(InternalEvent.BEFORE_UNDO, onBeforeUndo);
  return () => (model as unknown as EventSource).removeListener(onBeforeUndo);
}
