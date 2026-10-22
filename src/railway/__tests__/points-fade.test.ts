/**
 * Points reverse: the straight continuation is faded for the length of the points (view overlay,
 * nothing in the model): segments from the topology junction, the overlay follows the model.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Graph } from '@maxgraph/core';
import { importDrawioXmlIntoModel, exportModelToDrawioXml } from '../../services/drawio-xml';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { REVERSE_FADE_OPACITY, installPointsFade, reverseFadeSegments } from '../points-fade';
import { setStateOnCells } from '../state-apply';

const obj = (id: string, attrs: string, style: string, geo: string): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" edge="1" parent="1">${geo}</mxCell></object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;

/**
 *   T1  =========*=====================   y=100 (x 0..500)
 *                 \  W1 (leg 150,100 -> 230,180)
 *   T2             *====================  y=180 (x 230..500)
 *   TC1 is drawn on T1 from 0 to 300 (width 8)
 */
const LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${obj('t1', 'rdKind="track" rdId="T1"', 'endArrow=none;strokeWidth=4;', line(0, 100, 500, 100))}
${obj('t2', 'rdKind="track" rdId="T2"', 'endArrow=none;strokeWidth=4;', line(230, 180, 500, 180))}
${obj('tc1', 'rdKind="trackSection" rdId="TC1" rdTrackId="T1"', 'endArrow=none;strokeWidth=8;', line(0, 100, 300, 100))}
${obj('w1', 'rdKind="points" rdId="W1" rdPosition="normal"', 'endArrow=none;strokeWidth=6;strokeColor=#a5a5a5;', line(150, 100, 230, 180))}
</root></mxGraphModel>`;

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
  vi.useRealTimers();
});

function setup(): Graph {
  graph = createTestGraph();
  importDrawioXmlIntoModel(LAYOUT, graph.getDataModel());
  return graph;
}

describe('points reverse fade', () => {
  it('no segment while normal; reverse: the straight continuation for the length of the leg', () => {
    const g = setup();
    const model = g.getDataModel();
    expect(reverseFadeSegments(model)).toEqual([]);
    setStateOnCells(g, [model.getCell('w1')!], 'position', 'reverse');
    const segs = reverseFadeSegments(model);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ cellId: 'w1', pointsId: 'W1', width: 8 });
    // from the junction (150,100) along T1 for the leg's 80 units
    expect(segs[0].line).toEqual([
      { x: 150, y: 100 },
      { x: 230, y: 100 },
    ]);
  });

  it('the overlay draws a canvas-coloured cover (30 % left visible), follows the model and saves nothing', () => {
    vi.useFakeTimers();
    const g = setup();
    const model = g.getDataModel();
    const uninstall = installPointsFade(g);
    const covers = (): SVGPolylineElement[] => Array.from(g.view.getOverlayPane()!.querySelectorAll('.rd-points-fade polyline'));
    expect(covers()).toHaveLength(0);
    setStateOnCells(g, [model.getCell('w1')!], 'position', 'reverse');
    const xml = exportModelToDrawioXml(model);
    vi.runAllTimers();
    expect(covers()).toHaveLength(1);
    // the overlay is not part of the model
    expect(exportModelToDrawioXml(model)).toBe(xml);
    expect(covers()[0].getAttribute('stroke-opacity')).toBe(String(REVERSE_FADE_OPACITY));
    expect(REVERSE_FADE_OPACITY).toBeCloseTo(0.7);
    expect(covers()[0].getAttribute('stroke-width')).toBe('10');
    expect(covers()[0].getAttribute('points')).toBe('150,100 230,100');
    setStateOnCells(g, [model.getCell('w1')!], 'position', 'normal');
    vi.runAllTimers();
    expect(covers()).toHaveLength(0);
    uninstall();
    expect(g.view.getOverlayPane()!.querySelector('.rd-points-fade')).toBeNull();
  });
});
