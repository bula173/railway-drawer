import { SizingManager } from '../sizing-manager';

describe('SizingManager', () => {
  let sizingManager: SizingManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
    };

    sizingManager = new SizingManager(mockGraph);
  });

  it('should make same size', () => {
    const cell1 = {
      geometry: { width: 100, height: 80, x: 10, y: 20 },
      isVertex: () => true,
    };
    const cell2 = {
      geometry: { width: 50, height: 40, x: 120, y: 20 },
      isVertex: () => true,
    };
    const cell3 = {
      geometry: { width: 60, height: 50, x: 230, y: 20 },
      isVertex: () => true,
    };

    sizingManager.makeSameSize([cell1, cell2, cell3]);

    expect(cell2.geometry.width).toBe(100);
    expect(cell2.geometry.height).toBe(80);
    expect(cell3.geometry.width).toBe(100);
    expect(cell3.geometry.height).toBe(80);
  });

  it('should make same width', () => {
    const cell1 = {
      geometry: { width: 100, height: 80, x: 10, y: 20 },
      isVertex: () => true,
    };
    const cell2 = {
      geometry: { width: 50, height: 40, x: 120, y: 20 },
      isVertex: () => true,
    };

    sizingManager.makeSameWidth([cell1, cell2]);

    expect(cell2.geometry.width).toBe(100);
    expect(cell2.geometry.height).toBe(40);
  });

  it('should make same height', () => {
    const cell1 = {
      geometry: { width: 100, height: 80, x: 10, y: 20 },
      isVertex: () => true,
    };
    const cell2 = {
      geometry: { width: 50, height: 40, x: 120, y: 20 },
      isVertex: () => true,
    };

    sizingManager.makeSameHeight([cell1, cell2]);

    expect(cell2.geometry.width).toBe(50);
    expect(cell2.geometry.height).toBe(80);
  });

  it('should get bounds of cells', () => {
    const cell1 = {
      geometry: { width: 100, height: 80, x: 10, y: 20 },
      isVertex: () => true,
    };
    const cell2 = {
      geometry: { width: 100, height: 80, x: 120, y: 20 },
      isVertex: () => true,
    };

    const bounds = sizingManager.getBounds([cell1, cell2]);

    expect(bounds).toEqual({
      x: 10,
      y: 20,
      width: 210,
      height: 80,
    });
  });

  it('should return null for empty cells', () => {
    const bounds = sizingManager.getBounds([]);
    expect(bounds).toBeNull();
  });

  it('should refresh view after changes', () => {
    const cell1 = {
      geometry: { width: 100, height: 80 },
      isVertex: () => true,
    };
    const cell2 = {
      geometry: { width: 50, height: 40 },
      isVertex: () => true,
    };

    sizingManager.makeSameSize([cell1, cell2]);

    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });
});
