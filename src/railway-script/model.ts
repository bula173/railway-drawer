/**
 * @file model.ts
 * @brief Reads a schema-valid Railway Script value (plain JSON from YAML) into the normalized
 *        `ScriptModel`: tracks with km ranges, objects with their catalogue values (stored form,
 *        like the Data panel writes them), routes, layout overrides, and the semantic checks the
 *        schema cannot express (unique IDs, references, km ranges). Every object keeps the path
 *        of its item in the document, for diagnostics and for the drawing -> text sync.
 */
import type { KindId } from '../railway/catalogue';
import { formatStoredNumber, getKind, parseNumber, splitRefList } from '../railway/catalogue';
import type { PointsEntry } from '../railway/routes';
import { parsePointsList } from '../railway/routes';
import { COMMON_SCRIPT_KEYS, EXTRA_ATTRS, KEY_ALIASES, LISTS, STATE_KEYS, TRACK_NESTED_LISTS, kindForList, matchKey, objectKey, stateValuesFor } from './language';
import type { JsonPath } from './validate';
import { ETCS_ATTR, normalizeEtcsData, parseEtcsData, serializeEtcsData } from '../railway/etcs/etcs-data';

/** The `etcs` key of a balise group: an object (or its JSON text) -> the stored rdEtcs JSON. */
function etcsText(value: unknown): string {
  if (typeof value === 'string') return parseEtcsData(value).data ? serializeEtcsData(parseEtcsData(value).data!) : value;
  return serializeEtcsData(normalizeEtcsData(value).data);
}

export interface PageOptions {
  /** Drawing units per metre. */
  scale: number;
  laneSpacing: number;
  originX: number;
  originY: number;
}

export const DEFAULT_PAGE: PageOptions = { scale: 0.5, laneSpacing: 80, originX: 40, originY: 80 };

export interface ScriptObject {
  kind: KindId;
  id: string;
  /** `kind:id`, also the `rdScript` attribute of the generated cell. */
  key: string;
  /** Path of the item in the document. */
  path: JsonPath;
  /** Catalogue values by field key, in stored form ('' never stored). */
  values: Record<string, string>;
  /** Extra attributes of the cell (language.ts EXTRA_ATTRS). */
  attrs: Record<string, string>;
  /** Track the object is on (ID as written in the track item). */
  trackId?: string;
  km?: number;
  x?: number;
  y?: number;
  /** Generated from a shortcut (track bufferStops, a balise group's balises): not an item of its own. */
  generatedFrom?: string;
}

export interface TrackObject extends ScriptObject {
  kmStart: number;
  kmEnd: number;
  lane: number | null;
  siding: boolean;
}

export interface PointsObject extends ScriptObject {
  to: string;
  hand: 'left' | 'right' | null;
}

export interface SectionObject extends ScriptObject {
  fromKm: number;
  toKm: number;
}

export interface BaliseGroupObject extends ScriptObject {
  members: ScriptObject[];
}

export interface RouteObject extends ScriptObject {
  from: string;
  to: string;
  via: PointsEntry[] | null;
  overlap: string[] | null;
  sections: string[] | null;
}

export interface ScriptModel {
  name: string;
  page: PageOptions;
  tracks: TrackObject[];
  /** Everything else except routes (points, signals, balises, groups, sections, ...), in document order. */
  objects: ScriptObject[];
  routes: RouteObject[];
  /** All objects (tracks, objects, routes) by `matchKey`. */
  byMatch: Map<string, ScriptObject>;
}

export interface ModelIssue {
  severity: 'error' | 'warning';
  path: JsonPath;
  message: string;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** km of a script value (number or chainage text), or null. */
export function kmOf(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return parseNumber(v, 'km');
  return null;
}

/** Stored form of a catalogue field from a script value. */
function storedValue(kind: KindId, field: string, v: unknown): string {
  const f = getKind(kind)?.fields.find((x) => x.key === field);
  if (!f || v === null || v === undefined) return '';
  switch (f.type) {
    case 'km': {
      const n = kmOf(v);
      return n === null ? str(v) : formatStoredNumber(n);
    }
    case 'number':
    case 'integer':
      return typeof v === 'number' ? formatStoredNumber(v) : str(v);
    case 'refList':
      return Array.isArray(v) ? v.map(str).filter((s) => s).join(', ') : splitRefList(str(v)).join(', ');
    default:
      return str(v);
  }
}

export interface ReadResult {
  model: ScriptModel;
  issues: ModelIssue[];
}

/** Reads the document value (already valid against the schema) into the model. */
export function readScriptModel(doc: unknown): ReadResult {
  const issues: ModelIssue[] = [];
  const root: Obj = isObj(doc) ? doc : {};
  const page = { ...DEFAULT_PAGE };
  if (isObj(root.page)) {
    const p = root.page;
    if (typeof p.scale === 'number' && p.scale > 0) page.scale = p.scale;
    if (typeof p.laneSpacing === 'number' && p.laneSpacing > 0) page.laneSpacing = p.laneSpacing;
    if (isObj(p.origin)) {
      if (typeof p.origin.x === 'number') page.originX = p.origin.x;
      if (typeof p.origin.y === 'number') page.originY = p.origin.y;
    }
  }
  const model: ScriptModel = { name: str(root.name), page, tracks: [], objects: [], routes: [], byMatch: new Map() };
  const register = (o: ScriptObject, idPath: JsonPath): boolean => {
    const k = matchKey(o.kind, o.id);
    if (model.byMatch.has(k)) {
      issues.push({ severity: 'error', path: idPath, message: `${getKind(o.kind)!.label} ID "${o.id}" is used twice` });
      return false;
    }
    model.byMatch.set(k, o);
    return true;
  };

  // ---- generic item reading: catalogue fields, extras, layout
  const readItem = (kind: KindId, item: Obj, path: JsonPath, implicitTrack?: string): ScriptObject => {
    const def = getKind(kind)!;
    const id = str(item.id);
    const o: ScriptObject = { kind, id, key: objectKey(kind, id), path, values: { id }, attrs: {} };
    for (const f of def.fields) {
      if (f.key === 'id') continue;
      const keys = [f.key, ...(KEY_ALIASES[kind]?.[f.key] ?? [])];
      for (const [sk, fk] of Object.entries(COMMON_SCRIPT_KEYS)) if (fk === f.key) keys.unshift(sk);
      const key = keys.find((k) => item[k] !== undefined && item[k] !== null);
      if (key === undefined) continue;
      const v = storedValue(kind, f.key, item[key]);
      if (v !== '') o.values[f.key] = v;
    }
    for (const [key, attr] of Object.entries(EXTRA_ATTRS[kind] ?? {})) {
      if (item[key] !== undefined && item[key] !== null && !(key in COMMON_SCRIPT_KEYS && def.fields.some((f) => f.key === COMMON_SCRIPT_KEYS[key]))) {
        o.attrs[attr] = attr === ETCS_ATTR ? etcsText(item[key]) : str(item[key]);
      }
    }
    // runtime states (state / aspect): stored as rdState / rdAspect, the look is applied by apply.ts
    for (const [key, attr] of Object.entries(STATE_KEYS) as Array<['state' | 'aspect', string]>) {
      if (item[key] === undefined || item[key] === null) continue;
      const v = str(item[key]);
      const allowed = stateValuesFor(kind, key, o.values.signalType ?? '');
      if (!allowed) {
        issues.push({ severity: 'warning', path: [...path, key], message: `${def.label} ${id}: has no ${key} (ignored)` });
      } else if (!allowed.includes(v)) {
        issues.push({ severity: 'error', path: [...path, key], message: `${def.label} ${id}: ${key} "${v}" is not one of ${allowed.join(', ')}` });
      } else {
        o.attrs[attr] = v;
      }
    }
    if (typeof item.x === 'number') o.x = item.x;
    if (typeof item.y === 'number') o.y = item.y;
    const track = str(item.track) || implicitTrack || '';
    if (track) o.trackId = track;
    const km = kmOf(item.at);
    if (km !== null) o.km = km;
    return o;
  };

  // ---- tracks
  const trackItems: Array<{ item: Obj; path: JsonPath }> = [];
  (Array.isArray(root.tracks) ? root.tracks : []).forEach((item, i) => {
    if (isObj(item)) trackItems.push({ item, path: ['tracks', i] });
  });
  for (const { item, path } of trackItems) {
    const base = readItem('track', item, path);
    const startKm = kmOf(item.startKm ?? item.kmStart) ?? metres(item.start ?? item.StartPos);
    const endKm = kmOf(item.endKm ?? item.kmEnd) ?? metres(item.end ?? item.EndPos);
    const t: TrackObject = {
      ...base,
      kmStart: startKm ?? 0,
      kmEnd: endKm ?? 0,
      lane: typeof item.lane === 'number' ? item.lane : null,
      siding: item.kind === 'siding',
    };
    delete t.trackId;
    delete t.km;
    t.values.kmStart = formatStoredNumber(t.kmStart);
    t.values.kmEnd = formatStoredNumber(t.kmEnd);
    if (t.values.length === undefined) t.values.length = formatStoredNumber(Math.round(Math.abs(t.kmEnd - t.kmStart) * 1000 * 1000) / 1000);
    if (startKm !== null && endKm !== null && Math.abs(startKm - endKm) < 1e-9) {
      issues.push({ severity: 'error', path, message: `Track ${t.id}: start and end are the same km (${formatStoredNumber(startKm)})` });
    }
    if (register(t, [...path, 'id'])) model.tracks.push(t);
  }
  const trackById = new Map(model.tracks.map((t) => [t.id.toUpperCase(), t]));

  // ---- objects (top-level lists, then lists nested in tracks), in document order
  const items: Array<{ kind: KindId; item: Obj; path: JsonPath; implicitTrack?: string }> = [];
  for (const { key } of LISTS) {
    const kind = kindForList(key)!;
    if (kind === 'track') {
      trackItems.forEach(({ item, path }) => {
        for (const nested of TRACK_NESTED_LISTS) {
          const list = item[nested];
          if (!Array.isArray(list)) continue;
          list.forEach((sub, j) => {
            if (isObj(sub)) items.push({ kind: kindForList(nested)!, item: sub, path: [...path, nested, j], implicitTrack: str(item.id) });
          });
        }
      });
      continue;
    }
    const list = root[key];
    if (!Array.isArray(list)) continue;
    list.forEach((item, i) => {
      if (isObj(item)) items.push({ kind, item, path: [key, i] });
    });
  }

  const checkTrack = (o: ScriptObject, item: Obj, path: JsonPath): TrackObject | null => {
    if (!o.trackId) return null;
    const t = trackById.get(o.trackId.toUpperCase()) ?? null;
    if (!t) {
      issues.push({ severity: 'error', path: item.track !== undefined ? [...path, 'track'] : path, message: `${getKind(o.kind)!.label} ${o.id}: unknown track "${o.trackId}"` });
      return null;
    }
    o.trackId = t.id;
    o.values.trackId = t.id;
    return t;
  };
  const checkKm = (o: ScriptObject, t: TrackObject | null, path: JsonPath, key = 'at'): void => {
    if (!t || o.km === undefined) return;
    const lo = Math.min(t.kmStart, t.kmEnd);
    const hi = Math.max(t.kmStart, t.kmEnd);
    if (o.km < lo - 1e-9 || o.km > hi + 1e-9) {
      issues.push({ severity: 'warning', path: [...path, key], message: `${getKind(o.kind)!.label} ${o.id}: km ${formatStoredNumber(o.km)} is outside track ${t.id} (${formatStoredNumber(lo)}–${formatStoredNumber(hi)}); drawn at the track end` });
    }
  };

  const pendingSections: Array<{ o: SectionObject; item: Obj; path: JsonPath }> = [];
  const pendingRoutes: Array<{ o: RouteObject; item: Obj; path: JsonPath }> = [];
  for (const { kind, item, path, implicitTrack } of items) {
    const o = readItem(kind, item, path, implicitTrack);
    if (kind === 'route') {
      const r: RouteObject = { ...o, from: str(item.from ?? item.entrySignal), to: str(item.to ?? item.exitSignal), via: null, overlap: null, sections: null };
      const via = item.via ?? item.points;
      if (via !== undefined && via !== null) {
        const text = isObj(via) ? Object.entries(via).map(([k, v]) => `${k}:${str(v)}`).join(', ') : str(via);
        const parsed = parsePointsList(text);
        if (parsed.invalid.length > 0) issues.push({ severity: 'error', path: [...path, item.via !== undefined ? 'via' : 'points'], message: `Route ${r.id}: cannot read points position${parsed.invalid.length === 1 ? '' : 's'} ${parsed.invalid.join(', ')}` });
        r.via = parsed.entries;
      }
      if (item.overlap !== undefined && item.overlap !== null) r.overlap = splitRefList(storedValue('route', 'overlap', item.overlap));
      if (item.sections !== undefined && item.sections !== null) r.sections = splitRefList(storedValue('route', 'sections', item.sections));
      delete r.values.points;
      if (register(r, [...path, 'id'])) pendingRoutes.push({ o: r, item, path });
      continue;
    }
    if (kind === 'points') {
      const t = checkTrack(o, item, path);
      checkKm(o, t, path);
      const p: PointsObject = { ...o, to: str(item.to), hand: item.hand === 'left' || item.hand === 'right' ? item.hand : null };
      const to = trackById.get(p.to.toUpperCase());
      if (!to) issues.push({ severity: 'error', path: [...path, 'to'], message: `Points ${p.id}: unknown diverging track "${p.to}"` });
      else if (t && to === t) issues.push({ severity: 'error', path: [...path, 'to'], message: `Points ${p.id}: diverges to its own track ${t.id}` });
      else p.to = to.id;
      p.attrs.rdDivergingTrack = p.to;
      if (register(p, [...path, 'id'])) model.objects.push(p);
      continue;
    }
    if (kind === 'trackSection') {
      const s: SectionObject = { ...o, fromKm: NaN, toKm: NaN };
      if (register(s, [...path, 'id'])) pendingSections.push({ o: s, item, path });
      continue;
    }
    if (kind === 'bufferStop' && (item.at === 'start' || item.at === 'end')) {
      const t = checkTrack(o, item, path);
      if (t) o.km = item.at === 'start' ? t.kmStart : t.kmEnd;
      if (register(o, [...path, 'id'])) model.objects.push(o);
      continue;
    }
    if (kind === 'train') {
      // a train's track/km/direction are extra attributes (the catalogue train has no location)
      const t = o.trackId ? trackById.get(o.trackId.toUpperCase()) : undefined;
      if (o.trackId && !t) issues.push({ severity: 'error', path: item.track !== undefined ? [...path, 'track'] : path, message: `Train ${o.id}: unknown track "${o.trackId}"` });
      if (t) {
        o.trackId = t.id;
        o.attrs.rdTrackId = t.id;
      }
      if (o.km !== undefined) o.attrs.rdKm = formatStoredNumber(o.km);
      checkKm(o, t ?? null, path);
      if (register(o, [...path, 'id'])) model.objects.push(o);
      continue;
    }
    if (kind === 'rbc') {
      if (register(o, [...path, 'id'])) model.objects.push(o);
      continue;
    }
    const t = checkTrack(o, item, path);
    checkKm(o, t, path);
    if (kind === 'baliseGroup') {
      const g: BaliseGroupObject = { ...o, members: [] };
      if (!register(g, [...path, 'id'])) continue;
      model.objects.push(g);
      const list = item.balises;
      const specs: Array<{ id: string; km?: number; direction?: string; notes?: string; path: JsonPath; own: boolean }> = [];
      if (typeof list === 'number') for (let n = 1; n <= list; n++) specs.push({ id: `${g.id}-${n}`, path, own: false });
      else if (Array.isArray(list)) {
        list.forEach((b, j) => {
          if (isObj(b)) specs.push({ id: str(b.id), km: kmOf(b.at) ?? undefined, direction: b.direction === undefined ? undefined : str(b.direction), notes: b.notes === undefined ? undefined : str(b.notes), path: [...path, 'balises', j], own: true });
          else specs.push({ id: str(b), path: [...path, 'balises', j], own: true });
        });
      }
      specs.forEach((spec, n) => {
        const b: ScriptObject = {
          kind: 'balise',
          id: spec.id,
          key: objectKey('balise', spec.id),
          path: spec.path,
          values: { id: spec.id, groupId: g.id, position: String(n + 1) },
          attrs: {},
          trackId: g.trackId,
          generatedFrom: g.key,
        };
        if (g.trackId) b.values.trackId = g.trackId;
        const dir = spec.direction ?? g.values.direction;
        if (dir) b.values.direction = dir;
        if (spec.notes) b.values.notes = spec.notes;
        if (spec.km !== undefined) b.km = spec.km;
        if (register(b, spec.own ? [...spec.path] : [...path, 'balises'])) {
          g.members.push(b);
          model.objects.push(b);
        }
      });
      if (g.values.count === undefined && g.members.length > 0) g.values.count = String(g.members.length);
      continue;
    }
    if (kind === 'balise' && o.values.groupId && !items.some((x) => x.kind === 'baliseGroup' && str(x.item.id).toUpperCase() === o.values.groupId.toUpperCase())) {
      issues.push({ severity: 'warning', path: [...path, item.group !== undefined ? 'group' : 'groupId'], message: `Balise ${o.id}: unknown balise group "${o.values.groupId}"` });
    }
    if (register(o, [...path, 'id'])) model.objects.push(o);
  }

  // ---- track buffer stops (shortcut on the track item)
  trackItems.forEach(({ item, path }) => {
    const t = model.tracks.find((x) => x.path === path);
    if (!t || !Array.isArray(item.bufferStops)) return;
    item.bufferStops.forEach((b: unknown, j: number) => {
      // { id, at } items are read like the other nested lists
      if (isObj(b)) return;
      const end = str(b);
      if (end !== 'start' && end !== 'end') return;
      const id = `BS-${t.id}-${end}`;
      const o: ScriptObject = {
        kind: 'bufferStop',
        id,
        key: objectKey('bufferStop', id),
        path: [...path, 'bufferStops', j],
        values: { id, trackId: t.id, km: formatStoredNumber(end === 'start' ? t.kmStart : t.kmEnd) },
        attrs: {},
        trackId: t.id,
        km: end === 'start' ? t.kmStart : t.kmEnd,
        generatedFrom: t.key,
      };
      if (register(o, [...path, 'bufferStops', j])) model.objects.push(o);
    });
  });

  // ---- sections: from/to as km or detection point IDs
  const pointKm = (ref: unknown, s: SectionObject, path: JsonPath, key: string): number | null => {
    const km = kmOf(ref);
    if (km !== null && !(typeof ref === 'string' && !/^\s*-?\d/.test(ref))) return km;
    const id = str(ref);
    const target = model.objects.find((o) => (o.kind === 'axleCounter' || o.kind === 'insulatedJoint' || o.kind === 'balise' || o.kind === 'signal' || o.kind === 'baliseGroup') && o.id.toUpperCase() === id.toUpperCase());
    if (!target || target.km === undefined) {
      issues.push({ severity: 'error', path: [...path, key], message: `Section ${s.id}: "${id}" is not a detection point with a km on a track` });
      return null;
    }
    if (!s.trackId && target.trackId) {
      s.trackId = target.trackId;
      s.values.trackId = target.trackId;
    }
    if (target.kind === 'axleCounter' || target.kind === 'insulatedJoint') {
      const list = splitRefList(target.values.sections);
      if (!list.some((x) => x.toUpperCase() === s.id.toUpperCase())) target.values.sections = [...list, s.id].join(', ');
    }
    return target.km;
  };
  for (const { o: s, item, path } of pendingSections) {
    const from = pointKm(item.from ?? item.startKm ?? item.kmStart, s, path, item.from !== undefined ? 'from' : item.startKm !== undefined ? 'startKm' : 'kmStart');
    const to = pointKm(item.to ?? item.endKm ?? item.kmEnd, s, path, item.to !== undefined ? 'to' : item.endKm !== undefined ? 'endKm' : 'kmEnd');
    const t = checkTrack(s, item, path);
    if (!s.trackId) issues.push({ severity: 'error', path, message: `Section ${s.id}: no track (add "track", or start/end at detection points on a track)` });
    if (from === null || to === null || !t) continue;
    s.fromKm = Math.min(from, to);
    s.toKm = Math.max(from, to);
    s.values.kmStart = formatStoredNumber(s.fromKm);
    s.values.kmEnd = formatStoredNumber(s.toKm);
    if (s.values.length === undefined) s.values.length = formatStoredNumber(Math.round((s.toKm - s.fromKm) * 1e6) / 1000);
    model.objects.push(s);
  }

  // ---- routes: signals and points must exist
  for (const { o: r, path, item } of pendingRoutes) {
    const sig = (id: string, key: string): void => {
      const s = model.byMatch.get(matchKey('signal', id));
      if (!s) issues.push({ severity: 'error', path: [...path, item[key] !== undefined ? key : key === 'from' ? 'entrySignal' : 'exitSignal'], message: `Route ${r.id}: unknown signal "${id}"` });
    };
    sig(r.from, 'from');
    sig(r.to, 'to');
    if (r.from && r.from.toUpperCase() === r.to.toUpperCase()) issues.push({ severity: 'error', path, message: `Route ${r.id}: starts and ends at the same signal` });
    for (const v of r.via ?? []) {
      if (!model.byMatch.has(matchKey('points', v.id))) issues.push({ severity: 'error', path: [...path, item.via !== undefined ? 'via' : 'points'], message: `Route ${r.id}: unknown points "${v.id}"` });
    }
    r.values.entrySignal = model.byMatch.get(matchKey('signal', r.from))?.id ?? r.from;
    r.values.exitSignal = model.byMatch.get(matchKey('signal', r.to))?.id ?? r.to;
    model.routes.push(r);
  }
  // signals list the routes they start
  for (const r of model.routes) {
    const s = model.byMatch.get(matchKey('signal', r.from));
    if (!s) continue;
    const list = splitRefList(s.values.routes);
    if (!list.some((x) => x.toUpperCase() === r.id.toUpperCase())) s.values.routes = [...list, r.id].join(', ');
  }
  // references inside catalogue fields (balise group LEU, train RBC)
  for (const o of model.objects) {
    for (const [field, kind] of [['leuId', 'leu'], ['rbcId', 'rbc']] as const) {
      const v = o.values[field];
      if (v && !model.byMatch.has(matchKey(kind, v))) issues.push({ severity: 'warning', path: o.path, message: `${getKind(o.kind)!.label} ${o.id}: unknown ${getKind(kind)!.label} "${v}"` });
    }
  }
  return { model, issues };
}

function metres(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v / 1000 : null;
}
