/**
 * AI tool simulate_train_run: schema, event list (times, positions, km, speeds), unknown route /
 * train errors with the valid ids, createScenario = one undoable edit (undo removes the scenario),
 * the drawing unchanged.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { importDrawioXmlIntoModel } from '../../services/drawio-xml';
import { lineLayout } from '../../railway/train-run/__tests__/fixtures';
import { getToolDef } from '../tool-defs';
import { buildSystemPrompt } from '../system-prompt';
import { executeAiTool } from '../tools';
import type { TestTarget } from './helpers';
import { createTestTarget } from './helpers';

let t: TestTarget | null = null;
afterEach(() => {
  t?.destroy();
  t = null;
});

function target(): TestTarget {
  t = createTestTarget();
  importDrawioXmlIntoModel(lineLayout({ train: true, kmOnTc1: true }), t.graph.getDataModel());
  t.fx.commands.clearHistory();
  return t;
}

describe('simulate_train_run', () => {
  it('is defined, mutating, mentioned in the system prompt', () => {
    const def = getToolDef('simulate_train_run')!;
    expect(def.mutating).toBe(true);
    expect(def.input_schema.required).toEqual(['routes', 'speedKmh', 'lengthM']);
    expect(buildSystemPrompt()).toContain('simulate_train_run');
  });

  it('returns the events in time order and does not change the drawing', async () => {
    const tg = target();
    const before = tg.modelXml();
    const out = await executeAiTool(tg, 'simulate_train_run', { routes: ['R1', 'R2'], speedKmh: 72, lengthM: 100, train: 'TR1' });
    expect(out.ok).toBe(true);
    const r = out.result as { events: Array<Record<string, unknown>>; arriveS: number; lengthM: number; routes: string[]; scenario?: unknown };
    expect(r.routes).toEqual(['R1', 'R2']);
    expect(r.lengthM).toBe(600);
    expect(r.arriveS).toBe(35);
    expect(r.events.map((e) => `${e.t} ${e.type} ${e.subject}`)).toEqual([
      '0 route-set R1',
      '0 route-set R2',
      '5 depart S1',
      '5 signal-passed S1',
      '5 head-enter TC1',
      '15 head-enter TC2',
      '20 tail-clear TC1',
      '25 signal-passed S2',
      '25 head-enter TC3',
      '30 tail-clear TC2',
      '30 route-released R1',
      '35 arrive S3',
      '65 overlap-released TC4',
    ]);
    expect(r.events[4]).toMatchObject({ headM: 0, km: '12+000', speedKmh: 72 });
    expect(r.scenario).toBeUndefined();
    expect(out.edits).toEqual([]);
    expect(tg.modelXml()).toBe(before);
    expect(out.summary).toContain('R1 → R2');
  });

  it('errors name the valid ids', async () => {
    const tg = target();
    const bad = await executeAiTool(tg, 'simulate_train_run', { routes: ['R7'], speedKmh: 72, lengthM: 100 });
    expect(bad.ok).toBe(false);
    expect(String((bad.result as { error: string }).error)).toMatch(/R7.*route: R1, R2/);
    const train = await executeAiTool(tg, 'simulate_train_run', { routes: ['R1'], speedKmh: 72, lengthM: 100, train: 'TR9' });
    expect(String((train.result as { error: string }).error)).toMatch(/TR9.*train: TR1/);
    const schema = await executeAiTool(tg, 'simulate_train_run', { routes: ['R1'], speedKmh: 0, lengthM: 100 });
    expect(schema.ok).toBe(false);
  });

  it('createScenario: one undoable edit with one step per moment', async () => {
    const tg = target();
    const out = await executeAiTool(tg, 'simulate_train_run', { routes: ['R1'], speedKmh: 72, lengthM: 100, train: 'TR1', createScenario: true, scenarioName: 'Run R1' });
    expect(out.ok).toBe(true);
    const s = (out.result as { scenario: { id: string; name: string; steps: Array<{ name: string }> } }).scenario;
    expect(s.name).toBe('Run R1');
    expect(s.steps.map((x) => x.name)).toEqual(['Route R1 set', 'Departure, S1 to stop, TC1 occupied', 'TC2 occupied', 'TC1 freed', 'Arrival at S2', 'Overlap TC3 released']);
    const stored = tg.scenarioSet.get(s.id)!;
    expect(stored.steps[0].uml).toContain('MA request'); // TR1 is ETCS level 2
    expect(out.edits.length).toBe(1);
    tg.undo();
    expect(tg.scenarioSet.get(s.id)).toBeNull();
  });
});
