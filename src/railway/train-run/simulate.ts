/**
 * @file simulate.ts
 * @brief Train run simulation over a RunPath (pure, no DOM): the train's head starts at the entry
 *        signal of the first route and runs to the exit signal of the last one at a constant speed or,
 *        with `useSpeedLimits`, at the lowest of the chosen speed and the limits of the blocks the
 *        train occupies (head to tail). The result is the time profile of the head and the ordered
 *        list of significant events with the object state changes they cause:
 *
 * - t = 0: every route set (route reserved, sections reserved, points in position and locked, the
 *   last route's overlap reserved as overlap, entry signals proceed); the train departs after
 *   `setupS` (route setting / movement authority time);
 * - head passes a route's entry signal: signal back to stop, route "in use" (occupied);
 * - head enters a block: block occupied (red);
 * - tail clears a block: block free (sequential release); tail clears a points junction: points
 *   free (unlocked, the position stays); tail clears the last block of a route: route free;
 * - head reaches the exit signal: arrival (the train stops, its blocks stay occupied);
 * - `overlapReleaseS` after the arrival: overlap free; the run ends after the dwell / overlap timer.
 *
 * Events at the same time keep this order: route set, depart, signal, enter, clear, points,
 * route released, arrival, overlap.
 */
import type { PointsPosition } from '../topology';
import type { BlockKind, RunPath } from './run-path';

export interface RunOptions {
  /** Speed (km/h), > 0. */
  speedKmh: number;
  /** Train length (m), >= 0. */
  lengthM: number;
  /** Use the blocks' speed limits (km/h data) where lower than `speedKmh`. */
  useSpeedLimits?: boolean;
  /** Time from the route set to the departure (s, default 5). */
  setupS?: number;
  /** Dwell at the exit signal after the arrival (s, default 0). */
  dwellS?: number;
  /** Overlap released this long after the arrival (s, default 30). */
  overlapReleaseS?: number;
}

export const DEFAULT_SETUP_S = 5;
export const DEFAULT_OVERLAP_RELEASE_S = 30;

export type RunObjectKind = BlockKind | 'signal' | 'route';

/** A state change of one object (ID + the values it gets). */
export interface RunChange {
  kind: RunObjectKind;
  id: string;
  state?: string;
  aspect?: string;
  position?: PointsPosition;
}

export type RunEventType =
  | 'route-set'
  | 'depart'
  | 'signal-passed'
  | 'head-enter'
  | 'tail-clear'
  | 'points-released'
  | 'route-released'
  | 'arrive'
  | 'overlap-released';

const TYPE_ORDER: Record<RunEventType, number> = {
  'route-set': 0,
  depart: 1,
  'signal-passed': 2,
  'head-enter': 3,
  'tail-clear': 4,
  'points-released': 5,
  'route-released': 6,
  arrive: 7,
  'overlap-released': 8,
};

export interface RunEvent {
  /** Seconds from the start of the run. */
  t: number;
  type: RunEventType;
  /** Object the event is about (route, signal, block, points ID). */
  subject: string;
  /** Short text, e.g. "TC2 occupied (head enters)". */
  label: string;
  /** Head position (m from the start) and speed (km/h) at that moment. */
  headM: number;
  speedKmh: number;
  changes: RunChange[];
}

/** A stretch of constant speed of the head. */
export interface ProfilePart {
  fromM: number;
  toM: number;
  t0: number;
  t1: number;
  /** m/s */
  v: number;
}

export interface RunResult {
  path: RunPath;
  options: Required<RunOptions>;
  events: RunEvent[];
  profile: ProfilePart[];
  departS: number;
  arriveS: number;
  /** End of the run (s). */
  durationS: number;
  warnings: string[];
}

const kmh = (v: number): number => (v * 3600) / 1000;

function normalize(options: RunOptions): Required<RunOptions> {
  const finite = (v: number | undefined, fallback: number, min = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback);
  return {
    speedKmh: finite(options.speedKmh, 60, 0),
    lengthM: finite(options.lengthM, 0, 0),
    useSpeedLimits: options.useSpeedLimits === true,
    setupS: finite(options.setupS, DEFAULT_SETUP_S),
    dwellS: finite(options.dwellS, 0),
    overlapReleaseS: finite(options.overlapReleaseS, DEFAULT_OVERLAP_RELEASE_S),
  };
}

/** Head speed (m/s) for head positions in (fromM, toM): the chosen speed, or the lowest limit under the train. */
function buildProfile(path: RunPath, o: Required<RunOptions>, departS: number): ProfilePart[] {
  const vmax = o.speedKmh / 3.6;
  const cuts = new Set<number>([0, path.lengthM]);
  if (o.useSpeedLimits) {
    for (const b of path.blocks) {
      if (b.limitKmh === null) continue;
      for (const x of [b.startM, b.endM, b.startM + o.lengthM, b.endM + o.lengthM]) if (x > 0 && x < path.lengthM) cuts.add(x);
    }
  }
  const xs = [...cuts].sort((a, b) => a - b);
  const parts: ProfilePart[] = [];
  let t = departS;
  for (let i = 0; i + 1 < xs.length; i++) {
    const fromM = xs[i];
    const toM = xs[i + 1];
    if (toM - fromM < 1e-9) continue;
    const mid = (fromM + toM) / 2;
    let v = vmax;
    if (o.useSpeedLimits) {
      for (const b of path.blocks) {
        // the train covers (mid - length, mid]
        if (b.limitKmh !== null && b.startM < mid && b.endM > mid - o.lengthM) v = Math.min(v, b.limitKmh / 3.6);
      }
    }
    const t1 = t + (toM - fromM) / v;
    const last = parts[parts.length - 1];
    if (last && Math.abs(last.v - v) < 1e-12) {
      last.toM = toM;
      last.t1 = t1;
    } else {
      parts.push({ fromM, toM, t0: t, t1, v });
    }
    t = t1;
  }
  return parts;
}

/** Time (s) when the head reaches `m` (clamped to the path). */
export function timeAtM(result: Pick<RunResult, 'profile' | 'departS'>, m: number): number {
  const parts = result.profile;
  if (parts.length === 0 || m <= 0) return result.departS;
  for (const p of parts) if (m <= p.toM + 1e-9) return p.t0 + (Math.max(m, p.fromM) - p.fromM) / p.v;
  return parts[parts.length - 1].t1;
}

/** Head position (m) at time `t`. */
export function headAt(result: Pick<RunResult, 'profile' | 'departS' | 'path'>, t: number): number {
  const parts = result.profile;
  if (t <= result.departS || parts.length === 0) return 0;
  for (const p of parts) if (t <= p.t1) return p.fromM + (t - p.t0) * p.v;
  return result.path.lengthM;
}

/** Head speed (km/h) at time `t` (0 before the departure and after the arrival). */
export function speedAt(result: Pick<RunResult, 'profile' | 'departS' | 'arriveS'>, t: number): number {
  if (t < result.departS || t >= result.arriveS) return 0;
  const part = result.profile.find((p) => t >= p.t0 && t < p.t1) ?? result.profile[result.profile.length - 1];
  return part ? kmh(part.v) : 0;
}

/** Speed (km/h) of the head while it is at `m` (for event texts). */
function speedAtM(profile: ProfilePart[], m: number): number {
  const part = profile.find((p) => m >= p.fromM - 1e-9 && m < p.toM - 1e-9) ?? profile[profile.length - 1];
  return part ? kmh(part.v) : 0;
}

export function simulateRun(path: RunPath, options: RunOptions): RunResult {
  const o = normalize(options);
  const warnings = [...path.warnings];
  if (o.speedKmh <= 0) {
    o.speedKmh = 1;
    warnings.push('Speed must be above 0 km/h: 1 km/h used.');
  }
  const departS = o.setupS;
  const profile = buildProfile(path, o, departS);
  const arriveS = profile.length > 0 ? profile[profile.length - 1].t1 : departS;
  const events: RunEvent[] = [];
  const at = (m: number): number => timeAtM({ profile, departS }, m);
  const push = (t: number, type: RunEventType, subject: string, label: string, headM: number, changes: RunChange[], speed?: number): void => {
    events.push({ t, type, subject, label, headM, speedKmh: speed ?? (t >= departS && t < arriveS ? speedAtM(profile, headM) : 0), changes });
  };
  const last = path.routes[path.routes.length - 1];

  // t = 0: the routes are set
  for (const r of path.routes) {
    const changes: RunChange[] = [{ kind: 'route', id: r.id, state: 'reserved' }];
    for (const b of path.blocks.filter((x) => x.routeId === r.id && x.kind !== 'points')) changes.push({ kind: b.kind, id: b.id, state: 'reserved' });
    for (const p of path.points.filter((x) => x.routeId === r.id)) changes.push({ kind: 'points', id: p.id, position: p.position, state: 'locked' });
    if (r === last) for (const id of path.overlap) changes.push({ kind: 'section', id, state: 'overlap' });
    changes.push({ kind: 'signal', id: r.entry, aspect: 'proceed' });
    const pointsText = r.points.length > 0 ? `, points ${r.points.map((p) => `${p.id} ${p.position}`).join(', ')}` : '';
    push(0, 'route-set', r.id, `Route ${r.id} set (${r.entry} proceed${pointsText})`, 0, changes, 0);
  }
  push(departS, 'depart', path.routes[0].entry, `Train departs from ${path.routes[0].entry}`, 0, [], speedAtM(profile, 0));

  // entry signals back to stop when the head passes them; the route is in use
  for (const r of path.routes) {
    const t = at(r.startM);
    push(t, 'signal-passed', r.entry, `Head passes ${r.entry}: ${r.entry} back to stop`, r.startM, [
      { kind: 'signal', id: r.entry, aspect: 'stop' },
      { kind: 'route', id: r.id, state: 'occupied' },
    ]);
  }
  // blocks: occupied when the head enters, free when the tail clears (if it does before the stop)
  const releasedAt = new Map<string, number>();
  for (const b of path.blocks) {
    push(at(b.startM), 'head-enter', b.id, `${b.id} occupied (head enters)`, b.startM, [{ kind: b.kind, id: b.id, state: 'occupied' }]);
    const clearM = b.endM + o.lengthM;
    if (clearM <= path.lengthM + 1e-9 && b.endM < path.lengthM - 1e-9) {
      const t = at(clearM);
      push(t, 'tail-clear', b.id, `${b.id} free (tail clears, released)`, clearM, [{ kind: b.kind, id: b.id, state: 'free' }]);
      releasedAt.set(b.id.toUpperCase(), t);
    }
  }
  // points: free (unlocked) once the tail has passed the junction
  for (const p of path.points) {
    // a points leg the train runs over is a block of its own: released with it
    if (p.atM === null || path.blocks.some((b) => b.kind === 'points' && b.id.toUpperCase() === p.id.toUpperCase())) continue;
    const clearM = p.atM + o.lengthM;
    if (clearM > path.lengthM + 1e-9) continue;
    push(at(clearM), 'points-released', p.id, `Points ${p.id} free (tail clears, unlocked)`, clearM, [{ kind: 'points', id: p.id, state: 'free' }]);
  }
  // a route is released when its last block is
  for (const r of path.routes) {
    const own = path.blocks.filter((b) => b.routeId === r.id);
    if (own.length === 0) continue;
    const times = own.map((b) => releasedAt.get(b.id.toUpperCase()));
    if (times.some((t) => t === undefined)) continue;
    const t = Math.max(...(times as number[]));
    push(t, 'route-released', r.id, `Route ${r.id} released`, headAt({ profile, departS, path }, t), [{ kind: 'route', id: r.id, state: 'free' }]);
  }
  push(arriveS, 'arrive', last.exit, `Train stops at ${last.exit} (arrival)`, path.lengthM, [], 0);
  let durationS = arriveS + o.dwellS;
  if (path.overlap.length > 0) {
    const t = arriveS + o.overlapReleaseS;
    push(t, 'overlap-released', path.overlap.join(', '), `Overlap ${path.overlap.join(', ')} released (${formatSeconds(o.overlapReleaseS)} after the stop)`, path.lengthM,
      path.overlap.map((id) => ({ kind: 'section' as const, id, state: 'free' })), 0);
    durationS = Math.max(durationS, t);
  }
  events.sort((a, b) => a.t - b.t || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.headM - b.headM);
  return { path, options: o, events, profile, departS, arriveS, durationS, warnings };
}

/** `12.3 s`, `1 min 05 s`. */
export function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s * 10) / 10} s`;
  const whole = Math.round(s);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`;
}

/**
 * The state of every touched object at time `t`: changes of all events up to `t` folded per
 * object (`kind:ID` upper case -> values).
 */
export function statesAt(result: Pick<RunResult, 'events'>, t: number): Map<string, RunChange> {
  const out = new Map<string, RunChange>();
  for (const e of result.events) {
    if (e.t > t + 1e-9) break;
    for (const c of e.changes) {
      const key = changeKey(c);
      out.set(key, { ...(out.get(key) ?? { kind: c.kind, id: c.id }), ...c });
    }
  }
  return out;
}

export function changeKey(c: { kind: RunObjectKind; id: string }): string {
  return `${c.kind === 'section' || c.kind === 'track' ? 'block' : c.kind}:${c.id.toUpperCase()}`;
}
