import { afterEach, describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { GraphCommandService } from '../../services/graph-command-service';
import { installCellLocking } from '../../ui/cell-lock';
import { PASTE_STYLE_KEYS, ownStyleCopy } from '../../ui/style-edit';
import { parseStyleString } from '../../services/drawio-xml';
import { configureDiagramRendering } from '../../ui/diagram-graph-setup';

let graph: Graph | null = null;
afterEach(() => {
  graph?.destroy();
  graph = null;
});

function setup(): { graph: Graph; service: GraphCommandService; add: (style: string, value?: string) => Cell } {
  const g = new Graph(document.createElement('div'));
  graph = g;
  configureDiagramRendering(g);
  installCellLocking(g);
  const service = new GraphCommandService(g);
  const add = (style: string, value = 'x'): Cell =>
    g.insertVertex(g.getDefaultParent(), null, value, 0, 0, 40, 40, parseStyleString(style) as never);
  return { graph: g, service, add };
}

describe('Copy / Paste Style (format painter)', () => {
  it('pastes only draw.io visual keys: shape, stencil, lock and railway data stay', () => {
    const { graph: g, service, add } = setup();
    const source = add('shape=mxgraph.basic.star;fillColor=#ff0000;strokeColor=none;fontSize=14;rdKind=signal;rdId=S9;locked=1;html=1;dashed=1');
    const target = add('ellipse;fillColor=#00ff00;rdKind=balise;rdId=B1;whiteSpace=wrap');
    g.setSelectionCells([source]);
    service.copyStyle();
    expect(service.hasCopiedStyle()).toBe(true);
    g.setSelectionCells([target]);
    service.pasteStyle();
    const style = ownStyleCopy(target);
    expect(style.fillColor).toBe('#ff0000');
    expect(style.strokeColor).toBe('none');
    expect(style.fontSize).toBe(14);
    expect(style.dashed).toBeTruthy();
    expect(style.baseStyleNames).toEqual(['ellipse']);
    expect(style.shape).toBeUndefined();
    expect(style.rdKind).toBe('balise');
    expect(style.rdId).toBe('B1');
    expect(style.locked).toBeUndefined();
    expect(style.whiteSpace).toBe('wrap');
    for (const key of ['shape', 'locked', 'html', 'rdKind', 'rdId', 'stencil', 'image']) expect(PASTE_STYLE_KEYS).not.toContain(key);
  });

  it('skips locked cells (own lock or a locked layer) and is one undo step', () => {
    const { graph: g, service, add } = setup();
    const source = add('fillColor=#123456;strokeWidth=3');
    const a = add('fillColor=#ffffff');
    const b = add('fillColor=#eeeeee');
    const locked = add('fillColor=#dddddd;locked=1');
    g.setSelectionCells([source]);
    service.copyStyle();
    g.setSelectionCells([a, b, locked]);
    service.pasteStyle();
    expect(ownStyleCopy(a)).toMatchObject({ fillColor: '#123456', strokeWidth: 3 });
    expect(ownStyleCopy(b)).toMatchObject({ fillColor: '#123456', strokeWidth: 3 });
    expect(ownStyleCopy(locked)).toEqual({ fillColor: '#dddddd', locked: 1 });
    service.undo();
    expect(ownStyleCopy(a).fillColor).toBe('#ffffff');
    expect(ownStyleCopy(b).fillColor).toBe('#eeeeee');
    expect(ownStyleCopy(a).strokeWidth).toBeUndefined();
  });

  it('applies to edges too and leaves keys that already match alone', () => {
    const { graph: g, service, add } = setup();
    const source = add('strokeColor=#ff0000;endArrow=none');
    const v1 = add('');
    const v2 = add('');
    const edge = g.insertEdge(g.getDefaultParent(), null, '', v1, v2, parseStyleString('endArrow=classic;rdRoutes=R1') as never);
    g.setSelectionCells([source]);
    service.copyStyle();
    g.setSelectionCells([edge]);
    service.pasteStyle();
    expect(ownStyleCopy(edge)).toMatchObject({ strokeColor: '#ff0000', endArrow: 'none', rdRoutes: 'R1' });
  });
});
