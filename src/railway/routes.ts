/**
 * @file routes.ts
 * @brief Routes over the track topology: path search from an entry signal to an exit signal,
 *        route summaries (points with required positions, sections in order, overlap, length),
 *        route records read from route objects, conflict detection and the route and
 *        interlocking (conflict) tables.
 *
 * Path search: the train starts at the entry signal in the signal's direction (nominal/reverse,
 * topology.ts; no direction = both), follows the pieces through the nodes (no turns over 90°,
 * points junctions need their toe), and the route ends at the exit signal when the train passes it
 * in its direction. A path may not pass another signal facing the same way (the route would end
 * there) and uses each piece once. Every path is returned (shortest first, at most `maxPaths`).
 */
import { formatStoredNumber, parseNumber, splitRefList } from './catalogue';
import type { Pt } from './geometry';
import type { Table } from './report';
import type { PointsPosition, Topology, TopoLocation, TopoPiece } from './topology';
import { forwardIsNominal, locateObject, passage, subPolyline } from './topology';
import type { RailObject } from './validation';

export interface PathStep {
  piece: number;
  /** Travelling towards increasing along. */
  forward: boolean;
  /** Along range travelled on the piece (from -> to). */
  from: number;
  to: number;
}

export interface RequiredPoints {
  cellId: string;
  id: string;
  position: PointsPosition;
}

export interface RoutePath {
  steps: PathStep[];
  points: RequiredPoints[];
  /** Section (or track) IDs in travel order. */
  sections: string[];
  /** Section beyond the exit signal ([] when the track ends there). */
  overlap: string[];
  /** Length in drawing units. */
  units: number;
  /** Length in metres (from the tracks' length/km; drawing units where unknown). */
  metres: number;
  /** True when some piece had no scale (metres = drawing units there). */
  approximate: boolean;
  /** The path as a polyline (for highlighting). */
  line: Pt[];
}

export interface FindRoutesOptions {
  maxPaths?: number;
  /** Only paths that leave every points in its current position (`rdPosition`). */
  currentPositionsOnly?: boolean;
}

export interface FindRoutesResult {
  paths: RoutePath[];
  /** Why there is no path (when `paths` is empty). */
  problem?: string;
}

const EPS = 0.5;
const MAX_ITERATIONS = 20000;

/** Section/track name of a piece for the route's section list ('' for points legs). */
export function blockOf(piece: TopoPiece): string {
  if (piece.sectionId) return piece.sectionId;
  if (piece.pointsCellId) return '';
  return piece.trackId || piece.linkId;
}

function direction(o: RailObject): '' | 'nominal' | 'reverse' {
  const d = (o.values.direction ?? '').trim();
  return d === 'nominal' || d === 'reverse' ? d : '';
}

/** Travel directions (forward on the piece?) a signal reads for, at its location. */
function startDirections(topo: Topology, o: RailObject, loc: TopoLocation): boolean[] {
  const d = direction(o);
  const nominalForward = forwardIsNominal(topo.pieces[loc.piece], loc.along);
  if (d === 'nominal') return [nominalForward];
  if (d === 'reverse') return [!nominalForward];
  return [true, false];
}

function readsFor(topo: Topology, o: RailObject, loc: TopoLocation, forward: boolean): boolean {
  const d = direction(o);
  if (d === '') return true;
  const nominal = forwardIsNominal(topo.pieces[loc.piece], loc.along) === forward;
  return (d === 'nominal') === nominal;
}

export function findRoutePaths(topo: Topology, entry: RailObject, exit: RailObject, options: FindRoutesOptions = {}): FindRoutesResult {
  const maxPaths = options.maxPaths ?? 8;
  const start = locateObject(topo, entry);
  if (!start) return { paths: [], problem: `Signal ${entry.id || entry.cellId} is not on a track` };
  const end = locateObject(topo, exit);
  if (!end) return { paths: [], problem: `Signal ${exit.id || exit.cellId} is not on a track` };
  if (entry === exit) return { paths: [], problem: 'The entry and exit signal are the same' };

  // Other signals by piece, to stop at the next signal facing the same way
  const signalsOn = new Map<number, Array<{ o: RailObject; loc: TopoLocation }>>();
  for (const o of topo.objects) {
    if (o.kind.id !== 'signal' || o === entry || o === exit) continue;
    const loc = locateObject(topo, o);
    if (!loc) continue;
    const list = signalsOn.get(loc.piece) ?? [];
    list.push({ o, loc });
    signalsOn.set(loc.piece, list);
  }
  const blockedBySignal = (piece: number, forward: boolean, from: number, to: number): boolean => {
    const lo = Math.min(from, to) + EPS;
    const hi = Math.max(from, to) - EPS;
    return (signalsOn.get(piece) ?? []).some((s) => s.loc.along > lo && s.loc.along < hi && direction(s.o) !== '' && readsFor(topo, s.o, s.loc, forward));
  };

  const found: PathStep[][] = [];
  const foundPoints: RequiredPoints[][] = [];
  let iterations = 0;

  const visit = (piece: number, forward: boolean, enter: number, steps: PathStep[], used: Set<number>, positions: Map<string, RequiredPoints>): void => {
    if (found.length >= maxPaths * 4 || ++iterations > MAX_ITERATIONS) return;
    const p = topo.pieces[piece];
    if (piece === end.piece) {
      const ahead = forward ? end.along >= enter : end.along <= enter;
      if (ahead && !(steps.length === 0 && Math.abs(end.along - enter) < EPS) && readsFor(topo, exit, end, forward)) {
        if (!blockedBySignal(piece, forward, enter, end.along)) {
          found.push([...steps, { piece, forward, from: enter, to: end.along }]);
          foundPoints.push([...positions.values()]);
        }
        return;
      }
    }
    const leave = forward ? p.length : 0;
    if (blockedBySignal(piece, forward, enter, leave)) return;
    const nodeId = forward ? p.b : p.a;
    const step: PathStep = { piece, forward, from: enter, to: leave };
    for (const next of topo.nodes[nodeId].pieces) {
      if (used.has(next)) continue;
      const pass = passage(topo, nodeId, piece, next);
      if (!pass.ok) continue;
      let nextPositions = positions;
      if (pass.points && pass.position) {
        const known = positions.get(pass.points.cellId);
        if (known && known.position !== pass.position) continue;
        if (options.currentPositionsOnly) {
          const current = topo.objects.find((o) => o.cellId === pass.points!.cellId)?.values.position?.trim();
          if (current && current !== pass.position) continue;
        }
        if (!known) {
          nextPositions = new Map(positions);
          nextPositions.set(pass.points.cellId, { cellId: pass.points.cellId, id: pass.points.pointsId, position: pass.position });
        }
      }
      const q = topo.pieces[next];
      const qForward = q.a === nodeId;
      used.add(next);
      visit(next, qForward, qForward ? 0 : q.length, [...steps, step], used, nextPositions);
      used.delete(next);
    }
  };

  for (const forward of startDirections(topo, entry, start)) {
    visit(start.piece, forward, start.along, [], new Set([start.piece]), new Map());
  }
  if (found.length === 0) {
    return { paths: [], problem: `No path from ${entry.id || 'the entry signal'} to ${exit.id || 'the exit signal'} in the signal direction` };
  }
  const paths = found.map((steps, i) => summarizePath(topo, steps, foundPoints[i]));
  paths.sort((a, b) => a.units - b.units);
  // Same sections and points twice (e.g. both start directions of a signal without direction)
  const seen = new Set<string>();
  const unique = paths.filter((p) => {
    const key = `${p.sections.join(',')}|${p.points.map((x) => `${x.cellId}:${x.position}`).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { paths: unique.slice(0, maxPaths) };
}

function summarizePath(topo: Topology, steps: PathStep[], points: RequiredPoints[]): RoutePath {
  const sections: string[] = [];
  let units = 0;
  let metres = 0;
  let approximate = false;
  const line: Pt[] = [];
  for (const s of steps) {
    const piece = topo.pieces[s.piece];
    const len = Math.abs(s.to - s.from);
    units += len;
    if (piece.metresPerUnit === null) approximate = true;
    metres += len * (piece.metresPerUnit ?? 1);
    const block = blockOf(piece);
    if (block && len > EPS && sections[sections.length - 1]?.toUpperCase() !== block.toUpperCase()) sections.push(block);
    const part = subPolyline(piece.line, s.from, s.to);
    line.push(...(line.length > 0 ? part.slice(1) : part));
  }
  const last = steps[steps.length - 1];
  return { steps, points, sections, overlap: overlapAfter(topo, last), units, metres, approximate, line };
}

/** The first section beyond the exit signal, continuing straight (points normal) where possible. */
function overlapAfter(topo: Topology, last: PathStep): string[] {
  let piece = topo.pieces[last.piece];
  let forward = last.forward;
  const rest = forward ? piece.length - last.to : last.to;
  for (let guard = 0; guard < 50; guard++) {
    const block = blockOf(piece);
    if (block && (guard > 0 || rest > EPS)) return [block];
    const nodeId = forward ? piece.b : piece.a;
    const options = topo.nodes[nodeId].pieces
      .map((next) => ({ next, pass: passage(topo, nodeId, piece.id, next) }))
      .filter((x) => x.pass.ok)
      .sort((a, b) => (a.pass.position === 'reverse' ? 1 : 0) - (b.pass.position === 'reverse' ? 1 : 0));
    if (options.length === 0) return [];
    const q = topo.pieces[options[0].next];
    forward = q.a === nodeId;
    piece = q;
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Points lists (`W1:normal, W2:reverse`)
// ---------------------------------------------------------------------------------------------

export interface PointsEntry {
  id: string;
  position: PointsPosition;
}

/** Parses a route's points field; unreadable entries are returned in `invalid`. */
export function parsePointsList(text: string | null | undefined): { entries: PointsEntry[]; invalid: string[] } {
  const entries: PointsEntry[] = [];
  const invalid: string[] = [];
  for (const part of splitRefList(text)) {
    const m = /^(.+?)\s*[:=]\s*(normal|reverse|n|r|\+|-)$/i.exec(part) ?? /^(.+?)\s+(normal|reverse)$/i.exec(part);
    if (!m) {
      invalid.push(part);
      continue;
    }
    const p = m[2].toLowerCase();
    entries.push({ id: m[1].trim(), position: p === 'normal' || p === 'n' || p === '+' ? 'normal' : 'reverse' });
  }
  return { entries, invalid };
}

export function formatPointsList(points: Array<{ id: string; position: PointsPosition }>): string {
  return points.map((p) => `${p.id}:${p.position}`).join(', ');
}

/** The data values of a route object for a path. */
export function routeValues(path: RoutePath, entry: RailObject, exit: RailObject): Record<string, string> {
  return {
    entrySignal: entry.id,
    exitSignal: exit.id,
    points: formatPointsList(path.points),
    sections: path.sections.join(', '),
    overlap: path.overlap.join(', '),
    length: formatStoredNumber(Math.round(path.metres)),
  };
}

/** Short description of a path for choosing between alternatives. */
export function describePath(path: RoutePath): string {
  const points = path.points.length > 0 ? path.points.map((p) => `${p.id} ${p.position}`).join(', ') : 'no points';
  const len = `${Math.round(path.metres)} m${path.approximate ? ' (≈ drawing units)' : ''}`;
  return `${path.sections.join(' → ') || '—'} · ${points} · ${len}`;
}

// ---------------------------------------------------------------------------------------------
// Route records, conflicts and tables
// ---------------------------------------------------------------------------------------------

export interface RouteRecord {
  o: RailObject;
  id: string;
  entry: string;
  exit: string;
  points: PointsEntry[];
  sections: string[];
  overlap: string[];
  length: number | null;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function routeRecords(objects: RailObject[]): RouteRecord[] {
  return objects
    .filter((o) => o.kind.id === 'route')
    .map((o) => ({
      o,
      id: o.id,
      entry: (o.values.entrySignal ?? '').trim(),
      exit: (o.values.exitSignal ?? '').trim(),
      points: parsePointsList(o.values.points).entries,
      sections: splitRefList(o.values.sections),
      overlap: splitRefList(o.values.overlap),
      length: parseNumber(o.values.length, 'number'),
    }))
    .sort((a, b) => collator.compare(a.id, b.id));
}

export interface RouteConflict {
  a: RouteRecord;
  b: RouteRecord;
  /** Sections both routes use (path or overlap). */
  sharedSections: string[];
  /** Points the routes need in opposite positions (`W1 (normal/reverse)`). */
  opposingPoints: string[];
}

/** Every pair of routes that share a section (incl. overlaps) or need points in opposite positions. */
export function detectConflicts(routes: RouteRecord[]): RouteConflict[] {
  const out: RouteConflict[] = [];
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const a = routes[i];
      const b = routes[j];
      const bSections = new Set([...b.sections, ...b.overlap].map((s) => s.toUpperCase()));
      const shared: string[] = [];
      for (const s of [...a.sections, ...a.overlap]) {
        if (bSections.has(s.toUpperCase()) && !shared.some((x) => x.toUpperCase() === s.toUpperCase())) shared.push(s);
      }
      const opposing: string[] = [];
      for (const p of a.points) {
        const q = b.points.find((x) => x.id.toUpperCase() === p.id.toUpperCase());
        if (q && q.position !== p.position) opposing.push(`${p.id} (${p.position}/${q.position})`);
      }
      if (shared.length > 0 || opposing.length > 0) out.push({ a, b, sharedSections: shared, opposingPoints: opposing });
    }
  }
  return out;
}

/** Conflicting route IDs of each route. */
export function conflictsByRoute(conflicts: RouteConflict[]): Map<RouteRecord, string[]> {
  const map = new Map<RouteRecord, string[]>();
  const add = (r: RouteRecord, other: string): void => {
    const list = map.get(r) ?? [];
    list.push(other);
    map.set(r, list);
  };
  for (const c of conflicts) {
    add(c.a, c.b.id);
    add(c.b, c.a.id);
  }
  return map;
}

export function buildRouteTable(routes: RouteRecord[], conflicts: RouteConflict[] = detectConflicts(routes)): Table {
  const byRoute = conflictsByRoute(conflicts);
  return {
    title: 'Routes',
    columns: ['Route', 'From signal', 'To signal', 'Points & positions', 'Track sections', 'Overlap', 'Length [m]', 'Conflicting routes'],
    rows: routes.map((r) => [
      r.id,
      r.entry,
      r.exit,
      r.points.map((p) => `${p.id} ${p.position}`).join(', '),
      r.sections.join(', '),
      r.overlap.join(', '),
      r.length ?? '',
      (byRoute.get(r) ?? []).sort(collator.compare).join(', '),
    ]),
  };
}

export function buildConflictTable(conflicts: RouteConflict[]): Table {
  return {
    title: 'Interlocking',
    columns: ['Route', 'Conflicting route', 'Shared sections', 'Opposing points', 'Reason'],
    rows: conflicts.map((c) => [
      c.a.id,
      c.b.id,
      c.sharedSections.join(', '),
      c.opposingPoints.join(', '),
      [c.sharedSections.length > 0 ? 'shared section' : '', c.opposingPoints.length > 0 ? 'opposite points positions' : ''].filter(Boolean).join(' + '),
    ]),
  };
}
