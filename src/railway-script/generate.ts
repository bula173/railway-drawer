/**
 * @file generate.ts
 * @brief "Generate from drawing": a Railway Script for the railway objects of an existing drawing.
 *        Tracks (lines with km start/end; else km from their length or drawing length), lanes from
 *        the tracks' rows, points legs (km on the track they leave, diverging track), objects on
 *        tracks by `rdTrackId`/`rdKm` (else the nearest track and the km of the projection),
 *        balise groups with their balises, track sections lying on tracks, RBCs, trains and routes
 *        (entry/exit signal and points positions). Objects that cannot be expressed are listed in
 *        `skipped`. Applying the result redraws them in the schematic layout.
 */
import { Document, isMap, isSeq } from 'yaml';
import type { GraphDataModel } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import { getKind, parseNumber, splitRefList } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { centerOf, trackPolyline } from '../railway/geometry';
import { kmAtPoint, kmScaleOf } from '../railway/km';
import { readAttr } from '../railway/object-data';
import { parsePointsList } from '../railway/routes';
import { projectPoint, polylineLength } from '../railway/topology';
import { collectObjects } from '../railway/validation';
import type { RailObject } from '../railway/validation';
import { COMPUTED_FIELDS, ON_TRACK_KINDS, SCRIPT_VERSION, listForKind, scriptKeysForField } from './language';
import { DEFAULT_PAGE } from './model';

export interface GenerateResult {
  text: string;
  /** Objects not written into the script, with the reason. */
  skipped: string[];
  counts: Partial<Record<KindId, number>>;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

interface TrackInfo {
  o: RailObject;
  id: string;
  line: Pt[];
  kmStart: number;
  kmEnd: number;
}

function value(kind: KindId, field: string, text: string): unknown {
  const f = getKind(kind)?.fields.find((x) => x.key === field);
  if (f && (f.type === 'number' || f.type === 'integer' || f.type === 'km')) {
    const n = parseNumber(text, f.type);
    return n === null ? text : n;
  }
  if (f?.type === 'refList') return splitRefList(text);
  return text;
}

/** Catalogue fields of an object as script keys (no id/km/track, no computed fields). */
function fields(o: RailObject, skip: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const computed = new Set(COMPUTED_FIELDS[o.kind.id] ?? []);
  for (const f of o.kind.fields) {
    if (['id', 'km', 'trackId', ...skip].includes(f.key) || computed.has(f.key)) continue;
    const v = (o.values[f.key] ?? '').trim();
    if (v) out[scriptKeysForField(o.kind.id, f.key)[0]] = value(o.kind.id, f.key, v);
  }
  return out;
}

export function generateScript(model: GraphDataModel, name = ''): GenerateResult {
  const objects = collectObjects(model).filter((o) => o.cell.getParent()?.getId() !== 'rd-diff-layer');
  const skipped: string[] = [];
  const counts: Partial<Record<KindId, number>> = {};
  const count = (k: KindId): void => {
    counts[k] = (counts[k] ?? 0) + 1;
  };
  const label = (o: RailObject): string => `${o.kind.label} ${o.id || `(cell ${o.cellId})`}`;

  // ---- tracks
  const used = new Set<string>();
  const tracks: TrackInfo[] = [];
  let n = 0;
  for (const o of objects) {
    if (o.kind.id !== 'track') continue;
    const line = trackPolyline(o.cell);
    if (!line || line.length < 2) {
      skipped.push(`${label(o)}: no track line`);
      continue;
    }
    let id = o.id;
    while (!id || used.has(id.toUpperCase())) id = `T${++n}`;
    used.add(id.toUpperCase());
    const ks = parseNumber(o.values.kmStart, 'km');
    const ke = parseNumber(o.values.kmEnd, 'km');
    let kmStart = ks ?? 0;
    let kmEnd = ke ?? 0;
    if (ks === null || ke === null || ks === ke) {
      const metres = parseNumber(o.values.length) ?? polylineLength(line) / DEFAULT_PAGE.scale;
      kmStart = ks ?? 0;
      kmEnd = r3(kmStart + metres / 1000);
    }
    tracks.push({ o, id, line, kmStart, kmEnd });
  }
  // drawing scale (units per metre) and lanes from the tracks' rows
  const ratios = tracks.map((t) => polylineLength(t.line) / (Math.abs(t.kmEnd - t.kmStart) * 1000)).filter((r) => Number.isFinite(r) && r > 0).sort((a, b) => a - b);
  const scale = ratios.length > 0 ? Number(ratios[Math.floor(ratios.length / 2)].toPrecision(3)) : DEFAULT_PAGE.scale;
  const ys = [...new Set(tracks.map((t) => Math.round(t.line[0].y)))].sort((a, b) => a - b);
  const gaps = ys.slice(1).map((y, i) => y - ys[i]).filter((g) => g > 5);
  const laneSpacing = gaps.length > 0 ? Math.min(...gaps) : DEFAULT_PAGE.laneSpacing;
  const y0 = ys[0] ?? DEFAULT_PAGE.originY;

  const trackItems = tracks.map((t) => {
    const item: Record<string, unknown> = { id: t.id };
    const f = fields(t.o, ['kmStart', 'kmEnd', 'length']);
    if (f.name !== undefined) item.name = f.name;
    item.startKm = t.kmStart;
    item.endKm = t.kmEnd;
    const lane = (t.line[0].y - y0) / laneSpacing;
    if (Math.abs(lane - Math.round(lane)) < 0.05) item.lane = Math.round(lane);
    else item.y = Math.round(t.line[0].y * 10) / 10;
    const kind = readAttr(t.o.cell, 'rdTrackKind');
    if (kind === 'siding' || kind === 'main') item.kind = kind;
    for (const [k, v] of Object.entries(f)) if (k !== 'name') item[k] = v;
    count('track');
    return item;
  });
  const trackById = (id: string): TrackInfo | undefined => tracks.find((t) => t.id.toUpperCase() === id.trim().toUpperCase());
  const kmOn = (t: TrackInfo, p: Pt, max = 60): number | null => {
    const scale = kmScaleOf({ ...t.o, values: { ...t.o.values, kmStart: String(t.kmStart), kmEnd: String(t.kmEnd) } });
    return scale ? kmAtPoint(scale, p, max) : null;
  };
  const nearestTrack = (p: Pt, max = 60): TrackInfo | null => {
    let best: { t: TrackInfo; d: number } | null = null;
    for (const t of tracks) {
      const d = projectPoint(p, t.line).distance;
      if (d <= max && (!best || d < best.d)) best = { t, d };
    }
    return best?.t ?? null;
  };

  // ---- points legs
  const pointsItems: Record<string, unknown>[] = [];
  for (const o of objects) {
    if (o.kind.id !== 'points') continue;
    const line = o.cell.isEdge() ? trackPolyline(o.cell) : null;
    if (!line || !o.id) {
      skipped.push(`${label(o)}: only points drawn as a leg (ERTMS Point Left/Right) with an ID are written`);
      continue;
    }
    const ends = [line[0], line[line.length - 1]];
    // the end inside a track's line (not at its ends) is where the points are; the other end meets the diverging track
    let best: { at: number; main: TrackInfo; div: TrackInfo } | null = null;
    for (const [i, end] of ends.entries()) {
      const other = ends[1 - i];
      for (const t of tracks) {
        const pr = projectPoint(end, t.line);
        if (pr.distance > 10) continue;
        const div = tracks.find((u) => u !== t && projectPoint(other, u.line).distance <= 10);
        const km = kmOn(t, end, 12);
        if (!div || km === null) continue;
        const interior = pr.along > 5 && pr.along < polylineLength(t.line) - 5;
        if (!best || interior) best = { at: km, main: t, div };
      }
    }
    if (!best) {
      skipped.push(`${label(o)}: its leg does not join two tracks`);
      continue;
    }
    pointsItems.push({ id: o.id, track: best.main.id, at: best.at, to: best.div.id, ...fields(o) });
    count('points');
  }

  // ---- objects on tracks
  const lists = new Map<string, Record<string, unknown>[]>();
  const push = (kind: KindId, item: Record<string, unknown>): void => {
    const key = listForKind(kind);
    const list = lists.get(key) ?? [];
    list.push(item);
    lists.set(key, list);
    count(kind);
  };
  const groupMembers = new Map<string, Record<string, unknown>[]>();
  const placeOf = (o: RailObject, trackAttr: string, kmAttr: string): { track: TrackInfo; km: number } | Pt | null => {
    const c = centerOf(o.cell);
    const named = trackById(readAttr(o.cell, trackAttr));
    const kmText = readAttr(o.cell, kmAttr);
    const km = parseNumber(kmText, 'km');
    if (named && km !== null) return { track: named, km };
    const t = (named && c && projectPoint(c, named.line).distance <= 60 ? named : null) ?? (c ? nearestTrack(c) : null);
    const k = t && c ? kmOn(t, c) : null;
    if (t && k !== null) return { track: t, km: k };
    return c ? { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 } : null;
  };
  for (const o of objects) {
    const kind = o.kind.id;
    if (!ON_TRACK_KINDS.has(kind) || kind === 'points') continue;
    if (!o.id) {
      skipped.push(`${label(o)}: no ID`);
      continue;
    }
    const where = placeOf(o, 'rdTrackId', 'rdKm');
    if (!where) {
      skipped.push(`${label(o)}: no position`);
      continue;
    }
    const item: Record<string, unknown> = { id: o.id };
    if ('track' in where) {
      item.track = where.track.id;
      item.at = r3(where.km);
    }
    Object.assign(item, fields(o, kind === 'baliseGroup' ? ['count'] : []));
    if (kind === 'train') {
      const dir = readAttr(o.cell, 'rdDirection');
      if (dir) item.direction = dir;
    }
    if (kind === 'balise' && o.values.groupId) {
      const g = objects.find((x) => x.kind.id === 'baliseGroup' && x.id.toUpperCase() === o.values.groupId.trim().toUpperCase());
      if (g) {
        const list = groupMembers.get(g.id.toUpperCase()) ?? [];
        const member: Record<string, unknown> = { id: o.id };
        if (item.at !== undefined) member.at = item.at;
        if (o.values.direction && o.values.direction !== g.values.direction) member.direction = o.values.direction;
        list.push(member);
        groupMembers.set(g.id.toUpperCase(), list);
        count('balise');
        continue;
      }
    }
    if (!('track' in where)) {
      skipped.push(`${label(o)}: not on a track`);
      continue;
    }
    push(kind, item);
  }
  for (const item of lists.get('baliseGroups') ?? []) {
    const members = groupMembers.get(String(item.id).toUpperCase());
    if (members && members.length > 0) item.balises = members;
  }
  // track sections lying on a track
  for (const o of objects) {
    if (o.kind.id !== 'trackSection') continue;
    const line = trackPolyline(o.cell);
    const ks = parseNumber(o.values.kmStart, 'km');
    const ke = parseNumber(o.values.kmEnd, 'km');
    const named = trackById(o.values.trackId ?? '');
    let item: Record<string, unknown> | null = null;
    if (named && ks !== null && ke !== null) item = { id: o.id, track: named.id, startKm: ks, endKm: ke };
    else if (line && o.cell.isEdge()) {
      const t = nearestTrack(line[0], 10);
      const a = t ? kmOn(t, line[0], 10) : null;
      const b = t ? kmOn(t, line[line.length - 1], 10) : null;
      if (t && a !== null && b !== null) item = { id: o.id, track: t.id, from: r3(Math.min(a, b)), to: r3(Math.max(a, b)) };
    }
    if (!item || !o.id) {
      skipped.push(`${label(o)}: no km range on a track`);
      continue;
    }
    Object.assign(item, fields(o, ['kmStart', 'kmEnd', 'length']));
    push('trackSection', item);
  }
  for (const o of objects) {
    if (o.kind.id !== 'rbc') continue;
    if (!o.id) continue;
    push('rbc', { id: o.id, ...fields(o) });
  }
  // routes
  for (const o of objects) {
    if (o.kind.id !== 'route') continue;
    if (!o.id || !o.values.entrySignal || !o.values.exitSignal) {
      skipped.push(`${label(o)}: no entry/exit signal`);
      continue;
    }
    const item: Record<string, unknown> = { id: o.id, from: o.values.entrySignal.trim(), to: o.values.exitSignal.trim() };
    const via = parsePointsList(o.values.points).entries;
    if (via.length > 0) item.via = Object.fromEntries(via.map((e) => [e.id, e.position]));
    const f = fields(o, ['entrySignal', 'exitSignal', 'points', 'sections', 'overlap']);
    Object.assign(item, f);
    push('route', item);
  }

  // ---- document
  const root: Record<string, unknown> = { railwayScript: SCRIPT_VERSION };
  if (name) root.name = name;
  const page: Record<string, unknown> = {};
  if (scale !== DEFAULT_PAGE.scale) page.scale = scale;
  if (laneSpacing !== DEFAULT_PAGE.laneSpacing) page.laneSpacing = laneSpacing;
  // origin: where the smallest km of lane 0 is
  const first = [...tracks].sort((a, b) => Math.min(a.kmStart, a.kmEnd) - Math.min(b.kmStart, b.kmEnd))[0];
  if (first) {
    const startX = first.kmStart <= first.kmEnd ? first.line[0].x : first.line[first.line.length - 1].x;
    const ox = Math.round(startX * 10) / 10;
    const oy = Math.round(y0 * 10) / 10;
    if (ox !== DEFAULT_PAGE.originX || oy !== DEFAULT_PAGE.originY) page.origin = { x: ox, y: oy };
  }
  if (Object.keys(page).length > 0) root.page = page;
  if (trackItems.length > 0) root.tracks = trackItems;
  if (pointsItems.length > 0) root.points = pointsItems;
  for (const key of ['signals', 'baliseGroups', 'balises', 'axleCounters', 'sections', 'levelCrossings', 'bufferStops', 'leus', 'rbcs', 'trains', 'routes']) {
    const list = lists.get(key);
    if (list && list.length > 0) root[key] = list;
  }
  const doc = new Document(root);
  // compact one-line items, except tracks
  const contents = doc.contents;
  if (isMap(contents)) {
    for (const pair of contents.items) {
      const key = String((pair.key as { value?: unknown })?.value ?? pair.key);
      if (key === 'tracks' || !isSeq(pair.value)) continue;
      for (const it of pair.value.items) if (isMap(it)) it.flow = true;
    }
  }
  const header = '# Generated from the drawing by Railway Drawer (Railway Script, docs/RAILWAY-SCRIPT.md)\n';
  return { text: header + doc.toString({ lineWidth: 0, flowCollectionPadding: true }), skipped, counts };
}
