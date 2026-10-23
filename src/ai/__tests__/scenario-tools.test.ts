import { afterEach, describe, expect, it } from 'vitest';
import { collectObjects } from '../../railway/validation';
import { readStates } from '../../railway/state-apply';
import { diffSnapshots } from '../../scenarios/scenario-diff';
import { AI_TOOLS } from '../tool-defs';
import { analyzeTemplate, expandQuery, rankTemplates } from '../template-tools';
import { executeAiTool } from '../tools';
import { undoOwnEdits } from '../ai-panel';
import type { TestTarget } from './helpers';
import { createTestTarget } from './helpers';
import { splitErtmsLibrary } from '../../ui/templates/ertms-templates';
import { ertmsEntries } from '../../railml/__tests__/helpers';

/** "Level transition L1 → L2": T1, TC1..TC4, S2, S4_Exit, S6, BG1..BG4, TR1 (routes S2→S4_Exit, S4_Exit→S6). */
const L1_L2 = 'ertms-tpl-22';

let t: TestTarget | null = null;
afterEach(() => {
  t?.destroy();
  t = null;
});

function stateOf(target: TestTarget, id: string): Record<string, string> {
  const o = collectObjects(target.graph.getDataModel()).find((x) => x.id === id);
  if (!o) throw new Error(`no ${id}`);
  return readStates(o.cell);
}

async function withTemplate(): Promise<TestTarget> {
  const target = createTestTarget();
  const ins = await executeAiTool(target, 'insert_template', { id: L1_L2, mode: 'intoTab' });
  expect(ins.ok).toBe(true);
  return target;
}

describe('scenario tools', { timeout: 30_000 }, () => {
  it('are defined with strict schemas and mutating flags', () => {
    const names = AI_TOOLS.map((d) => d.name);
    for (const n of ['list_scenarios', 'create_scenario', 'update_scenario', 'add_scenario_step', 'update_scenario_step', 'delete_scenario_step', 'reorder_scenario_steps', 'build_scenario', 'view_scenario', 'export_scenario', 'describe_template']) {
      expect(names).toContain(n);
    }
    expect(AI_TOOLS.find((d) => d.name === 'build_scenario')!.mutating).toBe(true);
    expect(AI_TOOLS.find((d) => d.name === 'view_scenario')!.mutating).toBe(false);
  });

  it('create_scenario + 3 add_scenario_step with states: the panel model has them, snapshots differ, the diff lists state changes', async () => {
    t = await withTemplate();
    const created = await executeAiTool(t, 'create_scenario', { name: 'Wjazd', description: 'Train enters' });
    expect(created).toMatchObject({ ok: true, summary: 'Created scenario "Wjazd"' });
    expect(created.edits).toHaveLength(1);
    const s1 = await executeAiTool(t, 'add_scenario_step', { scenario: 'Wjazd', name: 'Initial', states: [{ id: 'TC1', state: 'free' }], text: '# Start' });
    expect(s1.ok).toBe(true);
    expect(s1.summary).toBe('Added step 1 "Initial" to scenario "Wjazd"');
    const s2 = await executeAiTool(t, 'add_scenario_step', {
      scenario: 'wjazd',
      name: 'Route set',
      routes: [],
      states: [{ id: 'TC2', state: 'reserved' }, { id: 'TC3', state: 'reserved' }, { id: 'S2', aspect: 'proceed' }],
      uml: '@startuml\nRBC -> Train: MA\n@enduml',
    });
    expect(s2.summary).toBe('Added step 2 "Route set" to scenario "Wjazd"');
    const s3 = await executeAiTool(t, 'add_scenario_step', { scenario: 'Wjazd', name: 'Train enters TC2', states: [{ id: 'TC2', state: 'occupied' }, { id: 'S2', aspect: 'stop' }] });
    expect(s3.ok).toBe(true);
    expect(stateOf(t, 'TC2').state).toBe('occupied');
    expect(stateOf(t, 'TC3').state).toBe('reserved'); // incremental
    const scenario = t.scenarioSet.list()[0];
    expect(scenario.name).toBe('Wjazd');
    expect(scenario.steps.map((s) => s.name)).toEqual(['Initial', 'Route set', 'Train enters TC2']);
    expect(scenario.steps[0].text).toBe('# Start');
    expect(scenario.steps[1].uml).toContain('RBC -> Train');
    expect(new Set(scenario.steps.map((s) => s.xml)).size).toBe(3);
    const diff = diffSnapshots(scenario.steps[1].xml, scenario.steps[2].xml);
    const lines = diff.changes.map((c) => c.summary).join('\n');
    expect(lines).toMatch(/TC2/);
    expect((s3.result.changesFromPreviousStep as { changes: string[] }).changes.join('\n')).toMatch(/TC2/);
    const list = await executeAiTool(t, 'list_scenarios', {});
    expect(list.result.scenarios).toEqual([
      expect.objectContaining({ name: 'Wjazd', steps: [expect.objectContaining({ n: 1, name: 'Initial', text: true, uml: false }), expect.objectContaining({ n: 2, uml: true }), expect.objectContaining({ n: 3 })] }),
    ]);
  });

  it('one undo step per call reverts the states and the scenario change together', async () => {
    t = await withTemplate();
    await executeAiTool(t, 'create_scenario', { name: 'A' });
    const step = await executeAiTool(t, 'add_scenario_step', { scenario: 'A', name: 'Occupied', states: [{ id: 'TC3', state: 'occupied' }] });
    expect(step.edits).toHaveLength(1);
    expect(stateOf(t, 'TC3').state).toBe('occupied');
    expect(undoOwnEdits(t, step.edits)).toBe(1);
    expect(stateOf(t, 'TC3').state).toBe('');
    expect(t.scenarioSet.list()[0].steps).toHaveLength(0);
    t.fx.commands.redo();
    expect(t.scenarioSet.list()[0].steps).toHaveLength(1);
    expect(stateOf(t, 'TC3').state).toBe('occupied');
    // undoing the creation removes only that scenario; one made in the panel meanwhile stays
    t.undo();
    const panelMade = t.scenarioSet.create('From the panel');
    t.undo();
    expect(t.scenarioSet.list().map((s) => s.id)).toEqual([panelMade.id]);
  });

  it('build_scenario creates the scenario and all steps (incremental, reset before step 1, one undo step)', async () => {
    t = await withTemplate();
    await executeAiTool(t, 'set_states', { items: [{ id: 'TC4', state: 'disturbed' }] });
    const routeAdd = await executeAiTool(t, 'routes', { action: 'add', from: 'S2', to: 'S4_Exit', id: 'R1' });
    expect(routeAdd.ok).toBe(true);
    const out = await executeAiTool(t, 'build_scenario', {
      name: 'Entry',
      description: 'Train entry',
      steps: [
        { name: 'Initial' },
        { name: 'Route R1 set', routes: [{ id: 'R1', action: 'set' }], text: 'Route **R1** set' },
        { name: 'Train in TC2', states: [{ id: 'TC2', state: 'occupied' }, { id: 'S2', aspect: 'stop' }] },
        { name: 'Absolute', resetStates: true, states: [{ id: 'TC3', state: 'occupied' }] },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.summary).toBe('Built scenario "Entry" with 4 steps');
    expect(out.edits).toHaveLength(1);
    const scenario = t.scenarioSet.list()[0];
    expect(scenario.steps).toHaveLength(4);
    // step 1: reset before (TC4 disturbed gone)
    expect(scenario.steps[0].xml).not.toContain('rdState="disturbed"');
    expect(scenario.steps[1].xml).toContain('rdState="reserved"');
    expect(scenario.steps[2].xml).toContain('rdState="occupied"');
    expect(scenario.steps[2].xml).toContain('rdState="reserved"'); // cumulative: TC3 still reserved
    expect(scenario.steps[3].xml).not.toContain('rdState="reserved"'); // absolute step
    expect(stateOf(t, 'TC3').state).toBe('occupied'); // drawing shows the last step
    t.undo();
    expect(t.scenarioSet.size).toBe(0);
    expect(stateOf(t, 'TC4').state).toBe('disturbed');
  });

  it('build_scenario restoreDrawing puts the states back', async () => {
    t = await withTemplate();
    const out = await executeAiTool(t, 'build_scenario', { name: 'X', restoreDrawing: true, steps: [{ name: 'a', states: [{ id: 'TC1', state: 'occupied' }] }] });
    expect(out.ok).toBe(true);
    expect(stateOf(t, 'TC1').state).toBe('');
    expect(t.scenarioSet.list()[0].steps[0].xml).toContain('rdState="occupied"');
  });

  it('errors name unknown ids with the valid ones and change nothing', async () => {
    t = await withTemplate();
    const before = t.modelXml();
    const bad = await executeAiTool(t, 'build_scenario', { name: 'Bad', steps: [{ name: 'a' }, { name: 'b', states: [{ id: 'TC9', state: 'occupied' }] }] });
    expect(bad.ok).toBe(false);
    expect(String(bad.result.error)).toMatch(/unknown object id\(s\) TC9 — valid ids: .*trackSection: TC1, TC2, TC3, TC4/);
    expect(bad.edits).toHaveLength(0);
    expect(t.scenarioSet.size).toBe(0);
    expect(t.modelXml()).toBe(before);
    await executeAiTool(t, 'create_scenario', { name: 'S' });
    const route = await executeAiTool(t, 'add_scenario_step', { scenario: 'S', name: 'r', routes: [{ id: 'R7', action: 'set' }] });
    expect(String(route.result.error)).toMatch(/unknown route\(s\) R7 — the drawing has no routes/);
    const state = await executeAiTool(t, 'add_scenario_step', { scenario: 'S', name: 'x', states: [{ id: 'S2', aspect: 'green' }] });
    expect(String(state.result.error)).toMatch(/aspect "green" is not one of stop\|proceed/);
    expect((await executeAiTool(t, 'add_scenario_step', { scenario: 'Nope', name: 'x' })).result.error).toMatch(/unknown scenario "Nope"; scenarios: "S"/);
    expect((await executeAiTool(t, 'delete_scenario_step', { scenario: 'S', step: 3 })).result.error).toMatch(/step 3 does not exist/);
    expect(t.scenarioSet.list()[0].steps).toHaveLength(0);
  });

  it('update / delete / reorder steps, update and delete scenarios, view and export', async () => {
    t = await withTemplate();
    await executeAiTool(t, 'build_scenario', { name: 'S', steps: [{ name: 'one' }, { name: 'two', states: [{ id: 'TC1', state: 'occupied' }] }, { name: 'three' }] });
    const up = await executeAiTool(t, 'update_scenario_step', { scenario: 'S', step: 2, name: 'Two', text: 'Hello' });
    expect(up.summary).toBe('Updated step 2 "Two" of scenario "S"');
    const re = await executeAiTool(t, 'update_scenario_step', { scenario: 'S', step: 'three', states: [{ id: 'TC2', state: 'occupied' }] });
    expect(re.summary).toContain('(drawing recaptured)');
    expect(t.scenarioSet.list()[0].steps[2].xml).toContain('rdState="occupied"');
    const mv = await executeAiTool(t, 'reorder_scenario_steps', { scenario: 'S', step: 3, to: 1 });
    expect(mv.ok).toBe(true);
    expect(t.scenarioSet.list()[0].steps.map((s) => s.name)).toEqual(['three', 'one', 'Two']);
    await executeAiTool(t, 'reorder_scenario_steps', { scenario: 'S', order: [2, 3, 1] });
    expect(t.scenarioSet.list()[0].steps.map((s) => s.name)).toEqual(['one', 'Two', 'three']);
    expect((await executeAiTool(t, 'reorder_scenario_steps', { scenario: 'S', order: [1, 1, 2] })).ok).toBe(false);
    const del = await executeAiTool(t, 'delete_scenario_step', { scenario: 'S', step: 1 });
    expect(del.summary).toBe('Deleted step 1 "one" of scenario "S"');
    const id = t.scenarioSet.list()[0].id;
    const view = await executeAiTool(t, 'view_scenario', { scenario: 'S', step: 2 });
    expect(view.summary).toBe('Showing scenario "S" step 2/2');
    expect(t.shown).toEqual([{ scenarioId: id, index: 1 }]);
    const exp = await executeAiTool(t, 'export_scenario', { format: 'pdf' });
    expect(exp.ok).toBe(true);
    expect(t.exported).toEqual([{ scenarioId: id, format: 'pdf' }]);
    const ren = await executeAiTool(t, 'update_scenario', { scenario: id, name: 'Renamed' });
    expect(ren.summary).toBe('Updated scenario "Renamed"');
    const gone = await executeAiTool(t, 'update_scenario', { scenario: 'Renamed', delete: true });
    expect(gone.ok).toBe(true);
    expect(t.scenarioSet.size).toBe(0);
    t.undo();
    expect(t.scenarioSet.list()[0].name).toBe('Renamed');
  });

  it('report unavailable scenarios', async () => {
    t = createTestTarget();
    delete (t as { scenarios?: unknown }).scenarios;
    expect((await executeAiTool(t, 'list_scenarios', {})).result.error).toBe('scenarios are not available here');
  });
});

describe('template tools', { timeout: 30_000 }, () => {
  const templates = splitErtmsLibrary(ertmsEntries()).templates;

  it('derive names, ETCS level, counts, signal ids and size', () => {
    const info = analyzeTemplate(templates.find((x) => x.id === L1_L2)!);
    expect(info).toMatchObject({
      name: 'Level transition L1 → L2',
      originalName: 'ERTMS scenario 5',
      etcsLevel: 'L1 → L2',
      counts: { tracks: 1, signals: 3, sections: 4, points: 0, baliseGroups: 4 },
      ids: { signal: ['S2', 'S4_Exit', 'S6'], trackSection: ['TC1', 'TC2', 'TC3', 'TC4'] },
    });
    expect(info.summary).toMatch(/^ERTMS Level transition L1 → L2: 1 track, 3 signals \(S2, S4_Exit, S6\), 4 sections/);
    expect(info.size.width).toBeGreaterThan(100);
  });

  it('filter and rank with English and Polish keywords', () => {
    expect(expandQuery('Przygotuj scenariusz wjazdu pociągu').map((q) => q.word)).toEqual(['wjazdu', 'pociagu']);
    expect(rankTemplates(templates, 'level transition L1 L2')[0].info.name).toBe('Level transition L1 → L2');
    expect(rankTemplates(templates, 'przejście poziomu L2')[0].info.name).toMatch(/^Level transition L1 → L2/);
    expect(rankTemplates(templates, 'wjazd na stację')[0].info.name).toBe('Train routes to a station');
    expect(rankTemplates(templates, 'koniec zezwolenia')[0].info.name).toBe('End of authority (L1)');
    expect(rankTemplates(templates, 'doraźne ograniczenie prędkości')[0].info.name).toBe('Temporary speed restrictions (L1)');
    expect(rankTemplates(templates, 'zzzz qqqq')).toEqual([]);
    expect(rankTemplates(templates, '')).toHaveLength(templates.length);
  });

  it('list_templates, describe_template, insert_template with the id mapping', async () => {
    t = createTestTarget();
    const list = await executeAiTool(t, 'list_templates', { query: 'przejście poziomu L1 L2', limit: 3 });
    expect(list.ok).toBe(true);
    const rows = list.result.templates as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: L1_L2, name: 'Level transition L1 → L2', etcsLevel: 'L1 → L2', signals: ['S2', 'S4_Exit', 'S6'] });
    const none = await executeAiTool(t, 'list_templates', { query: 'zzzz' });
    expect(none.result.matches).toBe(0);
    expect((none.result.templates as unknown[]).length).toBe(templates.length);
    const desc = await executeAiTool(t, 'describe_template', { id: 'Level transition L1 → L2' });
    expect(desc.ok).toBe(true);
    expect(String(desc.result.railwayScript)).toMatch(/railwayScript: 1/);
    expect(String(desc.result.railwayScript)).toMatch(/S4_Exit/);
    expect(desc.result.labels).toContain('L1/L2 Area Border');
    const first = await executeAiTool(t, 'insert_template', { id: L1_L2, mode: 'intoTab', at: { x: 300, y: 200 } });
    expect(first.result.renamed).toEqual({});
    expect(first.summary).toBe('Inserted template "Level transition L1 → L2" into "Test diagram"');
    const second = await executeAiTool(t, 'insert_template', { id: L1_L2, mode: 'intoTab', at: { x: 300, y: 600 } });
    const renamed = second.result.renamed as Record<string, string>;
    expect(renamed.S2).toMatch(/^S\d+$/);
    expect(renamed.S2).not.toBe('S2');
    expect(renamed.TC1).toMatch(/^TC\d+$/);
    expect((second.result.objects as Record<string, string[]>).signal).toContain(renamed.S2);
    expect(second.summary).toMatch(/\(S2→S\d+|\(.*→/);
    const ids = collectObjects(t.graph.getDataModel()).filter((o) => o.kind.id === 'signal').map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tab = await executeAiTool(t, 'insert_template', { id: L1_L2 });
    expect(tab.result).toMatchObject({ mode: 'newTab', tab: 'Level transition L1 → L2' });
    expect(tab.summary).toBe('Inserted template "Level transition L1 → L2" as new tab (S2, S4_Exit, S6)');
    expect((await executeAiTool(t, 'describe_template', { id: 'nope' })).result.error).toMatch(/template nope not found/);
  }, 30_000);
});
