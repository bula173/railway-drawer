/**
 * @file canvas-interaction.ts
 * @brief Pointer hits inside a shape's bounds, so a press anywhere on a shape moves it (draw.io feel).
 *
 * A draw.io group (`style=group`, no fill and no stroke) paints nothing itself, and the corners of
 * an ellipse, a stencil, an icon or a triangle balise are transparent: a press there reached
 * maxGraph as a press on the empty background and panned (or started a rubber band) instead of
 * moving the shape. Here such a press is given the cell under the pointer (`cellAtBackgroundPoint`:
 * bounds of vertices, edges within a tolerance), so the SelectionHandler selects and drags it
 * (topmost group first, like a press on one of its children). Alt+drag still forces the rubber band
 * (maxGraph's marquee event).
 */
import { installOnce } from '../core/install-once';
import { InternalEvent, type Cell, type CellState, type Graph, type InternalMouseEvent, type SelectionHandler, type VertexHandler } from '@maxgraph/core';
import { isLayer } from './cell-lock';
import { getRawKind, readObjectId, readObjectValues } from '../railway/object-data';

/** Whether `cell` is a group-like vertex: a vertex with vertex/edge children (not a layer). */
export function isGroupVertex(graph: Graph, cell: Cell | null | undefined): cell is Cell {
  if (!cell || !cell.isVertex() || isLayer(graph, cell)) return false;
  return (cell.children ?? []).some((child) => child.isVertex() || child.isEdge());
}

/**
 * Extra hit distance (screen px) around an edge's painted line for a press that reached the
 * background: draw.io finds edges within graph.tolerance + strokeWidth / 2 (Graph.isEdgeNearPoint);
 * a little more here so thin connectors and tracks are easy to grab.
 */
export const EDGE_HIT_TOLERANCE = 6;

/** Distance from (x, y) to the segment a-b. */
function segmentDistance(x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

/**
 * The cell a press at graph point (x, y) that reached the background belongs to, like draw.io
 * where every shape catches presses inside its bounds (mxShape pointerEvents: the transparent
 * corners of an ellipse, a stencil, an icon, a triangle balise, the gaps of a group) and edges
 * are found within a tolerance: maxGraph's `getCellAt` (bounds of vertices, edges within
 * graph.tolerance), then the nearest visible edge within EDGE_HIT_TOLERANCE + strokeWidth / 2,
 * then a tiny vertex (under 1 px wide or high, draw.io isTinyVertexState) grown by the tolerance.
 * Layers are never hit.
 */
export function cellAtBackgroundPoint(graph: Graph, x: number, y: number): Cell | null {
  const at = vertexAt(graph, x, y) ?? graph.getCellAt(x, y);
  if (at && !isLayer(graph, at)) return at;
  let best: Cell | null = null;
  let bestD = Infinity;
  const scale = graph.view.scale;
  const tol = graph.getEventTolerance();
  for (const state of graph.view.getStates().getValues()) {
    const cell = state.cell;
    if (!cell || !cell.isVisible() || isLayer(graph, cell) || !graph.isCellSelectable(cell)) continue;
    if (cell.isEdge()) {
      const pts = state.absolutePoints ?? [];
      const sw = Number((state.style as Record<string, unknown>).strokeWidth ?? 1) * scale;
      const limit = EDGE_HIT_TOLERANCE + sw / 2;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (!a || !b) continue;
        const d = segmentDistance(x, y, a, b);
        if (d <= limit && d < bestD) { best = cell; bestD = d; }
      }
    } else if (cell.isVertex() && (state.width < 1 || state.height < 1)) {
      if (x >= state.x - tol && x <= state.x + state.width + tol && y >= state.y - tol && y <= state.y + state.height + tol) {
        const d = Math.hypot(x - state.getCenterX(), y - state.getCenterY());
        if (d < bestD) { best = cell; bestD = d; }
      }
    }
  }
  return best;
}

/** The object a cell belongs to: its topmost ancestor below the layer. */
function topObject(graph: Graph, cell: Cell): Cell {
  let c = cell;
  while (c.parent && c.parent.parent && !isLayer(graph, c.parent)) c = c.parent;
  return c;
}

/**
 * The vertex at graph point (x, y) by bounds, preferring the smallest object (topmost ancestor
 * below the layer) among overlapping ones: a small symbol lying inside a bigger symbol's or
 * frame's bounds (an insulated joint under a signal) is pressed, not the big one. Ties keep the
 * z-order (maxGraph getCellAt, topmost first). Returns the hit cell itself (a group child stays
 * a child: the SelectionHandler picks the group first).
 */
export function vertexAt(graph: Graph, x: number, y: number): Cell | null {
  const top = graph.getCellAt(x, y, null, true, false);
  if (!top || isLayer(graph, top)) return null;
  let best = top;
  const area = (c: Cell): number => {
    const s = graph.view.getState(topObject(graph, c));
    return s ? s.width * s.height : Infinity;
  };
  let bestArea = area(top);
  const seen = new Set<Cell>([topObject(graph, top)]);
  for (const state of graph.view.getStates().getValues()) {
    const cell = state.cell;
    if (!cell?.isVertex() || isLayer(graph, cell) || !cell.isVisible() || seen.has(topObject(graph, cell))) continue;
    if (!graph.intersects(state, x, y) || !graph.isCellSelectable(topObject(graph, cell))) continue;
    const a = area(cell);
    if (a < bestArea) { best = cell; bestArea = a; }
  }
  return best;
}

/**
 * Whether graph point (x, y) lies within the view's graph bounds grown by the edge hit
 * tolerance (+ the widest stroke is covered by EDGE_HIT_TOLERANCE in practice).
 */
export function isNearGraphBounds(graph: Graph, x: number, y: number): boolean {
  const b = graph.view.getGraphBounds();
  if (!b || (b.width === 0 && b.height === 0 && b.x === 0 && b.y === 0)) return false;
  const m = EDGE_HIT_TOLERANCE + 8;
  return x >= b.x - m && x <= b.x + b.width + m && y >= b.y - m && y <= b.y + b.height + m;
}

/** Whether a DOM event target is the canvas background (no shape, handle or overlay). */
export function isBackgroundSource(graph: Graph, source: Node | null): boolean {
  const canvas = graph.view.getCanvas() as SVGElement | null;
  const background = graph.view.getBackgroundPane() as SVGElement | null;
  return !!source && (source === graph.container || source === canvas ||
    source === canvas?.ownerSVGElement || (!!background && background.contains(source)));
}

export function installGroupBackgroundHit(graph: Graph): void {
  if (!installOnce(graph, 'group-background-hit')) return;
  const origUpdate = graph.updateMouseEvent.bind(graph);
  graph.updateMouseEvent = (me: InternalMouseEvent, evtName: string): InternalMouseEvent => {
    const result = origUpdate(me, evtName);
    if (evtName === InternalEvent.MOUSE_DOWN && result.getState()) {
      const preferred = vertexOverEdge(graph, result);
      if (preferred) result.state = preferred;
      return result;
    }
    if (result.getState()) return result;
    // A press inside a shape's bounds selects/moves it (the SelectionHandler then picks the
    // topmost group first); hovering and releasing over such a spot reach connectable vertices
    // too, so their connection points show and an edge end dropped there connects to them
    if (evtName !== InternalEvent.MOUSE_DOWN && evtName !== InternalEvent.MOUSE_MOVE && evtName !== InternalEvent.MOUSE_UP) return result;
    // Only presses on the canvas background itself (handles and overlays carry their own state)
    if (!isBackgroundSource(graph, result.getSource() as Node | null)) return result;
    // cheap pre-check: outside the drawing's bounds there is nothing to hit
    if (!isNearGraphBounds(graph, result.getGraphX(), result.getGraphY())) return result;
    if (evtName === InternalEvent.MOUSE_DOWN) {
      const cell = cellAtBackgroundPoint(graph, result.getGraphX(), result.getGraphY());
      if (cell && graph.isCellSelectable(cell)) result.state = graph.view.getState(cell);
      return result;
    }
    // hovering, or dragging an edge end / a new connection, over a gap or a transparent part:
    // the connectable vertex there (its points show, a drop connects)
    const cell = graph.getCellAt(result.getGraphX(), result.getGraphY());
    const connectable = !!cell && (cell.isConnectable() || (!!cell.parent && cell.parent.isVertex() && cell.parent.isConnectable()));
    if (cell && connectable && cell.isVertex() && !isLayer(graph, cell) && graph.isCellSelectable(cell)) {
      result.state = graph.view.getState(cell);
    }
    return result;
  };
}

/**
 * Dropping a shape on an edge splits the edge (maxGraph/draw.io `isSplitTarget`). Like draw.io,
 * Alt or Shift prevent it; railway objects never split and are never split, and a railway
 * symbol group (rdKind on a group vertex) is never a drop target: a balise or signal
 * dropped on a track (an edge) is placed on it (snap to track) instead of cutting the track into
 * two edges connected to the symbol.
 */
export function installRailwaySplitRules(graph: Graph): void {
  if (!installOnce(graph, 'railway-split-rules')) return;
  // A railway symbol drawn as a group (ERTMS signal, train) is one object: nothing is dropped into it.
  // Composition (tabs.ts order): this wraps drawio-shapes/behaviour/containers.ts's
  // isValidDropTarget (installed earlier by installDrawioBehaviour), so the symbol veto comes first
  const origDropTarget = graph.isValidDropTarget.bind(graph);
  graph.isValidDropTarget = ((cell: Cell, cells?: Cell[], evt?: MouseEvent | null): boolean =>
    !(isGroupVertex(graph, cell) && getRawKind(cell)) && origDropTarget(cell, cells as Cell[], evt as MouseEvent)) as Graph['isValidDropTarget'];
  const orig = graph.isSplitTarget.bind(graph);
  graph.isSplitTarget = (target: Cell, cells: Cell[] = [], evt?: MouseEvent | null): boolean => {
    if (evt && (evt.altKey || evt.shiftKey)) return false;
    if (getRawKind(target) || cells.some((c) => getRawKind(c))) return false;
    return orig(target, cells, evt);
  };
}

/** Whether `cell` or an ancestor (below the layer) is a railway object (rdKind). */
export function isRailwayObject(graph: Graph, cell: Cell | null | undefined): boolean {
  for (let c = cell; c && !isLayer(graph, c) && c.parent; c = c.parent) {
    if (getRawKind(c)) return true;
  }
  return false;
}

/** Distance (screen px) from (x, y) to the painted line of an edge state. */
function edgeDistance(state: CellState, x: number, y: number): number {
  const pts = state.absolutePoints ?? [];
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b) d = Math.min(d, segmentDistance(x, y, a, b));
  }
  return d;
}

/**
 * A press whose DOM target is an (unselected) edge's line but which lies inside a vertex's bounds:
 * the vertex wins when it is a railway symbol (a signal beside a track, a balise on it: the
 * track's hit tolerance or a marker line must not steal the press) or when the press is only in
 * the edge's hit halo, not on its painted stroke. Handles and labels are left alone.
 */
function vertexOverEdge(graph: Graph, me: InternalMouseEvent): CellState | null {
  const state = me.getState();
  const edge = state?.cell;
  if (!state || !edge?.isEdge() || graph.isCellSelected(edge)) return null;
  const source = me.getSource() as Node | null;
  if (!source || !state.shape?.node?.contains(source)) return null;
  const x = me.getGraphX();
  const y = me.getGraphY();
  const vertex = vertexAt(graph, x, y);
  if (!vertex || !graph.isCellSelectable(topObject(graph, vertex))) return null;
  if (vertex.isAncestor(edge) || edge.isAncestor(vertex)) return null;
  const sw = Number((state.style as Record<string, unknown>).strokeWidth ?? 1) * graph.view.scale;
  const onStroke = edgeDistance(state, x, y) <= sw / 2 + 1;
  if (!isRailwayObject(graph, vertex) && onStroke) return null;
  return graph.view.getState(vertex);
}

/**
 * draw.io Alt+click (Graph.isTransparentClickEvent + mxGraph.click): the cell under the pointer
 * below the selected one, cycling back to the top (maxGraph 0.10.3's own implementation asks
 * getCellAt for neither vertices nor edges and never finds one).
 */
export function cellBehind(graph: Graph, me: InternalMouseEvent): Cell | null {
  const top = me.getCell();
  if (!top) return null;
  let active = false;
  return graph.getCellAt(me.getGraphX(), me.getGraphY(), null, true, true, (state: CellState) => {
    const selected = graph.isCellSelected(state.cell);
    active = active || selected;
    return !active || selected || (state.cell !== top && state.cell.isAncestor(top)) || isLayer(graph, state.cell);
  });
}

/** Screen size under which a vertex only gets its bottom-right sizer (outside the shape). */
export const SMALL_SHAPE_PX = 32;

/** Gap (screen px) between a small shape's corner and its sizer: more than the sizer hit tolerance. */
const SIZER_CLEARANCE = 6;

/**
 * Members that move with a dragged railway object although they are separate cells: the balises
 * of a balise group (their `groupId` names the group, centre inside the group's frame grown by
 * 20) and the points legs of a track (unconnected `points` edges starting on the dragged track:
 * a track-layout turnout is a track edge plus a loose leg).
 */
export function companionCells(graph: Graph, cells: Cell[]): Cell[] {
  const moving = new Set(cells);
  const extra: Cell[] = [];
  const add = (c: Cell): void => {
    if (!moving.has(c) && graph.isCellMovable(c)) { moving.add(c); extra.push(c); }
  };
  const groups = cells.filter((c) => c.isVertex() && getRawKind(c) === 'baliseGroup');
  const tracks = cells.filter((c) => c.isEdge() && getRawKind(c) === 'track');
  if (groups.length === 0 && tracks.length === 0) return cells;
  const scale = graph.view.scale;
  for (const g of groups) {
    const id = readObjectId(g);
    const gs = graph.view.getState(g);
    if (!id || !gs || !g.parent) continue;
    const m = 20 * scale;
    for (const b of g.parent.children ?? []) {
      if (!b.isVertex() || getRawKind(b) !== 'balise' || (readObjectValues(b).groupId ?? '').trim() !== id) continue;
      const bs = graph.view.getState(b);
      if (bs && bs.getCenterX() >= gs.x - m && bs.getCenterX() <= gs.x + gs.width + m &&
        bs.getCenterY() >= gs.y - m && bs.getCenterY() <= gs.y + gs.height + m) add(b);
    }
  }
  for (const t of tracks) {
    const ts = graph.view.getState(t);
    if (!ts || !t.parent) continue;
    for (const leg of t.parent.children ?? []) {
      if (!leg.isEdge() || getRawKind(leg) !== 'points' || leg.getTerminal(true) || leg.getTerminal(false)) continue;
      const ls = graph.view.getState(leg);
      const pts = ls?.absolutePoints ?? [];
      const ends = [pts[0], pts[pts.length - 1]].filter((p): p is NonNullable<typeof p> => !!p);
      if (ends.some((p) => edgeDistance(ts, p.x, p.y) <= 1.5 * scale)) add(leg);
    }
  }
  return extra.length > 0 ? [...cells, ...extra] : cells;
}

/**
 * The rest of "press to move" (installed by the tab's ConnectionHandler, after the draw.io
 * handles):
 * - Shift+click toggles the selection like Ctrl/Cmd+click (draw.io isToggleEvent);
 * - companion cells move with balise groups and tracks (companionCells);
 * - small shapes (under SMALL_SHAPE_PX on screen) and railway symbols only get the bottom-right
 *   sizer, placed outside small shapes (maxGraph manageSizers padding), so a press on their body
 *   moves instead of resizing (draw.io manages sizers of small shapes the same way);
 * - honest cursors: `move` over the inside of a movable shape that the DOM misses (transparent
 *   parts, gaps), set once per animation frame.
 */
export function installPressToMove(graph: Graph): void {
  if (!installOnce(graph, 'press-to-move')) return;
  // Alt+click: the cell behind (draw.io isTransparentClickEvent; Alt+press itself starts the
  // rubber band, so the click on release decides). maxGraph's click() then asks getCellAt for
  // neither vertices nor edges, finds nothing and keeps the cell given here.
  graph.isTransparentClickEvent = (evt: MouseEvent): boolean =>
    !!evt && evt.altKey && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey;
  const origClick = graph.click.bind(graph);
  graph.click = (me: InternalMouseEvent): boolean => {
    if (graph.isTransparentClickEvent(me.getEvent() as MouseEvent) && me.getCell()) {
      const behind = cellBehind(graph, me);
      const state = behind ? graph.view.getState(behind) : null;
      if (state) me.state = state;
    }
    return origClick(me);
  };
  const origToggle = graph.isToggleEvent.bind(graph);
  graph.isToggleEvent = (evt: MouseEvent): boolean => origToggle(evt) || (!!evt && evt.shiftKey);

  const selection = graph.getPlugin('SelectionHandler') as SelectionHandler | undefined;
  if (selection) {
    const origCells = selection.getCells.bind(selection);
    selection.getCells = (initial: Cell): Cell[] => companionCells(graph, origCells(initial));
  }

  const baseVertex = graph.createVertexHandler.bind(graph);
  graph.createVertexHandler = ((state: CellState) => {
    const h = baseVertex(state) as VertexHandler;
    h.manageSizers = true;
    const origRedraw = h.redrawHandles.bind(h);
    h.redrawHandles = (): void => {
      origRedraw();
      const sizers = h.sizers ?? [];
      if (sizers.length < 8 || h.index !== null) return;
      const st = h.state;
      const small = st.width < SMALL_SHAPE_PX || st.height < SMALL_SHAPE_PX || isRailwayObject(graph, st.cell);
      if (!small) return;
      sizers.forEach((sz, i) => {
        if (i !== 7 && sz?.node) sz.node.style.display = 'none';
      });
      // the bottom-right sizer diagonally outside the corner, beyond its own hit tolerance
      // (maxGraph hits a sizer within strokeWidth + svgStrokeTolerance of it), so no press on
      // the body reaches it; rotated shapes keep maxGraph's placement
      const se = sizers[7];
      const rotation = Number((st.style as Record<string, unknown>).rotation ?? 0);
      if (se?.bounds && rotation % 360 === 0) {
        const d = se.bounds.width / 2 + SIZER_CLEARANCE;
        h.moveSizerTo(se, st.x + st.width + d, st.y + st.height + d);
      }
    };
    // the constructor already drew the handles (without the padding and the policy)
    h.redrawHandles();
    return h;
  }) as Graph['createVertexHandler'];

  // honest cursor over parts the DOM misses (the shapes themselves set `move`)
  const container = graph.container;
  let frame = 0;
  let last: { x: number; y: number; bg: boolean } | null = null;
  const refresh = (): void => {
    frame = 0;
    const p = last;
    if (!p) return;
    let move = false;
    if (p.bg && !graph.isMouseDown && isNearGraphBounds(graph, p.x, p.y)) {
      const cell = cellAtBackgroundPoint(graph, p.x, p.y);
      move = !!cell && graph.isCellSelectable(cell) && graph.isCellMovable(cell);
    }
    container.classList.toggle('rd-cursor-move', move);
  };
  graph.addMouseListener({
    mouseDown: () => container.classList.remove('rd-cursor-move'),
    mouseMove: (_sender: unknown, me: InternalMouseEvent) => {
      last = { x: me.getGraphX(), y: me.getGraphY(), bg: isBackgroundSource(graph, me.getSource() as Node | null) };
      if (!frame) frame = requestAnimationFrame(refresh);
    },
    mouseUp: () => undefined,
  });
}

/**
 * maxGraph's PopupMenuHandler (no menu of its own here) also selected the cell under the mouse-up,
 * or cleared the selection when that was a gap (a group's transparent area, ERTMS symbols): the
 * selection changed after Lock & co. The context menu decides what a right-click selects.
 */
export function disableSelectOnPopup(graph: Graph): void {
  const popup = graph.getPlugin('PopupMenuHandler') as { selectOnPopup?: boolean; clearSelectionOnBackground?: boolean } | undefined;
  if (popup) {
    popup.selectOnPopup = false;
    popup.clearSelectionOnBackground = false;
  }
}
