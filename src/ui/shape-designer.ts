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

interface ShapeElement {
  type: 'rect' | 'circle' | 'triangle' | 'line' | 'polygon';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  id: string;
}

export class ShapeDesignerController {
  private modal: HTMLElement | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private vertices: { x: number; y: number }[] = [];
  private shapeElements: ShapeElement[] = [];
  private selectedElement: ShapeElement | null = null;
  private draggingElement: ShapeElement | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private resizingHandle: string | null = null; // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
  private editingShapeId: string | null = null;
  private drawMode = true; // true = draw, false = edit path


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

        <div class="designer-body">
          <!-- Left: Canvas & Shape Palette -->
          <div class="designer-left">
            <!-- Shape Palette -->
            <div class="shape-palette">
              <div class="palette-label">Drag shapes or click to draw:</div>
              <div class="palette-grid">
                <button class="palette-shape" data-shape="rect" title="Rectangle">▭</button>
                <button class="palette-shape" data-shape="circle" title="Circle">●</button>
                <button class="palette-shape" data-shape="triangle" title="Triangle">▲</button>
                <button class="palette-shape" data-shape="line" title="Line">—</button>
              </div>
            </div>

            <div class="draw-canvas-container">
              <canvas id="shape-canvas" width="300" height="300"></canvas>
              <div class="canvas-help">Click to add vertices • Drag shapes from palette</div>
            </div>

            <div class="canvas-controls">
              <button class="btn-undo" title="Undo last vertex">↶ Undo</button>
              <button class="btn-delete-shape" title="Delete selected shape">🗑️ Delete</button>
              <button class="btn-clear" title="Clear all">🗑️ Clear All</button>
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

            <!-- Global Properties -->
            <div class="shape-properties">
              <label><strong>Shape Properties:</strong></label>

              <label>Fill Color:</label>
              <input type="color" id="shape-fill" value="${editingShape?.fillColor || '#1976d2'}">

              <label>Stroke Color:</label>
              <input type="color" id="shape-stroke" value="${editingShape?.strokeColor || '#0d47a1'}">

              <label>Stroke Width:</label>
              <input type="number" id="shape-stroke-width" min="0" max="10" step="0.5" value="${
                editingShape?.strokeWidth || 2
              }">

              <label>Default Width:</label>
              <input type="number" id="shape-width" min="20" max="500" value="${editingShape?.width || 100}">

              <label>Default Height:</label>
              <input type="number" id="shape-height" min="20" max="500" value="${editingShape?.height || 100}">
            </div>

            <!-- Selected Element Properties -->
            <div class="element-properties" style="display: none;">
              <label><strong>Selected Shape:</strong></label>

              <label>X Position:</label>
              <input type="number" id="element-x" min="0" max="300">

              <label>Y Position:</label>
              <input type="number" id="element-y" min="0" max="300">

              <label>Width:</label>
              <input type="number" id="element-width" min="10" max="200">

              <label>Height:</label>
              <input type="number" id="element-height" min="10" max="200">

              <label>Fill Color:</label>
              <input type="color" id="element-fill">

              <label>Stroke Color:</label>
              <input type="color" id="element-stroke">

              <label>Stroke Width:</label>
              <input type="number" id="element-stroke-width" min="0" max="10" step="0.5">
            </div>

            <!-- Vertex Preview -->
            <div class="preview-container">
              <label><strong>Vertex Preview:</strong></label>
              <div class="vertex-preview">
                <canvas id="vertex-preview-canvas" width="150" height="150"></canvas>
              </div>
              <div class="preview-info">
                <small id="preview-info-text">Draw shapes to preview</small>
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

    // Canvas handlers
    this.previewCanvas = this.modal?.querySelector('#shape-canvas') as HTMLCanvasElement;
    if (this.previewCanvas) {
      this.previewCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.previewCanvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
      // Setup drag and drop
      this.setupDragAndDrop();
    }

    // Canvas controls
    this.modal?.querySelector('.btn-undo')?.addEventListener('click', () => {
      this.vertices.pop();
      this.redrawCanvas();
    });

    this.modal?.querySelector('.btn-clear')?.addEventListener('click', () => {
      this.vertices = [];
      this.shapeElements = [];
      this.selectedElement = null;
      this.redrawCanvas();
    });

    this.modal?.querySelector('.btn-close-path')?.addEventListener('click', () => {
      if (this.vertices.length > 2) {
        this.updateSVGPath();
      }
    });

    this.modal?.querySelector('.btn-delete-shape')?.addEventListener('click', () => {
      if (this.selectedElement) {
        this.shapeElements = this.shapeElements.filter((el) => el !== this.selectedElement);
        this.selectedElement = null;
        this.redrawCanvas();
        this.generateVertexCodeFromComposition();
        this.displaySelectedElementProperties();
        this.renderVertexPreview();
      }
    });

    // Property change handlers
    this.modal?.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('change', () => this.updatePreview());
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

    // Element property change listeners
    this.modal?.querySelector('#element-x')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-y')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-width')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-height')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-fill')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-stroke')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-stroke-width')?.addEventListener('change', () => this.updateSelectedElement());

    // Load existing path if editing
    if (editingShape?.svgPath) {
      this.vertices = this.parseSVGPath(editingShape.svgPath);
      this.redrawCanvas();
    }

    this.updatePreview();
    this.renderVertexPreview();
  }

  /**
   * @brief Handle canvas click to add vertices or select shapes
   */
  private handleCanvasClick(e: MouseEvent): void {
    if (!this.previewCanvas) return;

    const rect = this.previewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // First, try to select a shape element
    let clickedElement = false;
    for (const el of this.shapeElements) {
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        this.selectedElement = el;
        clickedElement = true;
        break;
      }
    }

    // If no shape clicked, add a vertex
    if (!clickedElement) {
      this.selectedElement = null;
      this.vertices.push({ x, y });
    }

    this.redrawCanvas();
    this.displaySelectedElementProperties();
    this.renderVertexPreview();
  }

  /**
   * @brief Handle canvas mouse move for preview line
   */
  private handleCanvasMouseMove(_e: MouseEvent): void {
    if (!this.drawMode) return;
    this.redrawCanvas();
  }

  /**
   * @brief Redraw canvas with vertices and shape elements
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

    // Render shape elements
    if (this.shapeElements.length > 0) {
      this.renderShapeElements();
    }

    // Render vertices
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
   * @brief Generate TypeScript vertex code from vertices and shapes
   */
  private generateVertexCode(): void {
    const nameInput = this.modal?.querySelector('#shape-name') as HTMLInputElement;
    const fillInput = this.modal?.querySelector('#shape-fill') as HTMLInputElement;
    const strokeInput = this.modal?.querySelector('#shape-stroke') as HTMLInputElement;
    const strokeWidthInput = this.modal?.querySelector('#shape-stroke-width') as HTMLInputElement;
    const vertexCodeArea = this.modal?.querySelector('#vertex-code') as HTMLTextAreaElement;

    if (!vertexCodeArea || !nameInput) return;

    const shapeName = nameInput.value || 'CustomShape';
    const className = this.toPascalCase(shapeName) + 'Shape';
    const fill = fillInput?.value || '#1976d2';
    const stroke = strokeInput?.value || '#0d47a1';
    const strokeWidth = parseFloat(strokeWidthInput?.value || '2');

    // Generate code from both vertices and shapes
    let pathCode = '';

    // Add code for shape elements
    this.shapeElements.forEach((el) => {
      pathCode += this.generateShapeElementCode(el);
    });

    // Add code for vertices if any
    if (this.vertices.length > 0) {
      pathCode += this.generateVertexPathCode();
    }

    const code = this.generateShapeClassCodeCombined(className, pathCode, fill, stroke, strokeWidth);
    vertexCodeArea.value = code;
  }

  /**
   * @brief Generate vertex path code
   */
  private generateVertexPathCode(): string {
    if (this.vertices.length < 2) return '';

    let code = '    // Draw vertex path\n    c.begin();\n';
    code += `    c.moveTo(${this.vertices[0].x}, ${this.vertices[0].y});\n`;

    for (let i = 1; i < this.vertices.length; i++) {
      code += `    c.lineTo(${this.vertices[i].x}, ${this.vertices[i].y});\n`;
    }

    code += '    c.fillAndStroke();\n\n';
    return code;
  }

  /**
   * @brief Generate combined shape class code
   */
  private generateShapeClassCodeCombined(className: string, pathCode: string, fill: string, stroke: string, strokeWidth: number): string {
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

    const scale = { x: w / 300, y: h / 300 };

${pathCode}
    c.setFillColor('${fill}');
    c.setStrokeColor('${stroke}');
    c.setStrokeWidth(${strokeWidth});
  }
}

// Register the shape
import { CellRenderer } from '@maxgraph/core';
CellRenderer.registerShape('custom${className}', ${className} as any);
`;
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
   * @brief Update selected element from UI inputs
   */
  private updateSelectedElement(): void {
    if (!this.selectedElement) return;

    const xInput = this.modal?.querySelector('#element-x') as HTMLInputElement;
    const yInput = this.modal?.querySelector('#element-y') as HTMLInputElement;
    const widthInput = this.modal?.querySelector('#element-width') as HTMLInputElement;
    const heightInput = this.modal?.querySelector('#element-height') as HTMLInputElement;
    const fillInput = this.modal?.querySelector('#element-fill') as HTMLInputElement;
    const strokeInput = this.modal?.querySelector('#element-stroke') as HTMLInputElement;
    const strokeWidthInput = this.modal?.querySelector('#element-stroke-width') as HTMLInputElement;

    if (xInput) this.selectedElement.x = parseInt(xInput.value) || this.selectedElement.x;
    if (yInput) this.selectedElement.y = parseInt(yInput.value) || this.selectedElement.y;
    if (widthInput) this.selectedElement.width = parseInt(widthInput.value) || this.selectedElement.width;
    if (heightInput) this.selectedElement.height = parseInt(heightInput.value) || this.selectedElement.height;
    if (fillInput) this.selectedElement.fill = fillInput.value;
    if (strokeInput) this.selectedElement.stroke = strokeInput.value;
    if (strokeWidthInput) this.selectedElement.strokeWidth = parseFloat(strokeWidthInput.value) || this.selectedElement.strokeWidth;

    this.redrawCanvas();
    this.generateVertexCodeFromComposition();
    this.renderVertexPreview();
  }

  /**
   * @brief Render vertex preview canvas
   */
  private renderVertexPreview(): void {
    const previewCanvas = this.modal?.querySelector('#vertex-preview-canvas') as HTMLCanvasElement;
    const infoText = this.modal?.querySelector('#preview-info-text') as HTMLElement;

    if (!previewCanvas) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Draw border
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Calculate bounds of all elements
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Include vertices in bounds
    this.vertices.forEach((v) => {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    });

    // Include shape elements in bounds
    this.shapeElements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    if (minX === Infinity) {
      if (infoText) infoText.textContent = 'Draw shapes to preview';
      return;
    }

    // Calculate scale to fit in preview
    const padding = 10;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const scaleX = (previewCanvas.width - padding * 2) / contentWidth;
    const scaleY = (previewCanvas.height - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Max scale of 2x

    // Draw shapes
    this.shapeElements.forEach((el) => {
      const x = (el.x - minX) * scale + padding;
      const y = (el.y - minY) * scale + padding;
      const w = el.width * scale;
      const h = el.height * scale;

      ctx.fillStyle = el.fill;
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;

      switch (el.type) {
        case 'rect':
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(x, y + h);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(x, y + h / 2);
          ctx.lineTo(x + w, y + h / 2);
          ctx.stroke();
          break;
      }
    });

    // Draw vertices
    if (this.vertices.length > 0) {
      ctx.strokeStyle = '#1976d2';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const v0 = this.vertices[0];
      ctx.moveTo((v0.x - minX) * scale + padding, (v0.y - minY) * scale + padding);
      for (let i = 1; i < this.vertices.length; i++) {
        const v = this.vertices[i];
        ctx.lineTo((v.x - minX) * scale + padding, (v.y - minY) * scale + padding);
      }
      ctx.stroke();

      // Draw vertex points
      ctx.fillStyle = '#1976d2';
      this.vertices.forEach((v) => {
        ctx.beginPath();
        ctx.arc((v.x - minX) * scale + padding, (v.y - minY) * scale + padding, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Update info
    if (infoText) {
      const elementCount = this.shapeElements.length + (this.vertices.length > 0 ? 1 : 0);
      infoText.textContent = `${elementCount} element${elementCount !== 1 ? 's' : ''} • ${this.shapeElements.length} shape${this.shapeElements.length !== 1 ? 's' : ''}`;
    }
  }

  /**
   * @brief Display selected element properties in UI
   */
  private displaySelectedElementProperties(): void {
    const elementProps = this.modal?.querySelector('.element-properties') as HTMLElement;
    const shapeProps = this.modal?.querySelector('.shape-properties') as HTMLElement;

    if (!elementProps || !shapeProps) return;

    if (!this.selectedElement) {
      elementProps.style.display = 'none';
      shapeProps.style.display = 'block';
      return;
    }

    shapeProps.style.display = 'none';
    elementProps.style.display = 'block';

    (this.modal?.querySelector('#element-x') as HTMLInputElement).value = this.selectedElement.x.toString();
    (this.modal?.querySelector('#element-y') as HTMLInputElement).value = this.selectedElement.y.toString();
    (this.modal?.querySelector('#element-width') as HTMLInputElement).value = this.selectedElement.width.toString();
    (this.modal?.querySelector('#element-height') as HTMLInputElement).value = this.selectedElement.height.toString();
    (this.modal?.querySelector('#element-fill') as HTMLInputElement).value = this.selectedElement.fill;
    (this.modal?.querySelector('#element-stroke') as HTMLInputElement).value = this.selectedElement.stroke;
    (this.modal?.querySelector('#element-stroke-width') as HTMLInputElement).value = this.selectedElement.strokeWidth.toString();
  }

  /**
   * @brief Setup drag and drop for shape composition
   */
  private setupDragAndDrop(): void {
    const paletteShapes = this.modal?.querySelectorAll('.palette-shape');
    const canvas = this.previewCanvas;

    if (!canvas) return;

    // Setup draggable palette items
    paletteShapes?.forEach((btn) => {
      (btn as HTMLElement).draggable = true;
      btn.addEventListener('dragstart', (e) => {
        const shapeType = (e.target as HTMLElement).dataset.shape;
        (e as DragEvent).dataTransfer!.effectAllowed = 'copy';
        (e as DragEvent).dataTransfer!.setData('shapeType', shapeType || '');
      });
    });

    // Setup canvas as drop target
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'copy';
      canvas.style.opacity = '0.8';
    });

    canvas.addEventListener('dragleave', () => {
      canvas.style.opacity = '1';
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      canvas.style.opacity = '1';

      const shapeType = (e as DragEvent).dataTransfer!.getData('shapeType');
      if (!shapeType) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.addShapeElement(shapeType as any, x, y);
    });

    // Canvas click to select/deselect
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.selectedElement = null;
      for (const el of this.shapeElements) {
        if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
          this.selectedElement = el;
          break;
        }
      }

      this.redrawCanvas();
    });

    // Canvas mouse down for dragging or resizing
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if we're clicking on a resize handle
      if (this.selectedElement) {
        const el = this.selectedElement;
        const handleSize = 6;
        const handles: { [key: string]: { x: number; y: number } } = {
          nw: { x: el.x - handleSize / 2, y: el.y - handleSize / 2 },
          n: { x: el.x + el.width / 2 - handleSize / 2, y: el.y - handleSize / 2 },
          ne: { x: el.x + el.width - handleSize / 2, y: el.y - handleSize / 2 },
          e: { x: el.x + el.width - handleSize / 2, y: el.y + el.height / 2 - handleSize / 2 },
          se: { x: el.x + el.width - handleSize / 2, y: el.y + el.height - handleSize / 2 },
          s: { x: el.x + el.width / 2 - handleSize / 2, y: el.y + el.height - handleSize / 2 },
          sw: { x: el.x - handleSize / 2, y: el.y + el.height - handleSize / 2 },
          w: { x: el.x - handleSize / 2, y: el.y + el.height / 2 - handleSize / 2 },
        };

        for (const [key, handle] of Object.entries(handles)) {
          if (x >= handle.x && x <= handle.x + handleSize && y >= handle.y && y <= handle.y + handleSize) {
            this.resizingHandle = key;
            this.dragStart = { x, y };
            return;
          }
        }
      }

      // Otherwise, check if dragging element
      for (const el of this.shapeElements) {
        if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
          this.draggingElement = el;
          this.dragStart = { x, y };
          break;
        }
      }
    });

    // Canvas mouse move for dragging or resizing
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update cursor based on handle or position
      if (this.selectedElement) {
        const el = this.selectedElement;
        const handleSize = 6;
        const handles: { [key: string]: { x: number; y: number; cursor: string } } = {
          nw: { x: el.x - handleSize / 2, y: el.y - handleSize / 2, cursor: 'nw-resize' },
          n: { x: el.x + el.width / 2 - handleSize / 2, y: el.y - handleSize / 2, cursor: 'ns-resize' },
          ne: { x: el.x + el.width - handleSize / 2, y: el.y - handleSize / 2, cursor: 'ne-resize' },
          e: { x: el.x + el.width - handleSize / 2, y: el.y + el.height / 2 - handleSize / 2, cursor: 'ew-resize' },
          se: { x: el.x + el.width - handleSize / 2, y: el.y + el.height - handleSize / 2, cursor: 'se-resize' },
          s: { x: el.x + el.width / 2 - handleSize / 2, y: el.y + el.height - handleSize / 2, cursor: 'ns-resize' },
          sw: { x: el.x - handleSize / 2, y: el.y + el.height - handleSize / 2, cursor: 'sw-resize' },
          w: { x: el.x - handleSize / 2, y: el.y + el.height / 2 - handleSize / 2, cursor: 'ew-resize' },
        };

        let cursorFound = false;
        for (const [, handle] of Object.entries(handles)) {
          if (x >= handle.x && x <= handle.x + handleSize && y >= handle.y && y <= handle.y + handleSize) {
            canvas.style.cursor = handle.cursor;
            cursorFound = true;
            break;
          }
        }
        if (!cursorFound) {
          canvas.style.cursor = 'crosshair';
        }
      }

      // Handle resizing
      if (this.resizingHandle && this.selectedElement && this.dragStart) {
        const el = this.selectedElement;
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;

        switch (this.resizingHandle) {
          case 'nw':
            el.x += dx;
            el.y += dy;
            el.width -= dx;
            el.height -= dy;
            break;
          case 'n':
            el.y += dy;
            el.height -= dy;
            break;
          case 'ne':
            el.y += dy;
            el.width += dx;
            el.height -= dy;
            break;
          case 'e':
            el.width += dx;
            break;
          case 'se':
            el.width += dx;
            el.height += dy;
            break;
          case 's':
            el.height += dy;
            break;
          case 'sw':
            el.x += dx;
            el.width -= dx;
            el.height += dy;
            break;
          case 'w':
            el.x += dx;
            el.width -= dx;
            break;
        }

        // Ensure minimum size
        if (el.width < 20) el.width = 20;
        if (el.height < 20) el.height = 20;

        this.dragStart = { x, y };
        this.redrawCanvas();
        return;
      }

      // Handle dragging
      if (this.draggingElement && this.dragStart) {
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;

        this.draggingElement.x += dx;
        this.draggingElement.y += dy;

        this.dragStart = { x, y };
        this.redrawCanvas();
      }
    });

    // Canvas mouse up to stop dragging or resizing
    canvas.addEventListener('mouseup', () => {
      this.draggingElement = null;
      this.resizingHandle = null;
      this.dragStart = null;
      canvas.style.cursor = 'crosshair';
      this.generateVertexCodeFromComposition();
      this.displaySelectedElementProperties();
      this.renderVertexPreview();
    });
  }

  /**
   * @brief Add a shape element to the composition
   */
  private addShapeElement(type: ShapeElement['type'], x: number, y: number): void {
    const element: ShapeElement = {
      type,
      x: Math.max(0, Math.min(x - 30, 300 - 60)),
      y: Math.max(0, Math.min(y - 30, 300 - 60)),
      width: 60,
      height: 60,
      fill: '#1976d2',
      stroke: '#0d47a1',
      strokeWidth: 2,
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.shapeElements.push(element);
    this.selectedElement = element;
    this.redrawCanvas();
    this.displaySelectedElementProperties();
    this.renderVertexPreview();
  }

  /**
   * @brief Render shape elements to canvas
   */
  private renderShapeElements(): void {
    if (!this.previewCanvas) return;

    const ctx = this.previewCanvas.getContext('2d');
    if (!ctx) return;

    this.shapeElements.forEach((el) => {
      ctx.fillStyle = el.fill;
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;

      switch (el.type) {
        case 'rect':
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(el.x + el.width / 2, el.y);
          ctx.lineTo(el.x + el.width, el.y + el.height);
          ctx.lineTo(el.x, el.y + el.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(el.x, el.y + el.height / 2);
          ctx.lineTo(el.x + el.width, el.y + el.height / 2);
          ctx.stroke();
          break;
      }

      // Draw selection outline and resize handles
      if (this.selectedElement === el) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(el.x - 2, el.y - 2, el.width + 4, el.height + 4);
        ctx.setLineDash([]);

        // Draw resize handles
        const handleSize = 6;
        const handleStyle = '#ff6b6b';
        const handles = [
          { x: el.x - handleSize / 2, y: el.y - handleSize / 2, cursor: 'nw-resize' }, // nw
          { x: el.x + el.width / 2 - handleSize / 2, y: el.y - handleSize / 2, cursor: 'ns-resize' }, // n
          { x: el.x + el.width - handleSize / 2, y: el.y - handleSize / 2, cursor: 'ne-resize' }, // ne
          { x: el.x + el.width - handleSize / 2, y: el.y + el.height / 2 - handleSize / 2, cursor: 'ew-resize' }, // e
          { x: el.x + el.width - handleSize / 2, y: el.y + el.height - handleSize / 2, cursor: 'se-resize' }, // se
          { x: el.x + el.width / 2 - handleSize / 2, y: el.y + el.height - handleSize / 2, cursor: 'ns-resize' }, // s
          { x: el.x - handleSize / 2, y: el.y + el.height - handleSize / 2, cursor: 'sw-resize' }, // sw
          { x: el.x - handleSize / 2, y: el.y + el.height / 2 - handleSize / 2, cursor: 'ew-resize' }, // w
        ];

        ctx.fillStyle = handleStyle;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        handles.forEach((handle) => {
          ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
          ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });
      }
    });
  }

  /**
   * @brief Generate vertex code from composed shapes
   */
  private generateVertexCodeFromComposition(): void {
    if (this.shapeElements.length === 0) return;

    const nameInput = this.modal?.querySelector('#shape-name') as HTMLInputElement;
    const vertexCodeArea = this.modal?.querySelector('#vertex-code') as HTMLTextAreaElement;

    if (!vertexCodeArea || !nameInput) return;

    const shapeName = nameInput.value || 'CustomShape';
    const className = this.toPascalCase(shapeName) + 'Shape';

    let pathCode = '';
    this.shapeElements.forEach((el) => {
      pathCode += this.generateShapeElementCode(el);
    });

    const code = `import { Shape } from '@maxgraph/core';

/**
 * Composite shape: ${className}
 * Generated from shape designer composition
 */
export class ${className} extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const scale = { x: w / 300, y: h / 300 };

${pathCode}

    c.setFillColor('#1976d2');
    c.setStrokeColor('#0d47a1');
    c.setStrokeWidth(2);
  }
}

// Register the shape
import { CellRenderer } from '@maxgraph/core';
CellRenderer.registerShape('custom${className}', ${className} as any);
`;

    vertexCodeArea.value = code;
  }

  /**
   * @brief Generate code for a single shape element
   */
  private generateShapeElementCode(el: ShapeElement): string {
    let code = '';

    switch (el.type) {
      case 'rect':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${el.x} * scale.x, ${el.y} * scale.y);\n`;
        code += `    c.lineTo(${el.x + el.width} * scale.x, ${el.y} * scale.y);\n`;
        code += `    c.lineTo(${el.x + el.width} * scale.x, ${el.y + el.height} * scale.y);\n`;
        code += `    c.lineTo(${el.x} * scale.x, ${el.y + el.height} * scale.y);\n`;
        code += `    c.close();\n`;
        code += `    c.fillAndStroke();\n\n`;
        break;
      case 'circle':
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const r = el.width / 2;
        code += `    c.begin();\n`;
        code += `    c.ellipse(${cx} * scale.x - ${r} * scale.x, ${cy} * scale.y - ${r} * scale.y, ${el.width} * scale.x, ${el.height} * scale.y);\n`;
        code += `    c.fillAndStroke();\n\n`;
        break;
      case 'triangle':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${el.x + el.width / 2} * scale.x, ${el.y} * scale.y);\n`;
        code += `    c.lineTo(${el.x + el.width} * scale.x, ${el.y + el.height} * scale.y);\n`;
        code += `    c.lineTo(${el.x} * scale.x, ${el.y + el.height} * scale.y);\n`;
        code += `    c.close();\n`;
        code += `    c.fillAndStroke();\n\n`;
        break;
      case 'line':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${el.x} * scale.x, ${el.y + el.height / 2} * scale.y);\n`;
        code += `    c.lineTo(${el.x + el.width} * scale.x, ${el.y + el.height / 2} * scale.y);\n`;
        code += `    c.stroke();\n\n`;
        break;
    }

    return code;
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
