import { Graph } from '@maxgraph/core';

export class PropertiesPanel {
  private graph: Graph;
  private currentCell: any = null;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTabButtons();
    this.setupCollapsibles();
    this.setupEventListeners();

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
    if (placeholder) placeholder.style.display = 'none';
    if (editor) editor.style.display = 'flex';
  }

  private updateValues() {
    const geo = this.currentCell.geometry;
    const style = this.graph.getCellStyle(this.currentCell) as any;

    // Text values
    const textInput = document.getElementById('prop-text') as HTMLInputElement;
    if (textInput) textInput.value = this.currentCell.value || '';

    const fontFamily = document.getElementById('prop-fontFamily') as HTMLInputElement;
    if (fontFamily) fontFamily.value = style.fontFamily || 'Arial';

    const fontSize = document.getElementById('prop-fontSize') as HTMLInputElement;
    if (fontSize) fontSize.value = String(style.fontSize || 12);

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

    // Rotation
    const rotation = document.getElementById('prop-rotation') as HTMLInputElement;
    if (rotation) rotation.value = String(style.rotation || 0);

    // Style
    const fillCheckbox = document.getElementById('prop-useFill') as HTMLInputElement;
    if (fillCheckbox) fillCheckbox.checked = style.fillColor && style.fillColor !== 'none';

    const lineCheckbox = document.getElementById('prop-useLine') as HTMLInputElement;
    if (lineCheckbox) lineCheckbox.checked = style.strokeColor && style.strokeColor !== 'none';

    const strokeWidth = document.getElementById('prop-strokeWidth') as HTMLInputElement;
    if (strokeWidth) strokeWidth.value = String(style.strokeWidth || 1);

    const opacity = document.getElementById('prop-opacity') as HTMLInputElement;
    const opacityValue = document.getElementById('prop-opacity-value');
    if (opacity) opacity.value = String(style.opacity || 100);
    if (opacityValue) opacityValue.textContent = `${style.opacity || 100}%`;

    const shadowCheckbox = document.getElementById('prop-shadow') as HTMLInputElement;
    if (shadowCheckbox) shadowCheckbox.checked = style.shadow || false;

    const roundedCheckbox = document.getElementById('prop-rounded') as HTMLInputElement;
    if (roundedCheckbox) roundedCheckbox.checked = style.rounded ? true : false;

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

    // Text
    document.getElementById('prop-text')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.graph.model.setValue(this.currentCell, value);
      this.graph.refresh();
    });

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

    // Stroke
    document.getElementById('prop-strokeWidth')?.addEventListener('change', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      const style = this.graph.getCellStyle(this.currentCell);
      style.strokeWidth = value;
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

    // Shadow
    document.getElementById('prop-shadow')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).checked;
      const style = this.graph.getCellStyle(this.currentCell);
      style.shadow = value;
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
      geo!.width = value;
      this.graph.refresh();
    });

    document.getElementById('prop-h')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.height = value;
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
