/**
 * Points hand through railML (read from the toe, railway/hand.ts): export derives branchCourse
 * from the geometry when the hand is empty and keeps a set one; import keeps the hand and its
 * generated layout (no visualization) draws the leg on the side the hand gives.
 */
import { describe, expect, it } from 'vitest';
import type { Cell } from '@maxgraph/core';
import { exportRailml } from '../export';
import { importRailml } from '../import';
import { handOfLegCell } from '../../railway/hand';
import { collectObjects } from '../../railway/validation';
import { Layout, ertmsEntries } from './helpers';

const DATE = '2026-01-01T00:00:00Z';

/** Main track T1 (y 100, x 0..600) and a diverging track T2 a lane above/below, points W1 at x 300. */
function turnout(toeLeft: boolean, up: boolean, hand = ''): Layout {
  const l = new Layout();
  const y2 = up ? 0 : 200;
  l.line('track', { id: 'T1', kmStart: '1', kmEnd: '1.6' }, [[0, 100], [600, 100]]);
  if (toeLeft) l.line('track', { id: 'T2', kmStart: '2', kmEnd: '2.2' }, [[400, y2], [600, y2]]);
  else l.line('track', { id: 'T2', kmStart: '2', kmEnd: '2.2' }, [[0, y2], [200, y2]]);
  l.line('points', { id: 'W1', position: 'normal', ...(hand ? { hand } : {}) }, toeLeft ? [[300, 100], [400, y2]] : [[300, 100], [200, y2]]);
  return l;
}

const sw = (xml: string): Element => new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagNameNS('*', 'switchIS')[0];

describe('railML points hand (toe rule)', () => {
  it.each([
    [true, true, 'left'],
    [true, false, 'right'],
    [false, true, 'right'],
    [false, false, 'left'],
  ] as const)('toe left %s, leg up %s -> %s: export, import (with and without visualization) keep it', (toeLeft, up, hand) => {
    const xml = exportRailml(turnout(toeLeft, up).model, { date: DATE }).xml;
    const e = sw(xml);
    expect([e.getAttribute('branchCourse'), e.getAttribute('continueCourse')]).toEqual([hand, hand === 'left' ? 'right' : 'left']);
    // the branch on the hand's side is the relation to the diverging track
    expect(e.getElementsByTagNameNS('*', hand === 'left' ? 'leftBranch' : 'rightBranch')).toHaveLength(1);

    for (const text of [xml, xml.replace(/<visualizations>[\s\S]*<\/visualizations>/, '')]) {
      const imported = importRailml(text, { symbols: ertmsEntries() });
      const w1 = collectObjects(imported.model).find((o) => o.kind.id === 'points')!;
      expect(w1.values.hand).toBe(hand);
      // the drawn leg has the same hand
      expect(handOfLegCell(w1.cell as Cell)).toBe(hand);
      // and exporting again gives the same switch
      expect(sw(exportRailml(imported.model, { date: DATE }).xml).getAttribute('branchCourse')).toBe(hand);
    }
  });

  it('a set hand is kept on export (data wins over the drawing)', () => {
    const xml = exportRailml(turnout(true, true, 'right').model, { date: DATE }).xml;
    expect(sw(xml).getAttribute('branchCourse')).toBe('right');
  });
});
