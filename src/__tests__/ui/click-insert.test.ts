import { Graph } from '@maxgraph/core';
import { afterEach, describe, expect, it } from 'vitest';
import { clickInsertPlacement, DEFAULT_EDGE_LENGTH, freeSpot, nearestVisiblePoint } from '../../ui/click-insert';
import type { PaletteEntry } from '../../ui/drawio-palette';

const entry = (partial: Partial<PaletteEntry> = {}): PaletteEntry => ({
  id: 'general-0-rect',
  title: 'Rectangle',
  kind: 'vertex',
  width: 120,
  height: 60,
  style: 'rounded=0;whiteSpace=wrap;html=1;',
  shapeNames: [],
  cls: 'a',
  source: 'x',
  ...partial,
});

afterEach(() => document.body.replaceChildren());

describe('click insert placement', () => {
  it('freeSpot cascades right then down past taken boxes', () => {
    const taken = [{ x: -60, y: -30, width: 120, height: 60 }];
    expect(freeSpot({ x: 0, y: 0 }, 120, 60, [])).toEqual({ x: 0, y: 0 });
    expect(freeSpot({ x: 0, y: 0 }, 120, 60, taken)).toEqual({ x: 140, y: 0 });
    expect(freeSpot({ x: 0, y: 0 }, 120, 60, taken, 1)).toEqual({ x: 0, y: 80 });
  });

  it('nearestVisiblePoint keeps the projection when visible, else the nearest visible line point', () => {
    const line = [{ x: 0, y: 100 }, { x: 1000, y: 100 }];
    expect(nearestVisiblePoint({ x: 300, y: 0 }, line, { x: 0, y: 0, width: 600, height: 600 })).toEqual({ x: 300, y: 100 });
    const p = nearestVisiblePoint({ x: 300, y: 0 }, line, { x: 500, y: 0, width: 400, height: 400 });
    expect(p.x).toBeGreaterThanOrEqual(500);
    expect(p.y).toBe(100);
  });

  it('places next to a selected vertex (connect) and at a free spot otherwise', () => {
    const graph = new Graph(document.body.appendChild(document.createElement('div')));
    const parent = graph.getDefaultParent();
    const v = graph.insertVertex(parent, null, '', 100, 100, 80, 40);
    graph.setSelectionCell(v);
    const next = clickInsertPlacement(graph, entry());
    expect(next.connectFrom).toBe(v);
    expect(next.at).toEqual({ x: 100 + 80 + DEFAULT_EDGE_LENGTH + 60, y: 120 });
    // Alt: no connection
    expect(clickInsertPlacement(graph, entry(), true).connectFrom).toBeUndefined();
    // edges never connect
    expect(clickInsertPlacement(graph, entry({ kind: 'edge' })).connectFrom).toBeUndefined();
    graph.clearSelection();
    expect(clickInsertPlacement(graph, entry()).connectFrom).toBeUndefined();
    graph.destroy();
  });
});
