/**
 * @file context-menu.ts
 * @brief Right-click context menu for shapes and canvas
 * @details
 * Provides context-sensitive menu options for working with shapes:
 * - Clipboard operations (cut, copy, paste, duplicate)
 * - Selection management (lock/unlock)
 * - Z-order operations (bring forward, send backward, to front, to back)
 * - Grouping (group/ungroup selected shapes)
 * - Style editing
 *
 * Menu items are shown/hidden based on context (canvas vs. cell).
 */

import { Graph } from '@maxgraph/core';
import { ClipboardService } from '../services/clipboard-service';

/**
 * @class ContextMenuController
 * @brief Manages right-click context menu display and actions
 * @details
 * Shows context-sensitive menus for canvas and cell operations.
 * Preserves multi-selection when right-clicking on selected cells.
 * Supports both single and multi-cell operations.
 *
 * Key features:
 * - Multi-select preservation (right-click on selected cell keeps selection)
 * - Clipboard state awareness (paste disabled when clipboard empty)
 * - Group/ungroup visibility based on selection type
 * - Z-order operations for single and multiple cells
 *
 * @note GroupingController must be set via setGroupingController() for group/ungroup to work
 */
export class ContextMenuController {
  /** @brief Reference to the maxGraph instance */
  private graph: Graph;
  /** @brief The context menu DOM element */
  private contextMenu: HTMLElement | null;
  /** @brief Currently right-clicked cell (may be different from selection) */
  private currentCell: any = null;
  /** @brief Array of selected cells for multi-selection support */
  private selectedCells: any[] = [];
  /** @brief Clipboard service for paste operations */
  private clipboardService: ClipboardService;
  /** @brief Last context menu X coordinate */
  private lastContextX = 0;
  /** @brief Last context menu Y coordinate */
  private lastContextY = 0;
  /** @brief Reference to grouping controller for group/ungroup operations */
  private groupingController: any;

  /**
   * @brief Initialize context menu controller
   * @param {Graph} graph - The maxGraph instance
   */
  constructor(graph: Graph) {
    this.graph = graph;
    this.contextMenu = document.getElementById('context-menu');
    this.clipboardService = ClipboardService.getInstance();
    this.setupContextMenu();
    this.setupClipboardListener();
  }

  setGroupingController(controller: any): void {
    this.groupingController = controller;
  }

  private setupClipboardListener(): void {
    this.clipboardService.subscribe((hasContent) => {
      const pasteItem = this.contextMenu?.querySelector('[data-action="paste"]') as HTMLElement;
      if (pasteItem) {
        pasteItem.style.opacity = hasContent ? '1' : '0.5';
        pasteItem.style.pointerEvents = hasContent ? 'auto' : 'none';
      }
    });
  }

  private setupContextMenu() {
    // Show context menu on right-click
    document.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#graph-container')) {
        e.preventDefault();
        const rect = document.getElementById('graph-container')!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.lastContextX = e.clientX;
        this.lastContextY = e.clientY;

        // Get cell at click position
        const cell = this.graph.getCellAt(x, y);
        const currentSelection = this.graph.getSelectionCells();

        if (cell && !cell.isEdge?.()) {
          // If clicking on a cell that's already selected, keep the multiple selection
          const isCellInSelection = currentSelection.some((c: any) => c === cell);

          if (isCellInSelection && currentSelection.length > 1) {
            // Keep multiple selection
            this.selectedCells = currentSelection;
          } else {
            // Single cell selection
            this.selectedCells = [cell];
            this.graph.setSelectionCells([cell]);
          }

          this.currentCell = cell;
          this.showContextMenu(e.clientX, e.clientY, 'cell');
        } else {
          // Empty canvas clicked - show canvas context menu
          this.currentCell = null;
          this.selectedCells = [];
          this.graph.setSelectionCells([]);
          this.showContextMenu(e.clientX, e.clientY, 'canvas');
        }
      }
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // Hide context menu on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
      }
    });

    // Setup menu item clicks
    const menuItems = document.querySelectorAll('.context-menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        if (action) {
          this.executeAction(action);
        }
        this.hideContextMenu();
      });
    });
  }

  private showContextMenu(x: number, y: number, type: 'cell' | 'canvas' = 'cell') {
    if (!this.contextMenu) return;

    // Store context position for paste operation
    this.lastContextX = x;
    this.lastContextY = y;

    // Update menu items visibility based on type
    const deleteItem = this.contextMenu.querySelector('[data-action="delete"]') as HTMLElement;
    const lockItem = this.contextMenu.querySelector('[data-action="lock"]') as HTMLElement;
    const pasteItem = this.contextMenu.querySelector('[data-action="paste"]') as HTMLElement;
    const groupItem = this.contextMenu.querySelector('[data-action="group"]') as HTMLElement;
    const ungroupItem = this.contextMenu.querySelector('[data-action="ungroup"]') as HTMLElement;
    const zOrderItems = this.contextMenu.querySelectorAll('[data-action^="to"], [data-action^="bring"], [data-action^="send"]');

    if (type === 'canvas') {
      // For empty canvas, hide cell-specific items and show only paste
      if (deleteItem) deleteItem.style.display = 'none';
      if (lockItem) lockItem.style.display = 'none';
      if (groupItem) groupItem.style.display = 'none';
      if (ungroupItem) ungroupItem.style.display = 'none';
      zOrderItems.forEach((item) => {
        (item as HTMLElement).style.display = 'none';
      });
      if (pasteItem) pasteItem.style.display = this.clipboardService.hasContent() ? 'block' : 'none';
    } else {
      // For cells, show all items
      if (deleteItem) deleteItem.style.display = 'block';
      if (lockItem) lockItem.style.display = 'block';
      zOrderItems.forEach((item) => {
        (item as HTMLElement).style.display = 'block';
      });

      // Show group if 2+ objects selected, show ungroup if any are groups
      const canGroup = this.selectedCells.length >= 2;
      const canUngroup = this.selectedCells.some((cell: any) => {
        const model = (this.graph.model as any);
        const children = model.getChildren?.(cell);
        return children && children.length > 0;
      });

      console.log('[ContextMenu] Cell context - selectedCells:', this.selectedCells.length, 'canGroup:', canGroup, 'canUngroup:', canUngroup);
      if (groupItem) {
        groupItem.style.display = canGroup ? 'block' : 'none';
        console.log('[ContextMenu] Group item display:', groupItem.style.display);
      }
      if (ungroupItem) ungroupItem.style.display = canUngroup ? 'block' : 'none';
      if (pasteItem) pasteItem.style.display = this.clipboardService.hasContent() ? 'block' : 'none';
    }

    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
  }

  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  private executeAction(action: string): void {
    const cellsToOperate = this.selectedCells.length > 0 ? this.selectedCells : [this.currentCell];

    switch (action) {
      case 'delete':
        this.graph.removeCells(cellsToOperate);
        break;

      case 'cut':
        this.clipboardService.cut(cellsToOperate, this.graph);
        break;

      case 'copy':
        this.clipboardService.copy(cellsToOperate, this.graph);
        break;

      case 'paste':
        {
          const rect = document.getElementById('graph-container')?.getBoundingClientRect();
          const offsetX = rect ? this.lastContextX - rect.left : 20;
          const offsetY = rect ? this.lastContextY - rect.top : 20;
          this.clipboardService.paste(this.graph, offsetX, offsetY);
        }
        break;

      case 'duplicate':
        {
          const cloned = this.graph.cloneCells(cellsToOperate);
          const imported = this.graph.importCells(cloned, 20, 20);
          this.graph.setSelectionCells(imported);
        }
        break;

      case 'lock':
        cellsToOperate.forEach((cell: any) => {
          cell.locked = !cell.locked;
        });
        break;

      case 'setDefaultStyle':
        console.log('[ContextMenu] Set as Default Style - Not yet implemented');
        break;

      case 'toFront':
        {
          const model = this.graph.model as any;
          this.graph.batchUpdate(() => {
            cellsToOperate.forEach((cell: any) => {
              const parent = model.getParent(cell);
              if (parent) {
                const index = model.getChildCount(parent) - 1;
                model.add(parent, cell, index);
              }
            });
          });
        }
        break;

      case 'toBack':
        {
          const model = this.graph.model as any;
          this.graph.batchUpdate(() => {
            cellsToOperate.forEach((cell: any) => {
              const parent = model.getParent(cell);
              if (parent) {
                model.add(parent, cell, 0);
              }
            });
          });
        }
        break;

      case 'bringForward':
        {
          const model = this.graph.model as any;
          this.graph.batchUpdate(() => {
            cellsToOperate.forEach((cell: any) => {
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
          });
        }
        break;

      case 'sendBackward':
        {
          const model = this.graph.model as any;
          this.graph.batchUpdate(() => {
            cellsToOperate.forEach((cell: any) => {
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
          });
        }
        break;

      case 'editStyle':
        console.log('[ContextMenu] Edit Style - Selecting Text tab');
        const textTab = document.querySelector('.prop-tab[data-tab="style"]') as HTMLElement;
        if (textTab) textTab.click();
        break;

      case 'editData':
        console.log('[ContextMenu] Edit Data - Not yet implemented');
        break;

      case 'group':
        console.log('[ContextMenu] Group action - selectedCells:', this.selectedCells.length, 'graphSelection:', this.graph.getSelectionCells().length);
        if (this.groupingController) {
          // Ensure graph selection matches our selectedCells
          this.graph.setSelectionCells(this.selectedCells);
          this.groupingController.group();
        } else {
          console.warn('[ContextMenu] groupingController not set!');
        }
        break;

      case 'ungroup':
        if (this.groupingController) {
          this.groupingController.ungroup();
        }
        break;
    }

    this.graph.refresh();
  }
}
