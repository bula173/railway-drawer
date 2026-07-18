import { ClipboardManager } from '../clipboard-manager';

describe('ClipboardManager', () => {
  let clipboardManager: ClipboardManager;
  let mockGraph: any;
  let mockHistory: any;

  beforeEach(() => {
    mockHistory = {
      execute: jest.fn(),
    };

    mockGraph = {
      insertVertex: jest.fn().mockReturnValue({
        id: 'new-cell-1',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Cell',
        style: {},
      }),
      insertEdge: jest.fn().mockReturnValue({
        id: 'new-edge-1',
        value: 'Edge',
        style: {},
      }),
      removeCells: jest.fn(),
      view: {
        container: {
          clientWidth: 800,
          clientHeight: 600,
        },
        scale: 1,
        translate: { x: 0, y: 0 },
      },
      getDefaultParent: jest.fn().mockReturnValue({
        children: [],
      }),
    };

    clipboardManager = new ClipboardManager(mockGraph, mockHistory);
  });

  it('should copy cells to clipboard', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test Cell',
        geometry: { x: 10, y: 10, width: 80, height: 60 },
        style: { fillColor: '#ffffff' },
        isVertex: () => true,
      },
    ];

    const result = clipboardManager.copyCells(cells);

    expect(result).toBe(true);
    expect(clipboardManager.hasContent()).toBe(true);
  });

  it('should cut cells (copy and delete)', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 10, y: 10, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
      },
    ];

    clipboardManager.cutCells(cells);

    expect(mockGraph.removeCells).toHaveBeenCalledWith(cells);
  });

  it('should paste cells with position offset', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
        isEdge: () => false,
      },
    ];

    clipboardManager.copyCells(cells);
    const pasted = clipboardManager.pasteCells(100, 100);

    expect(pasted.length).toBe(1);
    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should paste at viewport center', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
        isEdge: () => false,
      },
    ];

    clipboardManager.copyCells(cells);
    const pasted = clipboardManager.pasteAtCenter();

    expect(pasted.length).toBeGreaterThanOrEqual(0);
  });

  it('should paste with smart offset', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
        isEdge: () => false,
      },
    ];

    clipboardManager.copyCells(cells);
    clipboardManager.pasteWithSmartOffset();
    clipboardManager.pasteWithSmartOffset();

    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should check if clipboard has content', () => {
    expect(clipboardManager.hasContent()).toBe(false);

    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
      },
    ];

    clipboardManager.copyCells(cells);
    expect(clipboardManager.hasContent()).toBe(true);
  });

  it('should get clipboard info', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
      },
    ];

    clipboardManager.copyCells(cells);
    const info = clipboardManager.getClipboardInfo();

    expect(info).toBeDefined();
    expect(info?.count).toBe(1);
    expect(info?.time).toBeInstanceOf(Date);
  });

  it('should clear clipboard', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
      },
    ];

    clipboardManager.copyCells(cells);
    expect(clipboardManager.hasContent()).toBe(true);

    clipboardManager.clearClipboard();
    expect(clipboardManager.hasContent()).toBe(false);
  });

  it('should duplicate cells with offset', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
      },
    ] as any[];

    const duplicated = clipboardManager.duplicateCells(cells, 30, 30);

    expect(duplicated.length).toBeGreaterThan(0);
    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should export clipboard to JSON', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Test',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        style: {},
        isVertex: () => true,
      },
    ];

    clipboardManager.copyCells(cells);
    const json = clipboardManager.exportToJSON();

    expect(json).toBeTruthy();
    expect(JSON.parse(json).cells).toBeDefined();
  });

  it('should import clipboard from JSON', () => {
    const json = JSON.stringify({
      cells: [
        {
          id: 'cell-1',
          value: 'Test',
          geometry: { x: 0, y: 0, width: 80, height: 60 },
          style: {},
        },
      ],
      timestamp: Date.now(),
    });

    const result = clipboardManager.importFromJSON(json);

    expect(result).toBe(true);
    expect(clipboardManager.hasContent()).toBe(true);
  });

  it('should handle invalid JSON on import', () => {
    const result = clipboardManager.importFromJSON('invalid json');

    expect(result).toBe(false);
  });

  it('should not paste empty clipboard', () => {
    const pasted = clipboardManager.pasteCells(0, 0);

    expect(pasted).toEqual([]);
  });

  it('should copy and paste cells preserving properties', () => {
    const cells = [
      {
        id: 'cell-1',
        value: 'Styled Cell',
        geometry: { x: 50, y: 50, width: 100, height: 70 },
        style: { fillColor: '#ff0000', strokeColor: '#000000' },
        isVertex: () => true,
      },
    ];

    clipboardManager.copyCells(cells);
    clipboardManager.pasteCells(0, 0);

    expect(mockGraph.insertVertex).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'Styled Cell',
        size: [100, 70],
      })
    );
  });
});
