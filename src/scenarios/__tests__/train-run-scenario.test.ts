/**
 * "Create scenario from run" (train-run-scenario.ts): one step per moment of the run with names,
 * Markdown text (time / position / speed), PlantUML (RBC messages for ETCS level 2) and drawing
 * snapshots that carry the states of that moment and the moved train; the source drawing stays
 * unchanged; the steps go into the ScenarioSet.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { Graph } from '@maxgraph/core';
import { exportModelToDrawioXml, importDrawioXmlIntoModel } from '../../services/drawio-xml';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { buildRunPath } from '../../railway/train-run/run-path';
import { simulateRun } from '../../railway/train-run/simulate';
import { lineLayout } from '../../railway/train-run/__tests__/fixtures';
import { parseSequenceDiagram } from '../../services/plantuml-sequence-svg';
import { ScenarioSet } from '../scenario-model';
import { addRunScenario, buildRunScenarioSteps, momentName, runMoments } from '../train-run-scenario';

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

/** rdState / rdAspect of the object with rdId `id` in a snapshot. */
function stateIn(xml: string, id: string, attr = 'rdState'): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const el = Array.from(doc.getElementsByTagName('object')).find((o) => o.getAttribute('rdId') === id);
  return el?.getAttribute(attr) ?? '';
}

function trainX(xml: string): number {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const el = Array.from(doc.getElementsByTagName('object')).find((o) => o.getAttribute('rdKind') === 'train')!;
  const geo = el.getElementsByTagName('mxGeometry')[0];
  return Number(geo.getAttribute('x') ?? 0) + Number(geo.getAttribute('width'));
}

function setup(train = true): { graph: Graph; xml: string } {
  graph = createTestGraph();
  importDrawioXmlIntoModel(lineLayout({ train }), graph.getDataModel());
  return { graph, xml: exportModelToDrawioXml(graph.getDataModel(), { stylesheet: graph.getStylesheet() }) };
}

describe('scenario from a train run', () => {
  it('one step per moment with names, text, UML and the states of that moment', () => {
    const { graph: g, xml } = setup();
    const run = simulateRun(buildRunPath(g.getDataModel(), ['R1']).path!, { speedKmh: 72, lengthM: 100 });
    expect(runMoments(run).map((m) => m.t)).toEqual([0, 5, 15, 20, 25, 55]);
    const steps = buildRunScenarioSteps(run, { xml, stylesheet: g.getStylesheet() }, { cellId: 'tr1' }, { etcsLevel: '2' });
    expect(steps.map((s) => s.name)).toEqual([
      'Route R1 set',
      'Departure, S1 to stop, TC1 occupied',
      'TC2 occupied',
      'TC1 freed',
      'Arrival at S2',
      'Overlap TC3 released',
    ]);
    expect(steps[1].description).toBe('t = 5 s');
    expect(steps[2].text).toContain('**Time:** 15 s');
    expect(steps[2].text).toContain('**Head:** 200 m from S1');
    expect(steps[2].text).toContain('**Speed:** 72 km/h');
    expect(steps[2].text).toContain('- TC2 occupied (head enters)');
    expect(steps[0].text).toContain('| TR1 | R1 | 400 m | 72 km/h | 100 m |');
    // states per moment
    expect(stateIn(steps[0].xml, 'TC1')).toBe('reserved');
    expect(stateIn(steps[0].xml, 'TC3')).toBe('overlap');
    expect(stateIn(steps[0].xml, 'S1', 'rdAspect')).toBe('proceed');
    expect(stateIn(steps[1].xml, 'TC1')).toBe('occupied');
    expect(stateIn(steps[1].xml, 'S1', 'rdAspect')).toBe('');
    expect(stateIn(steps[3].xml, 'TC1')).toBe('');
    expect(stateIn(steps[3].xml, 'TC2')).toBe('occupied');
    expect(stateIn(steps[5].xml, 'TC3')).toBe('');
    // the train moves: head at 0, 0, 200, 300, 400 m
    expect(steps.map((s) => Math.round(trainX(s.xml)))).toEqual([0, 0, 200, 300, 400, 400]);
    // ETCS level 2: MA request / grant, RBC participant; parses with the local renderer
    expect(steps[0].uml).toContain('T -> RBC: MA request');
    expect(steps[0].uml).toContain('RBC -> T: MA granted (EoA S2, 400 m)');
    expect(steps[3].uml).toContain('IXL -> RBC: TC1 released');
    for (const s of steps) expect(parseSequenceDiagram(s.uml).warnings).toEqual([]);
    // the source drawing is unchanged
    expect(exportModelToDrawioXml(g.getDataModel(), { stylesheet: g.getStylesheet() })).toBe(xml);
  });

  it('without ETCS level 2 no RBC; uml=false leaves it out; a new train is drawn', () => {
    const { graph: g, xml } = setup(false);
    const run = simulateRun(buildRunPath(g.getDataModel(), ['R1', 'R2']).path!, { speedKmh: 72, lengthM: 100 });
    const steps = buildRunScenarioSteps(run, { xml, stylesheet: g.getStylesheet() }, { cellId: null }, { etcsLevel: '1' });
    expect(steps[0].uml).not.toContain('RBC');
    expect(steps[0].uml).toContain('IXL -> T: S1 proceed');
    expect(steps.every((s) => /rdKind="train"/.test(s.xml))).toBe(true);
    const none = buildRunScenarioSteps(run, { xml, stylesheet: g.getStylesheet() }, { cellId: null }, { uml: false });
    expect(none.every((s) => s.uml === '')).toBe(true);
    expect(momentName({ t: 0, events: Array.from({ length: 12 }, () => run.events[4]) }).length).toBeLessThanOrEqual(80);
  });

  it('adds the scenario with its steps to the set', () => {
    const { graph: g, xml } = setup();
    const run = simulateRun(buildRunPath(g.getDataModel(), ['R1']).path!, { speedKmh: 72, lengthM: 100 });
    const steps = buildRunScenarioSteps(run, { xml, stylesheet: g.getStylesheet() }, { cellId: 'tr1' });
    const set = new ScenarioSet();
    const scenario = addRunScenario(set, run, steps);
    expect(scenario.name).toBe('Train run R1');
    expect(scenario.description).toMatch(/72 km\/h, 100 m train, 25 s to S2/);
    expect(scenario.steps.map((s) => s.name)).toEqual(steps.map((s) => s.name));
    expect(set.get(scenario.id)!.steps[2].text).toContain('TC2 occupied');
  });
});
