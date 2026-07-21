import { Graph } from '@maxgraph/core';

export class EdgePropertiesController {
  private graph: Graph;
  private currentEdge: any = null;
  private propertiesPanel: HTMLElement | null;

  constructor(graph: Graph) {
    this.graph = graph;
    this.propertiesPanel = document.getElementById('property-content');

    this.graph.getSelectionModel().addListener('change', () => {
      this.update();
    });
  }

  private update(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    const cell = cells[0];
    if (cell && cell.isEdge && cell.isEdge()) {
      this.currentEdge = cell;
      this.showEdgeProperties();
      this.updateEdgeValues();
      this.setupEdgeHandlers();
    }
  }

  private showEdgeProperties(): void {
    const placeholder = document.getElementById('prop-placeholder');
    const editor = document.getElementById('prop-editor');
    if (placeholder) placeholder.style.display = 'none';
    if (editor) editor.style.display = 'none';

    // Create or show edge properties panel
    let edgePanel = document.getElementById('edge-properties');
    if (!edgePanel) {
      edgePanel = this.createEdgePropertiesPanel();
      if (this.propertiesPanel) {
        this.propertiesPanel.appendChild(edgePanel);
      }
    }
    edgePanel.style.display = 'block';
  }

  private createEdgePropertiesPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'edge-properties';
    panel.style.padding = '12px';

    // Title
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.style.marginBottom = '12px';
    title.style.fontSize = '13px';
    title.textContent = 'Connector Properties';
    panel.appendChild(title);

    // Source Arrow Type
    const sourceLabel = document.createElement('label');
    sourceLabel.style.display = 'block';
    sourceLabel.style.marginBottom = '8px';
    sourceLabel.style.fontWeight = '600';
    sourceLabel.style.fontSize = '12px';
    sourceLabel.textContent = 'Source Arrow';
    panel.appendChild(sourceLabel);

    const sourceSelect = document.createElement('select');
    sourceSelect.id = 'edge-source-arrow';
    sourceSelect.style.width = '100%';
    sourceSelect.style.padding = '6px';
    sourceSelect.style.border = '1px solid #ccc';
    sourceSelect.style.borderRadius = '3px';
    sourceSelect.style.fontSize = '12px';
    sourceSelect.style.marginBottom = '12px';
    sourceSelect.innerHTML = `
      <option value="none">None</option>
      <option value="classic">Classic Arrow</option>
      <option value="classicThin">Thin Arrow</option>
      <option value="block">Block Arrow</option>
      <option value="diamond">Diamond</option>
      <option value="circle">Circle</option>
      <option value="oval">Oval</option>
    `;
    panel.appendChild(sourceSelect);

    // Target Arrow Type
    const targetLabel = document.createElement('label');
    targetLabel.style.display = 'block';
    targetLabel.style.marginBottom = '8px';
    targetLabel.style.fontWeight = '600';
    targetLabel.style.fontSize = '12px';
    targetLabel.textContent = 'Target Arrow';
    panel.appendChild(targetLabel);

    const targetSelect = document.createElement('select');
    targetSelect.id = 'edge-target-arrow';
    targetSelect.style.width = '100%';
    targetSelect.style.padding = '6px';
    targetSelect.style.border = '1px solid #ccc';
    targetSelect.style.borderRadius = '3px';
    targetSelect.style.fontSize = '12px';
    targetSelect.style.marginBottom = '12px';
    targetSelect.innerHTML = `
      <option value="none">None</option>
      <option value="classic">Classic Arrow</option>
      <option value="classicThin">Thin Arrow</option>
      <option value="block">Block Arrow</option>
      <option value="diamond">Diamond</option>
      <option value="circle">Circle</option>
      <option value="oval">Oval</option>
    `;
    panel.appendChild(targetSelect);

    // Line Style
    const lineStyleLabel = document.createElement('label');
    lineStyleLabel.style.display = 'block';
    lineStyleLabel.style.marginBottom = '8px';
    lineStyleLabel.style.fontWeight = '600';
    lineStyleLabel.style.fontSize = '12px';
    lineStyleLabel.textContent = 'Line Style';
    panel.appendChild(lineStyleLabel);

    const lineStyleSelect = document.createElement('select');
    lineStyleSelect.id = 'edge-line-style';
    lineStyleSelect.style.width = '100%';
    lineStyleSelect.style.padding = '6px';
    lineStyleSelect.style.border = '1px solid #ccc';
    lineStyleSelect.style.borderRadius = '3px';
    lineStyleSelect.style.fontSize = '12px';
    lineStyleSelect.style.marginBottom = '12px';
    lineStyleSelect.innerHTML = `
      <option value="solid">Solid</option>
      <option value="dashed">Dashed</option>
      <option value="dotted">Dotted</option>
      <option value="dashdot">Dash-Dot</option>
    `;
    panel.appendChild(lineStyleSelect);

    // Line Width
    const widthLabel = document.createElement('label');
    widthLabel.style.display = 'block';
    widthLabel.style.marginBottom = '8px';
    widthLabel.style.fontWeight = '600';
    widthLabel.style.fontSize = '12px';
    widthLabel.textContent = 'Line Width';
    panel.appendChild(widthLabel);

    const widthInput = document.createElement('input');
    widthInput.id = 'edge-line-width';
    widthInput.type = 'number';
    widthInput.min = '0.5';
    widthInput.max = '10';
    widthInput.step = '0.5';
    widthInput.style.width = '100%';
    widthInput.style.padding = '6px';
    widthInput.style.border = '1px solid #ccc';
    widthInput.style.borderRadius = '3px';
    widthInput.style.fontSize = '12px';
    widthInput.style.boxSizing = 'border-box';
    widthInput.style.marginBottom = '12px';
    panel.appendChild(widthInput);

    // Line Color
    const colorLabel = document.createElement('label');
    colorLabel.style.display = 'block';
    colorLabel.style.marginBottom = '8px';
    colorLabel.style.fontWeight = '600';
    colorLabel.style.fontSize = '12px';
    colorLabel.textContent = 'Line Color';
    panel.appendChild(colorLabel);

    const colorInput = document.createElement('input');
    colorInput.id = 'edge-line-color';
    colorInput.type = 'color';
    colorInput.style.width = '100%';
    colorInput.style.height = '36px';
    colorInput.style.border = '1px solid #ccc';
    colorInput.style.borderRadius = '3px';
    colorInput.style.cursor = 'pointer';
    colorInput.style.marginBottom = '12px';
    panel.appendChild(colorInput);

    return panel;
  }

  private updateEdgeValues(): void {
    if (!this.currentEdge) return;

    const style = this.graph.getCellStyle(this.currentEdge) as any;

    // Update select elements
    const sourceArrow = document.getElementById('edge-source-arrow') as HTMLSelectElement;
    if (sourceArrow) {
      sourceArrow.value = style.startArrow || 'none';
    }

    const targetArrow = document.getElementById('edge-target-arrow') as HTMLSelectElement;
    if (targetArrow) {
      targetArrow.value = style.endArrow || 'classic';
    }

    const lineStyle = document.getElementById('edge-line-style') as HTMLSelectElement;
    if (lineStyle) {
      if (style.dashed) {
        lineStyle.value = 'dashed';
      } else if (style.dotted) {
        lineStyle.value = 'dotted';
      } else if (style.dashPattern) {
        lineStyle.value = 'dashdot';
      } else {
        lineStyle.value = 'solid';
      }
    }

    const lineWidth = document.getElementById('edge-line-width') as HTMLInputElement;
    if (lineWidth) {
      lineWidth.value = String(style.strokeWidth || 2);
    }

    const lineColor = document.getElementById('edge-line-color') as HTMLInputElement;
    if (lineColor) {
      lineColor.value = style.strokeColor || '#000000';
    }
  }

  private setupEdgeHandlers(): void {
    const sourceArrow = document.getElementById('edge-source-arrow') as HTMLSelectElement;
    if (sourceArrow) {
      sourceArrow.onchange = () => this.updateEdgeStyle();
    }

    const targetArrow = document.getElementById('edge-target-arrow') as HTMLSelectElement;
    if (targetArrow) {
      targetArrow.onchange = () => this.updateEdgeStyle();
    }

    const lineStyle = document.getElementById('edge-line-style') as HTMLSelectElement;
    if (lineStyle) {
      lineStyle.onchange = () => this.updateEdgeStyle();
    }

    const lineWidth = document.getElementById('edge-line-width') as HTMLInputElement;
    if (lineWidth) {
      lineWidth.onchange = () => this.updateEdgeStyle();
    }

    const lineColor = document.getElementById('edge-line-color') as HTMLInputElement;
    if (lineColor) {
      lineColor.onchange = () => this.updateEdgeStyle();
    }
  }

  private updateEdgeStyle(): void {
    if (!this.currentEdge) return;

    const sourceArrow = (document.getElementById('edge-source-arrow') as HTMLSelectElement)?.value;
    const targetArrow = (document.getElementById('edge-target-arrow') as HTMLSelectElement)?.value;
    const lineStyle = (document.getElementById('edge-line-style') as HTMLSelectElement)?.value;
    const lineWidth = (document.getElementById('edge-line-width') as HTMLInputElement)?.value;
    const lineColor = (document.getElementById('edge-line-color') as HTMLInputElement)?.value;

    this.graph.batchUpdate(() => {
      const style = this.graph.getCellStyle(this.currentEdge) as any;

      // Update arrows
      if (sourceArrow) {
        if (sourceArrow === 'none') {
          delete style.startArrow;
        } else {
          style.startArrow = sourceArrow;
        }
      }

      if (targetArrow) {
        if (targetArrow === 'none') {
          delete style.endArrow;
        } else {
          style.endArrow = targetArrow;
        }
      }

      // Update line style
      style.dashed = lineStyle === 'dashed' ? true : false;
      style.dotted = lineStyle === 'dotted' ? true : false;
      style.dashPattern = lineStyle === 'dashdot' ? '5 5' : undefined;

      // Update line width and color
      if (lineWidth) style.strokeWidth = parseFloat(lineWidth);
      if (lineColor) style.strokeColor = lineColor;

      this.graph.model.setStyle(this.currentEdge, style);
    });

    this.graph.refresh();
  }
}
