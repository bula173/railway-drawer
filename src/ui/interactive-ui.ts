/**
 * @file interactive-ui.ts
 * @brief The remaining Properties / Canvas fields and the toolbar's zoom select (label text, bold /
 *        italic / underline, text position, writing direction, sketch, snap to grid, copy size;
 *        canvas grid / background / size; zoom level): one view for the app (TabManager's session
 *        views) acting on the active session's graph (session.ts), and the toolbar's quick insert.
 */
import { onSelectionChange } from '../core/graph-events';
import { Graph } from '@maxgraph/core';
import { ActiveSessionBinding, type GraphSession } from './session';
import type { Cell, CellStyle, Geometry } from '@maxgraph/core';
import { applyStyleToCells, setCellStyleValues } from './style-edit';
import { syncGridControls } from './grid-toggle';
import { logger } from '../drawio/logger';

export class InteractiveUIController {
  /** The bound session's graph (the active tab's). */
  private graph!: Graph;
  private bound = false;
  private selectedCells: Cell[] = [];
  private readonly listenerAbort = new AbortController();
  private readonly binding: ActiveSessionBinding<GraphSession>;

  /** Follows the active session; with `graph`, stays on that graph (tests). */
  constructor(graph?: Graph) {
    this.setupToolbarButtons();
    this.setupCanvasProperties();
    this.setupPropertyPanelInputs();
    this.setupTopBar();
    this.binding = new ActiveSessionBinding<GraphSession>(
      (session, disposers) => {
        this.graph = session.graph;
        this.bound = true;
        this.selectedCells = session.graph.getSelectionCells();
        disposers.add(
          onSelectionChange(session.graph, () => {
            this.selectedCells = session.graph.getSelectionCells();
            this.updatePropertyPanel();
          })
        );
      },
      () => {
        this.bound = false;
        this.selectedCells = [];
      },
      graph ? { graph } : null
    );
  }

  /** A DOM listener bound once; it acts only while a session is bound. */
  private on(target: EventTarget | null | undefined, type: string, handler: (e: Event) => void): void {
    target?.addEventListener(type, (e) => {
      if (this.bound) handler(e);
    }, { signal: this.listenerAbort.signal });
  }

  private setupToolbarButtons(): void {
    // Zoom buttons: ZoomController (binding them here too zoomed twice per click)
    this.on(document.getElementById('zoom-level'), 'change', (e: Event) => {
      const zoomLevel = parseInt((e.target as HTMLSelectElement).value);
      // around the view centre, like the zoom buttons
      this.graph.zoomTo(zoomLevel / 100, true);
    });

    // The toolbar buttons (delete, grid, format painter, insert, connect, fullscreen) run their
    // commands (toolbar.ts data-command, ui/commands)
  }

  private setupCanvasProperties(): void {
    const gridCheckbox = document.getElementById('canvas-gridEnabled') as HTMLInputElement;
    this.on(gridCheckbox, 'change', () => {
      this.graph.gridEnabled = gridCheckbox.checked;
      syncGridControls(gridCheckbox.checked);
    });

    const gridSizeInput = document.getElementById('canvas-gridSize') as HTMLInputElement;
    this.on(gridSizeInput, 'change', () => {
      const size = parseInt(gridSizeInput.value) || 10;
      this.graph.gridSize = size;
    });

    const bgColorPicker = document.getElementById('canvas-bgColor') as HTMLInputElement;
    const bgColorText = document.getElementById('canvas-bgColorText') as HTMLInputElement;

    this.on(bgColorPicker, 'change', () => {
      const color = bgColorPicker.value;
      if (this.graph.container) {
        this.graph.container.style.backgroundColor = color;
      }
      if (bgColorText) bgColorText.value = color;
    });

    this.on(bgColorText, 'change', () => {
      const color = bgColorText.value;
      if (this.graph.container) {
        this.graph.container.style.backgroundColor = color;
      }
      if (bgColorPicker) bgColorPicker.value = color;
    });

    const canvasSizeSelect = document.getElementById('canvas-size') as HTMLSelectElement;
    this.on(canvasSizeSelect, 'change', () => {
      const size = canvasSizeSelect.value;
      logger.debug('UI', `Canvas size set to ${size}`);
    });
  }

  private setupPropertyPanelInputs(): void {
    // Text input
    const textInput = document.getElementById('prop-text') as HTMLInputElement;
    this.on(textInput, 'change', () => {
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
    this.on(document.querySelector('.text-bold'), 'click', () => toggleFontStyle(1));
    this.on(document.querySelector('.text-italic'), 'click', () => toggleFontStyle(2));
    this.on(document.querySelector('.text-underline'), 'click', () => toggleFontStyle(4));

    // Text position
    const textPosition = document.getElementById('prop-position') as HTMLSelectElement;
    this.on(textPosition, 'change', () => {
      const value = textPosition.value;
      const alignMap: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' };
      this.updateCellStyle('verticalAlign', alignMap[value] || 'middle');
    });

    // Writing direction
    const writingDirection = document.getElementById('prop-writingDirection') as HTMLSelectElement;
    this.on(writingDirection, 'change', () => {
      this.updateCellStyle('textDirection', writingDirection.value);
    });

    // Fill/line checkboxes and colors, line pattern, stroke width, opacity, rounded, shadow,
    // size/position, rotation, flips, z-order and lock are owned by PropertiesPanel (binding them
    // here applied every edit twice; prop-useLine used to toggle `rounded` here)

    const sketch = document.getElementById('prop-sketch') as HTMLInputElement;
    this.on(sketch, 'change', () => {
      this.updateCellStyle('sketch', sketch.checked ? 1 : 0);
    });

    // Misc buttons
    this.on(document.getElementById('btn-snap-to-grid'), 'click', () => {
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

    this.on(document.getElementById('btn-copySize'), 'click', () => {
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

  /** Unbinds the view (TabManager's views are destroyed). */
  destroy(): void {
    this.listenerAbort.abort();
    this.binding.dispose();
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
}

/** A shape at the centre of the visible canvas of `graph`, selected (toolbar Insert group, one undoable edit). */
export function insertQuickShape(
  graph: Graph,
  shapeType: string,
  width: number,
  height: number,
  fillColor: string,
  strokeColor: string,
  shape?: string,
  strokeWidth?: number
): void {
  const parent = graph.getDefaultParent();
  const container = graph.container as HTMLElement;
  // Centre of the visible part of the canvas (the graph div scrolls), graph coordinates
  const { scale, translate } = graph.view;
  const centerX = (container.scrollLeft + container.clientWidth / 2) / scale - translate.x - width / 2;
  const centerY = (container.scrollTop + container.clientHeight / 2) / scale - translate.y - height / 2;

  let style = `fillColor=${fillColor};strokeColor=${strokeColor};`;
  if (strokeWidth !== undefined) {
    style += `strokeWidth=${strokeWidth};`;
  }
  if (shape) {
    style += `shape=${shape};`;
  }

  graph.batchUpdate(() => {
    const cell = graph.insertVertex(
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
    graph.setSelectionCells([cell]);
    graph.refresh();
  });
}
