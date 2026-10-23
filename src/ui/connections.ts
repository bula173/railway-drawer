import { Cell, Graph, ConnectionConstraint, ImageBox, InternalEvent, type CellState } from '@maxgraph/core';
import type { ConnectionHandler as MaxConnectionHandler, EdgeHandler, ImageShape, InternalMouseEvent, Point, Rectangle } from '@maxgraph/core';
import { getDrawioConnectionConstraints } from '../drawio-shapes/js/shapes-core';
import { ELLIPSE_CONSTRAINTS, RECTANGLE_CONSTRAINTS, cc } from '../drawio-shapes/js/shapes-core/util';
import { getRawKind } from '../railway/object-data';
import { isLayer } from './cell-lock';
import { installPressToMove, SMALL_SHAPE_PX } from './canvas-interaction';

/**
 * Part of a vertex (as a fraction of its width/height, on each side) around its centre in which a
 * press never starts a connection, not even on a connection point lying there: the body moves.
 */
export const SOURCE_CENTRE_MARGIN = 0.25;

/**
 * Half the side (screen px, independent of the zoom) of the square around a connection point in
 * which a press starts a new connection: the 5 px 'x' plus half a pixel. Anywhere else on the
 * shape a press moves it.
 */
export const SOURCE_POINT_TOLERANCE = 3;

/** How far (screen px) inside the shape from a connection point a press may still connect. */
export const SOURCE_POINT_INWARD = 1;

/**
 * draw.io's connection point image (Graph.js mxConstraintHandler.prototype.pointImage): a small
 * blue 'x' with a white halo. maxGraph's default `images/point.gif` is not shipped with the app,
 * so the points were invisible.
 */
export const CONNECTION_POINT_IMAGE = new ImageBox(
  'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5" viewBox="0 0 5 5">' +
    '<path d="m 0 0 L 5 5 M 0 5 L 5 0" stroke-width="2" style="stroke-opacity:0.4" stroke="#ffffff"/>' +
    '<path d="m 0 0 L 5 5 M 0 5 L 5 0" stroke="#29b6f2"/></svg>'),
  5, 5,
);

/** draw.io's valid connect target colour (mxConstants.DEFAULT_VALID_COLOR in Graph.js). */
export const CONNECT_TARGET_COLOR = '#00a8ff';

/** draw.io mxRhombus.prototype.constraints (corners + edge midpoints). */
const RHOMBUS_CONSTRAINTS = [
  cc(0.5, 0), cc(1, 0.5), cc(0.5, 1), cc(0, 0.5),
  cc(0.25, 0.25), cc(0.75, 0.25), cc(0.25, 0.75), cc(0.75, 0.75),
];

/** Points of an east-pointing triangle (base, apex and its two slanted sides); rotated by `direction`. */
const TRIANGLE_CONSTRAINTS = [
  cc(0, 0), cc(0, 0.25), cc(0, 0.5), cc(0, 0.75), cc(0, 1),
  cc(0.25, 0.125), cc(0.5, 0.25), cc(0.75, 0.375), cc(1, 0.5),
  cc(0.75, 0.625), cc(0.5, 0.75), cc(0.25, 0.875),
];

/**
 * Connection points of a vertex without draw.io points of its own (no `points` style, stencil or
 * shape constraints), like draw.io's per-shape defaults: rectangles (and groups, images, labels)
 * get mxRectangleShape's 16 points (corners, quarters, midpoints), ellipses mxEllipse's 8,
 * rhombus and triangle their outline points. No centre point: a press in the middle moves.
 */
export function defaultConnectionConstraints(state: CellState): ConnectionConstraint[] {
  const shape = String((state.style as Record<string, unknown> | undefined)?.shape ?? '');
  if (shape === 'ellipse' || shape === 'doubleEllipse') return ELLIPSE_CONSTRAINTS;
  if (shape === 'rhombus') return RHOMBUS_CONSTRAINTS;
  if (shape === 'triangle') return TRIANGLE_CONSTRAINTS;
  return RECTANGLE_CONSTRAINTS;
}

/** Whether graph point (x, y) lies in the central part of `state` (see SOURCE_CENTRE_MARGIN). */
export function isInVertexCentre(state: CellState, x: number, y: number): boolean {
  if (!state.cell?.isVertex()) return false;
  const mx = state.width * SOURCE_CENTRE_MARGIN;
  const my = state.height * SOURCE_CENTRE_MARGIN;
  return x > state.x + mx && x < state.x + state.width - mx && y > state.y + my && y < state.y + state.height - my;
}

/**
 * A railway symbol drawn as a group (ERTMS signals, trains: a `group` vertex holding stencil parts)
 * that carries railway data (`rdKind`). It connects as a whole, like one shape.
 */
export function isSymbolGroup(cell: Cell | null | undefined): boolean {
  if (!cell || !cell.isVertex() || !cell.parent || !getRawKind(cell)) return false;
  if ((cell.children ?? []).length === 0) return false;
  // layers are root children, never railway objects; checked cheaply without a graph
  return !!cell.parent.parent;
}

let symbolConnectInstalled = false;

/**
 * ERTMS symbols (groups) connect as a whole: the library stores their group with
 * `connectable="0"` (draw.io then connects to one of the stencil parts, and a press on a part
 * started nothing). The group is connectable and its parts are not, so maxGraph's "connectable
 * parent" fallback (ConstraintHandler/ConnectionHandler/EdgeHandler markers) hits the group.
 * The cell's own `connectable` flag (saved to the file) is untouched.
 */
export function installSymbolGroupConnect(): void {
  // Installed once per page (not per tab). A prototype patch because maxGraph asks the cell
  // directly (`cell.isConnectable()` in ConstraintHandler.getCellForEvent, CellMarker, EdgeHandler),
  // not graph.isCellConnectable; on the read-only scenario/thumbnail graphs it changes nothing
  // visible (no connection handling there).
  if (symbolConnectInstalled) return;
  symbolConnectInstalled = true;
  const proto = Cell.prototype as unknown as { isConnectable(this: Cell): boolean };
  const orig = proto.isConnectable;
  proto.isConnectable = function isConnectable(this: Cell): boolean {
    if (this.isVertex()) {
      if (isSymbolGroup(this)) return true;
      for (let p = this.parent; p && p.parent; p = p.parent) {
        if (isSymbolGroup(p)) return false;
      }
    }
    return orig.call(this);
  };
}

/**
 * Makes the connection handler start like draw.io's: only from a connection point (the
 * ConstraintHandler's focus icons). maxGraph's default also starts a connection when the press is
 * in the vertex's central "hotspot" (CellMarker hotspot, previous = the hovered vertex), so a drag
 * from the middle of a shape drew a new edge instead of moving it, and a click on a group's child
 * selected the child (the connection handler's click selection) instead of the group.
 * - isValidSource: no hovered vertex becomes the source before a connection has started (draw.io
 *   Graph.js disables the built-in connection start the same way); targets are unaffected.
 * - the connection-point hit test ignores presses in the vertex's centre, so small shapes (ERTMS
 *   signals/balises) whose points lie near the middle still move when dragged by their body.
 */
export function installDrawioConnectionStart(graph: Graph): void {
  const handler = graph.getPlugin('ConnectionHandler') as MaxConnectionHandler | undefined;
  if (!handler) return;
  const origValidSource = handler.isValidSource.bind(handler);
  handler.isValidSource = (cell: Cell, me: InternalMouseEvent): boolean =>
    handler.first !== null && origValidSource(cell, me);

  const constraints = handler.constraintHandler;
  const origIntersects = constraints.intersects.bind(constraints);
  // the pointer itself: update() also tests a grid-snapped point, which must not start a connection
  let pointer: { x: number; y: number } | null = null;
  constraints.intersects = (icon: ImageShape, mouse: Rectangle, source: boolean, existingEdge: boolean): boolean => {
    if (source && !existingEdge && handler.first === null) {
      // a new connection starts only on the point itself (see isOnSourcePoint)
      const focus = constraints.currentFocus;
      const x = pointer?.x ?? mouse.getCenterX();
      const y = pointer?.y ?? mouse.getCenterY();
      return !!icon.bounds && isOnSourcePoint(icon.bounds, x, y, focus);
    }
    return origIntersects(icon, mouse, source, existingEdge);
  };

  // draw.io Graph.js: no connection points on a selected cell as a source (a press on a selected
  // shape always moves it; its handles take over), and Alt hides the points (draw.io
  // mxConstraintHandler.update)
  constraints.isStateIgnored = (state: CellState, source = false): boolean =>
    source && graph.isCellSelected(state.cell);
  const origUpdate = constraints.update.bind(constraints);
  constraints.update = (me: InternalMouseEvent, source: boolean, existingEdge: boolean, point: Point | null): void => {
    const evt = me.getEvent() as MouseEvent | undefined;
    pointer = { x: me.getGraphX(), y: me.getGraphY() };
    try {
      if (evt?.altKey && !constraints.isKeepFocusEvent(me)) constraints.reset();
      else origUpdate(me, source, existingEdge, point as Point);
    } finally {
      pointer = null;
    }
    // honest cursor: crosshair exactly where a press starts a connection (the point is highlighted);
    // elsewhere on an 'x' (its image redirects the press to the shape, which then moves) `move`
    graph.container.classList.toggle('rd-cursor-connect',
      source && !existingEdge && handler.first === null && !graph.isMouseDown && !!constraints.currentConstraint);
    const focus = constraints.currentFocus;
    if (focus && source && constraints.focusIcons.length > 0) {
      const cursor = graph.isCellMovable(focus.cell) ? 'move' : '';
      for (const icon of constraints.focusIcons) if (icon.node && icon.node.style.cursor !== cursor) icon.node.style.cursor = cursor;
    }
  };
  const origReset = constraints.reset.bind(constraints);
  constraints.reset = (): void => {
    origReset();
    graph.container?.classList.remove('rd-cursor-connect');
  };
  graph.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
    const focus = constraints.currentFocus;
    if (focus && handler.first === null && constraints.isStateIgnored(focus, true)) {
      constraints.currentFocus = null;
      constraints.constraints = null as unknown as ConnectionConstraint[];
      constraints.destroyIcons();
    }
    constraints.destroyFocusHighlight();
  });
}

/**
 * Whether a press at screen point (x, y) (graph container coordinates) starts a new connection
 * from the connection point drawn at `iconBounds`: only within SOURCE_POINT_TOLERANCE screen px
 * of the point's centre (not scaled with the zoom), and never in the central part of the vertex.
 * maxGraph's default (mouse box of 2 x graph.tolerance against the 5 px icon, ~6.5 px around
 * every point) covered most of a small shape, so a press meant to move it drew an edge.
 */
export function isOnSourcePoint(iconBounds: { x: number; y: number; width: number; height: number }, x: number, y: number,
  focus: CellState | null): boolean {
  if (focus && isInVertexCentre(focus, x, y)) return false;
  const px = iconBounds.x + iconBounds.width / 2;
  const py = iconBounds.y + iconBounds.height / 2;
  if (Math.abs(px - x) > SOURCE_POINT_TOLERANCE || Math.abs(py - y) > SOURCE_POINT_TOLERANCE) return false;
  if (!focus) return true;
  // on the point or outside the outline there, not inside the shape: the press must not lie more
  // than SOURCE_POINT_INWARD px from the point towards the shape's centre (a press 2 px inside the
  // edge of a rectangle moves it). Small shapes and railway symbols: only points on the bounds,
  // and the press on the edge pixel or outside (their body is all "near an edge")
  if (isSmallSource(focus)) {
    if (!isOnBoundsSide(focus, px, py)) return false;
    // the outline pixel or outside
    return inwardDistance(focus, px, py, x, y) <= 0.5;
  }
  return inwardDistance(focus, px, py, x, y) <= SOURCE_POINT_INWARD;
}

/** A vertex under SMALL_SHAPE_PX on screen, or a railway symbol (rdKind on it or an ancestor). */
function isSmallSource(state: CellState): boolean {
  if (state.width < SMALL_SHAPE_PX || state.height < SMALL_SHAPE_PX) return true;
  for (let c: Cell | null = state.cell; c && c.parent; c = c.parent) {
    if (getRawKind(c)) return true;
  }
  return false;
}

function isOnBoundsSide(state: CellState, px: number, py: number): boolean {
  const e = 1.5;
  return Math.abs(px - state.x) <= e || Math.abs(px - state.x - state.width) <= e ||
    Math.abs(py - state.y) <= e || Math.abs(py - state.y - state.height) <= e;
}

/**
 * How far (screen px) press (x, y) lies inside the shape `state` from its point (px, py): for a
 * point on a side of the bounds, the depth perpendicular to that side (the deeper of two at a
 * corner); for a point inside the bounds (ellipse diagonals, triangle slants), along the
 * direction from the centre to the point.
 */
function inwardDistance(state: CellState, px: number, py: number, x: number, y: number): number {
  const e = 1.5;
  const depths: number[] = [];
  // measured from the outline itself (the 'x' is drawn at whole pixels, up to half a pixel off)
  if (Math.abs(px - state.x) <= e) depths.push(x - state.x);
  if (Math.abs(px - (state.x + state.width)) <= e) depths.push(state.x + state.width - x);
  if (Math.abs(py - state.y) <= e) depths.push(y - state.y);
  if (Math.abs(py - (state.y + state.height)) <= e) depths.push(state.y + state.height - y);
  if (depths.length > 0) return Math.max(...depths);
  const vx = px - state.getCenterX();
  const vy = py - state.getCenterY();
  const len = Math.hypot(vx, vy);
  if (len < 1) return Infinity;
  return ((px - x) * vx + (py - y) * vy) / len;
}

/**
 * Edge ends like draw.io: visible connection points ('x'), a valid target outlined in blue, and
 * an edge end dropped on a shape's body (not on a point) connects floating. maxGraph 0.10.3's
 * EdgeHandler always passes `outline = true` to updatePreviewState (mxGraph passed the result of
 * isOutlineConnectEvent), which turned every body drop into a fixed point at the drop position.
 */
export function installDrawioEdgeEnds(graph: Graph): void {
  const handler = graph.getPlugin('ConnectionHandler') as MaxConnectionHandler | undefined;
  if (handler) {
    handler.constraintHandler.pointImage = CONNECTION_POINT_IMAGE;
    if (handler.marker) handler.marker.validColor = CONNECT_TARGET_COLOR;
  }
  // Composition (tabs.ts order): wraps drawio-shapes/handles/install.ts's createEdgeHandler
  // (installDrawioHandles runs first), so the draw.io handles are built and then configured here
  const baseCreate = graph.createEdgeHandler.bind(graph);
  graph.createEdgeHandler = ((state: CellState, edgeStyle: unknown) => {
    const h = baseCreate(state, edgeStyle as never) as EdgeHandler & { outline?: boolean };
    h.outline = h.outlineConnect;
    h.constraintHandler.pointImage = CONNECTION_POINT_IMAGE;
    if (h.marker) h.marker.validColor = CONNECT_TARGET_COLOR;
    return h;
  }) as Graph['createEdgeHandler'];
}

export class ConnectionHandler {
  constructor(graph: Graph) {
    installSymbolGroupConnect();
    this.configureConnectionConstraints(graph);
    installDrawioConnectionStart(graph);
    installDrawioEdgeEnds(graph);
    // after installDrawioHandles (tabs.ts): wraps its createVertexHandler (sizers of small shapes)
    installPressToMove(graph);
  }

  private configureConnectionConstraints(graph: Graph): void {
    const originalGetAllConstraints = graph.getAllConnectionConstraints.bind(graph);

    graph.getAllConnectionConstraints = function (terminal: CellState | null, source: boolean) {
      const constraints = originalGetAllConstraints(terminal, source);

      if (terminal && terminal.cell && terminal.cell.isVertex() && !isLayer(graph, terminal.cell)) {
        // draw.io shapes: their own fixed points (`points` style, getConstraints, stencil, constraints)
        const drawio = getDrawioConnectionConstraints(terminal);
        if (drawio && drawio.length > 0) return drawio;
        return defaultConnectionConstraints(terminal);
      }

      return constraints || [];
    };
  }
}

