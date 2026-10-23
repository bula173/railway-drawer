/**
 * @file step-actions.ts
 * @brief Runtime state changes the AI makes on the drawing: object states (set_states) and the
 *        states / route actions of a scenario step (add_scenario_step, build_scenario). Resolving is
 *        separate from applying, so a step with an unknown id changes nothing.
 */
import type { Cell, Graph } from '@maxgraph/core';
import { applyObjectStates, cellSchemeId, readStates, resetAllStates, resetObjectStates, runRouteCommand } from '../railway/state-apply';
import type { StateItem } from '../railway/state-apply';
import { schemeDimensions, stateOption } from '../railway/states';
import type { StateDimension } from '../railway/states';
import type { RailObject } from '../railway/validation';
import { findObject, validIdsText } from './tool-kit';
import type { Input } from './tool-kit';

export const STATE_DIMENSIONS: StateDimension[] = ['state', 'aspect', 'position'];

/** Kinds that carry runtime states (named in "valid ids" messages). */
const STATE_KINDS = ['trackSection', 'track', 'points', 'signal', 'route', 'levelCrossing', 'balise', 'baliseGroup', 'leu', 'axleCounter', 'insulatedJoint'] as const;

export interface ResolvedStates {
  stateItems: StateItem[];
  resetCells: Cell[];
  problems: string[];
  /** Ids that match no object. */
  unknown: string[];
}

/** Resolves `[{id, kind?, state?, aspect?, position?, reset?}]` against the drawing's objects. */
export function resolveStateItems(objects: RailObject[], items: Input[]): ResolvedStates {
  const out: ResolvedStates = { stateItems: [], resetCells: [], problems: [], unknown: [] };
  for (const item of items) {
    const found = findObject(objects, String(item.id), item.kind as string | undefined);
    if (found.length === 0) {
      out.unknown.push(String(item.id));
      out.problems.push(`${String(item.id)}: not found`);
      continue;
    }
    for (const o of found) {
      if (item.reset === true) {
        out.resetCells.push(o.cell);
        continue;
      }
      const scheme = cellSchemeId(o.cell);
      if (!scheme) {
        out.problems.push(`${o.id}: ${o.kind.label.toLowerCase()} has no states`);
        continue;
      }
      const change: StateItem['change'] = {};
      for (const d of STATE_DIMENSIONS) {
        const v = item[d];
        if (typeof v !== 'string') continue;
        const dim = schemeDimensions(scheme).find((x) => x.dimension === d);
        if (!dim) {
          out.problems.push(`${o.id}: no ${d}`);
          continue;
        }
        if (v.trim() === '') change[d] = null;
        else if (stateOption(scheme, d, v.trim())) change[d] = v.trim();
        else out.problems.push(`${o.id}: ${d} "${v}" is not one of ${dim.options.map((x) => x.value).join('|')}`);
      }
      if (Object.keys(change).length > 0) out.stateItems.push({ cell: o.cell, change });
    }
  }
  return out;
}

export interface StepActions {
  /** Absolute states for listed objects: `[{id, state|aspect|position}]` ("" = default). */
  states?: Input[];
  /** Route actions, run before `states`: `[{id, action: set|occupy|release}]`. */
  routes?: Input[];
  /** Reset every object's state (free / stop / normal) before the routes and states. */
  resetStates?: boolean;
}

export interface PreparedStep {
  run(): number;
}

/**
 * Checks a step's states and route actions against the drawing and returns the runner, or throws
 * an Error naming the unknown ids together with the valid ones (nothing changed then).
 */
export function prepareStepActions(graph: Graph, objects: RailObject[], actions: StepActions, label = 'step'): PreparedStep {
  const states = resolveStateItems(objects, actions.states ?? []);
  const problems = [...states.problems];
  const routeCalls: Array<{ cell: Cell; action: 'set' | 'occupy' | 'release' }> = [];
  const unknownRoutes: string[] = [];
  for (const r of actions.routes ?? []) {
    const route = findObject(objects, String(r.id), 'route')[0];
    if (!route) {
      unknownRoutes.push(String(r.id));
      continue;
    }
    routeCalls.push({ cell: route.cell, action: r.action as 'set' | 'occupy' | 'release' });
  }
  if (problems.length > 0 || unknownRoutes.length > 0) {
    const parts: string[] = [];
    if (states.unknown.length > 0) parts.push(`unknown object id(s) ${states.unknown.join(', ')} — valid ids: ${validIdsText(objects, STATE_KINDS)}`);
    const other = problems.filter((p) => !p.endsWith(': not found'));
    if (other.length > 0) parts.push(other.slice(0, 10).join('; '));
    if (unknownRoutes.length > 0) {
      const routes = validIdsText(objects, ['route']);
      parts.push(`unknown route(s) ${unknownRoutes.join(', ')} — ${routes === 'none' ? 'the drawing has no routes: create one with the routes tool (action add, from/to signal ids) first' : `valid routes: ${routes}`}`);
    }
    throw new Error(`${label}: ${parts.join('. ')}. Nothing was changed.`);
  }
  return {
    run: () => {
      let changed = 0;
      const model = graph.getDataModel();
      model.beginUpdate();
      try {
        if (actions.resetStates) changed += resetAllStates(graph).length;
        for (const r of routeCalls) changed += runRouteCommand(graph, r.cell, r.action).changed.length;
        if (states.resetCells.length > 0) changed += resetObjectStates(graph, states.resetCells).length;
        if (states.stateItems.length > 0) changed += applyObjectStates(graph, states.stateItems).length;
      } finally {
        model.endUpdate();
      }
      return changed;
    },
  };
}

/** States of every object with a scheme (to put the drawing back after build_scenario). */
export function captureObjectStates(objects: RailObject[]): Array<{ cell: Cell; states: Record<StateDimension, string> }> {
  return objects.filter((o) => cellSchemeId(o.cell)).map((o) => ({ cell: o.cell, states: readStates(o.cell) }));
}

/** Puts captured states back (only on objects whose states differ now). */
export function restoreObjectStates(graph: Graph, captured: ReturnType<typeof captureObjectStates>): number {
  const items: StateItem[] = [];
  for (const { cell, states } of captured) {
    const now = readStates(cell);
    const scheme = cellSchemeId(cell);
    if (!scheme) continue;
    const change: StateItem['change'] = {};
    for (const dim of schemeDimensions(scheme)) {
      const d = dim.dimension;
      if ((now[d] ?? '') !== (states[d] ?? '')) change[d] = states[d] ? states[d] : null;
    }
    if (Object.keys(change).length > 0) items.push({ cell, change });
  }
  return items.length > 0 ? applyObjectStates(graph, items).length : 0;
}
