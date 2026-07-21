import { Graph } from '@maxgraph/core';

export class PropertiesPanel {
  private graph: Graph;
  private contentElement: HTMLElement;

  constructor(graph: Graph, contentElementId: string) {
    this.graph = graph;
    this.contentElement = document.getElementById(contentElementId)!;

    this.graph.getSelectionModel().addListener('change', () => {
      this.update();
    });
  }

  update() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) {
      this.showPlaceholder();
      return;
    }

    this.renderProperties(cells[0]);
  }

  private showPlaceholder() {
    this.contentElement.innerHTML = '<p style="color: #999; font-size: 12px; padding: 12px;">Click element to edit</p>';
  }

  private renderProperties(cell: any) {
    const geo = cell.geometry;
    const style = this.graph.getCellStyle(cell);

    this.contentElement.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; font-size: 12px;">
        <div class="property-tabs" style="display: flex; border-bottom: 1px solid #e0e0e0; background: #f5f5f5;">
          <button class="prop-tab active" data-tab="text" style="flex: 1; padding: 8px; border: none; background: transparent; cursor: pointer; font-weight: 600; color: #666; border-bottom: 2px solid transparent;">Text</button>
          <button class="prop-tab" data-tab="style" style="flex: 1; padding: 8px; border: none; background: transparent; cursor: pointer; font-weight: 600; color: #999; border-bottom: 2px solid transparent;">Style</button>
          <button class="prop-tab" data-tab="arrangement" style="flex: 1; padding: 8px; border: none; background: transparent; cursor: pointer; font-weight: 600; color: #999; border-bottom: 2px solid transparent;">Arrangement</button>
        </div>

        <div class="property-content" style="flex: 1; overflow-y: auto; padding: 8px;">
          <!-- Text Tab -->
          <div class="prop-tab-content" data-tab="text" style="display: block;">
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Text Content</label>
              <input type="text" class="prop-input" id="prop-text" value="${cell.value || ''}" placeholder="Shape text" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Font Family</label>
              <select class="prop-input" id="prop-fontFamily" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;">
                <option value="Arial" ${style.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                <option value="Verdana" ${style.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                <option value="Times New Roman" ${style.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                <option value="Courier New" ${style.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                <option value="Georgia" ${style.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
              </select>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Font Size</label>
              <input type="number" class="prop-input" id="prop-fontSize" value="${style.fontSize || 12}" min="8" max="48" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Horizontal Align</label>
              <select class="prop-input" id="prop-align" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;">
                <option value="left" ${style.align === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${style.align === 'center' || !style.align ? 'selected' : ''}>Center</option>
                <option value="right" ${style.align === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Vertical Align</label>
              <select class="prop-input" id="prop-verticalAlign" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;">
                <option value="top" ${style.verticalAlign === 'top' ? 'selected' : ''}>Top</option>
                <option value="middle" ${style.verticalAlign === 'middle' || !style.verticalAlign ? 'selected' : ''}>Middle</option>
                <option value="bottom" ${style.verticalAlign === 'bottom' ? 'selected' : ''}>Bottom</option>
              </select>
            </div>
          </div>

          <!-- Style Tab -->
          <div class="prop-tab-content" data-tab="style" style="display: none;">
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Fill Color</label>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="color" class="prop-input" id="prop-fillColor" value="${style.fillColor || '#ffffff'}" style="width: 50px; height: 36px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px;" />
                <input type="text" class="prop-input" id="prop-fillColorText" value="${style.fillColor || '#ffffff'}" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
              </div>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Stroke Color</label>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="color" class="prop-input" id="prop-strokeColor" value="${style.strokeColor || '#000000'}" style="width: 50px; height: 36px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px;" />
                <input type="text" class="prop-input" id="prop-strokeColorText" value="${style.strokeColor || '#000000'}" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
              </div>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Stroke Width</label>
              <input type="number" class="prop-input" id="prop-strokeWidth" value="${style.strokeWidth || 1}" min="0.5" max="10" step="0.5" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" class="prop-input" id="prop-dashed" ${style.dashed ? 'checked' : ''} style="cursor: pointer;" />
                <span style="font-weight: 600; color: #333;">Dashed Border</span>
              </label>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Opacity</label>
              <input type="range" class="prop-input" id="prop-opacity" value="${style.opacity || 100}" min="0" max="100" style="width: 100%; cursor: pointer;" />
              <span id="prop-opacity-value" style="font-size: 11px; color: #666;">${style.opacity || 100}%</span>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" class="prop-input" id="prop-shadow" ${style.shadow ? 'checked' : ''} style="cursor: pointer;" />
                <span style="font-weight: 600; color: #333;">Shadow</span>
              </label>
            </div>
          </div>

          <!-- Arrangement Tab -->
          <div class="prop-tab-content" data-tab="arrangement" style="display: none;">
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Position X</label>
              <input type="number" class="prop-input" id="prop-x" value="${Math.round(geo?.x || 0)}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Position Y</label>
              <input type="number" class="prop-input" id="prop-y" value="${Math.round(geo?.y || 0)}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Width</label>
              <input type="number" class="prop-input" id="prop-w" value="${Math.round(geo?.width || 80)}" min="1" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Height</label>
              <input type="number" class="prop-input" id="prop-h" value="${Math.round(geo?.height || 60)}" min="1" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">Rotation (degrees)</label>
              <input type="number" class="prop-input" id="prop-rotation" value="${style.rotation || 0}" min="0" max="360" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupTabButtons();
    this.wireUpHandlers(cell);
  }

  private setupTabButtons() {
    const tabs = this.contentElement.querySelectorAll('.prop-tab') as NodeListOf<HTMLButtonElement>;
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab') as 'text' | 'style' | 'arrangement';
        this.switchTab(tabName);
      });
    });
  }

  private switchTab(tabName: 'text' | 'style' | 'arrangement') {

    const tabs = this.contentElement.querySelectorAll('.prop-tab') as NodeListOf<HTMLButtonElement>;
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute('data-tab') === tabName;
      tab.style.color = isActive ? '#333' : '#999';
      tab.style.borderBottomColor = isActive ? '#2196F3' : 'transparent';
      tab.style.borderBottomWidth = isActive ? '2px' : '1px';
    });

    const contents = this.contentElement.querySelectorAll('.prop-tab-content') as NodeListOf<HTMLElement>;
    contents.forEach((content) => {
      content.style.display = content.getAttribute('data-tab') === tabName ? 'block' : 'none';
    });
  }

  private wireUpHandlers(cell: any) {
    const geo = cell.geometry;

    // Text tab handlers
    document.getElementById('prop-text')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.graph.model.setValue(cell, value);
      this.graph.refresh();
    });

    document.getElementById('prop-fontFamily')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      style.fontFamily = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-fontSize')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      style.fontSize = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-align')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      (style as any).align = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-verticalAlign')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      (style as any).verticalAlign = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Style tab handlers
    const setupColorHandlers = (colorId: string, textId: string, styleKey: string) => {
      const colorInput = document.getElementById(colorId) as HTMLInputElement;
      const textInput = document.getElementById(textId) as HTMLInputElement;

      const updateColor = (value: string) => {
        const style = this.graph.getCellStyle(cell);
        (style as any)[styleKey] = value;
        this.graph.model.setStyle(cell, style);
        colorInput.value = value;
        textInput.value = value;
        this.graph.refresh();
      };

      colorInput?.addEventListener('change', (e) => {
        updateColor((e.target as HTMLInputElement).value);
      });

      textInput?.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (/^#[0-9A-F]{6}$/i.test(value)) {
          updateColor(value);
        } else {
          textInput.value = (this.graph.getCellStyle(cell) as any)[styleKey];
        }
      });
    };

    setupColorHandlers('prop-fillColor', 'prop-fillColorText', 'fillColor');
    setupColorHandlers('prop-strokeColor', 'prop-strokeColorText', 'strokeColor');

    document.getElementById('prop-strokeWidth')?.addEventListener('change', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      style.strokeWidth = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-dashed')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      style.dashed = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-opacity')?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const valueSpan = document.getElementById('prop-opacity-value');
      if (valueSpan) valueSpan.textContent = `${value}%`;
    });

    document.getElementById('prop-opacity')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      style.opacity = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-shadow')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      style.shadow = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Arrangement tab handlers
    document.getElementById('prop-x')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.x = value;
      this.graph.refresh();
    });

    document.getElementById('prop-y')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.y = value;
      this.graph.refresh();
    });

    document.getElementById('prop-w')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.width = value;
      this.graph.refresh();
    });

    document.getElementById('prop-h')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.height = value;
      this.graph.refresh();
    });

    document.getElementById('prop-rotation')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      style.rotation = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });
  }
}
