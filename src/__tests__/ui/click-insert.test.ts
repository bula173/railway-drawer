import { Graph } from '@maxgraph/core';
import { afterEach, describe, expect, it } from 'vitest';
import { CASCADE_GAP, clickDirection, clickInsertPlacement, DEFAULT_EDGE_LENGTH, freeSpot, hasEastNeighbour, nearestVisiblePoint } from '../../ui/click-insert';
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

  it("draw.io's itemClicked directions without Alt: Shift east, Ctrl/Cmd north, Ctrl/Cmd+Shift west", () => {
    expect(clickDirection({})).toBeNull();
    expect(clickDirection({ shift: true })).toBe('east');
    expect(clickDirection({ mod: true })).toBe('north');
    expect(clickDirection({ mod: true, shift: true })).toBe('west');
    const graph = new Graph(document.body.appendChild(document.createElement('div')));
    const v = graph.insertVertex(graph.getDefaultParent(), null, '', 100, 100, 80, 40);
    graph.setSelectionCell(v);
    const at = (mods: object) => clickInsertPlacement(graph, entry(), mods).at;
    expect(at({ shift: true })).toEqual({ x: 100 + 80 + DEFAULT_EDGE_LENGTH + 60, y: 120 });
    expect(at({ mod: true })).toEqual({ x: 140, y: 100 - DEFAULT_EDGE_LENGTH - 30 });
    expect(at({ mod: true, shift: true })).toEqual({ x: 100 - DEFAULT_EDGE_LENGTH - 60, y: 120 });
    expect(clickInsertPlacement(graph, entry(), { alt: true, shift: true }).connectFrom).toBeUndefined();
    graph.destroy();
  });

  it('plain click goes below when the east side already has a neighbour (also when below is taken: steps right)', () => {
    const graph = new Graph(document.body.appendChild(document.createElement('div')));
    const parent = graph.getDefaultParent();
    const v = graph.insertVertex(parent, null, '', 100, 100, 80, 40);
    const east = graph.insertVertex(parent, null, '', 100 + 80 + DEFAULT_EDGE_LENGTH, 100, 120, 60);
    graph.setSelectionCell(v);
    const placed = clickInsertPlacement(graph, entry());
    expect(placed.connectFrom).toBe(v);
    expect(placed.at).toEqual({ x: 140, y: 140 + DEFAULT_EDGE_LENGTH + 30 });
    // Shift still forces east (moved down past the neighbour)
    expect(clickInsertPlacement(graph, entry(), { shift: true }).at.x).toBe(100 + 80 + DEFAULT_EDGE_LENGTH + 60);
    // below taken too: next free spot to the right
    graph.insertVertex(parent, null, '', 80, 140 + DEFAULT_EDGE_LENGTH, 120, 60);
    expect(clickInsertPlacement(graph, entry()).at).toEqual({ x: 140 + 120 + CASCADE_GAP, y: 140 + DEFAULT_EDGE_LENGTH + 30 });
    graph.getDataModel().remove(east);
    expect(hasEastNeighbour({ x: 100, y: 100, width: 80, height: 40 }, 120, 60, [])).toBe(false);
    graph.destroy();
  });
});
