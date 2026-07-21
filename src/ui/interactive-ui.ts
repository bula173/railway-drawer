import { Graph } from '@maxgraph/core';

export class InteractiveUIController {
  private graph: Graph;
  private selectedCells: any[] = [];

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupToolbarButtons();
    this.setupCanvasProperties();
    this.setupPropertyPanelInputs();
    this.setupTopBar();
    this.setupCollapsibles();
    this.setupGraphListeners();
  }

  private setupToolbarButtons(): void {
    // Zoom controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.graph.zoomIn();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.graph.zoomOut();
    });

    document.getElementById('zoom-level')?.addEventListener('change', (e: any) => {
      const zoomLevel = parseInt(e.target.value);
      this.graph.zoomTo(zoomLevel / 100);
    });

    // Pan controls
    document.getElementById('btn-pan-left')?.addEventListener('click', () => {
      const container = this.graph.container;
      if (container) {
        container.scrollLeft -= 50;
      }
    });

    document.getElementById('btn-pan-right')?.addEventListener('click', () => {
      const container = this.graph.container;
      if (container) {
        container.scrollLeft += 50;
      }
    });

    // Delete button
    document.getElementById('btn-delete')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        this.graph.removeCells(cells);
      }
    });

    // Grid toggle
    document.getElementById('btn-grid')?.addEventListener('click', () => {
      this.graph.gridEnabled = !this.graph.gridEnabled;
      const checkbox = document.getElementById('canvas-gridEnabled') as HTMLInputElement;
      if (checkbox) checkbox.checked = this.graph.gridEnabled;
    });

    // Format painter
    document.getElementById('btn-format-painter')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        console.log('[UI] Format painter activated - Not yet fully implemented');
      }
    });

    // Drawing modes (placeholder implementations)
    document.getElementById('btn-draw-rect')?.addEventListener('click', () => {
      console.log('[UI] Draw rectangle mode - Not yet implemented');
    });

    document.getElementById('btn-draw-ellipse')?.addEventListener('click', () => {
      console.log('[UI] Draw ellipse mode - Not yet implemented');
    });

    document.getElementById('btn-draw-diamond')?.addEventListener('click', () => {
      console.log('[UI] Draw diamond mode - Not yet implemented');
    });

    document.getElementById('btn-draw-line')?.addEventListener('click', () => {
      console.log('[UI] Draw line mode - Not yet implemented');
    });

    document.getElementById('btn-draw-connector')?.addEventListener('click', () => {
      console.log('[UI] Draw connector mode - Not yet implemented');
    });

    document.getElementById('btn-add-element')?.addEventListener('click', () => {
      console.log('[UI] Add element - Not yet implemented');
    });

    document.getElementById('btn-align')?.addEventListener('click', () => {
      console.log('[UI] Align options - Not yet implemented');
    });

    document.getElementById('btn-distribute')?.addEventListener('click', () => {
      console.log('[UI] Distribute options - Not yet implemented');
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.getElementById('app-container')?.requestFullscreen().catch((err) => {
          console.error('[UI] Fullscreen request failed:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.getElementById('btn-more-options')?.addEventListener('click', () => {
      console.log('[UI] More options - Not yet implemented');
    });
  }

  private setupCanvasProperties(): void {
    const gridCheckbox = document.getElementById('canvas-gridEnabled') as HTMLInputElement;
    gridCheckbox?.addEventListener('change', () => {
      this.graph.gridEnabled = gridCheckbox.checked;
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
    // Property tabs
    const propTabs = document.querySelectorAll('.prop-tab');
    propTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName) {
          this.switchPropertyTab(tabName);
        }
      });
    });

    // Text input
    const textInput = document.getElementById('prop-text') as HTMLInputElement;
    textInput?.addEventListener('change', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        this.graph.model.setValue(cell, textInput.value);
      });
      this.graph.refresh();
    });

    // Font family
    const fontFamily = document.getElementById('prop-fontFamily') as HTMLSelectElement;
    fontFamily?.addEventListener('change', () => {
      this.updateCellStyle('fontFamily', fontFamily.value);
    });

    // Font size
    const fontSize = document.getElementById('prop-fontSize') as HTMLInputElement;
    fontSize?.addEventListener('change', () => {
      this.updateCellStyle('fontSize', parseInt(fontSize.value));
    });

    // Font color
    const fontColor = document.getElementById('prop-fontColorBtn') as HTMLInputElement;
    fontColor?.addEventListener('change', () => {
      this.updateCellStyle('fontColor', fontColor.value);
    });

    // Text styling buttons
    document.querySelector('.text-bold')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const style = cell.style || {};
        style.fontStyle = (style.fontStyle || 0) ^ 1; // Toggle bold
      });
      this.graph.refresh();
    });

    document.querySelector('.text-italic')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const style = cell.style || {};
        style.fontStyle = (style.fontStyle || 0) ^ 2; // Toggle italic
      });
      this.graph.refresh();
    });

    document.querySelector('.text-underline')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const style = cell.style || {};
        style.fontStyle = (style.fontStyle || 0) ^ 4; // Toggle underline
      });
      this.graph.refresh();
    });

    // Text alignment
    document.querySelector('.align-left')?.addEventListener('click', () => {
      this.updateCellStyle('align', 'left');
    });

    document.querySelector('.align-center')?.addEventListener('click', () => {
      this.updateCellStyle('align', 'center');
    });

    document.querySelector('.align-right')?.addEventListener('click', () => {
      this.updateCellStyle('align', 'right');
    });

    // Vertical alignment
    document.querySelector('.valign-top')?.addEventListener('click', () => {
      this.updateCellStyle('verticalAlign', 'top');
    });

    document.querySelector('.valign-middle')?.addEventListener('click', () => {
      this.updateCellStyle('verticalAlign', 'middle');
    });

    document.querySelector('.valign-bottom')?.addEventListener('click', () => {
      this.updateCellStyle('verticalAlign', 'bottom');
    });

    // Text position
    const textPosition = document.getElementById('prop-position') as HTMLSelectElement;
    textPosition?.addEventListener('change', () => {
      const value = textPosition.value;
      const alignMap: any = { top: 'top', center: 'middle', bottom: 'bottom' };
      this.updateCellStyle('verticalAlign', alignMap[value] || 'middle');
    });

    // Writing direction
    const writingDirection = document.getElementById('prop-writingDirection') as HTMLSelectElement;
    writingDirection?.addEventListener('change', () => {
      this.updateCellStyle('textDirection', writingDirection.value);
    });

    // Fill and Line options
    const useFill = document.getElementById('prop-useFill') as HTMLInputElement;
    useFill?.addEventListener('change', () => {
      this.updateCellStyle('filled', useFill.checked ? 1 : 0);
    });

    const useLine = document.getElementById('prop-useLine') as HTMLInputElement;
    useLine?.addEventListener('change', () => {
      this.updateCellStyle('rounded', useLine.checked ? 1 : 0);
    });

    // Line style and width
    const lineStyle = document.getElementById('prop-lineStyle') as HTMLSelectElement;
    lineStyle?.addEventListener('change', () => {
      this.updateCellStyle('dashed', lineStyle.value === 'dashed' ? 1 : 0);
    });

    const strokeWidth = document.getElementById('prop-strokeWidth') as HTMLInputElement;
    strokeWidth?.addEventListener('change', () => {
      this.updateCellStyle('strokeWidth', parseFloat(strokeWidth.value));
    });

    // Opacity slider
    const opacity = document.getElementById('prop-opacity') as HTMLInputElement;
    const opacityValue = document.getElementById('prop-opacity-value');
    opacity?.addEventListener('change', () => {
      const value = parseInt(opacity.value);
      if (opacityValue) opacityValue.textContent = `${value}%`;
      this.updateCellStyle('opacity', Math.round((value / 100) * 100));
    });

    // Effects
    const rounded = document.getElementById('prop-rounded') as HTMLInputElement;
    rounded?.addEventListener('change', () => {
      this.updateCellStyle('rounded', rounded.checked ? 1 : 0);
    });

    const sketch = document.getElementById('prop-sketch') as HTMLInputElement;
    sketch?.addEventListener('change', () => {
      this.updateCellStyle('sketch', sketch.checked ? 1 : 0);
    });

    const shadow = document.getElementById('prop-shadow') as HTMLInputElement;
    shadow?.addEventListener('change', () => {
      this.updateCellStyle('shadow', shadow.checked ? 1 : 0);
    });

    // Size and position
    const propW = document.getElementById('prop-w') as HTMLInputElement;
    const propH = document.getElementById('prop-h') as HTMLInputElement;
    const propX = document.getElementById('prop-x') as HTMLInputElement;
    const propY = document.getElementById('prop-y') as HTMLInputElement;

    propW?.addEventListener('change', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const cell = cells[0];
        const geo = cell.getGeometry();
        if (geo) {
          const width = parseInt(propW.value) || geo.width;
          this.graph.model.setGeometry(cell, new (geo.constructor as any)(
            geo.x,
            geo.y,
            width,
            geo.height
          ));
        }
      }
    });

    propH?.addEventListener('change', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const cell = cells[0];
        const geo = cell.getGeometry();
        if (geo) {
          const height = parseInt(propH.value) || geo.height;
          this.graph.model.setGeometry(cell, new (geo.constructor as any)(
            geo.x,
            geo.y,
            geo.width,
            height
          ));
        }
      }
    });

    propX?.addEventListener('change', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const cell = cells[0];
        const geo = cell.getGeometry();
        if (geo) {
          const x = parseInt(propX.value) || 0;
          this.graph.model.setGeometry(cell, new (geo.constructor as any)(
            x,
            geo.y,
            geo.width,
            geo.height
          ));
        }
      }
    });

    propY?.addEventListener('change', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const cell = cells[0];
        const geo = cell.getGeometry();
        if (geo) {
          const y = parseInt(propY.value) || 0;
          this.graph.model.setGeometry(cell, new (geo.constructor as any)(
            geo.x,
            y,
            geo.width,
            geo.height
          ));
        }
      }
    });

    // Rotation
    const rotation = document.getElementById('prop-rotation') as HTMLInputElement;
    rotation?.addEventListener('change', () => {
      this.updateCellStyle('rotation', parseInt(rotation.value));
    });

    document.getElementById('btn-rotate90')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const current = (cell.style?.rotation || 0) as number;
        this.updateCellStyle('rotation', (current + 90) % 360);
      });
    });

    // Flip buttons
    document.getElementById('btn-flipHorizontal')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        this.graph.flipEdge(cell);
      });
      this.graph.refresh();
    });

    document.getElementById('btn-flipVertical')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const geo = cell.getGeometry();
        if (geo) {
          geo.alternateBounds = new (geo.constructor as any)(geo.x, geo.y, geo.width, geo.height);
        }
      });
      this.graph.refresh();
    });

    // Z-order buttons
    document.getElementById('btn-toFront')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const model = this.graph.model as any;
        cells.forEach((cell) => {
          const parent = model.getParent(cell);
          if (parent) {
            const index = model.getChildCount(parent) - 1;
            model.add(parent, cell, index);
          }
        });
      }
    });

    document.getElementById('btn-toBack')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const model = this.graph.model as any;
        cells.forEach((cell) => {
          const parent = model.getParent(cell);
          if (parent) {
            model.add(parent, cell, 0);
          }
        });
      }
    });

    document.getElementById('btn-bringForward')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const model = this.graph.model as any;
        cells.forEach((cell) => {
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
        });
      }
    });

    document.getElementById('btn-sendBackward')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const model = this.graph.model as any;
        cells.forEach((cell) => {
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
        });
      }
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

    document.getElementById('btn-group')?.addEventListener('click', () => {
      console.log('[UI] Group - Not yet implemented');
    });

    document.getElementById('btn-copySize')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      if (cells.length > 0) {
        const sourceCell = cells[0];
        const geo = sourceCell.getGeometry();
        if (geo && cells.length > 1) {
          for (let i = 1; i < cells.length; i++) {
            const targetGeo = cells[i].getGeometry();
            if (targetGeo) {
              this.graph.model.setGeometry(cells[i], new (targetGeo.constructor as any)(
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

    document.getElementById('btn-lock')?.addEventListener('click', () => {
      const cells = this.graph.getSelectionCells();
      cells.forEach((cell) => {
        const cellAny = cell as any;
        cellAny.locked = !cellAny.locked;
      });
      this.graph.refresh();
    });
  }

  private setupTopBar(): void {
    document.querySelector('.save-status')?.addEventListener('click', () => {
      console.log('[UI] Save diagram');
      const status = document.querySelector('.save-status') as HTMLElement;
      if (status) {
        status.textContent = '✓ Saved';
        setTimeout(() => {
          status.textContent = 'Unsaved changes. Click here to save.';
        }, 2000);
      }
    });

    document.querySelector('.share-btn')?.addEventListener('click', () => {
      console.log('[UI] Share diagram - Not yet implemented');
    });
  }

  private setupCollapsibles(): void {
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
    collapsibleHeaders.forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.getAttribute('data-section');
        if (section) {
          const content = document.querySelector(`.collapsible-content[data-section="${section}"]`) as HTMLElement;
          if (content) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            const arrow = header.querySelector('span') as HTMLElement;
            if (arrow) {
              arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
            }
          }
        }
      });
    });
  }

  private setupGraphListeners(): void {
    this.graph.getSelectionModel().addListener('change', () => {
      this.selectedCells = this.graph.getSelectionCells();
      this.updatePropertyPanel();
    });
  }

  private switchPropertyTab(tabName: string): void {
    // Hide all tabs
    const tabs = document.querySelectorAll('.prop-tab-content');
    tabs.forEach((tab) => {
      (tab as HTMLElement).style.display = 'none';
    });

    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.prop-tab');
    tabButtons.forEach((btn) => {
      btn.classList.remove('active');
      (btn as HTMLElement).style.borderBottomColor = 'transparent';
      (btn as HTMLElement).style.color = '#999';
    });

    // Show selected tab
    const selectedTab = document.querySelector(`.prop-tab-content[data-tab="${tabName}"]`) as HTMLElement;
    if (selectedTab) {
      selectedTab.style.display = 'block';
    }

    // Set active tab button
    const selectedButton = document.querySelector(`.prop-tab[data-tab="${tabName}"]`) as HTMLElement;
    if (selectedButton) {
      selectedButton.classList.add('active');
      selectedButton.style.borderBottomColor = '#2196F3';
      selectedButton.style.color = '#333';
    }
  }

  private updateCellStyle(key: string, value: any): void {
    const cells = this.graph.getSelectionCells();
    cells.forEach((cell) => {
      const style = cell.style || {};
      (style as any)[key] = value;
    });
    this.graph.refresh();
  }

  private updatePropertyPanel(): void {
    if (this.selectedCells.length === 0) return;

    const cell = this.selectedCells[0];
    const style = cell.style || {};

    // Update text
    const textInput = document.getElementById('prop-text') as HTMLInputElement;
    if (textInput) {
      textInput.value = cell.getValue?.() || '';
    }

    // Update size/position
    const geo = cell.getGeometry();
    if (geo) {
      const propW = document.getElementById('prop-w') as HTMLInputElement;
      const propH = document.getElementById('prop-h') as HTMLInputElement;
      const propX = document.getElementById('prop-x') as HTMLInputElement;
      const propY = document.getElementById('prop-y') as HTMLInputElement;

      if (propW) propW.value = Math.round(geo.width).toString();
      if (propH) propH.value = Math.round(geo.height).toString();
      if (propX) propX.value = Math.round(geo.x).toString();
      if (propY) propY.value = Math.round(geo.y).toString();
    }

    // Update style properties
    const fontFamily = document.getElementById('prop-fontFamily') as HTMLSelectElement;
    if (fontFamily && style.fontFamily) {
      fontFamily.value = style.fontFamily as string;
    }

    const fontSize = document.getElementById('prop-fontSize') as HTMLInputElement;
    if (fontSize && style.fontSize) {
      fontSize.value = (style.fontSize as number).toString();
    }

    const rotation = document.getElementById('prop-rotation') as HTMLInputElement;
    if (rotation && style.rotation) {
      rotation.value = (style.rotation as number).toString();
    }
  }
}
