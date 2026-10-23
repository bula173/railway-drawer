/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Graph.js:
 *   15784 isContainer, 15877 isTransparentBounds, 19735 isStack,
 *   19745 isStackChild, 19754 isLane, 10995 isPart, 26310 isTargetShape
 * and src/main/webapp/mxgraph/src/view/mxGraph.js:10114 getActualFooterSize.
 *
 * Shared predicates of the behaviour ports. draw.io's Graph methods are plain
 * functions taking the maxGraph Graph, so nothing is patched on prototypes.
 * Style values may be strings, numbers or booleans (see services/drawio-xml.ts).
 */

import { installOnce } from '../../core/install-once';
import { Cell, Graph, Rectangle } from '@maxgraph/core';
import { getNumber, getString, getValue, toFlag } from '../js/shapes-edges/util';
import { isTable, isTableCell, isTableRow, swimlaneDirection } from '../js/shapes-edges/table-graph';

export type StyleRecord = Record<string, unknown>;

/** Graph.getCurrentCellStyle as a plain record. */
export function currentStyle(graph: Graph, cell: Cell | null, ignoreState = false): StyleRecord {
  return (cell != null ? graph.getCurrentCellStyle(cell, ignoreState) : {}) as StyleRecord;
}

/** Graph.getCellStyle as a plain record. */
export function cellStyle(graph: Graph, cell: Cell | null): StyleRecord {
  return (cell != null ? graph.getCellStyle(cell) : {}) as StyleRecord;
}

/** `mxUtils.getValue(style, key, def) == '0'` for '0', 0 and false. */
export function isOff(style: unknown, key: string, def: string | number | boolean = '1'): boolean {
  const v = getValue(style, key, def);
  return v === false || String(v) === '0';
}

/** `mxUtils.getValue(style, key, def) == '1'` for '1', 1 and true. */
export function isOn(style: unknown, key: string, def: string | number | boolean = '0'): boolean {
  return toFlag(getValue(style, key, def));
}

/** Graph.isContainer (Graph.js:15784): swimlanes unless container=0, others with container=1. */
export function isContainer(graph: Graph, cell: Cell | null): boolean {
  if (cell == null || !cell.isVertex()) {
    return false;
  }

  const style = currentStyle(graph, cell);

  if (graph.isSwimlane(cell)) {
    return !isOff(style, 'container', '1');
  }

  return isOn(style, 'container', '0');
}

/** Graph.isTransparentBounds (Graph.js:15877). */
export function isTransparentBounds(graph: Graph, cell: Cell | null): boolean {
  return cell != null && isOn(currentStyle(graph, cell), 'transparentBounds', '0');
}

/** Graph.isStack (Graph.js:19735). */
export function isStack(graph: Graph, cell: Cell | null): boolean {
  return cell != null && cellStyle(graph, cell).childLayout === 'stackLayout';
}

/** Graph.isStackChild (Graph.js:19745). */
export function isStackChild(graph: Graph, cell: Cell | null): boolean {
  return cell != null && cell.isVertex() && isStack(graph, cell.getParent());
}

/** Graph.isLane (Graph.js:19754): a container in a stack layout (a lane in a pool). */
export function isLane(graph: Graph, cell: Cell | null): boolean {
  return isStackChild(graph, cell) && isContainer(graph, cell);
}

/** Graph.isPart (Graph.js:10995): part=1, table cells and table rows. */
export function isPart(graph: Graph, cell: Cell | null): boolean {
  return cell != null && (isOn(currentStyle(graph, cell), 'part', '0') ||
    isTableCell(graph, cell) || isTableRow(graph, cell));
}

/** Graph.isTargetShape (Graph.js:26310): the dragged cells list the target shape in targetShapes. */
export function isTargetShape(graph: Graph, target: Cell, cells: Cell[]): boolean {
  const shape = getString(currentStyle(graph, target), 'shape', '');

  for (const cell of cells) {
    const shapes = getString(currentStyle(graph, cell), 'targetShapes', '').split(',');

    if (shapes.indexOf(shape) >= 0) {
      return true;
    }
  }

  return false;
}

/**
 * mxGraph.getActualFooterSize (mxGraph.js:10114): top, left, bottom, right footer
 * sizes as y, x, height, width. Swimlane footers sit opposite the title.
 */
export function getActualFooterSize(graph: Graph, cell: Cell | null, ignoreState = false): Rectangle {
  const result = new Rectangle();

  if (cell == null) {
    return result;
  }

  const style = currentStyle(graph, cell, ignoreState);
  const size = Math.max(0, Math.trunc(getNumber(style, 'footerSize', 0)));

  if (size > 0) {
    if (graph.isSwimlane(cell, ignoreState)) {
      const dir = swimlaneDirection(style);

      if (dir === 'north') {
        result.height = size;
      } else if (dir === 'west') {
        result.width = size;
      } else if (dir === 'south') {
        result.y = size;
      } else {
        result.x = size;
      }
    } else {
      result.height = size;
    }
  }

  return result;
}

/** The first table, table row or table ancestor of the given table part (or the table itself). */
export function getTableForCell(graph: Graph, cell: Cell | null): Cell | null {
  if (cell == null) {
    return null;
  }

  if (isTableCell(graph, cell)) {
    return cell.getParent()?.getParent() ?? null;
  }

  if (isTableRow(graph, cell)) {
    return cell.getParent();
  }

  return isTable(graph, cell) ? cell : null;
}

/** Child vertices of a cell (mxGraphModel.getChildCells(cell, true)). */
export function childVertices(cell: Cell | null): Cell[] {
  return cell != null ? cell.getChildCells(true, false) : [];
}

/** Marks a graph as having the named behaviour installed; returns false if it was already. */
export function markInstalled(graph: Graph, key: string): boolean {
  return installOnce(graph, `drawio.behaviour.${key}`);
}
