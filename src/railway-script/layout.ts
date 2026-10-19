/**
 * @file layout.ts
 * @brief Schematic layout of a Railway Script model: x from km (page scale, increasing km = left to
 *        right = nominal direction), y from the track's lane. Lanes not given are assigned from the
 *        points: a diverging track goes one lane below for a right-hand points in the direction
 *        of the leg (above for left-hand), like the railML import's generated layout. A points leg
 *        is a diagonal from the points' km on its track to the nearer end of the diverging track
 *        (that end is moved so the leg is at least one lane spacing long). Objects sit on their
 *        track at their km; signals/LEUs beside it like the snap puts them (snap.ts), balises and
 *        axle counters centred, trains above. `x`/`y` in the script override a centre (a track:
 *        its first point / its line).
 */
import type { KindId } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { snapOffset } from '../railway/snap';
import type { PointsObject, ScriptModel, ScriptObject, SectionObject, TrackObject } from './model';
import type { JsonPath } from './validate';

export interface TrackGeometry {
  track: TrackObject;
  lane: number;
  start: Pt;
  end: Pt;
}

export interface LayoutIssue {
  severity: 'error' | 'warning';
  path: JsonPath;
  message: string;
}

export interface Layout {
  tracks: Map<TrackObject, TrackGeometry>;
  legs: Map<PointsObject, Pt[]>;
  sections: Map<SectionObject, Pt[]>;
  /** Point on the track and the track direction for objects placed on a track. */
  onTrack: Map<ScriptObject, { point: Pt; dir: Pt }>;
  issues: LayoutIssue[];
}

/** Point of a track at `km` (clamped to the track). */
export function pointAtKm(g: TrackGeometry, km: number): Pt {
  const span = g.track.kmEnd - g.track.kmStart;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, (km - g.track.kmStart) / span));
  return { x: g.start.x + (g.end.x - g.start.x) * t, y: g.start.y + (g.end.y - g.start.y) * t };
}

/** km at the projection of `p` on the track line (not clamped beyond the ends: clamped). */
export function kmAtPointOf(g: TrackGeometry, p: Pt): { km: number; distance: number } {
  const dx = g.end.x - g.start.x;
  const dy = g.end.y - g.start.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - g.start.x) * dx + (p.y - g.start.y) * dy) / len2));
  const q = { x: g.start.x + dx * t, y: g.start.y + dy * t };
  return { km: g.track.kmStart + (g.track.kmEnd - g.track.kmStart) * t, distance: Math.hypot(p.x - q.x, p.y - q.y) };
}

function unit(a: Pt, b: Pt): Pt {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

export function layoutScript(model: ScriptModel): Layout {
  const { page } = model;
  const issues: LayoutIssue[] = [];
  const pxPerKm = page.scale * 1000;
  const kmMin = Math.min(...model.tracks.map((t) => Math.min(t.kmStart, t.kmEnd)), Infinity);
  const X = (km: number): number => page.originX + (km - (Number.isFinite(kmMin) ? kmMin : 0)) * pxPerKm;
  const points = model.objects.filter((o): o is PointsObject => o.kind === 'points');
  const byId = new Map(model.tracks.map((t) => [t.id, t]));

  // ---- lanes
  const lane = new Map<TrackObject, number>();
  for (const t of model.tracks) if (t.lane !== null) lane.set(t, t.lane);
  const xRange = (t: TrackObject): [number, number] => [Math.min(X(t.kmStart), X(t.kmEnd)), Math.max(X(t.kmStart), X(t.kmEnd))];
  const free = (t: TrackObject, l: number): boolean =>
    ![...lane.entries()].some(([o, ol]) => ol === l && o !== t && xRange(o)[0] < xRange(t)[1] + 20 && xRange(t)[0] < xRange(o)[1] + 20);
  /** +1 below / -1 above for the diverging track `to` of points `p` on `from`. */
  const sideOf = (p: PointsObject, from: TrackObject, to: TrackObject): 1 | -1 => {
    const at = X(p.km ?? from.kmStart);
    const [a, b] = xRange(to);
    // the leg runs towards the diverging track's far end: right when its nearer end is its left end
    const legRight = Math.abs(a - at) <= Math.abs(b - at);
    const hand = p.hand ?? 'right';
    return (hand === 'right') === legRight ? 1 : -1;
  };
  const placeNear = (t: TrackObject, wanted: number, step: 1 | -1): void => {
    let l = wanted;
    for (let i = 0; i < 50 && !free(t, l); i++) l += step;
    lane.set(t, l);
  };
  for (let guard = 0; guard < model.tracks.length + 1; guard++) {
    let progress = false;
    for (const p of points) {
      const from = p.trackId ? byId.get(p.trackId) : undefined;
      const to = byId.get(p.to);
      if (!from || !to) continue;
      if (lane.has(from) && !lane.has(to)) {
        const side = sideOf(p, from, to);
        placeNear(to, lane.get(from)! + side, side);
        progress = true;
      } else if (lane.has(to) && !lane.has(from)) {
        const side = sideOf(p, from, to);
        placeNear(from, lane.get(to)! - side, (-side) as 1 | -1);
        progress = true;
      }
    }
    if (progress) continue;
    const next = model.tracks.find((t) => !lane.has(t));
    if (!next) break;
    // a new group: the first free lane from 0 downwards
    placeNear(next, 0, 1);
  }

  // ---- track lines
  const tracks = new Map<TrackObject, TrackGeometry>();
  for (const t of model.tracks) {
    const l = lane.get(t) ?? 0;
    const y = t.y ?? page.originY + l * page.laneSpacing;
    let x0 = X(t.kmStart);
    let x1 = X(t.kmEnd);
    if (t.x !== undefined) {
      x1 += t.x - x0;
      x0 = t.x;
    }
    tracks.set(t, { track: t, lane: l, start: { x: x0, y }, end: { x: x1, y } });
  }

  // ---- points legs (the diverging track's nearer end moves to the leg's end)
  const legs = new Map<PointsObject, Pt[]>();
  for (const p of points) {
    const from = p.trackId ? byId.get(p.trackId) : undefined;
    const to = byId.get(p.to);
    if (!from || !to || p.km === undefined) continue;
    const gf = tracks.get(from)!;
    const gt = tracks.get(to)!;
    const p0 = pointAtKm(gf, p.km);
    const dy = gt.start.y - p0.y;
    if (Math.abs(dy) < 1) {
      issues.push({ severity: 'error', path: [...p.path, 'to'], message: `Points ${p.id}: track ${to.id} is drawn on the same lane as ${from.id}; give it another "lane"` });
      continue;
    }
    const useStart = Math.abs(gt.start.x - p0.x) <= Math.abs(gt.end.x - p0.x);
    const endPt = useStart ? gt.start : gt.end;
    const other = useStart ? gt.end : gt.start;
    const minDx = Math.abs(dy);
    const away = Math.sign(other.x - endPt.x) || 1;
    if (Math.abs(endPt.x - p0.x) < minDx * 0.5 || Math.sign(endPt.x - p0.x) !== away) {
      endPt.x = p0.x + away * minDx;
    }
    legs.set(p, [p0, { x: endPt.x, y: endPt.y }]);
    if (!p.hand) {
      // right-hand when the leg turns right in its own direction (screen y grows downwards)
      const dirX = Math.sign(endPt.x - p0.x) || 1;
      p.values.hand = (dy > 0) === (dirX > 0) ? 'right' : 'left';
    }
  }

  // ---- objects on tracks
  const onTrack = new Map<ScriptObject, { point: Pt; dir: Pt }>();
  for (const o of model.objects) {
    if (o.kind === 'points' || o.kind === 'trackSection' || !o.trackId || o.km === undefined) continue;
    const t = byId.get(o.trackId);
    if (!t) continue;
    const g = tracks.get(t)!;
    onTrack.set(o, { point: pointAtKm(g, o.km), dir: unit(g.start, g.end) });
  }
  // balise group members without their own km: spread around the group's point
  for (const g of model.objects) {
    if (g.kind !== 'baliseGroup') continue;
    const members = (g as ScriptObject & { members: ScriptObject[] }).members.filter((m) => m.km === undefined);
    const base = onTrack.get(g);
    if (!base) continue;
    const spacing = Math.max(14, 3 * page.scale);
    const t = g.trackId ? byId.get(g.trackId) : undefined;
    const tg = t ? tracks.get(t) : undefined;
    const kmPerUnit = tg ? (tg.track.kmEnd - tg.track.kmStart) / (Math.hypot(tg.end.x - tg.start.x, tg.end.y - tg.start.y) || 1) : 0;
    members.forEach((m, i) => {
      const off = (i - (members.length - 1) / 2) * spacing;
      onTrack.set(m, { point: { x: base.point.x + base.dir.x * off, y: base.point.y + base.dir.y * off }, dir: base.dir });
      if (g.km !== undefined && tg) m.values.km = String(Math.round((g.km + off * kmPerUnit) * 1e6) / 1e6);
    });
  }
  const sections = new Map<SectionObject, Pt[]>();
  for (const o of model.objects) {
    if (o.kind !== 'trackSection') continue;
    const s = o as SectionObject;
    const t = s.trackId ? byId.get(s.trackId) : undefined;
    if (!t || !Number.isFinite(s.fromKm)) continue;
    const g = tracks.get(t)!;
    sections.set(s, [pointAtKm(g, s.fromKm), pointAtKm(g, s.toKm)]);
  }
  return { tracks, legs, sections, onTrack, issues };
}

/** Centre of an object of `size` on the track (side offset like the snap), before overrides. */
export function centreOnTrack(kind: KindId, direction: string, at: { point: Pt; dir: Pt }, size: { w: number; h: number }, laneSpacing: number): Pt {
  if (kind === 'train') return { x: at.point.x, y: at.point.y - Math.min(30, laneSpacing * 0.35) };
  const off = snapOffset(kind, direction, { x: 0, y: 0, width: size.w, height: size.h }, at.dir);
  return { x: at.point.x + off.x, y: at.point.y + off.y };
}
