import { describe, it, expect, vi } from 'vitest';
import { ScenarioSet, sanitizeScenarios, MAX_SCENARIO_NAME } from '../scenario-model';

const XML = (n: number | string): string =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="v" value="${n}" vertex="1" parent="1"><mxGeometry as="geometry"/></mxCell></root></mxGraphModel>`;

describe('ScenarioSet', () => {
  it('creates, edits, duplicates and removes scenarios, notifying on each change', () => {
    const set = new ScenarioSet();
    const listener = vi.fn();
    const off = set.subscribe(listener);
    const a = set.create('  Wjazd na stację  ', 'Pociąg wjeżdża');
    expect(a).toMatchObject({ name: 'Wjazd na stację', description: 'Pociąg wjeżdża', steps: [] });
    expect(a.id).toMatch(/^scn-/);
    const b = set.create('', '');
    expect(b.name).toBe('Scenario 2');
    set.update(a.id, { name: 'Entry', description: '' });
    expect(set.get(a.id)).toMatchObject({ name: 'Entry', description: '' });
    // an empty name keeps the old one
    set.update(a.id, { name: '   ' });
    expect(set.get(a.id)?.name).toBe('Entry');

    set.addStep(a.id, { name: 'One', xml: XML(1) });
    const copy = set.duplicate(a.id);
    expect(set.list().map((s) => s.name)).toEqual(['Entry', 'Entry (copy)', 'Scenario 2']);
    expect(copy.id).not.toBe(a.id);
    expect(copy.steps[0].id).not.toBe(set.get(a.id)!.steps[0].id);
    expect(copy.steps[0].xml).toBe(XML(1));

    set.moveScenario(b.id, 0);
    expect(set.list().map((s) => s.name)).toEqual(['Scenario 2', 'Entry', 'Entry (copy)']);
    set.remove(copy.id);
    set.remove('missing');
    expect(set.size).toBe(2);
    expect(listener).toHaveBeenCalledTimes(8);
    off();
    set.remove(b.id);
    expect(listener).toHaveBeenCalledTimes(8);
  });

  it('adds, edits, duplicates, reorders and deletes steps', () => {
    const set = new ScenarioSet();
    const s = set.create('S');
    const s1 = set.addStep(s.id, { name: 'A', xml: XML('a') });
    const s2 = set.addStep(s.id, { name: 'B', description: 'second', xml: XML('b') });
    const s3 = set.addStep(s.id, { name: 'C', xml: XML('c') });
    const names = (): string[] => set.get(s.id)!.steps.map((st) => st.name);
    expect(names()).toEqual(['A', 'B', 'C']);

    set.moveStep(s.id, s3.id, 0);
    expect(names()).toEqual(['C', 'A', 'B']);
    set.moveStep(s.id, s3.id, 99);
    expect(names()).toEqual(['A', 'B', 'C']);
    set.moveStep(s.id, s1.id, -5);
    expect(names()).toEqual(['A', 'B', 'C']);

    set.updateStep(s.id, s2.id, { name: 'B2', description: 'zażółć', xml: XML('b2') });
    expect(set.get(s.id)!.steps[1]).toMatchObject({ name: 'B2', description: 'zażółć', xml: XML('b2') });

    const dup = set.duplicateStep(s.id, s2.id);
    expect(names()).toEqual(['A', 'B2', 'B2 (copy)', 'C']);
    expect(dup.xml).toBe(XML('b2'));
    set.removeStep(s.id, s1.id);
    expect(names()).toEqual(['B2', 'B2 (copy)', 'C']);
    expect(set.stepCount()).toBe(3);
    // inserting at an index
    set.addStep(s.id, { name: 'first', xml: XML(0) }, 0);
    expect(names()[0]).toBe('first');
    expect(() => set.removeStep(s.id, 'nope')).toThrow(/Unknown step/);
  });

  it('returns copies: changing a returned object does not change the set', () => {
    const set = new ScenarioSet();
    const s = set.create('S');
    set.addStep(s.id, { name: 'A', xml: XML(1) });
    const copy = set.get(s.id)!;
    copy.name = 'changed';
    copy.steps[0].name = 'changed';
    copy.steps.pop();
    expect(set.get(s.id)).toMatchObject({ name: 'S', steps: [{ name: 'A' }] });
  });

  it('sanitizes untrusted data: drops broken steps, fixes names and duplicate ids, caps lengths', () => {
    const long = 'x'.repeat(500);
    const result = sanitizeScenarios([
      { id: 'dup', name: long, steps: [{ id: 's', name: '', xml: XML(1) }, { id: 's', name: 'b', xml: XML(2) }, { name: 'bad' }, null] },
      { id: 'dup', name: 'two', description: 5, steps: 'nope' },
      'junk',
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toHaveLength(MAX_SCENARIO_NAME);
    expect(result[0].steps.map((s) => s.name)).toEqual(['Step 1', 'b']);
    expect(new Set(result[0].steps.map((s) => s.id)).size).toBe(2);
    expect(result[1].id).not.toBe('dup');
    expect(result[1]).toMatchObject({ name: 'two', description: '', steps: [] });
    expect(sanitizeScenarios(undefined)).toEqual([]);
    expect(sanitizeScenarios({})).toEqual([]);
  });
});
