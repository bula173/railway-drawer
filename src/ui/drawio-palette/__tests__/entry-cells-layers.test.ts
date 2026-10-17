/**
 * cellsFromModelXml (the image exports' cell source): every visible layer in model order, hidden
 * layers skipped, group children kept, edges into a hidden layer dropped.
 */
import { describe, expect, it } from 'vitest';
import { cellsFromModelXml } from '../entry-cells';

const v = (id: string, parent: string, label = id, extra = ''): string =>
  `<mxCell id="${id}" value="${label}" style="rounded=0;" vertex="1" parent="${parent}"${extra}>` +
  `<mxGeometry x="10" y="10" width="40" height="20" as="geometry"/></mxCell>`;

const model = (body: string): string =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel>`;

describe('cellsFromModelXml layers', () => {
  it('returns the cells of every visible layer in model order, including rd-routes', () => {
    const xml = model(
      v('a', '1', 'First') +
        '<mxCell id="L2" value="Second" parent="0"/>' +
        v('b', 'L2', 'Second') +
        '<mxCell id="rd-routes" value="Routes" parent="0"/>' +
        v('r', 'rd-routes', 'Route')
    );
    const cells = cellsFromModelXml(xml);
    expect(cells.map((c) => c.getId())).toEqual(['a', 'b', 'r']);
    expect(cells.every((c) => c.getParent() === null)).toBe(true);
  });

  it('skips a hidden layer (visible="0") like draw.io export', () => {
    const xml = model(v('a', '1') + '<mxCell id="L2" value="Hidden" parent="0" visible="0"/>' + v('b', 'L2'));
    expect(cellsFromModelXml(xml).map((c) => c.getId())).toEqual(['a']);
  });

  it('keeps group children inside their group on a second layer', () => {
    const xml = model(
      v('a', '1') +
        '<mxCell id="L2" value="Second" parent="0"/>' +
        v('g', 'L2', '', '') +
        v('g1', 'g', 'Inner')
    );
    const cells = cellsFromModelXml(xml);
    expect(cells.map((c) => c.getId())).toEqual(['a', 'g']);
    expect(cells[1].getChildAt(0)?.getId()).toBe('g1');
  });

  it('drops edges whose terminal is on a hidden layer and detaches hidden edges from visible cells', () => {
    const xml = model(
      v('a', '1') +
        v('c', '1') +
        '<mxCell id="e1" edge="1" parent="1" source="a" target="h"><mxGeometry relative="1" as="geometry"/></mxCell>' +
        '<mxCell id="L2" value="Hidden" parent="0" visible="0"/>' +
        v('h', 'L2') +
        '<mxCell id="e2" edge="1" parent="L2" source="a" target="c"><mxGeometry relative="1" as="geometry"/></mxCell>'
    );
    const cells = cellsFromModelXml(xml);
    expect(cells.map((c) => c.getId())).toEqual(['a', 'c']);
    expect(cells[0].getEdgeCount()).toBe(0);
    expect(cells[1].getEdgeCount()).toBe(0);
  });
});
