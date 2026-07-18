import { HyperlinkManager, HyperlinkData } from '../hyperlink-manager';

describe('HyperlinkManager', () => {
  let hyperlinkManager: HyperlinkManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      addListener: jest.fn(),
      view: {
        refresh: jest.fn(),
      },
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'cell-1', isVertex: () => true, data: {} },
          { id: 'cell-2', isVertex: () => true, data: {} },
        ],
      }),
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [{ id: 'cell-1', isVertex: () => true, data: {} }],
      }),
    };

    // Mock window.open
    global.window.open = jest.fn();

    hyperlinkManager = new HyperlinkManager(mockGraph);
  });

  it('should add hyperlink to cell', () => {
    const cell = { id: 'test', data: {} } as any;

    hyperlinkManager.addHyperlink(cell, 'https://example.com');

    expect(cell.link).toBeDefined();
    expect(cell.link.url).toBe('https://example.com');
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should add hyperlink with custom target and tooltip', () => {
    const cell = { id: 'test', data: {} } as any;

    hyperlinkManager.addHyperlink(cell, 'https://example.com', '_self', 'Click to visit');

    expect(cell.link.target).toBe('_self');
    expect(cell.link.tooltip).toBe('Click to visit');
  });

  it('should get hyperlink from cell', () => {
    const cell = { id: 'test', data: {}, link: { url: 'https://example.com' } } as any;

    const link = hyperlinkManager.getHyperlink(cell);

    expect(link).toBeDefined();
    expect(link?.url).toBe('https://example.com');
  });

  it('should remove hyperlink from cell', () => {
    const cell = { id: 'test', data: { hyperlink: { url: 'https://example.com' } }, style: {} } as any;

    hyperlinkManager.removeHyperlink(cell);

    expect(hyperlinkManager.getHyperlink(cell)).toBeNull();
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should check if cell has hyperlink', () => {
    const cell1 = { id: 'test1', link: { url: 'https://example.com' } } as any;
    const cell2 = { id: 'test2', data: {} } as any;

    expect(hyperlinkManager.hasHyperlink(cell1)).toBe(true);
    expect(hyperlinkManager.hasHyperlink(cell2)).toBe(false);
  });

  it('should open link in new window', () => {
    hyperlinkManager.openLink('https://example.com', '_blank');

    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank');
  });

  it('should prepend https to URL without protocol', () => {
    hyperlinkManager.openLink('example.com', '_blank');

    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank');
  });

  it('should open link in same window', () => {
    hyperlinkManager.openLink('https://example.com', '_self');

    expect(window.open).toHaveBeenCalledWith('https://example.com', '_self');
  });

  it('should apply hyperlinks to selection', () => {
    const cells = [{ id: 'cell-1', isVertex: () => true, data: {} }] as any[];
    mockGraph.getSelectionModel().cells = cells;

    hyperlinkManager.applyHyperlinksToSelection('https://example.com');

    expect(cells[0].link).toBeDefined();
    expect(cells[0].link.url).toBe('https://example.com');
  });

  it('should remove hyperlinks from selection', () => {
    const cells = [{ id: 'cell-1', isVertex: () => true, data: { hyperlink: { url: 'https://example.com' } } }] as any[];
    mockGraph.getSelectionModel().cells = cells;

    hyperlinkManager.removeHyperlinksFromSelection();

    expect(cells[0].data.hyperlink).toBeNull();
  });

  it('should export hyperlinks as map', () => {
    const cells = [
      { id: 'cell-1', isVertex: () => true, link: { url: 'https://example.com' } },
      { id: 'cell-2', isVertex: () => true, link: { url: 'https://test.com' } },
    ];
    mockGraph.getDefaultParent().children = cells;

    const exported = hyperlinkManager.exportHyperlinks();

    expect(exported.size).toBe(2);
    expect(exported.get('cell-1')?.url).toBe('https://example.com');
  });

  it('should import hyperlinks from map', () => {
    const cells = [{ id: 'cell-1', isVertex: () => true, data: {} }] as any[];
    mockGraph.getDefaultParent().children = cells;

    const hyperlinks = new Map<string, HyperlinkData>([
      ['cell-1', { url: 'https://example.com', target: '_blank' }],
    ]);

    hyperlinkManager.importHyperlinks(hyperlinks);

    expect(cells[0].link).toBeDefined();
    expect(cells[0].link.url).toBe('https://example.com');
  });

  it('should not add hyperlink to null cell', () => {
    hyperlinkManager.addHyperlink(null as any, 'https://example.com');

    // Should not throw, just return silently
    expect(mockGraph.view.refresh).not.toHaveBeenCalled();
  });

  it('should not add empty URL', () => {
    const cell = { id: 'test', data: {} } as any;

    hyperlinkManager.addHyperlink(cell, '');

    expect((cell as any).link).toBeUndefined();
  });

  it('should handle cell with existing data', () => {
    const cell = { id: 'test', data: { custom: 'value' } } as any;

    hyperlinkManager.addHyperlink(cell, 'https://example.com');

    expect(cell.data.custom).toBe('value');
    expect((cell as any).link).toBeDefined();
  });
});
