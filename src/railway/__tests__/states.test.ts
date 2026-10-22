/**
 * Runtime states (states.ts scheme, state-apply.ts): attributes + style keys in one undo step,
 * exact restore of the drawn style, multi-selection, route set / occupy / release, train placement,
 * dark-mode rendering keeps the state colours, draw.io round trip.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GraphDataModel } from '@maxgraph/core';
import type { Cell, Graph } from '@maxgraph/core';
import { exportModelToDrawioXml, importDrawioXmlIntoModel } from '../../services/drawio-xml';
import { GraphCommandService } from '../../services/graph-command-service';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { adaptiveDarkColor, ensureContrast, isSaturatedColor } from '../../drawio-shapes/engine/colors';
import { styleToString } from '../../services/drawio-xml';
import { exportRailml } from '../../railml/export';
import { diffSnapshots } from '../../scenarios/scenario-diff';
import { allCells, readAttr } from '../object-data';
import {
  STATE_COLORS,
  STATE_SCHEME,
  composeVisual,
  describeStateChanges,
  parseBaseStyles,
  schemeIdFor,
  styleWithoutState,
  visualStyleKeys,
} from '../states';
import type { SchemeId } from '../states';
import {
  applyObjectStates,
  cellSchemeId,
  occupyUnderTrains,
  resetAllStates,
  resetObjectStates,
  runRouteCommand,
  sectionsUnderTrain,
  setStateOnCells,
  signalLamps,
} from '../state-apply';

const obj = (id: string, attrs: string, cell: string): string => `<object label="" id="${id}" ${attrs}>${cell}</object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const LAMP = 'ellipse;fillColor=light-dark(#ffffff, #323200);gradientColor=light-dark(#ffffff, #323200);strokeColor=#404040;';
const SECTION_STYLE = 'edgeStyle=none;endArrow=none;html=1;strokeColor=#000000;strokeWidth=4;';

const LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${obj('t1', 'rdKind="track" rdId="T1"', `<mxCell style="endArrow=none;html=1;strokeWidth=2;" edge="1" parent="1">${line(0, 300, 500, 300)}</mxCell>`)}
${obj('tc1', 'rdKind="trackSection" rdId="TC1"', `<mxCell style="${SECTION_STYLE}" edge="1" parent="1">${line(0, 100, 200, 100)}</mxCell>`)}
${obj('tc2', 'rdKind="trackSection" rdId="TC2"', `<mxCell style="${SECTION_STYLE}dashed=1;" edge="1" parent="1">${line(200, 100, 500, 100)}</mxCell>`)}
${obj('tc3', 'rdKind="trackSection" rdId="TC3"', `<mxCell style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="600" y="94" width="10" height="12" as="geometry"/></mxCell>`)}
<mxCell id="tc3a" style="endArrow=none;strokeColor=#000000;" edge="1" parent="tc3">${line(0, 0, 10, 0)}</mxCell>
<mxCell id="tc3b" style="fillColor=#000000;strokeColor=none;" vertex="1" parent="tc3"><mxGeometry x="4" y="4" width="2" height="8" as="geometry"/></mxCell>
${obj('w1', 'rdKind="points" rdId="W1"', `<mxCell style="edgeStyle=none;endArrow=none;strokeColor=#a5a5a5;strokeWidth=6;" edge="1" parent="1">${line(150, 100, 230, 180)}</mxCell>`)}
${obj('s1', 'rdKind="signal" rdId="S1" rdDirection="nominal"', `<mxCell style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="20" y="110" width="43" height="24" as="geometry"/></mxCell>`)}
<mxCell id="s1a" style="${LAMP}" vertex="1" parent="s1"><mxGeometry y="2" width="9" height="9" as="geometry"/></mxCell>
<mxCell id="s1b" style="${LAMP.replace('#ffffff, #323200);gradientColor=light-dark(#ffffff, #323200)', '#e00000, #323200);gradientColor=none')}" vertex="1" parent="s1"><mxGeometry x="9" y="2" width="9" height="9" as="geometry"/></mxCell>
<mxCell id="s1t" value="S1" style="text;html=1;fillColor=none;strokeColor=none;" vertex="1" parent="s1"><mxGeometry y="12" width="40" height="10" as="geometry"/></mxCell>
<mxCell id="s1m" style="endArrow=none;strokeColor=#404040;" edge="1" parent="s1">${line(18, 6, 43, 6)}</mxCell>
${obj('s2', 'rdKind="signal" rdId="S2"', `<mxCell style="triangle;html=1;fillColor=#000000;" vertex="1" parent="1"><mxGeometry x="450" y="110" width="20" height="20" as="geometry"/></mxCell>`)}
${obj('mb', 'rdKind="signal" rdId="MB1" rdSignalType="markerBoard"', `<mxCell style="rounded=0;" vertex="1" parent="1"><mxGeometry x="300" y="110" width="10" height="20" as="geometry"/></mxCell>`)}
${obj('tr', 'rdKind="train" rdId="TR1"', `<mxCell style="rounded=0;" vertex="1" parent="1"><mxGeometry x="40" y="80" width="100" height="16" as="geometry"/></mxCell>`)}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${obj('r1', 'rdKind="route" rdId="R1" rdEntrySignal="S1" rdExitSignal="S2" rdPoints="W1:reverse" rdSections="TC1, TC2" rdOverlap="T1"', `<mxCell style="edgeStyle=none;strokeColor=#ff8f00;strokeWidth=5;opacity=60;" edge="1" parent="rd-routes">${line(0, 100, 500, 100)}</mxCell>`)}
</root></mxGraphModel>`;

let graph: Graph | null = null;
let commands: GraphCommandService | null = null;

function setup(): { graph: Graph; cell: (id: string) => Cell; commands: GraphCommandService } {
  graph = createTestGraph();
  importDrawioXmlIntoModel(LAYOUT, graph.getDataModel());
  commands = new GraphCommandService(graph);
  const model = graph.getDataModel();
  return { graph, commands, cell: (id: string) => model.getCell(id)! };
}

function ownStyle(cell: Cell): Record<string, unknown> {
  return { ...(cell.getStyle() as unknown as Record<string, unknown>) };
}

afterEach(() => {
  commands?.destroy();
  commands = null;
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

describe('state scheme', () => {
  it('maps kinds to schemes (marker boards have no aspects)', () => {
    expect(schemeIdFor('trackSection')).toBe('section');
    expect(schemeIdFor('track')).toBe('section');
    expect(schemeIdFor('points')).toBe('points');
    expect(schemeIdFor('route')).toBe('route');
    expect(schemeIdFor('signal')).toBe('signal');
    expect(schemeIdFor('signal', 'markerBoard')).toBeNull();
    expect(schemeIdFor('signal', 'etcsStopMarker')).toBeNull();
    expect(schemeIdFor('levelCrossing')).toBe('levelCrossing');
    expect(schemeIdFor('balise')).toBe('equipment');
    expect(schemeIdFor('train')).toBeNull();
    expect(schemeIdFor(null)).toBeNull();
  });

  it('has the contract values and defaults', () => {
    expect(STATE_SCHEME.section.state!.options.map((o) => o.value)).toEqual(['free', 'occupied', 'reserved', 'overlap', 'locked', 'disturbed']);
    expect(STATE_SCHEME.signal.aspect!.options.map((o) => o.value)).toEqual(['stop', 'proceed', 'caution', 'shunt', 'dark']);
    expect(STATE_SCHEME.points.position!.options.map((o) => o.value)).toEqual(['normal', 'reverse', 'moving', 'outOfControl']);
    expect(STATE_SCHEME.section.state!.defaultValue).toBe('free');
    expect(STATE_SCHEME.signal.aspect!.defaultValue).toBe('stop');
    expect(STATE_SCHEME.points.position!.defaultValue).toBe('normal');
    expect(STATE_SCHEME.levelCrossing.state!.defaultValue).toBe('open');
  });

  it('gives each state a look and the free / reverse states none', () => {
    expect(composeVisual('section', { state: 'occupied' })).toEqual({ stroke: STATE_COLORS.occupied });
    expect(composeVisual('section', { state: 'free' })).toEqual({});
    expect(composeVisual('points', { state: 'occupied', position: 'normal' })).toEqual({ stroke: STATE_COLORS.occupied, opacity: 30 });
    expect(composeVisual('points', { state: 'reserved', position: 'outOfControl' })).toMatchObject({ stroke: STATE_COLORS.disturbed, dashPattern: '2 2' });
    expect(visualStyleKeys({ stroke: '#ff0000', dashPattern: '8 4' }, 'stroke')).toEqual({ strokeColor: '#ff0000', dashed: 1, dashPattern: '8 4' });
    expect(visualStyleKeys({ stroke: '#ff0000' }, 'fill')).toEqual({ fillColor: '#ff0000' });
    expect(visualStyleKeys({ lamp: 'none' }, 'lamp')).toEqual({ fillColor: 'none', gradientColor: 'none' });
    expect(visualStyleKeys({}, 'stroke')).toEqual({});
  });

  it('keeps every state colour in the dark rendering and readable on both canvases', () => {
    const colors = new Set<string>();
    for (const id of Object.keys(STATE_SCHEME) as SchemeId[]) {
      for (const dim of Object.values(STATE_SCHEME[id])) {
        for (const o of dim!.options) {
          if (o.visual.stroke) colors.add(o.visual.stroke);
          if (o.visual.lamp && o.visual.lamp !== 'none') colors.add(o.visual.lamp);
        }
      }
    }
    expect(colors.size).toBeGreaterThanOrEqual(8);
    for (const c of colors) {
      expect(isSaturatedColor(c), c).toBe(true);
      expect(adaptiveDarkColor(c), c).toBe(c);
    }
    // strokes: unchanged by the dark canvas floor (4.5:1 on #121212), >= 3:1 on white
    for (const id of Object.keys(STATE_SCHEME) as SchemeId[]) {
      for (const dim of Object.values(STATE_SCHEME[id])) {
        for (const o of dim!.options) {
          if (!o.visual.stroke) continue;
          expect(ensureContrast(o.visual.stroke, '#121212', 4.5), o.value).toBe(o.visual.stroke);
          expect(ensureContrast(o.visual.stroke, '#ffffff', 3), o.value).toBe(o.visual.stroke);
        }
      }
    }
  });

  it('describes state changes for change lists', () => {
    expect(describeStateChanges({ rdKind: 'trackSection' }, { rdKind: 'trackSection', rdState: 'occupied' })).toEqual(['free → occupied']);
    expect(describeStateChanges({ rdKind: 'signal', rdAspect: 'stop' }, { rdKind: 'signal', rdAspect: 'proceed' })).toEqual(['aspect stop → proceed']);
    expect(describeStateChanges({ rdKind: 'points' }, { rdKind: 'points', rdPosition: 'reverse' })).toEqual(['position normal → reverse']);
    expect(describeStateChanges({ rdKind: 'route', rdState: 'reserved' }, { rdKind: 'route' })).toEqual(['set → not set']);
    expect(describeStateChanges({ rdKind: 'balise', rdPosition: '1' }, { rdKind: 'balise', rdPosition: '2' })).toEqual([]);
    expect(describeStateChanges({ rdKind: 'trackSection', rdState: 'free' }, { rdKind: 'trackSection' })).toEqual([]);
  });

  it('parses remembered styles defensively', () => {
    expect(parseBaseStyles('not json')).toEqual({});
    expect(parseBaseStyles('[1]')).toEqual({});
    expect(parseBaseStyles('{"":{"strokeColor":"#000","bad":{}},"x":{"a":1},"0.1":{"fillColor":null}}')).toEqual({
      '': { strokeColor: '#000' },
      '0.1': { fillColor: null },
    });
    expect(styleWithoutState({ strokeColor: '#ff0000', dashed: 1, html: 1 }, { strokeColor: '#000000', dashed: null })).toEqual({ strokeColor: '#000000', html: 1 });
  });
});

describe('applying states', () => {
  it('section: attribute + strokeColor in one undo step; free restores the exact drawn style', () => {
    const { graph, cell, commands } = setup();
    const tc1 = cell('tc1');
    const before = ownStyle(tc1);
    const xmlBefore = exportModelToDrawioXml(graph.getDataModel());
    setStateOnCells(graph, [tc1], 'state', 'occupied');
    expect(readAttr(tc1, 'rdState')).toBe('occupied');
    expect(ownStyle(tc1).strokeColor).toBe(STATE_COLORS.occupied);
    expect(JSON.parse(readAttr(tc1, 'rdBaseStyle'))).toEqual({ '': { strokeColor: '#000000' } });
    const saved = exportModelToDrawioXml(graph.getDataModel());
    expect(saved).toMatch(/<object [^>]*rdState="occupied"[^>]*>\s*<mxCell [^>]*strokeColor=#ff0000/);

    // one undo step back to the drawn cell, redo again
    commands.undo();
    expect(readAttr(tc1, 'rdState')).toBe('');
    expect(ownStyle(tc1)).toEqual(before);
    commands.redo();
    expect(readAttr(tc1, 'rdState')).toBe('occupied');

    // overlap: dashes; then free: back to exactly the drawn style (byte-identical file)
    setStateOnCells(graph, [tc1], 'state', 'overlap');
    expect(ownStyle(tc1)).toMatchObject({ strokeColor: STATE_COLORS.overlap, dashed: 1, dashPattern: '8 4' });
    setStateOnCells(graph, [tc1], 'state', 'free');
    expect(readAttr(tc1, 'rdState')).toBe('free');
    expect(readAttr(tc1, 'rdBaseStyle')).toBe('');
    expect(ownStyle(tc1)).toEqual(before);
    resetObjectStates(graph, [tc1]);
    expect(exportModelToDrawioXml(graph.getDataModel())).toBe(xmlBefore);
  });

  it('keeps a drawn dash while disturbed and restores it', () => {
    const { graph, cell } = setup();
    const tc2 = cell('tc2');
    const before = ownStyle(tc2);
    setStateOnCells(graph, [tc2], 'state', 'disturbed');
    expect(ownStyle(tc2)).toMatchObject({ strokeColor: STATE_COLORS.disturbed, dashed: 1, dashPattern: '2 2' });
    setStateOnCells(graph, [tc2], 'state', 'occupied');
    expect(ownStyle(tc2).dashPattern).toBeUndefined();
    expect(ownStyle(tc2).dashed).toBe(before.dashed);
    resetObjectStates(graph, [tc2]);
    expect(ownStyle(tc2)).toEqual(before);
  });

  it('groups: strokes of the parts, fills of stroke-less parts, restored per part', () => {
    const { graph, cell } = setup();
    const tc3 = cell('tc3');
    const a = cell('tc3a');
    const b = cell('tc3b');
    const before = [ownStyle(tc3), ownStyle(a), ownStyle(b)];
    setStateOnCells(graph, [tc3], 'state', 'occupied');
    expect(ownStyle(a).strokeColor).toBe(STATE_COLORS.occupied);
    expect(ownStyle(b).fillColor).toBe(STATE_COLORS.occupied);
    expect(ownStyle(tc3)).toEqual(before[0]);
    expect(Object.keys(JSON.parse(readAttr(tc3, 'rdBaseStyle'))).sort()).toEqual(['0', '1']);
    resetObjectStates(graph, [tc3]);
    expect([ownStyle(tc3), ownStyle(a), ownStyle(b)]).toEqual(before);
    expect(readAttr(tc3, 'rdBaseStyle')).toBe('');
  });

  it('signals: the lamps take the aspect colour; a symbol without lamps gets its own fill', () => {
    const { graph, cell, commands } = setup();
    const s1 = cell('s1');
    expect(signalLamps(graph, s1).map((c) => c.getId())).toEqual(['s1a', 's1b']);
    const lampsBefore = [ownStyle(cell('s1a')), ownStyle(cell('s1b'))];
    const textBefore = ownStyle(cell('s1t'));
    setStateOnCells(graph, [s1], 'aspect', 'proceed');
    expect(readAttr(s1, 'rdAspect')).toBe('proceed');
    for (const id of ['s1a', 's1b']) expect(ownStyle(cell(id))).toMatchObject({ fillColor: STATE_COLORS.lampProceed, gradientColor: 'none' });
    expect(ownStyle(cell('s1t'))).toEqual(textBefore);
    expect(ownStyle(cell('s1m')).strokeColor).toBe('#404040');
    setStateOnCells(graph, [s1], 'aspect', 'dark');
    expect(ownStyle(cell('s1a')).fillColor).toBe('none');
    commands.undo();
    expect(ownStyle(cell('s1a')).fillColor).toBe(STATE_COLORS.lampProceed);
    resetObjectStates(graph, [s1]);
    expect([ownStyle(cell('s1a')), ownStyle(cell('s1b'))]).toEqual(lampsBefore);

    const s2 = cell('s2');
    setStateOnCells(graph, [s2], 'aspect', 'stop');
    expect(ownStyle(s2).fillColor).toBe(STATE_COLORS.lampStop);
    // marker boards have no aspects
    expect(cellSchemeId(cell('mb'))).toBeNull();
    expect(setStateOnCells(graph, [cell('mb')], 'aspect', 'proceed')).toEqual([]);
  });

  it('points: position (inactive leg faint) and occupancy combine', () => {
    const { graph, cell } = setup();
    const w1 = cell('w1');
    const before = ownStyle(w1);
    setStateOnCells(graph, [w1], 'position', 'normal');
    expect(readAttr(w1, 'rdPosition')).toBe('normal');
    expect(ownStyle(w1).opacity).toBe(30);
    setStateOnCells(graph, [w1], 'state', 'occupied');
    expect(ownStyle(w1)).toMatchObject({ strokeColor: STATE_COLORS.occupied, opacity: 30 });
    setStateOnCells(graph, [w1], 'position', 'reverse');
    expect(ownStyle(w1).opacity).toBeUndefined();
    expect(ownStyle(w1).strokeColor).toBe(STATE_COLORS.occupied);
    setStateOnCells(graph, [w1], 'position', 'outOfControl');
    expect(ownStyle(w1)).toMatchObject({ strokeColor: STATE_COLORS.disturbed, dashPattern: '2 2' });
    resetObjectStates(graph, [w1]);
    expect(ownStyle(w1)).toEqual(before);
    // the position is also data: kept, only its look goes
    expect(readAttr(w1, 'rdPosition')).toBe('outOfControl');
    expect(readAttr(w1, 'rdState')).toBe('');
  });

  it('multi-selection: one undo step for all cells, only cells that allow the value', () => {
    const { graph, cell, commands } = setup();
    const cells = [cell('tc1'), cell('tc2'), cell('w1'), cell('s1')];
    const changed = setStateOnCells(graph, cells, 'state', 'locked');
    expect(changed.length).toBeGreaterThanOrEqual(3);
    expect(['tc1', 'tc2', 'w1'].map((id) => readAttr(cell(id), 'rdState'))).toEqual(['locked', 'locked', 'locked']);
    expect(readAttr(cell('s1'), 'rdState')).toBe('');
    commands.undo();
    expect(['tc1', 'tc2', 'w1'].map((id) => readAttr(cell(id), 'rdState'))).toEqual(['', '', '']);
    // unknown values are ignored
    applyObjectStates(graph, [{ cell: cell('tc1'), change: { state: 'exploded' } }]);
    expect(readAttr(cell('tc1'), 'rdState')).toBe('');
  });

  it('route set / occupy / release update sections, overlap, points and the entry signal', () => {
    const { graph, cell, commands } = setup();
    const r1 = cell('r1');
    const w1Before = ownStyle(cell('w1'));
    const set = runRouteCommand(graph, r1, 'set');
    expect(set.missing).toEqual([]);
    expect(readAttr(r1, 'rdState')).toBe('reserved');
    expect(ownStyle(r1)).toMatchObject({ strokeColor: STATE_COLORS.reserved, opacity: 80 });
    expect(readAttr(cell('tc1'), 'rdState')).toBe('reserved');
    expect(readAttr(cell('tc2'), 'rdState')).toBe('reserved');
    expect(readAttr(cell('t1'), 'rdState')).toBe('overlap');
    expect(readAttr(cell('w1'), 'rdPosition')).toBe('reverse');
    expect(readAttr(cell('s1'), 'rdAspect')).toBe('proceed');
    expect(JSON.parse(readAttr(r1, 'rdRouteRestore'))).toEqual({ W1: '' });
    // one undo step for the whole command
    commands.undo();
    expect(['r1', 'tc1', 't1', 's1'].map((id) => readAttr(cell(id), id === 's1' ? 'rdAspect' : 'rdState'))).toEqual(['', '', '', '']);
    commands.redo();

    runRouteCommand(graph, r1, 'occupy');
    expect(readAttr(r1, 'rdState')).toBe('occupied');
    expect(ownStyle(cell('tc1')).strokeColor).toBe(STATE_COLORS.occupied);
    expect(readAttr(cell('s1'), 'rdAspect')).toBe('stop');

    runRouteCommand(graph, r1, 'release');
    expect(readAttr(r1, 'rdState')).toBe('free');
    expect(readAttr(r1, 'rdRouteRestore')).toBe('');
    expect(readAttr(cell('tc1'), 'rdState')).toBe('free');
    expect(readAttr(cell('t1'), 'rdState')).toBe('free');
    expect(readAttr(cell('w1'), 'rdPosition')).toBe('');
    expect(ownStyle(cell('w1'))).toEqual(w1Before);
    expect(readAttr(cell('s1'), 'rdAspect')).toBe('stop');
    expect(ownStyle(cell('tc1')).strokeColor).toBe('#000000');

    // reset all: no state attribute or remembered style left
    resetAllStates(graph);
    for (const c of allCells(graph.getDataModel())) {
      for (const attr of ['rdState', 'rdAspect', 'rdBaseStyle', 'rdRouteRestore']) expect(readAttr(c, attr)).toBe('');
    }
  });

  it('reports route objects missing from the drawing', () => {
    const { graph, cell } = setup();
    const model = graph.getDataModel();
    const r1 = cell('r1');
    const value = (r1.getValue() as Element).cloneNode(true) as Element;
    value.setAttribute('rdSections', 'TC1, TC9');
    model.setValue(r1, value);
    expect(runRouteCommand(graph, r1, 'set').missing).toEqual(['TC9']);
  });

  it('train placement occupies the sections under the train', () => {
    const { graph, cell } = setup();
    expect(sectionsUnderTrain(graph, cell('tr')).map((c) => c.getId())).toEqual(['tc1']);
    occupyUnderTrains(graph, [cell('tr')], true);
    expect(readAttr(cell('tc1'), 'rdState')).toBe('occupied');
    occupyUnderTrains(graph, [cell('tr')], false);
    expect(readAttr(cell('tc1'), 'rdState')).toBe('free');
  });

  it('survives a draw.io round trip (attributes and colours in the file)', () => {
    const { graph, cell } = setup();
    setStateOnCells(graph, [cell('tc1')], 'state', 'occupied');
    setStateOnCells(graph, [cell('s1')], 'aspect', 'caution');
    const xml = exportModelToDrawioXml(graph.getDataModel());
    const restored = new GraphDataModel();
    importDrawioXmlIntoModel(xml, restored);
    expect(readAttr(restored.getCell('tc1'), 'rdState')).toBe('occupied');
    expect(styleToString(restored.getCell('s1a')!.getStyle())).toContain(`fillColor=${STATE_COLORS.lampCaution}`);
    expect(exportModelToDrawioXml(restored)).toBe(xml);
  });

  it('scenario change lists name the state change (parts folded in)', () => {
    const { graph, cell } = setup();
    const model = graph.getDataModel();
    const before = exportModelToDrawioXml(model);
    setStateOnCells(graph, [cell('tc1')], 'state', 'occupied');
    setStateOnCells(graph, [cell('s1')], 'aspect', 'proceed');
    setStateOnCells(graph, [cell('w1')], 'position', 'reverse');
    setStateOnCells(graph, [cell('tc3')], 'state', 'locked');
    const diff = diffSnapshots(before, exportModelToDrawioXml(model));
    expect(diff.changes.map((c) => c.summary).sort()).toEqual(['S1: aspect stop → proceed', 'TC1: free → occupied', 'TC3: free → locked', 'W1: position normal → reverse']);
    expect(diff.counts.changed).toBe(4);
    // a style edit next to a state change is still listed
    const later = exportModelToDrawioXml(model);
    setStateOnCells(graph, [cell('tc1')], 'state', 'free');
    model.setStyle(cell('tc2'), { ...(cell('tc2').getStyle() as object), strokeWidth: 8 } as never);
    expect(diffSnapshots(later, exportModelToDrawioXml(model)).changes.map((c) => c.summary).sort()).toEqual(['TC1: occupied → free', 'TC2: style changed (strokeWidth)']);
  });

  it('railML export: no runtime state attributes, the drawn style in the rd extension', () => {
    const { graph, cell } = setup();
    const model = graph.getDataModel();
    const plain = exportRailml(model, { date: '2026-01-01' }).xml;
    setStateOnCells(graph, [cell('tc1'), cell('tc2'), cell('w1')], 'state', 'occupied');
    runRouteCommand(graph, cell('r1'), 'set');
    const xml = exportRailml(model, { date: '2026-01-01' }).xml;
    for (const word of ['rdState', 'rdAspect', 'rdBaseStyle', 'rdRouteRestore', STATE_COLORS.occupied, STATE_COLORS.reserved]) expect(xml).not.toContain(word);
    // only the points position (data) differs from the stateless export
    expect(xml.replace(/ rdPosition="reverse"/g, '')).toBe(plain);
  });
});
