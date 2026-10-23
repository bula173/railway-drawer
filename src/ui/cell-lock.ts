/**
 * @file cell-lock.ts
 * @brief draw.io's lock: style key `locked=1` on a cell or on a layer (jgraph/drawio Graph.js
 *        isCellLocked, action `lockUnlock`), saved in the file as part of the style string.
 *
 * - A locked cell (or a cell inside a locked group/layer) cannot be moved, resized, rotated, bent,
 *   disconnected, connected to, label-moved, edited or deleted; it can still be selected.
 * - Cells on a locked layer cannot be selected either (draw.io Layers dialog lock).
 * Lock/unlock goes through the style-edit helper, so it is one undoable model edit.
 */
import { installOnce } from '../core/install-once';
import type { Cell, Graph } from '@maxgraph/core';
import { setCellStyleValues } from './style-edit';

function isOn(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Whether the cell's OWN style has `locked=1` (object styles and raw draw.io style strings). */
export function hasLockedStyle(cell: Cell | null | undefined): boolean {
  if (!cell) return false;
  const raw = cell.getStyle() as unknown;
  if (typeof raw === 'string') return /(^|;)\s*locked\s*=\s*(1|true)\s*(;|$)/.test(raw);
  return !!raw && typeof raw === 'object' && isOn((raw as Record<string, unknown>).locked);
}

/** draw.io Graph.isCellLocked: `locked=1` on the cell or on any ancestor (group, layer). */
export function isLockedByStyle(cell: Cell | null | undefined): boolean {
  for (let c = cell ?? null; c; c = c.getParent()) if (hasLockedStyle(c)) return true;
  return false;
}

/** Whether `cell` is a layer of `graph` (a child of the model root). */
export function isLayer(graph: Graph, cell: Cell | null | undefined): boolean {
  const root = graph.getDataModel().getRoot();
  return !!cell && !!root && cell.getParent() === root;
}

/** The layer containing `cell` (the cell itself for a layer), or null. */
export function layerOf(graph: Graph, cell: Cell | null | undefined): Cell | null {
  for (let c = cell ?? null; c; c = c.getParent()) if (isLayer(graph, c)) return c;
  return null;
}

/** Whether `cell` lies on a layer with `locked=1`. */
export function isOnLockedLayer(graph: Graph, cell: Cell | null | undefined): boolean {
  const layer = layerOf(graph, cell);
  return !!layer && layer !== cell && hasLockedStyle(layer);
}

/**
 * Makes `graph` honour `locked=1` like draw.io. maxGraph's isCellMovable/Resizable/Bendable/
 * Editable/Disconnectable, isLabelMovable and the ConstraintHandler all ask `this.isCellLocked`,
 * so overriding it covers them; deletable, rotatable, valid source/target and selectable are
 * added here.
 */
export function installCellLocking(graph: Graph): void {
  if (!installOnce(graph, 'cell-lock')) return;
  const origLocked = graph.isCellLocked.bind(graph);
  graph.isCellLocked = (cell: Cell): boolean => origLocked(cell) || isLockedByStyle(cell);
  const origDeletable = graph.isCellDeletable.bind(graph);
  graph.isCellDeletable = (cell: Cell): boolean => origDeletable(cell) && !graph.isCellLocked(cell);
  const origRotatable = graph.isCellRotatable.bind(graph);
  graph.isCellRotatable = (cell: Cell): boolean => origRotatable(cell) && !graph.isCellLocked(cell);
  // no new connections to or from a locked cell (isValidTarget calls isValidSource)
  const origValidSource = graph.isValidSource.bind(graph);
  graph.isValidSource = (cell: Cell | null): boolean => origValidSource(cell) && !(cell && graph.isCellLocked(cell));
  const origSelectable = graph.isCellSelectable.bind(graph);
  graph.isCellSelectable = (cell: Cell): boolean => origSelectable(cell) && !isOnLockedLayer(graph, cell);
}

/**
 * draw.io's Lock/Unlock (action `lockUnlock`): the first cell's state decides, every cell gets
 * `locked=1` or loses the key. One undoable edit. Returns the new state.
 */
export function toggleCellsLocked(graph: Graph, cells: Cell[]): boolean {
  if (cells.length === 0) return false;
  const lock = !hasLockedStyle(cells[0]);
  setCellsLocked(graph, cells, lock);
  return lock;
}

/** Sets or removes `locked=1` on the cells (layers too), as one undoable edit. */
export function setCellsLocked(graph: Graph, cells: Cell[], locked: boolean): void {
  setCellStyleValues(graph, cells, { locked: locked ? 1 : null });
  if (locked) {
    // cells on a layer that has just been locked cannot stay selected
    const selected = graph.getSelectionCells().filter((c) => isOnLockedLayer(graph, c));
    if (selected.length > 0) graph.removeSelectionCells(selected);
  }
}
