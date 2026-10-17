/**
 * Test helpers for the railML tests: a small layout builder (like routes.test.ts) and the ERTMS
 * library entries read from public/libraries/ertms.xml.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Cell, Geometry, GraphDataModel, Point } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import type { KindId } from '../../railway/catalogue';
import { buildDataValue } from '../../railway/object-data';
import { addRoute } from '../../railway/route-store';
import { findRoutePaths } from '../../railway/routes';
import { buildTopology } from '../../railway/topology';
import { collectObjects } from '../../railway/validation';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { parseDrawioStyle } from '../../services/drawio-xml';
import type { LibraryEntry } from '../../drawio-shapes/engine';

export class Layout {
  readonly model = new GraphDataModel();
  readonly layer: Cell = this.model.getRoot()!.getChildAt(0);
  private n = 0;

  obj(kind: KindId, values: Record<string, string>, cx: number, cy: number, w = 20, h = 20, style = 'triangle;whiteSpace=wrap;html=1;'): Cell {
    const cell = new Cell(buildDataValue('', { kind, values }), new Geometry(cx - w / 2, cy - h / 2, w, h), parseDrawioStyle(style));
    cell.setVertex(true);
    cell.setId(`c${++this.n}`);
    this.model.add(this.layer, cell);
    return cell;
  }

  line(kind: KindId, values: Record<string, string>, pts: Array<[number, number]>, style = 'endArrow=none;html=1;strokeWidth=4;'): Cell {
    const geo = new Geometry();
    geo.relative = true;
    geo.setTerminalPoint(new Point(pts[0][0], pts[0][1]), true);
    geo.setTerminalPoint(new Point(pts[pts.length - 1][0], pts[pts.length - 1][1]), false);
    geo.points = pts.slice(1, -1).map(([x, y]) => new Point(x, y));
    const cell = new Cell(buildDataValue('', { kind, values }), geo, parseDrawioStyle(style));
    cell.setEdge(true);
    cell.setId(`c${++this.n}`);
    this.model.add(this.layer, cell);
    return cell;
  }

  /** A route object like the Route tool creates (first path from entry to exit). */
  route(id: string, entry: string, exit: string): Cell {
    const objects = collectObjects(this.model);
    const e = objects.find((o) => o.id === entry)!;
    const x = objects.find((o) => o.id === exit)!;
    const path = findRoutePaths(buildTopology(objects), e, x).paths[0];
    if (!path) throw new Error(`no path ${entry} -> ${exit}`);
    const graph = { getDataModel: () => this.model } as unknown as Graph;
    return addRoute(graph, path, e, x, id);
  }
}

/**
 * The layout of the spec: tracks T1/T2, points W1 (T1 -> T2), signals S1, S2 on T1 and S3 on T2
 * (all nominal), balise group BG1 with B1/B2, axle counter AC1, track section TS1, route R1 S1 -> S3.
 *
 *   S1>   B1 B2   W1      AC1        S2>     T1 y=100, x 0..600, km 10.0-10.6
 *   =================*======================
 *                     \
 *                      *=================== S3>   T2 y=200, x 300..800, km 20.0-20.5
 */
export function specLayout(): Layout {
  const l = new Layout();
  l.line('track', { id: 'T1', name: 'Main line', kmStart: '10', kmEnd: '10.6' }, [[0, 100], [600, 100]]);
  l.line('track', { id: 'T2', kmStart: '20', kmEnd: '20.5' }, [[300, 200], [800, 200]]);
  l.line('points', { id: 'W1', position: 'normal' }, [[200, 100], [300, 200]], 'endArrow=none;html=1;strokeWidth=4;strokeColor=#a5a5a5;');
  l.obj('signal', { id: 'S1', signalType: 'main', direction: 'nominal', aspects: '3', trackId: 'T1', km: '10.05' }, 50, 114);
  l.obj('signal', { id: 'S2', signalType: 'main', direction: 'nominal', trackId: 'T1', km: '10.55' }, 550, 114);
  l.obj('signal', { id: 'S3', signalType: 'markerBoard', direction: 'nominal', trackId: 'T2', notes: 'Zażółć gęślą' }, 700, 214);
  l.obj('baliseGroup', { id: 'BG1', nidC: '353', nidBg: '1201', count: '2', direction: 'nominal' }, 100, 100, 40, 24, 'rounded=1;dashed=1;fillColor=none;');
  l.obj('balise', { id: 'B1', groupId: 'BG1', position: '1', direction: 'nominal', km: '10.09', trackId: 'T1' }, 90, 100, 12, 12);
  l.obj('balise', { id: 'B2', groupId: 'BG1', position: '2', direction: 'nominal', km: '10.11', trackId: 'T1' }, 110, 100, 12, 12);
  l.obj('trackSection', { id: 'TS1', sectionType: 'axleCounter', trackId: 'T1' }, 400, 100, 10, 12, 'group');
  l.obj('axleCounter', { id: 'AC1', sections: 'TS1', km: '10.4' }, 400, 100, 10, 10, 'ellipse;fillColor=#000000;');
  l.route('R1', 'S1', 'S3');
  return l;
}

let entries: LibraryEntry[] | null = null;

/** The ERTMS library entries (public/libraries/ertms.xml). */
export function ertmsEntries(): LibraryEntry[] {
  entries ??= parseMxLibrary(readFileSync(resolve(__dirname, '../../../public/libraries/ertms.xml'), 'utf8'));
  return entries;
}

export function fixture(name: string): string {
  return readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
}

export function parse(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/** Elements by local name in the railML namespace. */
export function all(doc: Document | Element, name: string): Element[] {
  return Array.from((doc as Element).getElementsByTagNameNS('https://www.railml.org/schemas/3.2', name));
}
