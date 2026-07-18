import { ToolboxManager, ToolboxShape } from '../toolbox-manager';

describe('ToolboxManager', () => {
  let toolboxManager: ToolboxManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      insertVertex: jest.fn().mockReturnValue({
        id: 'cell-1',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Shape',
        style: { shape: 'rectangle' },
      }),
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'v1', isVertex: () => true },
          { id: 'v2', isVertex: () => true },
        ],
      }),
      insertEdge: jest.fn().mockReturnValue({
        id: 'edge-1',
        value: 'Connection',
      }),
      view: {
        container: {
          clientWidth: 800,
          clientHeight: 600,
        },
        getOrigin: jest.fn().mockReturnValue({ x: 0, y: 0 }),
        scale: 1,
      },
    };

    toolboxManager = new ToolboxManager(mockGraph);
  });

  it('should add shape to recent shapes', () => {
    const shape: ToolboxShape = { name: 'rectangle', label: 'Rectangle', category: 'Basic' };

    toolboxManager.addToRecent(shape);

    expect(toolboxManager.getRecent().length).toBe(1);
    expect(toolboxManager.getRecent()[0].name).toBe('rectangle');
  });

  it('should maintain recent shapes order (most recent first)', () => {
    const rect: ToolboxShape = { name: 'rectangle', label: 'Rectangle', category: 'Basic' };
    const circle: ToolboxShape = { name: 'ellipse', label: 'Circle', category: 'Basic' };
    const diamond: ToolboxShape = { name: 'rhombus', label: 'Diamond', category: 'Basic' };

    toolboxManager.addToRecent(rect);
    toolboxManager.addToRecent(circle);
    toolboxManager.addToRecent(diamond);

    const recent = toolboxManager.getRecent();
    expect(recent[0].name).toBe('rhombus');
    expect(recent[1].name).toBe('ellipse');
    expect(recent[2].name).toBe('rectangle');
  });

  it('should move duplicate to front when added again', () => {
    const rect: ToolboxShape = { name: 'rectangle', label: 'Rectangle', category: 'Basic' };
    const circle: ToolboxShape = { name: 'ellipse', label: 'Circle', category: 'Basic' };

    toolboxManager.addToRecent(rect);
    toolboxManager.addToRecent(circle);
    toolboxManager.addToRecent(rect); // Add rectangle again

    const recent = toolboxManager.getRecent();
    expect(recent[0].name).toBe('rectangle');
    expect(recent.length).toBe(2);
  });

  it('should limit recent shapes to max', () => {
    for (let i = 0; i < 10; i++) {
      const shape: ToolboxShape = {
        name: `shape-${i}`,
        label: `Shape ${i}`,
        category: 'Test',
      };
      toolboxManager.addToRecent(shape);
    }

    expect(toolboxManager.getRecent().length).toBe(5); // maxRecentShapes
  });

  it('should clear recent shapes', () => {
    const shape: ToolboxShape = { name: 'rectangle', label: 'Rectangle', category: 'Basic' };
    toolboxManager.addToRecent(shape);

    toolboxManager.clearRecent();

    expect(toolboxManager.getRecent().length).toBe(0);
  });

  it('should create shape at specified position', () => {
    toolboxManager.createShape('rectangle', 100, 200, 'My Shape');

    expect(mockGraph.insertVertex).toHaveBeenCalledWith({
      position: [100, 200],
      size: [80, 60],
      value: 'My Shape',
      style: { shape: 'rectangle' },
    });
  });

  it('should create shape with default label if not provided', () => {
    toolboxManager.createShape('ellipse', 50, 50);

    expect(mockGraph.insertVertex).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'ellipse',
      })
    );
  });

  it('should create shape at center of viewport', () => {
    toolboxManager.createShapeAtCenter('rectangle', 'Center Shape');

    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should get common shapes grouped by category', () => {
    const commonShapes = toolboxManager.getCommonShapes();

    expect(commonShapes.has('Basic')).toBe(true);
    expect(commonShapes.has('Flowchart')).toBe(true);

    const basicShapes = commonShapes.get('Basic')!;
    expect(basicShapes.length).toBe(4);
    expect(basicShapes[0].name).toBe('rectangle');
  });

  it('should create shape grid', () => {
    const cells = toolboxManager.createShapeGrid('rectangle', 2, 2, 0, 0, 100);

    expect(cells.length).toBe(4);
    expect(mockGraph.insertVertex).toHaveBeenCalledTimes(4);
  });

  it('should create connector template between vertices', () => {
    const connector = toolboxManager.createConnectorTemplate();

    expect(mockGraph.insertEdge).toHaveBeenCalled();
    expect(connector.id).toBe('edge-1');
  });

  it('should return null if not enough vertices for connector', () => {
    mockGraph.getDefaultParent = jest.fn().mockReturnValue({
      children: [{ id: 'v1', isVertex: () => true }],
    });

    const connector = toolboxManager.createConnectorTemplate();

    expect(connector).toBeNull();
  });

  it('should export recent shapes as JSON', () => {
    const shape1: ToolboxShape = { name: 'rectangle', label: 'Rectangle', category: 'Basic' };
    const shape2: ToolboxShape = { name: 'ellipse', label: 'Circle', category: 'Basic' };

    toolboxManager.addToRecent(shape1);
    toolboxManager.addToRecent(shape2);

    const json = toolboxManager.exportRecent();
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].name).toBe('ellipse'); // Most recent first
  });

  it('should import recent shapes from JSON', () => {
    const shapes: ToolboxShape[] = [
      { name: 'rectangle', label: 'Rectangle', category: 'Basic' },
      { name: 'ellipse', label: 'Circle', category: 'Basic' },
    ];

    const json = JSON.stringify(shapes);
    const success = toolboxManager.importRecent(json);

    expect(success).toBe(true);
    expect(toolboxManager.getRecent().length).toBe(2);
  });

  it('should handle invalid JSON on import', () => {
    const success = toolboxManager.importRecent('invalid json');

    expect(success).toBe(false);
    expect(toolboxManager.getRecent().length).toBe(0);
  });

  it('should handle non-array data on import', () => {
    const success = toolboxManager.importRecent(JSON.stringify({ shapes: [] }));

    expect(success).toBe(false);
  });

  it('should clamp imported shapes to max recent', () => {
    const shapes = Array(10)
      .fill(null)
      .map((_, i) => ({
        name: `shape-${i}`,
        label: `Shape ${i}`,
        category: 'Test',
      }));

    toolboxManager.importRecent(JSON.stringify(shapes));

    expect(toolboxManager.getRecent().length).toBe(5);
  });
});
