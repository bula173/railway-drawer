import { LayerManager } from '../layer-manager';

describe('LayerManager', () => {
  let layerManager: LayerManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'cell-1', value: 'Shape 1', isVertex: () => true, style: {} },
          { id: 'cell-2', value: 'Shape 2', isVertex: () => true, style: {} },
        ],
      }),
      view: {
        refresh: jest.fn(),
      },
    };

    layerManager = new LayerManager(mockGraph);
  });

  it('should add a layer', () => {
    const cell = { id: 'cell-1', value: 'Test Shape' };
    const layer = layerManager.addLayer(cell, 'Custom Label');

    expect(layer.id).toBe('cell-1');
    expect(layer.label).toBe('Custom Label');
    expect(layer.visible).toBe(true);
    expect(layer.locked).toBe(false);
  });

  it('should use cell value as default label', () => {
    const cell = { id: 'cell-1', value: 'My Shape' };
    const layer = layerManager.addLayer(cell);

    expect(layer.label).toBe('My Shape');
  });

  it('should get all layers', () => {
    const cell1 = { id: 'cell-1', value: 'Shape 1' };
    const cell2 = { id: 'cell-2', value: 'Shape 2' };

    layerManager.addLayer(cell1);
    layerManager.addLayer(cell2);

    const layers = layerManager.getAllLayers();
    expect(layers).toHaveLength(2);
  });

  it('should toggle visibility', () => {
    const cell = { id: 'cell-1', value: 'Shape 1', style: {} };
    layerManager.addLayer(cell);

    expect(layerManager.isVisible('cell-1')).toBe(true);

    layerManager.toggleVisibility('cell-1');
    expect(layerManager.isVisible('cell-1')).toBe(false);

    layerManager.toggleVisibility('cell-1');
    expect(layerManager.isVisible('cell-1')).toBe(true);
  });

  it('should toggle lock', () => {
    const cell = { id: 'cell-1', value: 'Shape 1' };
    layerManager.addLayer(cell);

    expect(layerManager.isLocked('cell-1')).toBe(false);

    layerManager.toggleLock('cell-1');
    expect(layerManager.isLocked('cell-1')).toBe(true);

    layerManager.toggleLock('cell-1');
    expect(layerManager.isLocked('cell-1')).toBe(false);
  });

  it('should show all layers', () => {
    const cell1 = { id: 'cell-1', value: 'Shape 1', style: {} };
    const cell2 = { id: 'cell-2', value: 'Shape 2', style: {} };

    layerManager.addLayer(cell1);
    layerManager.addLayer(cell2);

    layerManager.toggleVisibility('cell-1');
    layerManager.toggleVisibility('cell-2');

    expect(layerManager.isVisible('cell-1')).toBe(false);
    expect(layerManager.isVisible('cell-2')).toBe(false);

    layerManager.showAll();

    expect(layerManager.isVisible('cell-1')).toBe(true);
    expect(layerManager.isVisible('cell-2')).toBe(true);
  });

  it('should hide all layers', () => {
    const cell1 = { id: 'cell-1', value: 'Shape 1', style: {} };
    const cell2 = { id: 'cell-2', value: 'Shape 2', style: {} };

    layerManager.addLayer(cell1);
    layerManager.addLayer(cell2);

    layerManager.hideAll();

    expect(layerManager.isVisible('cell-1')).toBe(false);
    expect(layerManager.isVisible('cell-2')).toBe(false);
  });

  it('should isolate layer', () => {
    const cell1 = { id: 'cell-1', value: 'Shape 1', style: {} };
    const cell2 = { id: 'cell-2', value: 'Shape 2', style: {} };

    layerManager.addLayer(cell1);
    layerManager.addLayer(cell2);

    layerManager.isolate('cell-1');

    expect(layerManager.isVisible('cell-1')).toBe(true);
    expect(layerManager.isVisible('cell-2')).toBe(false);
  });

  it('should rename layer', () => {
    const cell = { id: 'cell-1', value: 'Shape 1' };
    layerManager.addLayer(cell);

    layerManager.renameLayer('cell-1', 'New Name');

    const layers = layerManager.getAllLayers();
    expect(layers[0].label).toBe('New Name');
  });

  it('should remove layer', () => {
    const cell = { id: 'cell-1', value: 'Shape 1' };
    layerManager.addLayer(cell);

    expect(layerManager.getAllLayers()).toHaveLength(1);

    layerManager.removeLayer('cell-1');

    expect(layerManager.getAllLayers()).toHaveLength(0);
  });

  it('should listen for layer changes', () => {
    const listener = jest.fn();
    layerManager.addListener(listener);

    const cell = { id: 'cell-1', value: 'Shape 1' };
    layerManager.addLayer(cell);

    expect(listener).toHaveBeenCalled();
  });

  it('should remove listener', () => {
    const listener = jest.fn();
    layerManager.addListener(listener);

    const cell1 = { id: 'cell-1', value: 'Shape 1' };
    layerManager.addLayer(cell1);
    expect(listener).toHaveBeenCalledTimes(1);

    layerManager.removeListener(listener);

    const cell2 = { id: 'cell-2', value: 'Shape 2' };
    layerManager.addLayer(cell2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
