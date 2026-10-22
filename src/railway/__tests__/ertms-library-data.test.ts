/**
 * Railway data of the app's ERTMS library (public/libraries/ertms.xml, built by
 * scripts/ertms-library/build_app_library.py): palette elements carry their kind, every railway
 * symbol of the built-in templates is typed, each template track is covered by TVD section cells
 * (TC<n>), IDs are unique per template and renumbered on insert, routes are found on an inserted
 * template, and the railML export of every template places its objects, lists the TVD sections and
 * passes the structure checks; one export imported back keeps the kinds.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Graph } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { registerDrawioCodecs } from '../../services/drawio-xml';
import { splitErtmsLibrary } from '../../ui/templates';
import { insertTemplate } from '../../ui/templates/template-actions';
import type { DiagramTemplate } from '../../ui/templates/template-types';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { exportRailml } from '../../railml/export';
import { importRailml } from '../../railml/import';
import { checkRailmlStructure } from '../../railml/structure';
import { kindForLibraryTitle } from '../catalogue';
import { findRoutePaths } from '../routes';
import { getCellKind } from '../object-data';
import { buildTopology, linkLine, projectPoint } from '../topology';
import type { RailObject } from '../validation';
import { collectObjects, validateModel } from '../validation';

const ROOT = resolve(__dirname, '../../..');
const LIBRARY = readFileSync(resolve(ROOT, 'public/libraries/ertms.xml'), 'utf8');
const entries = parseMxLibrary(LIBRARY);
const { elements, templates } = splitErtmsLibrary(entries);

beforeAll(() => {
  registerDrawioCodecs();
  const proto = (globalThis as unknown as { SVGElement: { prototype: { getBBox?: () => unknown } } }).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
});

let graphs: Graph[] = [];
afterEach(() => {
  graphs.forEach(cleanupTestGraph);
  graphs = [];
});

function graphWith(...tpls: DiagramTemplate[]): Graph {
  const graph = createTestGraph();
  graphs.push(graph);
  tpls.forEach((t, i) => insertTemplate(graph, t, { x: 600, y: 300 + i * 400 }));
  return graph;
}

function doc(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/** Railway objects (object/UserObject elements with rdKind) of a model XML. */
function objectsOf(xml: string): Element[] {
  return Array.from(doc(xml).querySelectorAll('object[rdKind], UserObject[rdKind]'));
}

describe('ERTMS palette elements carry their railway data', () => {
  it('every titled element with a railway meaning stores its kind and preset values, no ID', () => {
    let typed = 0;
    for (const { entry } of elements) {
      const preset = kindForLibraryTitle(entry.title);
      const objs = objectsOf(entry.xml!);
      if (!preset) {
        expect(objs, entry.title).toEqual([]);
        continue;
      }
      typed++;
      expect(objs, entry.title).toHaveLength(1);
      expect(objs[0].getAttribute('rdKind')).toBe(preset.kind);
      for (const [key, value] of Object.entries(preset.values ?? {})) {
        expect(objs[0].getAttribute(`rd${key[0].toUpperCase()}${key.slice(1)}`), `${entry.title} ${key}`).toBe(value);
      }
      expect(objs[0].getAttribute('rdId')).toBeNull();
    }
    expect(typed).toBe(11);
  });
});

describe('ERTMS templates: railway symbols typed, tracks split into TVD sections', { timeout: 120_000 }, () => {
  it('signals, balises, balise groups, trains, tracks, points and sections are typed with unique IDs', () => {
    for (const t of templates) {
      const d = doc(t.xml);
      const objs = objectsOf(t.xml);
      const ids = objs.map((o) => `${o.getAttribute('rdKind')}:${(o.getAttribute('rdId') ?? '').toUpperCase()}`);
      expect(new Set(ids).size, t.name).toBe(ids.length);
      expect(objs.every((o) => (o.getAttribute('rdId') ?? '') !== ''), t.name).toBe(true);
      // every signal head group is a typed signal (direction, aspects)
      const signalGroups = Array.from(d.querySelectorAll('mxCell[parent="1"]')).filter((c) => /(^|;)group(;|$)/.test(c.getAttribute('style') ?? ''));
      for (const o of objs.filter((x) => x.getAttribute('rdKind') === 'signal')) {
        expect(['nominal', 'reverse'], t.name).toContain(o.getAttribute('rdDirection'));
        expect(Number(o.getAttribute('rdAspects')), t.name).toBeGreaterThanOrEqual(2);
        expect(['main', 'shunting'], t.name).toContain(o.getAttribute('rdSignalType'));
      }
      expect(signalGroups.length + objs.length).toBeGreaterThan(0);
      const kinds = new Set(objs.map((o) => o.getAttribute('rdKind')));
      for (const kind of ['track', 'trackSection', 'signal', 'train']) expect(kinds.has(kind), `${t.name}: ${kind}`).toBe(true);
      // every 12x12 triangle is a balise; balises of a group point at a typed group
      const groups = new Set(objs.filter((o) => o.getAttribute('rdKind') === 'baliseGroup').map((o) => o.getAttribute('rdId')));
      for (const o of objs.filter((x) => x.getAttribute('rdKind') === 'balise')) {
        const g = o.getAttribute('rdGroupId');
        if (g) expect(groups.has(g), `${t.name} ${o.getAttribute('rdId')}`).toBe(true);
      }
      // every 12x12 triangle on a track (within 40 px) is a balise; others are legend symbols
      const graph = graphWith(t);
      const objects = collectObjects(graph.getDataModel());
      const lines = objects.filter((o) => o.kind.id === 'track').map((o) => linkLine(o)!);
      for (const cell of graph.getDefaultParent().children ?? []) {
        const style = cell.getStyle() as Record<string, unknown> | null;
        const g = cell.getGeometry();
        if (!cell.isVertex() || !g || g.width !== 12 || g.height !== 12 || !JSON.stringify(style ?? {}).includes('triangle')) continue;
        const c = { x: g.x + 6, y: g.y + 6 };
        if (lines.some((l) => projectPoint(c, l).distance <= 40)) expect(getCellKind(cell), t.name).toBe('balise');
      }
      // no state is stored in the library (defaults free/stop/normal are implied)
      expect(t.xml).not.toMatch(/rdState=|rdAspect=/);
    }
  });

  it('every balise belongs to a balise group; balises without a BG label are grouped on their function label', () => {
    for (const t of templates) {
      const objs = objectsOf(t.xml);
      const groups = objs.filter((o) => o.getAttribute('rdKind') === 'baliseGroup');
      for (const o of objs.filter((x) => x.getAttribute('rdKind') === 'balise')) {
        expect(o.getAttribute('rdGroupId'), `${t.name} ${o.getAttribute('rdId')}`).toBeTruthy();
      }
      // NID_BG = the number of the group ID; NID_C comes from the diagram default (not pinned)
      for (const g of groups) {
        expect(g.getAttribute('rdNidBg'), `${t.name} ${g.getAttribute('rdId')}`).toBe(/^BG(\d+)$/.exec(g.getAttribute('rdId') ?? '')?.[1]);
        expect(g.hasAttribute('rdNidC')).toBe(false);
      }
    }
    // the level transition templates (L1 -> L2 and staff responsible) had balises without BG labels:
    // one group per balise on its function label; neighbouring balises are not merged (LTA / infill)
    const groupsOf = (t: DiagramTemplate): string[] =>
      objectsOf(t.xml)
        .filter((o) => o.getAttribute('rdKind') === 'baliseGroup')
        .map((o) => `${o.getAttribute('rdId')}:${(o.getAttribute('label') ?? '').replace(/<[^>]+>/g, '')}:${o.getAttribute('rdCount')}${o.getAttribute('rdFunction') ? `:${o.getAttribute('rdFunction')}` : ''}`)
        .sort();
    const transitions = templates.filter((t) => t.name.startsWith('Level transition L1 → L2'));
    expect(transitions.map((t) => t.name).sort()).toEqual(['Level transition L1 → L2', 'Level transition L1 → L2, staff responsible']);
    for (const t of transitions) expect(groupsOf(t), t.name).toEqual(['BG1:S2_BG:1', 'BG2:LTA:1', 'BG3:S4_infill:1:infill', 'BG4:LTO:1']);
    // checks: no balise without group, no required NID_C warning (diagram default 510)
    for (const t of templates) {
      const issues = validateModel(graphWith(t).getDataModel());
      expect(issues.filter((i) => i.rule === 'balise-without-group' || (i.rule === 'required' && i.field === 'nidC')).map((i) => i.message), t.name).toEqual([]);
    }
  });

  it('every template track is covered by section cells (TC<n>, typed, on the track, end to end)', () => {
    for (const t of templates) {
      const graph = graphWith(t);
      const objects = collectObjects(graph.getDataModel());
      const tracks = objects.filter((o) => o.kind.id === 'track');
      const sections = objects.filter((o) => o.kind.id === 'trackSection');
      expect(tracks.length, t.name).toBeGreaterThan(0);
      expect(new Set(sections.map((s) => s.id)).size, t.name).toBe(sections.length);
      expect(sections.every((s) => /^TC\d+$/.test(s.id)), t.name).toBe(true);
      for (const track of tracks) {
        const line = linkLine(track)!;
        expect(line, `${t.name} ${track.id}`).toBeTruthy();
        const xs = [line[0].x, line[line.length - 1].x].sort((a, b) => a - b);
        const own = sections
          .filter((s) => s.values.trackId === track.id)
          .map((s) => linkLine(s)!)
          .map((l) => [Math.min(l[0].x, l[1].x), Math.max(l[0].x, l[1].x), l[0].y] as const)
          .sort((a, b) => a[0] - b[0]);
        expect(own.length, `${t.name} ${track.id}`).toBeGreaterThanOrEqual(1);
        expect(own[0][0], `${t.name} ${track.id} start`).toBeCloseTo(xs[0], 1);
        expect(own[own.length - 1][1], `${t.name} ${track.id} end`).toBeCloseTo(xs[1], 1);
        for (let i = 1; i < own.length; i++) expect(own[i][0], `${t.name} ${track.id} joint ${i}`).toBeCloseTo(own[i - 1][1], 1);
        for (const s of own) expect(s[2]).toBeCloseTo(line[0].y, 1);
      }
      // the topology sees the sections on the tracks (not as separate links)
      const topo = buildTopology(objects);
      const named = new Set(topo.pieces.map((p) => p.sectionId).filter(Boolean));
      for (const s of sections) expect(named.has(s.id), `${t.name} ${s.id}`).toBe(true);
    }
  });

  it('routes are found between signals of an inserted template', () => {
    let withRoutes = 0;
    for (const t of templates) {
      const objects = collectObjects(graphWith(t).getDataModel());
      const topo = buildTopology(objects);
      const signals = objects.filter((o) => o.kind.id === 'signal');
      let found = false;
      for (const a of signals) {
        for (const b of signals) {
          if (a === b || found) continue;
          if (findRoutePaths(topo, a, b).paths.length > 0) found = true;
        }
      }
      if (found) withRoutes++;
    }
    expect(withRoutes).toBeGreaterThanOrEqual(Math.ceil(templates.length / 2));
  });

  it('inserting a template twice renumbers its IDs and keeps the references inside each copy', () => {
    const t = templates.find((x) => objectsOf(x.xml).some((o) => o.getAttribute('rdGroupId')))!;
    const graph = graphWith(t, t);
    const objects = collectObjects(graph.getDataModel());
    const keys = objects.map((o) => `${o.kind.id}:${o.id.toUpperCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    const byId = new Map(objects.map((o) => [`${o.kind.id}:${o.id}`, o]));
    for (const o of objects) {
      if (o.kind.id === 'balise' && o.values.groupId) {
        const group = byId.get(`baliseGroup:${o.values.groupId}`);
        expect(group).toBeTruthy();
        // the group of the same copy (close by), not of the other one
        const gy = group!.cell.getGeometry()!.y;
        expect(Math.abs(gy - o.cell.getGeometry()!.y)).toBeLessThan(200);
      }
      if (o.kind.id === 'trackSection') expect(byId.get(`track:${o.values.trackId}`), o.id).toBeTruthy();
    }
  });
});

describe('railML export of the templates', { timeout: 120_000 }, () => {
  it('places every infrastructure object, lists the TVD sections and passes the structure checks', () => {
    const unplacedAll: string[] = [];
    for (const t of templates) {
      const graph = graphWith(t);
      const model = graph.getDataModel();
      const objects = collectObjects(model);
      const r = exportRailml(model, { title: t.name, date: '2026-10-22' });
      expect(checkRailmlStructure(r.doc), t.name).toEqual([]);
      // only trains have no railML 3.2 element (LEU/train: rd extension only)
      expect(r.extensionOnly.filter((p) => p.kind !== 'train').map((p) => `${p.kind} ${p.id}: ${p.message}`), t.name).toEqual([]);
      const sections = objects.filter((o) => o.kind.id === 'trackSection').length;
      expect(r.counts.tvdSection ?? 0, t.name).toBe(sections);
      unplacedAll.push(...r.unplaced.map((p) => `${t.name}: ${p.kind} ${p.id}`));
    }
    expect(unplacedAll).toEqual([]);
  });

  it('a template exported to railML and imported back keeps its kinds', () => {
    const t = templates[0];
    const before = collectObjects(graphWith(t).getDataModel());
    const r = exportRailml(graphs[0].getDataModel(), { title: t.name, date: '2026-10-22' });
    const back = importRailml(r.xml);
    const count = (objs: RailObject[] | Partial<Record<string, number>>, kind: string): number =>
      Array.isArray(objs) ? objs.filter((o) => o.kind.id === kind).length : (objs[kind] ?? 0);
    for (const kind of ['signal', 'balise', 'baliseGroup', 'track', 'trackSection', 'points']) {
      expect(count(back.counts, kind), kind).toBe(count(before, kind));
    }
    const ids = (objs: RailObject[], kind: string): string[] => objs.filter((o) => o.kind.id === kind).map((o) => o.id).sort();
    const after = collectObjects(back.model);
    expect(ids(after, 'signal')).toEqual(ids(before, 'signal'));
    expect(ids(after, 'trackSection')).toEqual(ids(before, 'trackSection'));
  });
});

