/**
 * railML 3.2 import: hand-written samples with and without visualization (data, symbols, layout,
 * routes), unknown content preserved through re-export, round trips export -> import -> export.
 */
import { describe, expect, it } from 'vitest';
import { GraphDataModel } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { ROUTES_LAYER_ID } from '../../railway/route-store';
import { centerOf, trackPolyline } from '../../railway/geometry';
import { collectObjects, validateModel } from '../../railway/validation';
import type { RailObject } from '../../railway/validation';
import { exportModelToDrawioXml, importDrawioXmlIntoModel, registerDrawioCodecs } from '../../services/drawio-xml';
import { exportRailml } from '../export';
import { importRailml } from '../import';
import { readPreserved } from '../preserve';
import { checkRailmlStructure } from '../structure';
import { looksLikeRailml, prettyXml } from '../xml';
import { all, ertmsEntries, fixture, parse, specLayout } from './helpers';

const DATE = '2026-01-01T00:00:00Z';

function objectsOf(model: GraphDataModel): Map<string, RailObject> {
  return new Map(collectObjects(model).map((o) => [`${o.kind.id}:${o.id}`, o]));
}

function get(model: GraphDataModel, key: string): RailObject {
  const o = objectsOf(model).get(key);
  if (!o) throw new Error(`no ${key}`);
  return o;
}

function nonEmpty(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
}

describe('import of a railML 3.2 sample without visualization', () => {
  const r = importRailml(fixture('station-topology.railml'), { symbols: ertmsEntries() });

  it('creates every object with its data', () => {
    expect(r.name).toBe('Station Arnau');
    expect(r.usedVisualization).toBe(false);
    expect(r.counts).toEqual({ track: 2, points: 1, signal: 3, balise: 2, axleCounter: 1, bufferStop: 2, levelCrossing: 1, baliseGroup: 1, trackSection: 1, route: 1 });
    const m = r.model;
    expect(nonEmpty(get(m, 'track:T01').values)).toEqual({ id: 'T01', name: 'Track 1', kmStart: '0', kmEnd: '1.5' });
    expect(nonEmpty(get(m, 'track:T02').values)).toEqual({ id: 'T02', name: 'Siding', length: '500' });
    expect(nonEmpty(get(m, 'points:68W01').values)).toEqual({ id: '68W01', hand: 'right', trackId: 'T01' });
    expect(nonEmpty(get(m, 'signal:68A').values)).toEqual({ id: '68A', signalType: 'main', direction: 'nominal', km: '0.1', trackId: 'T01', routes: 'R68A-N3' });
    expect(get(m, 'signal:N3').values.signalType).toBe('markerBoard');
    expect(nonEmpty(get(m, 'baliseGroup:BG11').values)).toMatchObject({ nidC: '353', nidBg: '4711', count: '2' });
    expect(nonEmpty(get(m, 'balise:B12').values)).toMatchObject({ groupId: 'BG11', position: '2', direction: 'nominal', trackId: 'T01' });
    expect(get(m, 'axleCounter:AC1').values.sections).toBe('A01T');
    expect(get(m, 'trackSection:A01T').values.sectionType).toBe('axleCounter');
    expect(get(m, 'levelCrossing:LC1').values.protection).toBe('halfBarriers');
    // A01T is not drawn (railML gives TVD sections no location): sections from the drawing
    expect(nonEmpty(get(m, 'route:R68A-N3').values)).toEqual({ id: 'R68A-N3', entrySignal: '68A', exitSignal: 'N3', points: '68W01:reverse', sections: 'T01, T02' });
  });

  it('draws a schematic layout: branch below the main track, signals on the right-hand side', () => {
    const m = r.model;
    const t1 = trackPolyline(get(m, 'track:T01').cell)!;
    const t2 = trackPolyline(get(m, 'track:T02').cell)!;
    expect(t1.every((p) => p.y === t1[0].y)).toBe(true);
    expect(t2[t2.length - 1].y).toBeGreaterThan(t1[0].y);
    expect(t1[0].x).toBeLessThan(t1[t1.length - 1].x);
    // nominal signals sit below their left-to-right track
    expect(centerOf(get(m, 'signal:68A').cell)!.y).toBeGreaterThan(t1[0].y);
    // balise and axle counter centred on the track
    expect(centerOf(get(m, 'axleCounter:AC1').cell)!.y).toBe(t1[0].y);
    // the track section has no location in railML: below the drawing
    expect(centerOf(get(m, 'trackSection:A01T').cell)!.y).toBeGreaterThan(t2[t2.length - 1].y);
  });

  it('uses the ERTMS library symbols and creates the route on the Routes layer', () => {
    const m = r.model;
    const signal = get(m, 'signal:68A').cell;
    // "Signal Right 3": a group with the lamp stencils
    expect(signal.getChildCount()).toBeGreaterThan(3);
    expect(String(signal.getStyle() && JSON.stringify(signal.getStyle()))).toContain('group');
    const route = get(m, 'route:R68A-N3').cell;
    expect(route.getParent()?.getId()).toBe(ROUTES_LAYER_ID);
    expect(route.isEdge()).toBe(true);
    const issues = validateModel(m);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.filter((i) => i.rule === 'route-points' || i.rule === 'route-endpoint')).toEqual([]);
  });

  it('keeps the content it does not show and writes it back on export', () => {
    expect(r.preserved).toBeGreaterThanOrEqual(15);
    const out = exportRailml(r.model, { date: DATE });
    const doc = parse(out.xml);
    expect(out.preserved.dropped).toBe(0);
    expect(checkRailmlStructure(doc)).toEqual([]);
    const id = (x: string): Element => all(doc, '*').find((e) => e.getAttribute('id') === x)!;
    // ids of the file are kept
    expect(['sig01', 'swi01', 'trc01', 'ne_a01', 'ne_a03', 'tvd01', 'rt01', 'swil01', 'sigil03'].every((x) => id(x))).toBe(true);
    expect(all(doc, 'operationalPoint')[0].getAttribute('id')).toBe('op01');
    expect(id('trc02').getAttribute('type')).toBe('sidingTrack');
    expect(id('lc01').getAttribute('activation')).toBe('trainAutomatic');
    expect(id('bus01').getAttribute('type')).toBe('fixedBufferStop');
    expect(id('sigil03').getAttribute('function')).toBe('exit');
    expect(id('swil01').getAttribute('preferredPosition')).toBe('left');
    expect(id('rt01').getAttribute('locksAutomatically')).toBe('false');
    expect(Array.from(id('sig02').children).map((c) => c.localName)).toEqual(['name', 'spotLocation', 'designator', 'isSpeedSignal', 'isTrainMovementSignal', 'signalConstruction']);
    // the route's railML TVD list is written back
    expect(all(id('rt01'), 'hasTvdSection').map((h) => h.getAttribute('ref'))).toEqual(['tvd01']);
    expect(Array.from(id('swi01').children).find((c) => c.localName === 'rightBranch')!.getAttribute('branchingSpeed')).toBe('40');
    expect(all(id('swi01'), 'designator').map((d) => d.getAttribute('register'))).toEqual(['_RailwayDrawer', 'DB']);
    expect(all(id('tvd01'), 'hasResetStrategy')).toHaveLength(1);
    // insulated rail joint: not an axle counter, kept as it was (its netElement id is kept too)
    expect(id('tde02').getAttribute('type')).toBe('insulatedRailJoint');
    expect(all(doc, 'timetable')).toHaveLength(1);
    expect(doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'subject')[0].textContent).toBe('Test sample');
  });

  it('keeps the preserved content on the diagram (root cell) through a .drawio save and load', () => {
    registerDrawioCodecs();
    const xml = exportModelToDrawioXml(r.model);
    expect(xml).toContain('rdRailml=');
    const m2 = new GraphDataModel();
    importDrawioXmlIntoModel(xml, m2);
    expect(readPreserved(m2).size).toBe(r.preserved);
    expect(exportRailml(m2, { date: DATE }).xml).toBe(exportRailml(r.model, { date: DATE }).xml);
  });
});

describe('import of a railML 3.2 sample with visualization', () => {
  const r = importRailml(fixture('station-visualization.railml'), { symbols: ertmsEntries() });

  it('places the objects at the screen coordinates', () => {
    expect(r.usedVisualization).toBe(true);
    const m = r.model;
    expect(centerOf(get(m, 'signal:68A').cell)).toEqual({ x: 50, y: 114 });
    expect(centerOf(get(m, 'bufferStop:BS2').cell)).toEqual({ x: 747, y: 180 });
    expect(trackPolyline(get(m, 'track:T01').cell)).toEqual([
      { x: 0, y: 100 },
      { x: 750, y: 100 },
    ]);
    // the diverging netElement is in track T02: a short points leg at the switch, the rest is the track
    const leg = trackPolyline(get(m, 'points:68W01').cell)!;
    expect(leg[0]).toEqual({ x: 500, y: 100 });
    expect(trackPolyline(get(m, 'track:T02').cell)!.at(-1)).toEqual({ x: 750, y: 180 });
    expect(get(m, 'route:R68A-N3').values.points).toBe('68W01:reverse');
    expect(validateModel(m).filter((i) => i.severity === 'error')).toEqual([]);
    // the projection of the (preserved) operational point is written back into our visualization
    const doc = parse(exportRailml(m, { date: DATE }).xml);
    const op = all(doc, 'spotElementProjection').find((p) => p.getAttribute('refersToElement') === 'op01')!;
    expect(op.parentElement!.getAttribute('id')).toBe('vis01');
    expect(checkRailmlStructure(doc)).toEqual([]);
  });
});

describe('round trips', () => {
  it('export -> import -> export of the spec layout is stable', () => {
    const first = exportRailml(specLayout().model, { title: 'Spec', date: DATE }).xml;
    const imported = importRailml(first, { symbols: ertmsEntries() });
    expect(imported.warnings).toEqual([]);
    const second = exportRailml(imported.model, { title: 'Spec', date: DATE }).xml;
    expect(second).toBe(first);
    // and the drawing has the same data
    // the points hand is derived from the geometry on export
    const before = collectObjects(specLayout().model).map((o) => [o.kind.id, nonEmpty(o.kind.id === 'points' ? { id: o.values.id, hand: 'right', position: o.values.position } : o.values)]);
    const after = collectObjects(imported.model).map((o) => [o.kind.id, nonEmpty(o.values)]);
    const sort = (x: Array<[string, Record<string, string>] | (string | Record<string, string>)[]>): string[] => x.map((e) => JSON.stringify(e)).sort();
    expect(sort(after)).toEqual(sort(before));
  });

  it('export -> import -> export of the pure railML (no extension) is stable and uses the library symbols', () => {
    const first = exportRailml(specLayout().model, { title: 'Spec', date: DATE, extension: false }).xml;
    const imported = importRailml(first, { symbols: ertmsEntries() });
    const signal = get(imported.model, 'signal:S1').cell as Cell;
    expect(signal.getChildCount()).toBeGreaterThan(3);
    const second = exportRailml(imported.model, { title: 'Spec', date: DATE, extension: false }).xml;
    expect(second).toBe(first);
  });

  it('import -> export -> import -> export of a foreign file is stable', () => {
    for (const name of ['station-topology.railml', 'station-visualization.railml']) {
      const a = exportRailml(importRailml(fixture(name), { symbols: ertmsEntries() }).model, { date: DATE }).xml;
      const b = exportRailml(importRailml(a, { symbols: ertmsEntries() }).model, { date: DATE }).xml;
      expect(b).toBe(a);
    }
  });

  it('imports without library symbols (built-in shapes)', () => {
    const r = importRailml(fixture('station-topology.railml'));
    expect(r.counts.signal).toBe(3);
    expect(get(r.model, 'signal:68A').cell.getChildCount()).toBe(0);
  });
});

describe('railML import errors and helpers', () => {
  it('rejects files that are not railML', () => {
    expect(() => importRailml('<mxfile/>')).toThrow(/Not a railML file/);
    expect(() => importRailml('<railML')).toThrow(/not well-formed/);
  });

  it('warns about another railML version and keeps its content', () => {
    const r = importRailml('<railML xmlns="https://www.railml.org/schemas/3.1" version="3.1"><infrastructure id="i"/></railML>');
    expect(r.warnings[0]).toMatch(/railML 3\.1/);
  });

  it('recognises railML text', () => {
    expect(looksLikeRailml('<?xml version="1.0"?>\n<!-- x --><railML version="3.2">')).toBe(true);
    expect(looksLikeRailml('<rail:railML xmlns:rail="x">')).toBe(true);
    expect(looksLikeRailml('<mxfile><diagram/></mxfile>')).toBe(false);
  });

  it('pretty-prints without changing the content', () => {
    const raw = '<a xmlns="u"><b x="1">text &amp; more</b><c/><d><e/></d></a>';
    const pretty = prettyXml(raw);
    expect(pretty).toContain('\n  <b x="1">text &amp; more</b>\n');
    const s = new XMLSerializer();
    expect(s.serializeToString(parse(pretty).documentElement).replace(/\s+</g, '<')).toBe(s.serializeToString(parse(raw).documentElement));
  });
});
