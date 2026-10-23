/**
 * @file state-menu.ts
 * @brief What the context menu / Railway menu offer for runtime states of the selected objects:
 *        a submenu per state dimension (State / Aspect / Position) with the allowed values (radio
 *        checks: the common current value), Reset State, the route commands on routes and the
 *        train placement commands on trains. Commands are strings for the window event
 *        `railway-state-request` (install-railway-states.ts): `state:<value>`, `aspect:<value>`,
 *        `position:<value>`, `reset`, `resetAll`, `setRoute`, `releaseRoute`, `occupyRoute`,
 *        `occupyUnderTrain`, `freeUnderTrain`, `toggleLegend`.
 */
import type { Cell } from '@maxgraph/core';
import { getCellKind } from './object-data';
import { cellSchemeId, hasRuntimeState, readStates } from './state-apply';
import type { StateDimension, StateVisual } from './states';
import { DIMENSION_LABEL, STATE_DIMENSIONS, STATE_SCHEME, effectiveValue } from './states';

export const STATE_REQUEST_EVENT = 'railway-state-request' as const;

export interface StateMenuOption {
  value: string;
  label: string;
  command: string;
  checked: boolean;
  visual: StateVisual;
}

export interface StateMenuSubmenu {
  type: 'submenu';
  dimension: StateDimension;
  label: string;
  options: StateMenuOption[];
}

export interface StateMenuItem {
  type: 'item';
  command: string;
  label: string;
  title?: string;
}

export type StateMenuEntry = StateMenuSubmenu | StateMenuItem;

/** The state entries for the selected cells ([] when none of them has runtime states). */
export function buildStateMenu(cells: Cell[]): StateMenuEntry[] {
  const out: StateMenuEntry[] = [];
  const typed = cells.map((cell) => ({ cell, scheme: cellSchemeId(cell) })).filter((x) => x.scheme !== null);
  for (const dim of STATE_DIMENSIONS) {
    const holders = typed.filter((x) => !!STATE_SCHEME[x.scheme!][dim]);
    if (holders.length === 0) continue;
    // values every holder allows, in the first holder's order
    const first = STATE_SCHEME[holders[0].scheme!][dim]!;
    const options = first.options.filter((o) => holders.every((h) => STATE_SCHEME[h.scheme!][dim]!.options.some((x) => x.value === o.value)));
    if (options.length === 0) continue;
    const current = holders.map((h) => effectiveValue(h.scheme!, dim, readStates(h.cell)[dim]));
    out.push({
      type: 'submenu',
      dimension: dim,
      label: DIMENSION_LABEL[dim],
      options: options.map((o) => ({
        value: o.value,
        label: o.label,
        command: `${dim}:${o.value}`,
        checked: current.every((v) => v === o.value),
        visual: o.visual,
      })),
    });
  }
  const routes = cells.filter((c) => getCellKind(c) === 'route');
  if (routes.length > 0) {
    out.push(
      { type: 'item', command: 'setRoute', label: 'Set Route', title: 'Route set (green): sections reserved, points in position, entry signal proceed' },
      { type: 'item', command: 'occupyRoute', label: 'Occupy Route', title: 'Train on the route: its sections occupied (red), entry signal stop' },
      { type: 'item', command: 'releaseRoute', label: 'Release Route', title: 'Sections free, entry signal stop, points back to their previous positions' }
    );
  }
  const trains = cells.filter((c) => getCellKind(c) === 'train');
  if (trains.length > 0) {
    out.push(
      { type: 'item', command: 'occupyUnderTrain', label: 'Occupy Sections Under Train', title: 'Track sections below the train become occupied' },
      { type: 'item', command: 'freeUnderTrain', label: 'Free Sections Under Train' }
    );
  }
  if (typed.length > 0 || cells.some(hasRuntimeState)) {
    out.push({ type: 'item', command: 'reset', label: 'Reset State', title: 'Back to the drawn colours (state and aspect removed)' });
  }
  return out;
}
