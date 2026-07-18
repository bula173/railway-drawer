import { SmartDuplicateManager } from '../smart-duplicate-manager';

describe('SmartDuplicateManager', () => {
  let smartDuplicateManager: SmartDuplicateManager;
  let mockGraph: any;
  let mockHistory: any;

  beforeEach(() => {
    mockHistory = {
      execute: jest.fn(),
    };

    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      insertVertex: jest.fn().mockReturnValue({
        id: `new-vertex-${Math.random()}`,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Vertex',
      }),
      insertEdge: jest.fn().mockReturnValue({
        id: `new-edge-${Math.random()}`,
        value: 'Edge',
      }),
      getDefaultParent: jest.fn().mockReturnValue({
        children: [],
      }),
    };

    smartDuplicateManager = new SmartDuplicateManager(mockGraph, mockHistory);
  });

  it('should perform smart duplicate', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const duplicated = smartDuplicateManager.smartDuplicate(cells, 2);

    expect(duplicated.length).toBeGreaterThan(0);
    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should duplicate in grid pattern', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const duplicated = smartDuplicateManager.duplicateInGrid(cells, 3, 3, 100);

    expect(duplicated.length).toBeGreaterThan(0);
    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should duplicate in circular pattern', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 100, y: 100, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const duplicated = smartDuplicateManager.duplicateInCircle(cells, 5, 200);

    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('should duplicate along path horizontally', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const duplicated = smartDuplicateManager.duplicateAlongPath(cells, 5, 0, 100);

    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('should duplicate along path vertically', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const duplicated = smartDuplicateManager.duplicateAlongPath(cells, 5, 90, 100);

    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('should get duplication suggestions', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const suggestions = smartDuplicateManager.getSuggestions(cells);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBeDefined();
    expect(suggestions[0].label).toBeDefined();
  });

  it('should return empty for empty cell array', () => {
    const duplicated = smartDuplicateManager.smartDuplicate([]);

    expect(duplicated).toEqual([]);
  });

  it('should return empty suggestions for empty cell array', () => {
    const suggestions = smartDuplicateManager.getSuggestions([]);

    expect(suggestions).toEqual([]);
  });

  it('should handle cells with edges in duplication', () => {
    mockGraph.getDefaultParent().children = [];

    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      } as any,
      {
        id: 'edge-1',
        isVertex: () => false,
        isEdge: () => true,
        value: 'Connection',
        source: { id: 'cell-1' },
        target: { id: 'cell-1' },
        style: {},
      } as any,
    ];

    mockGraph.insertVertex.mockReturnValueOnce({
      id: 'cell-1-dup',
      geometry: { x: 0, y: 0, width: 80, height: 60 },
    });

    const duplicated = smartDuplicateManager.duplicateAlongPath(cells, 2, 0, 100);

    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('should preserve geometry in duplicates', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 50, y: 100, width: 120, height: 80 },
        value: 'Test',
        style: { fillColor: '#ff0000' },
      },
    ];

    smartDuplicateManager.duplicateInGrid(cells, 1, 1, 150);

    expect(mockGraph.insertVertex).toHaveBeenCalledWith(
      expect.objectContaining({
        size: [120, 80],
      })
    );
  });

  it('should preserve style in duplicates', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: { fillColor: '#0000ff', strokeColor: '#000000' },
      },
    ];

    smartDuplicateManager.smartDuplicate(cells);

    expect(mockGraph.insertVertex).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          fillColor: '#0000ff',
        }),
      })
    );
  });

  it('should handle multiple cells in circular duplication', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test 1',
        style: {},
      },
      {
        id: 'cell-2',
        isVertex: () => true,
        geometry: { x: 100, y: 0, width: 80, height: 60 },
        value: 'Test 2',
        style: {},
      },
    ];

    const duplicated = smartDuplicateManager.duplicateInCircle(cells, 3, 200);

    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('should calculate appropriate spacing for grid', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 100, height: 100 },
        value: 'Test',
        style: {},
      },
    ];

    const suggestions = smartDuplicateManager.getSuggestions(cells);
    const gridSuggestion = suggestions.find((s) => s.type === 'grid');

    expect(gridSuggestion).toBeDefined();
    expect(gridSuggestion?.params.spacing).toBeGreaterThan(100);
  });

  it('should refresh graph after duplication', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    smartDuplicateManager.smartDuplicate(cells);

    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should support different angles for linear duplication', () => {
    const cells = [
      {
        id: 'cell-1',
        isVertex: () => true,
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Test',
        style: {},
      },
    ];

    const diagonal = smartDuplicateManager.duplicateAlongPath(cells, 3, 45, 100);

    expect(diagonal.length).toBeGreaterThan(0);
  });
});
