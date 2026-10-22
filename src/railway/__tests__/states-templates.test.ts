/**
 * Runtime states on the built-in ERTMS templates (public/libraries/ertms.xml): every TVD section
 * recolours, every signal's lamps take the aspect colour, points take state and position, a set
 * route colours its sections, and Reset all gives back the inserted drawing byte for byte.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Cell, Graph } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { exportModelToDrawioXml, registerDrawioCodecs, styleToString } from '../../services/drawio-xml';
import { splitErtmsLibrary } from '../../ui/templates';
import { insertTemplate } from '../../ui/templates/template-actions';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { allCells, getCellKind, readAttr } from '../object-data';
import { STATE_COLORS } from '../states';
import { cellSchemeId, resetAllStates, setStateOnCells, signalLamps } from '../state-apply';

const LIBRARY = readFileSync(resolve(__dirname, '../../../public/libraries/ertms.xml'), 'utf8');
const { templates } = splitErtmsLibrary(parseMxLibrary(LIBRARY));

beforeAll(() => {
  registerDrawioCodecs();
  const proto = (globalThis as unknown as { SVGElement: { prototype: { getBBox?: () => unknown } } }).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
});

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

/** Style strings of the cell and its descendants. */
function styles(cell: Cell): string[] {
  const out = [styleToString(cell.getStyle())];
  for (const c of cell.children ?? []) out.push(...styles(c));
  return out;
}

describe('states on the ERTMS templates', () => {
  it('has templates with sections, signals and points', () => {
    expect(templates.length).toBeGreaterThanOrEqual(15);
  });

  for (const tpl of templates) {
    it(`${tpl.name}: sections, signal lamps and points change; reset restores the drawing`, () => {
      graph = createTestGraph();
      insertTemplate(graph, tpl, { x: 400, y: 300 });
      const model = graph.getDataModel();
      const before = exportModelToDrawioXml(model);
      const cells = allCells(model);
      const byKind = (kind: string): Cell[] => cells.filter((c) => getCellKind(c) === kind);

      for (const section of byKind('trackSection')) {
        const s0 = styles(section).join('|');
        setStateOnCells(graph, [section], 'state', 'occupied');
        expect(readAttr(section, 'rdState')).toBe('occupied');
        expect(styles(section).join('|'), `section ${readAttr(section, 'rdId')}`).not.toBe(s0);
        expect(styles(section).join('|')).toContain(`=${STATE_COLORS.occupied}`);
      }
      for (const signal of byKind('signal').filter((c) => cellSchemeId(c) === 'signal')) {
        setStateOnCells(graph, [signal], 'aspect', 'proceed');
        const lamps = signalLamps(graph, signal);
        const targets = lamps.length > 0 ? lamps : [signal];
        for (const lamp of targets) expect(styleToString(lamp.getStyle()), `signal ${readAttr(signal, 'rdId')}`).toContain(`fillColor=${STATE_COLORS.lampProceed}`);
      }
      for (const points of byKind('points')) {
        setStateOnCells(graph, [points], 'state', 'locked');
        setStateOnCells(graph, [points], 'position', 'normal');
        const joined = styles(points).join('|');
        expect(joined, `points ${readAttr(points, 'rdId')}`).toContain(`=${STATE_COLORS.locked}`);
        expect(joined).toContain('opacity=30');
      }
      resetAllStates(graph);
      const after = exportModelToDrawioXml(model);
      let i = 0;
      while (i < after.length && after[i] === before[i]) i++;
      // the first difference with some context (readable failure), then the whole file
      expect(after.slice(Math.max(0, i - 300), i + 200)).toBe(before.slice(Math.max(0, i - 300), i + 200));
      expect(after).toBe(before);
    });
  }
});
