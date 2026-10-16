/**
 * Step diff (scenario-diff.ts): cells matched by id -> added / removed / moved+resized / changed
 * (style, label, railway data), edges rerouted, nested cells, the highlight copy of a snapshot.
 */
import { describe, it, expect } from 'vitest';
import { buildDiffHighlightXml, diffSnapshots, diffCountsText, parseSnapshotCells, DIFF_LAYER_ID } from '../scenario-diff';

interface V {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  style?: string;
  parent?: string;
  data?: Record<string, string>;
}

function vertex(v: V): string {
  const geo = `<mxGeometry x="${v.x ?? 0}" y="${v.y ?? 0}" width="${v.w ?? 40}" height="${v.h ?? 20}" as="geometry"/>`;
  if (v.data) {
    const attrs = Object.entries(v.data)
      .map(([k, val]) => ` ${k}="${val}"`)
      .join('');
    return `<object label="${v.label ?? ''}"${attrs} id="${v.id}"><mxCell style="${v.style ?? ''}" vertex="1" parent="${v.parent ?? '1'}">${geo}</mxCell></object>`;
  }
  return `<mxCell id="${v.id}" value="${v.label ?? ''}" style="${v.style ?? ''}" vertex="1" parent="${v.parent ?? '1'}">${geo}</mxCell>`;
}

function edge(id: string, source: string, target: string, points: Array<[number, number]> = []): string {
  const pts = points.length ? `<Array as="points">${points.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array>` : '';
  return `<mxCell id="${id}" value="" style="endArrow=classic;" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`;
}

function model(...cells: string[]): string {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`;
}

describe('diffSnapshots', () => {
  it('finds no change between identical snapshots', () => {
    const xml = model(vertex({ id: 'a', label: 'A' }), vertex({ id: 'b', label: 'B', x: 100 }), edge('e', 'a', 'b'));
    const diff = diffSnapshots(xml, xml);
    expect(diff.changes).toEqual([]);
    expect(diffCountsText(diff.counts)).toBe('');
  });

  it('classifies added, removed, moved, resized and style/label changes', () => {
    const prev = model(
      vertex({ id: 'train', label: 'Train', x: 10, y: 10 }),
      vertex({ id: 'gone', label: 'Old balise', x: 200 }),
      vertex({ id: 'box', label: 'Box', w: 40, h: 20 }),
      vertex({ id: 'lbl', label: 'Route 1' }),
      vertex({ id: 'sty', label: 'S3', style: 'fillColor=#ffffff;strokeColor=#000000' })
    );
    const cur = model(
      vertex({ id: 'train', label: 'Train', x: 110, y: 10 }),
      vertex({ id: 'box', label: 'Box', w: 80, h: 20 }),
      vertex({ id: 'lbl', label: 'Route 2' }),
      vertex({ id: 'sty', label: 'S3', style: 'fillColor=#ff0000;strokeColor=#000000' }),
      vertex({ id: 'new', label: 'RBC', x: 300 })
    );
    const diff = diffSnapshots(prev, cur);
    const byId = Object.fromEntries(diff.changes.map((c) => [c.id, c]));
    expect(byId.train).toMatchObject({ kind: 'moved', moved: true, resized: false, summary: 'Train: moved' });
    expect(byId.box).toMatchObject({ kind: 'moved', moved: false, resized: true, summary: 'Box: resized' });
    expect(byId.lbl).toMatchObject({ kind: 'changed', labelChanged: true, summary: 'Route 1 → Route 2: label changed' });
    expect(byId.sty).toMatchObject({ kind: 'changed', styleKeys: ['fillColor'], summary: 'S3: style changed (fillColor)' });
    expect(byId.new).toMatchObject({ kind: 'added', summary: 'RBC added' });
    expect(byId.gone).toMatchObject({ kind: 'removed', summary: 'Old balise removed' });
    expect(diff.counts).toEqual({ added: 1, removed: 1, moved: 2, changed: 2 });
    expect(diffCountsText(diff.counts)).toBe('1 added, 1 removed, 2 moved/resized, 2 changed');
  });

  it('reports railway data changes by property name ("S2: aspects changed")', () => {
    const prev = model(vertex({ id: 's2', label: '', data: { rdKind: 'signal', rdId: 'S2', rdAspects: '2' } }));
    const cur = model(vertex({ id: 's2', label: '', data: { rdKind: 'signal', rdId: 'S2', rdAspects: '3' } }));
    const [change] = diffSnapshots(prev, cur).changes;
    expect(change).toMatchObject({ id: 's2', kind: 'changed', name: 'S2', dataKeys: ['aspects'], summary: 'S2: aspects changed' });
  });

  it('a cell both moved and restyled is highlighted as moved and lists both', () => {
    const prev = model(vertex({ id: 'a', label: 'A', style: 'fillColor=#fff' }));
    const cur = model(vertex({ id: 'a', label: 'A', x: 50, style: 'fillColor=#000' }));
    const [change] = diffSnapshots(prev, cur).changes;
    expect(change.kind).toBe('moved');
    expect(change.summary).toBe('A: moved, style changed (fillColor)');
  });

  it('edges: new terminal or waypoints = rerouted; unchanged when only the terminals move', () => {
    const a = (x: number): string => vertex({ id: 'a', label: 'A', x });
    const b = vertex({ id: 'b', label: 'B', x: 200 });
    const c = vertex({ id: 'c', label: 'C', x: 400 });
    const prev = model(a(0), b, c, edge('e1', 'a', 'b'), edge('e2', 'a', 'b'));
    const cur = model(a(20), b, c, edge('e1', 'a', 'c'), edge('e2', 'a', 'b', [[100, 50]]));
    const changes = diffSnapshots(prev, cur).changes;
    expect(changes.map((ch) => [ch.id, ch.kind, ch.rerouted])).toEqual([
      ['a', 'moved', false],
      ['e1', 'moved', true],
      ['e2', 'moved', true],
    ]);
    expect(changes[1].summary).toBe('Connector e1: rerouted');
  });

  it('children keep their relative geometry when the group moves (only the group changes)', () => {
    const prev = model(vertex({ id: 'g', label: 'Group', x: 0, w: 200, h: 100 }), vertex({ id: 'k', label: 'Kid', x: 10, y: 10, parent: 'g' }));
    const cur = model(vertex({ id: 'g', label: 'Group', x: 50, w: 200, h: 100 }), vertex({ id: 'k', label: 'Kid', x: 10, y: 10, parent: 'g' }));
    expect(diffSnapshots(prev, cur).changes.map((c) => c.id)).toEqual(['g']);
  });

  it('names cells by label (HTML stripped when html=1), railway ID, else shape + id', () => {
    const cur = model(
      vertex({ id: 'h', label: '&lt;b&gt;Signal&lt;/b&gt; &lt;i&gt;S1&lt;/i&gt;', style: 'html=1;' }),
      vertex({ id: 'x', style: 'shape=mxgraph.basic.star;' }),
      vertex({ id: 'y' })
    );
    expect(diffSnapshots(null, cur).changes.map((c) => c.name)).toEqual(['Signal S1', 'star x', 'Shape y']);
  });

  it('first step / unreadable XML: everything added / nothing', () => {
    expect(diffSnapshots(null, model(vertex({ id: 'a' }))).counts.added).toBe(1);
    expect(diffSnapshots('<broken', '<also broken').changes).toEqual([]);
    expect(parseSnapshotCells('')).toEqual(new Map());
  });
});

describe('buildDiffHighlightXml', () => {
  const prev = model(
    vertex({ id: 'g', label: 'Group', x: 100, y: 100, w: 200, h: 100 }),
    vertex({ id: 'old', label: 'Old &amp; &lt;gone&gt;', x: 20, y: 30, parent: 'g' }),
    vertex({ id: 'm', label: 'M', x: 0, y: 0 }),
    vertex({ id: 'b', label: 'B', x: 400, y: 0 }),
    edge('e', 'm', 'b')
  );
  const cur = model(vertex({ id: 'g', label: 'Group', x: 100, y: 100, w: 200, h: 100 }), vertex({ id: 'm', label: 'M', x: 50, y: 0 }), vertex({ id: 'n', label: 'N', x: 600 }));

  it('adds one top layer with outlines and ghosts at absolute coordinates; the inputs stay unchanged', () => {
    const prevCopy = prev;
    const curCopy = cur;
    const out = buildDiffHighlightXml(prev, cur);
    expect(prev).toBe(prevCopy);
    expect(cur).toBe(curCopy);
    const doc = new DOMParser().parseFromString(out, 'text/xml');
    const cells = Array.from(doc.getElementsByTagName('mxCell'));
    const layer = cells.find((c) => c.getAttribute('id') === DIFF_LAYER_ID)!;
    expect(layer.getAttribute('parent')).toBe('0');
    // the layer comes after the drawing's own layer -> drawn on top
    expect(cells.indexOf(layer)).toBeGreaterThan(cells.findIndex((c) => c.getAttribute('id') === 'n'));
    const marks = cells.filter((c) => c.getAttribute('parent') === DIFF_LAYER_ID);
    const kinds = marks.map((c) => /rdDiff=(\w+)/.exec(c.getAttribute('style') ?? '')?.[1]);
    expect(kinds.sort()).toEqual(['added', 'moved', 'removed', 'removed', 'removed']);
    // ghost of the removed child: absolute = group (100,100) + (20,30), padded by 4
    const ghost = marks.find((c) => c.getAttribute('value') === 'Old & <gone>')!;
    const geo = ghost.getElementsByTagName('mxGeometry')[0];
    expect([geo.getAttribute('x'), geo.getAttribute('y')]).toEqual(['116', '126']);
    expect(ghost.getAttribute('style')).toContain('dashed=1');
    // removed edge: polyline between the old terminal centres
    const ghostEdge = marks.find((c) => c.getAttribute('edge') === '1')!;
    const pts = Array.from(ghostEdge.getElementsByTagName('mxPoint')).map((p) => [p.getAttribute('x'), p.getAttribute('y'), p.getAttribute('as')]);
    expect(pts).toEqual([
      ['20', '10', 'sourcePoint'],
      ['420', '10', 'targetPoint'],
    ]);
    // all original cells are still there, untouched
    const parsed = parseSnapshotCells(out);
    expect(parsed.get('m')?.geometry?.x).toBe(50);
  });

  it('inFirstLayer: highlight cells appended to the first layer (image export draws only that one)', () => {
    const out = buildDiffHighlightXml(prev, cur, undefined, { inFirstLayer: true });
    const doc = new DOMParser().parseFromString(out, 'text/xml');
    const cells = Array.from(doc.getElementsByTagName('mxCell'));
    expect(cells.some((c) => c.getAttribute('id') === DIFF_LAYER_ID)).toBe(false);
    const marks = cells.filter((c) => /rdDiff=/.test(c.getAttribute('style') ?? ''));
    expect(marks).toHaveLength(5);
    expect(new Set(marks.map((c) => c.getAttribute('parent')))).toEqual(new Set(['1']));
    expect(cells.indexOf(marks[0])).toBeGreaterThan(cells.findIndex((c) => c.getAttribute('id') === 'n'));
  });

  it('returns the snapshot itself when nothing changed', () => {
    expect(buildDiffHighlightXml(cur, cur)).toBe(cur);
  });
});
