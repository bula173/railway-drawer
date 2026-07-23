/**
 * SVG to Vertex Shape Converter
 * Converts SVG path data to maxGraph Shape class code
 *
 * Usage:
 *   const converter = new SvgToVertexConverter('M 0 0 L 10 0 L 10 10 L 0 10 Z');
 *   const classCode = converter.generateShapeClass('MyCustomShape');
 *   console.log(classCode);
 */

export interface SvgCommand {
  type: string;
  values: number[];
}

export class SvgToVertexConverter {
  private svgPath: string;
  private commands: SvgCommand[] = [];

  constructor(svgPath: string) {
    this.svgPath = svgPath.trim();
    this.parsePath();
  }

  /**
   * Parse SVG path string into commands
   * Supports: M (moveTo), L (lineTo), H (horizontal), V (vertical),
   * Q (quadraticCurveTo), C (cubicBezierCurveTo), A (arc), Z (closePath)
   */
  private parsePath(): void {
    // Remove whitespace and normalize
    const normalized = this.svgPath
      .replace(/([a-zA-Z])/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = normalized.split(' ');
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      if (/^[a-zA-Z]$/.test(token)) {
        const type = token;
        const values: number[] = [];

        // Collect numeric values until next command
        i++;
        while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
          const num = parseFloat(tokens[i]);
          if (!isNaN(num)) {
            values.push(num);
          }
          i++;
        }

        this.commands.push({ type, values });
      } else {
        i++;
      }
    }
  }

  /**
   * Convert SVG commands to maxGraph canvas API calls
   */
  private convertToCanvasCommands(): string {
    let code = '';
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    for (const cmd of this.commands) {
      const type = cmd.type.toUpperCase();
      const relative = cmd.type !== type;
      const values = cmd.values;

      switch (type) {
        case 'M': // Move to
          if (values.length >= 2) {
            currentX = relative ? currentX + values[0] : values[0];
            currentY = relative ? currentY + values[1] : values[1];
            startX = currentX;
            startY = currentY;

            if (code.length > 0) {
              code += '\n';
            }
            code += `    c.moveTo(x + ${currentX}, y + ${currentY});`;
          }
          break;

        case 'L': // Line to
          if (values.length >= 2) {
            for (let i = 0; i < values.length; i += 2) {
              currentX = relative ? currentX + values[i] : values[i];
              currentY = relative ? currentY + values[i + 1] : values[i + 1];
              code += `\n    c.lineTo(x + ${currentX}, y + ${currentY});`;
            }
          }
          break;

        case 'H': // Horizontal line
          for (const x of values) {
            currentX = relative ? currentX + x : x;
            code += `\n    c.lineTo(x + ${currentX}, y + ${currentY});`;
          }
          break;

        case 'V': // Vertical line
          for (const y of values) {
            currentY = relative ? currentY + y : y;
            code += `\n    c.lineTo(x + ${currentX}, y + ${currentY});`;
          }
          break;

        case 'Q': // Quadratic bezier curve
          if (values.length >= 4) {
            for (let i = 0; i < values.length; i += 4) {
              const cp1x = relative ? currentX + values[i] : values[i];
              const cp1y = relative ? currentY + values[i + 1] : values[i + 1];
              currentX = relative ? currentX + values[i + 2] : values[i + 2];
              currentY = relative ? currentY + values[i + 3] : values[i + 3];
              code += `\n    c.quadTo(x + ${cp1x}, y + ${cp1y}, x + ${currentX}, y + ${currentY});`;
            }
          }
          break;

        case 'C': // Cubic bezier curve
          if (values.length >= 6) {
            for (let i = 0; i < values.length; i += 6) {
              const cp1x = relative ? currentX + values[i] : values[i];
              const cp1y = relative ? currentY + values[i + 1] : values[i + 1];
              const cp2x = relative ? currentX + values[i + 2] : values[i + 2];
              const cp2y = relative ? currentY + values[i + 3] : values[i + 3];
              currentX = relative ? currentX + values[i + 4] : values[i + 4];
              currentY = relative ? currentY + values[i + 5] : values[i + 5];
              code += `\n    c.curveTo(x + ${cp1x}, y + ${cp1y}, x + ${cp2x}, y + ${cp2y}, x + ${currentX}, y + ${currentY});`;
            }
          }
          break;

        case 'Z': // Close path
          code += '\n    c.close();';
          currentX = startX;
          currentY = startY;
          break;

        case 'A': // Arc - skip for now, convert to line
          if (values.length >= 7) {
            currentX = relative ? currentX + values[5] : values[5];
            currentY = relative ? currentY + values[6] : values[6];
            code += `\n    c.lineTo(x + ${currentX}, y + ${currentY}); // Arc simplified to line`;
          }
          break;
      }
    }

    return code;
  }

  /**
   * Generate complete Shape class code
   */
  generateShapeClass(
    className: string,
    _options: { fill?: boolean; stroke?: boolean; scaleToViewbox?: boolean } = {}
  ): string {
    const canvasCommands = this.convertToCanvasCommands();

    return `export class ${className} extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();${canvasCommands}
    c.fillAndStroke();
  }
}`;
  }

  /**
   * Get SVG viewBox bounds from parsed path
   */
  getViewBoxBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let x = 0,
      y = 0;

    for (const cmd of this.commands) {
      const values = cmd.values;

      switch (cmd.type.toUpperCase()) {
        case 'M':
        case 'L':
          x = cmd.type === cmd.type.toUpperCase() ? values[0] : x + values[0];
          y = cmd.type === cmd.type.toUpperCase() ? values[1] : y + values[1];
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          break;
      }
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Convert SVG element attributes to approximate canvas dimensions
   */
  static estimateViewBox(svg: string): { width: number; height: number } {
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/);
      return {
        width: parseFloat(parts[2]),
        height: parseFloat(parts[3]),
      };
    }

    const widthMatch = svg.match(/width="([^"]+)"/);
    const heightMatch = svg.match(/height="([^"]+)"/);

    return {
      width: widthMatch ? parseFloat(widthMatch[1]) : 32,
      height: heightMatch ? parseFloat(heightMatch[1]) : 30,
    };
  }

  /**
   * Extract path data from SVG element
   */
  static extractPath(svg: string): string | null {
    const pathMatch = svg.match(/<path[^>]*d="([^"]*)"/);
    return pathMatch ? pathMatch[1] : null;
  }

  /**
   * Full SVG to Shape class conversion
   */
  static fromSvg(svg: string, className: string): string | null {
    const pathData = this.extractPath(svg);
    if (!pathData) return null;

    const converter = new SvgToVertexConverter(pathData);
    return converter.generateShapeClass(className);
  }
}
