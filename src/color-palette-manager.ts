/**
 * Color Palette Manager
 * Manage color palettes and apply colors to shapes
 */

export interface ColorSwatch {
  name: string;
  fillColor: string;
  strokeColor?: string;
  textColor?: string;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: ColorSwatch[];
  isCustom?: boolean;
}

export class ColorPaletteManager {
  private palettes: Map<string, ColorPalette> = new Map();
  private currentPaletteId = 'default';
  private colorHistory: string[] = [];
  private maxHistorySize = 20;

  constructor(private graph: any) {
    this.initializeDefaultPalettes();
  }

  /**
   * Initialize default color palettes
   */
  private initializeDefaultPalettes(): void {
    const defaultPalette: ColorPalette = {
      id: 'default',
      name: 'Default',
      colors: [
        { name: 'White', fillColor: '#ffffff', strokeColor: '#000000' },
        { name: 'Light Gray', fillColor: '#f5f5f5', strokeColor: '#999999' },
        { name: 'Gray', fillColor: '#cccccc', strokeColor: '#666666' },
        { name: 'Dark Gray', fillColor: '#666666', strokeColor: '#333333' },
        { name: 'Black', fillColor: '#000000', strokeColor: '#ffffff' },
        { name: 'Red', fillColor: '#ff4444', strokeColor: '#cc0000' },
        { name: 'Orange', fillColor: '#ffaa00', strokeColor: '#ff6600' },
        { name: 'Yellow', fillColor: '#ffff00', strokeColor: '#ffaa00' },
        { name: 'Green', fillColor: '#00aa00', strokeColor: '#006600' },
        { name: 'Cyan', fillColor: '#00ccff', strokeColor: '#0099cc' },
        { name: 'Blue', fillColor: '#0066ff', strokeColor: '#0033cc' },
        { name: 'Purple', fillColor: '#9933ff', strokeColor: '#6600cc' },
      ],
    };

    const materialPalette: ColorPalette = {
      id: 'material',
      name: 'Material Design',
      colors: [
        { name: 'Red 500', fillColor: '#f44336', strokeColor: '#c62828' },
        { name: 'Pink 500', fillColor: '#e91e63', strokeColor: '#ad1457' },
        { name: 'Purple 500', fillColor: '#9c27b0', strokeColor: '#6a1b9a' },
        { name: 'Deep Purple 500', fillColor: '#673ab7', strokeColor: '#4527a0' },
        { name: 'Indigo 500', fillColor: '#3f51b5', strokeColor: '#283593' },
        { name: 'Blue 500', fillColor: '#2196f3', strokeColor: '#1565c0' },
        { name: 'Light Blue 500', fillColor: '#03a9f4', strokeColor: '#0277bd' },
        { name: 'Cyan 500', fillColor: '#00bcd4', strokeColor: '#00838f' },
        { name: 'Teal 500', fillColor: '#009688', strokeColor: '#00695c' },
        { name: 'Green 500', fillColor: '#4caf50', strokeColor: '#2e7d32' },
        { name: 'Light Green 500', fillColor: '#8bc34a', strokeColor: '#558b2f' },
        { name: 'Lime 500', fillColor: '#cddc39', strokeColor: '#9ccc65' },
      ],
    };

    const pastelPalette: ColorPalette = {
      id: 'pastel',
      name: 'Pastel',
      colors: [
        { name: 'Pastel Pink', fillColor: '#ffc0cb', strokeColor: '#ff69b4' },
        { name: 'Pastel Blue', fillColor: '#add8e6', strokeColor: '#4169e1' },
        { name: 'Pastel Green', fillColor: '#c1ffc1', strokeColor: '#00aa00' },
        { name: 'Pastel Yellow', fillColor: '#ffffe0', strokeColor: '#ffaa00' },
        { name: 'Pastel Purple', fillColor: '#e6c7ff', strokeColor: '#9933ff' },
        { name: 'Pastel Peach', fillColor: '#ffdab9', strokeColor: '#ff8c00' },
      ],
    };

    this.palettes.set('default', defaultPalette);
    this.palettes.set('material', materialPalette);
    this.palettes.set('pastel', pastelPalette);
  }

  /**
   * Get all available palettes
   */
  getPalettes(): ColorPalette[] {
    return Array.from(this.palettes.values());
  }

  /**
   * Get palette by ID
   */
  getPalette(id: string): ColorPalette | null {
    return this.palettes.get(id) || null;
  }

  /**
   * Set current palette
   */
  setCurrentPalette(id: string): boolean {
    if (!this.palettes.has(id)) return false;
    this.currentPaletteId = id;
    return true;
  }

  /**
   * Get current palette
   */
  getCurrentPalette(): ColorPalette | null {
    return this.palettes.get(this.currentPaletteId) || null;
  }

  /**
   * Apply color to selected cells
   */
  applyColor(swatch: ColorSwatch): void {
    const cells = this.graph.getSelectionModel().cells || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        const style = cell.style || {};
        if (swatch.fillColor) {
          style.fillColor = swatch.fillColor;
        }
        if (swatch.strokeColor) {
          style.strokeColor = swatch.strokeColor;
        }
        if (swatch.textColor) {
          style.fontColor = swatch.textColor;
        }
        this.graph.setCellStyles(cell, style);
      }
    });

    // Add to history
    this.addToColorHistory(swatch.fillColor);
    this.graph.view.refresh();
  }

  /**
   * Apply fill color only
   */
  applyFillColor(color: string): void {
    const cells = this.graph.getSelectionModel().cells || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        const style = cell.style || {};
        style.fillColor = color;
        this.graph.setCellStyles(cell, style);
      }
    });

    this.addToColorHistory(color);
    this.graph.view.refresh();
  }

  /**
   * Apply stroke color only
   */
  applyStrokeColor(color: string): void {
    const cells = this.graph.getSelectionModel().cells || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        const style = cell.style || {};
        style.strokeColor = color;
        this.graph.setCellStyles(cell, style);
      }
    });

    this.addToColorHistory(color);
    this.graph.view.refresh();
  }

  /**
   * Apply text color only
   */
  applyTextColor(color: string): void {
    const cells = this.graph.getSelectionModel().cells || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        const style = cell.style || {};
        style.fontColor = color;
        this.graph.setCellStyles(cell, style);
      }
    });

    this.addToColorHistory(color);
    this.graph.view.refresh();
  }

  /**
   * Add color to history
   */
  private addToColorHistory(color: string): void {
    // Remove if already exists
    const index = this.colorHistory.indexOf(color);
    if (index > -1) {
      this.colorHistory.splice(index, 1);
    }

    // Add to front
    this.colorHistory.unshift(color);

    // Keep size limit
    if (this.colorHistory.length > this.maxHistorySize) {
      this.colorHistory.pop();
    }
  }

  /**
   * Get color history
   */
  getColorHistory(): string[] {
    return [...this.colorHistory];
  }

  /**
   * Clear color history
   */
  clearColorHistory(): void {
    this.colorHistory = [];
  }

  /**
   * Create custom palette
   */
  createCustomPalette(name: string, colors: ColorSwatch[]): string {
    const id = `custom-${Date.now()}`;
    const palette: ColorPalette = {
      id,
      name,
      colors,
      isCustom: true,
    };

    this.palettes.set(id, palette);
    return id;
  }

  /**
   * Delete custom palette
   */
  deleteCustomPalette(id: string): boolean {
    if (id === 'default' || id === 'material' || id === 'pastel') {
      return false; // Cannot delete built-in palettes
    }

    if (this.currentPaletteId === id) {
      this.currentPaletteId = 'default';
    }

    return this.palettes.delete(id);
  }

  /**
   * Update palette
   */
  updatePalette(id: string, palette: Partial<ColorPalette>): boolean {
    const existing = this.palettes.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...palette };
    this.palettes.set(id, updated);
    return true;
  }

  /**
   * Export palette as JSON
   */
  exportPalette(id: string): string | null {
    const palette = this.palettes.get(id);
    if (!palette) return null;
    return JSON.stringify(palette);
  }

  /**
   * Import palette from JSON
   */
  importPalette(jsonData: string): boolean {
    try {
      const palette = JSON.parse(jsonData) as ColorPalette;
      if (palette.id && palette.name && Array.isArray(palette.colors)) {
        this.palettes.set(palette.id, palette);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get complementary color
   */
  getComplementaryColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#ffffff';

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + 180) % 360;

    const rgbComp = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(rgbComp.r, rgbComp.g, rgbComp.b);
  }

  /**
   * Lighten color
   */
  lightenColor(hex: string, amount: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(100, hsl.l + amount);

    const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  }

  /**
   * Darken color
   */
  darkenColor(hex: string, amount: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.max(0, hsl.l - amount);

    const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  }

  /**
   * Color conversion helpers
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    (r /= 255), (g /= 255), (b /= 255);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    (h /= 360), (s /= 100), (l /= 100);
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }
}
