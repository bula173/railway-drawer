/**
 * @file etcs-compute.ts
 * @brief The drawing side of the ETCS data (docs/architecture/etcs-data.md), used by the checks
 *        (main chunk; the computed packet values are in etcs-recompute.ts, lazy): the
 *        balise groups with their location reference (the balise with N_PIG 0 = position 1,
 *        else the group symbol), orientation and header context; a walk along the drawn
 *        topology in a packet's direction (preferred path: facing points in their normal
 *        position) in metres (track length / km scale, else the km of both objects on one
 *        track); and from it D_LINK / NID_BG / Q_LINKORIENTATION (packet 5), L_ENDSECTION
 *        (packet 12, to the end of authority at the next main signal), D_GRADIENT / G_A / Q_GDIR
 *        (packet 21, from the tracks' and sections' `rdGradient`) and D_STATIC / V_STATIC
 *        (packet 27, from `rdSpeedLimit` / `rdVmax`). `recomputeGroup` merges them into the data:
 *        values filled from the drawing are marked (`auto`), manually set ones are kept and
 *        reported when they differ (tolerance in metres). Model only.
 */
import type { GraphDataModel } from '@maxgraph/core';
import { parseNumber } from '../catalogue';
import { centerOf } from '../geometry';
import { signalReadsFor } from '../interlocking';
import { applyProjectDefaults, readCountryId } from '../project-settings';
import { readRuleSettings } from '../rule-settings';
import type { TopoLocation, Topology } from '../topology';
import { buildTopology, forwardIsNominal, locateObject, passage } from '../topology';
import type { RailObject } from '../validation';
import { collectObjects } from '../validation';
import type { EtcsGroupContext, EtcsGroupData, EtcsProblem } from './etcs-data';
import { headerDefault, numericValue, readEtcsData } from './etcs-data';

export type Orientation = 'nominal' | 'reverse';

export interface GroupInfo {
  o: RailObject;
  /** Balises of the group (by position). */
  members: RailObject[];
  /** Location reference: the balise with the lowest position, else the group symbol. */
  ref: RailObject;
  loc: TopoLocation | null;
  /** Drawing direction in which N_PIG increases (the group's nominal direction), null: unknown. */
  orientation: Orientation | null;
  ctx: EtcsGroupContext;
  data: EtcsGroupData | null;
  /** Problems of the stored JSON itself (not valid JSON, ...). */
  parseProblems: EtcsProblem[];
}

export interface EtcsEnv {
  objects: RailObject[];
  topo: Topology;
  groups: GroupInfo[];
  /** Groups by cell id. */
  byCell: Map<string, GroupInfo>;
  /** Max distance of a group in rear of "its" signal (rule bg-signal-distance max), metres. */
  bgSignalMax: number;
  /** Tolerance of distance comparisons, metres. */
  tolerance: number;
}

interface Located {
  o: RailObject;
  loc: TopoLocation;
}

/** Longest walk (drawing units). */
const MAX_UNITS = 200_000;
const upper = (s: string | undefined): string => (s ?? '').trim().toUpperCase();
const toInt = (s: string | undefined): number | null => {
  const n = parseNumber(s, 'integer');
  return n !== null && Number.isInteger(n) ? n : null;
};

// ---------------------------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------------------------

function groupOrientation(topo: Topology, g: RailObject, members: Array<{ b: RailObject; pos: number }>): Orientation | null {
  const placed = members
    .map((m) => ({ ...m, c: centerOf(m.b.cell), loc: locateObject(topo, m.b) }))
    .filter((m) => m.c !== null)
    .sort((a, b) => a.pos - b.pos);
  if (placed.length >= 2) {
    const first = placed[0];
    const last = placed[placed.length - 1];
    if (first.loc && last.loc && first.loc.piece === last.loc.piece && Math.abs(last.loc.along - first.loc.along) > 0.5) {
      const forward = last.loc.along > first.loc.along;
      return forwardIsNominal(topo.pieces[first.loc.piece], first.loc.along) === forward ? 'nominal' : 'reverse';
    }
    const dx = last.c!.x - first.c!.x;
    const dy = last.c!.y - first.c!.y;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) return (Math.abs(dx) >= Math.abs(dy) ? dx > 0 : dy > 0) ? 'nominal' : 'reverse';
  }
  const own = (g.values.direction ?? '').trim();
  if (own === 'nominal' || own === 'reverse') return own;
  const dirs = new Set(members.map((m) => (m.b.values.direction ?? '').trim()).filter(Boolean));
  const only = dirs.size === 1 ? [...dirs][0] : '';
  return only === 'nominal' || only === 'reverse' ? only : null;
}

/** The balise groups of the drawing with their ETCS context. `objects` with the diagram defaults applied. */
export function collectGroups(objects: RailObject[], topo: Topology): GroupInfo[] {
  const out: GroupInfo[] = [];
  for (const g of objects) {
    if (g.kind.id !== 'baliseGroup') continue;
    const members = g.id
      ? objects
          .filter((o) => o.kind.id === 'balise' && upper(o.values.groupId) === upper(g.id))
          .map((b, i) => ({ b, pos: toInt(b.values.position) ?? 100 + i }))
          .sort((a, b) => a.pos - b.pos)
      : [];
    const ref = members[0]?.b ?? g;
    const count = toInt(g.values.count);
    const maxPos = members.reduce((m, x) => (x.pos < 100 ? Math.max(m, x.pos) : m), 0);
    const total = Math.max(count ?? 0, members.length, maxPos, 1);
    const parsed = readEtcsData(g.cell);
    out.push({
      o: g,
      members: members.map((m) => m.b),
      ref,
      loc: locateObject(topo, ref) ?? locateObject(topo, g),
      orientation: groupOrientation(topo, g, members),
      ctx: { nidC: toInt(g.values.nidC), nidBg: toInt(g.values.nidBg), nTotal: Math.min(7, total - 1) },
      data: parsed.data,
      parseProblems: parsed.problems,
    });
  }
  return out;
}

export interface EtcsEnvOptions {
  topology?: Topology;
  bgSignalMax?: number;
  tolerance?: number;
}

export function buildEtcsEnv(objects: RailObject[], options: EtcsEnvOptions = {}): EtcsEnv {
  const topo = options.topology ?? buildTopology(objects);
  const groups = collectGroups(objects, topo);
  return {
    objects,
    topo,
    groups,
    byCell: new Map(groups.map((g) => [g.o.cellId, g])),
    bgSignalMax: options.bgSignalMax ?? 50,
    tolerance: options.tolerance ?? 5,
  };
}

/** The environment of a model: objects with the diagram defaults, rule settings' thresholds. */
export function etcsEnvFromModel(model: GraphDataModel): EtcsEnv {
  const objects = applyProjectDefaults(collectObjects(model), readCountryId(model));
  const settings = readRuleSettings(model);
  return buildEtcsEnv(objects, {
    bgSignalMax: Number(settings['bg-signal-distance']?.params.max ?? 50),
    tolerance: Number(settings['etcs-linking-distance']?.params.tolerance ?? 5),
  });
}

/** Header Q_LINK of a group (default linked). */
export function groupLinked(g: GroupInfo): boolean {
  return numericValue(g.data?.header.Q_LINK ?? headerDefault('Q_LINK')) === 1;
}

// ---------------------------------------------------------------------------------------------
// Walk along the drawing
// ---------------------------------------------------------------------------------------------

export interface Segment {
  piece: number;
  forward: boolean;
  from: number;
  to: number;
  /** Metres from the start at `from` / `to` (null: a piece on the way has no scale). */
  startM: number | null;
  endM: number | null;
}

export interface Hit {
  o: RailObject;
  loc: TopoLocation;
  /** Walking forward on the hit's piece. */
  forward: boolean;
  metres: number | null;
}

export interface Scan {
  segments: Segment[];
  hits: Hit[];
  /** Metres of the end of the walk (null: unknown). */
  endM: number | null;
  /** Some piece had no scale. */
  unscaled: boolean;
  /** The walk passed facing points (took their normal position). */
  facingPoints: string[];
}

function locatedObjects(env: EtcsEnv): Map<number, Located[]> {
  const on = new Map<number, Located[]>();
  for (const o of env.objects) {
    if (!['signal', 'balise', 'baliseGroup'].includes(o.kind.id)) continue;
    const loc = locateObject(env.topo, o);
    if (!loc) continue;
    const list = on.get(loc.piece) ?? [];
    list.push({ o, loc });
    on.set(loc.piece, list);
  }
  return on;
}

const onCache = new WeakMap<EtcsEnv, Map<number, Located[]>>();

/**
 * Walks from `start` in travel direction `forward` (on the start piece) along the preferred path
 * (facing points: normal leg) until `stop(hit)` or the end of the track (or MAX_UNITS).
 */
export function scanAhead(env: EtcsEnv, start: Located, forward: boolean, stop: (h: Hit) => boolean): Scan {
  let on = onCache.get(env);
  if (!on) onCache.set(env, (on = locatedObjects(env)));
  const topo = env.topo;
  const segments: Segment[] = [];
  const hits: Hit[] = [];
  const facingPoints: string[] = [];
  let piece = start.loc.piece;
  let fwd = forward;
  let enter = start.loc.along;
  let metres: number | null = 0;
  let units = 0;
  let unscaled = false;
  let first = true;
  const used = new Set<number>();
  const kmOf = (o: RailObject): number | null => parseNumber(o.values.km, 'km');
  const startKm = kmOf(start.o);
  for (;;) {
    used.add(piece);
    const p = topo.pieces[piece];
    const scale = p.metresPerUnit;
    if (scale === null) unscaled = true;
    const leave = fwd ? p.length : 0;
    const seg: Segment = { piece, forward: fwd, from: enter, to: leave, startM: metres, endM: metres === null || scale === null ? null : metres + Math.abs(leave - enter) * scale };
    segments.push(seg);
    const ahead = (on.get(piece) ?? [])
      .filter((x) => x.o !== start.o && (fwd ? x.loc.along > enter + (first ? 0.5 : -0.5) : x.loc.along < enter - (first ? 0.5 : -0.5)))
      .sort((a, b) => (fwd ? a.loc.along - b.loc.along : b.loc.along - a.loc.along));
    for (const x of ahead) {
      const d = Math.abs(x.loc.along - enter);
      let m = seg.startM === null || scale === null ? null : seg.startM + d * scale;
      if (m === null) {
        const a = startKm;
        const b = kmOf(x.o);
        if (a !== null && b !== null && upper(start.o.values.trackId) !== '' && upper(start.o.values.trackId) === upper(x.o.values.trackId)) m = Math.abs(b - a) * 1000;
      }
      const h: Hit = { o: x.o, loc: x.loc, forward: fwd, metres: m };
      hits.push(h);
      if (stop(h)) {
        seg.to = x.loc.along;
        seg.endM = m;
        return { segments, hits, endM: m, unscaled, facingPoints };
      }
    }
    units += Math.abs(leave - enter);
    metres = seg.endM;
    first = false;
    const nodeId = fwd ? p.b : p.a;
    const options = units > MAX_UNITS ? [] : topo.nodes[nodeId].pieces.filter((q) => !used.has(q)).map((q) => ({ q, pass: passage(topo, nodeId, piece, q) })).filter((x) => x.pass.ok);
    if (options.length === 0) return { segments, hits, endM: metres, unscaled, facingPoints };
    let next = options[0];
    if (options.length > 1) {
      next = options.find((x) => x.pass.position === 'normal') ?? options[0];
      const j = next.pass.points;
      if (j && j.pointsId) facingPoints.push(j.pointsId);
    }
    const qp = topo.pieces[next.q];
    fwd = qp.a === nodeId;
    enter = fwd ? 0 : qp.length;
    piece = next.q;
  }
}

/** Travel direction on the group's piece for a packet direction (Q_DIR 1 nominal / 0 reverse of the group). */
export function travelForward(env: EtcsEnv, g: GroupInfo, qDir: number): boolean | null {
  if (!g.loc || g.orientation === null || (qDir !== 0 && qDir !== 1)) return null;
  const nominalForward = forwardIsNominal(env.topo.pieces[g.loc.piece], g.loc.along);
  const groupForward = g.orientation === 'nominal' ? nominalForward : !nominalForward;
  return qDir === 1 ? groupForward : !groupForward;
}

const isMainSignal = (o: RailObject): boolean => o.kind.id === 'signal' && ['main', ''].includes((o.values.signalType ?? '').trim());

export interface AheadResult {
  scan: Scan;
  /** Groups ahead (first hit of their location reference), in order, own group excluded. */
  groups: Array<{ g: GroupInfo; metres: number | null; travelNominal: boolean }>;
  /** Main signals reading for the travel. */
  signals: Array<{ o: RailObject; metres: number | null }>;
  /** End of authority (main signal) and its distance. */
  eoa: { o: RailObject; metres: number | null } | null;
  /** Distance of the end of the profiles (the stop of the walk). */
  horizonM: number | null;
}

/** Walks from group `g` for packet direction `qDir` to the second main signal reading for the travel. */
export function lookAhead(env: EtcsEnv, g: GroupInfo, qDir: number): AheadResult | null {
  const forward = travelForward(env, g, qDir);
  if (forward === null || !g.loc) return null;
  let mains = 0;
  const signals: AheadResult['signals'] = [];
  const scan = scanAhead(env, { o: g.ref, loc: g.loc }, forward, (h) => {
    if (isMainSignal(h.o) && signalReadsFor(env.topo, h.o, h.loc, h.forward)) {
      signals.push({ o: h.o, metres: h.metres });
      mains++;
    }
    return mains >= 2;
  });
  const own = new Set([g.o.cellId, ...g.members.map((m) => m.cellId)]);
  const seen = new Set<string>();
  const groups: AheadResult['groups'] = [];
  for (const h of scan.hits) {
    if (own.has(h.o.cellId)) continue;
    const target = env.groups.find((x) => x.ref.cellId === h.o.cellId);
    if (!target || seen.has(target.o.cellId)) continue;
    seen.add(target.o.cellId);
    const travelNominal = forwardIsNominal(env.topo.pieces[h.loc.piece], h.loc.along) === h.forward;
    groups.push({ g: target, metres: h.metres, travelNominal });
  }
  let eoa: AheadResult['eoa'] = null;
  if (signals.length > 0) {
    const firstSig = signals[0];
    eoa = firstSig.metres !== null && firstSig.metres <= env.bgSignalMax + 1e-6 ? signals[1] ?? null : firstSig;
  }
  return { scan, groups, signals, eoa, horizonM: scan.endM };
}

/** Groups ahead without the signal limit (for following a stored linking list), up to 32. */
export function lookAheadAll(env: EtcsEnv, g: GroupInfo, qDir: number): AheadResult['groups'] {
  const forward = travelForward(env, g, qDir);
  if (forward === null || !g.loc) return [];
  let n = 0;
  const scan = scanAhead(env, { o: g.ref, loc: g.loc }, forward, (h) => env.groups.some((x) => x.ref.cellId === h.o.cellId) && ++n >= 32);
  const out: AheadResult['groups'] = [];
  for (const h of scan.hits) {
    const target = env.groups.find((x) => x.ref.cellId === h.o.cellId);
    if (!target || target === g) continue;
    out.push({ g: target, metres: h.metres, travelNominal: forwardIsNominal(env.topo.pieces[h.loc.piece], h.loc.along) === h.forward });
  }
  return out;
}

