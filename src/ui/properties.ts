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

import { Graph, constants } from '@maxgraph/core';
import type { Geometry } from '@maxgraph/core';
import type { AlignValue, Cell, CellStateStyle, VAlignValue } from '@maxgraph/core';

/** @brief Cell with the ad-hoc `locked` flag shared with context-menu/interactive-ui */
type LockableCell = Cell & { locked?: boolean };

/** @brief Cell style with access to keys not declared on CellStateStyle (fontWeight, blendMode, ...) */
type EditableStyle = CellStateStyle & Record<string, unknown>;

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
  /** @brief Cell whose values are currently displayed in the panel */
  private currentCell: Cell | null = null;
  /**
   * @brief Aborts every DOM listener registered by this panel (see destroy())
   * @details All DOM listeners are registered exactly once, in the constructor.
   * Handlers resolve the target cell at event time via getTargetCell(), so
   * selection changes only refresh displayed values and never add listeners.
   */
  private readonly listenerAbort = new AbortController();
  /** @brief Selection model listener, kept for removal in destroy() */
  private readonly selectionListener = () => this.update();

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

    this.graph.getSelectionModel().addListener('change', this.selectionListener);
  }

  /**
   * @brief Remove all DOM and graph listeners registered by this panel
   * @details Called by TabManager.destroyTab() when the owning tab is closed.
   */
  destroy() {
    this.listenerAbort.abort();
    this.graph.getSelectionModel().removeListener(this.selectionListener);
    this.currentCell = null;
  }

  /**
   * @brief Whether this panel's graph is the one currently shown
   * @details The panel DOM is shared by every tab (one PropertiesPanel per tab),
   * so only the panel of the visible graph may react to edits.
   */
  private isActive(): boolean {
    const container = this.graph.container;
    return !!container && container.isConnected && container.style.display !== 'none';
  }

  /**
   * @brief Resolve the cell an edit applies to, at event time
   * @returns First selected cell of the active graph, or null
   */
  private getTargetCell(): Cell | null {
    return this.getTargetCells()[0] ?? null;
  }

  /**
   * @brief Resolve every cell a multi-selection edit applies to, at event time
   * @returns Selected cells of the active graph (empty when the panel is hidden)
   */
  private getTargetCells(): Cell[] {
    if (!this.isActive()) return [];
    return this.graph.getSelectionCells();
  }

  /**
   * @brief Update panel to reflect currently selected cell
   * @details
   * Refreshes all input fields to show the properties of the currently selected cell.
   * If multiple cells are selected, uses the first one. If nothing is selected,
   * shows the placeholder message.
   */
  update() {
    // Hidden tabs share the panel DOM; they must not overwrite the visible tab's values
    if (!this.isActive()) return;

    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) {
      this.currentCell = null;
      this.showPlaceholder();
      return;
    }

    this.currentCell = cells[0];
    this.showEditor();
    this.updateValues();
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
    const cell = this.currentCell as LockableCell | null;
    if (!cell) return;
    const geo = cell.geometry;
    const style = this.graph.getCellStyle(cell) as any;

    const fontFamily = document.getElementById('prop-fontFamily') as HTMLInputElement;
    if (fontFamily) fontFamily.value = style.fontFamily || 'Arial';

    const fontSize = document.getElementById('prop-fontSize') as HTMLInputElement;
    if (fontSize) fontSize.value = String(style.fontSize || 12);

    const fontWeight = document.getElementById('prop-fontWeight') as HTMLSelectElement;
    if (fontWeight) fontWeight.value = style.fontWeight || 'normal';

    const fontStyle = document.getElementById('prop-fontStyle') as HTMLSelectElement;
    if (fontStyle) fontStyle.value = (style.fontStyle || 0) & constants.FONT.ITALIC ? 'italic' : 'normal';

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
    if (lockShape) lockShape.checked = !cell.connectable || false;

    const blendMode = document.getElementById('prop-blendMode') as HTMLSelectElement;
    if (blendMode) blendMode.value = style.blendMode || 'normal';

    // Flip states
    const flipH = style.flipH || false;
    const flipV = style.flipV || false;
    const flipHBtn = document.getElementById('btn-flipHorizontal');
    const flipVBtn = document.getElementById('btn-flipVertical');
    if (flipHBtn) flipHBtn.style.background = flipH ? '#e0e0e0' : '#f5f5f5';
    if (flipVBtn) flipVBtn.style.background = flipV ? '#e0e0e0' : '#f5f5f5';

    // Lock state of the displayed cell
    this.updateLockButton(!!cell.locked);
  }

  private updateLockButton(isLocked: boolean) {
    const lockBtn = document.getElementById('btn-lock');
    if (lockBtn) {
      lockBtn.textContent = isLocked ? 'Unlock' : 'Lock';
      lockBtn.style.background = isLocked ? '#ffd700' : '#f5f5f5';
    }
  }

  private setupTabButtons() {
    const tabs = document.querySelectorAll('.prop-tab') as NodeListOf<HTMLButtonElement>;
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        this.switchTab(tabName!);
      }, { signal: this.listenerAbort.signal });
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
        // Every tab's panel registers this toggle; only one may flip it
        if (!this.isActive()) return;
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
      }, { signal: this.listenerAbort.signal });
    });
  }

  /**
   * @brief Register a DOM listener once, removable via destroy()
   */
  private on(target: Element | null, type: string, handler: (e: Event) => void) {
    target?.addEventListener(type, handler, { signal: this.listenerAbort.signal });
  }

  /**
   * @brief Apply a style mutation to the cell selected at event time
   */
  private applyStyle(mutate: (style: EditableStyle) => void) {
    const cells = this.getTargetCells();
    if (cells.length === 0) return;
    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        const style = this.graph.getCellStyle(cell) as EditableStyle;
        mutate(style);
        this.graph.model.setStyle(cell, style);
      });
    });
    this.graph.refresh();
  }

  /**
   * @brief Change the geometry of the cell selected at event time through the model
   * @details model.setGeometry records an undoable change; editing the geometry in place did not.
   */
  private applyGeometry(mutate: (geo: Geometry) => void) {
    const cell = this.getTargetCell();
    const current = cell?.getGeometry();
    if (!cell || !current) return;
    const geo = current.clone();
    mutate(geo);
    this.graph.model.setGeometry(cell, geo);
  }

  /** @brief Bind a 'change' listener on an input/select that sets one style key */
  private bindStyle(id: string, apply: (style: EditableStyle, input: HTMLInputElement) => void) {
    this.on(document.getElementById(id), 'change', (e) => {
      const input = e.target as HTMLInputElement;
      this.applyStyle((style) => apply(style, input));
    });
  }

  /** @brief Bind a button click that sets one style key to a fixed value */
  private bindStyleClick(selector: string, key: string, value: string) {
    this.on(document.querySelector(selector), 'click', () => {
      this.applyStyle((style) => {
        style[key] = value;
      });
    });
  }

  /** @brief Live-update a percentage label while a range input is dragged */
  private bindPercentLabel(inputId: string, labelId: string) {
    this.on(document.getElementById(inputId), 'input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      const label = document.getElementById(labelId);
      if (label) label.textContent = `${value}%`;
    });
  }

  /**
   * @brief Wire every panel control exactly once
   * @details Handlers never capture a cell; they resolve it via getTargetCell()
   * when the event fires, so each edit is applied once to the current selection.
   */
  private setupEventListeners() {
    // Text
    this.bindStyle('prop-fontFamily', (style, input) => { style.fontFamily = input.value; });
    this.bindStyle('prop-fontSize', (style, input) => { style.fontSize = parseInt(input.value); });
    this.bindStyle('prop-fontWeight', (style, input) => { style.fontWeight = input.value; });
    this.bindStyle('prop-fontStyle', (style, input) => {
      // maxGraph fontStyle is a bitmask; the select only controls the italic bit
      const flags = style.fontStyle || 0;
      style.fontStyle = input.value === 'normal'
        ? flags & ~constants.FONT.ITALIC
        : flags | constants.FONT.ITALIC;
    });
    this.bindStyle('prop-textDecoration', (style, input) => { style.textDecoration = input.value; });
    this.bindStyle('prop-textOverflow', (style, input) => { style.textOverflow = input.value; });
    this.bindStyle('prop-fontColorBtn', (style, input) => { style.fontColor = input.value; });

    // Alignment
    this.bindStyleClick('.align-left', 'align', 'left');
    this.bindStyleClick('.align-center', 'align', 'center');
    this.bindStyleClick('.align-right', 'align', 'right');
    this.bindStyleClick('.valign-top', 'verticalAlign', 'top');
    this.bindStyleClick('.valign-middle', 'verticalAlign', 'middle');
    this.bindStyleClick('.valign-bottom', 'verticalAlign', 'bottom');

    // Text Horizontal / Vertical Alignment Selects (Priority 3)
    this.bindStyle('prop-textAlign', (style, input) => { style.align = input.value as AlignValue; });
    this.bindStyle('prop-verticalAlign', (style, input) => { style.verticalAlign = input.value as VAlignValue; });

    // Fill Color
    this.bindStyle('prop-fillColor', (style, input) => {
      style.fillColor = input.value;
      // Update text input
      const textInput = document.getElementById('prop-fillColorText') as HTMLInputElement;
      if (textInput) textInput.value = input.value;
    });

    this.bindStyle('prop-fillColorText', (style, input) => {
      style.fillColor = input.value;
      // Update color picker
      const colorInput = document.getElementById('prop-fillColor') as HTMLInputElement;
      if (colorInput) colorInput.value = input.value;
    });

    this.bindStyle('prop-useFill', (style, input) => {
      style.fillColor = input.checked ? (style.fillColor || '#ffffff') : 'none';
    });

    // Fill type (solid, linear, radial)
    this.bindStyle('prop-fillType', (style, input) => {
      style.fillType = input.value;
      // Show/hide gradient controls
      const gradientControls = document.getElementById('gradient-controls');
      if (gradientControls) {
        gradientControls.style.display = input.value === 'solid' ? 'none' : 'block';
      }
    });

    // Gradient
    this.bindStyle('prop-gradientColor1', (style, input) => { style.gradientColor = input.value; });
    this.bindStyle('prop-gradientColor2', (style, input) => { style.gradientColor2 = input.value; });
    this.bindPercentLabel('prop-gradientOpacity', 'prop-gradientOpacity-value');
    this.bindStyle('prop-gradientOpacity', (style, input) => { style.gradientOpacity = parseInt(input.value); });

    // Background Pattern (Priority 3)
    this.bindStyle('prop-fillPattern', (style, input) => {
      style.fillPattern = input.value === 'none' ? undefined : input.value;
    });

    // Stroke
    this.bindStyle('prop-strokeWidth', (style, input) => { style.strokeWidth = parseFloat(input.value); });

    // Dash Pattern (Priority 3)
    this.bindStyle('prop-dashPattern', (style, input) => {
      style.dashPattern = input.value === 'none' ? undefined : input.value;
    });

    // Opacity
    this.bindPercentLabel('prop-opacity', 'prop-opacity-value');
    this.bindStyle('prop-opacity', (style, input) => { style.opacity = parseInt(input.value); });
    this.bindPercentLabel('prop-strokeOpacity', 'prop-strokeOpacity-value');
    this.bindStyle('prop-strokeOpacity', (style, input) => { style.strokeOpacity = parseInt(input.value); });

    this.bindStyle('prop-cornerRadius', (style, input) => { style.arcSize = parseInt(input.value); });

    this.on(document.getElementById('prop-lockShape'), 'change', (e) => {
      const cell = this.getTargetCell();
      if (!cell) return;
      cell.setConnectable(!(e.target as HTMLInputElement).checked);
      this.graph.refresh();
    });

    this.bindStyle('prop-blendMode', (style, input) => { style.blendMode = input.value; });

    // Shadow
    this.bindStyle('prop-shadow', (style, input) => {
      style.shadow = input.checked;
      // Show/hide shadow details
      const shadowDetails = document.getElementById('shadow-details');
      if (shadowDetails) shadowDetails.style.display = input.checked ? 'block' : 'none';
    });
    this.bindStyle('prop-shadowColor', (style, input) => { style.shadowColor = input.value; });
    this.bindStyle('prop-shadowBlur', (style, input) => { style.shadowBlur = parseInt(input.value); });
    this.bindStyle('prop-shadowOffsetX', (style, input) => { style.shadowOffsetX = parseInt(input.value); });
    this.bindStyle('prop-shadowOffsetY', (style, input) => { style.shadowOffsetY = parseInt(input.value); });

    // Rounded
    this.bindStyle('prop-rounded', (style, input) => { style.rounded = input.checked; });

    // Position/Size
    this.on(document.getElementById('prop-x'), 'change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (Number.isNaN(value)) return;
      this.applyGeometry((geo) => { geo.x = value; });
    });

    this.on(document.getElementById('prop-y'), 'change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (Number.isNaN(value)) return;
      this.applyGeometry((geo) => { geo.y = value; });
    });

    this.on(document.getElementById('prop-w'), 'change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (Number.isNaN(value)) return;
      const constrainProportions = (document.getElementById('prop-constrainProportions') as HTMLInputElement)?.checked;
      this.applyGeometry((geo) => {
        if (constrainProportions && geo.height > 0) {
          const aspectRatio = geo.height / geo.width;
          geo.height = value * aspectRatio;
        }
        geo.width = value;
      });
    });

    this.on(document.getElementById('prop-h'), 'change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (Number.isNaN(value)) return;
      const constrainProportions = (document.getElementById('prop-constrainProportions') as HTMLInputElement)?.checked;
      this.applyGeometry((geo) => {
        if (constrainProportions && geo.width > 0) {
          const aspectRatio = geo.width / geo.height;
          geo.width = value * aspectRatio;
        }
        geo.height = value;
      });
    });

    // Min/Max dimensions
    this.bindStyle('prop-minWidth', (style, input) => { style.minWidth = parseInt(input.value); });
    this.bindStyle('prop-maxWidth', (style, input) => { style.maxWidth = parseInt(input.value); });
    this.bindStyle('prop-minHeight', (style, input) => { style.minHeight = parseInt(input.value); });
    this.bindStyle('prop-maxHeight', (style, input) => { style.maxHeight = parseInt(input.value); });

    // Rotation
    this.bindStyle('prop-rotation', (style, input) => { style.rotation = parseInt(input.value); });

    // Constrain Proportions: no listener needed - the state is read when width/height change

    // Rotate 90
    this.on(document.getElementById('btn-rotate90'), 'click', () => {
      this.applyStyle((style) => {
        const current = style.rotation || 0;
        style.rotation = (current + 90) % 360;
        const rotInput = document.getElementById('prop-rotation') as HTMLInputElement;
        if (rotInput) rotInput.value = String(style.rotation);
      });
    });

    // Flip Horizontal / Vertical (one toggle per click). maxGraph reads flips from
    // the style; Geometry has no flipH/flipV, so geometry flags never rendered.
    this.on(document.getElementById('btn-flipHorizontal'), 'click', () => {
      this.applyStyle((style) => {
        style.flipH = !style.flipH;
      });
      this.update();
    });

    this.on(document.getElementById('btn-flipVertical'), 'click', () => {
      this.applyStyle((style) => {
        style.flipV = !style.flipV;
      });
      this.update();
    });

    // Z-Order
    this.bindZOrder('btn-toFront', (parent) => parent.getChildCount() - 1);
    this.bindZOrder('btn-toBack', () => 0);
    this.bindZOrder('btn-bringForward', (parent, index) =>
      Math.min(index + 1, parent.getChildCount() - 1)
    );
    this.bindZOrder('btn-sendBackward', (_parent, index) => Math.max(index - 1, 0));

    // Lock: toggles each selected cell's own flag (same flag as the context menu)
    this.on(document.getElementById('btn-lock'), 'click', () => {
      const cells = this.getTargetCells() as LockableCell[];
      if (cells.length === 0) return;
      cells.forEach((cell) => {
        cell.locked = !cell.locked;
      });
      this.updateLockButton(!!cells[0].locked);
    });
  }

  /**
   * @brief Bind a z-order button that moves every selected cell within its parent
   * @param newIndex Target index for a cell currently at `index` in `parent`
   */
  private bindZOrder(id: string, newIndex: (parent: Cell, index: number) => number) {
    this.on(document.getElementById(id), 'click', () => {
      const cells = this.getTargetCells();
      if (cells.length === 0) return;
      this.graph.batchUpdate(() => {
        cells.forEach((cell) => {
          const parent = cell.getParent();
          if (!parent) return;
          const index = parent.getIndex(cell);
          const target = newIndex(parent, index);
          if (target !== index) {
            this.graph.model.add(parent, cell, target);
          }
        });
      });
    });
  }
}
