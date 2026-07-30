/**
 * @file properties.ts
 * @brief Properties panel for editing selected cell properties
 * @details
 * Provides a comprehensive UI for editing properties of selected cells including:
 * - Text and font properties (family, size, color, alignment)
 * - Position and size (x, y, width, height)
 * - Styling (fill color, stroke, opacity, shadow, rounded corners)
 * - Transformations (rotation, flip horizontal/vertical)
 * - Z-order (bring forward, send backward, to front, to back)
 * - Cell locking state
 *
 * The panel automatically updates when selection changes and applies changes
 * directly to the graph model with immediate visual feedback.
 */

import { Graph } from '@maxgraph/core';

/**
 * @class PropertiesPanel
 * @brief Inspector panel for editing cell properties
 * @details
 * Manages a multi-tab properties panel that displays and allows editing of:
 * - Text properties (content, font, color)
 * - Geometry (position, size, rotation)
 * - Style (fill, stroke, opacity, effects)
 * - Transforms (flip, rotation)
 * - Z-order
 *
 * The panel listens to selection changes and updates its UI to reflect
 * the properties of the currently selected cell. All changes are applied
 * to the graph model immediately.
 *
 * @note Placeholder is shown when nothing is selected; editor shows when a cell is selected
 */
export class PropertiesPanel {
  /** @brief Reference to the maxGraph instance */
  private graph: Graph;
  /** @brief Currently selected cell being edited */
  private currentCell: any = null;

  /**
   * @brief Initialize properties panel
   * @param {Graph} graph - The maxGraph instance to edit
   * @details
   * Sets up the panel UI, tab buttons, collapsible sections, and event listeners.
   * Automatically updates when the selection in the graph changes.
   */
  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTabButtons();
    this.setupCollapsibles();
    this.setupEventListeners();

    this.graph.getSelectionModel().addListener('change', () => {
      this.update();
    });
  }

  /**
   * @brief Update panel to reflect currently selected cell
   * @details
   * Refreshes all input fields to show the properties of the currently selected cell.
   * If multiple cells are selected, uses the first one. If nothing is selected,
   * shows the placeholder message.
   */
  update() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) {
      this.showPlaceholder();
      return;
    }

    this.currentCell = cells[0];
    this.showEditor();
    this.updateValues();
    this.wireUpHandlers();
  }

  private showPlaceholder() {
    const placeholder = document.getElementById('prop-placeholder');
    const editor = document.getElementById('prop-editor');
    if (placeholder) placeholder.style.display = 'block';
    if (editor) editor.style.display = 'none';
  }

  private showEditor() {
    const placeholder = document.getElementById('prop-placeholder');
    const editor = document.getElementById('prop-editor');
    const canvasProps = document.getElementById('canvas-props');
    if (placeholder) placeholder.style.display = 'none';
    if (editor) editor.style.display = 'flex';
    if (canvasProps) canvasProps.style.display = 'none';
  }

  private updateValues() {
    const geo = this.currentCell.geometry;
    const style = this.graph.getCellStyle(this.currentCell) as any;

    const fontFamily = document.getElementById('prop-fontFamily') as HTMLInputElement;
    if (fontFamily) fontFamily.value = style.fontFamily || 'Arial';

    const fontSize = document.getElementById('prop-fontSize') as HTMLInputElement;
    if (fontSize) fontSize.value = String(style.fontSize || 12);

    const fontWeight = document.getElementById('prop-fontWeight') as HTMLSelectElement;
    if (fontWeight) fontWeight.value = style.fontWeight || 'normal';

    const fontStyle = document.getElementById('prop-fontStyle') as HTMLSelectElement;
    if (fontStyle) fontStyle.value = style.fontStyle || 'normal';

    const textDecoration = document.getElementById('prop-textDecoration') as HTMLSelectElement;
    if (textDecoration) textDecoration.value = style.textDecoration || 'none';

    const textOverflow = document.getElementById('prop-textOverflow') as HTMLSelectElement;
    if (textOverflow) textOverflow.value = style.textOverflow || 'visible';

    // Text Alignment Selects (Priority 3)
    const textAlign = document.getElementById('prop-textAlign') as HTMLSelectElement;
    if (textAlign) textAlign.value = style.align || 'left';

    const verticalAlign = document.getElementById('prop-verticalAlign') as HTMLSelectElement;
    if (verticalAlign) verticalAlign.value = style.verticalAlign || 'middle';

    const fontColor = document.getElementById('prop-fontColorBtn') as HTMLInputElement;
    if (fontColor) fontColor.value = style.fontColor || '#000000';

    // Position/Size
    const xInput = document.getElementById('prop-x') as HTMLInputElement;
    const yInput = document.getElementById('prop-y') as HTMLInputElement;
    const wInput = document.getElementById('prop-w') as HTMLInputElement;
    const hInput = document.getElementById('prop-h') as HTMLInputElement;
    if (xInput) xInput.value = String(Math.round(geo?.x || 0));
    if (yInput) yInput.value = String(Math.round(geo?.y || 0));
    if (wInput) wInput.value = String(Math.round(geo?.width || 80));
    if (hInput) hInput.value = String(Math.round(geo?.height || 60));

    // Min/Max dimensions
    const minWidth = document.getElementById('prop-minWidth') as HTMLInputElement;
    const maxWidth = document.getElementById('prop-maxWidth') as HTMLInputElement;
    const minHeight = document.getElementById('prop-minHeight') as HTMLInputElement;
    const maxHeight = document.getElementById('prop-maxHeight') as HTMLInputElement;
    if (minWidth) minWidth.value = String(style.minWidth || 0);
    if (maxWidth) maxWidth.value = String(style.maxWidth || 9999);
    if (minHeight) minHeight.value = String(style.minHeight || 0);
    if (maxHeight) maxHeight.value = String(style.maxHeight || 9999);

    // Rotation
    const rotation = document.getElementById('prop-rotation') as HTMLInputElement;
    if (rotation) rotation.value = String(style.rotation || 0);

    // Style
    const fillCheckbox = document.getElementById('prop-useFill') as HTMLInputElement;
    if (fillCheckbox) fillCheckbox.checked = style.fillColor && style.fillColor !== 'none';

    const fillColor = document.getElementById('prop-fillColor') as HTMLInputElement;
    const fillColorText = document.getElementById('prop-fillColorText') as HTMLInputElement;
    const displayColor = style.fillColor && style.fillColor !== 'none' ? style.fillColor : '#ffffff';
    if (fillColor) fillColor.value = displayColor;
    if (fillColorText) fillColorText.value = displayColor;

    // Gradient properties
    const gradientColor1 = document.getElementById('prop-gradientColor1') as HTMLInputElement;
    const gradientColor2 = document.getElementById('prop-gradientColor2') as HTMLInputElement;
    const gradientOpacity = document.getElementById('prop-gradientOpacity') as HTMLInputElement;
    const gradientOpacityValue = document.getElementById('prop-gradientOpacity-value');
    if (gradientColor1) gradientColor1.value = style.gradientColor || '#1976d2';
    if (gradientColor2) gradientColor2.value = style.gradientColor2 || '#64b5f6';
    if (gradientOpacity) gradientOpacity.value = String(style.gradientOpacity || 100);
    if (gradientOpacityValue) gradientOpacityValue.textContent = `${style.gradientOpacity || 100}%`;

    // Show/hide gradient controls based on fill type
    const gradientControls = document.getElementById('gradient-controls');
    const isFillType = style.fillType === 'linear' || style.fillType === 'radial';
    if (gradientControls) gradientControls.style.display = isFillType ? 'block' : 'none';

    // Background Pattern (Priority 3)
    const fillPattern = document.getElementById('prop-fillPattern') as HTMLSelectElement;
    if (fillPattern) fillPattern.value = style.fillPattern || 'none';

    const lineCheckbox = document.getElementById('prop-useLine') as HTMLInputElement;
    if (lineCheckbox) lineCheckbox.checked = style.strokeColor && style.strokeColor !== 'none';

    const strokeWidth = document.getElementById('prop-strokeWidth') as HTMLInputElement;
    if (strokeWidth) strokeWidth.value = String(style.strokeWidth || 1);

    const strokeOpacity = document.getElementById('prop-strokeOpacity') as HTMLInputElement;
    const strokeOpacityValue = document.getElementById('prop-strokeOpacity-value');
    if (strokeOpacity) strokeOpacity.value = String(style.strokeOpacity || 100);
    if (strokeOpacityValue) strokeOpacityValue.textContent = `${style.strokeOpacity || 100}%`;

    // Dash Pattern (Priority 3)
    const dashPattern = document.getElementById('prop-dashPattern') as HTMLSelectElement;
    if (dashPattern) dashPattern.value = style.dashPattern || 'none';

    const opacity = document.getElementById('prop-opacity') as HTMLInputElement;
    const opacityValue = document.getElementById('prop-opacity-value');
    if (opacity) opacity.value = String(style.opacity || 100);
    if (opacityValue) opacityValue.textContent = `${style.opacity || 100}%`;

    const shadowCheckbox = document.getElementById('prop-shadow') as HTMLInputElement;
    if (shadowCheckbox) shadowCheckbox.checked = style.shadow || false;

    // Shadow properties
    const shadowColor = document.getElementById('prop-shadowColor') as HTMLInputElement;
    const shadowBlur = document.getElementById('prop-shadowBlur') as HTMLInputElement;
    const shadowOffsetX = document.getElementById('prop-shadowOffsetX') as HTMLInputElement;
    const shadowOffsetY = document.getElementById('prop-shadowOffsetY') as HTMLInputElement;
    if (shadowColor) shadowColor.value = style.shadowColor || '#000000';
    if (shadowBlur) shadowBlur.value = String(style.shadowBlur || 3);
    if (shadowOffsetX) shadowOffsetX.value = String(style.shadowOffsetX || 2);
    if (shadowOffsetY) shadowOffsetY.value = String(style.shadowOffsetY || 2);

    // Show/hide shadow details
    const shadowDetails = document.getElementById('shadow-details');
    if (shadowDetails) shadowDetails.style.display = style.shadow ? 'block' : 'none';

    const roundedCheckbox = document.getElementById('prop-rounded') as HTMLInputElement;
    if (roundedCheckbox) roundedCheckbox.checked = style.rounded ? true : false;

    const cornerRadius = document.getElementById('prop-cornerRadius') as HTMLInputElement;
    if (cornerRadius) cornerRadius.value = String(style.arcSize || 0);

    const lockShape = document.getElementById('prop-lockShape') as HTMLInputElement;
    if (lockShape) lockShape.checked = !this.currentCell.connectable || false;

    const blendMode = document.getElementById('prop-blendMode') as HTMLSelectElement;
    if (blendMode) blendMode.value = style.blendMode || 'normal';

    // Flip states
    const flipH = geo?.flipH || false;
    const flipV = geo?.flipV || false;
    const flipHBtn = document.getElementById('btn-flipHorizontal');
    const flipVBtn = document.getElementById('btn-flipVertical');
    if (flipHBtn) flipHBtn.style.background = flipH ? '#e0e0e0' : '#f5f5f5';
    if (flipVBtn) flipVBtn.style.background = flipV ? '#e0e0e0' : '#f5f5f5';
  }

  private setupTabButtons() {
    const tabs = document.querySelectorAll('.prop-tab') as NodeListOf<HTMLButtonElement>;
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        this.switchTab(tabName!);
      });
    });
  }

  private switchTab(tabName: string) {
    const tabs = document.querySelectorAll('.prop-tab') as NodeListOf<HTMLButtonElement>;
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute('data-tab') === tabName;
      tab.style.color = isActive ? '#333' : '#999';
      tab.style.borderBottomColor = isActive ? '#2196F3' : 'transparent';
    });

    const contents = document.querySelectorAll('.prop-tab-content') as NodeListOf<HTMLElement>;
    contents.forEach((content) => {
      content.style.display = content.getAttribute('data-tab') === tabName ? 'block' : 'none';
    });
  }

  private setupCollapsibles() {
    const headers = document.querySelectorAll('.collapsible-header');
    headers.forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.getAttribute('data-section');
        const content = document.querySelector(
          `.collapsible-content[data-section="${section}"]`
        ) as HTMLElement;
        const arrow = header.querySelector('span') as HTMLElement;

        if (content) {
          const isOpen = content.style.display !== 'none';
          content.style.display = isOpen ? 'none' : 'block';
          if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-180deg)';
        }
      });
    });
  }

  private setupEventListeners() {
    // This will be called after updateValues, so event listeners are wired up with current cell
  }

  private wireUpHandlers() {
    const geo = this.currentCell.geometry;

    document.getElementById('prop-fontFamily')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell);
      style.fontFamily = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-fontSize')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell);
      style.fontSize = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-fontWeight')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.fontWeight = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-fontStyle')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.fontStyle = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-textDecoration')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.textDecoration = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-textOverflow')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.textOverflow = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-fontColorBtn')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell);
      style.fontColor = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Alignment
    document.querySelector('.align-left')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.align = 'left';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.querySelector('.align-center')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.align = 'center';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.querySelector('.align-right')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.align = 'right';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.querySelector('.valign-top')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.verticalAlign = 'top';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.querySelector('.valign-middle')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.verticalAlign = 'middle';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.querySelector('.valign-bottom')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.verticalAlign = 'bottom';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Text Horizontal Alignment Select (Priority 3)
    document.getElementById('prop-textAlign')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.align = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Text Vertical Alignment Select (Priority 3)
    document.getElementById('prop-verticalAlign')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.verticalAlign = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Fill Color
    document.getElementById('prop-fillColor')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell);
      style.fillColor = value;
      this.graph.model.setStyle(this.currentCell, style);
      // Update text input
      const textInput = document.getElementById('prop-fillColorText') as HTMLInputElement;
      if (textInput) textInput.value = value;
      this.graph.refresh();
    });

    document.getElementById('prop-fillColorText')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell);
      style.fillColor = value;
      this.graph.model.setStyle(this.currentCell, style);
      // Update color picker
      const colorInput = document.getElementById('prop-fillColor') as HTMLInputElement;
      if (colorInput) colorInput.value = value;
      this.graph.refresh();
    });

    document.getElementById('prop-useFill')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(this.currentCell);
      style.fillColor = checked ? (style.fillColor || '#ffffff') : 'none';
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Fill type (solid, linear, radial)
    document.getElementById('prop-fillType')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.fillType = value;
      this.graph.model.setStyle(this.currentCell, style);

      // Show/hide gradient controls
      const gradientControls = document.getElementById('gradient-controls');
      if (gradientControls) {
        gradientControls.style.display = value === 'solid' ? 'none' : 'block';
      }
      this.graph.refresh();
    });

    // Gradient color 1
    document.getElementById('prop-gradientColor1')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.gradientColor = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Gradient color 2
    document.getElementById('prop-gradientColor2')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.gradientColor2 = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Gradient opacity
    document.getElementById('prop-gradientOpacity')?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const gradientOpacityValue = document.getElementById('prop-gradientOpacity-value');
      if (gradientOpacityValue) gradientOpacityValue.textContent = `${value}%`;
    });

    document.getElementById('prop-gradientOpacity')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.gradientOpacity = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Background Pattern (Priority 3)
    document.getElementById('prop-fillPattern')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.fillPattern = value === 'none' ? undefined : value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Stroke
    document.getElementById('prop-strokeWidth')?.addEventListener('change', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell);
      style.strokeWidth = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Dash Pattern (Priority 3)
    document.getElementById('prop-dashPattern')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.dashPattern = value === 'none' ? undefined : value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Opacity
    document.getElementById('prop-opacity')?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const opacityValue = document.getElementById('prop-opacity-value');
      if (opacityValue) opacityValue.textContent = `${value}%`;
    });

    document.getElementById('prop-opacity')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell);
      style.opacity = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-strokeOpacity')?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const strokeOpacityValue = document.getElementById('prop-strokeOpacity-value');
      if (strokeOpacityValue) strokeOpacityValue.textContent = `${value}%`;
    });

    document.getElementById('prop-strokeOpacity')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.strokeOpacity = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-cornerRadius')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.arcSize = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-lockShape')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).checked;
      this.currentCell.setConnectable(!value);
      this.graph.refresh();
    });

    document.getElementById('prop-blendMode')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.blendMode = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Shadow
    document.getElementById('prop-shadow')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(this.currentCell);
      style.shadow = value;
      this.graph.model.setStyle(this.currentCell, style);

      // Show/hide shadow details
      const shadowDetails = document.getElementById('shadow-details');
      if (shadowDetails) shadowDetails.style.display = value ? 'block' : 'none';

      this.graph.refresh();
    });

    // Shadow color
    document.getElementById('prop-shadowColor')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.shadowColor = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Shadow blur
    document.getElementById('prop-shadowBlur')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.shadowBlur = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Shadow offset X
    document.getElementById('prop-shadowOffsetX')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.shadowOffsetX = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Shadow offset Y
    document.getElementById('prop-shadowOffsetY')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.shadowOffsetY = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Rounded
    document.getElementById('prop-rounded')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.rounded = value ? 1 : 0;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Position/Size
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
      const constrainProportions = (document.getElementById('prop-constrainProportions') as HTMLInputElement)?.checked;

      if (constrainProportions && geo!.height > 0) {
        const aspectRatio = geo!.height / geo!.width;
        geo!.height = value * aspectRatio;
      }

      geo!.width = value;
      this.graph.refresh();
    });

    document.getElementById('prop-h')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const constrainProportions = (document.getElementById('prop-constrainProportions') as HTMLInputElement)?.checked;

      if (constrainProportions && geo!.width > 0) {
        const aspectRatio = geo!.width / geo!.height;
        geo!.width = value * aspectRatio;
      }

      geo!.height = value;
      this.graph.refresh();
    });

    // Min/Max dimensions
    document.getElementById('prop-minWidth')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.minWidth = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-maxWidth')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.maxWidth = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-minHeight')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.minHeight = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    document.getElementById('prop-maxHeight')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell) as any;
      style.maxHeight = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Rotation
    document.getElementById('prop-rotation')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell);
      style.rotation = value;
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Constrain Proportions
    document.getElementById('prop-constrainProportions')?.addEventListener('change', () => {
      // No action needed - the state is read when width/height change
    });

    // Rotate 90
    document.getElementById('btn-rotate90')?.addEventListener('click', () => {
      const style = this.graph.getCellStyle(this.currentCell);
      const current = style.rotation || 0;
      style.rotation = (current + 90) % 360;
      const rotInput = document.getElementById('prop-rotation') as HTMLInputElement;
      if (rotInput) rotInput.value = String(style.rotation);
      this.graph.model.setStyle(this.currentCell, style);
      this.graph.refresh();
    });

    // Flip Horizontal
    document.getElementById('btn-flipHorizontal')?.addEventListener('click', () => {
      const geo = this.currentCell.geometry;
      if (geo) {
        geo.flipH = !geo.flipH;
        this.graph.refresh();
        this.updateValues();
      }
    });

    // Flip Vertical
    document.getElementById('btn-flipVertical')?.addEventListener('click', () => {
      const geo = this.currentCell.geometry;
      if (geo) {
        geo.flipV = !geo.flipV;
        this.graph.refresh();
        this.updateValues();
      }
    });

    // Z-Order
    document.getElementById('btn-toFront')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(this.currentCell);
      if (parent) {
        const index = model.getChildCount(parent) - 1;
        model.add(parent, this.currentCell, index);
      }
    });

    document.getElementById('btn-toBack')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(this.currentCell);
      if (parent) {
        model.add(parent, this.currentCell, 0);
      }
    });

    document.getElementById('btn-bringForward')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(this.currentCell);
      if (parent) {
        let index = -1;
        for (let i = 0; i < model.getChildCount(parent); i++) {
          if (model.getChildAt(parent, i) === this.currentCell) {
            index = i;
            break;
          }
        }
        if (index < model.getChildCount(parent) - 1) {
          model.add(parent, this.currentCell, index + 1);
        }
      }
    });

    document.getElementById('btn-sendBackward')?.addEventListener('click', () => {
      const model = this.graph.model as any;
      const parent = model.getParent(this.currentCell);
      if (parent) {
        let index = -1;
        for (let i = 0; i < model.getChildCount(parent); i++) {
          if (model.getChildAt(parent, i) === this.currentCell) {
            index = i;
            break;
          }
        }
        if (index > 0) {
          model.add(parent, this.currentCell, index - 1);
        }
      }
    });

    // Flip
    document.getElementById('btn-flipHorizontal')?.addEventListener('click', () => {
      if (geo) {
        geo.flipH = !geo.flipH;
        const flipHBtn = document.getElementById('btn-flipHorizontal');
        if (flipHBtn) flipHBtn.style.background = geo.flipH ? '#e0e0e0' : '#f5f5f5';
        this.graph.refresh();
      }
    });

    document.getElementById('btn-flipVertical')?.addEventListener('click', () => {
      if (geo) {
        geo.flipV = !geo.flipV;
        const flipVBtn = document.getElementById('btn-flipVertical');
        if (flipVBtn) flipVBtn.style.background = geo.flipV ? '#e0e0e0' : '#f5f5f5';
        this.graph.refresh();
      }
    });

    // Lock
    let isLocked = false;
    const lockBtn = document.getElementById('btn-lock') as HTMLButtonElement;
    document.getElementById('btn-lock')?.addEventListener('click', () => {
      isLocked = !isLocked;
      this.currentCell.locked = isLocked;
      if (lockBtn) {
        lockBtn.textContent = isLocked ? 'Unlock' : 'Lock';
        lockBtn.style.background = isLocked ? '#ffd700' : '#f5f5f5';
      }
    });
  }
}
