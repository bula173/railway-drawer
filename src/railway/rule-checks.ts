/**
 * @file rule-checks.ts
 * @brief Configurable engineering rules of the railway checks (Checks panel), with per-diagram
 *        thresholds (rule-settings.ts, Railway > Rule settings…; defaults and rationale in
 *        docs/architecture/rules.md). Model only: distances along the drawn topology (topology.ts)
 *        in metres from the tracks' length / km start-end; where a stretch has no scale, the
 *        objects' km (same track) are used; without either the rule skips the object and says so
 *        in a note (info, not an issue).
 *
 * "Main signal" = signal type main or no type; a signal needs its direction for every rule that
 * looks along the track. Walks follow every branch (points in both positions, no turns over 90°).
 */
import { parseNumber } from './catalogue';
import type { Pt } from './geometry';
import { centerOf } from './geometry';
import type { Interlocking } from './interlocking';
import { computeInterlocking, signalReadsFor } from './interlocking';
import type { RuleConfig, RuleSetId, RuleSettings } from './rule-settings';
import { defaultRuleSettings, getRuleDef } from './rule-settings';
import type { Topology, TopoLocation } from './topology';
import { buildTopology, directionAt, forwardIsNominal, locateObject, passage } from './topology';
import type { Issue, RailObject } from './validation';
import { checkEtcsRules } from './etcs/etcs-checks';

export interface RuleNote {
  rule: RuleSetId;
  message: string;
}

export interface RuleCheckResult {
  issues: Issue[];
  notes: RuleNote[];
}

interface Located {
  o: RailObject;
  loc: TopoLocation;
}

interface Hit extends Located {
  /** Walking forward (increasing along) on the hit's piece. */
  forward: boolean;
  units: number;
  /** null when a piece on the way has no scale. */
  metres: number | null;
}

interface Branch {
  hits: Hit[];
  pieces: number[];
  /** The hit the branch stopped at (null: track end or limit). */
  end: Hit | null;
}

const EPS = 0.5;
const MAX_UNITS = 100_000;
const DETECTION_KINDS = new Set(['axleCounter', 'insulatedJoint']);
const upper = (s: string): string => (s ?? '').trim().toUpperCase();
const fmt = (m: number): string => `${Math.round(m * 10) / 10} m`;

export function isMainSignal(o: RailObject): boolean {
  const t = (o.values.signalType ?? '').trim();
  return o.kind.id === 'signal' && (t === 'main' || t === '');
}

function hasDirection(o: RailObject): boolean {
  const d = (o.values.direction ?? '').trim();
  return d === 'nominal' || d === 'reverse';
}

/** Forward flag of travel in the signal's direction at its location (null without direction). */
function signalForward(topo: Topology, s: Located): boolean | null {
  const d = (s.o.values.direction ?? '').trim();
  if (d !== 'nominal' && d !== 'reverse') return null;
  const nominalForward = forwardIsNominal(topo.pieces[s.loc.piece], s.loc.along);
  return d === 'nominal' ? nominalForward : !nominalForward;
}

/** All branches from `start` walking `forward`, until `stop` says so, a track end or the limit. */
function walk(topo: Topology, on: Map<number, Located[]>, start: Located, forward: boolean, stop: (h: Hit) => boolean): Branch[] {
  const out: Branch[] = [];
  let budget = 5000;
  const visit = (piece: number, fwd: boolean, enter: number, first: boolean, units: number, metres: number | null, hits: Hit[], pieces: number[], used: Set<number>): void => {
    if (--budget < 0 || out.length > 64) return;
    const p = topo.pieces[piece];
    const scale = p.metresPerUnit;
    const ahead = (on.get(piece) ?? [])
      .filter((x) => x.o !== start.o && (fwd ? x.loc.along > enter + (first ? EPS : -EPS) : x.loc.along < enter - (first ? EPS : -EPS)))
      .sort((a, b) => (fwd ? a.loc.along - b.loc.along : b.loc.along - a.loc.along));
    const route = [...pieces, piece];
    for (const x of ahead) {
      const d = Math.abs(x.loc.along - enter);
      const h: Hit = { ...x, forward: fwd, units: units + d, metres: metres === null || scale === null ? null : metres + d * scale };
      hits.push(h);
      if (stop(h)) {
        out.push({ hits, pieces: route, end: h });
        return;
      }
    }
    const leave = fwd ? p.length : 0;
    const len = Math.abs(leave - enter);
    const u = units + len;
    const m = metres === null || scale === null ? null : metres + len * scale;
    const nodeId = fwd ? p.b : p.a;
    const next = u > MAX_UNITS ? [] : topo.nodes[nodeId].pieces.filter((q) => !used.has(q) && passage(topo, nodeId, piece, q).ok);
    if (next.length === 0) {
      out.push({ hits, pieces: route, end: null });
      return;
    }
    for (const q of next) {
      const qp = topo.pieces[q];
      const qf = qp.a === nodeId;
      used.add(q);
      visit(q, qf, qf ? 0 : qp.length, false, u, m, [...hits], route, used);
      used.delete(q);
    }
  };
  visit(start.loc.piece, forward, start.loc.along, true, 0, 0, [], [], new Set([start.loc.piece]));
  return out;
}

/** Metres of a hit from the walk start: along the topology, else from the km of both objects (same track). */
function metresOf(h: Hit, from: RailObject): number | null {
  if (h.metres !== null) return h.metres;
  const a = parseNumber(from.values.km, 'km');
  const b = parseNumber(h.o.values.km, 'km');
  if (a === null || b === null) return null;
  if (upper(from.values.trackId ?? '') !== upper(h.o.values.trackId ?? '')) return null;
  return Math.abs(a - b) * 1000;
}

/** Signal `h.o` reads for the travel of a train moving `travelForward` on its piece. */
function readsTravel(topo: Topology, h: Located, travelForward: boolean): boolean {
  return h.o.kind.id === 'signal' && signalReadsFor(topo, h.o, h.loc, travelForward);
}

export interface RuleCheckOptions {
  topology?: Topology;
  interlocking?: Interlocking;
}

/** Runs the enabled rules. */
export function checkRules(objects: RailObject[], settings: RuleSettings = defaultRuleSettings(), options: RuleCheckOptions = {}): RuleCheckResult {
  const issues: Issue[] = [];
  const notes: RuleNote[] = [];
  const enabled = (id: RuleSetId): RuleConfig | null => (settings[id]?.enabled ? settings[id] : null);
  if (!Object.values(settings).some((c) => c.enabled)) return { issues, notes };
  let topoCache: Topology | null = options.topology ?? null;
  const topo = (): Topology => (topoCache ??= buildTopology(objects));
  let ilCache: Interlocking | null = options.interlocking ?? null;
  const il = (): Interlocking => (ilCache ??= computeInterlocking(objects, topo(), { conflicts: false }));

  let locatedCache: Located[] | null = null;
  const located = (): Located[] => {
    if (locatedCache) return locatedCache;
    locatedCache = [];
    for (const o of objects) {
      if (!['signal', 'balise', 'baliseGroup', 'axleCounter', 'insulatedJoint'].includes(o.kind.id)) continue;
      const loc = locateObject(topo(), o);
      if (loc) locatedCache.push({ o, loc });
    }
    return locatedCache;
  };
  let onCache: Map<number, Located[]> | null = null;
  const on = (): Map<number, Located[]> => {
    if (onCache) return onCache;
    onCache = new Map();
    for (const x of located()) {
      const list = onCache.get(x.loc.piece) ?? [];
      list.push(x);
      onCache.set(x.loc.piece, list);
    }
    return onCache;
  };
  const signals = (filter: (o: RailObject) => boolean): Array<Located & { forward: boolean }> =>
    located()
      .filter((x) => x.o.kind.id === 'signal' && filter(x.o))
      .map((x) => ({ ...x, forward: signalForward(topo(), x) }))
      .filter((x): x is Located & { forward: boolean } => x.forward !== null);

  const push = (id: RuleSetId, o: RailObject | { cellId: string; kind?: RailObject['kind']; id?: string }, message: string, field?: string, related: RailObject[] = []): void => {
    const c = settings[id];
    const obj = o as RailObject;
    issues.push({
      severity: c.severity,
      rule: id,
      message,
      cellId: obj.cellId,
      kind: obj.kind?.id,
      objectId: obj.id || undefined,
      field,
      ...(related.length > 0 ? { related: related.map((r) => ({ cellId: r.cellId, label: r.id || r.kind.label })) } : {}),
    });
  };
  const label = (id: RuleSetId): string => getRuleDef(id)!.label.en;
  const noteSkipped = (id: RuleSetId, ids: string[], why: string): void => {
    if (ids.length > 0) notes.push({ rule: id, message: `${label(id)}: skipped for ${[...new Set(ids)].join(', ')} (${why})` });
  };
  const NO_SCALE = 'no km or track length to measure metres: set the tracks\' length or km start/end';
  const hasDetectionData = (): boolean => objects.some((o) => o.kind.id === 'trackSection' || DETECTION_KINDS.has(o.kind.id));

  // ---- balise group in front of a signal
  let c = enabled('bg-signal-distance');
  if (c) {
    const groups = objects.filter((o) => o.kind.id === 'baliseGroup');
    if (groups.length === 0) notes.push({ rule: 'bg-signal-distance', message: `${label('bg-signal-distance')}: the drawing has no balise groups` });
    else {
      const byId = new Map(groups.filter((g) => g.id).map((g) => [upper(g.id), g]));
      const groupOf = (o: RailObject): RailObject | null => (o.kind.id === 'baliseGroup' ? o : o.kind.id === 'balise' ? byId.get(upper(o.values.groupId ?? '')) ?? null : null);
      const min = Number(c.params.min);
      const max = Number(c.params.max);
      const skipped: string[] = [];
      for (const s of signals(isMainSignal)) {
        const ends = walk(topo(), on(), s, !s.forward, (h) => groupOf(h.o) !== null || readsTravel(topo(), h, !h.forward))
          .map((b) => b.end)
          .filter((e): e is Hit => !!e && groupOf(e.o) !== null)
          .sort((a, b) => a.units - b.units);
        const name = s.o.id || `(cell ${s.o.cellId})`;
        if (ends.length === 0) {
          push('bg-signal-distance', s.o, `Signal ${name} has no balise group in rear (on its approach up to the previous signal); rule: ${fmt(min)}–${fmt(max)} in front of the signal`, 'direction');
          continue;
        }
        const g = groupOf(ends[0].o)!;
        const m = metresOf(ends[0], s.o);
        if (m === null) {
          skipped.push(name);
          continue;
        }
        if (m < min - 1e-6 || m > max + 1e-6) {
          push('bg-signal-distance', s.o, `Balise group ${g.id || '(no ID)'} is ${fmt(m)} in rear of signal ${name}; rule: ${fmt(min)}–${fmt(max)}`, 'km', [g]);
        }
      }
      noteSkipped('bg-signal-distance', skipped, NO_SCALE);
    }
  }

  // ---- balise order within a group
  c = enabled('balise-order');
  if (c) {
    for (const g of objects.filter((o) => o.kind.id === 'baliseGroup' && o.id)) {
      const members = objects
        .filter((o) => o.kind.id === 'balise' && upper(o.values.groupId ?? '') === upper(g.id))
        .map((b) => ({ b, pos: parseNumber(b.values.position, 'integer'), c: centerOf(b.cell), loc: locateObject(topo(), b) }))
        .filter((x): x is { b: RailObject; pos: number; c: Pt; loc: TopoLocation | null } => x.pos !== null && x.c !== null);
      if (members.length < 2) continue;
      const own = (g.values.direction ?? '').trim();
      const dirs = new Set(members.map((m) => (m.b.values.direction ?? '').trim()).filter(Boolean));
      const dir = own || (dirs.size === 1 ? [...dirs][0] : '');
      if (dir !== 'nominal' && dir !== 'reverse') continue;
      const samePiece = members.every((m) => m.loc && m.loc.piece === members[0].loc?.piece);
      const xs = members.map((m) => m.c.x);
      const ys = members.map((m) => m.c.y);
      const useX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
      const coord = (m: (typeof members)[number]): number => {
        if (samePiece && m.loc) return forwardIsNominal(topo().pieces[m.loc.piece], m.loc.along) ? m.loc.along : -m.loc.along;
        return useX ? m.c.x : m.c.y;
      };
      const sign = dir === 'reverse' ? -1 : 1;
      const byPos = [...members].sort((a, b) => a.pos - b.pos);
      const bad = byPos.some((m, i) => i > 0 && (coord(m) - coord(byPos[i - 1])) * sign <= 0);
      if (bad) {
        const along = [...members].sort((a, b) => (coord(a) - coord(b)) * sign);
        push(
          'balise-order',
          g,
          `Balises of group ${g.id} are not in position order 1..n in the group direction (${dir}): in that direction they lie ${along.map((m) => `${m.b.id || '?'} (${m.pos})`).join(', ')}`,
          'direction',
          along.map((m) => m.b)
        );
      }
    }
  }

  // ---- overlap length / route without overlap
  const overlapLength = enabled('overlap-length');
  const overlapRequired = enabled('overlap-required');
  if ((overlapLength || overlapRequired) && objects.some((o) => o.kind.id === 'route')) {
    const signalById = new Map(objects.filter((o) => o.kind.id === 'signal' && o.id).map((o) => [upper(o.id), o]));
    const skipped: string[] = [];
    const min = Number(overlapLength?.params.min ?? 0);
    for (const r of il().routes) {
      const route = objects.find((o) => o.cellId === r.cellId)!;
      const exit = signalById.get(upper(r.exit));
      if (overlapRequired && r.overlap.length === 0 && exit && isMainSignal(exit)) {
        push('overlap-required', route, `Route ${r.id} ends at main signal ${exit.id} but has no overlap`, 'overlap', [exit]);
      }
      if (overlapLength && r.overlap.length > 0 && r.pathFound) {
        if (r.overlapMetres === null) skipped.push(r.id);
        else if (r.overlapMetres < min - 1e-6) {
          push('overlap-length', route, `Overlap of route ${r.id} (${r.overlap.join(', ')}) is ${fmt(r.overlapMetres)} beyond ${r.exit}; rule: at least ${fmt(min)}`, 'overlap', exit ? [exit] : []);
        }
      }
    }
    if (overlapLength) noteSkipped('overlap-length', skipped, `${NO_SCALE}, or the overlap is not reachable in the drawing`);
  }

  // ---- detection point at a signal
  c = enabled('detection-at-signal');
  if (c) {
    if (!objects.some((o) => DETECTION_KINDS.has(o.kind.id))) notes.push({ rule: 'detection-at-signal', message: `${label('detection-at-signal')}: the drawing has no axle counters or insulated joints` });
    else {
      const min = Number(c.params.min);
      const max = Number(c.params.max);
      const skipped: string[] = [];
      for (const s of signals(isMainSignal)) {
        const ends = walk(topo(), on(), s, s.forward, (h) => DETECTION_KINDS.has(h.o.kind.id) || readsTravel(topo(), h, h.forward))
          .map((b) => b.end)
          .filter((e): e is Hit => !!e && DETECTION_KINDS.has(e.o.kind.id))
          .sort((a, b) => a.units - b.units);
        const name = s.o.id || `(cell ${s.o.cellId})`;
        if (ends.length === 0) {
          push('detection-at-signal', s.o, `No axle counter or insulated joint beyond signal ${name} before the next signal; rule: ${fmt(min)}–${fmt(max)} beyond the signal`, 'direction');
          continue;
        }
        const m = metresOf(ends[0], s.o);
        if (m === null) skipped.push(name);
        else if (m < min - 1e-6 || m > max + 1e-6) {
          push('detection-at-signal', s.o, `Detection point ${ends[0].o.id || '(no ID)'} is ${fmt(m)} beyond signal ${name}; rule: ${fmt(min)}–${fmt(max)}`, 'km', [ends[0].o]);
        }
      }
      noteSkipped('detection-at-signal', skipped, NO_SCALE);
    }
  }

  // ---- signal side
  c = enabled('signal-side');
  if (c) {
    const want = String(c.params.side) === 'left' ? 'left' : 'right';
    for (const s of signals(() => true)) {
      const centre = centerOf(s.o.cell);
      if (!centre) continue;
      const d = directionAt(topo().pieces[s.loc.piece].line, s.loc.along);
      const t = s.forward ? d : { x: -d.x, y: -d.y };
      const off = { x: centre.x - s.loc.point.x, y: centre.y - s.loc.point.y };
      if (Math.hypot(off.x, off.y) < 1) continue;
      const side = t.x * off.y - t.y * off.x > 0 ? 'right' : 'left';
      if (side !== want) {
        push('signal-side', s.o, `Signal ${s.o.id || `(cell ${s.o.cellId})`} stands on the ${side} of the track for its direction (${s.o.values.direction}); rule: ${want}-hand side`, 'direction');
      }
    }
  }

  // ---- spacing of main signals
  c = enabled('signal-spacing');
  if (c) {
    const min = Number(c.params.min);
    const skipped: string[] = [];
    const seen = new Set<string>();
    for (const s of signals(isMainSignal)) {
      const name = s.o.id || `(cell ${s.o.cellId})`;
      for (const b of walk(topo(), on(), s, s.forward, (h) => isMainSignal(h.o) && readsTravel(topo(), h, h.forward))) {
        if (!b.end) continue;
        const key = `${s.o.cellId}>${b.end.o.cellId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const m = metresOf(b.end, s.o);
        if (m === null) skipped.push(name);
        else if (m < min - 1e-6) push('signal-spacing', b.end.o, `Main signal ${b.end.o.id || '(no ID)'} follows signal ${name} after ${fmt(m)}; rule: at least ${fmt(min)} (minimum block length)`, 'km', [s.o]);
      }
    }
    noteSkipped('signal-spacing', skipped, NO_SCALE);
  }

  // ---- train detection between signals
  c = enabled('detection-between-signals');
  if (c) {
    if (!hasDetectionData()) notes.push({ rule: 'detection-between-signals', message: `${label('detection-between-signals')}: the drawing has no track sections, axle counters or insulated joints` });
    else {
      const seen = new Set<string>();
      for (const s of signals(() => true)) {
        for (const b of walk(topo(), on(), s, s.forward, (h) => readsTravel(topo(), h, h.forward))) {
          if (!b.end) continue;
          const key = `${s.o.cellId}>${b.end.o.cellId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const detected = b.pieces.some((p) => topo().pieces[p].sectionId !== '') || b.hits.some((h) => DETECTION_KINDS.has(h.o.kind.id));
          if (!detected) push('detection-between-signals', s.o, `No train detection (track section or detection point) between signal ${s.o.id || '(no ID)'} and signal ${b.end.o.id || '(no ID)'}`, 'trackId', [b.end.o]);
        }
      }
    }
  }

  // ---- signal direction of routes
  c = enabled('signal-direction');
  if (c) {
    const reported = new Set<string>();
    for (const r of objects.filter((o) => o.kind.id === 'route')) {
      for (const key of ['entrySignal', 'exitSignal'] as const) {
        const id = (r.values[key] ?? '').trim();
        const s = id ? objects.find((o) => o.kind.id === 'signal' && upper(o.id) === upper(id)) : undefined;
        if (!s || hasDirection(s) || reported.has(s.cellId)) continue;
        reported.add(s.cellId);
        push('signal-direction', s, `Signal ${s.id} is the ${key === 'entrySignal' ? 'entry' : 'exit'} signal of route ${r.id || '(no ID)'} but has no direction (nominal/reverse)`, 'direction', [r]);
      }
    }
  }

  // ---- points without detection
  c = enabled('points-detection');
  if (c) {
    if (!hasDetectionData()) notes.push({ rule: 'points-detection', message: `${label('points-detection')}: the drawing has no track sections, axle counters or insulated joints` });
    else {
      const t = topo();
      const legs = new Map<string, Set<number>>();
      for (const n of t.nodes) {
        if (!n.points) continue;
        const set = legs.get(n.points.cellId) ?? new Set<number>();
        for (const p of [n.points.toe, n.points.normal, n.points.reverse]) set.add(p);
        legs.set(n.points.cellId, set);
      }
      for (const [cellId, pieces] of legs) {
        const covered = [...pieces].some((p) => t.pieces[p].sectionId !== '') || located().some((x) => DETECTION_KINDS.has(x.o.kind.id) && pieces.has(x.loc.piece));
        if (covered) continue;
        const o = objects.find((x) => x.cellId === cellId);
        if (o) push('points-detection', o, `Points ${o.id || `(cell ${o.cellId})`} lie in no track section and have no detection point on their legs`, 'trackId');
      }
    }
  }

  // ---- ETCS balise data (etcs/etcs-checks.ts)
  const etcs = checkEtcsRules(objects, settings, topo);
  issues.push(...etcs.issues);
  notes.push(...etcs.notes);

  return { issues, notes };
}
