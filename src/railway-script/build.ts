/**
 * @file build.ts
 * @brief Railway Script model -> a scratch draw.io model with the generated drawing: tracks,
 *        points legs and section lines as edges, objects with the ERTMS library symbols (or the
 *        same fallback shapes as the railML import, src/railway/schematic.ts), balise group boxes,
 *        and the routes on the Routes layer (paths found with routes.ts through the drawn
 *        topology). Every generated top cell carries `rdScript="<kind>:<id>"` and
 *        `rdScriptShape` (which symbol/style it was made with) next to its rd* data.
 */
import { Cell, GraphDataModel } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import { formatStoredNumber, getKind } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { ID_PLACEHOLDER, buildDataValue } from '../railway/object-data';
import { ensureRoutesLayer, routeEdgeStyle, routeGeometry } from '../railway/route-store';
import type { RoutePath } from '../railway/routes';
import { findRoutePaths, formatPointsList } from '../railway/routes';
import { buildTopology } from '../railway/topology';
import { collectObjects, indexObjects } from '../railway/validation';
import type { LibraryEntry } from '../drawio-shapes/engine';
import { BALISE_GROUP_STYLE, ModelBuilder, SECTION_LINE_STYLE, Symbols, defaultSize, fallbackStyle } from '../railway/schematic';
import { BOARD_SIGNAL_TYPES } from '../railway/symbol-sizes';
import { importDrawioXmlIntoModel, registerDrawioCodecs } from '../services/drawio-xml';
import type { Layout, LayoutIssue } from './layout';
import { centreOnTrack, layoutScript } from './layout';
import type { BaliseGroupObject, ScriptModel, ScriptObject } from './model';

/** Attribute naming the script object a generated cell belongs to. */
export const SCRIPT_ATTR = 'rdScript';
/** Attribute naming the symbol/style a generated cell was made with (a change replaces the cell). */
export const SCRIPT_SHAPE_ATTR = 'rdScriptShape';

export interface BuildResult {
  model: GraphDataModel;
  layout: Layout;
  issues: LayoutIssue[];
  counts: Partial<Record<KindId, number>>;
}

/** Cell id of a generated object (stable across applies). */
export function scriptCellId(key: string): string {
  return `rs-${key.replace(/[^A-Za-z0-9_.:-]/g, '_')}`;
}


function dataAttrs(o: ScriptObject, shape: string): Record<string, string> {
  const def = getKind(o.kind)!;
  const attrs: Record<string, string> = { rdKind: o.kind };
  for (const f of def.fields) {
    const v = o.values[f.key];
    if (v !== undefined && v !== '') attrs[f.attr] = v;
  }
  for (const [k, v] of Object.entries(o.attrs)) if (v !== '') attrs[k] = v;
  attrs[SCRIPT_ATTR] = o.key;
  attrs[SCRIPT_SHAPE_ATTR] = shape;
  return attrs;
}

function count(counts: Partial<Record<KindId, number>>, k: KindId): void {
  counts[k] = (counts[k] ?? 0) + 1;
}

export function buildScriptModel(model: ScriptModel, entries: LibraryEntry[]): BuildResult {
  const layout = layoutScript(model);
  const issues = [...layout.issues];
  const symbols = new Symbols(entries);
  const b = new ModelBuilder('rs');
  const counts: Partial<Record<KindId, number>> = {};

  // tracks
  for (const t of model.tracks) {
    const g = layout.tracks.get(t)!;
    let style = symbols.trackStyle();
    if (t.siding) style = style.replace(/strokeWidth=[\d.]+/, 'strokeWidth=3');
    b.useId(scriptCellId(t.key));
    b.edge(dataAttrs(t, t.siding ? 'track:siding' : 'track'), style, [g.start, g.end]);
    count(counts, 'track');
  }
  // points legs, section lines
  for (const o of model.objects) {
    if (o.kind === 'points') {
      const leg = layout.legs.get(o as never);
      if (!leg) continue;
      b.useId(scriptCellId(o.key));
      b.edge(dataAttrs(o, 'points'), symbols.pointsStyle(), leg);
      count(counts, 'points');
    } else if (o.kind === 'trackSection') {
      const line = layout.sections.get(o as never);
      if (!line) continue;
      b.useId(scriptCellId(o.key));
      b.edge({ ...dataAttrs(o, 'section'), label: ID_PLACEHOLDER, placeholders: '1' }, `${SECTION_LINE_STYLE}verticalAlign=bottom;labelBackgroundColor=none;fontSize=9;fontColor=#0050ef;`, line);
      count(counts, 'trackSection');
    }
  }
  // spot objects
  const centres = new Map<ScriptObject, Pt>();
  const parking: ScriptObject[] = [];
  for (const o of model.objects) {
    if (o.kind === 'points' || o.kind === 'trackSection' || o.kind === 'baliseGroup') continue;
    const at = layout.onTrack.get(o);
    const sym = symbols.forItem(o);
    const size = sym ? { w: sym.w, h: sym.h } : (([w, h]) => ({ w, h }))(defaultSize(o.kind, o.values.signalType));
    let c: Pt | null = at ? centreOnTrack(o.kind, o.values.direction ?? o.attrs.rdDirection ?? '', at, size, model.page.laneSpacing) : null;
    if (o.x !== undefined || o.y !== undefined) c = { x: o.x ?? c?.x ?? 0, y: o.y ?? c?.y ?? 0 };
    if (!c) {
      parking.push(o);
      continue;
    }
    centres.set(o, c);
    place(o, c, sym, size);
  }
  function place(o: ScriptObject, c: Pt, sym: ReturnType<Symbols['forItem']>, size: { w: number; h: number }): void {
    b.useId(scriptCellId(o.key));
    if (sym) {
      const board = o.kind === 'signal' && BOARD_SIGNAL_TYPES.has(o.values.signalType ?? '');
      // a marker board shows its ID above (as the former plain marker shape)
      const label: Record<string, string> = board ? { label: ID_PLACEHOLDER, placeholders: '1' } : {};
      b.symbol(sym, { ...dataAttrs(o, `symbol:${symbols.titleFor(o) ?? ''}`), ...label }, c, o.id);
    } else {
      b.vertex(dataAttrs(o, `shape:${o.kind}:${o.values.signalType ?? ''}`), fallbackStyle(o.kind), c, size, true);
    }
    count(counts, o.kind);
  }
  // balise groups around their balises
  for (const o of model.objects) {
    if (o.kind !== 'baliseGroup') continue;
    const g = o as BaliseGroupObject;
    const pts = g.members.map((m) => centres.get(m)).filter((p): p is Pt => !!p);
    const at = layout.onTrack.get(g);
    let c: Pt | null = at ? at.point : null;
    let size = { w: 24, h: 24 };
    if (pts.length > 0) {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      size = { w: Math.max(...xs) - Math.min(...xs) + 24, h: Math.max(...ys) - Math.min(...ys) + 24 };
      c = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 };
    }
    if (g.x !== undefined || g.y !== undefined) c = { x: g.x ?? c?.x ?? 0, y: g.y ?? c?.y ?? 0 };
    if (!c) {
      parking.push(g);
      continue;
    }
    b.useId(scriptCellId(g.key));
    b.vertex(dataAttrs(g, 'baliseGroup'), BALISE_GROUP_STYLE, c, size, true, true);
    count(counts, 'baliseGroup');
  }
  // objects without a place: a row below the drawing
  if (parking.length > 0) {
    const y = b.maxY() + 80;
    parking.forEach((o, i) => {
      const sym = symbols.forItem(o);
      const size = sym ? { w: sym.w, h: sym.h } : (([w, h]) => ({ w, h }))(defaultSize(o.kind, o.values.signalType));
      place(o, { x: model.page.originX + 30 + i * 80, y }, sym, size);
    });
  }

  registerDrawioCodecs();
  const scratch = new GraphDataModel();
  importDrawioXmlIntoModel(b.toXml(), scratch);

  // routes through the drawn topology
  if (model.routes.length > 0) {
    const objects = collectObjects(scratch);
    const index = indexObjects(objects);
    const topo = buildTopology(objects);
    scratch.beginUpdate();
    try {
      const layer = ensureRoutesLayer(scratch);
      for (const r of model.routes) {
        const entry = index.get('signal')?.get(r.from.toUpperCase());
        const exit = index.get('signal')?.get(r.to.toUpperCase());
        const values: Record<string, string> = { ...r.values };
        let line: Pt[] | null = null;
        if (entry && exit) {
          const paths = findRoutePaths(topo, entry, exit, { maxPaths: 16 }).paths;
          const path = choosePath(paths, r.via, r.sections);
          if (path) {
            line = path.line;
            values.points = formatPointsList(path.points);
            values.sections = path.sections.join(', ');
            values.overlap = path.overlap.join(', ');
            values.length = formatStoredNumber(Math.round(path.metres));
          } else {
            const a = entry.cell.getGeometry();
            const z = exit.cell.getGeometry();
            if (a && z) line = [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }, { x: z.x + z.width / 2, y: z.y + z.height / 2 }];
            issues.push({
              severity: 'warning',
              path: r.path,
              message: `Route ${r.id}: no path from ${r.from} to ${r.to}${r.via?.length ? ` via ${formatPointsList(r.via)}` : ''} in the drawing (signal directions, points); drawn as a straight line`,
            });
            if (r.via) values.points = formatPointsList(r.via);
          }
        }
        if (r.overlap) values.overlap = r.overlap.join(', ');
        if (r.sections && !values.sections) values.sections = r.sections.join(', ');
        const value = buildDataValue('', { kind: 'route', values }) as Element;
        value.setAttribute('label', ID_PLACEHOLDER);
        value.setAttribute('placeholders', '1');
        value.setAttribute(SCRIPT_ATTR, r.key);
        value.setAttribute(SCRIPT_SHAPE_ATTR, 'route');
        const edge = new Cell(value, routeGeometry(line ?? [{ x: 0, y: 0 }, { x: 40, y: 0 }]), routeEdgeStyle());
        edge.setEdge(true);
        edge.setId(scriptCellId(r.key));
        scratch.add(layer, edge);
        count(counts, 'route');
      }
    } finally {
      scratch.endUpdate();
    }
  }
  return { model: scratch, layout, issues, counts };
}

function choosePath(paths: RoutePath[], via: ScriptModel['routes'][number]['via'], sections: string[] | null): RoutePath | null {
  let list = paths;
  if (via && via.length > 0) {
    list = list.filter((p) => via.every((v) => p.points.some((q) => q.id.toUpperCase() === v.id.toUpperCase() && q.position === v.position)));
  }
  if (sections && sections.length > 0) {
    const want = sections.map((s) => s.toUpperCase()).join(',');
    const exact = list.find((p) => p.sections.map((s) => s.toUpperCase()).join(',') === want);
    if (exact) return exact;
  }
  return list[0] ?? null;
}
