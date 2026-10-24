/**
 * Arrange > Normalize Symbol Sizes (normalize-sizes.ts): railway symbols drawn in other sizes get
 * their standard box in one undoable edit around their centres: a signal's lamps one diameter beside
 * the mast (the state lamps still found), a marker board's face beside its post, a train the
 * standard height, single shapes the class box; symbols already standard and other cells stay.
 */
import type { Graph } from '@maxgraph/core';
import { InternalEvent, UndoManager } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { importDrawioXmlIntoModel, registerDrawioCodecs } from '../../services/drawio-xml';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { normalizeSymbolSizes, selectedSymbols } from '../normalize-sizes';
import { signalLamps } from '../state-apply';
import { SYMBOL_SIZES, standardSize } from '../symbol-sizes';

const LAMP = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ff0000;strokeColor=#000000;';
const LINE = 'endArrow=none;html=1;rounded=0;strokeColor=#000000;';
const edge = (id: string, parent: string, a: [number, number], b: [number, number]): string =>
  `<mxCell id="${id}" style="${LINE}" edge="1" parent="${parent}"><mxGeometry relative="1" as="geometry"><mxPoint x="${a[0]}" y="${a[1]}" as="sourcePoint"/><mxPoint x="${b[0]}" y="${b[1]}" as="targetPoint"/></mxGeometry></mxCell>`;
const vertex = (id: string, parent: string, style: string, x: number, y: number, w: number, h: number, value = ''): string =>
  `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;

const XML = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
  // an ERTMS-like signal 42x26: mast, arm, 3 lamps of 9, the ID text on top
  + '<object label="" rdKind="signal" rdId="S1" rdSignalType="main" rdDirection="nominal" rdAspects="3" id="sig"><mxCell style="group" vertex="1" parent="1" connectable="0"><mxGeometry x="100" y="100" width="42" height="26" as="geometry"/></mxCell></object>'
  + edge('m', 'sig', [7, 11], [7, 25]) + edge('a', 'sig', [7, 18], [15, 18])
  + vertex('l1', 'sig', LAMP, 15, 14, 9, 9) + vertex('l2', 'sig', LAMP, 24, 14, 9, 9) + vertex('l3', 'sig', LAMP, 33, 14, 9, 9)
  + vertex('t', 'sig', 'text;html=1;fontSize=9;', 0, 0, 40, 10, 'S1')
  // a marker board 17x14: post, arm, 12x12 face
  + '<object label="" rdKind="signal" rdId="MB1" rdSignalType="markerBoard" rdDirection="nominal" id="mb"><mxCell style="group" vertex="1" parent="1" connectable="0"><mxGeometry x="200" y="100" width="17" height="14" as="geometry"/></mxCell></object>'
  + edge('mbp', 'mb', [1, 0], [1, 14]) + edge('mba', 'mb', [1, 7], [5, 7]) + vertex('mbf', 'mb', 'rounded=0;fillColor=#0050aa;', 5, 1, 12, 12)
  // a balise 10x10, an LEU 34x18, a train group 68x27
  + `<object label="" rdKind="balise" rdId="B1" id="bal">${vertex('', '1', 'triangle;', 300, 100, 10, 10).replace(' id=""', '').replace(' value=""', '')}</object>`
  + `<object label="LEU" rdKind="leu" rdId="LEU1" id="leu">${vertex('', '1', 'rounded=0;', 400, 100, 34, 18).replace(' id=""', '').replace(' value=""', '')}</object>`
  + '<object label="" rdKind="train" rdId="TR1" id="tr"><mxCell style="group" vertex="1" parent="1" connectable="0"><mxGeometry x="500" y="100" width="68" height="27" as="geometry"/></mxCell></object>'
  + vertex('trb', 'tr', 'rounded=0;', 0, 10, 68, 17) + vertex('trt', 'tr', 'text;html=1;', 14, 0, 40, 10, 'ETCS L2')
  // an axle counter already standard, and a plain shape
  + `<object label="" rdKind="axleCounter" rdId="AC1" id="ac">${vertex('', '1', 'ellipse;', 600, 100, 12, 12).replace(' id=""', '').replace(' value=""', '')}</object>`
  + vertex('plain', '1', 'rounded=0;', 700, 100, 33, 17)
  + '</root></mxGraphModel>';

beforeAll(() => registerDrawioCodecs());

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

const size = (g: Graph, id: string): { w: number; h: number } => {
  const geo = g.getDataModel().getCell(id)!.getGeometry()!;
  return { w: geo.width, h: geo.height };
};
const centre = (g: Graph, id: string): { x: number; y: number } => {
  const geo = g.getDataModel().getCell(id)!.getGeometry()!;
  return { x: geo.x + geo.width / 2, y: geo.y + geo.height / 2 };
};

describe('Normalize Symbol Sizes', () => {
  it('gives the selected railway symbols their standard box in one undoable edit', () => {
    graph = createTestGraph();
    const g = graph;
    const model = g.getDataModel();
    importDrawioXmlIntoModel(XML, model);
    const undo = new UndoManager();
    model.addListener(InternalEvent.UNDO, ((_s: unknown, evt: { getProperty(n: string): unknown }) => undo.undoableEditHappened(evt.getProperty('edit') as never)) as never);
    const ids = ['sig', 'mb', 'bal', 'leu', 'tr', 'ac', 'plain'];
    const before = new Map(ids.map((id) => [id, { s: size(g, id), c: centre(g, id) }]));
    g.setSelectionCells(ids.map((id) => model.getCell(id)!));
    const symbols = selectedSymbols(g);
    expect(symbols.map((c) => c.id)).toEqual(['sig', 'mb', 'bal', 'leu', 'tr', 'ac']);
    const changed = normalizeSymbolSizes(g, symbols);
    expect(changed.map((c) => c.id)).toEqual(['sig', 'mb', 'bal', 'leu', 'tr']);
    expect(size(g, 'sig')).toEqual(standardSize('signal'));
    expect(size(g, 'mb')).toEqual(standardSize('board'));
    expect(size(g, 'bal')).toEqual(standardSize('balise'));
    expect(size(g, 'leu')).toEqual(standardSize('leu'));
    expect(size(g, 'tr')).toEqual({ w: 50, h: SYMBOL_SIZES.train.h });
    expect(size(g, 'ac')).toEqual(standardSize('axleCounter'));
    expect(size(g, 'plain')).toEqual({ w: 33, h: 17 });
    for (const id of ['sig', 'mb', 'bal', 'leu', 'tr']) expect(centre(g, id), id).toEqual(before.get(id)!.c);
    // the signal: lamps of one diameter in the head band (track side: the head was drawn at the
    // bottom, it stays there), the mast at the standard inset, the ID text in the label band
    const S = SYMBOL_SIZES.signal;
    const lamps = signalLamps(g, model.getCell('sig')!);
    expect(lamps).toHaveLength(3);
    const y0 = S.h - S.head;
    for (const l of lamps) expect(l.getGeometry()!.width).toBe(S.lamp);
    expect(lamps.map((l) => l.getGeometry()!.y)).toEqual([y0 + 2, y0 + 2, y0 + 2]);
    expect(model.getCell('m')!.getGeometry()!.sourcePoint!.x).toBe(S.mastInset);
    expect(model.getCell('t')!.getGeometry()!.y).toBe(0);
    // the marker board face: the symbol face beside the post
    expect(size(g, 'mbf')).toEqual({ w: SYMBOL_SIZES.board.symbolFace[0], h: SYMBOL_SIZES.board.symbolFace[1] });
    // one undo step restores everything
    undo.undo();
    for (const id of ids) expect(size(g, id), id).toEqual(before.get(id)!.s);
    expect(model.getCell('l1')!.getGeometry()!.width).toBe(9);
  });

  it('symbols already in their standard size are not changed', () => {
    graph = createTestGraph();
    importDrawioXmlIntoModel(XML, graph.getDataModel());
    expect(normalizeSymbolSizes(graph, [graph.getDataModel().getCell('ac')!])).toEqual([]);
  });
});
