import { GridSnapManager } from '../grid-snap-manager';

describe('GridSnapManager', () => {
  let gridSnapManager: GridSnapManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = { view: { gridSize: 10 } };
    gridSnapManager = new GridSnapManager(mockGraph);
  });

  it('should set grid size', () => {
    gridSnapManager.setGridSize(20);
    expect(gridSnapManager.getGridSize()).toBe(20);
  });

  it('should snap to grid', () => {
    gridSnapManager.setGridSize(10);
    expect(gridSnapManager.snapToGrid(15)).toBe(20);
    expect(gridSnapManager.snapToGrid(14)).toBe(10);
  });

  it('should toggle snap', () => {
    expect(gridSnapManager.isSnapEnabled()).toBe(true);
    gridSnapManager.toggleSnap();
    expect(gridSnapManager.isSnapEnabled()).toBe(false);
  });

  it('should toggle grid visibility', () => {
    expect(gridSnapManager.isGridVisible()).toBe(true);
    gridSnapManager.toggleGridVisibility();
    expect(gridSnapManager.isGridVisible()).toBe(false);
  });

  it('should not snap when disabled', () => {
    gridSnapManager.toggleSnap();
    expect(gridSnapManager.snapToGrid(15)).toBe(15);
  });
});
