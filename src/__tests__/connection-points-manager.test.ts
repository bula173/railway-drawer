import { ConnectionPointsManager } from '../connection-points-manager';

describe('ConnectionPointsManager', () => {
  let connectionPointsManager: ConnectionPointsManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [{ id: 'vertex-1', isVertex: () => true, style: {} }],
      }),
    };

    connectionPointsManager = new ConnectionPointsManager(mockGraph);
  });

  it('should add connection point to shape', () => {
    const cell = { isVertex: () => true, style: {} } as any;

    connectionPointsManager.addConnectionPoint(cell, 0.5, 0);

    expect(cell.style.connectionPoints).toBeDefined();
    expect(cell.style.connectionPoints.length).toBe(1);
    expect(cell.style.connectionPoints[0]).toEqual({ x: 0.5, y: 0, perimeter: 1 });
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should clamp connection point coordinates', () => {
    const cell = { isVertex: () => true, style: {} } as any;

    connectionPointsManager.addConnectionPoint(cell, 1.5, -0.5);

    expect(cell.style.connectionPoints[0].x).toBe(1);
    expect(cell.style.connectionPoints[0].y).toBe(0);
  });

  it('should set multiple connection points', () => {
    const cell = { isVertex: () => true, style: {} } as any;
    const points = [
      { x: 0.5, y: 0, perimeter: 1 },
      { x: 1, y: 0.5, perimeter: 1 },
    ];

    connectionPointsManager.setConnectionPoints(cell, points);

    expect(cell.style.connectionPoints.length).toBe(2);
  });

  it('should clear connection points', () => {
    const cell = { isVertex: () => true, style: { connectionPoints: [{ x: 0.5, y: 0 }] } } as any;

    connectionPointsManager.clearConnectionPoints(cell);

    expect(cell.style.connectionPoints).toBeUndefined();
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should get connection points', () => {
    const cell = { isVertex: () => true, style: { connectionPoints: [{ x: 0.5, y: 0 }] } } as any;

    const points = connectionPointsManager.getConnectionPoints(cell);

    expect(points.length).toBe(1);
    expect(points[0].x).toBe(0.5);
  });

  it('should add corner points', () => {
    const cell = { isVertex: () => true, style: {} } as any;

    connectionPointsManager.addCornerPoints(cell);

    expect(cell.style.connectionPoints.length).toBe(4);
    expect(cell.style.connectionPoints[0]).toEqual({ x: 0, y: 0, perimeter: 1 }); // Top-left
    expect(cell.style.connectionPoints[3]).toEqual({ x: 1, y: 1, perimeter: 1 }); // Bottom-right
  });

  it('should add cardinal points', () => {
    const cell = { isVertex: () => true, style: {} } as any;

    connectionPointsManager.addCardinalPoints(cell);

    expect(cell.style.connectionPoints.length).toBe(4);
    expect(cell.style.connectionPoints[0]).toEqual({ x: 0.5, y: 0, perimeter: 1 }); // Top
    expect(cell.style.connectionPoints[1]).toEqual({ x: 1, y: 0.5, perimeter: 1 }); // Right
  });

  it('should add 8 points', () => {
    const cell = { isVertex: () => true, style: {} } as any;

    connectionPointsManager.add8Points(cell);

    expect(cell.style.connectionPoints.length).toBe(8);
  });

  it('should not add connection point to edge', () => {
    const edge = { isVertex: () => false, style: {} } as any;

    connectionPointsManager.addConnectionPoint(edge, 0.5, 0);

    expect(edge.style.connectionPoints).toBeUndefined();
  });

  it('should apply points to selection', () => {
    const cell = { isVertex: () => true, style: {} } as any;
    mockGraph.getSelectionModel().cells = [cell];

    connectionPointsManager.applyPointsToSelection('cardinal');

    expect(cell.style.connectionPoints.length).toBe(4);
  });

  it('should handle cells without style', () => {
    const cell = { isVertex: () => true } as any;

    connectionPointsManager.addConnectionPoint(cell, 0.5, 0);

    expect(cell.style).toBeDefined();
    expect(cell.style.connectionPoints).toBeDefined();
  });

  it('should return empty array for edge', () => {
    const edge = { isEdge: () => true, style: {} } as any;

    const points = connectionPointsManager.getConnectionPoints(edge);

    expect(points.length).toBe(0);
  });
});
