import { TooltipManager } from '../tooltip-manager';

describe('TooltipManager', () => {
  let tooltipManager: TooltipManager;
  let mockGraph: any;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
    });

    mockGraph = {
      view: {
        canvas: document.createElement('canvas'),
        refresh: jest.fn(),
      },
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'cell-1', data: {} },
          { id: 'cell-2', data: {} },
        ],
      }),
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [{ id: 'cell-1', data: {} }],
      }),
      getCellAt: jest.fn(),
    };

    tooltipManager = new TooltipManager(mockGraph, mockContainer);
  });

  afterEach(() => {
    // Clean up any remaining tooltips
    tooltipManager.clearAll();
  });

  it('should add tooltip to cell', () => {
    const cell = { id: 'test', data: {} } as any;

    tooltipManager.addTooltip(cell, 'Test tooltip');

    expect(tooltipManager.getTooltip(cell)).toBe('Test tooltip');
  });

  it('should get tooltip from cell', () => {
    const cell = { id: 'test', data: { tooltip: 'Test tooltip' } } as any;

    const tooltip = tooltipManager.getTooltip(cell);

    expect(tooltip).toBe('Test tooltip');
  });

  it('should remove tooltip from cell', () => {
    const cell = { id: 'test', data: { tooltip: 'Test tooltip' } } as any;

    tooltipManager.removeTooltip(cell);

    expect(tooltipManager.getTooltip(cell)).toBeNull();
  });

  it('should check if cell has tooltip', () => {
    const cell1 = { id: 'test1', data: { tooltip: 'Test' } } as any;
    const cell2 = { id: 'test2', data: {} } as any;

    expect(tooltipManager.hasTooltip(cell1)).toBe(true);
    expect(tooltipManager.hasTooltip(cell2)).toBe(false);
  });

  it('should apply tooltips to selection', () => {
    const cells = [{ id: 'cell-1', data: {} }];
    mockGraph.getSelectionModel().cells = cells;

    tooltipManager.applyTooltipsToSelection('Tooltip text');

    expect(tooltipManager.getTooltip(cells[0])).toBe('Tooltip text');
  });

  it('should remove tooltips from selection', () => {
    const cells = [{ id: 'cell-1', data: { tooltip: 'Test' } }];
    mockGraph.getSelectionModel().cells = cells;

    tooltipManager.removeTooltipsFromSelection();

    expect(tooltipManager.getTooltip(cells[0])).toBeNull();
  });

  it('should export tooltips as map', () => {
    const cell = { id: 'cell-1', data: {} } as any;

    tooltipManager.addTooltip(cell, 'Test tooltip');
    const exported = tooltipManager.exportTooltips();

    expect(exported.size).toBe(1);
    expect(exported.get('cell-1')).toBe('Test tooltip');
  });

  it('should import tooltips from map', () => {
    const cells = [{ id: 'cell-1', data: {} }];
    mockGraph.getDefaultParent().children = cells;

    const tooltips = new Map<string, string>([['cell-1', 'Imported tooltip']]);

    tooltipManager.importTooltips(tooltips);

    expect(tooltipManager.getTooltip(cells[0])).toBe('Imported tooltip');
  });

  it('should clear all tooltips', () => {
    const cell1 = { id: 'cell-1', data: {} } as any;
    const cell2 = { id: 'cell-2', data: {} } as any;

    tooltipManager.addTooltip(cell1, 'Tooltip 1');
    tooltipManager.addTooltip(cell2, 'Tooltip 2');

    tooltipManager.clearAll();

    expect(tooltipManager.exportTooltips().size).toBe(0);
  });

  it('should not add tooltip to null cell', () => {
    tooltipManager.addTooltip(null, 'Tooltip');

    // Should not throw, just handle gracefully
    expect(tooltipManager.exportTooltips().size).toBe(0);
  });

  it('should not add empty tooltip text', () => {
    const cell = { id: 'test', data: {} } as any;

    tooltipManager.addTooltip(cell, '');

    expect(tooltipManager.getTooltip(cell)).toBeNull();
  });

  it('should handle multiple tooltips', () => {
    const cells = [
      { id: 'cell-1', data: {} },
      { id: 'cell-2', data: {} },
      { id: 'cell-3', data: {} },
    ];

    cells.forEach((cell, index) => {
      tooltipManager.addTooltip(cell, `Tooltip ${index + 1}`);
    });

    expect(tooltipManager.exportTooltips().size).toBe(3);
    expect(tooltipManager.getTooltip(cells[0])).toBe('Tooltip 1');
    expect(tooltipManager.getTooltip(cells[2])).toBe('Tooltip 3');
  });

  it('should handle cell without data object', () => {
    const cell = { id: 'test' } as any;

    tooltipManager.addTooltip(cell, 'Test tooltip');

    expect(cell.data).toBeDefined();
    expect(tooltipManager.getTooltip(cell)).toBe('Test tooltip');
  });
});
