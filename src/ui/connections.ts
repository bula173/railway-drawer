import { Graph, ConnectionConstraint, Point, type CellState } from '@maxgraph/core';
import type { Cell, ConnectionHandler as MaxConnectionHandler, ImageShape, InternalMouseEvent, Rectangle } from '@maxgraph/core';
import { getDrawioConnectionConstraints } from '../drawio-shapes/js/shapes-core';

/**
 * Part of a vertex (as a fraction of its width/height, on each side) around its centre in which a
 * press never starts a connection, not even on a connection point lying there: the body moves.
 */
export const SOURCE_CENTRE_MARGIN = 0.25;

/** Whether graph point (x, y) lies in the central part of `state` (see SOURCE_CENTRE_MARGIN). */
export function isInVertexCentre(state: CellState, x: number, y: number): boolean {
  if (!state.cell?.isVertex()) return false;
  const mx = state.width * SOURCE_CENTRE_MARGIN;
  const my = state.height * SOURCE_CENTRE_MARGIN;
  return x > state.x + mx && x < state.x + state.width - mx && y > state.y + my && y < state.y + state.height - my;
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
  constraints.intersects = (icon: ImageShape, mouse: Rectangle, source: boolean, existingEdge: boolean): boolean => {
    const focus = constraints.currentFocus;
    if (source && !existingEdge && handler.first === null && focus &&
      isInVertexCentre(focus, mouse.getCenterX(), mouse.getCenterY())) {
      return false;
    }
    return origIntersects(icon, mouse, source, existingEdge);
  };
}

export class ConnectionHandler {
  constructor(graph: Graph) {
    this.configureConnectionConstraints(graph);
    installDrawioConnectionStart(graph);
  }

  private configureConnectionConstraints(graph: Graph): void {
    // Override getAllConnectionConstraints to define connection points on all shapes
    const originalGetAllConstraints = graph.getAllConnectionConstraints.bind(graph);

    graph.getAllConnectionConstraints = function (terminal: CellState | null, source: boolean) {
      // Get original constraints if they exist
      const constraints = originalGetAllConstraints(terminal, source);

      if (terminal && terminal.cell && terminal.cell.isVertex && terminal.cell.isVertex()) {
        // draw.io shapes: their own fixed points (`points` style, getConstraints, stencil, constraints)
        const drawio = getDrawioConnectionConstraints(terminal);
        if (drawio && drawio.length > 0) return drawio;
        // Otherwise the side midpoints (top, right, bottom, left). No centre point: like draw.io,
        // a press in the middle of a shape moves it (a centre point started a connection there).
        return [
          new ConnectionConstraint(new Point(0.5, 0), false), // Top center
          new ConnectionConstraint(new Point(1, 0.5), false), // Right center
          new ConnectionConstraint(new Point(0.5, 1), false), // Bottom center
          new ConnectionConstraint(new Point(0, 0.5), false), // Left center
        ];
      }

      return constraints || [];
    };
  }
}
