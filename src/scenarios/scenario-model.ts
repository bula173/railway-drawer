/**
 * @file scenario-model.ts
 * @brief Scenarios of one diagram (tab): named, ordered lists of steps, each step a snapshot of the
 *        whole drawing (a draw.io `<mxGraphModel>`) with a name and a description.
 *
 * `ScenarioSet` is the per-tab store (held by the tab's ProjectService, saved into the .drawio file
 * as one page per step, see scenario-format.ts, and into the tab cache as JSON). Every read returns
 * copies, every change notifies the subscribers (the Scenarios panel, the scenario view).
 */

export interface ScenarioStepData {
  id: string;
  name: string;
  description: string;
  /** Snapshot of the whole drawing: a native draw.io `<mxGraphModel>` (optionally followed by comments). */
  xml: string;
}

export interface ScenarioData {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStepData[];
}

export const MAX_SCENARIO_NAME = 80;
export const MAX_SCENARIO_DESCRIPTION = 200;

/** Random id in draw.io's page-id alphabet (step ids double as page ids of the step pages). */
export function generateScenarioId(prefix = ''): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = new Uint8Array(20);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return prefix + Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function cleanName(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, MAX_SCENARIO_NAME);
}

function cleanDescription(value: unknown): string {
  return (typeof value === 'string' ? value.trim() : '').slice(0, MAX_SCENARIO_DESCRIPTION);
}

function copyStep(step: ScenarioStepData): ScenarioStepData {
  return { id: step.id, name: step.name, description: step.description, xml: step.xml };
}

function copyScenario(scenario: ScenarioData): ScenarioData {
  return { id: scenario.id, name: scenario.name, description: scenario.description, steps: scenario.steps.map(copyStep) };
}

/**
 * Validates untrusted scenario data (tab cache, parsed file): drops entries without a usable
 * snapshot, fills missing names, makes scenario and step ids unique.
 */
export function sanitizeScenarios(raw: unknown): ScenarioData[] {
  if (!Array.isArray(raw)) return [];
  const scenarioIds = new Set<string>();
  const stepIds = new Set<string>();
  const unique = (wanted: unknown, used: Set<string>, prefix: string): string => {
    let id = typeof wanted === 'string' && wanted && !used.has(wanted) ? wanted : generateScenarioId(prefix);
    while (used.has(id)) id = generateScenarioId(prefix);
    used.add(id);
    return id;
  };
  const result: ScenarioData[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const s = item as Record<string, unknown>;
    const steps: ScenarioStepData[] = [];
    if (Array.isArray(s.steps)) {
      for (const stepItem of s.steps) {
        if (typeof stepItem !== 'object' || stepItem === null) continue;
        const st = stepItem as Record<string, unknown>;
        if (typeof st.xml !== 'string' || !st.xml.trim().startsWith('<')) continue;
        steps.push({
          id: unique(st.id, stepIds, ''),
          name: cleanName(st.name, `Step ${steps.length + 1}`),
          description: cleanDescription(st.description),
          xml: st.xml,
        });
      }
    }
    result.push({
      id: unique(s.id, scenarioIds, 'scn-'),
      name: cleanName(s.name, `Scenario ${result.length + 1}`),
      description: cleanDescription(s.description),
      steps,
    });
  }
  return result;
}

export type ScenarioListener = () => void;

export class ScenarioSet {
  private scenarios: ScenarioData[] = [];
  private listeners = new Set<ScenarioListener>();

  constructor(initial: ScenarioData[] = []) {
    this.scenarios = sanitizeScenarios(initial);
  }

  /** Calls `listener` after every change; returns the unsubscribe function. */
  subscribe(listener: ScenarioListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[Scenarios] Listener failed:', error);
      }
    }
  }

  list(): ScenarioData[] {
    return this.scenarios.map(copyScenario);
  }

  get size(): number {
    return this.scenarios.length;
  }

  get(id: string): ScenarioData | null {
    const scenario = this.find(id);
    return scenario ? copyScenario(scenario) : null;
  }

  /** Total number of steps over all scenarios. */
  stepCount(): number {
    return this.scenarios.reduce((sum, s) => sum + s.steps.length, 0);
  }

  /** Replaces everything (file load, cache restore). */
  replaceAll(scenarios: ScenarioData[]): void {
    this.scenarios = sanitizeScenarios(scenarios);
    this.changed();
  }

  /** JSON-safe copy (tab cache). */
  toJSON(): ScenarioData[] {
    return this.list();
  }

  private find(id: string): ScenarioData | undefined {
    return this.scenarios.find((s) => s.id === id);
  }

  private require(id: string): ScenarioData {
    const scenario = this.find(id);
    if (!scenario) throw new Error(`Unknown scenario ${id}`);
    return scenario;
  }

  private newScenarioId(): string {
    let id = generateScenarioId('scn-');
    while (this.find(id)) id = generateScenarioId('scn-');
    return id;
  }

  private newStepId(): string {
    const used = new Set(this.scenarios.flatMap((s) => s.steps.map((st) => st.id)));
    let id = generateScenarioId();
    while (used.has(id)) id = generateScenarioId();
    return id;
  }

  create(name: string, description = ''): ScenarioData {
    const scenario: ScenarioData = {
      id: this.newScenarioId(),
      name: cleanName(name, `Scenario ${this.scenarios.length + 1}`),
      description: cleanDescription(description),
      steps: [],
    };
    this.scenarios.push(scenario);
    this.changed();
    return copyScenario(scenario);
  }

  update(id: string, fields: { name?: string; description?: string }): void {
    const scenario = this.require(id);
    if (fields.name !== undefined) scenario.name = cleanName(fields.name, scenario.name);
    if (fields.description !== undefined) scenario.description = cleanDescription(fields.description);
    this.changed();
  }

  remove(id: string): void {
    const before = this.scenarios.length;
    this.scenarios = this.scenarios.filter((s) => s.id !== id);
    if (this.scenarios.length !== before) this.changed();
  }

  /** Copy (new ids) inserted right after the original, named "<name> (copy)". */
  duplicate(id: string): ScenarioData {
    const source = this.require(id);
    const copy: ScenarioData = {
      id: this.newScenarioId(),
      name: cleanName(`${source.name} (copy)`, source.name),
      description: source.description,
      steps: [],
    };
    this.scenarios.splice(this.scenarios.indexOf(source) + 1, 0, copy);
    for (const step of source.steps) copy.steps.push({ ...copyStep(step), id: this.newStepId() });
    this.changed();
    return copyScenario(copy);
  }

  /** Moves a scenario to `toIndex` (clamped). */
  moveScenario(id: string, toIndex: number): void {
    const scenario = this.require(id);
    const from = this.scenarios.indexOf(scenario);
    const to = Math.max(0, Math.min(this.scenarios.length - 1, toIndex));
    if (from === to) return;
    this.scenarios.splice(from, 1);
    this.scenarios.splice(to, 0, scenario);
    this.changed();
  }

  // ------------------------------------------------------------------ steps

  /** Appends a step (or inserts it at `index`) with the given drawing snapshot. */
  addStep(scenarioId: string, step: { name: string; description?: string; xml: string }, index?: number): ScenarioStepData {
    const scenario = this.require(scenarioId);
    const created: ScenarioStepData = {
      id: this.newStepId(),
      name: cleanName(step.name, `Step ${scenario.steps.length + 1}`),
      description: cleanDescription(step.description),
      xml: step.xml,
    };
    const at = index === undefined ? scenario.steps.length : Math.max(0, Math.min(scenario.steps.length, index));
    scenario.steps.splice(at, 0, created);
    this.changed();
    return copyStep(created);
  }

  private requireStep(scenarioId: string, stepId: string): { scenario: ScenarioData; step: ScenarioStepData; index: number } {
    const scenario = this.require(scenarioId);
    const index = scenario.steps.findIndex((s) => s.id === stepId);
    if (index < 0) throw new Error(`Unknown step ${stepId}`);
    return { scenario, step: scenario.steps[index], index };
  }

  updateStep(scenarioId: string, stepId: string, fields: { name?: string; description?: string; xml?: string }): void {
    const { step } = this.requireStep(scenarioId, stepId);
    if (fields.name !== undefined) step.name = cleanName(fields.name, step.name);
    if (fields.description !== undefined) step.description = cleanDescription(fields.description);
    if (fields.xml !== undefined) step.xml = fields.xml;
    this.changed();
  }

  removeStep(scenarioId: string, stepId: string): void {
    const { scenario, index } = this.requireStep(scenarioId, stepId);
    scenario.steps.splice(index, 1);
    this.changed();
  }

  /** Copy right after the original, named "<name> (copy)". */
  duplicateStep(scenarioId: string, stepId: string): ScenarioStepData {
    const { scenario, step, index } = this.requireStep(scenarioId, stepId);
    const copy: ScenarioStepData = { ...copyStep(step), id: this.newStepId(), name: cleanName(`${step.name} (copy)`, step.name) };
    scenario.steps.splice(index + 1, 0, copy);
    this.changed();
    return copyStep(copy);
  }

  /** Moves a step to `toIndex` within its scenario (clamped). */
  moveStep(scenarioId: string, stepId: string, toIndex: number): void {
    const { scenario, step, index } = this.requireStep(scenarioId, stepId);
    const to = Math.max(0, Math.min(scenario.steps.length - 1, toIndex));
    if (to === index) return;
    scenario.steps.splice(index, 1);
    scenario.steps.splice(to, 0, step);
    this.changed();
  }
}
