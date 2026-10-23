/**
 * @file train-run-tool.ts
 * @brief AI tool `simulate_train_run`: simulates a train over a route or a chain of consecutive
 *        routes of the active tab (src/railway/train-run) and returns the event list (time, head
 *        position, speed, label); with createScenario=true it also adds a scenario with one step per
 *        significant moment (src/scenarios/train-run-scenario.ts) as ONE undoable edit. The drawing
 *        itself is not changed (the step drawings are made on a copy).
 */
import { formatChainage } from '../railway/km';
import { kmAtM, buildRunPath } from '../railway/train-run/run-path';
import { simulateRun } from '../railway/train-run/simulate';
import { readAttr } from '../railway/object-data';
import { collectObjects } from '../railway/validation';
import { addRunScenario, buildRunScenarioSteps } from '../scenarios/train-run-scenario';
import { requireSet, scenarioEdit } from './scenario-tools';
import { fail, findObject, ok, validIdsText } from './tool-kit';
import type { Executor } from './tool-kit';

const round = (v: number, digits = 1): number => Math.round(v * 10 ** digits) / 10 ** digits;

export const simulateTrainRun: Executor = async (target, input) => {
  const model = target.graph.getDataModel();
  const objects = collectObjects(model);
  const routes = (input.routes as string[] | undefined) ?? [];
  const built = buildRunPath(model, routes);
  if (!built.path) return fail(`${built.error ?? 'no path'}; routes: ${validIdsText(objects, ['route'])}`);
  let trainCellId: string | null = null;
  let etcsLevel = '2';
  if (typeof input.train === 'string' && input.train.trim()) {
    const found = findObject(objects, input.train, 'train');
    if (found.length === 0) return fail(`unknown train "${input.train}"; trains: ${validIdsText(objects, ['train'])} (leave "train" out for a new one)`);
    trainCellId = found[0].cellId;
    etcsLevel = readAttr(found[0].cell, 'rdEtcsLevel').trim();
  }
  const num = (key: string): number | undefined => (typeof input[key] === 'number' ? (input[key] as number) : undefined);
  const run = simulateRun(built.path, {
    speedKmh: num('speedKmh') ?? 60,
    lengthM: num('lengthM') ?? 0,
    useSpeedLimits: input.useSpeedLimits === true,
    dwellS: num('dwellS'),
    overlapReleaseS: num('overlapReleaseS'),
    setupS: num('setupS'),
  });
  const events = run.events.map((e) => {
    const km = kmAtM(run.path, e.headM);
    return {
      t: round(e.t),
      type: e.type,
      subject: e.subject,
      label: e.label,
      headM: round(e.headM),
      ...(km !== null ? { km: formatChainage(km) } : {}),
      speedKmh: round(e.speedKmh),
    };
  });
  const result: Record<string, unknown> = {
    routes: run.path.routes.map((r) => r.id),
    lengthM: round(run.path.lengthM),
    approximate: run.path.approximate,
    departS: round(run.departS),
    arriveS: round(run.arriveS),
    durationS: round(run.durationS),
    events,
    ...(run.warnings.length > 0 ? { warnings: run.warnings } : {}),
  };
  let summary = `Simulated ${run.path.routes.map((r) => r.id).join(' → ')} (${events.length} events, arrival after ${round(run.arriveS)} s)`;
  if (input.createScenario === true) {
    const set = requireSet(target);
    const steps = buildRunScenarioSteps(
      run,
      { xml: target.modelXml(), stylesheet: target.graph.getStylesheet(), htmlLabels: target.graph.isHtmlLabels() },
      { cellId: trainCellId },
      { etcsLevel, uml: input.uml !== false }
    );
    const name = typeof input.scenarioName === 'string' ? input.scenarioName : undefined;
    const scenario = scenarioEdit(target, set, [], () => addRunScenario(set, run, steps, { name }));
    result.scenario = { id: scenario.id, name: scenario.name, steps: scenario.steps.map((s, i) => ({ n: i + 1, name: s.name })) };
    summary += `; created scenario "${scenario.name}" (${scenario.steps.length} steps)`;
  }
  return ok(summary, result);
};
