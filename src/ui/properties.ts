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
    const style = this.graph.getCellStyle(cell) as any;

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
            <!-- Text Content -->
            <div style="margin-bottom: 12px;">
              <input type="text" class="prop-input" id="prop-text" value="${cell.value || ''}" placeholder="Text content" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
            </div>

            <!-- Font Section -->
            <div style="margin-bottom: 16px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333; font-size: 13px;">Font</label>
                <select class="prop-input" id="prop-fontFamily" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box; margin-bottom: 8px;">
                  <option value="Helvetica" ${style.fontFamily === 'Helvetica' || style.fontFamily === 'Arial' ? 'selected' : ''}>Helvetica</option>
                  <option value="Arial" ${style.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                  <option value="Verdana" ${style.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                  <option value="Times New Roman" ${style.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                  <option value="Courier New" ${style.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                  <option value="Georgia" ${style.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                </select>

                <!-- Text Style Buttons -->
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 8px;">
                  <button class="prop-btn text-bold" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.fontStyle?.includes('bold') ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-weight: bold; font-size: 14px;">B</button>
                  <button class="prop-btn text-italic" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.fontStyle?.includes('italic') ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-style: italic; font-size: 14px;">I</button>
                  <button class="prop-btn text-underline" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.fontStyle?.includes('underline') ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; text-decoration: underline; font-size: 14px;">U</button>
                  <div style="display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 14px;">
                    <input type="color" class="prop-input" id="prop-fontColorBtn" value="${style.fontColor || '#000000'}" style="width: 100%; height: 100%; border: none; cursor: pointer;" />
                  </div>
                  <input type="number" class="prop-input" id="prop-fontSize" value="${style.fontSize || 12}" min="8" max="72" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; box-sizing: border-box;" />
                </div>

                <!-- Alignment Buttons -->
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;">
                  <button class="prop-btn align-left" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.align === 'left' ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-size: 12px; text-align: center;">⬅</button>
                  <button class="prop-btn align-center" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.align === 'center' || !style.align ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-size: 12px; text-align: center;">⬅➡</button>
                  <button class="prop-btn align-right" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.align === 'right' ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-size: 12px; text-align: center;">➡</button>
                  <button class="prop-btn valign-top" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.verticalAlign === 'top' ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-size: 12px; text-align: center;">⬆</button>
                  <button class="prop-btn valign-middle" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.verticalAlign === 'middle' || !style.verticalAlign ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-size: 12px; text-align: center;">⬆⬇</button>
                  <button class="prop-btn valign-bottom" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: ${style.verticalAlign === 'bottom' ? '#e0e0e0' : '#f5f5f5'}; cursor: pointer; font-size: 12px; text-align: center;">⬇</button>
                </div>

                <!-- Position & Direction -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;">
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 11px; color: #666;">Position</label>
                    <select class="prop-input" id="prop-position" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;">
                      <option value="top" ${style.position === 'top' ? 'selected' : ''}>Top</option>
                      <option value="center" ${style.position === 'center' || !style.position ? 'selected' : ''}>Center</option>
                      <option value="bottom" ${style.position === 'bottom' ? 'selected' : ''}>Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 11px; color: #666;">Writing Direction</label>
                    <select class="prop-input" id="prop-writingDirection" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;">
                      <option value="automatic" ${style.writingDirection === 'automatic' || !style.writingDirection ? 'selected' : ''}>Automatic</option>
                      <option value="ltr" ${style.writingDirection === 'ltr' ? 'selected' : ''}>LTR</option>
                      <option value="rtl" ${style.writingDirection === 'rtl' ? 'selected' : ''}>RTL</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Colors Section -->
            <div style="margin-bottom: 16px;">
              <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="prop-useFontColor" ${style.fontColor ? 'checked' : ''} style="cursor: pointer;" />
                  <span style="font-weight: 600; color: #333;">Font Color</span>
                  <div style="margin-left: auto; display: flex; gap: 4px; align-items: center;">
                    <div style="width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: ${style.fontColor || '#000000'};"></div>
                    <button class="prop-btn" id="btn-fontColorPicker" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px;">✏️</button>
                  </div>
                </label>
              </div>

              <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="prop-useBackgroundColor" ${style.backgroundColor ? 'checked' : ''} style="cursor: pointer;" />
                  <span style="font-weight: 600; color: #333;">Background Color</span>
                </label>
              </div>

              <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="prop-useBorderColor" ${style.borderColor ? 'checked' : ''} style="cursor: pointer;" />
                  <span style="font-weight: 600; color: #333;">Border Color</span>
                </label>
              </div>

              <div>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="prop-useShadow" ${style.shadow ? 'checked' : ''} style="cursor: pointer;" />
                  <span style="font-weight: 600; color: #333;">Shadow</span>
                </label>
              </div>
            </div>

            <!-- Advanced Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="text-advanced" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Advanced
              </div>
              <div class="collapsible-content" data-section="text-advanced" style="padding: 8px; display: none;">
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
                    <input type="checkbox" id="prop-wordWrap" checked style="cursor: pointer;" />
                    <span style="font-weight: 600;">Word Wrap</span>
                  </label>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
                    <input type="checkbox" id="prop-formattedText" checked style="cursor: pointer;" />
                    <span style="font-weight: 600;">Formatted Text</span>
                  </label>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
                    <input type="checkbox" id="prop-convertToSvg" style="cursor: pointer;" />
                    <span style="font-weight: 600;">Convert Labels to SVG</span>
                  </label>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
                    <input type="checkbox" id="prop-autoFontSize" style="cursor: pointer;" />
                    <span style="font-weight: 600;">Automatic Font Size</span>
                  </label>
                </div>
                <div style="margin-bottom: 0;">
                  <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 11px; color: #666;">Label Width</label>
                  <input type="number" class="prop-input" id="prop-labelWidth" value="" min="0" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                </div>
              </div>
            </div>

            <!-- Spacing Section -->
            <div style="border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="text-spacing" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Spacing
              </div>
              <div class="collapsible-content" data-section="text-spacing" style="padding: 8px; display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                  <div>
                    <input type="number" class="prop-input" id="prop-spacingTop" value="${style.spacingTop || 0}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                    <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Top</div>
                  </div>
                  <div>
                    <input type="number" class="prop-input" id="prop-spacingGlobal" value="${style.spacingGlobal || 2}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                    <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Global</div>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                  <div>
                    <input type="number" class="prop-input" id="prop-spacingLeft" value="${style.spacingLeft || 0}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                    <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Left</div>
                  </div>
                  <div>
                    <input type="number" class="prop-input" id="prop-spacingBottom" value="${style.spacingBottom || 0}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                    <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Bottom</div>
                  </div>
                  <div>
                    <input type="number" class="prop-input" id="prop-spacingRight" value="${style.spacingRight || 0}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                    <div style="font-size: 10px; color: #999; text-align: center; margin-top: 2px;">Right</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Style Tab -->
          <div class="prop-tab-content" data-tab="style" style="display: none;">
            <!-- Color Palette -->
            <div style="margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <button style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 16px;">‹</button>
                <div style="display: flex; gap: 6px; flex: 1; overflow: hidden;">
                  <div style="width: 24px; height: 24px; border: 2px solid #2196F3; border-radius: 3px; background: #ffffff; cursor: pointer;"></div>
                  <div style="width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #f0f0f0; cursor: pointer;"></div>
                  <div style="width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #e3f2fd; cursor: pointer;"></div>
                  <div style="width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #e8f5e9; cursor: pointer;"></div>
                  <div style="width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #fff3e0; cursor: pointer;"></div>
                  <div style="width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #ffe0b2; cursor: pointer;"></div>
                </div>
                <button style="padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 16px;">›</button>
              </div>
              <div style="display: flex; gap: 4px; justify-content: center;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #2196F3;"></div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #ccc;"></div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #ccc;"></div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #ccc;"></div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #ccc;"></div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #ccc;"></div>
              </div>
            </div>

            <!-- Fill Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="style-fill" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Fill
              </div>
              <div class="collapsible-content" data-section="style-fill" style="padding: 8px;">
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; margin-bottom: 8px;">
                    <input type="checkbox" id="prop-useFill" ${style.fillColor ? 'checked' : ''} style="cursor: pointer;" />
                    <span style="font-weight: 600; color: #333;">Fill</span>
                    <select class="prop-input" id="prop-fillType" style="margin-left: auto; padding: 4px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                      <option value="solid">Automatic</option>
                      <option value="gradient">Gradient</option>
                    </select>
                    <button style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; width: 36px; text-align: center;">✏️</button>
                  </label>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="prop-useGradient" style="cursor: pointer;" />
                    <span style="font-weight: 600; color: #333;">Gradient</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Line Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="style-line" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Line
              </div>
              <div class="collapsible-content" data-section="style-line" style="padding: 8px;">
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; margin-bottom: 8px;">
                    <input type="checkbox" id="prop-useLine" ${style.strokeColor ? 'checked' : ''} style="cursor: pointer;" />
                    <span style="font-weight: 600; color: #333;">Line</span>
                    <div style="margin-left: auto; width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: ${style.strokeColor || '#000000'};"></div>
                    <button style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; width: 36px; text-align: center;">✏️</button>
                  </label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #666;">Style</label>
                    <select class="prop-input" id="prop-lineStyle" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                      <option value="solid">Solid</option>
                      <option value="dashed" ${style.dashed ? 'selected' : ''}>Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #666;">Width</label>
                    <input type="number" class="prop-input" id="prop-strokeWidth" value="${style.strokeWidth || 1}" min="0.5" max="10" step="0.5" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                  </div>
                </div>
                <div>
                  <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #666;">Perimeter</label>
                  <input type="number" class="prop-input" id="prop-perimeter" value="0" min="0" max="20" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                </div>
              </div>
            </div>

            <!-- Opacity -->
            <div style="margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: 600; color: #333;">Opacity</label>
                <input type="range" class="prop-input" id="prop-opacity" value="${style.opacity || 100}" min="0" max="100" style="flex: 1; cursor: pointer;" />
                <input type="number" id="prop-opacity-value" value="${style.opacity || 100}" min="0" max="100" style="width: 50px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
                <span style="font-size: 11px; color: #666;">%</span>
              </div>
            </div>

            <!-- Effects Section -->
            <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="style-effects" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Effects
              </div>
              <div class="collapsible-content" data-section="style-effects" style="padding: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="prop-rounded" ${style.rounded ? 'checked' : ''} style="cursor: pointer;" />
                    <span style="font-weight: 600; font-size: 12px;">Rounded</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="prop-sketch" style="cursor: pointer;" />
                    <span style="font-weight: 600; font-size: 12px;">Sketch</span>
                  </label>
                </div>
                <div style="margin-bottom: 12px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="prop-shadow" ${style.shadow ? 'checked' : ''} style="cursor: pointer;" />
                    <span style="font-weight: 600; font-size: 12px;">Shadow</span>
                  </label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  <button style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Edit</button>
                  <button style="padding: 8px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Copy Style</button>
                </div>
                <button style="width: 100%; padding: 8px; margin-top: 6px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; font-size: 12px; font-weight: 500;">Set as Default Style</button>
              </div>
            </div>

            <!-- Property Section -->
            <div style="border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden;">
              <div class="collapsible-header" data-section="style-property" style="padding: 8px; background: #f9f9f9; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span style="display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #333;"></span>
                Property
              </div>
              <div class="collapsible-content" data-section="style-property" style="padding: 8px; display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                  <div style="font-weight: 600; color: #666;">Property</div>
                  <div style="font-weight: 600; color: #666;">Value</div>
                  <div style="color: #333;">ID:</div>
                  <div style="color: #666;">...${String(cell.id || '').slice(-6)}</div>
                  <div style="color: #333;">Shape:</div>
                  <div style="color: #666;">${style.shape || 'default'}</div>
                </div>
              </div>
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

    // Font properties
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

    // Text style buttons (Bold, Italic, Underline)
    document.querySelector('.text-bold')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell) as any;
      const currentStyle = String(style.fontStyle || '');
      if (currentStyle.includes('bold')) {
        style.fontStyle = currentStyle.replace('bold', '').trim();
      } else {
        style.fontStyle = (currentStyle + ' bold').trim();
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.text-italic')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell) as any;
      const currentStyle = String(style.fontStyle || '');
      if (currentStyle.includes('italic')) {
        style.fontStyle = currentStyle.replace('italic', '').trim();
      } else {
        style.fontStyle = (currentStyle + ' italic').trim();
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.text-underline')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell) as any;
      const currentStyle = String(style.fontStyle || '');
      if (currentStyle.includes('underline')) {
        style.fontStyle = currentStyle.replace('underline', '').trim();
      } else {
        style.fontStyle = (currentStyle + ' underline').trim();
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Font color
    document.getElementById('prop-fontColorBtn')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      style.fontColor = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Alignment buttons
    document.querySelector('.align-left')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      (style as any).align = 'left';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.align-center')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      (style as any).align = 'center';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.align-right')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      (style as any).align = 'right';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.valign-top')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      (style as any).verticalAlign = 'top';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.valign-middle')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      (style as any).verticalAlign = 'middle';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.querySelector('.valign-bottom')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(cell);
      (style as any).verticalAlign = 'bottom';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Position and writing direction
    document.getElementById('prop-position')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell) as any;
      style.position = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-writingDirection')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell) as any;
      style.writingDirection = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Color toggles
    document.getElementById('prop-useBackgroundColor')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell) as any;
      if (checked) {
        style.backgroundColor = style.backgroundColor || '#ffffff';
      } else {
        style.backgroundColor = undefined;
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-useBorderColor')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell) as any;
      if (checked) {
        style.borderColor = style.borderColor || '#000000';
      } else {
        style.borderColor = undefined;
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-useShadow')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      style.shadow = checked;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Advanced section
    document.getElementById('prop-wordWrap')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      (style as any).wordWrap = checked ? 1 : 0;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-formattedText')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      (style as any).formattedText = checked;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-convertToSvg')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      (style as any).convertToSvg = checked;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-autoFontSize')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      (style as any).autoSize = checked ? 1 : 0;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-labelWidth')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      if (value) {
        (style as any).labelWidth = parseInt(value);
      } else {
        (style as any).labelWidth = undefined;
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Spacing inputs
    document.getElementById('prop-spacingTop')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      (style as any).spacingTop = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-spacingLeft')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      (style as any).spacingLeft = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-spacingBottom')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      (style as any).spacingBottom = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-spacingRight')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      (style as any).spacingRight = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-spacingGlobal')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      (style as any).spacingGlobal = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Style tab handlers
    // Fill controls
    document.getElementById('prop-useFill')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      if (checked) {
        style.fillColor = style.fillColor || '#ffffff';
      } else {
        style.fillColor = 'none';
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-fillType')?.addEventListener('change', () => {
      this.graph.refresh();
    });

    // Line controls
    document.getElementById('prop-useLine')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell);
      if (checked) {
        style.strokeColor = style.strokeColor || '#000000';
      } else {
        style.strokeColor = 'none';
      }
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-lineStyle')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      style.dashed = value === 'dashed';
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-perimeter')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell) as any;
      style.perimeter = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    // Opacity slider and input sync
    const opacitySlider = document.getElementById('prop-opacity') as HTMLInputElement;
    const opacityValue = document.getElementById('prop-opacity-value') as HTMLInputElement;

    opacitySlider?.addEventListener('input', () => {
      if (opacityValue) opacityValue.value = opacitySlider.value;
    });

    opacitySlider?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(cell);
      style.opacity = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    opacityValue?.addEventListener('change', () => {
      const value = parseInt(opacityValue.value);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        opacitySlider!.value = String(value);
        const style = this.graph.getCellStyle(cell);
        style.opacity = value;
        this.graph.model.setStyle(cell, style);
        this.graph.refresh();
      }
    });

    // Effects
    document.getElementById('prop-rounded')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell) as any;
      style.rounded = checked ? 1 : 0;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-sketch')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(cell) as any;
      style.sketch = checked;
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
