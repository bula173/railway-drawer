/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Context menu entries of draw.io's Menus.js:608-786 (table cells: insert column
 * before/after, delete column, insert row before/after, delete row) and the
 * collapse/expand action of Actions.js ('collapse'/'expand') for foldable containers,
 * as items of the app's #context-menu. The items are plain `.context-menu-item`
 * elements with `data-action="drawio:<action>"`, so the app's ContextMenuController
 * binds them like its static items.
 */

import { Cell, Graph } from '@maxgraph/core';
import { isTable, isTableCell, isTableRow } from '../js/shapes-edges/table-graph';
import { cellStyle, isOff, isStack, isStackChild } from './common';
import { deleteLane, insertLane } from './layouts';
import { deleteTableColumn, deleteTableRow, insertTableColumn, insertTableRow } from './tables';
import { toggleFold } from './containers';

export const DRAWIO_MENU_PREFIX = 'drawio:';

interface MenuItemDef {
  action: string;
  label: string;
  /** Group: 'table' items need a table part or a stack (lane/pool), 'fold' items a foldable cell. */
  group: 'table' | 'fold';
}

const ITEMS: MenuItemDef[] = [
  { action: 'insertColumnBefore', label: 'Insert Column Before', group: 'table' },
  { action: 'insertColumnAfter', label: 'Insert Column After', group: 'table' },
  { action: 'deleteColumn', label: 'Delete Column', group: 'table' },
  { action: 'insertRowBefore', label: 'Insert Row Before', group: 'table' },
  { action: 'insertRowAfter', label: 'Insert Row After', group: 'table' },
  { action: 'deleteRow', label: 'Delete Row', group: 'table' },
  { action: 'toggleFold', label: 'Collapse', group: 'fold' },
];

/**
 * Adds the draw.io items to the given context menu element (once; later calls
 * are no-ops). Call before the menu's `.context-menu-item` click handlers are bound.
 */
export function ensureDrawioMenuItems(menu: HTMLElement | null): void {
  if (menu == null || menu.querySelector('[data-drawio-menu]') != null) {
    return;
  }

  const separator = document.createElement('div');
  separator.setAttribute('data-drawio-menu', 'separator');
  separator.style.borderTop = '1px solid var(--rd-border)';
  separator.style.display = 'none';
  menu.appendChild(separator);

  for (const item of ITEMS) {
    const el = document.createElement('div');
    el.className = 'context-menu-item';
    el.setAttribute('data-action', DRAWIO_MENU_PREFIX + item.action);
    el.setAttribute('data-drawio-menu', item.group);
    el.textContent = item.label;
    el.style.padding = '8px 12px';
    el.style.cursor = 'pointer';
    el.style.display = 'none';
    menu.appendChild(el);
  }
}

interface TableMenuContext {
  cell: Cell;
  stack: boolean;
  showRows: boolean;
  showCols: boolean;
}

/**
 * Menus.addInsertTableCellItem (Menus.js:589): the table actions apply to tables,
 * rows and cells; for stacks (pools) and stack children (lanes) they insert or
 * delete lanes, rows for vertical stacks (horizontalStack=0) and columns otherwise.
 */
function getTableMenuContext(graph: Graph, cell: Cell | null): TableMenuContext | null {
  if (cell == null) {
    return null;
  }

  const table = isTable(graph, cell) || isTableRow(graph, cell) || isTableCell(graph, cell);
  const stack = isStack(graph, cell) || isStackChild(graph, cell);

  if (!table && !stack) {
    return null;
  }

  let showCols = table;
  let showRows = table;

  if (stack) {
    const style = cellStyle(graph, isStack(graph, cell) ? cell : cell.getParent());
    showRows = isOff(style, 'horizontalStack', '1');
    showCols = !showRows;
  }

  return { cell, stack, showRows, showCols };
}

/** Shows the draw.io items that apply to the right-clicked cell (null: canvas). */
export function updateDrawioMenuItems(menu: HTMLElement | null, graph: Graph, cell: Cell | null): void {
  if (menu == null) {
    return;
  }

  const ctx = getTableMenuContext(graph, cell);
  const foldable = cell != null && graph.isCellFoldable(cell, !cell.isCollapsed());
  let any = false;

  menu.querySelectorAll<HTMLElement>('[data-drawio-menu]').forEach((el) => {
    const group = el.getAttribute('data-drawio-menu');
    let visible = false;

    if (group === 'table') {
      const action = el.getAttribute('data-action') ?? '';
      visible = ctx != null && (action.includes('Row') ? ctx.showRows : ctx.showCols);
    } else if (group === 'fold') {
      visible = foldable;

      if (visible && cell != null) {
        el.textContent = cell.isCollapsed() ? 'Expand' : 'Collapse';
      }
    }

    if (group !== 'separator') {
      el.style.display = visible ? 'block' : 'none';
      any = any || visible;
    }
  });

  const separator = menu.querySelector<HTMLElement>('[data-drawio-menu="separator"]');

  if (separator != null) {
    separator.style.display = any ? 'block' : 'none';
  }
}

/**
 * Runs a `drawio:` context menu action for the given cell. Returns false if the
 * action is not a draw.io action (so the caller can handle it).
 */
export function executeDrawioMenuAction(graph: Graph, action: string, cell: Cell | null): boolean {
  if (!action.startsWith(DRAWIO_MENU_PREFIX)) {
    return false;
  }

  const name = action.substring(DRAWIO_MENU_PREFIX.length);

  if (cell == null) {
    return true;
  }

  if (name === 'toggleFold') {
    toggleFold(graph, cell);
    return true;
  }

  const ctx = getTableMenuContext(graph, cell);

  if (ctx == null) {
    return true;
  }

  const before = name.endsWith('Before');

  try {
    if (name === 'insertColumnBefore' || name === 'insertColumnAfter') {
      if (ctx.stack) {
        insertLane(graph, cell, before);
      } else {
        insertTableColumn(graph, cell, before);
      }
    } else if (name === 'insertRowBefore' || name === 'insertRowAfter') {
      if (ctx.stack) {
        insertLane(graph, cell, before);
      } else {
        insertTableRow(graph, cell, before);
      }
    } else if (name === 'deleteColumn') {
      if (ctx.stack) {
        deleteLane(graph, cell);
      } else {
        deleteTableColumn(graph, cell);
      }
    } else if (name === 'deleteRow') {
      if (ctx.stack) {
        deleteLane(graph, cell);
      } else {
        deleteTableRow(graph, cell);
      }
    }
  } catch (e) {
    console.error('[drawio] table action failed', e);
  }

  return true;
}
