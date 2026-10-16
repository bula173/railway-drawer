/**
 * Object data on cells: draw.io object values, round trip through the draw.io file format
 * (attributes, Polish characters, numbers), undo of data edits, inserts with pre-assigned kinds,
 * label placeholders, templates and scenarios keeping the data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cell, Geometry, GraphDataModel } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import { exportModelToDrawioXml, importDrawioXmlIntoModel, installUserObjectLabels } from '../../services/drawio-xml';
import { GraphCommandService } from '../../services/graph-command-service';
import { insertEntry } from '../../ui/drawio-palette/entry-cells';
import type { PaletteEntry } from '../../ui/drawio-palette/contracts';
import { extractTemplate } from '../../ui/templates/template-extract';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import {
  applyPresetToNewCells,
  buildDataValue,
  getCellKind,
  labelIdChange,
  labelShowsId,
  nextFreeId,
  readObjectId,
  readObjectValues,
  setRailwayData,
  usedIds,
} from '../object-data';
import { assignKindForInsertedShape, prepareRailwayInsert } from '../install-railway-data';

function newModel(): { model: GraphDataModel; layer: Cell } {
  const model = new GraphDataModel();
  return { model, layer: model.getRoot()!.getChildAt(0) };
}

function addVertex(model: GraphDataModel, layer: Cell, id: string, value: unknown, x = 0, y = 0, w = 40, h = 20): Cell {
  const cell = new Cell(value, new Geometry(x, y, w, h), {});
  cell.setVertex(true);
  cell.setId(id);
  model.add(layer, cell);
  return cell;
}

function roundTrip(model: GraphDataModel): { xml: string; model: GraphDataModel } {
  const xml = exportModelToDrawioXml(model);
  const restored = new GraphDataModel();
  importDrawioXmlIntoModel(xml, restored);
  expect(exportModelToDrawioXml(restored)).toBe(xml);
  return { xml, model: restored };
}

describe('buildDataValue', () => {
  it('turns a plain label into a draw.io <object> and back', () => {
    const value = buildDataValue('Wjazd A', { kind: 'signal', values: { id: 'S12', km: '12.345' } }) as Element;
    expect(value.nodeName).toBe('object');
    expect(value.getAttribute('label')).toBe('Wjazd A');
    expect(value.getAttribute('rdKind')).toBe('signal');
    expect(value.getAttribute('rdId')).toBe('S12');
    expect(value.getAttribute('rdKm')).toBe('12.345');
    expect(buildDataValue(value, { kind: null })).toBe('Wjazd A');
  });

  it('keeps a UserObject and its other attributes; never mutates the old value', () => {
    const doc = document.implementation.createDocument(null, null, null);
    const user = doc.createElement('UserObject');
    user.setAttribute('label', 'x');
    user.setAttribute('tags', 'Background');
    const next = buildDataValue(user, { kind: 'points', values: { hand: 'left' } }) as Element;
    expect(next).not.toBe(user);
    expect(next.nodeName).toBe('UserObject');
    expect(next.getAttribute('tags')).toBe('Background');
    expect(user.hasAttribute('rdKind')).toBe(false);
    // removing the kind keeps a UserObject that still has other attributes
    const removed = buildDataValue(next, { kind: null }) as Element;
    expect(removed.nodeName).toBe('UserObject');
    expect(removed.getAttribute('tags')).toBe('Background');
    expect(removed.hasAttribute('rdHand')).toBe(false);
  });

  it('changing the kind drops fields the new kind does not have, keeps shared ones', () => {
    const balise = buildDataValue('', { kind: 'balise', values: { id: 'B1', groupId: 'BG1', km: '3' } });
    const group = buildDataValue(balise, { kind: 'baliseGroup' }) as Element;
    expect(group.getAttribute('rdId')).toBe('B1');
    expect(group.getAttribute('rdKm')).toBe('3');
    expect(group.hasAttribute('rdGroupId')).toBe(false);
  });

  it('returns the same value when nothing changes; rejects unknown kinds and fields', () => {
    const v = buildDataValue('', { kind: 'track', values: { id: 'T1' } });
    expect(buildDataValue(v, { values: { id: 'T1' } })).toBe(v);
    expect(() => buildDataValue('', { kind: 'nope' as never })).toThrow(/Unknown railway object kind/);
    expect(() => buildDataValue(v, { values: { aspects: '3' } })).toThrow(/has no field/);
    expect(() => buildDataValue('', { values: { id: 'x' } })).toThrow(/Set a kind/);
  });
});

describe('file round trip', () => {
  it('writes object attributes draw.io shows in Edit Data and reads them back (Polish text, numbers)', () => {
    const { model, layer } = newModel();
    const signal = addVertex(model, layer, 'sig', 'Semafor wjazdowy „Łódź Kaliska” – żółty');
    setRailwayData(model, [signal], {
      kind: 'signal',
      values: { id: 'S12', km: '12.345', aspects: '4', direction: 'reverse', notes: 'Zażółć gęślą jaźń & <test> "cudzysłów"' },
    });
    const bg = addVertex(model, layer, 'bg', '');
    setRailwayData(model, [bg], { kind: 'baliseGroup', values: { id: 'BG1', nidC: '1023', nidBg: '16383', count: '2', km: '-0.05' } });
    addVertex(model, layer, 'plain', 'Zwykły kształt');

    const { xml, model: restored } = roundTrip(model);
    expect(xml).toContain('<object label="Semafor wjazdowy „Łódź Kaliska” – żółty" rdKind="signal" rdId="S12"');
    expect(xml).toContain('rdNidBg="16383"');
    expect(xml).toContain('&lt;test&gt; &quot;cudzysłów&quot;');
    expect(xml).toContain('<mxCell id="plain" value="Zwykły kształt"');
    // the <mxCell> inside the object has no id (draw.io writes it on the wrapper)
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const wrapper = Array.from(doc.getElementsByTagName('object')).find((o) => o.getAttribute('id') === 'sig')!;
    expect(wrapper.getElementsByTagName('mxCell')[0].hasAttribute('id')).toBe(false);

    const s = restored.getCell('sig')!;
    expect(getCellKind(s)).toBe('signal');
    expect(readObjectValues(s)).toEqual({
      id: 'S12', direction: 'reverse', km: '12.345', aspects: '4', notes: 'Zażółć gęślą jaźń & <test> "cudzysłów"',
    });
    expect(readObjectValues(restored.getCell('bg')!)).toMatchObject({ nidC: '1023', nidBg: '16383', count: '2', km: '-0.05' });
    expect(getCellKind(restored.getCell('plain')!)).toBeNull();
    expect(restored.getCell('plain')!.getValue()).toBe('Zwykły kształt');
  });

  it('reads files written by draw.io (<object> with placeholders, unknown attributes kept)', () => {
    const xml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<object label="%rdId% km %rdKm%" placeholders="1" rdKind="balise" rdId="B7" rdKm="1,5" myAttr="keep" id="b">' +
      '<mxCell style="triangle;" vertex="1" parent="1"><mxGeometry width="12" height="12" as="geometry"/></mxCell></object>' +
      '</root></mxGraphModel>';
    const graph = createTestGraph();
    try {
      installUserObjectLabels(graph);
      importDrawioXmlIntoModel(xml, graph.getDataModel());
      const cell = graph.getDataModel().getCell('b')!;
      expect(readObjectId(cell)).toBe('B7');
      expect(graph.convertValueToString(cell)).toBe('B7 km 1,5');
      expect(exportModelToDrawioXml(graph.getDataModel())).toContain('myAttr="keep"');
    } finally {
      cleanupTestGraph(graph);
    }
  });
});

describe('edits through the model', () => {
  let graph: Graph;
  let commands: GraphCommandService;
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    graph = createTestGraph();
    installUserObjectLabels(graph);
    commands = new GraphCommandService(graph);
  });
  afterEach(() => {
    commands.destroy();
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  const vertex = (label: string, x = 0): Cell => {
    let cell!: Cell;
    graph.batchUpdate(() => {
      cell = graph.insertVertex(graph.getDefaultParent(), null, label, x, 0, 40, 20);
    });
    return cell;
  };

  it('a data edit on several cells is one undoable edit; undo/redo restore values', () => {
    const a = vertex('A');
    const b = vertex('B', 100);
    commands.clearHistory();
    const changed = setRailwayData(graph.getDataModel(), [a, b], { kind: 'signal' }, { autoId: true });
    expect(changed).toEqual([a, b]);
    expect([readObjectId(a), readObjectId(b)]).toEqual(['S1', 'S2']);
    setRailwayData(graph.getDataModel(), [a, b], { values: { km: '5' } });
    expect(readObjectValues(a).km).toBe('5');

    commands.undo();
    expect(readObjectValues(a).km).toBeUndefined();
    expect(readObjectId(a)).toBe('S1');
    commands.undo();
    expect(a.getValue()).toBe('A');
    expect(b.getValue()).toBe('B');
    expect(commands.canUndo()).toBe(false);
    commands.redo();
    expect(getCellKind(b)).toBe('signal');
    commands.redo();
    expect(readObjectValues(b).km).toBe('5');
    // label editing keeps the data
    graph.cellLabelChanged(a, 'Nowa etykieta', false);
    expect(readObjectValues(a)).toMatchObject({ id: 'S1', km: '5' });
    expect(graph.convertValueToString(a)).toBe('Nowa etykieta');
  });

  it('no-op edits add no history', () => {
    const a = vertex('A');
    setRailwayData(graph.getDataModel(), [a], { kind: 'track', values: { id: 'T1' } });
    commands.clearHistory();
    expect(setRailwayData(graph.getDataModel(), [a], { values: { id: 'T1' } })).toEqual([]);
    expect(commands.canUndo()).toBe(false);
  });

  it('generated IDs skip used ones (case-insensitive)', () => {
    const a = vertex('A');
    setRailwayData(graph.getDataModel(), [a], { kind: 'baliseGroup', values: { id: 'bg1' } });
    expect(usedIds(graph.getDataModel(), 'baliseGroup')).toEqual(new Set(['BG1']));
    expect(nextFreeId('baliseGroup', usedIds(graph.getDataModel(), 'baliseGroup'))).toBe('BG2');
  });

  it('ERTMS palette insert pre-assigns the kind in the same undoable edit', () => {
    const entry: PaletteEntry = {
      id: 'ertms-3-single-balise-right',
      title: 'Single Balise Right',
      kind: 'cells',
      width: 12,
      height: 12,
      xml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" parent="1" style="triangle;whiteSpace=wrap;html=1;" value="" vertex="1"><mxGeometry height="12" width="12" as="geometry"/></mxCell></root></mxGraphModel>',
      shapeNames: ['triangle'],
      cls: 'a',
      source: 'libraries/ertms.xml#3',
    };
    commands.clearHistory();
    const [first] = insertEntry(graph, entry, { x: 50, y: 50 }, (cells) => prepareRailwayInsert(graph, cells, entry));
    const [second] = insertEntry(graph, entry, { x: 150, y: 50 }, (cells) => prepareRailwayInsert(graph, cells, entry));
    expect(getCellKind(first)).toBe('balise');
    expect(readObjectValues(first)).toEqual({ id: 'B1', direction: 'nominal' });
    expect(readObjectId(second)).toBe('B2');
    // the style string is untouched (draw.io parity)
    expect(exportModelToDrawioXml(graph.getDataModel())).toContain('style="triangle;whiteSpace=wrap;html=1;"');
    commands.undo();
    commands.undo();
    expect(graph.getChildCells(graph.getDefaultParent())).toHaveLength(0);
    expect(commands.canUndo()).toBe(false);

    // other palettes: no kind
    const other = { ...entry, id: 'general-1-triangle', source: 'js/grapheditor/Sidebar.js:1' };
    const [plain] = insertEntry(graph, other, undefined, (cells) => prepareRailwayInsert(graph, cells, other));
    expect(getCellKind(plain)).toBeNull();
  });

  it('app railway shapes get their kind on drop', () => {
    let cell!: Cell;
    graph.batchUpdate(() => {
      cell = graph.insertVertex(graph.getDefaultParent(), null, '', 0, 0, 40, 40, { shape: 'customSwitch' } as never);
      assignKindForInsertedShape(graph, cell);
    });
    expect(getCellKind(cell)).toBe('points');
    expect(readObjectId(cell)).toBe('W1');
    commands.undo();
    expect(graph.getChildCells(graph.getDefaultParent())).toHaveLength(0);
  });

  it('applyPresetToNewCells keeps existing IDs of copied cells', () => {
    const cell = new Cell(buildDataValue('', { kind: 'signal', values: { id: 'S9' } }), new Geometry(0, 0, 10, 10), {});
    applyPresetToNewCells(graph.getDataModel(), [cell], { kind: 'signal', values: { aspects: '3' } });
    expect(readObjectValues(cell)).toEqual({ id: 'S9', aspects: '3' });
  });

  it('label shows the ID through a draw.io placeholder', () => {
    const a = vertex('');
    const b = vertex('Wjazd', 100);
    setRailwayData(graph.getDataModel(), [a, b], { kind: 'signal' }, { autoId: true });
    setRailwayData(graph.getDataModel(), [a, b], (c) => labelIdChange(c, true));
    expect(labelShowsId(a) && labelShowsId(b)).toBe(true);
    expect(graph.convertValueToString(a)).toBe('S1');
    expect(graph.convertValueToString(b)).toBe('Wjazd S2');
    setRailwayData(graph.getDataModel(), [b], { values: { id: 'S20' } });
    expect(graph.convertValueToString(b)).toBe('Wjazd S20');
    setRailwayData(graph.getDataModel(), [a, b], (c) => labelIdChange(c, false));
    expect(graph.convertValueToString(b)).toBe('Wjazd');
    expect((b.getValue() as Element).hasAttribute('placeholders')).toBe(false);
    expect(labelShowsId(a)).toBe(false);
  });

  it('templates and scenario snapshots keep the data (they serialize the model)', () => {
    const a = vertex('Semafor');
    setRailwayData(graph.getDataModel(), [a], { kind: 'signal', values: { id: 'S1', km: '1.2' } });
    graph.setSelectionCells([a]);
    const template = extractTemplate(graph)!;
    expect(template.xml).toContain('rdKind="signal"');
    expect(template.xml).toContain('rdKm="1.2"');
    // clones (copy/paste, duplicate) copy the value element
    const [clone] = graph.cloneCells([a]);
    expect(readObjectValues(clone)).toEqual({ id: 'S1', km: '1.2' });
    expect(clone.getValue()).not.toBe(a.getValue());
  });
});
