/**
 * Small railway layouts for the interlocking and rule-check tests (1 drawing unit = 1 m).
 */
import { Cell, Geometry, GraphDataModel, Point } from '@maxgraph/core';
import type { KindId } from '../catalogue';
import { buildDataValue } from '../object-data';
import { collectObjects } from '../validation';
import type { RailObject } from '../validation';
import { buildTopology } from '../topology';
import { findRoutePaths, routeValues } from '../routes';

export class Layout {
  readonly model = new GraphDataModel();
  readonly layer: Cell = this.model.getRoot()!.getChildAt(0);
  private n = 0;

  obj(kind: KindId, values: Record<string, string>, x = 0, y = 0, w = 20, h = 20): Cell {
    const cell = new Cell(buildDataValue('', { kind, values }), new Geometry(x, y, w, h), {});
    cell.setVertex(true);
    cell.setId(`c${++this.n}`);
    this.model.add(this.layer, cell);
    return cell;
  }

  signal(id: string, direction: string, cx: number, cy: number, extra: Record<string, string> = {}): Cell {
    return this.obj('signal', { id, direction, ...extra }, cx - 10, cy - 10);
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

  /** A route object along the first path found between the signals (like the Route tool). */
  route(id: string, from: string, to: string, pick = 0): Cell {
    const objects = this.objects();
    const entry = objects.find((o) => o.id === from)!;
    const exit = objects.find((o) => o.id === to)!;
    const found = findRoutePaths(buildTopology(objects), entry, exit);
    const path = found.paths[pick];
    if (!path) throw new Error(`no path ${from} -> ${to}: ${found.problem}`);
    return this.obj('route', { id, ...routeValues(path, entry, exit) });
  }
}

/**
 * Single points station (1 unit = 1 m):
 *   S1>       W1                S2>
 *   T1 =========*======================  y=100, x 0..600
 *                \
 *   T2            *====================  y=200, x 300..800, S3> at x=700
 */
export function stationLayout(): Layout {
  const l = new Layout();
  l.line('track', { id: 'T1', length: '600' }, [[0, 100], [600, 100]]);
  l.line('track', { id: 'T2', length: '500' }, [[300, 200], [800, 200]]);
  l.line('points', { id: 'W1' }, [[200, 100], [300, 200]]);
  l.signal('S1', 'nominal', 50, 115);
  l.signal('S2', 'nominal', 550, 115);
  l.signal('S3', 'nominal', 700, 215);
  return l;
}

/**
 * Crossover W1 (on T1) / W2 (on T2) between two parallel tracks:
 *   S1>        W1                     S2>
 *   T1 ==========*=========================  y=100
 *                  \
 *   S3>             \ W2              S4>
 *   T2 ===============*====================  y=200
 */
export function crossoverLayout(): Layout {
  const l = new Layout();
  l.line('track', { id: 'T1', length: '800' }, [[0, 100], [800, 100]]);
  l.line('track', { id: 'T2', length: '800' }, [[0, 200], [800, 200]]);
  l.line('points', { id: 'W1' }, [[300, 100], [350, 150]]);
  l.line('points', { id: 'W2' }, [[350, 150], [400, 200]]);
  l.signal('S1', 'nominal', 50, 115);
  l.signal('S2', 'nominal', 700, 115);
  l.signal('S3', 'nominal', 50, 215);
  l.signal('S4', 'nominal', 700, 215);
  return l;
}

/**
 * Opposing routes on T1, a separate parallel track T2:
 *   T1  S1>      <S4       S3>       <S2      y=100
 *   T2                <S6            <S5      y=300
 */
export function opposingLayout(): Layout {
  const l = new Layout();
  l.line('track', { id: 'T1', length: '800' }, [[0, 100], [800, 100]]);
  l.line('track', { id: 'T2', length: '800' }, [[0, 300], [800, 300]]);
  l.signal('S1', 'nominal', 50, 115);
  l.signal('S3', 'nominal', 500, 115);
  l.signal('S2', 'reverse', 750, 85);
  l.signal('S4', 'reverse', 300, 85);
  l.signal('S5', 'reverse', 750, 285);
  l.signal('S6', 'reverse', 300, 285);
  return l;
}
