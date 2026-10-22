/**
 * Railway engineering tools: track topology, route path search over points, route objects (draw.io
 * round trip), conflicts and tables, route checks, snap to track, km interpolation and ruler.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Cell, Geometry, GraphDataModel, Point } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import type { KindId } from '../catalogue';
import { buildDataValue, readAttr } from '../object-data';
import { collectObjects, validateModel } from '../validation';
import type { RailObject, RuleId } from '../validation';
import { buildTopology, passage } from '../topology';
import { buildConflictTable, buildRouteTable, detectConflicts, findRoutePaths, formatPointsList, parsePointsList, routeRecords } from '../routes';
import { ROUTES_LAYER_ID, addRoute, getRoutesLayer, setRoutesVisible, simplifyLine, updateRoutePaths } from '../route-store';
import { SNAP_GAP, SNAP_RADIUS_PX, computeSnap, installSnapToTrack, setSnapAltDownForTest, snapGapAtScale, snapTargets } from '../snap';
import { formatChainage, kmAtPoint, kmScaleOf, recalculateKm, rulerTicks } from '../km';
import { RouteTool } from '../route-tool';
import { exportModelToDrawioXml, importDrawioXmlIntoModel } from '../../services/drawio-xml';
import { GraphCommandService } from '../../services/graph-command-service';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';

class Layout {
  constructor(
    readonly model: GraphDataModel = new GraphDataModel(),
    readonly layer: Cell = model.getRoot()!.getChildAt(0)
  ) {}
  private n = 0;

  obj(kind: KindId, values: Record<string, string>, x = 0, y = 0, w = 20, h = 20): Cell {
    const cell = new Cell(buildDataValue('', { kind, values }), new Geometry(x, y, w, h), {});
    cell.setVertex(true);
    cell.setId(`c${++this.n}`);
    this.model.add(this.layer, cell);
    return cell;
  }

  /** A signal centred on (cx, cy). */
  signal(id: string, direction: string, cx: number, cy: number): Cell {
    return this.obj('signal', { id, direction }, cx - 10, cy - 10);
  }

  line(kind: KindId, values: Record<string, string>, pts: Array<[number, number]>): Cell {
    const geo = new Geometry();
    geo.relative = true;
    geo.setTerminalPoint(new Point(pts[0][0], pts[0][1]), true);
    geo.setTerminalPoint(new Point(pts[pts.length - 1][0], pts[pts.length - 1][1]), false);
    geo.points = pts.slice(1, -1).map(([x, y]) => new Point(x, y));
    const cell = new Cell(buildDataValue('', { kind, values }), geo, {});
    cell.setEdge(true);
    cell.setId(`c${++this.n}`);
    this.model.add(this.layer, cell);
    return cell;
  }

  objects(): RailObject[] {
    return collectObjects(this.model);
  }

  byId(id: string): RailObject {
    return this.objects().find((o) => o.id === id)!;
  }
}

/**
 * Two parallel tracks joined by points W1 (leg from T1 x=200 down to T2 x=300), 1 unit = 1 m:
 *
 *   S1>        W1             S2>
 *   T1 ==========*====================  y=100 (km 10.0 - 10.6)
 *                  \
 *   T2              *=================  y=200 (km 20.0 - 20.6), S3> at x=700
 */
function smallLayout(): Layout {
  const l = new Layout();
  l.line('track', { id: 'T1', kmStart: '10', kmEnd: '10.6' }, [[0, 100], [600, 100]]);
  l.line('track', { id: 'T2', kmStart: '20', kmEnd: '20.6' }, [[200, 200], [800, 200]]);
  l.line('points', { id: 'W1', position: 'normal' }, [[200, 100], [300, 200]]);
  l.signal('S1', 'nominal', 50, 115);
  l.signal('S2', 'nominal', 550, 115);
  l.signal('S3', 'nominal', 700, 215);
  return l;
}

describe('track topology', () => {
  it('splits tracks where the points leg touches them and classifies toe/normal/reverse', () => {
    const l = smallLayout();
    const topo = buildTopology(l.objects());
    expect(topo.pieces.map((p) => [p.linkId, Math.round(p.length)])).toEqual([
      ['T1', 200],
      ['T1', 400],
      ['T2', 100],
      ['T2', 500],
      ['W1', 141],
    ]);
    const junctions = topo.nodes.filter((n) => n.points);
    expect(junctions).toHaveLength(2);
    const [j1, j2] = junctions.map((n) => n.points!);
    const piece = (i: number) => topo.pieces[i];
    // at T1: toe = T1 west part, normal = T1 east part, reverse = the leg
    expect([piece(j1.toe).length, piece(j1.normal).length, piece(j1.reverse).linkId]).toEqual([200, 400, 'W1']);
    // at T2 (trailing): toe = T2 east part, normal = T2 west stub
    expect([Math.round(piece(j2.toe).length), Math.round(piece(j2.normal).length), piece(j2.reverse).linkId]).toEqual([500, 100, 'W1']);
    expect(j1).toMatchObject({ pointsId: 'W1' });
    // normal <-> reverse is impossible, toe <-> reverse needs reverse
    const n1 = topo.nodes.find((n) => n.points === j1)!.id;
    expect(passage(topo, n1, j1.normal, j1.reverse).ok).toBe(false);
    expect(passage(topo, n1, j1.toe, j1.reverse)).toMatchObject({ ok: true, position: 'reverse' });
    expect(passage(topo, n1, j1.toe, j1.normal)).toMatchObject({ ok: true, position: 'normal' });
  });

  it('names track pieces after the sections drawn on top of them', () => {
    const l = new Layout();
    l.line('track', { id: 'T1' }, [[0, 100], [600, 100]]);
    l.line('trackSection', { id: 'TS1', trackId: 'T1' }, [[0, 100], [250, 100]]);
    l.line('trackSection', { id: 'TS2', trackId: 'T1' }, [[250, 100], [600, 100]]);
    const topo = buildTopology(l.objects());
    expect(topo.pieces.map((p) => [p.sectionId, p.trackId, Math.round(p.length)])).toEqual([
      ['TS1', 'T1', 250],
      ['TS2', 'T1', 350],
    ]);
  });

  it('joins ends within the tolerance and uses a points vertex as junction', () => {
    const l = new Layout();
    l.line('track', { id: 'A' }, [[0, 300], [296, 302]]);
    l.line('track', { id: 'B' }, [[304, 300], [600, 300]]);
    l.line('track', { id: 'C' }, [[300, 300], [500, 400]]);
    l.obj('points', { id: 'W9' }, 290, 290, 20, 20);
    const topo = buildTopology(l.objects());
    expect(topo.nodes.filter((n) => n.pieces.length === 3)).toHaveLength(1);
    const j = topo.nodes.find((n) => n.points)!.points!;
    expect([topo.pieces[j.toe].linkId, topo.pieces[j.normal].linkId, topo.pieces[j.reverse].linkId, j.pointsId]).toEqual(['A', 'B', 'C', 'W9']);
    // vertex track links: elongated vertices only (a 10x12 TC marker is no link)
    const m = new Layout();
    m.obj('trackSection', { id: 'TC' }, 0, 0, 10, 12);
    m.obj('track', { id: 'R' }, 0, 50, 300, 6);
    expect(buildTopology(m.objects()).pieces.map((p) => p.linkId)).toEqual(['R']);
  });
});

describe('route path search', () => {
  it('finds the straight route over W1 normal and the diverging one over W1 reverse', () => {
    const l = smallLayout();
    const topo = buildTopology(l.objects());
    const straight = findRoutePaths(topo, l.byId('S1'), l.byId('S2'));
    expect(straight.paths).toHaveLength(1);
    expect(straight.paths[0]).toMatchObject({ sections: ['T1'], overlap: ['T1'], points: [{ id: 'W1', position: 'normal' }], approximate: false });
    expect(Math.round(straight.paths[0].metres)).toBe(500);

    const diverging = findRoutePaths(topo, l.byId('S1'), l.byId('S3'));
    expect(diverging.paths).toHaveLength(1);
    expect(diverging.paths[0]).toMatchObject({ sections: ['T1', 'T2'], overlap: ['T2'], points: [{ id: 'W1', position: 'reverse' }], approximate: true });
    expect(Math.round(diverging.paths[0].units)).toBe(150 + 141 + 400);
    expect(diverging.paths[0].line[0]).toEqual({ x: 50, y: 100 });
    expect(diverging.paths[0].line[diverging.paths[0].line.length - 1]).toEqual({ x: 700, y: 200 });
  });

  it('respects the signal direction and the current points positions on request', () => {
    const l = smallLayout();
    const topo = buildTopology(l.objects());
    // S2 -> S1 runs against the nominal signals
    expect(findRoutePaths(topo, l.byId('S2'), l.byId('S1'))).toMatchObject({ paths: [], problem: 'No path from S2 to S1 in the signal direction' });
    // W1 is normal now: only paths that keep it
    expect(findRoutePaths(topo, l.byId('S1'), l.byId('S3'), { currentPositionsOnly: true }).paths).toEqual([]);
    expect(findRoutePaths(topo, l.byId('S1'), l.byId('S2'), { currentPositionsOnly: true }).paths).toHaveLength(1);
  });

  it('stops at the next signal facing the same way and lists alternatives shortest first', () => {
    const l = smallLayout();
    l.signal('S4', 'nominal', 400, 115);
    const topo = buildTopology(l.objects());
    expect(findRoutePaths(topo, l.byId('S1'), l.byId('S2')).paths).toEqual([]);
    expect(findRoutePaths(topo, l.byId('S1'), l.byId('S4')).paths).toHaveLength(1);
    // a reverse signal in between does not end the route
    const m = smallLayout();
    m.signal('S5', 'reverse', 400, 85);
    expect(findRoutePaths(buildTopology(m.objects()), m.byId('S1'), m.byId('S2')).paths).toHaveLength(1);
  });

  it('parses and formats points lists', () => {
    expect(parsePointsList('W1:normal, W2:R; W3 = n, bad')).toEqual({
      entries: [
        { id: 'W1', position: 'normal' },
        { id: 'W2', position: 'reverse' },
        { id: 'W3', position: 'normal' },
      ],
      invalid: ['bad'],
    });
    expect(formatPointsList([{ id: 'W1', position: 'reverse' }])).toBe('W1:reverse');
  });
});

describe('route objects, conflicts and tables', () => {
  let graph: Graph;
  afterEach(() => cleanupTestGraph(graph));

  function graphWithLayout(): { graph: Graph; layout: Layout } {
    graph = createTestGraph();
    const model = graph.getDataModel();
    const layout = new Layout(model, graph.getDefaultParent());
    const xmlLayout = smallLayout();
    // copy the cells of the small layout into the graph's model
    model.beginUpdate();
    try {
      for (const c of [...xmlLayout.layer.children]) model.add(layout.layer, c);
    } finally {
      model.endUpdate();
    }
    return { graph, layout };
  }

  it('creates route objects on the Routes layer that survive a draw.io round trip', () => {
    const { graph, layout } = graphWithLayout();
    const model = graph.getDataModel();
    const topo = buildTopology(layout.objects());
    const path = findRoutePaths(topo, layout.byId('S1'), layout.byId('S3')).paths[0];
    const commands = new GraphCommandService(graph);
    const edge = addRoute(graph, path, layout.byId('S1'), layout.byId('S3'));
    expect(edge.getParent()?.getId()).toBe(ROUTES_LAYER_ID);
    expect(edge.isEdge()).toBe(true);
    expect(readAttr(edge, 'rdId')).toBe('R1');
    expect(readAttr(edge, 'rdPoints')).toBe('W1:reverse');
    expect(readAttr(edge, 'rdSections')).toBe('T1, T2');
    expect(readAttr(edge, 'rdOverlap')).toBe('T2');
    expect(readAttr(edge, 'rdLength')).toBe('691');
    expect(readAttr(layout.byId('S1').cell, 'rdRoutes')).toBe('R1');

    const xml = exportModelToDrawioXml(model);
    expect(xml).toContain(`<mxCell id="${ROUTES_LAYER_ID}" value="Routes" parent="0"/>`);
    expect(xml).toContain('rdKind="route"');
    const restored = new GraphDataModel();
    importDrawioXmlIntoModel(xml, restored);
    expect(exportModelToDrawioXml(restored)).toBe(xml);
    const records = routeRecords(collectObjects(restored));
    expect(records.map((r) => [r.id, r.entry, r.exit, r.sections, r.overlap, r.points, r.length])).toEqual([
      ['R1', 'S1', 'S3', ['T1', 'T2'], ['T2'], [{ id: 'W1', position: 'reverse' }], 691],
    ]);
    expect(getRoutesLayer(restored)?.getChildAt(0).getGeometry()?.points?.length).toBeGreaterThan(0);

    // one undo step removes the route, the layer and the signal's route list
    commands.undo();
    expect(getRoutesLayer(model)).toBeNull();
    expect(readAttr(layout.byId('S1').cell, 'rdRoutes')).toBe('');
    commands.destroy();
  });

  it('route tool: start signal, end signal, path choice, create', () => {
    const { graph } = graphWithLayout();
    const messages: string[] = [];
    const tool = new RouteTool({ getGraph: () => graph, notify: { success: (m) => messages.push(m), warning: (m) => messages.push(m) } });
    tool.activate();
    expect(document.querySelector('.rd-route-tool .rd-route-status')?.textContent).toBe('Click the start (entry) signal.');
    expect(tool.pickSignalById('S1')).toBe(true);
    expect(tool.pickSignalById('S3')).toBe(true);
    expect(tool.getPaths().map((p) => p.points)).toEqual([[{ cellId: expect.any(String), id: 'W1', position: 'reverse' }]]);
    expect(document.querySelector('.rd-route-tool .rd-route-status')?.textContent).toBe('S1 → S3: 1 path');
    const cell = tool.createRoute('R10');
    expect(readAttr(cell, 'rdId')).toBe('R10');
    expect(messages).toEqual(['Route R10 created: S1 → S3']);
    // back to picking a start signal; no path against the signal direction
    tool.pickSignalById('S2');
    tool.pickSignalById('S1');
    expect(tool.getPaths()).toEqual([]);
    expect(document.querySelector('.rd-route-tool .rd-route-status')?.textContent).toBe('No path from S2 to S1 in the signal direction');
    tool.deactivate();
    expect(document.querySelector('.rd-route-tool')).toBeNull();
  });

  it('detects conflicts (shared sections, opposite points) and builds the tables', () => {
    const { graph, layout } = graphWithLayout();
    const topo = buildTopology(layout.objects());
    addRoute(graph, findRoutePaths(topo, layout.byId('S1'), layout.byId('S2')).paths[0], layout.byId('S1'), layout.byId('S2'));
    addRoute(graph, findRoutePaths(topo, layout.byId('S1'), layout.byId('S3')).paths[0], layout.byId('S1'), layout.byId('S3'));
    const records = routeRecords(collectObjects(graph.getDataModel()));
    const conflicts = detectConflicts(records);
    expect(conflicts.map((c) => [c.a.id, c.b.id, c.sharedSections, c.opposingPoints])).toEqual([['R1', 'R2', ['T1'], ['W1 (normal/reverse)']]]);
    const routes = buildRouteTable(records, conflicts);
    expect(routes.columns).toEqual(['Route', 'From signal', 'To signal', 'Points & positions', 'Track sections', 'Overlap', 'Length [m]', 'Conflicting routes']);
    expect(routes.rows).toEqual([
      ['R1', 'S1', 'S2', 'W1 normal', 'T1', 'T1', 500, 'R2'],
      ['R2', 'S1', 'S3', 'W1 reverse', 'T1, T2', 'T2', 691, 'R1'],
    ]);
    expect(buildConflictTable(conflicts).rows).toEqual([['R1', 'R2', 'T1', 'W1 (normal/reverse)', 'shared section + opposite points positions']]);
    // routes without a common section or points do not conflict
    expect(detectConflicts([{ ...records[0], sections: ['TA'], overlap: [], points: [] }, { ...records[1], sections: ['TB'], overlap: [], points: [] }])).toEqual([]);

    // the Routes layer can be hidden; paths are recomputed after a track moved
    setRoutesVisible(graph, false);
    expect(getRoutesLayer(graph.getDataModel())?.isVisible()).toBe(false);
    expect(updateRoutePaths(graph.getDataModel())).toEqual({ updated: 2, failed: [] });
  });

  it('checks route endpoints, path continuity and points positions', () => {
    const l = smallLayout();
    l.obj('balise', { id: 'B1', groupId: 'BG1' }, 100, 90, 12, 12);
    l.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '1' }, 100, 300);
    const route = (id: string, values: Record<string, string>) => l.obj('route', { id, ...values }, 0, 500);
    route('R1', { entrySignal: 'S1', exitSignal: 'S2', points: 'W1:normal', sections: 'T1' });
    route('R2', { entrySignal: 'S1', exitSignal: 'S3', points: 'W1:normal', sections: 'T1, T2' });
    route('R3', { entrySignal: 'S1', exitSignal: 'S3', sections: 'T2, T1' });
    route('R4', { entrySignal: 'B1', exitSignal: 'S2' });
    route('R5', { entrySignal: 'S2', exitSignal: 'S1' });
    route('R6', { entrySignal: 'S1', exitSignal: 'S3', sections: 'T1, T2' });
    route('R7', { entrySignal: 'S1' , exitSignal: 'S2', points: 'W1:normal, W1:reverse, W9:normal, oops' });
    const issues = validateModel(l.model);
    const of = (rule: RuleId) => issues.filter((i) => i.rule === rule).map((i) => i.message);
    expect(of('route-endpoint')).toEqual(['Route R4: entry signal "B1" is a balise, not a signal']);
    expect(of('route-path')).toEqual([
      'Route R3: sections T2, T1 are not a continuous path from S1 to S3 (the drawing gives T1, T2)',
      'Route R5: No path from S2 to S1 in the signal direction',
    ]);
    expect(of('route-points')).toEqual([
      'Route R2 requires points W1 normal, but its path needs reverse',
      'Route R6 runs over points W1 but does not require a position (needs reverse)',
      'Route R7: points entry "oops" is not "<ID>:normal" or "<ID>:reverse"',
      'Route R7: points W1 is listed as both normal and reverse',
      'Route R7: points "W9" does not exist',
    ]);
    expect(issues.filter((i) => i.rule === 'missing-reference' && i.message.includes('B1'))).toEqual([]);
    expect(issues.some((i) => i.objectId === 'R1')).toBe(false);
  });
});

describe('snap to track', () => {
  const box = (cx: number, cy: number, w = 20, h = 20) => ({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });

  it('puts balises on the line and signals beside it on the side of their direction', () => {
    const l = smallLayout();
    const targets = snapTargets(l.objects());
    expect(targets.map((t) => t.o.id)).toEqual(['T1', 'T2']);
    // gap 10 between the 20x20 shape and the line (centre 20 below it)
    expect(computeSnap(box(110, 120), 'balise', '', targets)).toMatchObject({ x: 100, y: 90, target: { id: 'T1' } });
    // nominal (left to right): right-hand side = below the track
    expect(computeSnap(box(110, 120), 'signal', 'nominal', targets)).toMatchObject({ x: 100, y: 100 + SNAP_GAP, point: { x: 110, y: 100 } });
    expect(computeSnap(box(110, 120), 'signal', 'reverse', targets)).toMatchObject({ x: 100, y: 100 - 20 - SNAP_GAP });
    // too far (gap 20 > SNAP_RADIUS_PX), or a kind that does not snap
    expect(SNAP_RADIUS_PX).toBe(15);
    expect(computeSnap(box(110, 130), 'signal', 'nominal', targets)).toBeNull();
    expect(computeSnap(box(110, 150), 'signal', 'nominal', targets)).toBeNull();
    expect(computeSnap(box(110, 110), 'train', '', targets)).toBeNull();
    // the radius is in screen pixels: at zoom 2 it is 7.5 graph units
    expect(snapGapAtScale(2)).toBe(7.5);
    expect(computeSnap(box(110, 120), 'balise', '', targets, snapGapAtScale(2))).toBeNull();
    expect(computeSnap(box(110, 116), 'balise', '', targets, snapGapAtScale(2))).toMatchObject({ y: 90 });
    // vertical track: nominal = downwards, right-hand side = left (x smaller)
    const v = new Layout();
    v.line('track', { id: 'TV' }, [[100, 0], [100, 400]]);
    expect(computeSnap(box(110, 200), 'signal', 'nominal', snapTargets(v.objects()))).toMatchObject({ x: 100 - 20 - SNAP_GAP, y: 190 });
  });

  it('only snaps perpendicular to the track: never along it beyond an end', () => {
    const v = new Layout();
    v.line('track', { id: 'TE' }, [[100, 100], [400, 100]]);
    const targets = snapTargets(v.objects());
    // left of the start, right of the end (close to the end point, more than half the shape past
    // it): no snap; overlapping the end: snapped at the end
    expect(computeSnap(box(85, 100), 'balise', '', targets)).toBeNull();
    expect(computeSnap(box(420, 104), 'balise', '', targets)).toBeNull();
    expect(computeSnap(box(406, 104), 'balise', '', targets)).toMatchObject({ x: 390, y: 90 });
    // inside the track: moved straight down onto it (x unchanged)
    expect(computeSnap(box(102, 112), 'balise', '', targets)).toMatchObject({ x: 92, y: 90 });
  });

  it('snaps moved objects in the same undoable edit and sets track and km', () => {
    const graph = createTestGraph();
    try {
      const model = graph.getDataModel();
      const l = new Layout(model, graph.getDefaultParent());
      const commands = new GraphCommandService(graph);
      const uninstall = installSnapToTrack(graph, () => true);
      l.line('track', { id: 'T1', kmStart: '10', kmEnd: '10.6' }, [[0, 100], [600, 100]]);
      const s = l.obj('signal', { id: 'S1', direction: 'nominal' }, 100, 300);
      expect(s.getGeometry()!.y).toBe(300);
      graph.moveCells([s], 0, -190); // centre (110, 120): gap 10
      expect([s.getGeometry()!.x, s.getGeometry()!.y]).toEqual([100, 104]);
      expect(readAttr(s, 'rdTrackId')).toBe('T1');
      expect(readAttr(s, 'rdKm')).toBe('10.11');
      commands.undo();
      expect([s.getGeometry()!.x, s.getGeometry()!.y]).toEqual([100, 300]);
      expect(readAttr(s, 'rdTrackId')).toBe('');
      // placed clearly away from the track: stays where it was put
      graph.moveCells([s], 0, -150); // centre (110, 160): gap 50
      expect(s.getGeometry()!.y).toBe(150);
      expect(readAttr(s, 'rdTrackId')).toBe('');
      commands.undo();
      // Alt held: no snap
      setSnapAltDownForTest(true);
      graph.moveCells([s], 0, -190);
      expect(s.getGeometry()!.y).toBe(110);
      setSnapAltDownForTest(false);
      commands.undo();
      graph.moveCells([s], 0, -190);
      expect(s.getGeometry()!.y).toBe(104);
      // arrow-key nudges move exactly, also away from the line; km follows along the line
      graph.setSelectionCell(s);
      commands.nudge(0, 1);
      expect(s.getGeometry()!.y).toBe(105);
      commands.nudge(0, -1);
      commands.nudge(10, 0);
      expect([s.getGeometry()!.x, s.getGeometry()!.y]).toEqual([110, 104]);
      expect(readAttr(s, 'rdKm')).toBe('10.12');
      uninstall();
      commands.undo();
      graph.moveCells([s], 0, 6);
      expect(s.getGeometry()!.y).toBe(110);
    } finally {
      cleanupTestGraph(graph);
    }
  });
});

describe('km', () => {
  it('interpolates km along a track, formats chainage and recalculates objects', () => {
    const l = smallLayout();
    const t1 = kmScaleOf(l.byId('T1'))!;
    expect(kmAtPoint(t1, { x: 300, y: 110 })).toBe(10.3);
    expect(kmAtPoint(t1, { x: 300, y: 300 })).toBeNull();
    expect(formatChainage(10.3)).toBe('10+300');
    expect(formatChainage(-0.12)).toBe('-0+120');
    // reverse km direction
    const r = new Layout();
    r.line('track', { id: 'TR', kmStart: '5.4', kmEnd: '5' }, [[0, 0], [400, 0]]);
    expect(kmAtPoint(kmScaleOf(r.byId('TR'))!, { x: 100, y: 0 })).toBe(5.3);

    l.obj('balise', { id: 'B1', trackId: 'T1', km: '1' }, 244, 94, 12, 12); // centre x=250
    l.signal('S9', 'nominal', 450, 115);
    const updates = recalculateKm(l.objects());
    expect(updates.map((u) => [u.object.id, u.km, u.previous])).toEqual([['B1', '10.25', '1']]);
    const s9 = l.byId('S9');
    expect(s9.values.trackId).toBe('');

    const ticks = rulerTicks(t1);
    expect(ticks[0]).toMatchObject({ km: 10, point: { x: 0, y: 100 } });
    expect(ticks[ticks.length - 1]).toMatchObject({ km: 10.6, point: { x: 600, y: 100 } });
    expect(ticks.length).toBe(13);
    expect(ticks.filter((t) => t.major).map((t) => t.km)).toEqual([10, 10.25, 10.5, 10.6]);
  });

  it('simplifies route lines', () => {
    expect(simplifyLine([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 50 }])).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 150, y: 50 },
    ]);
  });
});

describe('formatPointsList', () => {
  it('formats in order', () => {
    expect(formatPointsList([{ id: 'W1', position: 'normal' }, { id: 'W2', position: 'reverse' }])).toBe('W1:normal, W2:reverse');
  });
});
