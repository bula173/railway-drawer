#!/usr/bin/env node

/**
 * Script to import draw.io shapes and generate maxGraph Shape classes
 * Usage: npx ts-node scripts/import-drawio-shapes.ts <libraryName> [outDir]
 * Example: npx ts-node scripts/import-drawio-shapes.ts mxBasic src/shapes/drawio-basic
 */

import * as fs from 'fs';
import * as path from 'path';

interface ShapeDefinition {
  functionName: string;
  displayName: string;
  paintVertexShape?: string;
  paintForeground?: string;
  paintBackground?: string;
  customProperties?: string;
}

interface ImportOptions {
  sourceFile: string;
  libraryName: string;
  outDir: string;
  group: string;
}

class DrawIOShapeImporter {
  /**
   * Parse draw.io JavaScript file and extract shape definitions
   */
  static parseShapes(content: string): ShapeDefinition[] {
    const shapes: ShapeDefinition[] = [];

    // Match shape function declarations
    const shapeFunctionRegex =
      /function\s+(mxShape\w+)\s*\(\s*bounds,\s*fill,\s*stroke,\s*strokewidth\s*\)\s*\{([\s\S]*?)\n\};/g;

    let match;
    while ((match = shapeFunctionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const constructorBody = match[2];

      const shape: ShapeDefinition = {
        functionName,
        displayName: this.functionNameToDisplayName(functionName),
      };

      // Extract paintVertexShape
      const paintVertexMatch = new RegExp(
        functionName + '\\.prototype\\.paintVertexShape\\s*=\\s*function\\(c,\\s*x,\\s*y,\\s*w,\\s*h\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\};'
      ).exec(content);
      if (paintVertexMatch) {
        shape.paintVertexShape = paintVertexMatch[1].trim();
        // Append constructor properties to paintVertexShape so they get extracted
        shape.paintVertexShape = constructorBody + '\n' + shape.paintVertexShape;
      }

      // Extract paintForeground if exists
      const paintFgMatch = new RegExp(
        functionName + '\\.prototype\\.paintForeground\\s*=\\s*function\\(c,\\s*x,\\s*y,\\s*w,\\s*h\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\};'
      ).exec(content);
      if (paintFgMatch) {
        shape.paintForeground = paintFgMatch[1].trim();
      }

      // Extract paintBackground if exists
      const paintBgMatch = new RegExp(
        functionName + '\\.prototype\\.paintBackground\\s*=\\s*function\\(c,\\s*x,\\s*y,\\s*w,\\s*h\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\};'
      ).exec(content);
      if (paintBgMatch) {
        shape.paintBackground = paintBgMatch[1].trim();
      }

      // Extract customProperties if exists
      const customPropsMatch = new RegExp(
        functionName + '\\.prototype\\.customProperties\\s*=\\s*\\[([\\s\\S]*?)\\];'
      ).exec(content);
      if (customPropsMatch) {
        shape.customProperties = customPropsMatch[1].trim();
      }

      if (shape.paintVertexShape) {
        shapes.push(shape);
      }
    }

    return shapes;
  }

  /**
   * Convert mxShapeBasicCross to BasicCrossShape
   */
  static functionNameToClassName(functionName: string): string {
    let name = functionName.replace(/^mxShape/, '');
    return name + 'Shape';
  }

  /**
   * Convert mxShapeBasicCross to Basic Cross
   */
  static functionNameToDisplayName(functionName: string): string {
    let name = functionName
      .replace(/^mxShape/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Convert draw.io identifier to shape ID
   */
  static functionNameToShapeId(functionName: string, prefix: string): string {
    const name = functionName.replace(/^mxShape/, '');
    return `${prefix}-${name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`;
  }

  /**
   * Extract default property values from paint code and custom properties
   */
  private static extractDefaultProperties(paintCode: string, customProps?: string): string {
    const props: { [key: string]: number | string } = {};
    const ignoreParams = ['bounds', 'fill', 'stroke', 'strokewidth'];

    // Find property assignments like: this.dx = 0.5; or this.dy = 10;
    const propRegex = /this\.(\w+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = propRegex.exec(paintCode)) !== null) {
      const propName = match[1];
      const propValue = match[2].trim();

      // Skip constructor parameters and parameter mappings
      if (ignoreParams.includes(propName)) continue;
      if (propValue === 'bounds' || propValue === 'fill' || propValue === 'stroke') continue;

      // Only keep properties with numeric values or simple expressions
      if (!/^\d|^[\d.]+|^true|^false/.test(propValue) && !propValue.includes('Math.')) {
        continue;
      }

      props[propName] = propValue;
    }

    // Extract defaults from customProperties array
    if (customProps) {
      const defValRegex = /\{name:\s*'(\w+)'[\s\S]*?defVal:\s*(\d+(?:\.\d+)?)/g;
      let defMatch;
      while ((defMatch = defValRegex.exec(customProps)) !== null) {
        const propName = defMatch[1];
        const defValue = defMatch[2];
        // Only add if not already defined from constructor
        if (!props[propName]) {
          props[propName] = defValue;
        }
      }
    }

    if (Object.keys(props).length === 0) {
      return '';
    }

    const propDeclarations = Object.entries(props)
      .map(([name, value]) => `  ${name} = ${value};`)
      .join('\n');

    return propDeclarations + '\n\n';
  }

  /**
   * Generate TypeScript Shape class from definition
   */
  static generateShapeClass(shape: ShapeDefinition, libraryName: string): string {
    const className = this.functionNameToClassName(shape.functionName);
    const paintVertexCode = shape.paintVertexShape || '';
    const defaultProps = this.extractDefaultProperties(paintVertexCode, shape.customProperties);

    // Remove constructor code from paintVertexShape
    // Keep try block if present, but remove everything before it or before c.translate
    let cleanCode = paintVertexCode;
    if (cleanCode.includes('try')) {
      // Keep try block and everything after
      cleanCode = cleanCode.replace(/[\s\S]*?(try\s*\{)/, '$1');
    } else {
      // Remove everything before c.translate
      cleanCode = cleanCode.replace(/[\s\S]*?c\.translate\(x,\s*y\);/, 'c.translate(x, y);');
    }

    const cleanPaintMethod = this.translateDrawIOCode(cleanCode);

    let code = `/**
 * Draw.io ${shape.displayName} shape
 * Adapted from ${libraryName}.js
 */

import { Shape } from '@maxgraph/core';

export class ${className} extends Shape {
  constructor() {
    super();
  }

${defaultProps}  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
${this.indentCode(cleanPaintMethod, 4)}
  }`;

    if (shape.paintForeground) {
      const foregroundMethod = this.translateDrawIOCode(shape.paintForeground);
      code += `

  override paintForeground(c: any, x: number, y: number, w: number, h: number): void {
${this.indentCode(foregroundMethod, 4)}
  }`;
    }

    if (shape.paintBackground) {
      const backgroundMethod = this.translateDrawIOCode(shape.paintBackground);
      code += `

  override paintBackground(c: any, x: number, y: number, w: number, h: number): void {
${this.indentCode(backgroundMethod, 4)}
  }`;
    }

    code += '\n}\n';
    return code;
  }

  /**
   * Translate draw.io canvas operations to maxGraph equivalents
   */
  private static translateDrawIOCode(code: string): string {
    // Remove mxUtils.getValue patterns with this.property fallback
    code = code.replace(
      /parseFloat\(mxUtils\.getValue\(this\.style,\s*'(\w+)',\s*this\.(\w+)\)\)/g,
      (_, prop, attr) => `this.${attr}`
    );

    // Handle remaining mxUtils.getValue calls with string defaults
    code = code.replace(
      /mxUtils\.getValue\(this\.style,\s*'(\w+)',\s*'([^']+)'\)/g,
      (_, prop, defVal) => `'${defVal}'`
    );

    // Handle remaining mxUtils.getValue calls with numeric defaults
    code = code.replace(
      /mxUtils\.getValue\(this\.style,\s*'(\w+)',\s*(\d+(?:\.\d+)?)\)/g,
      (_, prop, defVal) => `${defVal}`
    );

    // Handle remaining mxUtils.getValue calls with false/true defaults
    code = code.replace(
      /mxUtils\.getValue\(this\.style,\s*'(\w+)',\s*(false|true)\)/g,
      (_, prop, defVal) => `${defVal}`
    );

    // Handle remaining mxUtils.getValue calls with state.style
    code = code.replace(
      /JSON\.parse\(mxUtils\.getValue\(this\.state\.style,\s*'(\w+)',\s*'([^']+)'\)\)/g,
      (_, prop, defVal) => `JSON.parse('${defVal}')`
    );

    // Convert var to let (more flexible than const)
    code = code.replace(/\bvar\s+/g, 'let ');

    // Remove unused variable declarations (marked with unique names like dx1a, dy1a)
    // These are often duplicates or deprecated variables in draw.io
    const lines = code.split('\n');
    const usedVars = new Set<string>();

    // First pass: collect all variable names that are used
    lines.forEach((line) => {
      // Extract variable references (but not declarations)
      const refRegex = /(?<!let\s)(?<!const\s)(?:this\.)?(\w+)\s*[+\-*/=()[\]]/g;
      let match;
      while ((match = refRegex.exec(line)) !== null) {
        usedVars.add(match[1]);
      }
      // Also check for variables used in c.methods
      const cMethodRegex = /c\.\w+\(([^)]*)\)/g;
      while ((match = cMethodRegex.exec(line)) !== null) {
        const params = match[1].split(',');
        params.forEach((param) => {
          const varName = param.trim().split(/[+\-*/\s]/)[0];
          if (varName && varName !== 'x' && varName !== 'y' && varName !== 'w' && varName !== 'h') {
            usedVars.add(varName);
          }
        });
      }
    });

    // Second pass: filter out unused declarations
    const filteredLines = lines.filter((line) => {
      const declMatch = /let\s+(\w+)\s*=/.exec(line);
      if (declMatch && !usedVars.has(declMatch[1])) {
        // Comment out unused variable declarations
        return false; // Skip this line
      }
      return true;
    });

    const filteredCode = filteredLines.join('\n');

    // Add proper comments for sections
    return filteredCode.replace(/\/\/\*+\n\/\/ /g, '// ');
  }

  /**
   * Indent code block
   */
  private static indentCode(code: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return code
      .split('\n')
      .map((line) => (line.trim() ? indent + line : line))
      .join('\n');
  }

  /**
   * Generate index.ts for the shapes group
   */
  static generateIndex(shapes: ShapeDefinition[]): string {
    const imports = shapes
      .map((s) => {
        const className = this.functionNameToClassName(s.functionName);
        return `export { ${className} } from './${this.classNameToFileName(className)}.js';`;
      })
      .join('\n');

    return `/**
 * @file index.ts
 * @brief Export draw.io shapes adapted to maxGraph
 */

${imports}
`;
  }

  /**
   * Generate registry.ts for the shapes group
   */
  static generateRegistry(
    shapes: ShapeDefinition[],
    libraryName: string,
    groupName: string
  ): string {
    const prefix = libraryName.toLowerCase();
    const shapeIdPrefix = `drawio-${prefix}`;

    const classImports = shapes
      .map((s) => {
        const className = this.functionNameToClassName(s.functionName);
        return className;
      })
      .join(',\n  ');

    const registrations = shapes
      .map((s) => {
        const className = this.functionNameToClassName(s.functionName);
        const shapeKey = `${prefix}.${s.functionName.replace(/^mxShape/, '')}`;
        return `  CellRenderer.defaultShapes['${shapeKey}'] = ${className} as any;`;
      })
      .join('\n');

    const shapeRegistries = shapes
      .map((s) => {
        const className = this.functionNameToClassName(s.functionName);
        const shapeId = this.functionNameToShapeId(s.functionName, shapeIdPrefix);
        const shapeKey = `${prefix}.${s.functionName.replace(/^mxShape/, '')}`;

        return `  shapeRegistry.register({
    id: '${shapeId}',
    type: 'vertex',
    label: '${s.displayName}',
    group: '${groupName}',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: ${className},
    width: 100,
    height: 100,
    style: { shape: '${shapeKey}', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });`;
      })
      .join('\n\n');

    return `/**
 * Draw.io ${libraryName} shapes registry
 */

import { CellRenderer } from '@maxgraph/core';
import { shapeRegistry } from '../registry.js';
import {
  ${classImports},
} from './index.js';

/**
 * Register all draw.io ${libraryName} shape classes with CellRenderer
 */
export function registerDrawio${this.capitalize(libraryName)}ShapeClasses(): void {
${registrations}
}

/**
 * Register draw.io ${libraryName} shapes with shape registry (for palette/menu)
 */
export function registerDrawio${this.capitalize(libraryName)}Shapes(): void {
${shapeRegistries}
}
`;
  }

  /**
   * Convert class name to file name
   * BasicCrossShape -> basic-cross
   */
  private static classNameToFileName(className: string): string {
    return className
      .replace(/Shape$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  /**
   * Generate SVG icon from shape description
   * Creates small visual representation of the shape
   */
  private static getIconForShape(displayName: string): string {
    const name = displayName.toLowerCase();

    // Return a data URI SVG icon that represents the shape
    // These are small 16x16 SVG icons that can be rendered in toolbars
    const icons: { [key: string]: string } = {
      'arrow': this.createArrowIcon(),
      'wave': this.createWaveIcon(),
      'callout': this.createCalloutIcon(),
      'cloud': this.createCloudIcon(),
      'cylinder': this.createCylinderIcon(),
      'diamond': this.createDiamondIcon(),
      'cross': this.createCrossIcon(),
      'star': this.createStarIcon(),
      'pentagon': this.createPentagonIcon(),
      'hexagon': this.createHexagonIcon(),
      'triangle': this.createTriangleIcon(),
      'ellipse': this.createEllipseIcon(),
      'circle': this.createCircleIcon(),
      'rectangle': this.createRectangleIcon(),
    };

    for (const [key, icon] of Object.entries(icons)) {
      if (name.includes(key)) {
        return icon;
      }
    }

    return this.createDefaultIcon(); // Default: simple shape
  }

  // SVG icon generators
  private static createArrowIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 8h10M12 6l2 2-2 2" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createWaveIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 8Q5 4 8 8T14 8" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createCalloutIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 2h12v8H5L2 14V10H1z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createCloudIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 10c0-2 1.5-3 3-3 .5-2 2-3 4-3 2.5 0 4 1.5 4 3.5 0 .5-.2 1-.5 1.5 1 .5 2 1.5 2 2.5 0 2-1.5 3-3.5 3H3c-1.5 0-3-1-3-3z" fill="currentColor"/></svg>';
  }

  private static createCylinderIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><ellipse cx="8" cy="3" rx="4" ry="2" stroke="currentColor" fill="none" stroke-width="1"/><rect x="4" y="3" width="8" height="8" stroke="currentColor" fill="none" stroke-width="1"/><ellipse cx="8" cy="11" rx="4" ry="2" stroke="currentColor" fill="currentColor" opacity="0.3" stroke-width="1"/></svg>';
  }

  private static createDiamondIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 2L14 8L8 14L2 8Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createCrossIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5"/></svg>';
  }

  private static createStarIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 2L10 7H15L11 10L13 15L8 12L3 15L5 10L1 7H6Z" fill="currentColor"/></svg>';
  }

  private static createPentagonIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 2L14 5.5L11.5 12H4.5L2 5.5Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createHexagonIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4 4L8 2L12 4L14 8L12 12L8 14L4 12L2 8Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createTriangleIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 2L14 13H2Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createEllipseIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="5" ry="3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createCircleIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createRectangleIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="8" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  private static createDefaultIcon(): string {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  }

  /**
   * Capitalize string
   */
  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Run the importer
   */
  static run(options: ImportOptions): void {
    // Read source file
    if (!fs.existsSync(options.sourceFile)) {
      console.error(`❌ Source file not found: ${options.sourceFile}`);
      process.exit(1);
    }

    const sourceContent = fs.readFileSync(options.sourceFile, 'utf-8');
    console.log(`📖 Parsing ${options.libraryName}...`);

    // Parse shapes
    const shapes = this.parseShapes(sourceContent);
    console.log(`✅ Found ${shapes.length} shapes`);

    if (shapes.length === 0) {
      console.error('❌ No shapes found in file');
      process.exit(1);
    }

    // Create output directory
    if (!fs.existsSync(options.outDir)) {
      fs.mkdirSync(options.outDir, { recursive: true });
      console.log(`📁 Created directory: ${options.outDir}`);
    }

    // Generate shape class files
    console.log('📝 Generating shape classes...');
    shapes.forEach((shape) => {
      const className = this.functionNameToClassName(shape.functionName);
      const fileName = this.classNameToFileName(className);
      const outFile = path.join(options.outDir, `${fileName}.ts`);

      const classCode = this.generateShapeClass(shape, options.libraryName);
      fs.writeFileSync(outFile, classCode);
      console.log(`   ✓ ${fileName}.ts`);
    });

    // Generate index.ts
    const indexPath = path.join(options.outDir, 'index.ts');
    const indexCode = this.generateIndex(shapes);
    fs.writeFileSync(indexPath, indexCode);
    console.log(`   ✓ index.ts`);

    // Generate registry.ts
    const registryPath = path.join(options.outDir, 'registry.ts');
    const registryCode = this.generateRegistry(shapes, options.libraryName, options.group);
    fs.writeFileSync(registryPath, registryCode);
    console.log(`   ✓ registry.ts`);

    console.log(`\n✨ Import complete!`);
    console.log(`\n📌 Next steps:`);
    console.log(`   1. Update src/shapes/index.ts to include:`);
    console.log(
      `      import { registerDrawio${this.capitalize(options.libraryName)}ShapeClasses, registerDrawio${this.capitalize(options.libraryName)}Shapes } from './drawio-${options.libraryName.toLowerCase()}/registry';`
    );
    console.log(`   2. Add registration calls in registerShapes():`);
    console.log(
      `      registerDrawio${this.capitalize(options.libraryName)}ShapeClasses();`
    );
    console.log(
      `      registerDrawio${this.capitalize(options.libraryName)}Shapes();`
    );
  }
}

// CLI argument parsing
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: npx ts-node scripts/import-drawio-shapes.ts <libraryName> [outDir] [group]

Examples:
  npx ts-node scripts/import-drawio-shapes.ts mxBasic src/shapes/drawio-basic "Draw.io Basic"
  npx ts-node scripts/import-drawio-shapes.ts mxArrows src/shapes/drawio-arrows "Draw.io Arrows"
  npx ts-node scripts/import-drawio-shapes.ts mxFlowchart src/shapes/drawio-flowchart "Draw.io Flowchart"
`);
  process.exit(0);
}

const libraryName = args[0];
const outDir = args[1] || `src/shapes/drawio-${libraryName.toLowerCase()}`;
const group = args[2] || `Draw.io ${libraryName}`;
const sourceFile = `/Users/Marcin/workspace/workspace_tsx/drawio/src/main/webapp/shapes/${libraryName}.js`;

DrawIOShapeImporter.run({
  sourceFile,
  libraryName,
  outDir,
  group,
});
