/**
 * @file km.ts
 * @brief km positions along tracks: linear interpolation from a track's km start (first point of
 *        its centre line) to its km end (last point), "Recalculate km" for the objects that name a
 *        track, chainage text (`12+345`) and the ticks of the km ruler.
 */
import type { Cell } from '@maxgraph/core';
import { formatStoredNumber, parseNumber } from './catalogue';
import type { Pt } from './geometry';
import { centerOf, trackPolyline } from './geometry';
import { directionAt, pointAlong, polylineLength, projectPoint } from './topology';
import type { RailObject } from './validation';
import { indexObjects } from './validation';

/** Objects further than this from their track get no km. */
export const KM_DISTANCE = 60;

export interface KmScale {
  line: Pt[];
  length: number;
  kmStart: number;
  kmEnd: number;
}

/** The km scale of a track or track section (needs km start and end and a centre line). */
export function kmScaleOf(track: RailObject): KmScale | null {
  if (track.kind.id !== 'track' && track.kind.id !== 'trackSection') return null;
  const kmStart = parseNumber(track.values.kmStart, 'km');
  const kmEnd = parseNumber(track.values.kmEnd, 'km');
  const line = trackPolyline(track.cell);
  if (kmStart === null || kmEnd === null || !line || line.length < 2) return null;
  const length = polylineLength(line);
  return length > 0 ? { line, length, kmStart, kmEnd } : null;
}

/** km at arc length `along` (clamped to the track). */
export function kmAtAlong(scale: KmScale, along: number): number {
  const t = Math.max(0, Math.min(1, along / scale.length));
  return scale.kmStart + (scale.kmEnd - scale.kmStart) * t;
}

/** km of the point of the track nearest to `p`, rounded to metres, or null when farther than `maxDistance`. */
export function kmAtPoint(scale: KmScale, p: Pt, maxDistance = KM_DISTANCE): number | null {
  const pr = projectPoint(p, scale.line);
  if (pr.distance > maxDistance) return null;
  return roundKm(kmAtAlong(scale, pr.along));
}

export function roundKm(km: number): number {
  return Math.round(km * 1000) / 1000;
}

/** `12.345` -> `12+345` (negative: `-0+120`). */
export function formatChainage(km: number): string {
  const metres = Math.round(Math.abs(km) * 1000);
  const whole = Math.floor(metres / 1000);
  const rest = String(metres % 1000).padStart(3, '0');
  return `${km < 0 ? '-' : ''}${whole}+${rest}`;
}

export interface KmUpdate {
  cell: Cell;
  object: RailObject;
  km: string;
  previous: string;
}

/** New km values of the objects on tracks with a km scale (only changed ones). */
export function recalculateKm(objects: RailObject[]): KmUpdate[] {
  const index = indexObjects(objects);
  const scales = new Map<RailObject, KmScale | null>();
  const out: KmUpdate[] = [];
  for (const o of objects) {
    if (!o.kind.fields.some((f) => f.key === 'km')) continue;
    const trackId = (o.values.trackId ?? '').trim();
    if (!trackId) continue;
    const track = index.get('track')?.get(trackId.toUpperCase()) ?? index.get('trackSection')?.get(trackId.toUpperCase());
    if (!track) continue;
    if (!scales.has(track)) scales.set(track, kmScaleOf(track));
    const scale = scales.get(track);
    const c = centerOf(o.cell);
    if (!scale || !c) continue;
    const km = kmAtPoint(scale, c);
    if (km === null) continue;
    const text = formatStoredNumber(km);
    const previous = (o.values.km ?? '').trim();
    const old = parseNumber(previous, 'km');
    if (old !== null && Math.abs(old - km) < 0.0005) continue;
    out.push({ cell: o.cell, object: o, km: text, previous });
  }
  return out;
}

export interface RulerTick {
  point: Pt;
  /** Unit normal (left of the line direction, screen coordinates). */
  normal: Pt;
  km: number;
  major: boolean;
}

const STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

/**
 * Ticks of a km ruler along a track: the smallest round km step that keeps ticks at least
 * `minSpacing` drawing units apart; every 5th tick (multiples of 5 steps) is major. Track ends
 * are always ticked.
 */
export function rulerTicks(scale: KmScale, minSpacing = 40): RulerTick[] {
  const span = Math.abs(scale.kmEnd - scale.kmStart);
  if (span === 0) return [];
  const unitsPerKm = scale.length / span;
  const step = STEPS.find((s) => s * unitsPerKm >= minSpacing) ?? STEPS[STEPS.length - 1];
  const lo = Math.min(scale.kmStart, scale.kmEnd);
  const hi = Math.max(scale.kmStart, scale.kmEnd);
  const kms: number[] = [scale.kmStart];
  const first = Math.ceil(lo / step - 1e-9);
  for (let n = first; n * step <= hi + 1e-9 && kms.length < 2000; n++) kms.push(Math.round(n * step * 1e6) / 1e6);
  kms.push(scale.kmEnd);
  const unique = [...new Set(kms.map((k) => Math.round(k * 1e6) / 1e6))];
  return unique.map((km, i) => {
    const along = ((km - scale.kmStart) / (scale.kmEnd - scale.kmStart)) * scale.length;
    const dir = directionAt(scale.line, along);
    const n = Math.round(km / step);
    return {
      point: pointAlong(scale.line, along),
      normal: { x: dir.y, y: -dir.x },
      km,
      // track ends and every 5th step are major (labelled)
      major: i === 0 || i === unique.length - 1 || (Math.abs(km / step - n) < 1e-6 && n % 5 === 0),
    };
  });
}
