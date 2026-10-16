/**
 * @file topology.ts
 * @brief Track topology derived from the drawing: a graph of track pieces and nodes, with the
 *        points (switches) at its junctions. Used by the route tool, the route checks and the
 *        route/interlocking tables. Model only (geometry.ts), so it runs in tests and on any tab.
 *
 * - **Links**: cells of kind `track`, `trackSection` and `points` with a centre line (edges, or
 *   elongated vertices: long side >= 3x the short side) of at least MIN_LINK_LENGTH. A points
 *   object drawn as an edge (ERTMS "Point Left/Right") is the diverging leg; a points object drawn
 *   as a compact vertex (app switch shape) is a junction node.
 * - **Sections on tracks**: a track section whose centre line lies on a track (both ends and the
 *   middle within JOIN_TOLERANCE) is not a separate link: it names the pieces of the track it covers.
 * - **Connections**: a link is cut where another link's end (or a points vertex, or a covering
 *   section's end) touches it; ends closer than JOIN_TOLERANCE are one node. Edges connected to
 *   vertices (explicit terminals) end at the vertex centre (geometry.ts), so they join there.
 * - **Points junctions**: a node with 3 pieces where a points leg ends (or at a points vertex):
 *   reverse = the leg (vertex: the piece outside the straightest pair), toe = the straight piece
 *   most opposite to the reverse one, normal = the other one. toe<->normal needs the points in
 *   normal, toe<->reverse in reverse; normal<->reverse is impossible.
 * - **Direction** (confirmed project convention): "nominal" is left to right, i.e. the travel
 *   direction of increasing x along a piece (vertical pieces: increasing y), the way ERTMS
 *   "Signal Right" symbols face; "reverse" is the opposite.
 */
import type { KindId } from './catalogue';
import { parseNumber } from './catalogue';
import type { Box, Pt } from './geometry';
import { absoluteBounds, centerOf, trackPolyline } from './geometry';
import type { RailObject } from './validation';

/** Ends (and cut points) closer than this (graph units) are connected. */
export const JOIN_TOLERANCE = 8;
/** Shorter centre lines are no links (e.g. a TC joint marker). */
export const MIN_LINK_LENGTH = 15;
/** A vertex is a link when its long side is at least this many times its short side. */
export const LINK_ASPECT = 3;
/** Max distance between an object (signal, balise, ...) and the piece it is located on. */
export const LOCATE_DISTANCE = 40;

export type PointsPosition = 'normal' | 'reverse';

export interface PointsJunction {
  /** Cell and rdId of the points object. */
  cellId: string;
  pointsId: string;
  /** Piece ids. */
  toe: number;
  normal: number;
  reverse: number;
}

export interface TopoNode {
  id: number;
  x: number;
  y: number;
  /** Incident piece ids. */
  pieces: number[];
  points?: PointsJunction;
}

export interface TopoPiece {
  id: number;
  /** Node at the start (along 0) and at the end (along = length). */
  a: number;
  b: number;
  line: Pt[];
  length: number;
  /** The link this piece belongs to. */
  linkCellId: string;
  linkKind: KindId;
  linkId: string;
  /** Track ID (the link itself, or the track a section/points names). */
  trackId: string;
  /** Section ID covering the piece (or the section link itself), '' if none. */
  sectionId: string;
  /** Points leg: the points cell and rdId. */
  pointsCellId: string | null;
  pointsId: string;
  /** Metres per drawing unit from the link's length or km, null when unknown. */
  metresPerUnit: number | null;
}

export interface Topology {
  nodes: TopoNode[];
  pieces: TopoPiece[];
  objects: RailObject[];
}

// ---------------------------------------------------------------------------------------------
// Polyline helpers
// ---------------------------------------------------------------------------------------------

export function polylineLength(line: Pt[]): number {
  let len = 0;
  for (let i = 1; i < line.length; i++) len += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
  return len;
}

/** Point at arc length `along` (clamped). */
export function pointAlong(line: Pt[], along: number): Pt {
  if (line.length === 0) return { x: 0, y: 0 };
  let rest = Math.max(0, along);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (rest <= len || i === line.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, rest / len);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    rest -= len;
  }
  return { ...line[line.length - 1] };
}

/** Unit direction of the polyline at `along` (direction of increasing along). */
export function directionAt(line: Pt[], along: number): Pt {
  let rest = Math.max(0, along);
  let last: Pt = { x: 1, y: 0 };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    last = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    if (rest <= len) return last;
    rest -= len;
  }
  return last;
}

/** The part of a polyline between two arc lengths (from > to gives it reversed). */
export function subPolyline(line: Pt[], from: number, to: number): Pt[] {
  if (from > to) return subPolyline(line, to, from).reverse();
  const out: Pt[] = [pointAlong(line, from)];
  let offset = 0;
  for (let i = 1; i < line.length; i++) {
    offset += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
    if (offset > from + 1e-9 && offset < to - 1e-9) out.push({ ...line[i] });
  }
  out.push(pointAlong(line, to));
  return out;
}

export interface LineProjection {
  distance: number;
  along: number;
  point: Pt;
  /** Unit direction of the segment at the nearest point. */
  dir: Pt;
}

export function projectPoint(p: Pt, line: Pt[]): LineProjection {
  let best: LineProjection = { distance: Infinity, along: 0, point: line[0] ?? { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
  if (line.length === 1) return { ...best, distance: Math.hypot(p.x - line[0].x, p.y - line[0].y) };
  let offset = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best.distance - 1e-9) best = { distance: d, along: offset + t * len, point: q, dir: len === 0 ? best.dir : { x: dx / len, y: dy / len } };
    offset += len;
  }
  return best;
}

/** True when travelling along `dir` is the nominal direction (increasing x; vertical: increasing y). */
export function isNominalDirection(dir: Pt): boolean {
  if (Math.abs(dir.x) > 1e-6) return dir.x > 0;
  return dir.y > 0;
}

// ---------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------

interface Link {
  o: RailObject;
  line: Pt[];
  length: number;
  cuts: number[];
  covers: Array<{ from: number; to: number; section: RailObject }>;
  metresPerUnit: number | null;
}

const LINK_KINDS: ReadonlySet<KindId> = new Set<KindId>(['track', 'trackSection', 'points']);

function isElongated(b: Box): boolean {
  const long = Math.max(b.width, b.height);
  const short = Math.min(b.width, b.height);
  return long >= MIN_LINK_LENGTH && long >= LINK_ASPECT * Math.max(short, 0.0001);
}

function scaleOf(o: RailObject, length: number): number | null {
  if (length <= 0) return null;
  const metres = parseNumber(o.values.length, 'number');
  if (metres !== null && metres > 0) return metres / length;
  const kmStart = parseNumber(o.values.kmStart, 'km');
  const kmEnd = parseNumber(o.values.kmEnd, 'km');
  if (kmStart !== null && kmEnd !== null && kmStart !== kmEnd) return (Math.abs(kmEnd - kmStart) * 1000) / length;
  return null;
}

/** The centre line of a link candidate, or null when the object is no link. */
export function linkLine(o: RailObject): Pt[] | null {
  if (!LINK_KINDS.has(o.kind.id)) return null;
  if (o.cell.isVertex()) {
    const b = absoluteBounds(o.cell);
    if (!b || !isElongated(b)) return null;
  }
  const line = trackPolyline(o.cell);
  if (!line || line.length < 2 || polylineLength(line) < MIN_LINK_LENGTH) return null;
  return line;
}

function expand(b: Box, by: number): Box {
  return { x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by };
}

function contains(b: Box, p: Pt): boolean {
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

/** Builds the topology from the railway objects of a model (validation.ts `collectObjects`). */
export function buildTopology(objects: RailObject[], tolerance = JOIN_TOLERANCE): Topology {
  const links: Link[] = [];
  const pointsVertices: Array<{ o: RailObject; box: Box; center: Pt }> = [];
  for (const o of objects) {
    if (!LINK_KINDS.has(o.kind.id)) continue;
    const line = linkLine(o);
    if (line) {
      const length = polylineLength(line);
      links.push({ o, line, length, cuts: [], covers: [], metresPerUnit: scaleOf(o, length) });
    } else if (o.kind.id === 'points' && o.cell.isVertex()) {
      const box = absoluteBounds(o.cell);
      const center = centerOf(o.cell);
      if (box && center) pointsVertices.push({ o, box: expand(box, tolerance), center });
    }
  }

  // Sections drawn on top of a track name the pieces they cover
  const tracks = links.filter((l) => l.o.kind.id === 'track');
  const covering = new Set<Link>();
  for (const s of links) {
    if (s.o.kind.id !== 'trackSection') continue;
    for (const t of tracks) {
      const p0 = projectPoint(s.line[0], t.line);
      const p1 = projectPoint(s.line[s.line.length - 1], t.line);
      const pm = projectPoint(pointAlong(s.line, s.length / 2), t.line);
      if (p0.distance <= tolerance && p1.distance <= tolerance && pm.distance <= tolerance) {
        t.covers.push({ from: Math.min(p0.along, p1.along), to: Math.max(p0.along, p1.along), section: s.o });
        t.cuts.push(p0.along, p1.along);
        if (!t.metresPerUnit && s.metresPerUnit) t.metresPerUnit = s.metresPerUnit;
        covering.add(s);
        break;
      }
    }
  }
  const active = links.filter((l) => !covering.has(l));

  // Cuts: other links' ends and points vertices touching a link's interior
  const ends: Pt[] = [];
  for (const l of active) ends.push(l.line[0], l.line[l.line.length - 1]);
  for (const pv of pointsVertices) ends.push(pv.center);
  for (const l of active) {
    for (const p of ends) {
      const pr = projectPoint(p, l.line);
      if (pr.distance <= tolerance && pr.along > tolerance && pr.along < l.length - tolerance) l.cuts.push(pr.along);
    }
  }

  const nodes: TopoNode[] = [];
  const vertexNodes = new Map<RailObject, TopoNode>();
  for (const pv of pointsVertices) {
    const node: TopoNode = { id: nodes.length, x: pv.center.x, y: pv.center.y, pieces: [] };
    nodes.push(node);
    vertexNodes.set(pv.o, node);
  }
  const nodeAt = (p: Pt): TopoNode => {
    for (const pv of pointsVertices) if (contains(pv.box, p)) return vertexNodes.get(pv.o)!;
    let best: TopoNode | null = null;
    let bestD = tolerance;
    for (const n of nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d <= bestD) {
        best = n;
        bestD = d;
      }
    }
    if (best) return best;
    const node: TopoNode = { id: nodes.length, x: p.x, y: p.y, pieces: [] };
    nodes.push(node);
    return node;
  };

  const pieces: TopoPiece[] = [];
  for (const l of active) {
    const cuts = [0, ...l.cuts.filter((c) => c > 1 && c < l.length - 1).sort((a, b) => a - b), l.length];
    const stops: number[] = [];
    for (const c of cuts) if (stops.length === 0 || c - stops[stops.length - 1] > 1) stops.push(c);
    if (stops[stops.length - 1] !== l.length) stops[stops.length - 1] = l.length;
    for (let i = 0; i + 1 < stops.length; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const line = subPolyline(l.line, from, to);
      const a = nodeAt(line[0]);
      const b = nodeAt(line[line.length - 1]);
      if (a === b) continue;
      const mid = (from + to) / 2;
      const kind = l.o.kind.id;
      const cover = l.covers.find((c) => mid >= c.from - 0.5 && mid <= c.to + 0.5);
      const piece: TopoPiece = {
        id: pieces.length,
        a: a.id,
        b: b.id,
        line,
        length: to - from,
        linkCellId: l.o.cellId,
        linkKind: kind,
        linkId: l.o.id,
        trackId: kind === 'track' ? l.o.id : (l.o.values.trackId ?? '').trim(),
        sectionId: kind === 'trackSection' ? l.o.id : cover ? cover.section.id : '',
        pointsCellId: kind === 'points' ? l.o.cellId : null,
        pointsId: kind === 'points' ? l.o.id : '',
        metresPerUnit: l.metresPerUnit,
      };
      pieces.push(piece);
      a.pieces.push(piece.id);
      b.pieces.push(piece.id);
    }
  }

  // Points junctions
  const vertexOfNode = new Map<number, RailObject>();
  for (const [o, n] of vertexNodes) vertexOfNode.set(n.id, o);
  for (const node of nodes) {
    if (node.pieces.length !== 3) continue;
    const incident = node.pieces.map((id) => pieces[id]);
    const out = (p: TopoPiece): Pt => outgoing(p, node.id);
    const vertex = vertexOfNode.get(node.id);
    const legs = incident.filter((p) => p.pointsCellId !== null);
    let reverse: TopoPiece | null = null;
    let points: RailObject | null = null;
    if (vertex) {
      // straightest pair = most opposite outgoing directions; the third piece diverges
      let bestDot = Infinity;
      for (let i = 0; i < 3; i++) {
        const [p, q] = incident.filter((_, k) => k !== i);
        const d = dot(out(p), out(q));
        if (d < bestDot) {
          bestDot = d;
          reverse = incident[i];
        }
      }
      points = vertex;
    } else if (legs.length === 1) {
      reverse = legs[0];
      points = objects.find((o) => o.cellId === legs[0].pointsCellId) ?? null;
    }
    if (!reverse || !points) continue;
    const straight = incident.filter((p) => p !== reverse);
    const rDir = out(reverse);
    const [toe, normal] = dot(out(straight[0]), rDir) <= dot(out(straight[1]), rDir) ? [straight[0], straight[1]] : [straight[1], straight[0]];
    node.points = { cellId: points.cellId, pointsId: points.id, toe: toe.id, normal: normal.id, reverse: reverse.id };
  }

  return { nodes, pieces, objects };
}

function dot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}

/** Unit direction leaving `nodeId` along the piece (measured over its first 10 units). */
export function outgoing(piece: TopoPiece, nodeId: number): Pt {
  const reach = Math.min(10, piece.length);
  const [from, to] = piece.a === nodeId ? [pointAlong(piece.line, 0), pointAlong(piece.line, reach)] : [pointAlong(piece.line, piece.length), pointAlong(piece.line, piece.length - reach)];
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
}

/** Max turn between two pieces at a node: the directions must not differ by more than 90°. */
export const MIN_TURN_DOT = 0;

export interface Passage {
  ok: boolean;
  /** At a points junction: the points and the position the passage needs. */
  points?: PointsJunction;
  position?: PointsPosition;
}

/** Can a train arriving at `nodeId` on piece `from` continue onto piece `to`? */
export function passage(topo: Topology, nodeId: number, from: number, to: number): Passage {
  if (from === to) return { ok: false };
  const node = topo.nodes[nodeId];
  const pf = topo.pieces[from];
  const pt = topo.pieces[to];
  const arrive = outgoing(pf, nodeId);
  const leave = outgoing(pt, nodeId);
  // arriving direction is the opposite of the piece's outgoing one
  if (-dot(arrive, leave) <= MIN_TURN_DOT) return { ok: false };
  const j = node.points;
  if (!j) return { ok: true };
  const set = new Set([from, to]);
  if (set.has(j.normal) && set.has(j.reverse)) return { ok: false };
  if (!set.has(j.toe)) return { ok: false };
  return { ok: true, points: j, position: set.has(j.reverse) ? 'reverse' : 'normal' };
}

// ---------------------------------------------------------------------------------------------
// Locating objects
// ---------------------------------------------------------------------------------------------

export interface TopoLocation {
  piece: number;
  along: number;
  distance: number;
  point: Pt;
}

/**
 * The piece an object lies on: the nearest piece within `maxDistance`, preferring pieces of the
 * track/section the object names (`trackId`).
 */
export function locate(topo: Topology, p: Pt, trackId = '', maxDistance = LOCATE_DISTANCE): TopoLocation | null {
  const want = trackId.trim().toUpperCase();
  let best: TopoLocation | null = null;
  let bestPreferred: TopoLocation | null = null;
  for (const piece of topo.pieces) {
    const pr = projectPoint(p, piece.line);
    if (pr.distance > maxDistance) continue;
    const loc: TopoLocation = { piece: piece.id, along: pr.along, distance: pr.distance, point: pr.point };
    if (!best || pr.distance < best.distance) best = loc;
    const named = want !== '' && [piece.trackId, piece.sectionId, piece.linkId].some((id) => id.toUpperCase() === want);
    if (named && (!bestPreferred || pr.distance < bestPreferred.distance)) bestPreferred = loc;
  }
  return bestPreferred ?? best;
}

/** Location of a railway object (its centre). */
export function locateObject(topo: Topology, o: RailObject): TopoLocation | null {
  const c = centerOf(o.cell);
  return c ? locate(topo, c, o.values.trackId ?? '') : null;
}

/** True when travelling forward (increasing along) on the piece at `along` is the nominal direction. */
export function forwardIsNominal(piece: TopoPiece, along: number): boolean {
  return isNominalDirection(directionAt(piece.line, along));
}
