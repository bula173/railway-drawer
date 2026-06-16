/**
 * @file themingUtils.ts
 * @brief Theming system, command palette, and export utilities combined
 *
 * Part 6: Themes & Styling
 * Part 7: Global Search & Commands
 * Part 8: Enhanced Export Options
 */

import type { DrawElement } from '../components/Elements';

/**
 * @interface Theme
 * @brief Application theme definition
 */
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    trackStroke: string;
    trackFill: string;
    signalRed: string;
    signalYellow: string;
    signalGreen: string;
    platformFill: string;
    gridColor: string;
    selectionColor: string;
    guidColor: string;
  };
  strokeWidth: {
    main: number;
    secondary: number;
    grid: number;
  };
}

/**
 * Pre-defined themes
 */
export const THEMES: Record<string, Theme> = {
  modern: {
    name: 'Modern',
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      trackStroke: '#1a1a1a',
      trackFill: '#ffffff',
      signalRed: '#ff0000',
      signalYellow: '#ffff00',
      signalGreen: '#00ff00',
      platformFill: '#ffe5cc',
      gridColor: '#e0e0e0',
      selectionColor: '#007bff',
      guidColor: '#ff6b6b',
    },
    strokeWidth: { main: 2, secondary: 1, grid: 0.5 },
  },
  professional: {
    name: 'Professional',
    colors: {
      primary: '#1f4788',
      secondary: '#505050',
      trackStroke: '#000000',
      trackFill: '#ffffff',
      signalRed: '#cc0000',
      signalYellow: '#ccaa00',
      signalGreen: '#00aa00',
      platformFill: '#ddd8cc',
      gridColor: '#d0d0d0',
      selectionColor: '#1f4788',
      guidColor: '#ff8800',
    },
    strokeWidth: { main: 2.5, secondary: 1.5, grid: 0.5 },
  },
  darkMode: {
    name: 'Dark Mode',
    colors: {
      primary: '#00ff00',
      secondary: '#888888',
      trackStroke: '#ffffff',
      trackFill: '#1a1a1a',
      signalRed: '#ff4444',
      signalYellow: '#ffff44',
      signalGreen: '#44ff44',
      platformFill: '#333333',
      gridColor: '#333333',
      selectionColor: '#00ff00',
      guidColor: '#ff6b6b',
    },
    strokeWidth: { main: 2, secondary: 1, grid: 0.5 },
  },
  european: {
    name: 'European Standard',
    colors: {
      primary: '#003399',
      secondary: '#666666',
      trackStroke: '#333333',
      trackFill: '#f5f5f5',
      signalRed: '#ff0000',
      signalYellow: '#ffff00',
      signalGreen: '#00cc00',
      platformFill: '#ffffcc',
      gridColor: '#cccccc',
      selectionColor: '#003399',
      guidColor: '#ff8800',
    },
    strokeWidth: { main: 2, secondary: 1.5, grid: 0.5 },
  },
};

/**
 * @interface Command
 * @brief Global command for command palette
 */
export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  shortcut?: string;
  action: () => void;
  searchTerms: string[];
}

/**
 * @interface ExportOptions
 * @brief Options for exporting diagram
 */
export interface ExportOptions {
  format: 'png' | 'jpeg' | 'svg' | 'pdf';
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
  includeGrid?: boolean;
  includeShadows?: boolean;
  quality?: number;
  fileName?: string;
  pageSize?: 'A4' | 'A3' | 'letter';
  pageOrientation?: 'portrait' | 'landscape';
}

/**
 * Get theme by name
 */
export const getTheme = (themeName: string): Theme => {
  return THEMES[themeName] || THEMES.modern;
};

/**
 * Get all theme names
 */
export const getAvailableThemes = (): string[] => {
  return Object.keys(THEMES);
};

/**
 * Search commands by query
 */
export const searchCommands = (commands: Command[], query: string): Command[] => {
  const lowerQuery = query.toLowerCase();

  return commands.filter(cmd =>
    cmd.name.toLowerCase().includes(lowerQuery) ||
    cmd.description.toLowerCase().includes(lowerQuery) ||
    cmd.searchTerms.some(term => term.toLowerCase().includes(lowerQuery))
  );
};

/**
 * Generate SVG export from elements
 */
export const generateSVGExport = (
  elements: DrawElement[],
  options: Partial<ExportOptions> = {}
): string => {
  const width = options.width || 800;
  const height = options.height || 600;
  const bg = options.backgroundColor || '#ffffff';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${bg}"/>`;

  // Add elements as groups
  elements.forEach(el => {
    svg += `<g id="${el.id}">`;
    // Add element rendering (simplified)
    svg += `<line x1="${el.start.x}" y1="${el.start.y}" x2="${el.end.x}" y2="${el.end.y}" stroke="black" stroke-width="2"/>`;
    svg += `</g>`;
  });

  svg += `</svg>`;
  return svg;
};

/**
 * Generate PDF export parameters
 */
export const generatePDFExportParams = (
  _elements: DrawElement[],
  options: Partial<ExportOptions> = {}
) => {
  const pageSize = options.pageSize || 'A4';
  const orientation = options.pageOrientation || 'portrait';

  const pageSizes: Record<string, [number, number]> = {
    A4: [210, 297],
    A3: [297, 420],
    letter: [216, 279],
  };

  const [width, height] = pageSizes[pageSize];
  const finalHeight = orientation === 'landscape' ? width : height;
  const finalWidth = orientation === 'landscape' ? height : width;

  return {
    pageSize,
    orientation,
    width: finalWidth,
    height: finalHeight,
    scale: options.scale || 1,
    fileName: options.fileName || 'railway-diagram.pdf',
  };
};

/**
 * Validate export options
 */
export const validateExportOptions = (
  options: ExportOptions
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!['png', 'jpeg', 'svg', 'pdf'].includes(options.format)) {
    errors.push('Invalid export format');
  }

  if (options.width && (options.width < 100 || options.width > 4000)) {
    errors.push('Width must be between 100 and 4000 pixels');
  }

  if (options.quality && (options.quality < 1 || options.quality > 100)) {
    errors.push('Quality must be between 1 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get default export options for format
 */
export const getDefaultExportOptions = (format: string): ExportOptions => {
  const defaults: Record<string, ExportOptions> = {
    png: { format: 'png', width: 1920, height: 1080, scale: 2 },
    jpeg: { format: 'jpeg', width: 1920, height: 1080, quality: 90 },
    svg: { format: 'svg', scale: 1 },
    pdf: { format: 'pdf', pageSize: 'A4', pageOrientation: 'landscape' },
  };

  return defaults[format] || defaults.png;
};
