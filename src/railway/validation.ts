/**
 * @file validation.ts
 * @brief Rules engine for railway object data (the "Checks" panel).
 *
 * Works on the model only (geometry from cell geometries), so it runs on any tab and in tests.
 * Rules:
 * - `duplicate-id`       error    two objects of the same kind share an ID (case-insensitive)
 * - `required`           error/warning  a required field is empty (ID: error; NID_C/NID_BG: warning)
 * - `invalid-value`      error    not a number, not a whole number, out of range, unknown option
 * - `unknown-kind`       warning  `rdKind` names a kind this version does not know
 * - `balise-without-group` error  a balise has no balise group
 * - `group-count`        warning  a balise group's "balises in group" differs from its member count
 * - `group-position`     warning  two balises of a group share a position, or a position exceeds the count
 * - `signal-off-track`   warning  a signal is farther than SIGNAL_TRACK_DISTANCE from its track
 *                                 (or from every track, when it names none and tracks exist)
 * - `missing-reference`  error    a reference (track, group, LEU, RBC, route, signal, section) names no object
 * - `km-order`           warning  km positions of the objects on a track are not monotonic along it
 * - `km-outside-track`   warning  an object's km lies outside its track's km start/end
 * - `route-endpoint`, `route-path`, `route-points`: route rules, see route-checks.ts
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import type { FieldDef, KindDef, KindId } from './catalogue';
import { fieldValueProblem, getKind, parseNumber, splitRefList } from './catalogue';
import { allCells, getCellKind, getRawKind, readField, readObjectId } from './object-data';
import { centerOf, projectOnPolyline, trackPolyline } from './geometry';
import type { Pt } from './geometry';
import { checkRoutes } from './route-checks';

export type Severity = 'error' | 'warning';

export type RuleId =
  | 'duplicate-id'
  | 'required'
  | 'invalid-value'
  | 'unknown-kind'
  | 'balise-without-group'
  | 'group-count'
  | 'group-position'
  | 'signal-off-track'
  | 'missing-reference'
  | 'km-order'
  | 'km-outside-track'
  | 'route-endpoint'
  | 'route-path'
  | 'route-points';

export interface Issue {
  severity: Severity;
  rule: RuleId;
  message: string;
  /** Cell to select for this issue. */
  cellId: string;
  kind?: KindId;
  objectId?: string;
  /** Field the issue is about (Data panel highlights it). */
  field?: string;
}

/** Max distance (graph units = px at zoom 100 %) between a signal's centre and its track. */
export const SIGNAL_TRACK_DISTANCE = 40;

export interface RailObject {
  cell: Cell;
  cellId: string;
  kind: KindDef;
  /** Trimmed ID ('' when missing). */
  id: string;
  /** Raw values by field key. */
  values: Record<string, string>;
}

/** Display name of an object in messages: `signal S12` / `signal (cell 7)`. */
export function describeObject(o: RailObject): string {
  return o.id ? `${o.kind.label.toLowerCase()} ${o.id}` : `${o.kind.label.toLowerCase()} without ID (cell ${o.cellId})`;
}

/** The railway objects of a model (cells with a known kind), in model order. */
export function collectObjects(model: GraphDataModel): RailObject[] {
  const out: RailObject[] = [];
  for (const cell of allCells(model)) {
    const kind = getKind(getCellKind(cell));
    if (!kind) continue;
    const values: Record<string, string> = {};
    for (const f of kind.fields) values[f.key] = readField(cell, f);
    out.push({ cell, cellId: String(cell.getId()), kind, id: readObjectId(cell), values });
  }
  return out;
}

/** Objects by kind and upper-case ID (first one wins). */
export function indexObjects(objects: RailObject[]): Map<KindId, Map<string, RailObject>> {
  const index = new Map<KindId, Map<string, RailObject>>();
  for (const o of objects) {
    if (!o.id) continue;
    let byId = index.get(o.kind.id);
    if (!byId) index.set(o.kind.id, (byId = new Map()));
    const key = o.id.toUpperCase();
    if (!byId.has(key)) byId.set(key, o);
  }
  return index;
}

function findRef(index: Map<KindId, Map<string, RailObject>>, kinds: KindId[] | undefined, id: string): RailObject | null {
  for (const k of kinds ?? []) {
    const o = index.get(k)?.get(id.toUpperCase());
    if (o) return o;
  }
  return null;
}

function refKindsText(f: FieldDef): string {
  return (f.refKinds ?? []).map((k) => getKind(k)?.label.toLowerCase() ?? k).join(' or ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ValidateOptions {
  signalTrackDistance?: number;
}

/** Runs every rule on the model; issues sorted errors first, then in model order. */
export function validateModel(model: GraphDataModel, options: ValidateOptions = {}): Issue[] {
  const objects = collectObjects(model);
  const issues = validateObjects(objects, options);
  // Unknown kinds (e.g. a file from a newer version)
  for (const cell of allCells(model)) {
    const raw = getRawKind(cell);
    if (raw && !getCellKind(cell)) {
      issues.push({ severity: 'warning', rule: 'unknown-kind', cellId: String(cell.getId()), message: `Unknown railway object kind "${raw}" (cell ${String(cell.getId())})` });
    }
  }
  return sortIssues(issues, objects);
}

function sortIssues(issues: Issue[], objects: RailObject[]): Issue[] {
  const order = new Map(objects.map((o, i) => [o.cellId, i]));
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => {
      if (a.issue.severity !== b.issue.severity) return a.issue.severity === 'error' ? -1 : 1;
      const oa = order.get(a.issue.cellId) ?? Infinity;
      const ob = order.get(b.issue.cellId) ?? Infinity;
      return oa !== ob ? oa - ob : a.i - b.i;
    })
    .map((x) => x.issue);
}

export function validateObjects(objects: RailObject[], options: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const index = indexObjects(objects);
  const push = (o: RailObject, severity: Severity, rule: RuleId, message: string, fieldKey?: string): void => {
    issues.push({ severity, rule, message, cellId: o.cellId, kind: o.kind.id, objectId: o.id || undefined, field: fieldKey });
  };

  // duplicate-id
  const byKindId = new Map<string, RailObject[]>();
  for (const o of objects) {
    if (!o.id) continue;
    const key = `${o.kind.id}\u0000${o.id.toUpperCase()}`;
    const list = byKindId.get(key);
    if (list) list.push(o);
    else byKindId.set(key, [o]);
  }
  for (const list of byKindId.values()) {
    if (list.length < 2) continue;
    for (const o of list) {
      const others = list.length - 1;
      push(o, 'error', 'duplicate-id', `Duplicate ${o.kind.label.toLowerCase()} ID "${o.id}" (also used by ${others} other ${others === 1 ? o.kind.label.toLowerCase() : o.kind.plural.toLowerCase()})`, 'id');
    }
  }

  // required, invalid-value, missing-reference
  for (const o of objects) {
    for (const f of o.kind.fields) {
      const value = (o.values[f.key] ?? '').trim();
      if (value === '') {
        if (f.required) {
          const what = f.key === 'id' ? `${capitalize(o.kind.label)} has no ID` : `${f.label} of ${describeObject(o)} is not set`;
          push(o, f.required, 'required', f.key === 'id' ? `${what} (cell ${o.cellId})` : what, f.key);
        }
        continue;
      }
      const problem = fieldValueProblem(f, value);
      if (problem) {
        push(o, 'error', 'invalid-value', `${capitalize(describeObject(o))}: ${problem}`, f.key);
        continue;
      }
      if (f.type === 'ref' || f.type === 'refList') {
        const ids = f.type === 'ref' ? [value] : splitRefList(value);
        for (const id of ids) {
          // a route endpoint naming another kind is reported by route-endpoint
          if (o.kind.id === 'route' && f.type === 'ref' && objects.some((x) => x.id.toUpperCase() === id.toUpperCase())) continue;
          if (!findRef(index, f.refKinds, id)) {
            push(o, 'error', 'missing-reference', `${capitalize(describeObject(o))}: ${f.label.toLowerCase()} "${id}" does not exist (no ${refKindsText(f)} with this ID)`, f.key);
          }
        }
      }
    }
  }

  // balise-without-group, group-count, group-position
  const members = new Map<RailObject, RailObject[]>();
  for (const o of objects) {
    if (o.kind.id !== 'balise') continue;
    const groupId = (o.values.groupId ?? '').trim();
    if (!groupId) {
      push(o, 'error', 'balise-without-group', `${capitalize(describeObject(o))} does not belong to a balise group`, 'groupId');
      continue;
    }
    const group = findRef(index, ['baliseGroup'], groupId);
    if (!group) continue; // reported as missing-reference
    const list = members.get(group);
    if (list) list.push(o);
    else members.set(group, [o]);
  }
  for (const group of objects.filter((o) => o.kind.id === 'baliseGroup')) {
    const list = members.get(group) ?? [];
    const count = parseNumber(group.values.count, 'integer');
    if (count !== null && Number.isInteger(count) && count >= 1 && count <= 8 && list.length > 0 && list.length !== count) {
      push(group, 'warning', 'group-count', `Balise group ${group.id || `(cell ${group.cellId})`} has ${count} balise${count === 1 ? '' : 's'} in group, but ${list.length} balise${list.length === 1 ? '' : 's'} belong${list.length === 1 ? 's' : ''} to it`, 'count');
    }
    const seen = new Map<number, RailObject>();
    for (const b of list) {
      const pos = parseNumber(b.values.position, 'integer');
      if (pos === null || !Number.isInteger(pos)) continue;
      const first = seen.get(pos);
      if (first) {
        push(b, 'warning', 'group-position', `${capitalize(describeObject(b))} has the same position ${pos} in group ${group.id} as ${describeObject(first)}`, 'position');
      } else {
        seen.set(pos, b);
      }
      if (count !== null && Number.isInteger(count) && pos > count) {
        push(b, 'warning', 'group-position', `${capitalize(describeObject(b))} has position ${pos}, but group ${group.id} has only ${count} balise${count === 1 ? '' : 's'}`, 'position');
      }
    }
  }

  // Track geometry
  const tracks = objects
    .filter((o) => o.kind.id === 'track' || o.kind.id === 'trackSection' || o.kind.id === 'points')
    .map((o) => ({ o, line: trackPolyline(o.cell) }))
    .filter((t): t is { o: RailObject; line: Pt[] } => !!t.line && t.line.length > 0);
  const lineOf = new Map(tracks.map((t) => [t.o, t.line]));

  // signal-off-track
  const maxDistance = options.signalTrackDistance ?? SIGNAL_TRACK_DISTANCE;
  for (const s of objects.filter((o) => o.kind.id === 'signal')) {
    const c = centerOf(s.cell);
    if (!c) continue;
    const trackId = (s.values.trackId ?? '').trim();
    if (trackId) {
      const track = findRef(index, ['track', 'trackSection'], trackId);
      const line = track ? lineOf.get(track) : undefined;
      if (!track || !line) continue;
      const d = projectOnPolyline(c, line).distance;
      if (d > maxDistance) {
        push(s, 'warning', 'signal-off-track', `${capitalize(describeObject(s))} is ${Math.round(d)} px away from its track ${track.id} (max ${maxDistance} px)`, 'trackId');
      }
    } else if (tracks.length > 0) {
      const d = Math.min(...tracks.map((t) => projectOnPolyline(c, t.line).distance));
      if (d > maxDistance) {
        push(s, 'warning', 'signal-off-track', `${capitalize(describeObject(s))} is not placed on or near a track (nearest is ${Math.round(d)} px away)`, 'trackId');
      }
    }
  }

  // km-order, km-outside-track
  for (const { o: track, line } of tracks) {
    if (!track.id || track.kind.id === 'points') continue;
    const on = objects
      .filter((o) => o !== track && (o.values.trackId ?? '').trim().toUpperCase() === track.id.toUpperCase())
      .filter((o) => findRef(index, ['track', 'trackSection'], o.values.trackId) === track)
      .map((o) => ({ o, km: parseNumber(o.values.km, 'km'), c: centerOf(o.cell) }))
      .filter((x): x is { o: RailObject; km: number; c: Pt } => x.km !== null && x.c !== null);

    const kmStart = parseNumber(track.values.kmStart, 'km');
    const kmEnd = parseNumber(track.values.kmEnd, 'km');
    if (kmStart !== null && kmEnd !== null) {
      const lo = Math.min(kmStart, kmEnd);
      const hi = Math.max(kmStart, kmEnd);
      for (const x of on) {
        if (x.km < lo - 1e-9 || x.km > hi + 1e-9) {
          push(x.o, 'warning', 'km-outside-track', `${capitalize(describeObject(x.o))} at km ${x.km} lies outside track ${track.id} (km ${kmStart}–${kmEnd})`, 'km');
        }
      }
    }

    // Two objects always form a monotonic sequence
    if (on.length < 3) continue;
    const sorted = on
      .map((x) => ({ ...x, along: projectOnPolyline(x.c, line).along }))
      .sort((a, b) => a.along - b.along);
    // Direction of increasing km along the drawing: the majority of steps (ties: first vs last)
    let up = 0;
    let down = 0;
    for (let i = 1; i < sorted.length; i++) {
      const step = sorted[i].km - sorted[i - 1].km;
      if (step > 0) up++;
      else if (step < 0) down++;
    }
    const trend = up !== down ? Math.sign(up - down) : Math.sign(sorted[sorted.length - 1].km - sorted[0].km);
    if (trend === 0) continue;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.along - prev.along < 1e-6) continue;
      if ((cur.km - prev.km) * trend < 0) {
        push(cur.o, 'warning', 'km-order', `${capitalize(describeObject(cur.o))} at km ${cur.km} is out of order along track ${track.id} (follows ${describeObject(prev.o)} at km ${prev.km})`, 'km');
      }
    }
  }

  // routes
  for (const r of checkRoutes(objects)) push(r.o, r.severity, r.rule, r.message, r.field);

  return issues;
}

export interface IssueCounts {
  errors: number;
  warnings: number;
}

export function countIssues(issues: Issue[]): IssueCounts {
  let errors = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.severity === 'error') errors++;
    else warnings++;
  }
  return { errors, warnings };
}
