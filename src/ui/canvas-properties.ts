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

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupGraphListeners();
    this.setupEventListeners();
  }

  private setupGraphListeners() {
    this.graph.addListener('click', (_sender: any, evt: any) => {
      const cell = evt.getProperty('cell');
      if (!cell) {
        this.showCanvasProperties();
      }
    });

    this.graph.getSelectionModel().addListener('change', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        this.hideCanvasProperties();
      }
    });
  }

  private setupEventListeners() {
    document.getElementById('canvas-gridEnabled')?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      this.toggleGrid(enabled);
    });

    document.getElementById('canvas-gridSize')?.addEventListener('change', (e) => {
      const size = parseInt((e.target as HTMLInputElement).value);
      this.setGridSize(size);
    });

    document.getElementById('canvas-bgColor')?.addEventListener('change', (e) => {
      const color = (e.target as HTMLInputElement).value;
      const textInput = document.getElementById('canvas-bgColorText') as HTMLInputElement;
      if (textInput) textInput.value = color;
      this.setBackgroundColor(color);
    });

    document.getElementById('canvas-bgColorText')?.addEventListener('change', (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (/^#[0-9A-F]{6}$/i.test(color)) {
        const colorInput = document.getElementById('canvas-bgColor') as HTMLInputElement;
        if (colorInput) colorInput.value = color;
        this.setBackgroundColor(color);
      }
    });

    document.getElementById('canvas-size')?.addEventListener('change', (e) => {
      const size = (e.target as HTMLInputElement).value as CanvasSize;
      this.setCanvasSize(size);
    });
  }

  private showCanvasProperties() {
    const placeholder = document.getElementById('prop-placeholder');
    const editor = document.getElementById('prop-editor');
    const canvasProps = document.getElementById('canvas-props');

    if (placeholder) placeholder.style.display = 'none';
    if (editor) editor.style.display = 'none';
    if (canvasProps) canvasProps.style.display = 'block';
  }

  private hideCanvasProperties() {
    const canvasProps = document.getElementById('canvas-props');
    if (canvasProps) canvasProps.style.display = 'none';
  }

  toggleGrid(enabled: boolean) {
    this.config.gridEnabled = enabled;
    const gridColor = '#e0e0e0';
    const container = this.graph.getContainer();

    if (!container) return;

    if (enabled) {
      const gridSize = this.config.gridSize;
      const gridImage = this.createGridSvg(gridColor, gridSize);
      container.style.backgroundImage = `url('${gridImage}')`;
      container.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      container.style.backgroundRepeat = 'repeat';
      container.style.backgroundPosition = '0 0';
    } else {
      container.style.backgroundImage = 'none';
    }
  }

  private createGridSvg(color: string, gridSize: number): string {
    const svg = `
      <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
            <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="${color}" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="white" />
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }

  setGridSize(size: number) {
    this.config.gridSize = size;
    this.graph.gridSize = size;
    if (this.config.gridEnabled) {
      this.toggleGrid(true);
    }
  }

  setBackgroundColor(color: string) {
    this.config.backgroundColor = color;
    const container = this.graph.getContainer();
    if (container) {
      container.style.backgroundColor = color;
    }
  }

  setCanvasSize(size: CanvasSize) {
    this.config.size = size;
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
      }
    }
  }
}
