import { EdgeRoutingManager } from '../edge-routing-manager';

describe('EdgeRoutingManager', () => {
  let edgeRoutingManager: EdgeRoutingManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'edge-1', isEdge: () => true, style: {} },
          { id: 'edge-2', isEdge: () => true, style: {} },
          { id: 'vertex-1', isEdge: () => false, style: {} },
        ],
      }),
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [{ id: 'edge-1', isEdge: () => true, style: {} }],
      }),
    };

    edgeRoutingManager = new EdgeRoutingManager(mockGraph);
  });

  it('should set orthogonal routing', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.setOrthogonalRouting(edge);

    expect(edge.style.edgeStyle).toBe('orthogonalEdgeStyle');
    expect(edge.style.rounded).toBe(false);
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should set direct routing', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.setDirectRouting(edge);

    expect(edge.style.edgeStyle).toBeUndefined();
    expect(edge.style.rounded).toBe(false);
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should set curved routing', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.setCurvedRouting(edge);

    expect(edge.style.rounded).toBe(true);
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should add arrows to edge', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.addArrows(edge, true, true);

    expect(edge.style.startArrow).toBe('classic');
    expect(edge.style.endArrow).toBe('classic');
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should add only end arrow', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.addArrows(edge, false, true);

    expect(edge.style.startArrow).toBe('none');
    expect(edge.style.endArrow).toBe('classic');
  });

  it('should remove arrows from edge', () => {
    const edge = { isEdge: () => true, style: { startArrow: 'classic', endArrow: 'classic' } } as any;

    edgeRoutingManager.removeArrows(edge);

    expect(edge.style.startArrow).toBe('none');
    expect(edge.style.endArrow).toBe('none');
  });

  it('should set solid edge style', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.setEdgeStyle(edge, 'solid');

    expect(edge.style.dashed).toBe(false);
  });

  it('should set dashed edge style', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.setEdgeStyle(edge, 'dashed');

    expect(edge.style.dashed).toBe(true);
    expect(edge.style.dashPattern).toBe('6 4');
  });

  it('should set dotted edge style', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    edgeRoutingManager.setEdgeStyle(edge, 'dotted');

    expect(edge.style.dashed).toBe(true);
    expect(edge.style.dashPattern).toBe('2 2');
  });

  it('should apply routing to all edges', () => {
    edgeRoutingManager.applyRoutingToSelection('orthogonal');

    const edges = mockGraph.getDefaultParent().children.filter((c: any) => c.isEdge?.());
    expect(edges.length).toBe(2);
    edges.forEach((edge: any) => {
      expect(edge.style.edgeStyle).toBe('orthogonalEdgeStyle');
    });
  });

  it('should not apply routing to vertices', () => {
    const vertex = { isEdge: () => false, style: {} } as any;

    edgeRoutingManager.setOrthogonalRouting(vertex);

    expect(vertex.style.edgeStyle).toBeUndefined();
  });

  it('should create style if not exists', () => {
    const edge = { isEdge: () => true } as any;

    edgeRoutingManager.setDirectRouting(edge);

    expect(edge.style).toBeDefined();
    expect(edge.style.rounded).toBe(false);
  });
});
