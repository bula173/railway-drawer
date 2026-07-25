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
  type: 'rect' | 'circle' | 'triangle' | 'line' | 'diamond' | 'star' | 'pentagon' | 'hexagon' | 'ellipse' |
        'actor' | 'arrow' | 'cloud' | 'cylinder' | 'double-ellipse' | 'image' | 'label' | 'rhombus' | 'swimlane';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number; // degrees
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
              <div class="palette-label">Basic Shapes:</div>
              <div class="palette-grid">
                <button class="palette-shape" data-shape="rect" title="Rectangle">▭</button>
                <button class="palette-shape" data-shape="circle" title="Circle">●</button>
                <button class="palette-shape" data-shape="ellipse" title="Ellipse">⬭</button>
                <button class="palette-shape" data-shape="triangle" title="Triangle">▲</button>
                <button class="palette-shape" data-shape="diamond" title="Diamond">◆</button>
                <button class="palette-shape" data-shape="star" title="Star">★</button>
                <button class="palette-shape" data-shape="pentagon" title="Pentagon">⬠</button>
                <button class="palette-shape" data-shape="hexagon" title="Hexagon">⬡</button>
                <button class="palette-shape" data-shape="line" title="Line">—</button>
              </div>

              <div class="palette-label">Generic Shapes:</div>
              <div class="palette-grid">
                <button class="palette-shape" data-shape="actor" title="Actor">🧑</button>
                <button class="palette-shape" data-shape="arrow" title="Arrow">➤</button>
                <button class="palette-shape" data-shape="cloud" title="Cloud">☁</button>
                <button class="palette-shape" data-shape="cylinder" title="Cylinder">⌗</button>
                <button class="palette-shape" data-shape="double-ellipse" title="Double Ellipse">⧗</button>
                <button class="palette-shape" data-shape="image" title="Image">🖼</button>
                <button class="palette-shape" data-shape="label" title="Label">▢</button>
                <button class="palette-shape" data-shape="rhombus" title="Rhombus">◇</button>
                <button class="palette-shape" data-shape="swimlane" title="Swimlane">⊞</button>
              </div>
            </div>

            <div class="draw-canvas-container">
              <canvas id="shape-canvas" width="300" height="300"></canvas>
              <div class="canvas-help">Drag shapes from palette • Click to select & edit</div>
            </div>

            <div class="canvas-controls">
              <button class="btn-undo" title="Undo last vertex">↶ Undo</button>
              <button class="btn-delete-shape" title="Delete selected shape">🗑️ Delete</button>
              <button class="btn-clear" title="Clear all">🗑️ Clear All</button>
              <button class="btn-close-path" title="Close path">🔒 Close</button>
            </div>

            <div class="canvas-controls">
              <button class="btn-bring-forward" title="Bring forward">⬆ Forward</button>
              <button class="btn-send-backward" title="Send backward">⬇ Backward</button>
              <button class="btn-to-front" title="Bring to front">⬆⬆ Front</button>
              <button class="btn-to-back" title="Send to back">⬇⬇ Back</button>
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

              <label>Rotation (°):</label>
              <input type="number" id="element-rotation" min="0" max="360" step="15" value="0">

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
      this.previewCanvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
      // Setup drag and drop
      this.setupDragAndDrop();
    }

    // Canvas controls
    this.modal?.querySelector('.btn-undo')?.addEventListener('click', () => {
      if (this.shapeElements.length > 0) {
        this.shapeElements.pop();
        this.selectedElement = null;
        this.redrawCanvas();
      }
    });

    this.modal?.querySelector('.btn-clear')?.addEventListener('click', () => {
      this.shapeElements = [];
      this.selectedElement = null;
      this.redrawCanvas();
      this.generateVertexCodeFromComposition();
      this.displaySelectedElementProperties();
      this.renderVertexPreview();
    });

    this.modal?.querySelector('.btn-close-path')?.addEventListener('click', () => {
      // Not used in shape composition mode
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

    // Z-order controls
    this.modal?.querySelector('.btn-bring-forward')?.addEventListener('click', () => {
      if (this.selectedElement) {
        const index = this.shapeElements.indexOf(this.selectedElement);
        if (index < this.shapeElements.length - 1) {
          [this.shapeElements[index], this.shapeElements[index + 1]] = [this.shapeElements[index + 1], this.shapeElements[index]];
          this.redrawCanvas();
          this.generateVertexCodeFromComposition();
        }
      }
    });

    this.modal?.querySelector('.btn-send-backward')?.addEventListener('click', () => {
      if (this.selectedElement) {
        const index = this.shapeElements.indexOf(this.selectedElement);
        if (index > 0) {
          [this.shapeElements[index], this.shapeElements[index - 1]] = [this.shapeElements[index - 1], this.shapeElements[index]];
          this.redrawCanvas();
          this.generateVertexCodeFromComposition();
        }
      }
    });

    this.modal?.querySelector('.btn-to-front')?.addEventListener('click', () => {
      if (this.selectedElement) {
        this.shapeElements = this.shapeElements.filter((el) => el !== this.selectedElement);
        this.shapeElements.push(this.selectedElement);
        this.redrawCanvas();
        this.generateVertexCodeFromComposition();
      }
    });

    this.modal?.querySelector('.btn-to-back')?.addEventListener('click', () => {
      if (this.selectedElement) {
        this.shapeElements = this.shapeElements.filter((el) => el !== this.selectedElement);
        this.shapeElements.unshift(this.selectedElement);
        this.redrawCanvas();
        this.generateVertexCodeFromComposition();
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
    this.modal?.querySelector('#element-rotation')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-fill')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-stroke')?.addEventListener('change', () => this.updateSelectedElement());
    this.modal?.querySelector('#element-stroke-width')?.addEventListener('change', () => this.updateSelectedElement());

    this.updatePreview();
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
   * @brief Redraw canvas with shape elements only
   */
  private redrawCanvas(): void {
    console.log('[DEBUG] redrawCanvas called, shapes:', this.shapeElements.length, 'selected:', this.selectedElement ? this.selectedElement.type : 'none');

    if (!this.previewCanvas) {
      console.log('[DEBUG] No previewCanvas!');
      return;
    }

    const ctx = this.previewCanvas.getContext('2d');
    if (!ctx) {
      console.log('[DEBUG] No canvas context!');
      return;
    }

    ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

    // Draw grid (10px)
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.previewCanvas.width; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, this.previewCanvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < this.previewCanvas.height; i += 10) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(this.previewCanvas.width, i);
      ctx.stroke();
    }

    // Draw ruler (every 50px with labels)
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    for (let i = 50; i < this.previewCanvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 6);
      ctx.stroke();
      ctx.fillText(i + 'px', i, 12);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 50; i < this.previewCanvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(6, i);
      ctx.stroke();
      ctx.fillText(i + 'px', 20, i);
    }

    // Render shape elements only
    if (this.shapeElements.length > 0) {
      this.renderShapeElements();
    }
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

    // Generate code from shape elements only
    let pathCode = '';

    // Add code for shape elements
    this.shapeElements.forEach((el) => {
      pathCode += this.generateShapeElementCode(el);
    });

    const code = this.generateShapeClassCodeCombined(className, pathCode, fill, stroke, strokeWidth);
    vertexCodeArea.value = code;
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
    const rotationInput = this.modal?.querySelector('#element-rotation') as HTMLInputElement;
    const fillInput = this.modal?.querySelector('#element-fill') as HTMLInputElement;
    const strokeInput = this.modal?.querySelector('#element-stroke') as HTMLInputElement;
    const strokeWidthInput = this.modal?.querySelector('#element-stroke-width') as HTMLInputElement;

    if (xInput) this.selectedElement.x = parseInt(xInput.value) || this.selectedElement.x;
    if (yInput) this.selectedElement.y = parseInt(yInput.value) || this.selectedElement.y;
    if (widthInput) this.selectedElement.width = parseInt(widthInput.value) || this.selectedElement.width;
    if (heightInput) this.selectedElement.height = parseInt(heightInput.value) || this.selectedElement.height;
    if (rotationInput) this.selectedElement.rotation = parseFloat(rotationInput.value) || 0;
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

    // Calculate bounds of shape elements only
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Include shape elements in bounds
    this.shapeElements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    if (minX === Infinity) {
      if (infoText) infoText.textContent = 'Drag shapes from palette';
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

      ctx.save();
      ctx.fillStyle = el.fill;
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;

      // Apply rotation around center
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((el.rotation || 0) * Math.PI / 180);
      ctx.translate(-centerX, -centerY);

      switch (el.type) {
        case 'rect':
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(centerX, centerY, w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, w / 2, h / 2, 0, 0, Math.PI * 2);
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
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(centerX, y);
          ctx.lineTo(x + w, centerY);
          ctx.lineTo(centerX, y + h);
          ctx.lineTo(x, centerY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 'star':
          this.drawStar(ctx, centerX, centerY, 5, w / 2, w / 4);
          break;
        case 'pentagon':
          this.drawPolygon(ctx, centerX, centerY, 5, w / 2);
          break;
        case 'hexagon':
          this.drawPolygon(ctx, centerX, centerY, 6, w / 2);
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(x, y + h / 2);
          ctx.lineTo(x + w, y + h / 2);
          ctx.stroke();
          break;
        case 'actor': {
          const cx = centerX;
          // Head
          ctx.beginPath();
          ctx.arc(cx, y + h * 0.2, w * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Body
          ctx.beginPath();
          ctx.moveTo(cx, y + h * 0.35);
          ctx.lineTo(cx, y + h * 0.65);
          ctx.stroke();
          // Arms
          ctx.beginPath();
          ctx.moveTo(x + w * 0.2, y + h * 0.45);
          ctx.lineTo(x + w * 0.8, y + h * 0.45);
          ctx.stroke();
          // Legs
          ctx.beginPath();
          ctx.moveTo(cx, y + h * 0.65);
          ctx.lineTo(x + w * 0.3, y + h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, y + h * 0.65);
          ctx.lineTo(x + w * 0.7, y + h);
          ctx.stroke();
          break;
        }
        case 'arrow': {
          const cy = centerY;
          ctx.beginPath();
          ctx.moveTo(x, cy);
          ctx.lineTo(x + w * 0.7, cy);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + w * 0.7, cy);
          ctx.lineTo(x + w * 0.5, y + h * 0.3);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + w * 0.7, cy);
          ctx.lineTo(x + w * 0.5, y + h * 0.7);
          ctx.stroke();
          break;
        }
        case 'cloud': {
          const cx = centerX;
          ctx.beginPath();
          ctx.arc(x + w * 0.2, y + h * 0.5, w * 0.15, 0, Math.PI * 2);
          ctx.arc(cx, y + h * 0.3, w * 0.2, 0, Math.PI * 2);
          ctx.arc(x + w * 0.8, y + h * 0.5, w * 0.15, 0, Math.PI * 2);
          ctx.arc(cx, y + h * 0.7, w * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'cylinder': {
          const cx = centerX;
          // Top ellipse
          ctx.beginPath();
          ctx.ellipse(cx, y + h * 0.2, w / 2, h * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Body
          ctx.fillRect(x, y + h * 0.2, w, h * 0.6);
          ctx.strokeRect(x, y + h * 0.2, w, h * 0.6);
          // Bottom ellipse
          ctx.beginPath();
          ctx.ellipse(cx, y + h * 0.8, w / 2, h * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'double-ellipse': {
          const cx = centerX;
          const cy = centerY;
          // Outer ellipse
          ctx.beginPath();
          ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Inner ellipse
          ctx.beginPath();
          ctx.ellipse(cx, cy, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = el.stroke;
          ctx.stroke();
          break;
        }
        case 'image':
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          // Draw diagonal lines for image
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + w, y);
          ctx.lineTo(x, y + h);
          ctx.stroke();
          break;
        case 'label':
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          break;
        case 'rhombus': {
          const cx = centerX;
          const cy = centerY;
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(x + w, cy);
          ctx.lineTo(cx, y + h);
          ctx.lineTo(x, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'swimlane':
          // Outer box
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          // Header line
          ctx.beginPath();
          ctx.moveTo(x, y + h * 0.15);
          ctx.lineTo(x + w, y + h * 0.15);
          ctx.stroke();
          break;
      }

      ctx.restore();
    });

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
    (this.modal?.querySelector('#element-rotation') as HTMLInputElement).value = (this.selectedElement.rotation || 0).toString();
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
      console.log('[DEBUG] drop event - shapeType:', shapeType);

      if (!shapeType) {
        console.log('[DEBUG] No shapeType found!');
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      console.log('[DEBUG] drop at:', { x, y, displaySize: { width: rect.width, height: rect.height }, logicalSize: { width: canvas.width, height: canvas.height }, scale: { x: scaleX, y: scaleY } });

      this.addShapeElement(shapeType as any, x, y);
    });


    // Canvas mouse down for selection, dragging or resizing
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const padding = 4;
      const handleSize = 6;

      console.log('[DEBUG] mousedown:', { x, y, totalShapes: this.shapeElements.length });

      // First, check if we clicked on a shape
      let clickedElement = null;

      console.log('[DEBUG] Checking', this.shapeElements.length, 'shapes');
      for (let i = 0; i < this.shapeElements.length; i++) {
        const el = this.shapeElements[i];
        console.log(`[DEBUG] Shape ${i}:`, {
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          bounds: `(${el.x - padding},${el.y - padding}) to (${el.x + el.width + padding},${el.y + el.height + padding})`
        });

        if (x >= el.x - padding && x <= el.x + el.width + padding &&
            y >= el.y - padding && y <= el.y + el.height + padding) {
          console.log(`[DEBUG] Shape ${i} HIT!`);
          clickedElement = el;
          break;
        }
      }

      console.log('[DEBUG] Clicked element:', clickedElement ? clickedElement.type : 'none');

      // If we clicked on a shape, select it first
      if (clickedElement) {
        console.log('[DEBUG] Selecting shape');
        this.selectedElement = clickedElement;
        this.redrawCanvas();
        this.displaySelectedElementProperties();
        this.renderVertexPreview();
      } else {
        // Clicking empty area deselects
        console.log('[DEBUG] Deselecting');
        this.selectedElement = null;
        this.redrawCanvas();
        this.displaySelectedElementProperties();
        this.renderVertexPreview();
        return;
      }

      // Now check if we're clicking on a resize handle of selected element
      if (this.selectedElement) {
        const el = this.selectedElement;
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

      // Otherwise, prepare to drag the selected element
      if (this.selectedElement) {
        this.draggingElement = this.selectedElement;
        this.dragStart = { x, y };
      }
    });

    // Canvas mouse move for dragging or resizing
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

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
    console.log('[DEBUG] addShapeElement:', { type, x, y });

    const element: ShapeElement = {
      type,
      x: Math.max(0, Math.min(x - 30, 300 - 60)),
      y: Math.max(0, Math.min(y - 30, 300 - 60)),
      width: 60,
      height: 60,
      fill: '#1976d2',
      stroke: '#0d47a1',
      strokeWidth: 2,
      rotation: 0,
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    console.log('[DEBUG] Shape created:', element);

    this.shapeElements.push(element);
    console.log('[DEBUG] Total shapes now:', this.shapeElements.length);

    this.selectedElement = element;
    this.redrawCanvas();
    this.displaySelectedElementProperties();
    this.renderVertexPreview();
  }

  /**
   * @brief Render shape elements to canvas
   */
  private renderShapeElements(): void {
    console.log('[DEBUG] renderShapeElements:', this.shapeElements.length, 'shapes');

    if (!this.previewCanvas) {
      console.log('[DEBUG] No previewCanvas in renderShapeElements!');
      return;
    }

    const ctx = this.previewCanvas.getContext('2d');
    if (!ctx) {
      console.log('[DEBUG] No ctx in renderShapeElements!');
      return;
    }

    this.shapeElements.forEach((el, index) => {
      console.log(`[DEBUG] Rendering shape ${index}:`, el.type, 'at', el.x, el.y);

      ctx.save();
      ctx.fillStyle = el.fill;
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;

      // Apply rotation around center
      const centerX = el.x + el.width / 2;
      const centerY = el.y + el.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((el.rotation || 0) * Math.PI / 180);
      ctx.translate(-centerX, -centerY);

      switch (el.type) {
        case 'rect':
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(centerX, centerY, el.width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
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
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(centerX, el.y);
          ctx.lineTo(el.x + el.width, centerY);
          ctx.lineTo(centerX, el.y + el.height);
          ctx.lineTo(el.x, centerY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 'star':
          this.drawStar(ctx, centerX, centerY, 5, el.width / 2, el.width / 4);
          break;
        case 'pentagon':
          this.drawPolygon(ctx, centerX, centerY, 5, el.width / 2);
          break;
        case 'hexagon':
          this.drawPolygon(ctx, centerX, centerY, 6, el.width / 2);
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(el.x, el.y + el.height / 2);
          ctx.lineTo(el.x + el.width, el.y + el.height / 2);
          ctx.stroke();
          break;
        case 'actor': {
          const cx = el.x + el.width / 2;
          // Head
          ctx.beginPath();
          ctx.arc(cx, el.y + el.height * 0.2, el.width * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Body
          ctx.beginPath();
          ctx.moveTo(cx, el.y + el.height * 0.35);
          ctx.lineTo(cx, el.y + el.height * 0.65);
          ctx.stroke();
          // Arms
          ctx.beginPath();
          ctx.moveTo(el.x + el.width * 0.2, el.y + el.height * 0.45);
          ctx.lineTo(el.x + el.width * 0.8, el.y + el.height * 0.45);
          ctx.stroke();
          // Legs
          ctx.beginPath();
          ctx.moveTo(cx, el.y + el.height * 0.65);
          ctx.lineTo(el.x + el.width * 0.3, el.y + el.height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, el.y + el.height * 0.65);
          ctx.lineTo(el.x + el.width * 0.7, el.y + el.height);
          ctx.stroke();
          break;
        }
        case 'arrow': {
          const cy = el.y + el.height / 2;
          // Arrow shaft
          ctx.beginPath();
          ctx.moveTo(el.x, cy);
          ctx.lineTo(el.x + el.width * 0.7, cy);
          ctx.stroke();
          // Arrow head
          ctx.beginPath();
          ctx.moveTo(el.x + el.width * 0.7, cy);
          ctx.lineTo(el.x + el.width * 0.5, el.y + el.height * 0.3);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(el.x + el.width * 0.7, cy);
          ctx.lineTo(el.x + el.width * 0.5, el.y + el.height * 0.7);
          ctx.stroke();
          break;
        }
        case 'cloud': {
          const cx = el.x + el.width / 2;
          ctx.beginPath();
          ctx.arc(el.x + el.width * 0.2, el.y + el.height * 0.5, el.width * 0.15, 0, Math.PI * 2);
          ctx.arc(cx, el.y + el.height * 0.3, el.width * 0.2, 0, Math.PI * 2);
          ctx.arc(el.x + el.width * 0.8, el.y + el.height * 0.5, el.width * 0.15, 0, Math.PI * 2);
          ctx.arc(cx, el.y + el.height * 0.7, el.width * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'cylinder': {
          const cx = el.x + el.width / 2;
          // Top ellipse
          ctx.beginPath();
          ctx.ellipse(cx, el.y + el.height * 0.2, el.width / 2, el.height * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Body
          ctx.fillRect(el.x, el.y + el.height * 0.2, el.width, el.height * 0.6);
          ctx.strokeRect(el.x, el.y + el.height * 0.2, el.width, el.height * 0.6);
          // Bottom ellipse
          ctx.beginPath();
          ctx.ellipse(cx, el.y + el.height * 0.8, el.width / 2, el.height * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'double-ellipse': {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          // Outer ellipse
          ctx.beginPath();
          ctx.ellipse(cx, cy, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Inner ellipse
          ctx.beginPath();
          ctx.ellipse(cx, cy, el.width * 0.35, el.height * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = el.stroke;
          ctx.stroke();
          break;
        }
        case 'image':
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          // Diagonal lines
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + el.width, el.y + el.height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(el.x + el.width, el.y);
          ctx.lineTo(el.x, el.y + el.height);
          ctx.stroke();
          // eslint-disable-next-line no-fallthrough
          break;
        case 'label':
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          break;
        case 'rhombus': {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx, el.y);
          ctx.lineTo(el.x + el.width, cy);
          ctx.lineTo(cx, el.y + el.height);
          ctx.lineTo(el.x, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'swimlane':
          // Outer box
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          // Header line
          ctx.beginPath();
          ctx.moveTo(el.x, el.y + el.height * 0.15);
          ctx.lineTo(el.x + el.width, el.y + el.height * 0.15);
          ctx.stroke();
          break;
      }

      ctx.restore();

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
   * @brief Draw a star shape
   */
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outerRadius: number, innerRadius: number): void {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /**
   * @brief Draw a polygon shape
   */
  private drawPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, sides: number, radius: number): void {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
    const scale = { x: w / 300, y: h / 300 };
${pathCode}
  }

  private drawStar(c: CanvasRenderingContext2D, cx: number, cy: number, points: number, outerRadius: number, innerRadius: number): void {
    c.begin();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.close();
    c.fill();
    c.stroke();
  }

  private drawPolygon(c: CanvasRenderingContext2D, cx: number, cy: number, sides: number, radius: number): void {
    c.begin();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.close();
    c.fill();
    c.stroke();
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
    // Round all coordinates to integers for cleaner code
    const x = Math.round(el.x);
    const y = Math.round(el.y);
    const w = Math.round(el.width);
    const h = Math.round(el.height);
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const rotation = el.rotation || 0;
    const hasRotation = rotation !== 0;

    code += `    c.fillStyle = '${el.fill}';\n`;
    code += `    c.strokeStyle = '${el.stroke}';\n`;
    code += `    c.lineWidth = ${el.strokeWidth};\n`;

    // Apply rotation if needed
    if (hasRotation) {
      code += `    c.save();\n`;
      code += `    c.translate(${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
      code += `    c.rotate(${rotation} * Math.PI / 180);\n`;
      code += `    c.translate(-${Math.round(centerX)} * scale.x, -${Math.round(centerY)} * scale.y);\n`;
    }

    switch (el.type) {
      case 'rect':
        code += `    c.rect(${x} * scale.x, ${y} * scale.y, ${w} * scale.x, ${h} * scale.y);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'circle':
        code += `    c.begin();\n`;
        code += `    c.arc(${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, ${Math.round(w / 2)} * scale.x, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'ellipse':
        code += `    c.begin();\n`;
        code += `    c.ellipse(${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, ${Math.round(w / 2)} * scale.x, ${Math.round(h / 2)} * scale.y, 0, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'triangle':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(x + w / 2)} * scale.x, ${y} * scale.y);\n`;
        code += `    c.lineTo(${x + w} * scale.x, ${y + h} * scale.y);\n`;
        code += `    c.lineTo(${x} * scale.x, ${y + h} * scale.y);\n`;
        code += `    c.close();\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'diamond':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(centerX)} * scale.x, ${y} * scale.y);\n`;
        code += `    c.lineTo(${x + w} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(centerX)} * scale.x, ${y + h} * scale.y);\n`;
        code += `    c.lineTo(${x} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.close();\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'star':
        code += `    this.drawStar(c, ${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, 5, ${Math.round(w / 2)} * scale.x, ${Math.round(w / 4)} * scale.x);\n`;
        break;
      case 'pentagon':
        code += `    this.drawPolygon(c, ${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, 5, ${Math.round(w / 2)} * scale.x);\n`;
        break;
      case 'hexagon':
        code += `    this.drawPolygon(c, ${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, 6, ${Math.round(w / 2)} * scale.x);\n`;
        break;
      case 'line':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${x} * scale.x, ${Math.round(y + h / 2)} * scale.y);\n`;
        code += `    c.lineTo(${x + w} * scale.x, ${Math.round(y + h / 2)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        break;
      case 'actor':
        code += `    // Head\n`;
        code += `    c.begin();\n`;
        code += `    c.arc(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.2)} * scale.y, ${Math.round(w * 0.15)} * scale.x, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        code += `    // Body\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.35)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.65)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        code += `    // Arms\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(x + w * 0.2)} * scale.x, ${Math.round(y + h * 0.45)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(x + w * 0.8)} * scale.x, ${Math.round(y + h * 0.45)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        code += `    // Legs\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.65)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(x + w * 0.3)} * scale.x, ${Math.round(y + h)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.65)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(x + w * 0.7)} * scale.x, ${Math.round(y + h)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        break;
      case 'arrow':
        code += `    // Arrow shaft\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${x} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(x + w * 0.7)} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        code += `    // Arrow head\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(x + w * 0.7)} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(x + w * 0.5)} * scale.x, ${Math.round(y + h * 0.3)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(x + w * 0.7)} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(x + w * 0.5)} * scale.x, ${Math.round(y + h * 0.7)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        break;
      case 'cloud':
        code += `    c.begin();\n`;
        code += `    c.arc(${Math.round(x + w * 0.2)} * scale.x, ${Math.round(y + h * 0.5)} * scale.y, ${Math.round(w * 0.15)} * scale.x, 0, Math.PI * 2);\n`;
        code += `    c.arc(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.3)} * scale.y, ${Math.round(w * 0.2)} * scale.x, 0, Math.PI * 2);\n`;
        code += `    c.arc(${Math.round(x + w * 0.8)} * scale.x, ${Math.round(y + h * 0.5)} * scale.y, ${Math.round(w * 0.15)} * scale.x, 0, Math.PI * 2);\n`;
        code += `    c.arc(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.7)} * scale.y, ${Math.round(w * 0.2)} * scale.x, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'cylinder':
        code += `    // Top ellipse\n`;
        code += `    c.begin();\n`;
        code += `    c.ellipse(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.2)} * scale.y, ${Math.round(w / 2)} * scale.x, ${Math.round(h * 0.1)} * scale.y, 0, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        code += `    // Body\n`;
        code += `    c.rect(${x} * scale.x, ${Math.round(y + h * 0.2)} * scale.y, ${w} * scale.x, ${Math.round(h * 0.6)} * scale.y);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        code += `    // Bottom ellipse\n`;
        code += `    c.begin();\n`;
        code += `    c.ellipse(${Math.round(centerX)} * scale.x, ${Math.round(y + h * 0.8)} * scale.y, ${Math.round(w / 2)} * scale.x, ${Math.round(h * 0.1)} * scale.y, 0, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'double-ellipse':
        code += `    // Outer ellipse\n`;
        code += `    c.begin();\n`;
        code += `    c.ellipse(${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, ${Math.round(w / 2)} * scale.x, ${Math.round(h / 2)} * scale.y, 0, 0, Math.PI * 2);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        code += `    // Inner ellipse\n`;
        code += `    c.begin();\n`;
        code += `    c.ellipse(${Math.round(centerX)} * scale.x, ${Math.round(centerY)} * scale.y, ${Math.round(w * 0.35)} * scale.x, ${Math.round(h * 0.35)} * scale.y, 0, 0, Math.PI * 2);\n`;
        code += `    c.fillStyle = '#ffffff';\n`;
        code += `    c.fill();\n`;
        code += `    c.strokeStyle = '${el.stroke}';\n`;
        code += `    c.stroke();\n`;
        break;
      case 'image':
        code += `    // Image frame\n`;
        code += `    c.rect(${x} * scale.x, ${y} * scale.y, ${w} * scale.x, ${h} * scale.y);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        code += `    // Diagonal lines\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${x} * scale.x, ${y} * scale.y);\n`;
        code += `    c.lineTo(${x + w} * scale.x, ${y + h} * scale.y);\n`;
        code += `    c.stroke();\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${x + w} * scale.x, ${y} * scale.y);\n`;
        code += `    c.lineTo(${x} * scale.x, ${y + h} * scale.y);\n`;
        code += `    c.stroke();\n`;
        break;
      case 'label':
        code += `    c.rect(${x} * scale.x, ${y} * scale.y, ${w} * scale.x, ${h} * scale.y);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'rhombus':
        code += `    c.begin();\n`;
        code += `    c.moveTo(${Math.round(centerX)} * scale.x, ${y} * scale.y);\n`;
        code += `    c.lineTo(${x + w} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.lineTo(${Math.round(centerX)} * scale.x, ${y + h} * scale.y);\n`;
        code += `    c.lineTo(${x} * scale.x, ${Math.round(centerY)} * scale.y);\n`;
        code += `    c.close();\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        break;
      case 'swimlane':
        code += `    // Outer box\n`;
        code += `    c.rect(${x} * scale.x, ${y} * scale.y, ${w} * scale.x, ${h} * scale.y);\n`;
        code += `    c.fill();\n`;
        code += `    c.stroke();\n`;
        code += `    // Header line\n`;
        code += `    c.begin();\n`;
        code += `    c.moveTo(${x} * scale.x, ${Math.round(y + h * 0.15)} * scale.y);\n`;
        code += `    c.lineTo(${x + w} * scale.x, ${Math.round(y + h * 0.15)} * scale.y);\n`;
        code += `    c.stroke();\n`;
        break;
    }

    if (hasRotation) {
      code += `    c.restore();\n`;
    }

    code += `\n`;
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
