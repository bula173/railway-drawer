import { Graph } from '@maxgraph/core';
import { globalNotificationManager } from './notification';
import type { Cell, CellStyle, Geometry } from '@maxgraph/core';
import { GraphCommandService } from '../services/graph-command-service';
import { applyStyleToCells, setCellStyleValues } from './style-edit';
import { setGridShown, syncGridControls } from './grid-toggle';

export class InteractiveUIController {
  private graph: Graph;
  private commandService: GraphCommandService;
  private selectedCells: Cell[] = [];

  constructor(graph: Graph, commandService: GraphCommandService) {
    this.graph = graph;
    this.commandService = commandService;
    this.setupToolbarButtons();
    this.setupCanvasProperties();
    this.setupPropertyPanelInputs();
    this.setupTopBar();
    this.setupGraphListeners();
  }

  private setupToolbarButtons(): void {
    // Zoom buttons: ZoomController (binding them here too zoomed twice per click)
    document.getElementById('zoom-level')?.addEventListener('change', (e: Event) => {
      const zoomLevel = parseInt((e.target as HTMLSelectElement).value);
      this.graph.zoomTo(zoomLevel / 100);
    });

    // Delete button
    document.getElementById('btn-delete')?.addEventListener('click', () => {
      this.commandService.delete();
    });

    // Grid toggle (= View > Grid): grid shown + snapping
    document.getElementById('btn-grid')?.addEventListener('click', () => setGridShown(this.graph, !this.graph.gridEnabled));

    // Format painter
    document.getElementById('btn-format-painter')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        // If already has copied style, paste it; otherwise copy from selection
        if (this.commandService.hasCopiedStyle()) {
          this.commandService.pasteStyle();
        } else {
          this.commandService.copyStyle();
        }
      }
    });

    // Quick shape insertion buttons
    document.getElementById('btn-draw-rect')?.addEventListener('click', () => {
      this.insertQuickShape('rectangle', 100, 60, '#e1d5e7', '#9673a6');
    });

    document.getElementById('btn-draw-ellipse')?.addEventListener('click', () => {
      this.insertQuickShape('ellipse', 80, 80, '#d4e6f1', '#3498db', 'ellipse');
    });

    document.getElementById('btn-draw-diamond')?.addEventListener('click', () => {
      this.insertQuickShape('diamond', 80, 80, '#f9e79f', '#f39c12', 'diamond');
    });

    document.getElementById('btn-draw-line')?.addEventListener('click', () => {
      this.insertQuickShape('line', 100, 10, 'none', '#2c3e50', undefined, 2);
    });

    document.getElementById('btn-draw-connector')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length >= 2) {
        this.graph.insertEdge(this.graph.getDefaultParent(), null, '', cells[0], cells[1]);
        this.graph.refresh();
      } else {
        globalNotificationManager.info('Select two shapes to connect them.');
      }
    });

    // #btn-align opens the Align / distribute dropdown (toolbar.ts); AlignmentController binds its items

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.getElementById('app-container')?.requestFullscreen().catch((err) => {
          console.error('[UI] Fullscreen request failed:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }

  private setupCanvasProperties(): void {
    const gridCheckbox = document.getElementById('canvas-gridEnabled') as HTMLInputElement;
    gridCheckbox?.addEventListener('change', () => {
      this.graph.gridEnabled = gridCheckbox.checked;
      syncGridControls(gridCheckbox.checked);
    });

    const gridSizeInput = document.getElementById('canvas-gridSize') as HTMLInputElement;
    gridSizeInput?.addEventListener('change', () => {
      const size = parseInt(gridSizeInput.value) || 10;
      this.graph.gridSize = size;
    });

    const bgColorPicker = document.getElementById('canvas-bgColor') as HTMLInputElement;
    const bgColorText = document.getElementById('canvas-bgColorText') as HTMLInputElement;

    bgColorPicker?.addEventListener('change', () => {
      const color = bgColorPicker.value;
      if (this.graph.container) {
        this.graph.container.style.backgroundColor = color;
      }
      if (bgColorText) bgColorText.value = color;
    });

    bgColorText?.addEventListener('change', () => {
      const color = bgColorText.value;
      if (this.graph.container) {
        this.graph.container.style.backgroundColor = color;
      }
      if (bgColorPicker) bgColorPicker.value = color;
    });

    const canvasSizeSelect = document.getElementById('canvas-size') as HTMLSelectElement;
    canvasSizeSelect?.addEventListener('change', () => {
      const size = canvasSizeSelect.value;
      console.log(`[UI] Canvas size set to ${size}`);
    });
  }

  private setupPropertyPanelInputs(): void {
    // Text input
    const textInput = document.getElementById('prop-text') as HTMLInputElement;
    textInput?.addEventListener('change', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        // cellLabelChanged keeps the other attributes of a draw.io UserObject value
        this.graph.cellLabelChanged(cell, textInput.value, false);
      });
      this.graph.refresh();
    });

    // Text styling buttons (one undoable model edit; the old in-place style mutation was not undoable)
    const toggleFontStyle = (bit: number) => {
      applyStyleToCells(this.graph, this.graph.getSelectionCells(), (style, resolved) => {
        style.fontStyle = (Number(resolved.fontStyle) || 0) ^ bit;
      });
    };
    document.querySelector('.text-bold')?.addEventListener('click', () => toggleFontStyle(1));
    document.querySelector('.text-italic')?.addEventListener('click', () => toggleFontStyle(2));
    document.querySelector('.text-underline')?.addEventListener('click', () => toggleFontStyle(4));

    // Text position
    const textPosition = document.getElementById('prop-position') as HTMLSelectElement;
    textPosition?.addEventListener('change', () => {
      const value = textPosition.value;
      const alignMap: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' };
      this.updateCellStyle('verticalAlign', alignMap[value] || 'middle');
    });

    // Writing direction
    const writingDirection = document.getElementById('prop-writingDirection') as HTMLSelectElement;
    writingDirection?.addEventListener('change', () => {
      this.updateCellStyle('textDirection', writingDirection.value);
    });

    // Fill/line checkboxes and colors, line pattern, stroke width, opacity, rounded, shadow,
    // size/position, rotation, flips, z-order and lock are owned by PropertiesPanel (binding them
    // here applied every edit twice; prop-useLine used to toggle `rounded` here)

    const sketch = document.getElementById('prop-sketch') as HTMLInputElement;
    sketch?.addEventListener('change', () => {
      this.updateCellStyle('sketch', sketch.checked ? 1 : 0);
    });

    // Misc buttons
    document.getElementById('btn-snap-to-grid')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const geo = cell.getGeometry();
        if (geo) {
          geo.x = Math.round(geo.x / this.graph.gridSize) * this.graph.gridSize;
          geo.y = Math.round(geo.y / this.graph.gridSize) * this.graph.gridSize;
        }
      });
      this.graph.refresh();
    });

    // NOTE: Group/Ungroup are handled by GroupingController to avoid duplicates

    document.getElementById('btn-copySize')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const sourceCell = cells[0];
        const geo = sourceCell.getGeometry();
        if (geo && cells.length > 1) {
          for (let i = 1; i < cells.length; i++) {
            const targetGeo = cells[i].getGeometry();
            if (targetGeo) {
              this.graph.model.setGeometry(cells[i], new (targetGeo.constructor as typeof Geometry)(
                targetGeo.x,
                targetGeo.y,
                geo.width,
                geo.height
              ));
            }
          }
          this.graph.refresh();
        }
      }
    });
  }

  private setupTopBar(): void {
    // .save-status is owned by globalSaveStatusIndicator. The old click handler here only
    // faked a "Saved" text (nothing was saved) and could overwrite autosave error messages.
    // .share-btn opens the Share dialog; bound once in main-editor.ts (src/share/share-dialog.ts)
  }

  private setupGraphListeners(): void {
    this.graph.getSelectionModel().addListener('change', () => {
      this.selectedCells = this.graph.getSelectionCells();
      this.updatePropertyPanel();
    });
  }

  private updateCellStyle(key: string, value: unknown): void {
    setCellStyleValues(this.graph, this.graph.getSelectionCells(), { [key]: value });
  }

  private updatePropertyPanel(): void {
    if (this.selectedCells.length === 0) return;

    // Only the text field: PropertiesPanel refreshes the size, position and style inputs
    const cell = this.selectedCells[0];
    const textInput = document.getElementById('prop-text') as HTMLInputElement;
    if (textInput) {
      textInput.value = this.graph.convertValueToString(cell);
    }
  }

  private insertQuickShape(
    shapeType: string,
    width: number,
    height: number,
    fillColor: string,
    strokeColor: string,
    shape?: string,
    strokeWidth?: number
  ): void {
    const parent = this.graph.getDefaultParent();
    const container = this.graph.container as HTMLElement;
    // Centre of the visible part of the canvas (the graph div scrolls), graph coordinates
    const { scale, translate } = this.graph.view;
    const centerX = (container.scrollLeft + container.clientWidth / 2) / scale - translate.x - width / 2;
    const centerY = (container.scrollTop + container.clientHeight / 2) / scale - translate.y - height / 2;

    let style = `fillColor=${fillColor};strokeColor=${strokeColor};`;
    if (strokeWidth !== undefined) {
      style += `strokeWidth=${strokeWidth};`;
    }
    if (shape) {
      style += `shape=${shape};`;
    }

    this.graph.batchUpdate(() => {
      const cell = this.graph.insertVertex(
        parent,
        null,
        shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
        centerX,
        centerY,
        width,
        height,
        // string style passed through unchanged (insertVertex is typed for CellStyle objects)
        style as unknown as CellStyle
      );
      this.graph.setSelectionCells([cell]);
      this.graph.refresh();
    });
  }

}
