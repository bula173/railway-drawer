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
import type { Cell } from '@maxgraph/core';
import { ClipboardService } from '../services/clipboard-service';
import type { GraphCommandService } from '../services/graph-command-service';
import { ensureDrawioMenuItems, executeDrawioMenuAction, updateDrawioMenuItems } from '../drawio-shapes/behaviour/menu';
import type { GroupingController } from './grouping';
import { hasLockedStyle, isLayer, toggleCellsLocked } from './cell-lock';
import { ACTION_SHORTCUTS, applyShortcutHints, ariaKeyShortcut, formatShortcut, setMenuItemLabel } from './shortcut-keys';
import { STATE_REQUEST_EVENT, buildStateMenu } from '../railway/state-menu';
import type { StateMenuEntry } from '../railway/state-menu';
import { logger } from '../drawio/logger';
import { duplicateCells } from './duplicate-offset';

/** Gap kept between the context menu and the window edges. */
const VIEWPORT_MARGIN = 4;

/**
 * Top-left corner for a menu of `width` x `height` opened at the pointer (x, y): flipped to the
 * left of / above the pointer when it would leave the window, then clamped inside it.
 */
export function placeContextMenu(
  x: number,
  y: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  margin = VIEWPORT_MARGIN
): { left: number; top: number } {
  let left = x + width > viewWidth - margin ? x - width : x;
  let top = y + height > viewHeight - margin ? y - height : y;
  left = Math.max(margin, Math.min(left, viewWidth - margin - width));
  top = Math.max(margin, Math.min(top, viewHeight - margin - height));
  return { left, top };
}

/**
 * The cells a right-click on `hit` acts on, like a draw.io click: a hit inside the selection (the
 * cell or one of its ancestors is selected) keeps the whole selection; otherwise the topmost
 * selectable ancestor (a group before its children) becomes the selection. Null: nothing
 * selectable was hit (canvas menu).
 */
export function contextSelectionFor(graph: Graph, hit: Cell | null): Cell[] | null {
  if (!hit) return null;
  const selection = graph.getSelectionCells();
  for (let c: Cell | null = hit; c && !isLayer(graph, c); c = c.getParent()) {
    if (selection.includes(c)) return selection;
  }
  let target: Cell | null = null;
  for (let c: Cell | null = hit; c && !isLayer(graph, c) && (c.isVertex() || c.isEdge()); c = c.getParent()) {
    if (graph.isCellSelectable(c)) target = c;
  }
  return target ? [target] : null;
}


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
  private currentCell: Cell | null = null;
  /** @brief Array of selected cells for multi-selection support */
  private selectedCells: Cell[] = [];
  /** @brief Clipboard service for paste operations */
  private clipboardService: ClipboardService;
  /** @brief Last context menu X coordinate */
  private lastContextX = 0;
  /** @brief Last context menu Y coordinate */
  private lastContextY = 0;
  /** @brief Reference to grouping controller for group/ungroup operations */
  private groupingController: GroupingController | undefined;
  /** @brief Reference to graph command service for z-order operations */
  private commandService: GraphCommandService | null = null;
  /** @brief Removes this controller's subscription to the shared ClipboardService */
  private unsubscribeClipboard: (() => void) | null = null;
  /** @brief Runtime state items of railway objects (State ▸ / Aspect ▸ / Position ▸, route commands) */
  private stateSection: HTMLElement | null = null;

  /**
   * @brief Initialize context menu controller
   * @param {Graph} graph - The maxGraph instance
   */
  constructor(graph: Graph) {
    this.graph = graph;
    // This controller decides what a right-click selects. maxGraph's PopupMenuHandler (no menu of
    // its own here) also selected the cell under the mouse-up, or cleared the selection when that
    // was a gap (a group's transparent area, ERTMS symbols): the selection changed after Lock & co.
    const popup = graph.getPlugin('PopupMenuHandler') as { selectOnPopup?: boolean; clearSelectionOnBackground?: boolean } | undefined;
    if (popup) {
      popup.selectOnPopup = false;
      popup.clearSelectionOnBackground = false;
    }
    this.contextMenu = document.getElementById('context-menu');
    this.clipboardService = ClipboardService.getInstance();
    // draw.io table/lane and collapse/expand items (bound below like the static items)
    ensureDrawioMenuItems(this.contextMenu);
    this.arrangeMenu();
    this.stateSection = this.ensureStateSection();
    this.setupContextMenu();
    this.setupClipboardListener();
  }

  /**
   * Delete last (after a separator, below the draw.io table/lane items appended above), menu roles
   * and right-aligned shortcut hints. Idempotent: every tab's controller shares this element.
   */
  private arrangeMenu(): void {
    const menu = this.contextMenu;
    if (!menu) return;
    const deleteSep = menu.querySelector<HTMLElement>('[data-sep="delete"]');
    const deleteItem = menu.querySelector<HTMLElement>('.context-menu-item[data-action="delete"]');
    if (deleteSep) menu.appendChild(deleteSep);
    if (deleteItem) menu.appendChild(deleteItem);
    menu.querySelectorAll<HTMLElement>('.context-menu-item').forEach((item) => {
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
    });
    menu.querySelectorAll<HTMLElement>('.rd-sep, [data-drawio-menu="separator"]').forEach((sep) => sep.setAttribute('role', 'separator'));
    applyShortcutHints(menu.querySelectorAll<HTMLElement>('.context-menu-item[data-action]'));
  }

  /**
   * The container of the railway state items, before "Edit Data..." (shared by every tab's
   * controller). Clicks and keys are delegated from it; its submenus are `position: fixed` so the
   * menu's own scrolling (overflow) does not clip them.
   */
  private ensureStateSection(): HTMLElement | null {
    const menu = this.contextMenu;
    if (!menu) return null;
    let section = menu.querySelector<HTMLElement>(':scope > [data-rd-state-menu]');
    if (!section) {
      section = document.createElement('div');
      section.setAttribute('data-rd-state-menu', '');
      section.setAttribute('role', 'none');
      section.className = 'rd-ctx-state-section';
      section.style.display = 'none';
      const anchor = menu.querySelector(':scope > [data-action="editData"]');
      menu.insertBefore(section, anchor);
    }
    section.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>('[data-state-cmd]');
      e.stopPropagation();
      if (item) {
        window.dispatchEvent(new CustomEvent(STATE_REQUEST_EVENT, { detail: item.dataset.stateCmd }));
        this.hideContextMenu();
        return;
      }
      const sub = target.closest<HTMLElement>('.rd-ctx-sub');
      if (sub) this.openStateSubmenu(sub, true);
    });
    // hover opens a submenu; hovering another item of the menu closes it
    menu.addEventListener('mouseover', (e) => {
      const sub = (e.target as HTMLElement).closest<HTMLElement>('.rd-ctx-sub');
      if (!sub) this.closeStateSubmenus();
      else if (sub.getAttribute('aria-expanded') !== 'true') this.openStateSubmenu(sub, false);
    });
    section.addEventListener('keydown', (e) => this.onStateKey(e));
    return section;
  }

  private closeStateSubmenus(except?: HTMLElement): void {
    this.stateSection?.querySelectorAll<HTMLElement>('.rd-ctx-sub').forEach((sub) => {
      if (sub === except) return;
      sub.setAttribute('aria-expanded', 'false');
      const list = sub.querySelector<HTMLElement>('.rd-ctx-submenu');
      if (list) list.style.display = 'none';
    });
  }

  /** Shows a submenu right of its item (left of it near the window edge), inside the window. */
  private openStateSubmenu(sub: HTMLElement, focusFirst: boolean): void {
    this.closeStateSubmenus(sub);
    const list = sub.querySelector<HTMLElement>('.rd-ctx-submenu');
    if (!list) return;
    sub.setAttribute('aria-expanded', 'true');
    list.style.display = 'block';
    const r = sub.getBoundingClientRect();
    const { width, height } = list.getBoundingClientRect();
    let left = r.right - 2;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) left = Math.max(VIEWPORT_MARGIN, r.left - width + 2);
    const top = Math.max(VIEWPORT_MARGIN, Math.min(r.top - 5, window.innerHeight - VIEWPORT_MARGIN - height));
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    if (focusFirst) list.querySelector<HTMLElement>('[data-state-cmd]')?.focus();
  }

  /** Keys in the state items: ↓/↑ move, →/Enter open a submenu, ←/Esc close it, Enter runs. */
  private onStateKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const sub = target.classList.contains('rd-ctx-sub') ? target : null;
    const list = target.closest<HTMLElement>('.rd-ctx-submenu');
    if (sub && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      this.openStateSubmenu(sub, true);
    } else if (list && (e.key === 'ArrowLeft' || e.key === 'Escape')) {
      e.preventDefault();
      e.stopPropagation();
      const owner = list.closest<HTMLElement>('.rd-ctx-sub');
      this.closeStateSubmenus();
      owner?.focus();
    } else if (target.dataset.stateCmd && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      target.click();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const scope = list ?? this.stateSection;
      if (!scope) return;
      const items = Array.from(scope.querySelectorAll<HTMLElement>(list ? '[data-state-cmd]' : ':scope > [tabindex]'));
      const i = items.indexOf(target);
      if (i < 0) return;
      e.preventDefault();
      e.stopPropagation();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  }

  private renderStateSection(entries: StateMenuEntry[]): void {
    const section = this.stateSection;
    if (!section) return;
    if (entries.length === 0) {
      section.replaceChildren();
      section.style.display = 'none';
      return;
    }
    const nodes: HTMLElement[] = [];
    const sep = document.createElement('div');
    sep.className = 'rd-sep';
    sep.setAttribute('role', 'separator');
    nodes.push(sep);
    for (const entry of entries) {
      if (entry.type === 'item') {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;
        item.dataset.stateCmd = entry.command;
        item.textContent = entry.label;
        if (entry.title) item.title = entry.title;
        nodes.push(item);
        continue;
      }
      const sub = document.createElement('div');
      sub.className = 'context-menu-item rd-ctx-sub';
      sub.setAttribute('role', 'menuitem');
      sub.setAttribute('aria-haspopup', 'menu');
      sub.setAttribute('aria-expanded', 'false');
      sub.dataset.stateSubmenu = entry.dimension;
      sub.tabIndex = -1;
      const label = document.createElement('span');
      label.className = 'rd-menu-label';
      label.textContent = entry.label;
      const caret = document.createElement('span');
      caret.className = 'rd-ctx-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▸';
      const list = document.createElement('div');
      list.className = 'rd-ctx-submenu';
      list.setAttribute('role', 'menu');
      list.setAttribute('aria-label', entry.label);
      list.style.display = 'none';
      for (const o of entry.options) {
        const item = document.createElement('div');
        item.className = 'context-menu-item rd-ctx-radio';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(o.checked));
        item.tabIndex = -1;
        item.dataset.stateCmd = o.command;
        const check = document.createElement('span');
        check.className = 'rd-ctx-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = o.checked ? '✓' : '';
        const text = document.createElement('span');
        text.className = 'rd-menu-label';
        text.textContent = o.label;
        item.append(check, this.stateSwatch(o.visual, entry.dimension === 'aspect'), text);
        // Alt+key of the common states (src/railway/state-shortcuts.ts)
        const spec = ACTION_SHORTCUTS[`railwayState:${o.command}`];
        if (spec) {
          const kbd = document.createElement('kbd');
          kbd.className = 'rd-kbd';
          kbd.setAttribute('aria-hidden', 'true');
          kbd.textContent = formatShortcut(spec);
          item.append(kbd);
          item.setAttribute('aria-keyshortcuts', ariaKeyShortcut(spec));
        }
        list.append(item);
      }
      sub.append(label, caret, list);
      nodes.push(sub);
    }
    section.replaceChildren(...nodes);
    section.style.display = '';
  }

  /** Colour sample of a state (the diagram colour, like the legend). */
  private stateSwatch(visual: { stroke?: string; lamp?: string; dashPattern?: string; opacity?: number }, lamp: boolean): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '10');
    svg.setAttribute('viewBox', '0 0 22 10');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'rd-ctx-swatch');
    if (lamp) {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', '11');
      c.setAttribute('cy', '5');
      c.setAttribute('r', '4');
      c.setAttribute('fill', visual.lamp && visual.lamp !== 'none' ? visual.lamp : 'none');
      c.setAttribute('class', 'rd-ctx-swatch-outline');
      svg.append(c);
    } else {
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', '1');
      l.setAttribute('y1', '5');
      l.setAttribute('x2', '21');
      l.setAttribute('y2', '5');
      l.setAttribute('stroke-width', '3');
      if (visual.stroke) l.setAttribute('stroke', visual.stroke);
      else l.setAttribute('class', 'rd-ctx-swatch-drawn');
      if (visual.dashPattern) l.setAttribute('stroke-dasharray', visual.dashPattern);
      if (visual.opacity !== undefined) l.setAttribute('opacity', String(visual.opacity / 100));
      svg.append(l);
    }
    return svg;
  }

  setGroupingController(controller: GroupingController): void {
    this.groupingController = controller;
  }

  setCommandService(service: GraphCommandService): void {
    this.commandService = service;
  }

  private setupClipboardListener(): void {
    this.unsubscribeClipboard = this.clipboardService.subscribe((hasContent) => {
      const pasteItem = this.contextMenu?.querySelector('[data-action="paste"]') as HTMLElement;
      if (pasteItem) {
        pasteItem.style.opacity = hasContent ? '1' : '0.5';
        pasteItem.style.pointerEvents = hasContent ? 'auto' : 'none';
      }
    });
  }

  /**
   * @brief Release the clipboard subscription so a closed tab's controller (and its graph)
   * is no longer retained by the ClipboardService singleton.
   * The document listeners are scoped to the tab and removed by the TabManager.
   */
  destroy(): void {
    this.unsubscribeClipboard?.();
    this.unsubscribeClipboard = null;
  }

  private setupContextMenu() {
    // Show context menu on right-click
    document.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#graph-container')) {
        e.preventDefault();
        // Graph coordinates of the click (the tab's graph div may be scrolled)
        const container = this.graph.container;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left + container.scrollLeft;
        const y = e.clientY - rect.top + container.scrollTop;

        this.lastContextX = e.clientX;
        this.lastContextY = e.clientY;

        // Cell at the click position (vertices and edges); the selection like a click
        const cell = this.graph.getCellAt(x, y);
        const cells = contextSelectionFor(this.graph, cell);

        if (cell && cells) {
          this.selectedCells = cells;
          const current = this.graph.getSelectionCells();
          if (cells.length !== current.length || cells.some((c) => !current.includes(c))) {
            this.graph.setSelectionCells(cells);
          }
          // The cell itself (table/lane items act on the clicked cell)
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
    const deleteSep = this.contextMenu.querySelector<HTMLElement>('[data-sep="delete"]');
    const lockItem = this.contextMenu.querySelector('[data-action="lock"]') as HTMLElement;
    const pasteItem = this.contextMenu.querySelector('[data-action="paste"]') as HTMLElement;
    const groupItem = this.contextMenu.querySelector('[data-action="group"]') as HTMLElement;
    const ungroupItem = this.contextMenu.querySelector('[data-action="ungroup"]') as HTMLElement;
    const zOrderItems = this.contextMenu.querySelectorAll('[data-action^="to"], [data-action^="bring"], [data-action^="send"]');

    if (type === 'canvas') {
      // For empty canvas, hide cell-specific items and show only paste
      if (deleteItem) deleteItem.style.display = 'none';
      if (deleteSep) deleteSep.style.display = 'none';
      if (lockItem) lockItem.style.display = 'none';
      if (groupItem) groupItem.style.display = 'none';
      if (ungroupItem) ungroupItem.style.display = 'none';
      zOrderItems.forEach((item) => {
        (item as HTMLElement).style.display = 'none';
      });
      if (pasteItem) pasteItem.style.display = this.clipboardService.hasContent() ? '' : 'none';
    } else {
      // For cells, show all items
      if (deleteItem) deleteItem.style.display = '';
      if (deleteSep) deleteSep.style.display = '';
      if (lockItem) {
        lockItem.style.display = '';
        const first = this.selectedCells[0] ?? this.currentCell;
        setMenuItemLabel(lockItem, hasLockedStyle(first) ? 'Unlock' : 'Lock');
      }
      zOrderItems.forEach((item) => {
        (item as HTMLElement).style.display = '';
      });

      // Show group if 2+ objects selected, show ungroup if any are groups
      const canGroup = this.selectedCells.length >= 2;
      // A group is a cell with children (GroupingController uses graph.groupCells)
      const canUngroup = this.selectedCells.some((cell: Cell | null) => !!cell && cell.getChildCount() > 0);

      if (groupItem) groupItem.style.display = canGroup ? '' : 'none';
      if (ungroupItem) ungroupItem.style.display = canUngroup ? '' : 'none';
      if (pasteItem) pasteItem.style.display = this.clipboardService.hasContent() ? '' : 'none';
    }

    updateDrawioMenuItems(this.contextMenu, this.graph, type === 'cell' ? this.currentCell : null);
    this.closeStateSubmenus();
    this.renderStateSection(type === 'cell' ? buildStateMenu(this.selectedCells) : []);

    // Measured where it opens, then flipped/clamped so it never leaves the window
    const menu = this.contextMenu;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
    const { width, height } = menu.getBoundingClientRect();
    const { left, top } = placeContextMenu(x, y, width, height, window.innerWidth, window.innerHeight);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  private hideContextMenu() {
    this.closeStateSubmenus();
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  private executeAction(action: string): void {
    // currentCell may be null here; passed through unchanged as before
    const cellsToOperate = (this.selectedCells.length > 0 ? this.selectedCells : [this.currentCell]) as Cell[];

    if (executeDrawioMenuAction(this.graph, action, this.currentCell)) {
      return;
    }

    switch (action) {
      case 'delete':
        this.graph.removeCells(this.graph.getDeletableCells(cellsToOperate.filter((cell): cell is Cell => !!cell)));
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
        // same as Ctrl/Cmd+D and Edit > Duplicate: railway IDs renumbered (src/railway/clone.ts), one undo step
        duplicateCells(this.graph, cellsToOperate.filter((cell): cell is Cell => !!cell));
        break;

      case 'saveAsTemplate':
        // main-editor.ts: the selection (on a shape) or the whole diagram (on the empty canvas)
        window.dispatchEvent(new CustomEvent('save-template-request'));
        break;

      case 'lock':
        // draw.io lockUnlock: locked=1 style key, one undoable edit
        toggleCellsLocked(this.graph, cellsToOperate.filter((cell): cell is Cell => !!cell));
        break;

      case 'setDefaultStyle':
        logger.debug('ContextMenu', 'Set as Default Style - Not yet implemented');
        break;

      case 'toFront':
        if (this.commandService) this.commandService.toFront();
        break;

      case 'toBack':
        if (this.commandService) this.commandService.toBack();
        break;

      case 'bringForward':
        if (this.commandService) this.commandService.bringForward();
        break;

      case 'sendBackward':
        if (this.commandService) this.commandService.sendBackward();
        break;

      case 'editStyle': {
        logger.debug('ContextMenu', 'Edit Style - Selecting Text tab');
        const textTab = document.querySelector('.prop-tab[data-tab="style"]') as HTMLElement;
        if (textTab) textTab.click();
        break;
      }

      case 'editData':
        // The Data panel edits the selection (src/railway, wired in main-editor.ts)
        if (this.selectedCells.length > 0) this.graph.setSelectionCells(this.selectedCells);
        window.dispatchEvent(new CustomEvent('railway-edit-data-request'));
        break;

      case 'group':
        logger.debug('ContextMenu', 'Group action - selectedCells:', [this.selectedCells.length, 'graphSelection:', this.graph.getSelectionCells().length]);
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
