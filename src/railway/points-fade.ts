/**
 * @file points-fade.ts
 * @brief Points in reverse: the straight continuation (normal leg) is faded for the length of the
 *        points, like the diverging leg is faded while the points are normal (states.ts).
 *
 * The straight leg of ERTMS points belongs to the track (one track edge, the points cell is only
 * the diverging leg), so it cannot take a style of its own without splitting the track, which
 * would change the topology, the railML export and every template. Instead the fade is a view
 * overlay (graph-overlay.ts: an SVG group in the overlay pane, graph coordinates, not in the
 * model): over the first `length` of the normal piece at the junction a line in the canvas colour
 * at `REVERSE_FADE_OPACITY` covers the drawn track, so it shows at the same 30 % as a normal-position
 * diverging leg. Nothing is saved or undoable; it follows the model (rdPosition, moves, states)
 * and the zoom. Topology (topology.ts `PointsJunction`): toe / normal / reverse pieces of the node.
 */
import { onModelChange } from '../core/graph-events';
import type { Cell, Graph, GraphDataModel } from '@maxgraph/core';
import type { Pt } from './geometry';
import { GraphOverlay, pointsAttr, svgEl } from './graph-overlay';
import { allCells, getCellKind, readAttr } from './object-data';
import { INACTIVE_LEG_OPACITY, POSITION_ATTR } from './states';
import { buildTopology, subPolyline } from './topology';
import type { TopoPiece } from './topology';
import { collectObjects } from './validation';

/** Opacity of the cover line: the straight leg then shows at INACTIVE_LEG_OPACITY (30 %). */
export const REVERSE_FADE_OPACITY = (100 - INACTIVE_LEG_OPACITY) / 100;
/** Shortest faded length (graph units) when the leg is almost perpendicular. */
const MIN_FADE_LENGTH = 15;

export interface FadeSegment {
  /** The points object (cell id and rdId). */
  cellId: string;
  pointsId: string;
  /** Faded part of the straight continuation, from the junction. */
  line: Pt[];
  /** Stroke width of the line drawn there (track / section on it), cover is 2 wider. */
  width: number;
}

function strokeWidthOf(cell: Cell | null | undefined): number {
  const style = cell?.getStyle() as Record<string, unknown> | null | undefined;
  const n = Number.parseFloat(String(style?.strokeWidth ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** True when some points of the model are reverse (cheap test before building the topology). */
export function hasReversePoints(model: GraphDataModel): boolean {
  return allCells(model).some((c) => getCellKind(c) === 'points' && readAttr(c, POSITION_ATTR).trim() === 'reverse');
}

/**
 * The straight continuations to fade: for every points junction whose points are reverse, the
 * normal piece from the junction for the length of the diverging leg along it (its projection,
 * at least 15, at most the piece).
 */
export function reverseFadeSegments(model: GraphDataModel): FadeSegment[] {
  if (!hasReversePoints(model)) return [];
  const objects = collectObjects(model);
  const topo = buildTopology(objects);
  const sectionCell = new Map(objects.filter((o) => o.kind.id === 'trackSection' && o.id).map((o) => [o.id.toUpperCase(), o.cell]));
  const out: FadeSegment[] = [];
  const pieceById = new Map<number, TopoPiece>(topo.pieces.map((p) => [p.id, p]));
  for (const node of topo.nodes) {
    const j = node.points;
    if (!j) continue;
    const cell = model.getCell(j.cellId);
    if (!cell || readAttr(cell, POSITION_ATTR).trim() !== 'reverse') continue;
    const normal = pieceById.get(j.normal);
    const leg = pieceById.get(j.reverse);
    if (!normal || !leg || normal.line.length < 2 || leg.line.length < 2) continue;
    const fromStart = normal.a === node.id;
    const line = fromStart ? normal.line : [...normal.line].reverse();
    const legLine = leg.a === node.id ? leg.line : [...leg.line].reverse();
    // direction of the straight continuation at the junction, and the leg's extent along it
    const d = { x: line[1].x - line[0].x, y: line[1].y - line[0].y };
    const dl = Math.hypot(d.x, d.y) || 1;
    const far = legLine[legLine.length - 1];
    const along = Math.abs(((far.x - legLine[0].x) * d.x + (far.y - legLine[0].y) * d.y) / dl);
    const length = Math.min(normal.length, Math.max(MIN_FADE_LENGTH, along));
    const part = subPolyline(line, 0, length);
    const drawn = [model.getCell(normal.linkCellId), normal.sectionId ? sectionCell.get(normal.sectionId.toUpperCase()) : null];
    const width = Math.max(...drawn.map((c) => (c ? strokeWidthOf(c) : 1)));
    out.push({ cellId: j.cellId, pointsId: j.pointsId, line: part, width });
  }
  return out;
}

/** The colour the cover line takes: the canvas behind the drawing. */
function canvasColor(graph: Graph): string {
  const bg = graph.container ? getComputedStyle(graph.container).backgroundColor : '';
  return bg && bg !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg) ? bg : '#ffffff';
}

/**
 * Keeps the reverse fade of `graph` up to date (model changes, zoom/scroll via GraphOverlay).
 * Returns the uninstaller.
 */
export function installPointsFade(graph: Graph): () => void {
  let overlay: GraphOverlay | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const draw = (): void => {
    timer = null;
    const segments = reverseFadeSegments(graph.getDataModel());
    if (segments.length === 0) {
      overlay?.clear();
      return;
    }
    overlay ??= new GraphOverlay(graph, 'rd-points-fade');
    const color = canvasColor(graph);
    overlay.set(
      segments.map((s) =>
        svgEl('polyline', {
          points: pointsAttr(s.line),
          fill: 'none',
          stroke: color,
          'stroke-opacity': REVERSE_FADE_OPACITY,
          'stroke-width': s.width + 2,
          'stroke-linecap': 'butt',
          'data-points': s.pointsId || s.cellId,
        })
      )
    );
  };
  // once per batch of model changes (a drag, an undo): after the view has been updated
  const schedule = (): void => {
    timer ??= setTimeout(draw, 0);
  };
  const offModel = onModelChange(graph, schedule);
  draw();
  return () => {
    offModel();
    if (timer) clearTimeout(timer);
    timer = null;
    overlay?.destroy();
    overlay = null;
  };
}
