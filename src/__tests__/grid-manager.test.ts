import { GridManager } from '../grid-manager';

describe('GridManager', () => {
  let gridManager: GridManager;

  beforeEach(() => {
    gridManager = new GridManager(10, true, true);
  });

  describe('snapCoordinate', () => {
    it('should snap coordinate to grid', () => {
      expect(gridManager.snapCoordinate(15)).toBe(20);
      expect(gridManager.snapCoordinate(12)).toBe(10);
      expect(gridManager.snapCoordinate(25)).toBe(30);
    });

    it('should return coordinate when snap disabled', () => {
      gridManager.setSnapEnabled(false);
      expect(gridManager.snapCoordinate(15)).toBe(15);
    });
  });

  describe('snapPosition', () => {
    it('should snap x,y position to grid', () => {
      const [x, y] = gridManager.snapPosition(15, 25);
      expect(x).toBe(20);
      expect(y).toBe(30);
    });

    it('should return unsnapped when disabled', () => {
      gridManager.setSnapEnabled(false);
      const [x, y] = gridManager.snapPosition(15, 25);
      expect(x).toBe(15);
      expect(y).toBe(25);
    });
  });

  describe('snapGeometry', () => {
    it('should snap all geometry values', () => {
      const [x, y, w, h] = gridManager.snapGeometry(15, 25, 35, 45);
      expect(x).toBe(20);
      expect(y).toBe(30);
      expect(w).toBe(40);
      expect(h).toBe(50);
    });

    it('should enforce minimum grid size', () => {
      const [, , w, h] = gridManager.snapGeometry(0, 0, 2, 2);
      expect(w).toBeGreaterThanOrEqual(10);
      expect(h).toBeGreaterThanOrEqual(10);
    });
  });

  describe('grid visibility', () => {
    it('should toggle grid visibility', () => {
      expect(gridManager.isGridVisible()).toBe(true);
      gridManager.setGridVisible(false);
      expect(gridManager.isGridVisible()).toBe(false);
    });
  });

  describe('snap enabled', () => {
    it('should toggle snap enabled', () => {
      expect(gridManager.isSnapEnabled()).toBe(true);
      gridManager.setSnapEnabled(false);
      expect(gridManager.isSnapEnabled()).toBe(false);
    });
  });

  describe('grid size', () => {
    it('should set grid size', () => {
      gridManager.setGridSize(20);
      expect(gridManager.getGridSize()).toBe(20);

      const [x] = gridManager.snapPosition(15, 0);
      expect(x).toBe(20);
    });

    it('should enforce minimum/maximum grid size', () => {
      gridManager.setGridSize(2);
      expect(gridManager.getGridSize()).toBe(5); // minimum

      gridManager.setGridSize(100);
      expect(gridManager.getGridSize()).toBe(50); // maximum
    });
  });

  describe('listeners', () => {
    it('should notify listeners on config change', () => {
      const listener = jest.fn();
      gridManager.addListener(listener);

      gridManager.setGridSize(20);
      expect(listener).toHaveBeenCalled();
    });
  });
});
