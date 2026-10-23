/**
 * Configurable rule checks (rule-checks.ts): every rule with a passing and a failing fixture,
 * drawings without km/length (skipped with a note), the settings (defaults, parsing, only the
 * differences stored, draw.io round trip, undo), validateModel integration, and the built-in
 * ERTMS templates run through all rules without crashing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Graph } from '@maxgraph/core';
import { GraphDataModel, UndoManager, InternalEvent } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { exportModelToDrawioXml, importDrawioXmlIntoModel, registerDrawioCodecs } from '../../services/drawio-xml';
import { splitErtmsLibrary } from '../../ui/templates';
import { insertTemplate } from '../../ui/templates/template-actions';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { Layout, stationLayout } from './layouts';
import { checkRules } from '../rule-checks';
import type { RuleSetId, RuleSettings } from '../rule-settings';
import { RULE_DEFS, RULE_SETTINGS_ATTR, defaultRuleSettings, parseRuleSettings, readRuleSettings, serializeRuleSettings, setRuleSettings } from '../rule-settings';
import { collectObjects, validateModel, validateModelReport } from '../validation';

/** Only rule `id` enabled, with these parameters. */
function only(id: RuleSetId, params: Record<string, number | string> = {}): RuleSettings {
  const s = defaultRuleSettings();
  for (const d of RULE_DEFS) s[d.id].enabled = d.id === id;
  Object.assign(s[id].params, params);
  return s;
}

const run = (l: Layout, id: RuleSetId, params: Record<string, number | string> = {}) => checkRules(l.objects(), only(id, params));
const messages = (l: Layout, id: RuleSetId, params: Record<string, number | string> = {}): string[] => run(l, id, params).issues.map((i) => i.message);

/** One straight track T1 (x 0..1000, y=100; 1 unit = 1 m unless `scaled` is false). */
function straight(scaled = true): Layout {
  const l = new Layout();
  l.line('track', scaled ? { id: 'T1', length: '1000' } : { id: 'T1' }, [[0, 100], [1000, 100]]);
  return l;
}

const bg = (l: Layout, id: string, x: number, extra: Record<string, string> = {}) => l.obj('baliseGroup', { id, ...extra }, x - 6, 94, 12, 12);
const ac = (l: Layout, id: string, x: number) => l.obj('axleCounter', { id }, x - 5, 95, 10, 10);

describe('rule: balise group in front of a signal', () => {
  it('passes within [min, max] in rear of the signal, fails beyond max and without a group', () => {
    const l = straight();
    l.signal('S1', 'nominal', 500, 115);
    bg(l, 'BG1', 470);
    l.signal('S2', 'nominal', 900, 115);
    bg(l, 'BG2', 750);
    expect(messages(l, 'bg-signal-distance')).toEqual(['Balise group BG2 is 150 m in rear of signal S2; rule: 0 m–50 m']);
    expect(messages(l, 'bg-signal-distance', { max: 200 })).toEqual([]);
    expect(messages(l, 'bg-signal-distance', { min: 40, max: 200 })).toEqual(['Balise group BG1 is 30 m in rear of signal S1; rule: 40 m–200 m']);
    const m = straight();
    m.signal('S1', 'nominal', 500, 115);
    bg(m, 'BG9', 600); // beyond the signal: not in front of it
    expect(messages(m, 'bg-signal-distance')).toEqual(['Signal S1 has no balise group in rear (on its approach up to the previous signal); rule: 0 m–50 m in front of the signal']);
    const issue = run(l, 'bg-signal-distance').issues[0];
    expect(issue).toMatchObject({ severity: 'warning', rule: 'bg-signal-distance', objectId: 'S2', related: [{ label: 'BG2' }] });
  });

  it('without km/length: skipped with a note; with km of both objects: measured', () => {
    const l = straight(false);
    l.signal('S1', 'nominal', 500, 115);
    bg(l, 'BG1', 400);
    const r = run(l, 'bg-signal-distance');
    expect(r.issues).toEqual([]);
    expect(r.notes.map((n) => n.message)).toEqual([expect.stringMatching(/^Balise group in front of a signal: skipped for S1 \(no km or track length/)]);
    const k = straight(false);
    k.signal('S1', 'nominal', 500, 115, { km: '10.5', trackId: 'T1' });
    bg(k, 'BG1', 400, { km: '10.47', trackId: 'T1' });
    expect(run(k, 'bg-signal-distance')).toEqual({ issues: [], notes: [] });
  });

  it('no balise groups in the drawing: a note', () => {
    const l = straight();
    l.signal('S1', 'nominal', 500, 115);
    expect(run(l, 'bg-signal-distance').notes.map((n) => n.message)).toEqual(['Balise group in front of a signal: the drawing has no balise groups']);
  });
});

describe('rule: balise order within a group', () => {
  const layout = (positions: Array<[number, string]>, direction: string): Layout => {
    const l = straight();
    bg(l, 'BG1', 105, { direction });
    positions.forEach(([x, pos], i) => l.obj('balise', { id: `B${i + 1}`, groupId: 'BG1', position: pos }, x - 4, 96, 8, 8));
    return l;
  };
  it('positions increase in the group direction', () => {
    expect(messages(layout([[100, '1'], [110, '2']], 'nominal'), 'balise-order')).toEqual([]);
    expect(messages(layout([[110, '1'], [100, '2']], 'reverse'), 'balise-order')).toEqual([]);
  });
  it('wrong order is an error naming the order found', () => {
    const r = run(layout([[110, '1'], [100, '2']], 'nominal'), 'balise-order');
    expect(r.issues.map((i) => [i.severity, i.message])).toEqual([['error', 'Balises of group BG1 are not in position order 1..n in the group direction (nominal): in that direction they lie B2 (2), B1 (1)']]);
  });
});

describe('rules: overlap length and route without overlap', () => {
  it('measures the overlap from the exit signal to the end of its section', () => {
    const l = stationLayout();
    l.route('R1', 'S1', 'S2');
    expect(messages(l, 'overlap-length')).toEqual([]);
    expect(messages(l, 'overlap-length', { min: 100 })).toEqual(['Overlap of route R1 (T1) is 50 m beyond S2; rule: at least 100 m']);
  });
  it('a route to a main signal needs an overlap', () => {
    const l = stationLayout();
    l.obj('route', { id: 'R1', entrySignal: 'S1', exitSignal: 'S2', points: 'W1:normal', sections: 'T1' });
    expect(messages(l, 'overlap-required')).toEqual(['Route R1 ends at main signal S2 but has no overlap']);
    const m = stationLayout();
    m.route('R1', 'S1', 'S2');
    expect(messages(m, 'overlap-required')).toEqual([]);
  });
});

describe('rule: detection point at a signal', () => {
  it('the first detection point beyond a signal within [min, max]', () => {
    const l = straight();
    l.signal('S1', 'nominal', 500, 115);
    ac(l, 'AC1', 510);
    expect(messages(l, 'detection-at-signal')).toEqual([]);
    expect(messages(l, 'detection-at-signal', { min: 15 })).toEqual(['Detection point AC1 is 10 m beyond signal S1; rule: 15 m–20 m']);
    const m = straight();
    m.signal('S1', 'nominal', 500, 115);
    ac(m, 'AC1', 540);
    expect(messages(m, 'detection-at-signal')).toEqual(['Detection point AC1 is 40 m beyond signal S1; rule: 0 m–20 m']);
  });
  it('no detection points in the drawing: a note', () => {
    const l = straight();
    l.signal('S1', 'nominal', 500, 115);
    expect(run(l, 'detection-at-signal')).toEqual({ issues: [], notes: [{ rule: 'detection-at-signal', message: 'Detection point at a signal: the drawing has no axle counters or insulated joints' }] });
  });
});

describe('rule: signal on the correct side', () => {
  it('right-hand side of the travel direction by default, left as option', () => {
    const l = straight();
    l.signal('S1', 'nominal', 500, 115);
    l.signal('S2', 'reverse', 600, 85);
    expect(messages(l, 'signal-side')).toEqual([]);
    const m = straight();
    m.signal('S1', 'nominal', 500, 85);
    expect(messages(m, 'signal-side')).toEqual(['Signal S1 stands on the left of the track for its direction (nominal); rule: right-hand side']);
    expect(messages(m, 'signal-side', { side: 'left' })).toEqual([]);
  });
});

describe('rule: spacing of main signals', () => {
  it('consecutive main signals of one direction at least min apart (shunting signals between are ignored)', () => {
    const l = straight();
    l.signal('S1', 'nominal', 100, 115);
    l.signal('SH1', 'nominal', 180, 115, { signalType: 'shunting' });
    l.signal('S2', 'nominal', 250, 115);
    l.signal('S3', 'nominal', 600, 115);
    l.signal('S4', 'reverse', 300, 85);
    expect(messages(l, 'signal-spacing')).toEqual(['Main signal S2 follows signal S1 after 150 m; rule: at least 200 m (minimum block length)']);
    expect(messages(l, 'signal-spacing', { min: 100 })).toEqual([]);
  });
});

describe('rule: train detection between signals', () => {
  it('a section or a detection point between consecutive signals', () => {
    const l = straight();
    l.line('trackSection', { id: 'TS1', trackId: 'T1' }, [[0, 100], [300, 100]]);
    l.signal('S1', 'nominal', 100, 115);
    l.signal('S2', 'nominal', 500, 115);
    l.signal('S3', 'nominal', 600, 115);
    l.signal('S4', 'nominal', 900, 115);
    ac(l, 'AC1', 950);
    // S1 -> S2 crosses TS1; S2 -> S3 and S3 -> S4 have nothing
    expect(messages(l, 'detection-between-signals')).toEqual([
      'No train detection (track section or detection point) between signal S2 and signal S3',
      'No train detection (track section or detection point) between signal S3 and signal S4',
    ]);
    const m = straight();
    m.signal('S1', 'nominal', 100, 115);
    m.signal('S2', 'nominal', 500, 115);
    expect(run(m, 'detection-between-signals').notes).toHaveLength(1);
  });
});

describe('rule: signal direction of routes', () => {
  it('entry and exit signals of a route need a direction', () => {
    const l = straight();
    l.signal('S1', '', 100, 115);
    l.signal('S2', 'nominal', 500, 115);
    l.obj('route', { id: 'R1', entrySignal: 'S1', exitSignal: 'S2' });
    expect(messages(l, 'signal-direction')).toEqual(['Signal S1 is the entry signal of route R1 but has no direction (nominal/reverse)']);
    const m = straight();
    m.signal('S1', 'nominal', 100, 115);
    m.signal('S2', 'nominal', 500, 115);
    m.obj('route', { id: 'R1', entrySignal: 'S1', exitSignal: 'S2' });
    expect(messages(m, 'signal-direction')).toEqual([]);
  });
});

describe('rule: points without detection', () => {
  it('points in a track section pass; without any section or detection point on the legs they fail', () => {
    const l = stationLayout();
    l.line('trackSection', { id: 'TS1', trackId: 'T1' }, [[100, 100], [400, 100]]);
    expect(messages(l, 'points-detection')).toEqual([]);
    const m = stationLayout();
    m.obj('axleCounter', { id: 'AC1' }, 795, 195, 10, 10); // T2 far end: not on a points leg piece
    m.line('track', { id: 'T9', length: '100' }, [[0, 500], [100, 500]]);
    m.line('trackSection', { id: 'TS9', trackId: 'T9' }, [[0, 500], [100, 500]]);
    expect(messages(m, 'points-detection')).toEqual(['Points W1 lie in no track section and have no detection point on their legs']);
  });
});

describe('rule settings', () => {
  it('defaults: every rule enabled with its documented thresholds', () => {
    const s = defaultRuleSettings();
    expect(Object.keys(s)).toHaveLength(10);
    expect(s['bg-signal-distance']).toEqual({ enabled: true, severity: 'warning', params: { min: 0, max: 50 } });
    expect(s['balise-order'].severity).toBe('error');
    expect(s['overlap-length'].params).toEqual({ min: 50 });
    expect(s['signal-spacing'].params).toEqual({ min: 200 });
    expect(s['signal-side'].params).toEqual({ side: 'right' });
    for (const d of RULE_DEFS) expect(d.label.pl && d.label.en && d.help.pl && d.help.en).toBeTruthy();
  });

  it('stores only the differences; invalid or unknown values fall back to the defaults', () => {
    const s = defaultRuleSettings();
    expect(serializeRuleSettings(s)).toBe('');
    s['overlap-length'].params.min = 120;
    s['signal-side'].enabled = false;
    s['balise-order'].severity = 'warning';
    const text = serializeRuleSettings(s);
    expect(JSON.parse(text)).toEqual({ 'balise-order': { severity: 'warning' }, 'overlap-length': { params: { min: 120 } }, 'signal-side': { enabled: false } });
    expect(parseRuleSettings(text)).toEqual(s);
    const bad = parseRuleSettings('{"overlap-length":{"params":{"min":-5}},"nope":{},"signal-side":{"params":{"side":"up"},"severity":"fatal"}}');
    expect(bad).toEqual(defaultRuleSettings());
    expect(parseRuleSettings('not json')).toEqual(defaultRuleSettings());
  });

  it('persist on the diagram root (undoable, draw.io round trip) and change the findings', () => {
    const l = stationLayout();
    l.route('R1', 'S1', 'S2');
    const undo = new UndoManager();
    const listener = (_s: unknown, evt: { getProperty(name: string): unknown }) => undo.undoableEditHappened(evt.getProperty('edit') as never);
    l.model.addListener(InternalEvent.UNDO, listener as never);
    const rule = (m: GraphDataModel) => validateModel(m).filter((i) => i.rule === 'overlap-length');
    expect(rule(l.model)).toEqual([]);
    const s = readRuleSettings(l.model);
    s['overlap-length'].params.min = 80;
    expect(setRuleSettings(l.model, s)).toBe(true);
    expect(setRuleSettings(l.model, s)).toBe(false);
    expect(rule(l.model).map((i) => i.message)).toEqual(['Overlap of route R1 (T1) is 50 m beyond S2; rule: at least 80 m']);
    const xml = exportModelToDrawioXml(l.model);
    expect(xml).toContain(`${RULE_SETTINGS_ATTR}="`);
    const restored = new GraphDataModel();
    importDrawioXmlIntoModel(xml, restored);
    expect(readRuleSettings(restored)['overlap-length'].params.min).toBe(80);
    undo.undo();
    expect(readRuleSettings(l.model)['overlap-length'].params.min).toBe(50);
    expect(rule(l.model)).toEqual([]);
    // back to the defaults removes the attribute
    s['overlap-length'].params.min = 50;
    undo.redo();
    expect(setRuleSettings(l.model, s)).toBe(true);
    expect(exportModelToDrawioXml(l.model)).not.toContain(RULE_SETTINGS_ATTR);
  });

  it('validateModelReport returns the notes; disabled rules give nothing', () => {
    const l = straight(false);
    l.signal('S1', 'nominal', 500, 115);
    bg(l, 'BG1', 400);
    expect(validateModelReport(l.model).notes.map((n) => n.rule)).toContain('bg-signal-distance');
    const off = defaultRuleSettings();
    for (const d of RULE_DEFS) off[d.id].enabled = false;
    expect(checkRules(collectObjects(l.model), off)).toEqual({ issues: [], notes: [] });
  });
});

describe('rules on the built-in ERTMS templates', () => {
  const LIBRARY = readFileSync(resolve(__dirname, '../../../public/libraries/ertms.xml'), 'utf8');
  const { templates } = splitErtmsLibrary(parseMxLibrary(LIBRARY));
  let graph: Graph | null = null;
  beforeAll(() => {
    registerDrawioCodecs();
    const proto = (globalThis as unknown as { SVGElement: { prototype: { getBBox?: () => unknown } } }).SVGElement.prototype;
    if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
  });
  afterEach(() => {
    if (graph) cleanupTestGraph(graph);
    graph = null;
  });

  it('every template runs through all rules without crashing', () => {
    expect(templates.length).toBeGreaterThanOrEqual(15);
    let findings = 0;
    for (const tpl of templates) {
      graph = createTestGraph();
      insertTemplate(graph, tpl, { x: 400, y: 300 });
      const report = validateModelReport(graph.getDataModel());
      for (const i of report.issues) expect(i.cellId, `${tpl.name}: ${i.message}`).toBeTruthy();
      findings += report.issues.filter((i) => RULE_DEFS.some((d) => d.id === i.rule)).length + report.notes.length;
      cleanupTestGraph(graph);
      graph = null;
    }
    expect(findings).toBeGreaterThan(0);
  }, 60_000);
});
