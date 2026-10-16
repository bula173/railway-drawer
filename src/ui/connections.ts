import { Graph, ConnectionConstraint, Point, type CellState } from '@maxgraph/core';
import { getDrawioConnectionConstraints } from '../drawio-shapes/js/shapes-core';

/** Legacy `graph.connectionHandler` flags; not in maxGraph's typings */
interface LegacyConnectionHandlerFlags {
  constrainedConnections?: boolean;
  waypointsEnabled?: boolean;
}

export class ConnectionHandler {
  constructor(graph: Graph) {
    this.configureConnectionConstraints(graph);
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
        // Otherwise standard connection points (top, right, bottom, left, center)
        return [
          new ConnectionConstraint(new Point(0.5, 0), false), // Top center
          new ConnectionConstraint(new Point(1, 0.5), false), // Right center
          new ConnectionConstraint(new Point(0.5, 1), false), // Bottom center
          new ConnectionConstraint(new Point(0, 0.5), false), // Left center
          new ConnectionConstraint(new Point(0.5, 0.5), false), // Center
        ];
      }

      return constraints || [];
    };

    // Enable constrained connections so connectors snap to connection points
    const connectionHandler = (graph as Graph & { connectionHandler?: LegacyConnectionHandlerFlags })
      .connectionHandler;
    if (connectionHandler) {
      connectionHandler.constrainedConnections = true;
      connectionHandler.waypointsEnabled = true;
    }

    console.log('[Connections] Connection constraints configured');
  }
}
