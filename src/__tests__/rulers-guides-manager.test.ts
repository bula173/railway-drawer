import { RulersGuidesManager } from '../rulers-guides-manager';

describe('RulersGuidesManager', () => {
  let rulersGuidesManager: RulersGuidesManager;
  let mockGraph: any;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');

    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [
          {
            id: 'cell-1',
            isVertex: () => true,
            geometry: { x: 100, y: 100, width: 80, height: 60 },
            value: 'Test',
          },
        ],
      }),
    };

    rulersGuidesManager = new RulersGuidesManager(mockGraph, mockContainer);
  });

  it('should add horizontal guide', () => {
    const id = rulersGuidesManager.addGuide('horizontal', 100, 'Test Guide');

    expect(id).toBeDefined();
    const guides = rulersGuidesManager.getGuides();
    expect(guides.length).toBe(1);
    expect(guides[0].type).toBe('horizontal');
  });

  it('should add vertical guide', () => {
    const id = rulersGuidesManager.addGuide('vertical', 200);

    const guides = rulersGuidesManager.getGuides();
    expect(guides.find((g) => g.id === id)?.type).toBe('vertical');
  });

  it('should remove guide', () => {
    const id = rulersGuidesManager.addGuide('horizontal', 100);

    const removed = rulersGuidesManager.removeGuide(id);

    expect(removed).toBe(true);
    expect(rulersGuidesManager.getGuides().length).toBe(0);
  });

  it('should return false for removing non-existent guide', () => {
    const removed = rulersGuidesManager.removeGuide('nonexistent');

    expect(removed).toBe(false);
  });

  it('should get all guides', () => {
    const id1 = rulersGuidesManager.addGuide('horizontal', 100);
    const id2 = rulersGuidesManager.addGuide('vertical', 200);

    const guides = rulersGuidesManager.getGuides();

    expect(guides.find((g) => g.id === id1)).toBeDefined();
    expect(guides.find((g) => g.id === id2)).toBeDefined();
  });

  it('should clear all guides', () => {
    rulersGuidesManager.addGuide('horizontal', 100);
    rulersGuidesManager.addGuide('vertical', 200);

    rulersGuidesManager.clearGuides();

    expect(rulersGuidesManager.getGuides().length).toBe(0);
  });

  it('should toggle rulers', () => {
    const visible1 = rulersGuidesManager.toggleRulers();
    const visible2 = rulersGuidesManager.toggleRulers();

    expect(visible1).toBe(false);
    expect(visible2).toBe(true);
  });

  it('should toggle guides visibility', () => {
    const visible1 = rulersGuidesManager.toggleGuides();
    const visible2 = rulersGuidesManager.toggleGuides();

    expect(visible1).toBe(false);
    expect(visible2).toBe(true);
  });

  it('should snap position to nearby guide', () => {
    rulersGuidesManager.addGuide('horizontal', 100);

    const snapped = rulersGuidesManager.snapToGuide(105, 10);

    expect(snapped).toBe(100);
  });

  it('should not snap if distance exceeds threshold', () => {
    rulersGuidesManager.addGuide('horizontal', 100);

    const snapped = rulersGuidesManager.snapToGuide(150, 10);

    expect(snapped).toBe(150);
  });

  it('should get guides at position', () => {
    rulersGuidesManager.addGuide('horizontal', 100);
    rulersGuidesManager.addGuide('horizontal', 102);

    const guidesAt100 = rulersGuidesManager.getGuidesAtPosition(101, 5);

    expect(guidesAt100.length).toBeGreaterThan(0);
  });

  it('should align cells to guide', () => {
    const guideId = rulersGuidesManager.addGuide('horizontal', 150);

    const aligned = rulersGuidesManager.alignToGuide(guideId);

    expect(aligned).toBe(true);
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should return false for aligning to non-existent guide', () => {
    const aligned = rulersGuidesManager.alignToGuide('nonexistent');

    expect(aligned).toBe(false);
  });

  it('should create guides from selection', () => {
    rulersGuidesManager.createGuidesFromSelection();

    const guides = rulersGuidesManager.getGuides();

    expect(guides.length).toBeGreaterThan(0);
  });

  it('should export guides as JSON', () => {
    rulersGuidesManager.addGuide('horizontal', 100, 'Test');

    const json = rulersGuidesManager.exportGuides();

    expect(json).toBeDefined();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('should import guides from JSON', () => {
    const guideData = JSON.stringify([
      { id: 'guide-1', type: 'horizontal', position: 100, color: '#00aaff', label: 'Test' },
    ]);

    const result = rulersGuidesManager.importGuides(guideData);

    expect(result).toBe(true);
    expect(rulersGuidesManager.getGuides().length).toBe(1);
  });

  it('should handle invalid JSON on import', () => {
    const result = rulersGuidesManager.importGuides('invalid json');

    expect(result).toBe(false);
  });
});
