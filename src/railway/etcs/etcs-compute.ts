/**
 * @file etcs-compute.ts
 * @brief ETCS packet values computed from the drawing (docs/architecture/etcs-data.md): the
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
import { readAttr } from '../object-data';
import { applyProjectDefaults, readCountryId } from '../project-settings';
import { readRuleSettings } from '../rule-settings';
import type { TopoLocation, Topology } from '../topology';
import { buildTopology, forwardIsNominal, locateObject, passage } from '../topology';
import type { RailObject } from '../validation';
import { collectObjects } from '../validation';
import type { EtcsBlock, EtcsGroupContext, EtcsGroupData, EtcsPacket, EtcsValue } from './etcs-data';
import { cloneEtcsData, headerDefault, newIterEntry, numericValue, readEtcsData, scaleResolution } from './etcs-data';
import type { EtcsProblem } from './etcs-data';
import { DIST_MAX_RAW, VARS, getPacketDef, pathMatches } from './etcs-schema';

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

/** Speed limit attributes (km/h) of tracks, sections, points (also the train run). */
export const SPEED_ATTRS = ['rdSpeedLimit', 'rdVmax'] as const;
export const GRADIENT_ATTR = 'rdGradient';
/** Longest walk (drawing units) and most linked groups filled in automatically. */
const MAX_UNITS = 200_000;
export const MAX_AUTO_LINKS = 8;
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

// ---------------------------------------------------------------------------------------------
// Profiles along the scan
// ---------------------------------------------------------------------------------------------

interface ProfileStep {
  atM: number;
  value: number | null;
}

/** Gradient text of a track/section: `+3.5` (whole piece) or `12.000:+3.5; 12+450:-2` (from km on). */
export function parseGradientSpec(text: string): { constant: number | null; steps: Array<{ km: number; value: number }>; invalid: string[] } {
  const t = text.trim();
  const out = { constant: null as number | null, steps: [] as Array<{ km: number; value: number }>, invalid: [] as string[] };
  if (!t) return out;
  const single = parseNumber(t, 'number');
  if (single !== null) {
    out.constant = single;
    return out;
  }
  for (const part of t.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(.+?):(.+)$/.exec(part);
    const km = m ? parseNumber(m[1], 'km') : null;
    const value = m ? parseNumber(m[2], 'number') : null;
    if (km === null || value === null) out.invalid.push(part);
    else out.steps.push({ km, value });
  }
  out.steps.sort((a, b) => a.km - b.km);
  return out;
}

function objectById(env: EtcsEnv, kind: string, id: string): RailObject | undefined {
  const key = upper(id);
  return key ? env.objects.find((o) => o.kind.id === kind && upper(o.id) === key) : undefined;
}

function speedOf(o: RailObject | undefined): number | null {
  if (!o) return null;
  for (const attr of SPEED_ATTRS) {
    const v = parseNumber(readAttr(o.cell, attr), 'number');
    if (v !== null && v > 0) return v;
  }
  return null;
}

/** Speed limit of a piece: its points leg / section / track (first one set). */
function pieceSpeed(env: EtcsEnv, piece: number): number | null {
  const p = env.topo.pieces[piece];
  if (p.pointsId) {
    const v = speedOf(objectById(env, 'points', p.pointsId));
    if (v !== null) return v;
  }
  return speedOf(objectById(env, 'trackSection', p.sectionId)) ?? speedOf(objectById(env, 'track', p.trackId));
}

/** Gradient (‰, + = rising in the nominal direction) along a segment: steps relative to the segment start. */
function segmentGradient(env: EtcsEnv, seg: Segment): Array<{ at: number; value: number | null }> {
  const p = env.topo.pieces[seg.piece];
  const section = objectById(env, 'trackSection', p.sectionId);
  const own = section ? parseGradientSpec(readAttr(section.cell, GRADIENT_ATTR)) : null;
  if (own && own.constant !== null) return [{ at: 0, value: own.constant }];
  const track = objectById(env, 'track', p.trackId) ?? (p.linkKind === 'track' ? env.objects.find((o) => o.cellId === p.linkCellId) : undefined);
  const spec = track ? parseGradientSpec(readAttr(track.cell, GRADIENT_ATTR)) : null;
  if (!spec) return [{ at: 0, value: null }];
  if (spec.constant !== null) return [{ at: 0, value: spec.constant }];
  if (spec.steps.length === 0 || !track) return [{ at: 0, value: null }];
  const kmStart = parseNumber(track.values.kmStart, 'km');
  const kmEnd = parseNumber(track.values.kmEnd, 'km');
  if (kmStart === null || kmEnd === null || kmStart === kmEnd) return [{ at: 0, value: null }];
  // km is linear along the track line; the piece is part of it
  const lineLen = env.topo.pieces.filter((x) => x.linkCellId === p.linkCellId).reduce((s, x) => s + x.length, 0);
  const pieceOffset = env.topo.pieces.filter((x) => x.linkCellId === p.linkCellId && x.id < p.id).reduce((s, x) => s + x.length, 0);
  if (p.linkKind !== 'track' || lineLen <= 0) return [{ at: 0, value: null }];
  const kmAt = (along: number): number => kmStart + ((kmEnd - kmStart) * (pieceOffset + along)) / lineLen;
  const valueAt = (km: number): number | null => {
    let v: number | null = null;
    for (const s of spec.steps) if (s.km <= km + 1e-9) v = s.value;
    return v;
  };
  const kmA = kmAt(seg.from);
  const kmB = kmAt(seg.to);
  const out: Array<{ at: number; value: number | null }> = [{ at: 0, value: valueAt(kmA) }];
  const lo = Math.min(kmA, kmB);
  const hi = Math.max(kmA, kmB);
  const inside = spec.steps.filter((s) => s.km > lo + 1e-9 && s.km < hi - 1e-9);
  const ordered = kmB >= kmA ? inside : [...inside].reverse();
  for (const s of ordered) {
    const frac = (s.km - kmA) / (kmB - kmA);
    // walking against increasing km, the value beyond the step (in travel) is the one before it in km
    const value = kmB >= kmA ? s.value : valueAt(s.km - 1e-6);
    out.push({ at: frac * Math.abs(seg.to - seg.from), value });
  }
  return out;
}

/** Piecewise constant profile along the scan (changes only), up to `horizon` metres. */
function profileAlong(env: EtcsEnv, scan: Scan, horizon: number, valueOf: (seg: Segment) => Array<{ at: number; value: number | null }>, sign: (seg: Segment) => number): ProfileStep[] {
  const out: ProfileStep[] = [];
  for (const seg of scan.segments) {
    if (seg.startM === null || seg.endM === null) break;
    const scale = env.topo.pieces[seg.piece].metresPerUnit ?? 0;
    for (const s of valueOf(seg)) {
      const atM = seg.startM + s.at * scale;
      if (atM >= horizon - 1e-6) break;
      const value = s.value === null ? null : s.value * sign(seg);
      if (out.length === 0 || out[out.length - 1].value !== value) out.push({ atM, value });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Computed packet values
// ---------------------------------------------------------------------------------------------

export interface PacketComputation {
  /** Computed values of the packet (top-level variables and iteration arrays). */
  vars: EtcsBlock;
  notes: string[];
}

const roundTo = (m: number, res: number): number => Math.round(Math.round(m / res) * res * 10) / 10;

/** Q_SCALE that fits `maxMetres` (at least `current`). */
function scaleFor(maxMetres: number, current: number): number {
  for (let q = Math.max(0, current); q <= 2; q++) if (Math.round(maxMetres / scaleResolution(q)) <= DIST_MAX_RAW) return q;
  return 2;
}

function noMetres(name: string): string {
  return `${name}: no metres in the drawing (set the tracks' length or km start/end)`;
}

function linkEntry(from: GroupInfo, to: { g: GroupInfo; travelNominal: boolean }, dLink: number): EtcsBlock {
  const block: EtcsBlock = { D_LINK: dLink };
  const sameCountry = to.g.ctx.nidC === null || from.ctx.nidC === null || to.g.ctx.nidC === from.ctx.nidC;
  block.Q_NEWCOUNTRY = sameCountry ? 0 : 1;
  if (!sameCountry) block.NID_C = to.g.ctx.nidC!;
  if (to.g.ctx.nidBg !== null) block.NID_BG = to.g.ctx.nidBg;
  if (to.g.orientation !== null) block.Q_LINKORIENTATION = (to.g.orientation === 'nominal') === to.travelNominal ? 1 : 0;
  return block;
}

/**
 * Computed values of `packet` of group `g` (null: the packet has none). Linking follows the
 * stored NID_BG list when `followStored` is given (the user's own linking), else the groups ahead.
 */
export function computePacket(env: EtcsEnv, g: GroupInfo, packet: EtcsPacket, followStored?: number[]): PacketComputation | null {
  const def = getPacketDef(packet.nid);
  if (!def?.computed) return null;
  const qDir = numericValue(packet.vars.Q_DIR as EtcsValue) ?? 1;
  const name = `Packet ${packet.nid}`;
  if (qDir === 2) return { vars: {}, notes: [`${name}: Q_DIR "both directions": distances depend on the direction, use one packet per direction`] };
  if (!g.loc) return { vars: {}, notes: [`${name}: the group does not lie on a track of the drawing`] };
  if (g.orientation === null) return { vars: {}, notes: [`${name}: the group has no direction (set its direction or the positions of two balises)`] };
  const ahead = lookAhead(env, g, qDir);
  if (!ahead) return { vars: {}, notes: [`${name}: no walk along the drawing`] };
  const notes: string[] = [];
  const qScale = numericValue(packet.vars.Q_SCALE as EtcsValue) ?? 1;
  if (ahead.scan.facingPoints.length > 0) notes.push(`${name}: facing points ${[...new Set(ahead.scan.facingPoints)].join(', ')} taken in the normal position`);
  const vars: EtcsBlock = {};
  let maxM = 0;
  const res = (): number => scaleResolution(vars.Q_SCALE !== undefined ? Number(vars.Q_SCALE) : qScale);

  if (packet.nid === 5) {
    let targets = ahead.groups.filter((x) => groupLinked(x.g));
    if (followStored && followStored.length > 0) {
      const all = lookAheadAll(env, g, qDir);
      const picked: typeof targets = [];
      for (const nidBg of followStored) {
        const t = all.find((x) => x.g.ctx.nidBg === nidBg && !picked.includes(x));
        if (!t) {
          notes.push(`${name}: linked group NID_BG ${nidBg} is not ahead in the drawing`);
          break;
        }
        picked.push(t);
      }
      targets = picked;
    } else targets = targets.slice(0, MAX_AUTO_LINKS);
    if (targets.length === 0) {
      notes.push(`${name}: no linked balise group ahead (up to the second main signal)`);
      return { vars, notes };
    }
    if (targets.some((t) => t.metres === null)) {
      notes.push(noMetres(name));
      return { vars, notes };
    }
    maxM = Math.max(...targets.map((t, i) => t.metres! - (i > 0 ? targets[i - 1].metres! : 0)));
    const q = scaleFor(maxM, qScale);
    if (q !== qScale) {
      vars.Q_SCALE = q;
      notes.push(`${name}: Q_SCALE ${q} (10 cm / 1 m / 10 m) so that ${Math.round(maxM)} m fits 15 bits`);
    }
    const entries = targets.map((t, i) => {
      const d = roundTo(t.metres! - (i > 0 ? targets[i - 1].metres! : 0), res());
      if (t.g.ctx.nidBg === null) notes.push(`${name}: group ${t.g.o.id || '(no ID)'} has no NID_BG`);
      return linkEntry(g, t, d);
    });
    Object.assign(vars, entries[0]);
    vars.links = entries.slice(1);
    return { vars, notes };
  }

  if (packet.nid === 12) {
    if (!ahead.eoa) {
      notes.push(`${name}: no main signal ahead for the end of authority`);
      return { vars, notes };
    }
    if (ahead.eoa.metres === null) {
      notes.push(noMetres(name));
      return { vars, notes };
    }
    const sections = Array.isArray(packet.vars.sections) ? (packet.vars.sections as EtcsBlock[]) : [];
    const before = sections.reduce((s, x) => s + (numericValue(x.L_SECTION as EtcsValue) ?? 0), 0);
    const length = ahead.eoa.metres - before;
    if (length <= 0) {
      notes.push(`${name}: the sections (${before} m) already reach the end of authority at ${ahead.eoa.o.id} (${Math.round(ahead.eoa.metres)} m)`);
      return { vars, notes };
    }
    const q = scaleFor(length, qScale);
    if (q !== qScale) vars.Q_SCALE = q;
    vars.L_ENDSECTION = roundTo(length, res());
    notes.push(`${name}: end of authority at signal ${ahead.eoa.o.id || '(no ID)'} (${Math.round(ahead.eoa.metres)} m)`);
    return { vars, notes };
  }

  const horizon = ahead.horizonM;
  if (horizon === null || ahead.scan.segments[0]?.startM === null) {
    notes.push(noMetres(name));
    return { vars, notes };
  }

  if (packet.nid === 21 || packet.nid === 27) {
    const steps =
      packet.nid === 21
        ? profileAlong(env, ahead.scan, horizon, (seg) => segmentGradient(env, seg), (seg) => (forwardIsNominal(env.topo.pieces[seg.piece], (seg.from + seg.to) / 2) === seg.forward ? 1 : -1))
        : profileAlong(env, ahead.scan, horizon, (seg) => [{ at: 0, value: pieceSpeed(env, seg.piece) }], () => 1);
    // the profile ends where the data ends
    const known: ProfileStep[] = [];
    for (const s of steps) {
      if (s.value === null) break;
      known.push(s);
    }
    if (known.length === 0 || known[0].atM > 0.5) {
      notes.push(packet.nid === 21 ? `${name}: no gradient (rdGradient) on the track / section at the group` : `${name}: no speed limit (rdSpeedLimit) on the track / section at the group`);
      return { vars, notes };
    }
    const endM = steps.length > known.length ? steps[known.length].atM : horizon;
    maxM = Math.max(...known.map((s, i) => s.atM - (i > 0 ? known[i - 1].atM : 0)), endM - known[known.length - 1].atM);
    const q = scaleFor(maxM, qScale);
    if (q !== qScale) vars.Q_SCALE = q;
    const blocks: EtcsBlock[] = known.map((s, i) => {
      const d = roundTo(s.atM - (i > 0 ? known[i - 1].atM : 0), res());
      if (packet.nid === 21) {
        const up = s.value! >= 0;
        // the safe side: uphill rounded down, downhill rounded up
        return { D_GRADIENT: d, Q_GDIR: up ? 1 : 0, G_A: up ? Math.floor(s.value! + 1e-9) : Math.ceil(Math.abs(s.value!) - 1e-9) };
      }
      return { D_STATIC: d, V_STATIC: Math.floor(s.value! / 5 + 1e-9) * 5 };
    });
    const endD = roundTo(endM - known[known.length - 1].atM, res());
    blocks.push(packet.nid === 21 ? { D_GRADIENT: endD, Q_GDIR: 1, G_A: 'end' } : { D_STATIC: endD, V_STATIC: 'end' });
    Object.assign(vars, blocks[0]);
    vars.steps = blocks.slice(1);
    notes.push(`${name}: profile over ${Math.round(endM)} m (to ${steps.length > known.length ? 'the end of the data' : 'the end of the walk'})`);
    return { vars, notes };
  }
  return null;
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

// ---------------------------------------------------------------------------------------------
// Merging into the data
// ---------------------------------------------------------------------------------------------

export interface Mismatch {
  packet: number;
  nid: number;
  path: string;
  stored: EtcsValue;
  computed: EtcsValue;
  message: string;
}

export interface RecomputeResult {
  data: EtcsGroupData;
  /** Packet index -> paths filled from the drawing. */
  filled: Array<{ packet: number; path: string }>;
  mismatches: Mismatch[];
  notes: string[];
}

function leaves(block: EtcsBlock, prefix = ''): Array<{ path: string; value: EtcsValue }> {
  const out: Array<{ path: string; value: EtcsValue }> = [];
  for (const [k, v] of Object.entries(block)) {
    if (Array.isArray(v)) v.forEach((e, i) => out.push(...leaves(e, `${prefix}${k}.${i}.`)));
    else if (v !== undefined) out.push({ path: prefix + k, value: v });
  }
  return out;
}

export function getPath(block: EtcsBlock, path: string): EtcsValue | undefined {
  let cur: unknown = block;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur) ? cur[Number(part)] : (cur as EtcsBlock)[part];
  }
  return typeof cur === 'number' || typeof cur === 'string' ? cur : undefined;
}

export function setPath(block: EtcsBlock, path: string, value: EtcsValue | undefined): void {
  const parts = path.split('.');
  let cur: EtcsBlock = block;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const next = parts[i + 1];
    if (/^\d+$/.test(next)) {
      const arr = (Array.isArray(cur[k]) ? cur[k] : (cur[k] = [])) as EtcsBlock[];
      const idx = Number(next);
      while (arr.length <= idx) arr.push({});
      cur = arr[idx];
      i++;
    } else {
      // blocks only nest through iteration arrays
      return;
    }
  }
  const last = parts[parts.length - 1];
  if (value === undefined) delete cur[last];
  else cur[last] = value;
}

function isComputedPath(nid: number, path: string): boolean {
  return (getPacketDef(nid)?.computed ?? []).some((p) => pathMatches(p, path));
}

function differs(path: string, a: EtcsValue, b: EtcsValue, tolerance: number): boolean {
  const name = path.split('.').pop()!;
  const na = numericValue(a);
  const nb = numericValue(b);
  if (na === null || nb === null) return String(a) !== String(b);
  return VARS[name]?.kind === 'dist' ? Math.abs(na - nb) > tolerance + 1e-6 : na !== nb;
}

/**
 * Fills the computed values of every packet of group `g` into a copy of `data`: values that are
 * missing or were filled before (`auto`) take the drawing's value; manually set ones stay and are
 * reported when they differ (distances: more than the tolerance). Iterations are replaced as a
 * whole when none of their computed values was set by hand.
 */
export function recomputeGroup(env: EtcsEnv, g: GroupInfo, data: EtcsGroupData): RecomputeResult {
  const out = cloneEtcsData(data);
  const filled: RecomputeResult['filled'] = [];
  const mismatches: Mismatch[] = [];
  const notes: string[] = [];
  out.packets.forEach((p, index) => {
    const auto = new Set(p.auto ?? []);
    const storedComputed = leaves(p.vars).filter((l) => isComputedPath(p.nid, l.path));
    // set by hand = not filled from the drawing and not the schema default of a new packet / entry
    const manual = storedComputed.filter((l) => !auto.has(l.path) && VARS[l.path.split('.').pop()!]?.def !== l.value);
    let follow: number[] | undefined;
    if (p.nid === 5 && manual.length > 0) {
      follow = [numericValue(p.vars.NID_BG as EtcsValue), ...(Array.isArray(p.vars.links) ? (p.vars.links as EtcsBlock[]) : []).map((e) => numericValue(e.NID_BG as EtcsValue))].filter((x): x is number => x !== null);
    }
    const comp = computePacket(env, g, p, follow);
    if (!comp) return;
    notes.push(...comp.notes);
    if (Object.keys(comp.vars).length === 0) return;
    if (comp.vars.Q_SCALE !== undefined && comp.vars.Q_SCALE !== p.vars.Q_SCALE) {
      p.vars.Q_SCALE = comp.vars.Q_SCALE;
      filled.push({ packet: index, path: 'Q_SCALE' });
    }
    const iterKeys = Object.entries(comp.vars).filter(([, v]) => Array.isArray(v)).map(([k]) => k);
    for (const key of iterKeys) {
      const computedEntries = comp.vars[key] as EtcsBlock[];
      const handSet = manual.some((l) => l.path.startsWith(`${key}.`)) || (manual.length > 0 && p.nid === 5);
      const stored = Array.isArray(p.vars[key]) ? (p.vars[key] as EtcsBlock[]) : [];
      if (!handSet && stored.length !== computedEntries.length) {
        // rebuild the list: keep the other values of existing entries, defaults for new ones
        const next = computedEntries.map((_, i) => ({ ...(stored[i] ?? newIterEntry(p.nid, key)) }));
        p.vars[key] = next;
        for (const a of [...auto]) if (a.startsWith(`${key}.`) && Number(a.split('.')[1]) >= next.length) auto.delete(a);
      } else if (handSet && stored.length !== computedEntries.length) {
        mismatches.push({
          packet: index,
          nid: p.nid,
          path: key,
          stored: stored.length,
          computed: computedEntries.length,
          message: `Packet ${p.nid}: ${key} has ${stored.length} entr${stored.length === 1 ? 'y' : 'ies'}, the drawing gives ${computedEntries.length}`,
        });
      }
    }
    for (const leaf of leaves(comp.vars)) {
      if (leaf.path === 'Q_SCALE') continue;
      const parts = leaf.path.split('.');
      if (parts.length > 1 && Array.isArray(p.vars[parts[0]]) && Number(parts[1]) >= (p.vars[parts[0]] as EtcsBlock[]).length) continue;
      const stored = getPath(p.vars, leaf.path);
      if (stored === undefined || stored === '' || auto.has(leaf.path)) {
        setPath(p.vars, leaf.path, leaf.value);
        auto.add(leaf.path);
        filled.push({ packet: index, path: leaf.path });
      } else if (differs(leaf.path, stored, leaf.value, env.tolerance)) {
        mismatches.push({
          packet: index,
          nid: p.nid,
          path: leaf.path,
          stored,
          computed: leaf.value,
          message: `Packet ${p.nid} ${leaf.path}: ${String(stored)} set by hand, the drawing gives ${String(leaf.value)}`,
        });
      }
    }
    // a value filled before that the drawing no longer gives (e.g. NID_C of a group now in the same country)
    const given = new Set(leaves(comp.vars).map((l) => l.path));
    for (const a of [...auto]) {
      if (!given.has(a) && isComputedPath(p.nid, a) && a !== 'Q_SCALE') {
        setPath(p.vars, a, undefined);
        auto.delete(a);
      }
    }
    p.auto = [...auto].sort();
  });
  return { data: out, filled, mismatches, notes };
}
