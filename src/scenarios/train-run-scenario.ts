/**
 * @file train-run-scenario.ts
 * @brief "Create scenario from run": a scenario whose steps are the significant moments of a train
 *        run (src/railway/train-run: route set, departure, each block occupied / freed, signals back
 *        to stop, points released, arrival, overlap released; events at the same time are one
 *        step). Each step gets a name, a Markdown text (time, head position in m / km, speed, the
 *        events) and, optionally, a PlantUML sequence diagram of the messages between the
 *        Interlocking, the RBC (ETCS level 2: movement authority request / grant, position reports)
 *        and the train. The drawings are snapshots made on a scratch graph (the run's states put on
 *        a copy of the drawing with RunRenderer), so the live drawing is never touched; the steps go
 *        into the tab's ScenarioSet like any other, so the view, autoplay and the PDF / slides
 *        exports work unchanged.
 */
import { Graph, GraphDataModel } from '@maxgraph/core';
import type { Stylesheet } from '@maxgraph/core';
import { exportModelToDrawioXml, importModelXml, sanitizeXmlText } from '../services/drawio-xml';
import { formatChainage } from '../railway/km';
import { kmAtM } from '../railway/train-run/run-path';
import { RunRenderer } from '../railway/train-run/run-renderer';
import type { TrainChoice } from '../railway/train-run/run-renderer';
import { formatSeconds } from '../railway/train-run/simulate';
import type { RunEvent, RunResult } from '../railway/train-run/simulate';
import type { ScenarioData, ScenarioSet } from './scenario-model';

export interface RunScenarioOptions {
  /** Scenario name (default "Train run <routes>"). */
  name?: string;
  /** Add the PlantUML sequence of each step (default true). */
  uml?: boolean;
  /** ETCS level of the train ('2': RBC with MA request / grant). */
  etcsLevel?: string;
}

export interface RunScenarioStep {
  name: string;
  description: string;
  xml: string;
  uml: string;
  text: string;
  /** Time of the moment (s). */
  t: number;
}

/** Events at the same time, in run order. */
export interface RunMoment {
  t: number;
  events: RunEvent[];
}

export function runMoments(run: Pick<RunResult, 'events'>): RunMoment[] {
  const out: RunMoment[] = [];
  for (const e of run.events) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.t - e.t) < 1e-6) last.events.push(e);
    else out.push({ t: e.t, events: [e] });
  }
  return out;
}

function shortLabel(e: RunEvent): string {
  switch (e.type) {
    case 'route-set':
      return `Route ${e.subject} set`;
    case 'depart':
      return 'Departure';
    case 'signal-passed':
      return `${e.subject} to stop`;
    case 'head-enter':
      return `${e.subject} occupied`;
    case 'tail-clear':
      return `${e.subject} freed`;
    case 'points-released':
      return `${e.subject} unlocked`;
    case 'route-released':
      return `${e.subject} released`;
    case 'arrive':
      return `Arrival at ${e.subject}`;
    case 'overlap-released':
      return `Overlap ${e.subject} released`;
  }
}

/** Step name of a moment: its short labels (at most 80 characters). */
export function momentName(m: RunMoment): string {
  const labels = m.events.map(shortLabel);
  let name = labels.join(', ');
  for (let n = labels.length - 1; name.length > 80 && n >= 1; n--) name = `${labels.slice(0, n).join(', ')} +${labels.length - n} more`;
  return name.slice(0, 80);
}

function position(run: RunResult, m: number): string {
  const first = run.path.routes[0]?.entry ?? 'the start';
  const km = kmAtM(run.path, m);
  return `${Math.round(m)} m from ${first}${km !== null ? ` (km ${formatChainage(km)})` : ''}${run.path.approximate ? ' ≈' : ''}`;
}

function stepText(run: RunResult, m: RunMoment, index: number, trainId: string): string {
  const head = m.events[m.events.length - 1].headM;
  const speed = Math.round(Math.max(...m.events.map((e) => e.speedKmh)));
  const lines = [
    `**Time:** ${formatSeconds(m.t)} · **Head:** ${position(run, head)} · **Speed:** ${speed} km/h`,
    '',
    ...m.events.map((e) => `- ${e.label}`),
  ];
  if (index === 0) {
    const o = run.options;
    lines.push(
      '',
      '| Train | Routes | Path | Speed | Length |',
      '|---|---|---|---|---|',
      `| ${trainId} | ${run.path.routes.map((r) => r.id).join(' → ')} | ${Math.round(run.path.lengthM)} m | ${o.speedKmh} km/h${o.useSpeedLimits ? ' (section limits)' : ''} | ${Math.round(o.lengthM)} m |`
    );
    for (const w of run.warnings) lines.push('', `> ${w}`);
  }
  return lines.join('\n');
}

/** PlantUML sequence of a moment (Interlocking, RBC for ETCS level 2, the train). */
export function momentUml(run: RunResult, m: RunMoment, trainId: string, etcsLevel: string): string {
  const l2 = etcsLevel.trim() === '2';
  const out = ['@startuml', 'participant "Interlocking" as IXL'];
  if (l2) out.push('participant "RBC" as RBC');
  out.push(`participant "Train ${trainId}" as T`);
  const exit = run.path.routes[run.path.routes.length - 1]?.exit ?? '';
  const lastSet = m.events.filter((x) => x.type === 'route-set').at(-1);
  if (l2 && lastSet) out.push('T -> RBC: MA request');
  for (const e of m.events) {
    switch (e.type) {
      case 'route-set': {
        const r = run.path.routes.find((x) => x.id === e.subject);
        if (l2) out.push(`RBC -> IXL: route request ${e.subject}`);
        for (const p of r?.points ?? []) out.push(`IXL -> IXL: points ${p.id} ${p.position}, locked`);
        out.push(`note over IXL: ${e.subject} set, ${r?.entry ?? ''} proceed`);
        if (l2) out.push(`IXL -> RBC: ${e.subject} set and locked`);
        else out.push(`IXL -> T: ${r?.entry ?? ''} proceed`);
        if (l2 && e === lastSet) out.push(`RBC -> T: MA granted (EoA ${exit}, ${Math.round(run.path.lengthM)} m)`);
        break;
      }
      case 'depart':
        out.push(`note over T: departs at ${Math.round(e.speedKmh)} km/h`);
        break;
      case 'signal-passed':
        out.push(`note over IXL: ${e.subject} back to stop`);
        if (l2) out.push(`T -> RBC: position report (${Math.round(e.headM)} m)`);
        break;
      case 'head-enter':
        out.push(`note over IXL: ${e.subject} occupied`);
        break;
      case 'tail-clear':
        out.push(`note over IXL: ${e.subject} free, released`);
        if (l2) out.push(`IXL -> RBC: ${e.subject} released`);
        break;
      case 'points-released':
        out.push(`note over IXL: points ${e.subject} unlocked`);
        break;
      case 'route-released':
        out.push(`note over IXL: route ${e.subject} released`);
        if (l2) out.push(`IXL -> RBC: route ${e.subject} released`);
        break;
      case 'arrive':
        if (l2) out.push(`T -> RBC: position report: standstill at ${e.subject}`);
        else out.push(`note over T: stops at ${e.subject}`);
        break;
      case 'overlap-released':
        out.push(`note over IXL: overlap ${e.subject} released (timer)`);
        if (l2) out.push('IXL -> RBC: overlap released');
        break;
    }
  }
  out.push('@enduml');
  return out.join('\n');
}

export interface RunSnapshotSource {
  /** The drawing as draw.io model XML (DiagramDocument.serializeToXml()). */
  xml: string;
  /** Stylesheet of the live graph (resolved styles decide which parts take a state's look). */
  stylesheet: Stylesheet;
  htmlLabels?: boolean;
}

/**
 * The scenario steps of a run: one per moment, the drawing at that moment (states + train), the
 * Markdown text and the PlantUML sequence.
 */
export function buildRunScenarioSteps(run: RunResult, source: RunSnapshotSource, train: TrainChoice, options: RunScenarioOptions = {}): RunScenarioStep[] {
  const model = new GraphDataModel();
  const page = importModelXml(sanitizeXmlText(source.xml), model) ?? undefined;
  const host = document.createElement('div');
  const graph = new Graph(host, model, [], source.stylesheet);
  try {
    const renderer = new RunRenderer(graph, run, train);
    const level = options.etcsLevel ?? '';
    const moments = runMoments(run);
    return moments.map((m, i) => {
      renderer.showAt(m.t);
      const xml = exportModelToDrawioXml(model, { stylesheet: source.stylesheet, page, htmlLabels: source.htmlLabels });
      return {
        t: m.t,
        name: momentName(m),
        description: `t = ${formatSeconds(m.t)}`,
        xml,
        text: stepText(run, m, i, renderer.trainId),
        uml: options.uml === false ? '' : momentUml(run, m, renderer.trainId, level),
      };
    });
  } finally {
    graph.destroy();
  }
}

/** Adds the run's scenario to `set` (one scenario, its steps in order); returns it. */
export function addRunScenario(set: ScenarioSet, run: RunResult, steps: RunScenarioStep[], options: RunScenarioOptions = {}): ScenarioData {
  const routes = run.path.routes.map((r) => r.id).join(' → ');
  const name = options.name?.trim() || `Train run ${routes}`;
  const description = `${routes}, ${run.options.speedKmh} km/h, ${Math.round(run.options.lengthM)} m train, ${formatSeconds(run.arriveS)} to ${run.path.routes.at(-1)?.exit ?? 'the exit'}`;
  const created = set.create(name, description);
  for (const s of steps) set.addStep(created.id, { name: s.name, description: s.description, xml: s.xml, uml: s.uml, text: s.text });
  return set.get(created.id)!;
}
