/**
 * Edge Routing Manager
 * Manage edge routing styles (orthogonal, direct, curved)
 */

export class EdgeRoutingManager {
  constructor(private graph: any) {}

  /**
   * Set edge to orthogonal (manhattan) routing
   */
  setOrthogonalRouting(edge: any): void {
    if (!edge.isEdge?.()) return;

    edge.style = edge.style || {};
    edge.style.rounded = false;
    edge.style.orthogonalLoop = false;
    edge.style.edgeStyle = 'orthogonalEdgeStyle';

    this.graph.view.refresh();
  }

  /**
   * Set edge to direct (straight line) routing
   */
  setDirectRouting(edge: any): void {
    if (!edge.isEdge?.()) return;

    edge.style = edge.style || {};
    edge.style.rounded = false;
    edge.style.edgeStyle = undefined;

    this.graph.view.refresh();
  }

  /**
   * Set edge to curved routing
   */
  setCurvedRouting(edge: any): void {
    if (!edge.isEdge?.()) return;

    edge.style = edge.style || {};
    edge.style.rounded = true;
    edge.style.edgeStyle = undefined;

    this.graph.view.refresh();
  }

  /**
   * Apply routing style to selected edges
   */
  applyRoutingToSelection(routingType: 'orthogonal' | 'direct' | 'curved'): void {
    const parent = this.graph.getDefaultParent();
    if (!parent || !parent.children) return;

    const edges = parent.children.filter((cell: any) => cell.isEdge?.());

    edges.forEach((edge: any) => {
      switch (routingType) {
        case 'orthogonal':
          this.setOrthogonalRouting(edge);
          break;
        case 'direct':
          this.setDirectRouting(edge);
          break;
        case 'curved':
          this.setCurvedRouting(edge);
          break;
      }
    });
  }

  /**
   * Add arrows to edge
   */
  addArrows(edge: any, sourceArrow: boolean = false, targetArrow: boolean = true): void {
    if (!edge.isEdge?.()) return;

    edge.style = edge.style || {};
    edge.style.startArrow = sourceArrow ? 'classic' : 'none';
    edge.style.endArrow = targetArrow ? 'classic' : 'none';

    this.graph.view.refresh();
  }

  /**
   * Remove arrows from edge
   */
  removeArrows(edge: any): void {
    if (!edge.isEdge?.()) return;

    edge.style = edge.style || {};
    edge.style.startArrow = 'none';
    edge.style.endArrow = 'none';

    this.graph.view.refresh();
  }

  /**
   * Set edge appearance (dashed, solid, dotted)
   */
  setEdgeStyle(edge: any, style: 'solid' | 'dashed' | 'dotted'): void {
    if (!edge.isEdge?.()) return;

    edge.style = edge.style || {};

    switch (style) {
      case 'dashed':
        edge.style.dashed = true;
        edge.style.dashPattern = '6 4';
        break;
      case 'dotted':
        edge.style.dashed = true;
        edge.style.dashPattern = '2 2';
        break;
      case 'solid':
      default:
        edge.style.dashed = false;
        break;
    }

    this.graph.view.refresh();
  }
}
