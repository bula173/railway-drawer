/**
 * @file run-path.ts
 * @brief The path of a train run in metres: one route or a chain of consecutive routes (each one
 *        starts at the exit signal of the one before) resolved over the track topology
 *        (topology.ts / routes.ts `findRoutePaths`, the path with the route's stored sections like
 *        Railway > Update Route Paths). The result lists the blocks the train passes (track
 *        sections, tracks where there are no sections, points legs without a section) with their
 *        start/end in metres from the entry signal of the first route, the points junctions, the
 *        signals and the overlap of the last route, plus helpers for the drawing position and the km
 *        of any point of the run. Pieces without a scale (no length / km on the track) count one
 *        drawing unit as one metre and make the run `approximate` (with a warning).
 */
import type { GraphDataModel } from '@maxgraph/core';
import { parseNumber, splitRefList } from '../catalogue';
import type { Pt } from '../geometry';
import { kmAtPoint, kmScaleOf } from '../km';
import type { KmScale } from '../km';
import { readAttr } from '../object-data';
import { blockOf, findRoutePaths, parsePointsList } from '../routes';
import type { RoutePath } from '../routes';
import { buildTopology, directionAt, pointAlong, subPolyline } from '../topology';
import type { PointsPosition, Topology } from '../topology';
import { collectObjects, indexObjects } from '../validation';
import type { RailObject } from '../validation';

const EPS = 0.5;

/** Attribute with a speed limit (km/h) on a track section, track or points (optional data). */
export const SPEED_LIMIT_ATTRS = ['rdSpeedLimit', 'rdVmax'] as const;

export type BlockKind = 'section' | 'track' | 'points';

/** A stretch of the run that is occupied / released as one (a section, a track, a points leg). */
export interface RunBlock {
  /** Object ID (section, track or points ID). */
  id: string;
  kind: BlockKind;
  startM: number;
  endM: number;
  /** Route (ID) the block belongs to (the first one when it spans two). */
  routeId: string;
  /** Speed limit from the data (km/h), null: none. */
  limitKmh: number | null;
}

/** A piece of the drawn path (one topology piece, in travel direction). */
export interface RunSegment {
  startM: number;
  endM: number;
  /** Centre line in travel direction (drawing units). */
  line: Pt[];
  /** Drawing units of the line. */
  units: number;
  km: KmScale | null;
}

export interface RunPoints {
  id: string;
  position: PointsPosition;
  routeId: string;
  /** Where the train passes the junction (metres), null: not on the path (only listed by the route). */
  atM: number | null;
}

export interface RunRoute {
  id: string;
  entry: string;
  exit: string;
  startM: number;
  endM: number;
  sections: string[];
  /** Overlap section IDs (only the last route's overlap is used by the run). */
  overlap: string[];
  points: Array<{ id: string; position: PointsPosition }>;
}

export interface RunPath {
  routes: RunRoute[];
  blocks: RunBlock[];
  segments: RunSegment[];
  points: RunPoints[];
  /** Overlap of the last route (section IDs). */
  overlap: string[];
  /** Total length (entry signal of the first route -> exit signal of the last one) in metres. */
  lengthM: number;
  /** Some piece had no scale: metres = drawing units there. */
  approximate: boolean;
  warnings: string[];
}

export interface RunPathResult {
  path: RunPath | null;
  error?: string;
}

function routeObject(index: Map<string, Map<string, RailObject>>, id: string): RailObject | undefined {
  return index.get('route')?.get(id.trim().toUpperCase());
}

/** The path of the route's stored sections (else the first path when it stores none). */
function pathOfRoute(topo: Topology, index: Map<string, Map<string, RailObject>>, r: RailObject): { path?: RoutePath; error?: string; warning?: string } {
  const entryId = (r.values.entrySignal ?? '').trim();
  const exitId = (r.values.exitSignal ?? '').trim();
  const entry = index.get('signal')?.get(entryId.toUpperCase());
  const exit = index.get('signal')?.get(exitId.toUpperCase());
  if (!entry || !exit) return { error: `Route ${r.id}: ${!entry ? `entry signal "${entryId}"` : `exit signal "${exitId}"`} not found` };
  const found = findRoutePaths(topo, entry, exit, { maxPaths: 16 });
  if (found.paths.length === 0) return { error: `Route ${r.id}: ${found.problem ?? 'no path in the drawing'}` };
  const sections = splitRefList(r.values.sections).map((s) => s.toUpperCase());
  const exact = found.paths.find((p) => p.sections.map((s) => s.toUpperCase()).join(',') === sections.join(','));
  if (exact) return { path: exact };
  if (sections.length === 0) return { path: found.paths[0] };
  return { path: found.paths[0], warning: `Route ${r.id}: the stored sections (${sections.join(', ')}) are not a path of the drawing; using ${found.paths[0].sections.join(', ')}` };
}

function speedLimitOf(o: RailObject | undefined): number | null {
  if (!o) return null;
  for (const attr of SPEED_LIMIT_ATTRS) {
    const v = parseNumber(readAttr(o.cell, attr), 'number');
    if (v !== null && v > 0) return v;
  }
  return null;
}

/**
 * Builds the run path for `routeIds` (in travel order). Errors: unknown route, route without a
 * path, routes not consecutive.
 */
export function buildRunPath(model: GraphDataModel, routeIds: string[]): RunPathResult {
  const ids = routeIds.map((r) => r.trim()).filter(Boolean);
  if (ids.length === 0) return { path: null, error: 'Choose a route' };
  const objects = collectObjects(model);
  const index = indexObjects(objects) as Map<string, Map<string, RailObject>>;
  const topo = buildTopology(objects);
  const byId = (kind: string, id: string): RailObject | undefined => index.get(kind)?.get(id.toUpperCase());

  const routes: RunRoute[] = [];
  const blocks: RunBlock[] = [];
  const segments: RunSegment[] = [];
  const points: RunPoints[] = [];
  const warnings: string[] = [];
  let approximate = false;
  let m = 0;
  let lastOverlap: string[] = [];
  let prevStep: { piece: number; forward: boolean } | null = null;

  for (let i = 0; i < ids.length; i++) {
    const r = routeObject(index, ids[i]);
    if (!r) return { path: null, error: `Route "${ids[i]}" not found` };
    const res = pathOfRoute(topo, index, r);
    if (!res.path) return { path: null, error: res.error };
    if (res.warning) warnings.push(res.warning);
    const entry = (r.values.entrySignal ?? '').trim();
    const exit = (r.values.exitSignal ?? '').trim();
    const prev = routes[routes.length - 1];
    if (prev && prev.exit.toUpperCase() !== entry.toUpperCase()) {
      return { path: null, error: `Route ${r.id} does not start at ${prev.exit} (the exit signal of ${prev.id}): routes must be consecutive` };
    }
    const stored = parsePointsList(r.values.points).entries;
    const routePoints = stored.length > 0 ? stored : res.path.points.map((p) => ({ id: p.id, position: p.position }));
    const startM = m;
    const routePointsSeen = new Set<string>();
    for (const s of res.path.steps) {
      const piece = topo.pieces[s.piece];
      // a points junction between the previous piece and this one
      if (prevStep) {
        const prevPiece = topo.pieces[prevStep.piece];
        const node = topo.nodes[prevStep.forward ? prevPiece.b : prevPiece.a];
        if (node?.points && !routePointsSeen.has(node.points.pointsId.toUpperCase())) {
          const required = routePoints.find((p) => p.id.toUpperCase() === node.points!.pointsId.toUpperCase());
          if (required) {
            routePointsSeen.add(required.id.toUpperCase());
            points.push({ id: required.id, position: required.position, routeId: r.id, atM: m });
          }
        }
      }
      prevStep = { piece: s.piece, forward: s.forward };
      const units = Math.abs(s.to - s.from);
      if (units < EPS) continue;
      if (piece.metresPerUnit === null) approximate = true;
      const metres = units * (piece.metresPerUnit ?? 1);
      const line = subPolyline(piece.line, s.from, s.to);
      const sectionObj = piece.sectionId ? byId('trackSection', piece.sectionId) : undefined;
      const trackObj = piece.trackId ? byId('track', piece.trackId) : undefined;
      const km = (sectionObj && kmScaleOf(sectionObj)) || (trackObj && kmScaleOf(trackObj)) || null;
      segments.push({ startM: m, endM: m + metres, line, units, km });
      const block = blockOf(piece);
      const kind: BlockKind = piece.sectionId ? 'section' : piece.pointsCellId ? 'points' : 'track';
      const id = block || piece.pointsId;
      if (id) {
        const last = blocks[blocks.length - 1];
        if (last && last.id.toUpperCase() === id.toUpperCase() && Math.abs(last.endM - m) < 1e-6) {
          last.endM = m + metres;
        } else {
          const obj = kind === 'section' ? sectionObj : kind === 'points' ? byId('points', id) : trackObj;
          blocks.push({ id, kind, startM: m, endM: m + metres, routeId: r.id, limitKmh: speedLimitOf(obj) });
        }
      }
      m += metres;
    }
    // points the route lists but the path does not pass a junction of (vertex points, odd drawings)
    for (const p of routePoints) {
      if (!routePointsSeen.has(p.id.toUpperCase())) points.push({ id: p.id, position: p.position, routeId: r.id, atM: null });
    }
    const storedOverlap = splitRefList(r.values.overlap);
    lastOverlap = storedOverlap.length > 0 ? storedOverlap : res.path.overlap;
    routes.push({
      id: r.id,
      entry,
      exit,
      startM,
      endM: m,
      sections: splitRefList(r.values.sections).length > 0 ? splitRefList(r.values.sections) : res.path.sections,
      overlap: lastOverlap,
      points: routePoints,
    });
  }
  if (m <= 0) return { path: null, error: 'The route has no length in the drawing' };
  const routeSections = new Set(blocks.map((b) => b.id.toUpperCase()));
  const overlap = lastOverlap.filter((id) => !routeSections.has(id.toUpperCase()));
  if (approximate) warnings.unshift('Some tracks have no length or km: drawing units are used as metres there (times and positions are approximate).');
  return { path: { routes, blocks, segments, points, overlap, lengthM: m, approximate, warnings } };
}

/** Drawing position and unit travel direction at `m` metres (before the start: extrapolated). */
export function pointAtM(path: RunPath, m: number): { p: Pt; dir: Pt } {
  const segs = path.segments;
  if (segs.length === 0) return { p: { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
  if (m <= segs[0].startM) {
    const s = segs[0];
    const dir = directionAt(s.line, 0);
    const scale = s.units > 0 ? (s.endM - s.startM) / s.units : 1;
    const back = (s.startM - m) / (scale || 1);
    return { p: { x: s.line[0].x - dir.x * back, y: s.line[0].y - dir.y * back }, dir };
  }
  let s = segs[segs.length - 1];
  for (const seg of segs) {
    if (m <= seg.endM) {
      s = seg;
      break;
    }
  }
  const span = s.endM - s.startM;
  const t = span > 0 ? Math.max(0, Math.min(1, (m - s.startM) / span)) : 0;
  const along = t * s.units;
  return { p: pointAlong(s.line, along), dir: directionAt(s.line, Math.min(along, Math.max(0, s.units - 1e-6))) };
}

/** km at `m` metres of the run (null when the track there has no km start/end). */
export function kmAtM(path: RunPath, m: number): number | null {
  const seg = path.segments.find((s) => m <= s.endM + 1e-6) ?? path.segments[path.segments.length - 1];
  if (!seg?.km) return null;
  return kmAtPoint(seg.km, pointAtM(path, m).p);
}

/** The drawn line of the run between two positions (metres; clamped to the path). */
export function lineBetween(path: RunPath, fromM: number, toM: number): Pt[] {
  const a = Math.max(0, Math.min(fromM, toM));
  const b = Math.min(path.lengthM, Math.max(fromM, toM));
  if (b <= a) return [];
  const out: Pt[] = [];
  for (const s of path.segments) {
    if (s.endM <= a || s.startM >= b) continue;
    const span = s.endM - s.startM || 1;
    const u0 = ((Math.max(a, s.startM) - s.startM) / span) * s.units;
    const u1 = ((Math.min(b, s.endM) - s.startM) / span) * s.units;
    const part = subPolyline(s.line, u0, u1);
    out.push(...(out.length > 0 ? part.slice(1) : part));
  }
  return out;
}
