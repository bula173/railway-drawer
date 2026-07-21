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
            <!-- Z-Order Controls -->
            <div style="margin-bottom: 16px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <button class="prop-btn" id="btn-toFront" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">To Front</button>
                <button class="prop-btn" id="btn-toBack" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">To Back</button>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px;">
                <button class="prop-btn" id="btn-bringForward" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Bring Forward</button>
                <button class="prop-btn" id="btn-sendBackward" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Send Backward</button>
              </div>
            </div>

            <!-- Size / Position Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="size-position" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Size / Position
              </div>
              <div class="collapsible-content" data-section="size-position" style="padding: 8px;">
                <div style="margin-bottom: 8px;">
                  <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 11px; color: #666;">Size</label>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <div>
                      <input type="number" class="prop-input" id="prop-w" value="${Math.round(geo?.width || 80)}" min="1" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                      <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Width</div>
                    </div>
                    <div>
                      <input type="number" class="prop-input" id="prop-h" value="${Math.round(geo?.height || 60)}" min="1" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                      <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Height</div>
                    </div>
                  </div>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px;">
                    <input type="checkbox" id="prop-constrainProportions" style="cursor: pointer;" />
                    <span>Constrain Proportions</span>
                  </label>
                </div>
                <div>
                  <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 11px; color: #666;">Position</label>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <div>
                      <input type="number" class="prop-input" id="prop-x" value="${Math.round(geo?.x || 0)}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                      <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Left</div>
                    </div>
                    <div>
                      <input type="number" class="prop-input" id="prop-y" value="${Math.round(geo?.y || 0)}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                      <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Top</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Rotation Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="rotation" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Rotation
              </div>
              <div class="collapsible-content" data-section="rotation" style="padding: 8px;">
                <div style="margin-bottom: 8px;">
                  <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 11px; color: #666;">Angle</label>
                  <input type="number" class="prop-input" id="prop-rotation" value="${style.rotation || 0}" min="0" max="360" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                </div>
                <button class="prop-btn" id="btn-rotate90" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 11px; font-weight: 500;">Rotate Shape Only by 90°</button>
              </div>
            </div>

            <!-- Flip Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="flip" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Flip
              </div>
              <div class="collapsible-content" data-section="flip" style="padding: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  <button class="prop-btn" id="btn-flipHorizontal" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Horizontal</button>
                  <button class="prop-btn" id="btn-flipVertical" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Vertical</button>
                </div>
              </div>
            </div>

            <!-- Align & Misc Section -->
            <div style="margin-bottom: 0;">
              <button class="prop-btn" style="width: 100%; padding: 8px; margin-bottom: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Snap to Grid</button>
              <button class="prop-btn" style="width: 100%; padding: 8px; margin-bottom: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Group</button>
              <button class="prop-btn" id="btn-copySize" style="width: 100%; padding: 8px; margin-bottom: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Copy Size</button>
              <button class="prop-btn" id="btn-lock" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Lock</button>
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

  private setupCollapsibles() {
    const headers = this.contentElement.querySelectorAll('.collapsible-header');
    headers.forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.getAttribute('data-section');
        const content = this.contentElement.querySelector(
          `.collapsible-content[data-section="${section}"]`
        ) as HTMLElement;
        const arrow = header.querySelector('span') as HTMLElement;

        if (content) {
          const isOpen = content.style.display !== 'none';
          content.style.display = isOpen ? 'none' : 'block';
          arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-180deg)';
        }
      });
    });
  }

  private wireUpHandlers(cell: any) {
    const geo = cell.geometry;

    // Setup collapsibles
    this.setupCollapsibles();

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

    // Arrangement tab handlers - Z-Order
    document.getElementById('btn-toFront')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(cell);
      if (parent) {
        const index = model.getChildCount(parent) - 1;
        model.add(parent, cell, index);
      }
      console.log('[Properties] Moved to front');
    });

    document.getElementById('btn-toBack')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(cell);
      if (parent) {
        model.add(parent, cell, 0);
      }
      console.log('[Properties] Moved to back');
    });

    document.getElementById('btn-bringForward')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(cell);
      if (parent) {
        let index = -1;
        for (let i = 0; i < model.getChildCount(parent); i++) {
          if (model.getChildAt(parent, i) === cell) {
            index = i;
            break;
          }
        }
        if (index < model.getChildCount(parent) - 1) {
          model.add(parent, cell, index + 1);
        }
      }
      console.log('[Properties] Brought forward');
    });

    document.getElementById('btn-sendBackward')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(cell);
      if (parent) {
        let index = -1;
        for (let i = 0; i < model.getChildCount(parent); i++) {
          if (model.getChildAt(parent, i) === cell) {
            index = i;
            break;
          }
        }
        if (index > 0) {
          model.add(parent, cell, index - 1);
        }
      }
      console.log('[Properties] Sent backward');
    });

    // Flip buttons
    document.getElementById('btn-flipHorizontal')?.addEventListener('click', () => {
      if (geo) {
        geo.flipH = !geo.flipH;
        this.graph.refresh();
        console.log('[Properties] Flipped horizontally');
      }
    });

    document.getElementById('btn-flipVertical')?.addEventListener('click', () => {
      if (geo) {
        geo.flipV = !geo.flipV;
        this.graph.refresh();
        console.log('[Properties] Flipped vertically');
      }
    });

    // Rotate by 90°
    document.getElementById('btn-rotate90')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      const current = style.rotation || 0;
      style.rotation = (current + 90) % 360;
      this.graph.model.setStyle(cell, style);
      const rotInput = document.getElementById('prop-rotation') as HTMLInputElement;
      if (rotInput) rotInput.value = String(style.rotation);
      this.graph.refresh();
      console.log('[Properties] Rotated by 90°');
    });

    // Lock/Unlock
    let isLocked = false;
    const lockBtn = document.getElementById('btn-lock') as HTMLButtonElement;
    document.getElementById('btn-lock')?.addEventListener('click', () => {
      isLocked = !isLocked;
      cell.locked = isLocked;
      if (lockBtn) {
        lockBtn.textContent = isLocked ? 'Unlock' : 'Lock';
        lockBtn.style.background = isLocked ? '#ffd700' : '#f5f5f5';
      }
      console.log('[Properties]', isLocked ? 'Locked' : 'Unlocked');
    });

    // Copy Size - copy dimensions to clipboard for next shape
    let copiedSize: { width: number; height: number } | null = null;
    document.getElementById('btn-copySize')?.addEventListener('click', () => {
      if (geo) {
        copiedSize = { width: geo.width, height: geo.height };
        console.log('[Properties] Copied size:', copiedSize);
      }
    });

    // Constrain Proportions
    let aspectRatio = (geo?.width || 80) / (geo?.height || 60);
    const constrainCheckbox = document.getElementById('prop-constrainProportions') as HTMLInputElement;
    const widthInput = document.getElementById('prop-w') as HTMLInputElement;
    const heightInput = document.getElementById('prop-h') as HTMLInputElement;

    widthInput?.addEventListener('change', () => {
      if (constrainCheckbox?.checked) {
        const newWidth = parseInt(widthInput.value);
        const newHeight = Math.round(newWidth / aspectRatio);
        heightInput.value = String(newHeight);
        geo!.width = newWidth;
        geo!.height = newHeight;
        this.graph.refresh();
      }
    });

    heightInput?.addEventListener('change', () => {
      if (constrainCheckbox?.checked) {
        const newHeight = parseInt(heightInput.value);
        const newWidth = Math.round(newHeight * aspectRatio);
        widthInput.value = String(newWidth);
        geo!.width = newWidth;
        geo!.height = newHeight;
        this.graph.refresh();
      }
    });

    constrainCheckbox?.addEventListener('change', () => {
      if (constrainCheckbox.checked) {
        aspectRatio = (geo?.width || 80) / (geo?.height || 60);
        console.log('[Properties] Proportions locked at ratio:', aspectRatio.toFixed(2));
      } else {
        console.log('[Properties] Proportions unlocked');
      }
    });
  }
}
