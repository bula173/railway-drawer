import { Graph, ConnectionConstraint, Point } from '@maxgraph/core';
import { getDrawioConnectionConstraints } from '../drawio-shapes/js/shapes-core';

export class ConnectionHandler {
  constructor(graph: Graph) {
    this.configureConnectionConstraints(graph);
  }

  private configureConnectionConstraints(graph: Graph): void {
    // Override getAllConnectionConstraints to define connection points on all shapes
    const originalGetAllConstraints = (graph as any).getAllConnectionConstraints.bind(graph);

    (graph as any).getAllConnectionConstraints = function (terminal: any, source: boolean) {
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
    const connectionHandler = (graph as any).connectionHandler;
    if (connectionHandler) {
      connectionHandler.constrainedConnections = true;
      connectionHandler.waypointsEnabled = true;
    }

    console.log('[Connections] Connection constraints configured');
  }
}
