import { ColorPaletteManager } from '../color-palette-manager';

describe('ColorPaletteManager', () => {
  let colorPaletteManager: ColorPaletteManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      setCellStyles: jest.fn(),
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [
          { id: 'cell-1', isVertex: () => true, style: {} },
          { id: 'cell-2', isVertex: () => true, style: {} },
        ],
      }),
    };

    colorPaletteManager = new ColorPaletteManager(mockGraph);
  });

  it('should initialize with default palettes', () => {
    const palettes = colorPaletteManager.getPalettes();

    expect(palettes.length).toBeGreaterThanOrEqual(3);
    expect(palettes.find((p) => p.id === 'default')).toBeDefined();
  });

  it('should get palette by ID', () => {
    const palette = colorPaletteManager.getPalette('default');

    expect(palette).toBeDefined();
    expect(palette?.name).toBe('Default');
    expect(palette?.colors.length).toBeGreaterThan(0);
  });

  it('should set current palette', () => {
    const success = colorPaletteManager.setCurrentPalette('material');

    expect(success).toBe(true);
    const current = colorPaletteManager.getCurrentPalette();
    expect(current?.id).toBe('material');
  });

  it('should fail to set invalid palette', () => {
    const success = colorPaletteManager.setCurrentPalette('nonexistent');

    expect(success).toBe(false);
  });

  it('should apply color swatch to selection', () => {
    const swatch = { name: 'Red', fillColor: '#ff0000', strokeColor: '#cc0000' };

    colorPaletteManager.applyColor(swatch);

    expect(mockGraph.setCellStyles).toHaveBeenCalled();
    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });

  it('should apply fill color only', () => {
    colorPaletteManager.applyFillColor('#00ff00');

    expect(mockGraph.setCellStyles).toHaveBeenCalled();
  });

  it('should apply stroke color only', () => {
    colorPaletteManager.applyStrokeColor('#0000ff');

    expect(mockGraph.setCellStyles).toHaveBeenCalled();
  });

  it('should apply text color only', () => {
    colorPaletteManager.applyTextColor('#ffffff');

    expect(mockGraph.setCellStyles).toHaveBeenCalled();
  });

  it('should track color history', () => {
    colorPaletteManager.applyFillColor('#ff0000');
    colorPaletteManager.applyFillColor('#00ff00');
    colorPaletteManager.applyFillColor('#0000ff');

    const history = colorPaletteManager.getColorHistory();

    expect(history.length).toBe(3);
    expect(history[0]).toBe('#0000ff'); // Most recent first
  });

  it('should not duplicate colors in history', () => {
    colorPaletteManager.applyFillColor('#ff0000');
    colorPaletteManager.applyFillColor('#00ff00');
    colorPaletteManager.applyFillColor('#ff0000');

    const history = colorPaletteManager.getColorHistory();

    expect(history.length).toBe(2);
    expect(history[0]).toBe('#ff0000');
  });

  it('should limit color history size', () => {
    for (let i = 0; i < 30; i++) {
      colorPaletteManager.applyFillColor(`#${i.toString().padStart(6, '0')}`);
    }

    const history = colorPaletteManager.getColorHistory();

    expect(history.length).toBeLessThanOrEqual(20);
  });

  it('should clear color history', () => {
    colorPaletteManager.applyFillColor('#ff0000');
    colorPaletteManager.clearColorHistory();

    const history = colorPaletteManager.getColorHistory();

    expect(history.length).toBe(0);
  });

  it('should create custom palette', () => {
    const colors = [
      { name: 'Custom Red', fillColor: '#ff0000' },
      { name: 'Custom Blue', fillColor: '#0000ff' },
    ];

    const id = colorPaletteManager.createCustomPalette('My Palette', colors);

    expect(id).toBeDefined();
    const palette = colorPaletteManager.getPalette(id);
    expect(palette?.name).toBe('My Palette');
    expect(palette?.colors.length).toBe(2);
  });

  it('should delete custom palette', () => {
    const id = colorPaletteManager.createCustomPalette('Temp', []);

    const deleted = colorPaletteManager.deleteCustomPalette(id);

    expect(deleted).toBe(true);
    expect(colorPaletteManager.getPalette(id)).toBeNull();
  });

  it('should not delete built-in palettes', () => {
    const deleted = colorPaletteManager.deleteCustomPalette('default');

    expect(deleted).toBe(false);
  });

  it('should update palette', () => {
    const id = colorPaletteManager.createCustomPalette('Original', []);

    const updated = colorPaletteManager.updatePalette(id, { name: 'Updated' });

    expect(updated).toBe(true);
    const palette = colorPaletteManager.getPalette(id);
    expect(palette?.name).toBe('Updated');
  });

  it('should export palette as JSON', () => {
    const id = colorPaletteManager.createCustomPalette('Export Test', [
      { name: 'Test', fillColor: '#ff0000' },
    ]);

    const json = colorPaletteManager.exportPalette(id);

    expect(json).toBeDefined();
    const parsed = JSON.parse(json!);
    expect(parsed.name).toBe('Export Test');
  });

  it('should import palette from JSON', () => {
    const json = JSON.stringify({
      id: 'import-test',
      name: 'Imported',
      colors: [{ name: 'Test', fillColor: '#ff0000' }],
    });

    const result = colorPaletteManager.importPalette(json);

    expect(result).toBe(true);
    const palette = colorPaletteManager.getPalette('import-test');
    expect(palette?.name).toBe('Imported');
  });

  it('should handle invalid JSON on import', () => {
    const result = colorPaletteManager.importPalette('invalid json');

    expect(result).toBe(false);
  });

  it('should calculate complementary color', () => {
    const complement = colorPaletteManager.getComplementaryColor('#ff0000');

    expect(complement).toBeDefined();
    expect(complement).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should lighten color', () => {
    const lightened = colorPaletteManager.lightenColor('#000000', 20);

    expect(lightened).toBeDefined();
    expect(lightened).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should darken color', () => {
    const darkened = colorPaletteManager.darkenColor('#ffffff', 20);

    expect(darkened).toBeDefined();
    expect(darkened).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should handle color conversion edge cases', () => {
    const white = colorPaletteManager.lightenColor('#ffffff', 50);
    const black = colorPaletteManager.darkenColor('#000000', 50);

    expect(white).toBeDefined();
    expect(black).toBeDefined();
  });

  it('should get current palette', () => {
    colorPaletteManager.setCurrentPalette('pastel');
    const current = colorPaletteManager.getCurrentPalette();

    expect(current?.id).toBe('pastel');
  });

  it('should handle empty selection when applying colors', () => {
    mockGraph.getSelectionModel().cells = [];

    colorPaletteManager.applyFillColor('#ff0000');

    expect(mockGraph.setCellStyles).not.toHaveBeenCalled();
  });

  it('should preserve existing style properties when applying colors', () => {
    const swatch = { name: 'Test', fillColor: '#ff0000', strokeColor: '#000000' };

    colorPaletteManager.applyColor(swatch);

    expect(mockGraph.setCellStyles).toHaveBeenCalled();
  });
});
