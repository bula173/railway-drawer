/**
 * @file shape-designer.ts
 * @brief Hybrid shape designer with drawing canvas and SVG path editing
 * @details
 * Provides UI for creating/editing custom shapes with:
 * - Click-to-draw vertex mode (visual)
 * - SVG path editor mode (code)
 * - Shape templates (line, triangle, circle, etc.)
 * - Real-time preview
 * - Property editor (colors, sizes)
 * - Save/Load/Delete operations
 */

import { Graph } from '@maxgraph/core';
import { customShapeRegistry, CustomShape } from '../services/custom-shape-registry';

/**
 * @interface ShapeTemplate
 * @brief Pre-defined shape templates for quick starting
 */
interface ShapeTemplate {
  name: string;
  path: string;
  width: number;
  height: number;
  icon: string;
}

export class ShapeDesignerController {
  private modal: HTMLElement | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private vertices: { x: number; y: number }[] = [];
  private editingShapeId: string | null = null;
  private drawMode = true; // true = draw, false = edit path

  private static SHAPE_TEMPLATES: ShapeTemplate[] = [
    {
      name: 'Line',
      path: 'M 0 50 L 100 50',
      width: 100,
      height: 100,
      icon: '—',
    },
    {
      name: 'Rectangle',
      path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      width: 100,
      height: 100,
      icon: '▭',
    },
    {
      name: 'Circle',
      path: 'M 50 0 A 50 50 0 1 1 49.99 0',
      width: 100,
      height: 100,
      icon: '●',
    },
    {
      name: 'Triangle',
      path: 'M 50 0 L 100 100 L 0 100 Z',
      width: 100,
      height: 100,
      icon: '▲',
    },
    {
      name: 'Diamond',
      path: 'M 50 0 L 100 50 L 50 100 L 0 50 Z',
      width: 100,
      height: 100,
      icon: '◆',
    },
    {
      name: 'Star',
      path: 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 68 L 21 91 L 32 57 L 2 35 L 39 35 Z',
      width: 100,
      height: 100,
      icon: '★',
    },
    {
      name: 'Heart',
      path: 'M 50 95 C 20 75 0 60 0 40 C 0 25 15 15 25 15 C 35 15 50 25 50 25 C 50 25 65 15 75 15 C 85 15 100 25 100 40 C 100 60 80 75 50 95 Z',
      width: 100,
      height: 100,
      icon: '♥',
    },
    {
      name: 'Arrow Right',
      path: 'M 0 50 L 70 50 L 70 30 L 100 60 L 70 90 L 70 70 L 0 70 Z',
      width: 100,
      height: 100,
      icon: '➜',
    },
    {
      name: 'Pentagon',
      path: 'M 50 0 L 100 35 L 82 100 L 18 100 L 0 35 Z',
      width: 100,
      height: 100,
      icon: '⬠',
    },
    {
      name: 'Hexagon',
      path: 'M 25 0 L 75 0 L 100 50 L 75 100 L 25 100 L 0 50 Z',
      width: 100,
      height: 100,
      icon: '⬡',
    },
    {
      name: 'Rounded Rect',
      path: 'M 10 0 L 90 0 Q 100 0 100 10 L 100 90 Q 100 100 90 100 L 10 100 Q 0 100 0 90 L 0 10 Q 0 0 10 0 Z',
      width: 100,
      height: 100,
      icon: '◬',
    },
    {
      name: 'Cloud',
      path: 'M 20 60 Q 10 50 10 40 Q 10 25 20 20 Q 25 10 35 10 Q 45 0 55 0 Q 70 0 75 10 Q 90 10 90 25 Q 95 35 90 45 Q 100 50 95 60 Z',
      width: 100,
      height: 100,
      icon: '☁',
    },
  ];

  constructor(_graph: Graph) {
    this.setupUI();
  }

  /**
   * @brief Initialize shape designer UI
   */
  private setupUI(): void {
    const designerBtn = document.getElementById('btn-shape-designer');
    if (designerBtn) {
      designerBtn.addEventListener('click', () => this.openDesigner());
    }
  }

  /**
   * @brief Open shape designer modal
   */
  openDesigner(shapeId?: string): void {
    if (this.modal) {
      this.modal.remove();
    }

    this.editingShapeId = shapeId || null;
    const editingShape = shapeId ? customShapeRegistry.getById(shapeId) : undefined;

    this.modal = this.createModalHTML(editingShape);
    document.body.appendChild(this.modal);

    this.setupModalHandlers(editingShape);
  }

  /**
   * @brief Create modal HTML structure
   */
  private createModalHTML(editingShape?: CustomShape): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'shape-designer-modal';
    modal.innerHTML = `
      <div class="shape-designer-overlay"></div>
      <div class="shape-designer-panel">
        <div class="designer-header">
          <h2>${editingShape ? 'Edit Shape' : 'Create New Shape'}</h2>
          <button class="designer-close" title="Close">×</button>
        </div>

        <div class="templates-bar">
          <span class="templates-label">Start with template:</span>
          <div class="templates-grid">
            ${ShapeDesignerController.SHAPE_TEMPLATES.map(
              (t) =>
                `<button class="template-btn" data-template="${t.name}" title="${t.name}">${t.icon}</button>`
            ).join('')}
          </div>
        </div>

        <div class="designer-body">
          <!-- Left: Canvas & Mode Toggle -->
          <div class="designer-left">
            <div class="mode-toggle">
              <button class="mode-btn active" data-mode="draw">✏️ Draw</button>
              <button class="mode-btn" data-mode="edit">✐ Edit Path</button>
            </div>

            <div class="draw-canvas-container">
              <canvas id="shape-canvas" width="300" height="300"></canvas>
              <div class="canvas-help">Click to add vertices</div>
            </div>

            <div class="canvas-controls">
              <button class="btn-undo" title="Undo last vertex">↶ Undo</button>
              <button class="btn-clear" title="Clear all vertices">🗑️ Clear</button>
              <button class="btn-close-path" title="Close path">🔒 Close</button>
            </div>
          </div>

          <!-- Right: Editor & Preview -->
          <div class="designer-right">
            <!-- Shape Info -->
            <div class="shape-info">
              <label>Name:</label>
              <input type="text" id="shape-name" placeholder="My Custom Shape" value="${
                editingShape?.name || ''
              }">

              <label>Description:</label>
              <textarea id="shape-desc" placeholder="Optional description">${
                editingShape?.description || ''
              }</textarea>
            </div>

            <!-- SVG Path Editor -->
            <div class="path-editor">
              <label>SVG Path:</label>
              <textarea id="shape-path" class="path-input" placeholder="M 0 0 L 100 0 L 100 100 L 0 100 Z">${
                editingShape?.svgPath || ''
              }</textarea>
            </div>

            <!-- Properties -->
            <div class="shape-properties">
              <label>Fill Color:</label>
              <input type="color" id="shape-fill" value="${editingShape?.fillColor || '#1976d2'}">

              <label>Stroke Color:</label>
              <input type="color" id="shape-stroke" value="${editingShape?.strokeColor || '#0d47a1'}">

              <label>Stroke Width:</label>
              <input type="number" id="shape-stroke-width" min="0" max="10" step="0.5" value="${
                editingShape?.strokeWidth || 2
              }">

              <label>Width:</label>
              <input type="number" id="shape-width" min="20" max="500" value="${editingShape?.width || 100}">

              <label>Height:</label>
              <input type="number" id="shape-height" min="20" max="500" value="${editingShape?.height || 100}">
            </div>

            <!-- Preview -->
            <div class="preview-container">
              <label>Preview:</label>
              <div class="preview-canvas">
                <svg id="preview-svg" width="100" height="100"></svg>
              </div>
            </div>

            <!-- Vertex Code -->
            <div class="vertex-code-section">
              <label>Vertex Code:</label>
              <textarea id="vertex-code" class="vertex-code-output" readonly spellcheck="false"></textarea>
              <button id="copy-vertex-code" class="btn btn-small" title="Copy to clipboard">📋 Copy Code</button>
            </div>
          </div>
        </div>

        <!-- Footer: Actions -->
        <div class="designer-footer">
          <div class="action-buttons">
            <button class="btn-cancel">Cancel</button>
            ${editingShape ? '<button class="btn-delete">Delete</button>' : ''}
            <button class="btn-save">Save Shape</button>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * @brief Setup event handlers for modal
   */
  private setupModalHandlers(editingShape?: CustomShape): void {
    const closeBtn = this.modal?.querySelector('.designer-close');
    const cancelBtn = this.modal?.querySelector('.btn-cancel');
    const saveBtn = this.modal?.querySelector('.btn-save');
    const deleteBtn = this.modal?.querySelector('.btn-delete');
    const overlay = this.modal?.querySelector('.shape-designer-overlay');

    // Close handlers
    closeBtn?.addEventListener('click', () => this.closeDesigner());
    cancelBtn?.addEventListener('click', () => this.closeDesigner());
    overlay?.addEventListener('click', () => this.closeDesigner());

    // Save handler
    saveBtn?.addEventListener('click', () => this.saveShape());

    // Delete handler
    if (deleteBtn && editingShape) {
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete shape "${editingShape.name}"?`)) {
          customShapeRegistry.delete(editingShape.id);
          this.closeDesigner();
        }
      });
    }

    // Mode toggle
    const modeBtns = this.modal?.querySelectorAll('.mode-btn');
    modeBtns?.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        modeBtns.forEach((b) => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        this.drawMode = (e.target as HTMLElement).dataset.mode === 'draw';
      });
    });

    // Canvas handlers
    this.previewCanvas = this.modal?.querySelector('#shape-canvas') as HTMLCanvasElement;
    if (this.previewCanvas) {
      this.previewCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.previewCanvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    }

    // Canvas controls
    this.modal?.querySelector('.btn-undo')?.addEventListener('click', () => {
      this.vertices.pop();
      this.redrawCanvas();
    });

    this.modal?.querySelector('.btn-clear')?.addEventListener('click', () => {
      this.vertices = [];
      this.redrawCanvas();
    });

    this.modal?.querySelector('.btn-close-path')?.addEventListener('click', () => {
      if (this.vertices.length > 2) {
        this.updateSVGPath();
      }
    });

    // SVG Path input handler
    const pathInput = this.modal?.querySelector('#shape-path') as HTMLTextAreaElement;
    pathInput?.addEventListener('change', () => this.updatePreview());

    // Property change handlers
    this.modal?.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('change', () => this.updatePreview());
    });

    // Template buttons
    const templateBtns = this.modal?.querySelectorAll('.template-btn');
    templateBtns?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const templateName = (btn as HTMLElement).dataset.template;
        const template = ShapeDesignerController.SHAPE_TEMPLATES.find((t) => t.name === templateName);
        if (template) {
          this.loadTemplate(template);
        }
      });
    });

    // Copy vertex code button
    const copyCodeBtn = this.modal?.querySelector('#copy-vertex-code');
    copyCodeBtn?.addEventListener('click', () => {
      const vertexCodeArea = this.modal?.querySelector('#vertex-code') as HTMLTextAreaElement;
      if (vertexCodeArea && vertexCodeArea.value) {
        navigator.clipboard.writeText(vertexCodeArea.value).then(() => {
          const btn = copyCodeBtn as HTMLElement;
          const originalText = btn.textContent;
          btn.textContent = '✅ Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        });
      }
    });

    // Load existing path if editing
    if (editingShape?.svgPath) {
      this.vertices = this.parseSVGPath(editingShape.svgPath);
      this.redrawCanvas();
    }

    this.updatePreview();
  }

  /**
   * @brief Load shape template
   */
  private loadTemplate(template: ShapeTemplate): void {
    const pathInput = this.modal?.querySelector('#shape-path') as HTMLTextAreaElement;
    const widthInput = this.modal?.querySelector('#shape-width') as HTMLInputElement;
    const heightInput = this.modal?.querySelector('#shape-height') as HTMLInputElement;

    if (pathInput) {
      pathInput.value = template.path;
      if (widthInput) widthInput.value = template.width.toString();
      if (heightInput) heightInput.value = template.height.toString();

      this.vertices = this.parseSVGPath(template.path);
      this.redrawCanvas();
      this.updatePreview();
    }
  }

  /**
   * @brief Handle canvas click to add vertices
   */
  private handleCanvasClick(e: MouseEvent): void {
    if (!this.drawMode || !this.previewCanvas) return;

    const rect = this.previewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.vertices.push({ x, y });
    this.redrawCanvas();
  }

  /**
   * @brief Handle canvas mouse move for preview line
   */
  private handleCanvasMouseMove(_e: MouseEvent): void {
    if (!this.drawMode) return;
    this.redrawCanvas();
  }

  /**
   * @brief Redraw canvas with current vertices
   */
  private redrawCanvas(): void {
    if (!this.previewCanvas) return;

    const ctx = this.previewCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.previewCanvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, this.previewCanvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < this.previewCanvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(this.previewCanvas.width, i);
      ctx.stroke();
    }

    // Draw lines between vertices
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 2;
    if (this.vertices.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
      for (let i = 1; i < this.vertices.length; i++) {
        ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
      }
      ctx.stroke();
    }

    // Draw vertices as circles
    ctx.fillStyle = '#1976d2';
    this.vertices.forEach((v) => {
      ctx.beginPath();
      ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * @brief Convert vertices to SVG path
   */
  private updateSVGPath(): void {
    if (this.vertices.length < 2) return;

    const pathInput = this.modal?.querySelector('#shape-path') as HTMLTextAreaElement;
    if (!pathInput) return;

    let path = `M ${this.vertices[0].x} ${this.vertices[0].y}`;
    for (let i = 1; i < this.vertices.length; i++) {
      path += ` L ${this.vertices[i].x} ${this.vertices[i].y}`;
    }
    path += ' Z'; // Close path

    pathInput.value = path;
    this.updatePreview();
  }

  /**
   * @brief Parse SVG path string to vertices
   */
  private parseSVGPath(pathStr: string): { x: number; y: number }[] {
    const vertices: { x: number; y: number }[] = [];
    const commands = pathStr.match(/[MLZ][^MLZ]*/g) || [];

    commands.forEach((cmd) => {
      if (cmd.startsWith('M') || cmd.startsWith('L')) {
        const coords = cmd.substring(1).trim().split(/[\s,]+/);
        if (coords.length >= 2) {
          vertices.push({
            x: parseFloat(coords[0]),
            y: parseFloat(coords[1]),
          });
        }
      }
    });

    return vertices;
  }

  /**
   * @brief Update preview SVG and vertex code
   */
  private updatePreview(): void {
    const pathInput = this.modal?.querySelector('#shape-path') as HTMLTextAreaElement;
    const fillInput = this.modal?.querySelector('#shape-fill') as HTMLInputElement;
    const strokeInput = this.modal?.querySelector('#shape-stroke') as HTMLInputElement;
    const strokeWidthInput = this.modal?.querySelector('#shape-stroke-width') as HTMLInputElement;
    const previewSvg = this.modal?.querySelector('#preview-svg') as SVGSVGElement;

    if (!previewSvg || !pathInput) return;

    previewSvg.innerHTML = `
      <path
        d="${pathInput.value}"
        fill="${fillInput?.value || '#1976d2'}"
        stroke="${strokeInput?.value || '#0d47a1'}"
        stroke-width="${strokeWidthInput?.value || 2}"
      />
    `;

    // Generate vertex code
    this.generateVertexCode();
  }

  /**
   * @brief Generate TypeScript vertex code from SVG path
   */
  private generateVertexCode(): void {
    const nameInput = this.modal?.querySelector('#shape-name') as HTMLInputElement;
    const pathInput = this.modal?.querySelector('#shape-path') as HTMLTextAreaElement;
    const fillInput = this.modal?.querySelector('#shape-fill') as HTMLInputElement;
    const strokeInput = this.modal?.querySelector('#shape-stroke') as HTMLInputElement;
    const strokeWidthInput = this.modal?.querySelector('#shape-stroke-width') as HTMLInputElement;
    const vertexCodeArea = this.modal?.querySelector('#vertex-code') as HTMLTextAreaElement;

    if (!vertexCodeArea || !pathInput || !nameInput) return;

    const shapeName = nameInput.value || 'CustomShape';
    const className = this.toPascalCase(shapeName) + 'Shape';
    const path = pathInput.value;
    const fill = fillInput?.value || '#1976d2';
    const stroke = strokeInput?.value || '#0d47a1';
    const strokeWidth = parseFloat(strokeWidthInput?.value || '2');

    const code = this.generateShapeClassCode(className, path, fill, stroke, strokeWidth);
    vertexCodeArea.value = code;
  }

  /**
   * @brief Generate TypeScript Shape class code
   */
  private generateShapeClassCode(className: string, svgPath: string, fill: string, stroke: string, strokeWidth: number): string {
    return `import { Shape } from '@maxgraph/core';

/**
 * Custom shape: ${className}
 * Generated from shape designer
 */
export class ${className} extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    // Parse and render SVG path
    const svgPath = '${svgPath}';
    const scale = { x: w / 100, y: h / 100 }; // Adjust for vertex size

    ${this.generatePathRenderingCode(svgPath)}

    c.setFillColor('${fill}');
    c.setStrokeColor('${stroke}');
    c.setStrokeWidth(${strokeWidth});
    c.fillAndStroke();
  }
}

// Register the shape
import { CellRenderer } from '@maxgraph/core';
CellRenderer.registerShape('custom${className}', ${className} as any);
`;
  }

  /**
   * @brief Generate path rendering code from SVG path
   */
  private generatePathRenderingCode(svgPath: string): string {
    // Parse SVG path and generate canvas drawing code
    const commands = svgPath.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) || [];

    let code = '// Draw SVG path\n    c.begin();\n';

    commands.forEach((cmd) => {
      const type = cmd[0];
      const coords = cmd
        .substring(1)
        .trim()
        .split(/[\s,]+/)
        .map((v) => parseFloat(v));

      switch (type.toUpperCase()) {
        case 'M': // Move to
          if (coords.length >= 2) {
            code += `    c.moveTo(${coords[0]} * scale.x, ${coords[1]} * scale.y);\n`;
          }
          break;
        case 'L': // Line to
          if (coords.length >= 2) {
            code += `    c.lineTo(${coords[0]} * scale.x, ${coords[1]} * scale.y);\n`;
          }
          break;
        case 'C': // Cubic bezier
          if (coords.length >= 6) {
            code += `    c.curveTo(${coords[0]} * scale.x, ${coords[1]} * scale.y, ${coords[2]} * scale.x, ${coords[3]} * scale.y, ${coords[4]} * scale.x, ${coords[5]} * scale.y);\n`;
          }
          break;
        case 'Q': // Quadratic bezier
          if (coords.length >= 4) {
            code += `    c.quadTo(${coords[0]} * scale.x, ${coords[1]} * scale.y, ${coords[2]} * scale.x, ${coords[3]} * scale.y);\n`;
          }
          break;
        case 'A': // Arc
          if (coords.length >= 7) {
            code += `    c.arcTo(${coords[0]} * scale.x, ${coords[1]} * scale.y, ${coords[5]} * scale.x, ${coords[6]} * scale.y);\n`;
          }
          break;
        case 'Z': // Close path
          code += '    c.close();\n';
          break;
      }
    });

    return code;
  }

  /**
   * @brief Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[\s\-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * @brief Save custom shape
   */
  private saveShape(): void {
    const nameInput = this.modal?.querySelector('#shape-name') as HTMLInputElement;
    const descInput = this.modal?.querySelector('#shape-desc') as HTMLTextAreaElement;
    const pathInput = this.modal?.querySelector('#shape-path') as HTMLTextAreaElement;
    const fillInput = this.modal?.querySelector('#shape-fill') as HTMLInputElement;
    const strokeInput = this.modal?.querySelector('#shape-stroke') as HTMLInputElement;
    const strokeWidthInput = this.modal?.querySelector('#shape-stroke-width') as HTMLInputElement;
    const widthInput = this.modal?.querySelector('#shape-width') as HTMLInputElement;
    const heightInput = this.modal?.querySelector('#shape-height') as HTMLInputElement;

    if (!nameInput?.value) {
      alert('Please enter a shape name');
      return;
    }

    if (!pathInput?.value) {
      alert('Please draw a shape or enter an SVG path');
      return;
    }

    const shapeData = {
      name: nameInput.value,
      description: descInput?.value || '',
      svgPath: pathInput.value,
      fillColor: fillInput?.value || '#1976d2',
      strokeColor: strokeInput?.value || '#0d47a1',
      strokeWidth: parseFloat(strokeWidthInput?.value || '2'),
      width: parseInt(widthInput?.value || '100'),
      height: parseInt(heightInput?.value || '100'),
    };

    if (this.editingShapeId) {
      customShapeRegistry.update(this.editingShapeId, shapeData);
      alert('Shape updated!');
    } else {
      customShapeRegistry.create(shapeData);
      alert('Shape saved!');
    }

    this.closeDesigner();
  }

  /**
   * @brief Close designer modal
   */
  private closeDesigner(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.vertices = [];
  }

  destroy(): void {
    this.closeDesigner();
  }
}
