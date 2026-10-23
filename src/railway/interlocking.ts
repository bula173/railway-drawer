/**
 * @file interlocking.ts
 * @brief Interlocking table ("tablica zależności") of the drawn routes: per route the entry/exit
 *        signals, the points with their positions (facing / trailing / in the overlap), the
 *        sections (TVD) in order, the overlap, the flank protection, the conflicting routes with
 *        reason codes and the aspect data of the entry signal; plus the conflict matrix and the
 *        export tables (Polish PKP-style headers or English). Model only (topology.ts, routes.ts).
 *
 * Routes come from the route objects (routes.ts `routeRecords`); the path through the drawing is
 * the one `findRoutePaths` finds for the stored sections (else the one agreeing best with the
 * stored points). Stored data wins over the drawing: the stored points positions, sections and
 * overlap are used; the drawing adds the facing/trailing role, travel directions, the overlap's
 * points and length, and the flank protection.
 *
 * **Flank protection** (per points junction J the route or its overlap runs over): the route
 * uses the toe and one leg; a movement coming from the OTHER leg towards J would run into the
 * route. Starting on the other leg, the search walks away from J (all branches, max
 * FLANK_MAX_DEPTH pieces):
 * - a signal reading towards J (its direction set) protects at Stop -> flank element "signal Stop";
 * - points K reached on one of its legs (normal/reverse) protect when set to the other leg -> flank
 *   element "K in the other position" (this is the classic crossover case: W1 normal is protected
 *   by W2 normal);
 * - points K reached on its toe: movements may come from both legs, the search continues on both;
 * - a track end (buffer stop, dead end): nothing can come from there, no element;
 * - nothing found within the depth limit: the points are listed as "unprotected".
 * Elements that are the route's own points are dropped (the route sets them itself). Limits:
 * derailers and protecting shunting signals are not modelled separately (a signal with a direction
 * counts whatever its type), signals without a direction are ignored, the search does not look at
 * distances (fouling points) and does not combine several elements into one protection.
 *
 * **Conflicts** between two routes A and B (codes):
 * - `S` a section both paths use;
 * - `O` a section of one route's overlap that the other route uses (path or overlap) and is not
 *   already shared by both paths;
 * - `P` points both need (path or overlap) in different positions;
 * - `F` flank: A needs points K for flank protection in a position B needs the other way (or the
 *   flank signal of A is B's entry signal), or the other way round;
 * - `D` opposing directions on a shared section (S or O).
 * Computed once per pair, so the matrix is symmetric.
 */
import type { CellValue, Table } from './report';
import type { PointsPosition, Topology, TopoLocation } from './topology';
import { buildTopology, forwardIsNominal, locateObject, passage } from './topology';
import type { PathStep, RoutePath, RouteRecord } from './routes';
import { blockOf, findRoutePaths, routeRecords } from './routes';
import type { RailObject } from './validation';

export type ConflictCode = 'S' | 'O' | 'P' | 'F' | 'D';
export const CONFLICT_CODES: readonly ConflictCode[] = ['S', 'O', 'P', 'F', 'D'];

export type Lang = 'pl' | 'en';
export interface Bilingual {
  en: string;
  pl: string;
}

export const CONFLICT_CODE_LABELS: Record<ConflictCode, Bilingual> = {
  S: { en: 'shared section', pl: 'wspólny odcinek' },
  O: { en: 'overlap', pl: 'zakładka' },
  P: { en: 'opposite points positions', pl: 'niezgodne położenie zwrotnic' },
  F: { en: 'flank protection', pl: 'ochrona boczna' },
  D: { en: 'opposing directions', pl: 'przeciwne kierunki jazdy' },
};

export type Direction = 'nominal' | 'reverse';
export type PointsRole = 'facing' | 'trailing' | 'overlap';

export interface IlPoints {
  id: string;
  position: PointsPosition;
  /** null when the points are only in the stored list (not on the drawn path). */
  role: PointsRole | null;
}

export interface FlankElement {
  kind: 'points' | 'signal';
  id: string;
  /** Points: the protecting position. Signals: always Stop. */
  position?: PointsPosition;
  /** The route's points this element protects. */
  protects: string[];
}

export type AspectKind = 'proceed' | 'caution' | 'ma';

export interface EntryAspect {
  /** Entry signal and the route's next signal (the exit signal). */
  signal: string;
  next: string;
  nextType: string;
  /** Aspect of the entry signal depending on the next signal. */
  aspects: Array<{ when: 'nextProceed' | 'nextStop' | 'always'; aspect: AspectKind }>;
  /** Points of the path in reverse: the speed is restricted. */
  reversePoints: string[];
  speedRestricted: boolean;
}

export interface IlRoute {
  id: string;
  cellId: string;
  entry: string;
  exit: string;
  points: IlPoints[];
  sections: string[];
  overlap: string[];
  overlapPoints: IlPoints[];
  /** Travel direction per section (upper-case ID), path and overlap. */
  directions: Record<string, Direction>;
  flank: FlankElement[];
  /** Points for which the flank search found no protecting element. */
  unprotected: string[];
  aspect: EntryAspect;
  /** A path through the drawing was found. */
  pathFound: boolean;
  problem?: string;
  /** Length from the exit signal to the end of the overlap [m]; null without overlap or scale. */
  overlapMetres: number | null;
}

export interface IlConflict {
  a: string;
  b: string;
  codes: ConflictCode[];
  sharedSections: string[];
  overlapSections: string[];
  points: string[];
  flank: string[];
  opposing: string[];
}

export interface Interlocking {
  routes: IlRoute[];
  conflicts: IlConflict[];
}

/** Flank search: max pieces walked away from the protected points. */
export const FLANK_MAX_DEPTH = 12;
const EPS = 0.5;
const upper = (s: string): string => s.trim().toUpperCase();

function signalDirection(o: RailObject): '' | Direction {
  const d = (o.values.direction ?? '').trim();
  return d === 'nominal' || d === 'reverse' ? d : '';
}

/** Does signal `o` (located at `loc`) read for travel `forward` along its piece? (false without direction) */
export function signalReadsFor(topo: Topology, o: RailObject, loc: TopoLocation, forward: boolean): boolean {
  const d = signalDirection(o);
  if (d === '') return false;
  const nominal = forwardIsNominal(topo.pieces[loc.piece], loc.along) === forward;
  return (d === 'nominal') === nominal;
}

interface Junction {
  nodeId: number;
  from: number;
  to: number;
}

function junctionsOf(topo: Topology, steps: PathStep[]): Junction[] {
  const out: Junction[] = [];
  for (let i = 0; i + 1 < steps.length; i++) {
    const prev = topo.pieces[steps[i].piece];
    const nodeId = steps[i].forward ? prev.b : prev.a;
    if (topo.nodes[nodeId]?.points) out.push({ nodeId, from: steps[i].piece, to: steps[i + 1].piece });
  }
  return out;
}

function junctionPoints(topo: Topology, j: Junction, overlap: boolean): IlPoints {
  const p = topo.nodes[j.nodeId].points!;
  const position: PointsPosition = j.from === p.reverse || j.to === p.reverse ? 'reverse' : 'normal';
  return { id: p.pointsId, position, role: overlap ? 'overlap' : j.from === p.toe ? 'facing' : 'trailing' };
}

function addDirections(topo: Topology, steps: PathStep[], into: Record<string, Direction>): void {
  for (const s of steps) {
    const piece = topo.pieces[s.piece];
    const block = blockOf(piece);
    if (!block || Math.abs(s.to - s.from) <= EPS) continue;
    const key = upper(block);
    if (into[key]) continue;
    into[key] = s.forward === forwardIsNominal(piece, (s.from + s.to) / 2) ? 'nominal' : 'reverse';
  }
}

export interface OverlapWalk {
  sections: string[];
  steps: PathStep[];
  junctions: Junction[];
  /** From the exit signal to the end of the overlap; null when some piece has no scale or the overlap was not reached. */
  metres: number | null;
  reached: boolean;
}

/**
 * Walks on beyond the exit signal (the last step of a path) through the overlap: the stored
 * overlap sections `wanted` (preferring pieces into them), else the first section beyond the exit
 * signal (points normal preferred, like routes.ts `overlapAfter`). Stops where the overlap ends.
 */
export function walkOverlap(topo: Topology, last: PathStep, wanted: string[]): OverlapWalk {
  const want = new Set(wanted.map(upper).filter(Boolean));
  let piece = topo.pieces[last.piece];
  let forward = last.forward;
  let from = last.to;
  let metres = 0;
  let scaled = true;
  let entered = false;
  let current = '';
  const sections: string[] = [];
  const steps: PathStep[] = [];
  const junctions: Junction[] = [];
  const used = new Set<number>([piece.id]);
  for (let guard = 0; guard < 60; guard++) {
    const block = blockOf(piece);
    const to = forward ? piece.length : 0;
    const len = Math.abs(to - from);
    const inside = want.size > 0 ? block !== '' && want.has(upper(block)) : entered ? upper(block) === current : block !== '' && (guard > 0 || len > EPS);
    if (entered && !inside && block !== '') break;
    if (!entered && inside) {
      entered = true;
      current = upper(block);
    }
    if (inside && !sections.some((s) => upper(s) === upper(block))) sections.push(block);
    if (len > 0) {
      steps.push({ piece: piece.id, forward, from, to });
      if (piece.metresPerUnit === null) scaled = false;
      metres += len * (piece.metresPerUnit ?? 1);
    }
    const nodeId = forward ? piece.b : piece.a;
    const options = topo.nodes[nodeId].pieces
      .filter((next) => !used.has(next))
      .map((next) => ({ next, pass: passage(topo, nodeId, piece.id, next) }))
      .filter((x) => x.pass.ok)
      .sort((a, b) => {
        const wa = want.has(upper(blockOf(topo.pieces[a.next]))) ? 0 : 1;
        const wb = want.has(upper(blockOf(topo.pieces[b.next]))) ? 0 : 1;
        if (wa !== wb) return wa - wb;
        return (a.pass.position === 'reverse' ? 1 : 0) - (b.pass.position === 'reverse' ? 1 : 0);
      });
    if (options.length === 0) break;
    const nextPiece = topo.pieces[options[0].next];
    const nextBlock = blockOf(nextPiece);
    const nextInside = want.size > 0 ? nextBlock !== '' && want.has(upper(nextBlock)) : entered ? upper(nextBlock) === current : nextBlock !== '';
    if (entered && !nextInside && nextBlock !== '') break;
    if (topo.nodes[nodeId].points) junctions.push({ nodeId, from: piece.id, to: nextPiece.id });
    used.add(nextPiece.id);
    forward = nextPiece.a === nodeId;
    from = forward ? 0 : nextPiece.length;
    piece = nextPiece;
  }
  // points legs walked after the end of the overlap are not part of it
  return { sections, steps, junctions, metres: entered && scaled ? metres : null, reached: entered };
}

interface LocatedSignal {
  o: RailObject;
  loc: TopoLocation;
}

function flankFrom(
  topo: Topology,
  nodeId: number,
  startPiece: number,
  routePieces: Set<number>,
  signalsOn: Map<number, LocatedSignal[]>
): { elements: Array<{ kind: 'points' | 'signal'; id: string; position?: PointsPosition }>; unprotected: boolean } {
  const elements: Array<{ kind: 'points' | 'signal'; id: string; position?: PointsPosition }> = [];
  let unprotected = false;
  const seen = new Set<number>();
  const stack = [{ piece: startPiece, fromNode: nodeId, depth: 0 }];
  while (stack.length > 0) {
    const { piece, fromNode, depth } = stack.pop()!;
    if (seen.has(piece) || routePieces.has(piece)) continue;
    seen.add(piece);
    const p = topo.pieces[piece];
    const away = p.a === fromNode;
    // a signal reading towards the protected points (travel !away), the nearest one
    const protecting = (signalsOn.get(piece) ?? [])
      .filter((s) => signalReadsFor(topo, s.o, s.loc, !away))
      .sort((x, y) => (away ? x.loc.along - y.loc.along : y.loc.along - x.loc.along));
    if (protecting.length > 0) {
      elements.push({ kind: 'signal', id: protecting[0].o.id });
      continue;
    }
    const far = away ? p.b : p.a;
    const node = topo.nodes[far];
    const others = node.pieces.filter((x) => x !== piece);
    if (others.length === 0) continue; // track end: nothing comes from there
    const j = node.points;
    if (j && piece !== j.toe && (piece === j.normal || piece === j.reverse)) {
      elements.push({ kind: 'points', id: j.pointsId, position: piece === j.normal ? 'reverse' : 'normal' });
      continue;
    }
    if (depth >= FLANK_MAX_DEPTH) {
      unprotected = true;
      continue;
    }
    for (const q of others) if (passage(topo, far, piece, q).ok) stack.push({ piece: q, fromNode: far, depth: depth + 1 });
  }
  return { elements, unprotected: unprotected && elements.length === 0 };
}

function choosePath(paths: RoutePath[], r: RouteRecord): RoutePath | null {
  if (paths.length === 0) return null;
  const want = r.sections.map(upper).join(',');
  const bySections = want ? paths.filter((p) => p.sections.map(upper).join(',') === want) : paths;
  const pool = bySections.length > 0 ? bySections : paths;
  const agrees = (x: { id: string; position: PointsPosition }): boolean => r.points.some((q) => upper(q.id) === upper(x.id) && q.position === x.position);
  const score = (p: RoutePath): number => p.points.filter(agrees).length - p.points.filter((x) => !agrees(x)).length;
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

function entryAspect(entry: RailObject | undefined, exit: RailObject | undefined, r: RouteRecord, points: IlPoints[]): EntryAspect {
  const nextType = (exit?.values.signalType ?? '').trim();
  const reversePoints = points.filter((p) => p.position === 'reverse' && p.role !== 'overlap').map((p) => p.id);
  const aspectsCount = Number((entry?.values.aspects ?? '').trim());
  let aspects: EntryAspect['aspects'];
  if (nextType === 'markerBoard' || nextType === 'etcsStopMarker') aspects = [{ when: 'always', aspect: 'ma' }];
  else if (aspectsCount === 2) aspects = [{ when: 'always', aspect: 'proceed' }];
  else aspects = [{ when: 'nextProceed', aspect: 'proceed' }, { when: 'nextStop', aspect: 'caution' }];
  return { signal: r.entry, next: r.exit, nextType, aspects, reversePoints, speedRestricted: reversePoints.length > 0 };
}

export interface InterlockingOptions {
  /** Skip the pairwise conflicts (the rule checks only need the routes). */
  conflicts?: boolean;
}

/** The interlocking data of the routes of a drawing. */
export function computeInterlocking(objects: RailObject[], topology?: Topology, options: InterlockingOptions = {}): Interlocking {
  const records = routeRecords(objects);
  if (records.length === 0) return { routes: [], conflicts: [] };
  const topo = topology ?? buildTopology(objects);
  const signals = new Map<string, RailObject>();
  for (const o of objects) if (o.kind.id === 'signal' && o.id && !signals.has(upper(o.id))) signals.set(upper(o.id), o);
  const signalsOn = new Map<number, LocatedSignal[]>();
  for (const o of signals.values()) {
    const loc = locateObject(topo, o);
    if (!loc) continue;
    const list = signalsOn.get(loc.piece) ?? [];
    list.push({ o, loc });
    signalsOn.set(loc.piece, list);
  }
  const routes = records.map((r) => analyzeRoute(topo, r, signals.get(upper(r.entry)), signals.get(upper(r.exit)), signalsOn));
  return { routes, conflicts: options.conflicts === false ? [] : detectInterlockingConflicts(routes) };
}

function analyzeRoute(topo: Topology, r: RouteRecord, entry: RailObject | undefined, exit: RailObject | undefined, signalsOn: Map<number, LocatedSignal[]>): IlRoute {
  const directions: Record<string, Direction> = {};
  let path: RoutePath | null = null;
  let problem: string | undefined;
  if (!entry || !exit) problem = !r.entry || !r.exit ? 'no entry or exit signal' : `signal ${!entry ? r.entry : r.exit} not found`;
  else {
    const found = findRoutePaths(topo, entry, exit, { maxPaths: 16 });
    path = choosePath(found.paths, r);
    if (!path) problem = found.problem ?? 'no path in the drawing';
  }
  const pathPoints: IlPoints[] = [];
  const overlapPoints: IlPoints[] = [];
  const overlap = r.overlap;
  let overlapMetres: number | null = null;
  const flank: FlankElement[] = [];
  const unprotected: string[] = [];
  if (path) {
    addDirections(topo, path.steps, directions);
    const junctions = junctionsOf(topo, path.steps);
    for (const j of junctions) {
      const p = junctionPoints(topo, j, false);
      if (!pathPoints.some((x) => upper(x.id) === upper(p.id))) pathPoints.push(p);
    }
    const last = path.steps[path.steps.length - 1];
    const ov = walkOverlap(topo, last, r.overlap);
    if (ov.reached) {
      addDirections(topo, ov.steps, directions);
      overlapMetres = overlap.length > 0 ? ov.metres : null;
      if (overlap.length > 0) {
        for (const j of ov.junctions) {
          const p = junctionPoints(topo, j, true);
          if (!overlapPoints.some((x) => upper(x.id) === upper(p.id)) && !pathPoints.some((x) => upper(x.id) === upper(p.id))) overlapPoints.push(p);
        }
      }
    }
    // flank protection of every points junction on the path and in the overlap
    const routePieces = new Set<number>([...path.steps.map((s) => s.piece), ...(overlap.length > 0 ? ov.steps.map((s) => s.piece) : [])]);
    const all = [...junctions, ...(overlap.length > 0 ? ov.junctions : [])];
    const own = new Set([...pathPoints, ...overlapPoints, ...r.points].map((p) => upper(p.id)));
    for (const j of all) {
      const jp = topo.nodes[j.nodeId].points!;
      const usesReverse = j.from === jp.reverse || j.to === jp.reverse;
      const other = usesReverse ? jp.normal : jp.reverse;
      const res = flankFrom(topo, j.nodeId, other, routePieces, signalsOn);
      for (const e of res.elements) {
        if (e.kind === 'points' && own.has(upper(e.id))) continue;
        const known = flank.find((f) => f.kind === e.kind && upper(f.id) === upper(e.id) && f.position === e.position);
        if (known) {
          if (!known.protects.includes(jp.pointsId)) known.protects.push(jp.pointsId);
        } else flank.push({ ...e, protects: [jp.pointsId] });
      }
      if (res.unprotected && !unprotected.includes(jp.pointsId)) unprotected.push(jp.pointsId);
    }
  }
  // stored positions win; the drawing adds the role and points the list misses
  const points: IlPoints[] = r.points.map((p) => ({ id: p.id, position: p.position, role: pathPoints.find((x) => upper(x.id) === upper(p.id))?.role ?? null }));
  for (const p of pathPoints) if (!points.some((x) => upper(x.id) === upper(p.id))) points.push(p);
  return {
    id: r.id,
    cellId: r.o.cellId,
    entry: r.entry,
    exit: r.exit,
    points,
    sections: r.sections.length > 0 ? r.sections : path?.sections ?? [],
    overlap,
    overlapPoints,
    directions,
    flank,
    unprotected,
    aspect: entryAspect(entry, exit, r, points),
    pathFound: !!path,
    ...(problem ? { problem } : {}),
    overlapMetres,
  };
}

const pointsKey = (list: IlPoints[]): Map<string, IlPoints> => {
  const m = new Map<string, IlPoints>();
  for (const p of list) if (!m.has(upper(p.id))) m.set(upper(p.id), p);
  return m;
};

function flankConflicts(a: IlRoute, b: IlRoute, bPoints: Map<string, IlPoints>): string[] {
  const out: string[] = [];
  for (const f of a.flank) {
    if (f.kind === 'points') {
      const q = bPoints.get(upper(f.id));
      if (q && q.position !== f.position) out.push(`${f.id} (${a.id} flank ${f.position}/${b.id} ${q.position})`);
    } else if (upper(f.id) === upper(b.entry)) {
      out.push(`${f.id} (${a.id} flank stop/${b.id} entry)`);
    }
  }
  return out;
}

/** Every pair of routes in conflict, with the reason codes (symmetric). */
export function detectInterlockingConflicts(routes: IlRoute[]): IlConflict[] {
  const out: IlConflict[] = [];
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const a = routes[i];
      const b = routes[j];
      const pathA = new Set(a.sections.map(upper));
      const pathB = new Set(b.sections.map(upper));
      const ovA = new Set(a.overlap.map(upper));
      const ovB = new Set(b.overlap.map(upper));
      const shared = a.sections.filter((s, k) => pathB.has(upper(s)) && a.sections.findIndex((x) => upper(x) === upper(s)) === k);
      const sharedSet = new Set(shared.map(upper));
      const overlapSections: string[] = [];
      const addOv = (s: string): void => {
        if (!sharedSet.has(upper(s)) && !overlapSections.some((x) => upper(x) === upper(s))) overlapSections.push(s);
      };
      for (const s of a.overlap) if (pathB.has(upper(s)) || ovB.has(upper(s))) addOv(s);
      for (const s of b.overlap) if (pathA.has(upper(s)) || ovA.has(upper(s))) addOv(s);
      const aPoints = pointsKey([...a.points, ...a.overlapPoints]);
      const bPoints = pointsKey([...b.points, ...b.overlapPoints]);
      const points: string[] = [];
      for (const [key, p] of aPoints) {
        const q = bPoints.get(key);
        if (q && q.position !== p.position) points.push(`${p.id} (${p.position}/${q.position})`);
      }
      const flank = [...flankConflicts(a, b, bPoints), ...flankConflicts(b, a, aPoints)];
      const opposing = [...shared, ...overlapSections].filter((s) => {
        const da = a.directions[upper(s)];
        const db = b.directions[upper(s)];
        return !!da && !!db && da !== db;
      });
      const codes: ConflictCode[] = [];
      if (shared.length > 0) codes.push('S');
      if (overlapSections.length > 0) codes.push('O');
      if (points.length > 0) codes.push('P');
      if (flank.length > 0) codes.push('F');
      if (opposing.length > 0) codes.push('D');
      if (codes.length > 0) out.push({ a: a.id, b: b.id, codes, sharedSections: shared, overlapSections, points, flank, opposing });
    }
  }
  return out;
}

/** Conflict codes between route `a` and route `b` ([] = none). */
export function conflictCodes(il: Interlocking, a: string, b: string): ConflictCode[] {
  const c = il.conflicts.find((x) => (upper(x.a) === upper(a) && upper(x.b) === upper(b)) || (upper(x.a) === upper(b) && upper(x.b) === upper(a)));
  return c ? c.codes : [];
}

/** Matrix of conflict codes (rows/columns in route order; the diagonal is null). */
export function conflictMatrix(il: Interlocking): Array<Array<ConflictCode[] | null>> {
  const index = new Map(il.routes.map((r, i) => [r, i]));
  const byId = new Map(il.routes.map((r) => [upper(r.id), r]));
  const m = il.routes.map((_r, i) => il.routes.map((_q, j): ConflictCode[] | null => (i === j ? null : [])));
  for (const c of il.conflicts) {
    const i = index.get(byId.get(upper(c.a))!);
    const j = index.get(byId.get(upper(c.b))!);
    if (i === undefined || j === undefined) continue;
    m[i][j] = [...c.codes];
    m[j][i] = [...c.codes];
  }
  return m;
}

// ---------------------------------------------------------------------------------------------
// Text and tables
// ---------------------------------------------------------------------------------------------

const POSITION_TEXT: Record<Lang, Record<PointsPosition, string>> = { pl: { normal: '+', reverse: '-' }, en: { normal: 'normal', reverse: 'reverse' } };

export function formatIlPoints(p: { id: string; position: PointsPosition; role?: PointsRole | null }, lang: Lang): string {
  if (lang === 'pl') return `${p.id}${POSITION_TEXT.pl[p.position]}`;
  const role = p.role === 'facing' || p.role === 'trailing' ? ` (${p.role})` : '';
  return `${p.id} ${p.position}${role}`;
}

export function formatFlank(r: IlRoute, lang: Lang): string {
  const parts = r.flank.map((f) => (f.kind === 'signal' ? (lang === 'pl' ? `${f.id} Stój` : `${f.id} stop`) : formatIlPoints({ id: f.id, position: f.position! }, lang)));
  for (const u of r.unprotected) parts.push(lang === 'pl' ? `brak dla ${u}` : `none found for ${u}`);
  return parts.join(', ');
}

export function formatOverlap(r: IlRoute, lang: Lang): string {
  if (r.overlap.length === 0) return '';
  const pts = r.overlapPoints.map((p) => formatIlPoints({ id: p.id, position: p.position }, lang)).join(', ');
  return `${r.overlap.join(', ')}${pts ? ` (${pts})` : ''}`;
}

export function formatAspect(a: EntryAspect, lang: Lang): string {
  const pl = lang === 'pl';
  const parts = a.aspects.map((x) => {
    if (x.aspect === 'ma') return pl ? `MA ETCS do ${a.next}` : `ETCS MA to ${a.next}`;
    if (x.when === 'always') return pl ? 'Wolna droga (semafor o 2 wskazaniach)' : 'Proceed (2-aspect signal)';
    if (x.aspect === 'proceed') return pl ? `Wolna droga (${a.next} zezwala na jazdę)` : `Proceed (${a.next} proceed)`;
    return pl ? `Ostrzeżenie (${a.next} Stój)` : `Caution (${a.next} at stop)`;
  });
  let text = parts.join(' / ');
  if (a.speedRestricted) {
    const pts = a.reversePoints.join(', ');
    text += pl ? `; ograniczenie prędkości (${pts} w położeniu zwrotnym)` : `; speed restriction (${pts} reverse)`;
  }
  return text;
}

function conflictsOf(il: Interlocking, r: IlRoute): string {
  const list: Array<{ id: string; codes: ConflictCode[] }> = [];
  for (const c of il.conflicts) {
    if (upper(c.a) === upper(r.id)) list.push({ id: c.b, codes: c.codes });
    else if (upper(c.b) === upper(r.id)) list.push({ id: c.a, codes: c.codes });
  }
  const order = new Map(il.routes.map((x, i) => [upper(x.id), i]));
  list.sort((x, y) => (order.get(upper(x.id)) ?? 0) - (order.get(upper(y.id)) ?? 0));
  return list.map((x) => `${x.id} (${x.codes.join(',')})`).join(', ');
}

export const INTERLOCKING_COLUMNS: Record<Lang, string[]> = {
  pl: ['Przebieg', 'Od semafora', 'Do semafora', 'Zwrotnice (położenie)', 'Ochrona boczna', 'Odcinki izolowane/sekcje', 'Zakładka', 'Przebiegi wykluczające się', 'Sygnał na semaforze'],
  en: ['Route', 'From signal', 'To signal', 'Points (position)', 'Flank protection', 'Track sections (TVD)', 'Overlap', 'Conflicting routes', 'Entry signal aspect'],
};

export const INTERLOCKING_TITLE: Record<Lang, string> = { pl: 'Tablica zależności', en: 'Interlocking table' };
export const MATRIX_TITLE: Record<Lang, string> = { pl: 'Macierz konfliktów', en: 'Conflict matrix' };

/** The interlocking table, one row per route (PKP-style headers for `pl`). */
export function buildInterlockingTable(il: Interlocking, lang: Lang = 'en'): Table {
  return {
    title: INTERLOCKING_TITLE[lang],
    columns: INTERLOCKING_COLUMNS[lang],
    rows: il.routes.map((r): CellValue[] => [
      r.id,
      r.entry,
      r.exit,
      r.points.map((p) => formatIlPoints(p, lang)).join(', '),
      formatFlank(r, lang),
      r.sections.join(', '),
      formatOverlap(r, lang),
      conflictsOf(il, r),
      formatAspect(r.aspect, lang),
    ]),
  };
}

/** Diagonal cell of the matrix. */
export const MATRIX_SELF = '×';

/** The conflict matrix as a table: a row per route, a column per route, cells = codes. */
export function buildConflictMatrixTable(il: Interlocking, lang: Lang = 'en'): Table {
  const m = conflictMatrix(il);
  return {
    title: MATRIX_TITLE[lang],
    columns: [lang === 'pl' ? 'Przebieg' : 'Route', ...il.routes.map((r) => r.id)],
    rows: il.routes.map((r, i): CellValue[] => [r.id, ...m[i].map((codes) => (codes === null ? MATRIX_SELF : codes.join(' ')))]),
  };
}

/** Conflicting pairs with the details (shared sections incl. overlap, opposing points, reasons). */
export function buildConflictPairsTable(il: Interlocking, lang: Lang = 'en'): Table {
  return {
    title: lang === 'pl' ? 'Konflikty' : 'Conflicts',
    columns: lang === 'pl' ? ['Przebieg', 'Przebieg wykluczający się', 'Wspólne odcinki', 'Zwrotnice', 'Powód'] : ['Route', 'Conflicting route', 'Shared sections', 'Opposing points', 'Reason'],
    rows: il.conflicts.map((c): CellValue[] => [
      c.a,
      c.b,
      [...c.sharedSections, ...c.overlapSections].join(', '),
      c.points.join(', '),
      c.codes.map((code) => CONFLICT_CODE_LABELS[code][lang]).join(' + '),
    ]),
  };
}

/** The legend of the codes (`S = shared section`, ...). */
export function codeLegend(lang: Lang = 'en'): string {
  return CONFLICT_CODES.map((c) => `${c} = ${CONFLICT_CODE_LABELS[c][lang]}`).join(', ');
}
