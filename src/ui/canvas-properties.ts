import { Graph } from '@maxgraph/core';

export type CanvasSize = 'A4' | 'A5' | 'Letter' | 'Fullscreen' | 'Custom';

interface CanvasConfig {
  size: CanvasSize;
  gridEnabled: boolean;
  gridSize: number;
  backgroundColor: string;
  width?: number;
  height?: number;
}

export class CanvasProperties {
  private graph: Graph;
  private containerEl: HTMLElement;
  private config: CanvasConfig = {
    size: 'Fullscreen',
    gridEnabled: true,
    gridSize: 10,
    backgroundColor: '#ffffff',
  };

  private sizePresets: Record<CanvasSize, { width: number; height: number } | null> = {
    A4: { width: 800, height: 1131 },
    A5: { width: 565, height: 800 },
    Letter: { width: 850, height: 1100 },
    Fullscreen: null,
    Custom: null,
  };

  constructor(graph: Graph, containerElId: string) {
    this.graph = graph;
    const el = document.getElementById(containerElId);
    if (!el) throw new Error(`Container ${containerElId} not found`);
    this.containerEl = el;

    this.setupGraphListeners();
  }

  private setupGraphListeners() {
    // Listen for canvas clicks (when no cell is selected)
    this.graph.addListener('click', (_sender: any, evt: any) => {
      const cell = evt.getProperty('cell');
      if (!cell) {
        this.render();
      }
    });
  }

  toggleGrid(enabled: boolean) {
    this.config.gridEnabled = enabled;
    this.graph.gridEnabled = enabled;
    this.render();
  }

  setGridSize(size: number) {
    this.config.gridSize = size;
    this.graph.gridSize = size;
    this.render();
  }

  setBackgroundColor(color: string) {
    this.config.backgroundColor = color;
    const container = this.graph.getContainer();
    if (container) {
      container.style.backgroundColor = color;
    }
    this.render();
  }

  setCanvasSize(size: CanvasSize, width?: number, height?: number) {
    this.config.size = size;
    this.config.width = width;
    this.config.height = height;

    const container = this.graph.getContainer();
    if (!container) return;

    if (size === 'Fullscreen') {
      container.style.width = '100%';
      container.style.height = '100%';
    } else {
      const preset = this.sizePresets[size];
      if (preset) {
        container.style.width = `${preset.width}px`;
        container.style.height = `${preset.height}px`;
      } else if (width && height) {
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
      }
    }

    this.render();
  }

  private render() {
    this.containerEl.innerHTML = '';

    const header = document.createElement('div');
    header.style.fontSize = '12px';
    header.style.fontWeight = '600';
    header.style.color = '#333';
    header.style.padding = '8px';
    header.style.borderBottom = '1px solid #e0e0e0';
    header.textContent = 'Canvas Properties';
    this.containerEl.appendChild(header);

    const content = document.createElement('div');
    content.style.padding = '8px';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '12px';

    // Grid Toggle
    content.appendChild(this.createGridToggle());

    // Grid Size
    content.appendChild(this.createGridSizeControl());

    // Background Color
    content.appendChild(this.createBackgroundColorControl());

    // Canvas Size
    content.appendChild(this.createCanvasSizeControl());

    this.containerEl.appendChild(content);
  }

  private createGridToggle(): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const label = document.createElement('label');
    label.style.fontSize = '11px';
    label.style.fontWeight = '600';
    label.style.color = '#666';
    label.textContent = 'Grid';

    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.gap = '6px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.config.gridEnabled;
    checkbox.style.cursor = 'pointer';
    checkbox.addEventListener('change', () => {
      this.toggleGrid(checkbox.checked);
    });

    const checkboxLabel = document.createElement('label');
    checkboxLabel.style.fontSize = '12px';
    checkboxLabel.style.cursor = 'pointer';
    checkboxLabel.textContent = 'Show Grid';

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxLabel);

    container.appendChild(label);
    container.appendChild(checkboxContainer);

    return container;
  }

  private createGridSizeControl(): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const label = document.createElement('label');
    label.style.fontSize = '11px';
    label.style.fontWeight = '600';
    label.style.color = '#666';
    label.textContent = 'Grid Size';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '5';
    input.max = '50';
    input.step = '1';
    input.value = this.config.gridSize.toString();
    input.style.padding = '4px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '3px';
    input.style.fontSize = '12px';
    input.addEventListener('change', () => {
      const size = parseInt(input.value, 10);
      if (size >= 5 && size <= 50) {
        this.setGridSize(size);
      }
    });

    container.appendChild(label);
    container.appendChild(input);

    return container;
  }

  private createBackgroundColorControl(): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const label = document.createElement('label');
    label.style.fontSize = '11px';
    label.style.fontWeight = '600';
    label.style.color = '#666';
    label.textContent = 'Background Color';

    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.gap = '6px';
    colorContainer.style.alignItems = 'center';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = this.config.backgroundColor;
    colorPicker.style.width = '40px';
    colorPicker.style.height = '32px';
    colorPicker.style.cursor = 'pointer';
    colorPicker.style.border = '1px solid #ccc';
    colorPicker.style.borderRadius = '3px';
    colorPicker.addEventListener('input', () => {
      this.setBackgroundColor(colorPicker.value);
    });

    const colorText = document.createElement('input');
    colorText.type = 'text';
    colorText.value = this.config.backgroundColor;
    colorText.style.flex = '1';
    colorText.style.padding = '4px';
    colorText.style.border = '1px solid #ccc';
    colorText.style.borderRadius = '3px';
    colorText.style.fontSize = '12px';
    colorText.addEventListener('change', () => {
      if (/^#[0-9A-F]{6}$/i.test(colorText.value)) {
        this.setBackgroundColor(colorText.value);
        colorPicker.value = colorText.value;
      } else {
        colorText.value = this.config.backgroundColor;
      }
    });

    colorContainer.appendChild(colorPicker);
    colorContainer.appendChild(colorText);

    container.appendChild(label);
    container.appendChild(colorContainer);

    return container;
  }

  private createCanvasSizeControl(): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const label = document.createElement('label');
    label.style.fontSize = '11px';
    label.style.fontWeight = '600';
    label.style.color = '#666';
    label.textContent = 'Canvas Size';

    const select = document.createElement('select');
    select.style.padding = '4px';
    select.style.border = '1px solid #ccc';
    select.style.borderRadius = '3px';
    select.style.fontSize = '12px';
    select.style.cursor = 'pointer';

    const sizes: CanvasSize[] = ['A4', 'A5', 'Letter', 'Fullscreen'];
    sizes.forEach((size) => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      option.selected = this.config.size === size;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      this.setCanvasSize(select.value as CanvasSize);
    });

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }
}
