/**
 * @file scenario-tools.ts
 * @brief Scenario tools of the AI (list/create/update scenarios, add/update/delete/reorder steps,
 *        build a whole scenario, show it, export it). They use the tab's ScenarioSet (the store of the
 *        Scenarios panel, so the panel and the view follow at once). A step = states / route actions
 *        applied to the drawing + a snapshot of the drawing taken exactly like the panel's "Add step".
 *
 * Undo: every call that changes scenarios records ONE undoable edit on the tab's model holding the
 * drawing changes of the call (states, routes) AND a `ScenarioSetChange` (puts the touched scenarios
 * back), so Ctrl+Z, "Undo AI turn" and Discard in confirm mode revert both together.
 */
import { collectObjects } from '../railway/validation';
import type { ScenarioData, ScenarioSet, ScenarioSetState, ScenarioStepData } from '../scenarios/scenario-model';
import { diffSnapshots, diffCountsText } from '../scenarios/scenario-diff';
import type { AiTarget } from './target';
import { captureObjectStates, prepareStepActions, restoreObjectStates } from './step-actions';
import type { PreparedStep, StepActions } from './step-actions';
import { fail, ok } from './tool-kit';
import type { Executor, Input } from './tool-kit';
import { foldText } from './template-tools';

/** Most steps build_scenario creates in one call. */
export const MAX_BUILD_STEPS = 30;

/**
 * Model change (maxGraph calls `execute()` on undo and on redo) that swaps the touched scenarios
 * between their state before and after the tool call.
 */
export class ScenarioSetChange {
  constructor(
    private readonly set: ScenarioSet,
    private state: ScenarioSetState
  ) {}

  execute(): void {
    const now = this.set.captureState(Object.keys(this.state.touched));
    this.set.restoreState(this.state);
    this.state = now;
  }
}

export function requireSet(target: AiTarget): ScenarioSet {
  if (!target.scenarios) fail('scenarios are not available here');
  return target.scenarios!();
}

function scenarioList(set: ScenarioSet): string {
  const list = set.list();
  return list.length ? list.map((s) => `"${s.name}" (${s.id})`).join(', ') : 'none (create one with create_scenario or build_scenario)';
}

/** A scenario by id, or by name (case and accents ignored). */
export function resolveScenario(set: ScenarioSet, ref: unknown): ScenarioData {
  const key = String(ref ?? '').trim();
  if (!key) return fail(`"scenario" (id or name) is required; scenarios: ${scenarioList(set)}`);
  const byId = set.get(key);
  if (byId) return byId;
  const named = set.list().filter((s) => foldText(s.name.trim()) === foldText(key));
  if (named.length === 1) return named[0];
  if (named.length > 1) return fail(`several scenarios are named "${key}": use the id (${named.map((s) => s.id).join(', ')})`);
  return fail(`unknown scenario "${key}"; scenarios: ${scenarioList(set)}`);
}

function stepsText(scenario: ScenarioData): string {
  return scenario.steps.length ? scenario.steps.map((s, i) => `${i + 1}. "${s.name}" (${s.id})`).join(', ') : 'no steps';
}

/** Index of a step: 1-based number, step id or step name. */
export function resolveStep(scenario: ScenarioData, ref: unknown): number {
  if (typeof ref === 'number') {
    if (Number.isInteger(ref) && ref >= 1 && ref <= scenario.steps.length) return ref - 1;
    return fail(`step ${ref} does not exist in "${scenario.name}" (steps: ${stepsText(scenario)})`);
  }
  const key = String(ref ?? '').trim();
  let index = scenario.steps.findIndex((s) => s.id === key);
  if (index < 0) index = scenario.steps.findIndex((s) => foldText(s.name.trim()) === foldText(key));
  if (index < 0 && /^\d+$/.test(key)) return resolveStep(scenario, Number(key));
  if (index < 0) return fail(`unknown step "${key}" in "${scenario.name}" (steps: ${stepsText(scenario)})`);
  return index;
}

/**
 * Runs `mutate` (drawing and/or scenario changes) as ONE undoable edit of the tab's model that also
 * restores the scenarios `ids` (and removes scenarios the call created) on undo.
 */
export function scenarioEdit<T>(target: AiTarget, set: ScenarioSet, ids: string[], mutate: () => T): T {
  const model = target.graph.getDataModel();
  const before = set.captureState(ids);
  const known = new Set(before.order);
  let out: T;
  model.beginUpdate();
  try {
    out = mutate();
    for (const s of set.list()) if (!known.has(s.id) && !(s.id in before.touched)) before.touched[s.id] = null;
    model.currentEdit.add(new ScenarioSetChange(set, before));
  } finally {
    model.endUpdate();
  }
  target.scenariosChanged?.();
  return out;
}

function stepActions(input: Input): StepActions {
  return {
    states: (input.states as Input[] | undefined) ?? [],
    routes: (input.routes as Input[] | undefined) ?? [],
    resetStates: input.resetStates === true,
  };
}

function hasActions(a: StepActions): boolean {
  return (a.states?.length ?? 0) > 0 || (a.routes?.length ?? 0) > 0 || a.resetStates === true;
}

function prepare(target: AiTarget, actions: StepActions, label: string): PreparedStep {
  try {
    return prepareStepActions(target.graph, collectObjects(target.graph.getDataModel()), actions, label);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Changes from the previous snapshot as short lines ("TC3: free → occupied"). */
function diffLines(prev: string | null, cur: string, max = 12): { counts: string; changes: string[] } {
  if (prev === null) return { counts: 'first step', changes: [] };
  try {
    const diff = diffSnapshots(prev, cur);
    return { counts: diffCountsText(diff.counts) || 'no visible changes', changes: diff.changes.slice(0, max).map((c) => c.summary) };
  } catch {
    return { counts: 'not compared', changes: [] };
  }
}

function stepRow(step: ScenarioStepData, index: number): Record<string, unknown> {
  return {
    n: index + 1,
    id: step.id,
    name: step.name,
    ...(step.description ? { description: step.description } : {}),
    uml: step.uml !== '',
    text: step.text !== '',
  };
}

// ---------------------------------------------------------------------------------------------

export const listScenarios: Executor = async (target, input) => {
  const set = requireSet(target);
  const all = input.scenario !== undefined ? [resolveScenario(set, input.scenario)] : set.list();
  const steps = all.reduce((n, s) => n + s.steps.length, 0);
  return ok(`Listed ${all.length} scenario(s) (${steps} step${steps === 1 ? '' : 's'})`, {
    tab: target.tabName(),
    scenarios: all.map((s) => ({ id: s.id, name: s.name, ...(s.description ? { description: s.description } : {}), steps: s.steps.map(stepRow) })),
  });
};

export const createScenario: Executor = async (target, input) => {
  const set = requireSet(target);
  const created = scenarioEdit(target, set, [], () => set.create(String(input.name), typeof input.description === 'string' ? input.description : ''));
  return ok(`Created scenario "${created.name}"`, { id: created.id, name: created.name });
};

export const updateScenario: Executor = async (target, input) => {
  const set = requireSet(target);
  const scenario = resolveScenario(set, input.scenario);
  if (input.delete === true) {
    scenarioEdit(target, set, [scenario.id], () => set.remove(scenario.id));
    return ok(`Deleted scenario "${scenario.name}" (${scenario.steps.length} steps)`, { deleted: scenario.id });
  }
  if (input.name === undefined && input.description === undefined) fail('give name, description or delete=true');
  scenarioEdit(target, set, [scenario.id], () =>
    set.update(scenario.id, {
      ...(typeof input.name === 'string' ? { name: input.name } : {}),
      ...(typeof input.description === 'string' ? { description: input.description } : {}),
    })
  );
  const now = set.get(scenario.id)!;
  return ok(`Updated scenario "${now.name}"`, { id: now.id, name: now.name, description: now.description });
};

export const addScenarioStep: Executor = async (target, input) => {
  const set = requireSet(target);
  const scenario = resolveScenario(set, input.scenario);
  const actions = stepActions(input);
  const capture = input.captureDrawing !== false;
  if (!capture && hasActions(actions)) fail('states/routes/resetStates need captureDrawing=true (the step must show them)');
  const at = typeof input.position === 'number' ? Math.max(0, Math.min(scenario.steps.length, input.position - 1)) : scenario.steps.length;
  const prepared = capture ? prepare(target, actions, `step "${String(input.name)}"`) : null;
  const prev = at > 0 ? scenario.steps[at - 1].xml : null;
  const { step, changed, xml } = scenarioEdit(target, set, [scenario.id], () => {
    const changedCells = prepared ? prepared.run() : 0;
    const snapshot = capture ? target.modelXml() : prev ?? target.modelXml();
    const created = set.addStep(
      scenario.id,
      {
        name: String(input.name),
        description: typeof input.description === 'string' ? input.description : '',
        xml: snapshot,
        uml: typeof input.uml === 'string' ? input.uml : '',
        text: typeof input.text === 'string' ? input.text : '',
      },
      at
    );
    return { step: created, changed: changedCells, xml: snapshot };
  });
  const diff = diffLines(prev, xml);
  return ok(`Added step ${at + 1} "${step.name}" to scenario "${scenario.name}"`, {
    scenario: scenario.id,
    step: stepRow(step, at),
    changedCells: changed,
    changesFromPreviousStep: diff,
  });
};

export const updateScenarioStep: Executor = async (target, input) => {
  const set = requireSet(target);
  const scenario = resolveScenario(set, input.scenario);
  const index = resolveStep(scenario, input.step);
  const step = scenario.steps[index];
  const actions = stepActions(input);
  const recapture = input.recapture === true || hasActions(actions);
  const fields: { name?: string; description?: string; uml?: string; text?: string } = {};
  for (const k of ['name', 'description', 'uml', 'text'] as const) if (typeof input[k] === 'string') fields[k] = input[k] as string;
  if (!recapture && Object.keys(fields).length === 0) fail('nothing to change: give name, description, uml, text, states, routes or recapture=true');
  const prepared = recapture ? prepare(target, actions, `step ${index + 1}`) : null;
  let changed = 0;
  scenarioEdit(target, set, [scenario.id], () => {
    if (prepared) changed = prepared.run();
    set.updateStep(scenario.id, step.id, { ...fields, ...(recapture ? { xml: target.modelXml() } : {}) });
  });
  const now = set.get(scenario.id)!.steps[index];
  return ok(`Updated step ${index + 1} "${now.name}" of scenario "${scenario.name}"${recapture ? ' (drawing recaptured)' : ''}`, {
    scenario: scenario.id,
    step: stepRow(now, index),
    ...(recapture ? { changedCells: changed, drawingRecaptured: true } : {}),
  });
};

export const deleteScenarioStep: Executor = async (target, input) => {
  const set = requireSet(target);
  const scenario = resolveScenario(set, input.scenario);
  const index = resolveStep(scenario, input.step);
  const step = scenario.steps[index];
  scenarioEdit(target, set, [scenario.id], () => set.removeStep(scenario.id, step.id));
  return ok(`Deleted step ${index + 1} "${step.name}" of scenario "${scenario.name}"`, { scenario: scenario.id, deleted: step.id, steps: scenario.steps.length - 1 });
};

export const reorderScenarioSteps: Executor = async (target, input) => {
  const set = requireSet(target);
  const scenario = resolveScenario(set, input.scenario);
  const n = scenario.steps.length;
  let order: number[];
  if (Array.isArray(input.order)) {
    order = (input.order as number[]).map((x) => x - 1);
    const sorted = [...order].sort((a, b) => a - b);
    if (order.length !== n || sorted.some((x, i) => x !== i)) fail(`"order" must list every step number 1..${n} once (steps: ${stepsText(scenario)})`);
  } else {
    if (input.step === undefined || typeof input.to !== 'number') fail('give "order" (all step numbers in the new order) or "step" and "to"');
    const from = resolveStep(scenario, input.step);
    const to = Math.max(0, Math.min(n - 1, (input.to as number) - 1));
    order = [...Array(n).keys()];
    order.splice(from, 1);
    order.splice(to, 0, from);
  }
  const ids = order.map((i) => scenario.steps[i].id);
  scenarioEdit(target, set, [scenario.id], () => ids.forEach((id, i) => set.moveStep(scenario.id, id, i)));
  const now = set.get(scenario.id)!;
  return ok(`Reordered the steps of scenario "${scenario.name}"`, { scenario: scenario.id, steps: now.steps.map(stepRow) });
};

export const buildScenario: Executor = async (target, input) => {
  const set = requireSet(target);
  const steps = (input.steps as Input[] | undefined) ?? [];
  if (steps.length === 0) fail('give at least one step');
  // check every step first: an unknown id anywhere changes nothing
  const prepared = steps.map((s, i) => {
    const actions = stepActions(s);
    if (i === 0 && input.resetStates !== false) actions.resetStates = true;
    return prepare(target, actions, `step ${i + 1} "${String(s.name)}"`);
  });
  const objects = collectObjects(target.graph.getDataModel());
  const restore = input.restoreDrawing === true ? captureObjectStates(objects) : null;
  const rows: Array<Record<string, unknown>> = [];
  const scenario = scenarioEdit(target, set, [], () => {
    const created = set.create(String(input.name), typeof input.description === 'string' ? input.description : '');
    let prev: string | null = null;
    steps.forEach((s, i) => {
      const changed = prepared[i].run();
      const xml = target.modelXml();
      const step = set.addStep(created.id, {
        name: String(s.name),
        description: typeof s.description === 'string' ? s.description : '',
        xml,
        uml: typeof s.uml === 'string' ? s.uml : '',
        text: typeof s.text === 'string' ? s.text : '',
      });
      rows.push({ ...stepRow(step, i), changedCells: changed, changesFromPreviousStep: diffLines(prev, xml, 8) });
      prev = xml;
    });
    if (restore) restoreObjectStates(target.graph, restore);
    return created;
  });
  return ok(`Built scenario "${scenario.name}" with ${steps.length} step${steps.length === 1 ? '' : 's'}`, {
    id: scenario.id,
    name: scenario.name,
    steps: rows,
    drawing: restore ? 'object states put back as before the call' : 'shows the last step',
  });
};

export const viewScenario: Executor = async (target, input) => {
  const set = requireSet(target);
  const scenario = resolveScenario(set, input.scenario);
  if (scenario.steps.length === 0) fail(`"${scenario.name}" has no steps to show`);
  if (!target.showScenario) fail('the scenario view is not available here');
  const index = input.step === undefined ? 0 : resolveStep(scenario, input.step);
  target.showScenario!(scenario.id, index);
  return ok(`Showing scenario "${scenario.name}" step ${index + 1}/${scenario.steps.length}`, {
    scenario: scenario.id,
    step: index + 1,
    note: 'The user sees the read-only scenario view (Prev/Next, "Back to editing"); tools keep working on the drawing.',
  });
};

export const exportScenario: Executor = async (target, input) => {
  const set = requireSet(target);
  let scenario: ScenarioData;
  if (input.scenario !== undefined) scenario = resolveScenario(set, input.scenario);
  else {
    const withSteps = set.list().filter((s) => s.steps.length > 0);
    if (withSteps.length !== 1) fail(withSteps.length === 0 ? 'no scenario has steps' : `give "scenario": ${scenarioList(set)}`);
    scenario = withSteps[0];
  }
  if (scenario.steps.length === 0) fail(`"${scenario.name}" has no steps to export`);
  if (!target.exportScenario) fail('scenario export is not available here');
  const format = String(input.format) as 'html' | 'pdf' | 'slides';
  const fileName = await target.exportScenario!(scenario.id, format, {
    ...(input.orientation === 'portrait' || input.orientation === 'landscape' ? { orientation: input.orientation } : {}),
    ...(typeof input.showChanges === 'boolean' ? { showChanges: input.showChanges } : {}),
  });
  return ok(`Exported scenario "${scenario.name}" as ${format.toUpperCase()} (downloaded ${fileName})`, { scenario: scenario.id, format, downloaded: fileName });
};
