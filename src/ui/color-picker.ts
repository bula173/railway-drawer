import { Graph } from '@maxgraph/core';

export class ColorPickerController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupColorPickers();
  }

  private setupColorPickers(): void {
    const fillColorInput = document.getElementById('color-fill') as HTMLInputElement;
    const strokeColorInput = document.getElementById('color-stroke') as HTMLInputElement;
    const strokeWidthInput = document.getElementById('stroke-width') as HTMLInputElement;

    if (fillColorInput) {
      fillColorInput.addEventListener('change', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.setFillColor(color);
      });
      fillColorInput.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.setFillColor(color);
      });
    }

    if (strokeColorInput) {
      strokeColorInput.addEventListener('change', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.setStrokeColor(color);
      });
      strokeColorInput.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.setStrokeColor(color);
      });
    }

    if (strokeWidthInput) {
      strokeWidthInput.addEventListener('change', (e) => {
        const width = (e.target as HTMLInputElement).value;
        this.setStrokeWidth(parseInt(width, 10));
      });
    }

    // Listen to selection changes to update color inputs
    document.addEventListener('selectionchange', () => {
      this.updateColorInputs();
    });

    // Also update on custom event
    this.graph.getSelectionModel().addListener('change', () => {
      this.updateColorInputs();
    });
  }

  setFillColor(color: string): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.style) {
          cell.style.fillColor = color;
        }
        this.graph.refresh();
      });
    });

    console.log(`[ColorPicker] Fill color changed to ${color}`);
  }

  setStrokeColor(color: string): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.style) {
          cell.style.strokeColor = color;
        }
        this.graph.refresh();
      });
    });

    console.log(`[ColorPicker] Stroke color changed to ${color}`);
  }

  setStrokeWidth(width: number): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.style) {
          cell.style.strokeWidth = width;
        }
        this.graph.refresh();
      });
    });

    console.log(`[ColorPicker] Stroke width changed to ${width}px`);
  }

  private updateColorInputs(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    const firstCell = selected[0];
    const fillColorInput = document.getElementById('color-fill') as HTMLInputElement;
    const strokeColorInput = document.getElementById('color-stroke') as HTMLInputElement;
    const strokeWidthInput = document.getElementById('stroke-width') as HTMLInputElement;

    if (firstCell.style) {
      if (fillColorInput && firstCell.style.fillColor) {
        fillColorInput.value = this.colorToHex(firstCell.style.fillColor);
      }
      if (strokeColorInput && firstCell.style.strokeColor) {
        strokeColorInput.value = this.colorToHex(firstCell.style.strokeColor);
      }
      if (strokeWidthInput && firstCell.style.strokeWidth) {
        strokeWidthInput.value = firstCell.style.strokeWidth.toString();
      }
    }
  }

  private colorToHex(color: string): string {
    // If already hex, return as is
    if (color.startsWith('#')) {
      return color;
    }

    // Convert named colors to hex (basic support)
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return '#000000';

    ctx.fillStyle = color;
    return ctx.fillStyle;
  }

  destroy(): void {
    // Cleanup if needed
  }
}
