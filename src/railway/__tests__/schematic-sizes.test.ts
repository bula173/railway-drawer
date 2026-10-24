/**
 * The schematic builder (schematic.ts: railML import, Railway Script) draws railway symbols in the
 * standard sizes (symbol-sizes.ts): the ERTMS library symbols it uses, the built-in ETCS marker
 * boards and the fallback shapes; a Railway Script drawing of every kind has them.
 */
import { describe, expect, it } from 'vitest';
import { parseScript } from '../../railway-script/parse';
import { buildScriptModel } from '../../railway-script/build';
import { ertmsEntries } from '../../railml/__tests__/helpers';
import { collectObjects } from '../validation';
import { Symbols, defaultSize, markerBoardSymbol } from '../schematic';
import { SYMBOL_SIZES, standardSize } from '../symbol-sizes';
import type { SymbolClass } from '../symbol-sizes';

const sizeOf = (s: { w: number; h: number } | null): { w: number; h: number } | null => (s ? { w: s.w, h: s.h } : null);

describe('schematic builder symbol sizes', () => {
  it('fallback sizes are the standard boxes', () => {
    const classes: Array<[Parameters<typeof defaultSize>[0], SymbolClass]> = [
      ['signal', 'signal'], ['balise', 'balise'], ['axleCounter', 'axleCounter'], ['insulatedJoint', 'insulatedJoint'],
      ['leu', 'leu'], ['rbc', 'rbc'], ['bufferStop', 'bufferStop'], ['levelCrossing', 'levelCrossing'], ['train', 'train'],
    ];
    for (const [kind, cls] of classes) {
      const { w, h } = standardSize(cls);
      expect(defaultSize(kind), kind).toEqual([w, h]);
    }
    expect(defaultSize('signal', 'markerBoard')).toEqual([SYMBOL_SIZES.board.w, SYMBOL_SIZES.board.h]);
  });

  it('library symbols for signals (every aspect count, both directions), balises, joints, trains and marker boards', () => {
    const symbols = new Symbols(ertmsEntries());
    const signal = standardSize('signal');
    for (const direction of ['nominal', 'reverse']) {
      for (const aspects of ['2', '3', '4']) expect(sizeOf(symbols.forItem({ kind: 'signal', values: { direction, aspects } })), `${direction} ${aspects}`).toEqual(signal);
      expect(sizeOf(symbols.forItem({ kind: 'balise', values: { direction } }))).toEqual(standardSize('balise'));
      for (const signalType of ['markerBoard', 'etcsStopMarker']) {
        expect(sizeOf(symbols.forItem({ kind: 'signal', values: { direction, signalType } }))).toEqual(standardSize('board'));
      }
    }
    expect(sizeOf(symbols.forItem({ kind: 'insulatedJoint', values: {} }))).toEqual(standardSize('insulatedJoint'));
    expect(sizeOf(symbols.forItem({ kind: 'train', values: {} }))).toEqual(standardSize('train'));
    const board = new DOMParser().parseFromString(markerBoardSymbol('markerBoard', 'reverse').xml, 'application/xml');
    expect(board.getElementsByTagName('parsererror')).toHaveLength(0);
  });

  it('a Railway Script drawing has every symbol in its standard size', () => {
    const text = `railwayScript: 1
tracks:
  - { id: T1, startKm: 0.000, endKm: 1.000 }
signals:
  - { id: S1, track: T1, at: 0.100, direction: nominal, aspects: 3 }
  - { id: S2, track: T1, at: 0.300, direction: reverse, aspects: 4 }
  - { id: MB1, track: T1, at: 0.500, type: markerBoard }
  - { id: SM1, track: T1, at: 0.550, type: etcsStopMarker, direction: reverse }
balises:
  - { id: B1, track: T1, at: 0.600 }
axleCounters:
  - { id: AC1, track: T1, at: 0.700 }
leus:
  - { id: LEU1, track: T1, at: 0.750 }
bufferStops:
  - { id: BS1, track: T1, at: 0.990 }
levelCrossings:
  - { id: LC1, track: T1, at: 0.850 }
`;
    const parsed = parseScript(text);
    expect(parsed.model, JSON.stringify(parsed.diagnostics)).toBeTruthy();
    const { model } = buildScriptModel(parsed.model!, ertmsEntries());
    const got = new Map(collectObjects(model).map((o) => [o.id, { w: o.cell.getGeometry()!.width, h: o.cell.getGeometry()!.height }]));
    const want: Record<string, SymbolClass> = { S1: 'signal', S2: 'signal', MB1: 'board', SM1: 'board', B1: 'balise', AC1: 'axleCounter', LEU1: 'leu', BS1: 'bufferStop', LC1: 'levelCrossing' };
    for (const [id, cls] of Object.entries(want)) expect(got.get(id), id).toEqual(standardSize(cls));
  });
});
