import { Graph } from '@maxgraph/core';
import { applyGridBackground } from './grid-background';
import { ActiveSessionBinding, type GraphSession } from './session';

export type CanvasSize = 'A4' | 'A5' | 'Letter' | 'Fullscreen' | 'Custom';

interface CanvasConfig {
  size: CanvasSize;
  gridEnabled: boolean;
  gridSize: number;
  backgroundColor: string;
  width?: number;
  height?: number;
}

/**
 * Canvas settings (grid, background, size) of the Canvas Properties section. When it is shown is
 * decided by PropertiesPanel (properties-state.ts): after a click on the empty canvas, only while
 * nothing is selected. One view for the app (TabManager's session views): the fields act on the
 * active session's graph (session.ts); the grid fields show its grid (grid-toggle.ts syncGridUi).
 */
export class CanvasProperties {
  /** The bound session's graph (the active tab's). */
  private graph!: Graph;
  private bound = false;
  private readonly listenerAbort = new AbortController();
  private readonly binding: ActiveSessionBinding<GraphSession>;
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

  /** Follows the active session; with `graph`, stays on that graph (tests). */
  constructor(graph?: Graph) {
    this.setupEventListeners();
    this.binding = new ActiveSessionBinding<GraphSession>(
      (session) => {
        this.graph = session.graph;
        this.bound = true;
      },
      () => {
        this.bound = false;
      },
      graph ? { graph } : null
    );
  }

  /** Unbinds the view (TabManager's views are destroyed). */
  destroy(): void {
    this.listenerAbort.abort();
    this.binding.dispose();
  }

  private setupEventListeners() {
    const on = (id: string, handler: (e: Event) => void): void => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        if (this.bound) handler(e);
      }, { signal: this.listenerAbort.signal });
    };
    on('canvas-gridEnabled', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      this.toggleGrid(enabled);
    });

    on('canvas-gridSize', (e) => {
      const size = parseInt((e.target as HTMLInputElement).value);
      this.setGridSize(size);
    });

    on('canvas-bgColor', (e) => {
      const color = (e.target as HTMLInputElement).value;
      const textInput = document.getElementById('canvas-bgColorText') as HTMLInputElement;
      if (textInput) textInput.value = color;
      this.setBackgroundColor(color);
    });

    on('canvas-bgColorText', (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (/^#[0-9A-F]{6}$/i.test(color)) {
        const colorInput = document.getElementById('canvas-bgColor') as HTMLInputElement;
        if (colorInput) colorInput.value = color;
        this.setBackgroundColor(color);
      }
    });

    on('canvas-size', (e) => {
      const size = (e.target as HTMLInputElement).value as CanvasSize;
      this.setCanvasSize(size);
    });
  }

  // The tab's graph holds the grid state (gridEnabled / gridSize, also set by a loaded file's page
  // settings, grid-toggle.ts applyGridSettings), so the background follows it
  toggleGrid(enabled: boolean) {
    this.config.gridEnabled = enabled;
    // Theme-aware tile (light/dark grid color), see grid-background.ts
    applyGridBackground(this.graph.getContainer(), this.graph.gridSize, enabled);
  }

  setGridSize(size: number) {
    if (!Number.isFinite(size) || size <= 0) return;
    this.config.gridSize = size;
    this.graph.gridSize = size;
    applyGridBackground(this.graph.getContainer(), size, this.graph.gridEnabled);
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
