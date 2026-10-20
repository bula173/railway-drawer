import { Graph } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import {
  dashPatternOf,
  dashPatternStyle,
  effectiveColor,
  linePatternOf,
  linePatternStyle,
  resolvedStyle,
  setCellStyleValues,
  toColorInputValue,
} from './style-edit';
import type { StyleRecord } from './style-edit';

/** Dash-dot pattern of the "Dash-Dot" line style */
const DASH_DOT_PATTERN = '8 3 1 3';

/** Selects `value` in a <select>, adding an option for values the list does not offer (e.g. 'open') */
function selectValue(select: HTMLSelectElement | null, value: string): void {
  if (!select) return;
  if (!Array.from(select.options).some((o) => o.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = value;
}

export class EdgePropertiesController {
  private graph: Graph;
  private currentEdge: Cell | null = null;
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

    if (cells.length === 0) {
      this.hideEdgeProperties();
      return;
    }

    const cell = cells[0];
    const isEdge = cell && cell.isEdge && cell.isEdge();

    if (isEdge) {
      this.currentEdge = cell;
      this.showEdgeProperties();
      this.updateEdgeValues();
      this.setupEdgeHandlers();
    } else {
      this.hideEdgeProperties();
    }
  }

  private hideEdgeProperties(): void {
    const edgePanel = document.getElementById('edge-properties');
    if (edgePanel) {
      edgePanel.style.display = 'none';
    }
  }

  private showEdgeProperties(): void {
    // The placeholder / editor / canvas states are PropertiesPanel's (properties-state.ts)
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
    sourceSelect.style.border = '1px solid var(--rd-border-strong)';
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
    targetSelect.style.border = '1px solid var(--rd-border-strong)';
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
    lineStyleSelect.style.border = '1px solid var(--rd-border-strong)';
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
    widthInput.style.border = '1px solid var(--rd-border-strong)';
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
    colorInput.style.border = '1px solid var(--rd-border-strong)';
    colorInput.style.borderRadius = '3px';
    colorInput.style.cursor = 'pointer';
    colorInput.style.marginBottom = '12px';
    panel.appendChild(colorInput);

    return panel;
  }

  /** @brief Selected edges, the cells an edit applies to (draw.io edits every selected cell) */
  private selectedEdges(): Cell[] {
    return this.graph.getSelectionCells().filter((cell) => cell.isEdge());
  }

  /**
   * @brief Show the effective values of the first selected edge
   * @details The resolved style has no `none` values (maxGraph's stylesheet deletes them), so a
   * missing arrow means none; it used to show (and on the next edit write) 'classic'.
   */
  private updateEdgeValues(): void {
    if (!this.currentEdge) return;

    const style = resolvedStyle(this.graph, this.currentEdge);
    const arrow = (value: unknown) => (typeof value === 'string' && value !== '' ? value : 'none');

    selectValue(document.getElementById('edge-source-arrow') as HTMLSelectElement | null, arrow(style.startArrow));
    selectValue(document.getElementById('edge-target-arrow') as HTMLSelectElement | null, arrow(style.endArrow));

    const lineStyle = document.getElementById('edge-line-style') as HTMLSelectElement;
    if (lineStyle) {
      const pattern = linePatternOf(style);
      lineStyle.value = pattern === 'dashed' && dashPatternOf(style) === DASH_DOT_PATTERN ? 'dashdot' : pattern;
    }

    const lineWidth = document.getElementById('edge-line-width') as HTMLInputElement;
    if (lineWidth) lineWidth.value = String(style.strokeWidth ?? 1);

    const lineColor = document.getElementById('edge-line-color') as HTMLInputElement;
    if (lineColor) lineColor.value = toColorInputValue(effectiveColor(style, 'strokeColor'), '#000000');
  }

  /** @brief Each control sets only its own keys, on every selected edge (re-bound per selection) */
  private setupEdgeHandlers(): void {
    const bind = (id: string, values: (control: HTMLInputElement) => StyleRecord | null) => {
      const control = document.getElementById(id) as HTMLInputElement | null;
      if (!control) return;
      control.onchange = () => {
        const patch = values(control);
        if (patch) setCellStyleValues(this.graph, this.selectedEdges(), patch);
      };
    };
    // 'none' is written explicitly: the default edge style has endArrow=classic, so removing the
    // key (as before) kept the arrow
    bind('edge-source-arrow', (c) => ({ startArrow: c.value || 'none' }));
    bind('edge-target-arrow', (c) => ({ endArrow: c.value || 'none' }));
    bind('edge-line-style', (c) =>
      c.value === 'dashdot' ? dashPatternStyle(DASH_DOT_PATTERN) : linePatternStyle(c.value));
    bind('edge-line-width', (c) => {
      const width = parseFloat(c.value);
      return Number.isFinite(width) && width >= 0 ? { strokeWidth: width } : null;
    });
    bind('edge-line-color', (c) => (c.value ? { strokeColor: c.value } : null));
  }
}
