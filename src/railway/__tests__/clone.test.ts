import { afterEach, describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { CLONE_DROPPED_ATTRS, prepareClonedCells } from '../clone';
import { getCellKind, readObjectId, readObjectValues } from '../object-data';
import { prepareRailwayInsert } from '../install-railway-data';
import { ClipboardService } from '../../services/clipboard-service';
import { DuplicateOffsetController } from '../../ui/duplicate-offset';
import { exportRailml } from '../../railml/export';
import { specLayout } from '../../railml/__tests__/helpers';
import { CLONE_DROPPED_ATTRS as HOVER_DROPPED_ATTRS } from '../../ui/hover-arrows';
import type { PaletteEntry } from '../../drawio-shapes/palettes/types';

let graph: Graph | null = null;
afterEach(() => {
  graph?.destroy();
  graph = null;
  ClipboardService.getInstance().clear();
});

/** The spec layout (S1..S3, B1, B2, BG1, ...) in a graph; S1 carries imported railML data. */
function setup(): { g: Graph; s1: Cell } {
  const layout = specLayout();
  const g = new Graph(document.createElement('div'), layout.model);
  graph = g;
  const s1 = Object.values(g.getDataModel().cells ?? {}).find((c) => getCellKind(c) === 'signal' && readObjectId(c) === 'S1')!;
  const value = (s1.getValue() as Element).cloneNode(true) as Element;
  value.setAttribute('rdRailmlId', 'sig_orig');
  value.setAttribute('rdRailmlNetElements', 'ne1');
  value.setAttribute('rdRoutes', 'R1');
  g.getDataModel().setValue(s1, value);
  return { g, s1 };
}

function signalIds(g: Graph): string[] {
  return Object.values(g.getDataModel().cells ?? {})
    .filter((c) => getCellKind(c) === 'signal')
    .map(readObjectId)
    .sort();
}

describe('one prepareClonedCells for every clone path', () => {
  it('keeps the same dropped attributes as the hover-arrow clone', () => {
    expect([...CLONE_DROPPED_ATTRS]).toEqual([...HOVER_DROPPED_ATTRS]);
  });

  it('copy / paste twice: S1 -> S4, S5 unique, copies without route list / railML ids', () => {
    const { g, s1 } = setup();
    const clipboard = ClipboardService.getInstance();
    clipboard.copy([s1], g);
    const first = clipboard.paste(g);
    const second = clipboard.paste(g);
    expect(readObjectId(first[0])).toBe('S4');
    expect(readObjectId(second[0])).toBe('S5');
    expect(signalIds(g)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5']);
    for (const cell of [...first, ...second]) {
      for (const attr of CLONE_DROPPED_ATTRS) expect((cell.getValue() as Element).hasAttribute(attr)).toBe(false);
    }
    // the original keeps its data
    expect((s1.getValue() as Element).getAttribute('rdRailmlId')).toBe('sig_orig');
  });

  it('cut + paste keeps the free ID and its data (a move, not a copy)', () => {
    const { g, s1 } = setup();
    const clipboard = ClipboardService.getInstance();
    clipboard.cut([s1], g);
    const pasted = clipboard.paste(g);
    expect(readObjectId(pasted[0])).toBe('S1');
    expect((pasted[0].getValue() as Element).getAttribute('rdRailmlId')).toBe('sig_orig');
  });

  it('Ctrl+D duplicate (n copies) gets unique IDs; a balise group copy keeps its balises pointing at it', () => {
    const { g, s1 } = setup();
    const controller = new DuplicateOffsetController(g);
    try {
      (controller as unknown as { duplicateWithOffset(c: Cell[], n: number, o: number): void }).duplicateWithOffset([s1], 2, 10);
      expect(signalIds(g)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5']);
      const cells = Object.values(g.getDataModel().cells ?? {});
      const bg1 = cells.find((c) => readObjectId(c) === 'BG1')!;
      const b1 = cells.find((c) => readObjectId(c) === 'B1')!;
      const clones = g.cloneCells([bg1, b1]);
      prepareClonedCells(g.getDataModel(), clones);
      expect(clones.map(readObjectId)).toEqual(['BG2', 'B3']);
      expect(readObjectValues(clones[1]).groupId).toBe('BG2');
    } finally {
      controller.destroy();
    }
  });

  it('palette insert of a non-ERTMS entry renumbers and drops copied railML data', () => {
    const { g, s1 } = setup();
    const [clone] = g.cloneCells([s1]);
    prepareRailwayInsert(g, [clone], { id: 'x', title: 'Signal', xml: '' } as unknown as PaletteEntry);
    expect(readObjectId(clone)).toBe('S4');
    expect((clone.getValue() as Element).hasAttribute('rdRailmlId')).toBe(false);
  });

  it('railML export after pasting has no duplicate ids and the preserved id stays with the original', () => {
    const { g, s1 } = setup();
    const clipboard = ClipboardService.getInstance();
    clipboard.copy([s1], g);
    clipboard.paste(g);
    clipboard.paste(g);
    const { doc, xml } = exportRailml(g.getDataModel());
    const ids = Array.from(doc.querySelectorAll('[id]')).map((e) => e.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(xml.split('id="sig_orig"').length - 1).toBe(1);
    // a copy claiming it would have been renamed by the exporter
    expect(xml).not.toMatch(/id="sig_orig_\d+"/);
  });
});
