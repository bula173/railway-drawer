/**
 * railML 3.2 export: the spec layout (2 tracks, points, 3 signals, balise group, axle counter,
 * section, route) -> expected XML structure; directions; unplaced objects; extension on/off.
 */
import { describe, expect, it } from 'vitest';
import { exportRailml } from '../export';
import { importRailml } from '../import';
import { checkRailmlStructure } from '../structure';
import { RAILML_NS, RD_NS, isNcName } from '../xml';
import { Layout, all, fixture, parse, specLayout } from './helpers';
import { readCountryId, setCountryId } from '../../railway/project-settings';
import { exportModelToDrawioXml, importDrawioXmlIntoModel } from '../../services/drawio-xml';
import { GraphDataModel } from '@maxgraph/core';
import { collectObjects } from '../../railway/validation';

const DATE = '2026-01-01T00:00:00Z';

function byId(doc: Document, id: string): Element {
  const el = all(doc, '*').find((e) => e.getAttribute('id') === id);
  if (!el) throw new Error(`no element ${id}`);
  return el;
}

function child(el: Element, name: string): Element | null {
  return Array.from(el.children).find((c) => c.localName === name) ?? null;
}

describe('railML export of the spec layout', () => {
  const r = exportRailml(specLayout().model, { title: 'Spec', date: DATE });
  const doc = parse(r.xml);

  it('matches the expected document (fixtures/spec-layout.expected.railml)', () => {
    expect(r.xml).toBe(fixture('spec-layout.expected.railml'));
  });

  it('is a railML 3.2 document with metadata and a km positioning system', () => {
    const root = doc.documentElement;
    expect(root.localName).toBe('railML');
    expect(root.namespaceURI).toBe(RAILML_NS);
    expect(root.getAttribute('version')).toBe('3.2');
    expect(Array.from(root.children).map((c) => c.localName)).toEqual(['metadata', 'common', 'infrastructure', 'interlocking', 'visualizations', 'railwayDrawer']);
    expect(doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0].textContent).toBe('Spec');
    const lps = all(doc, 'linearPositioningSystem')[0];
    expect(lps.getAttribute('units')).toBe('m');
    expect(checkRailmlStructure(doc)).toEqual([]);
  });

  it('writes the topology: netElements per track piece and netRelations at the junction', () => {
    expect(all(doc, 'netElement').map((e) => [e.getAttribute('id'), e.getAttribute('length')])).toEqual([
      ['ne_T1_1', '200'],
      ['ne_T1_2', '400'],
      ['ne_T2_1', '500'],
      ['ne_W1_1', '141.421'],
    ]);
    // km of the track ends as linear coordinates (metres)
    const ic = all(byId(doc, 'ne_T1_2'), 'linearCoordinate').map((c) => c.getAttribute('measure'));
    expect(ic).toEqual(['10200', '10600']);
    const rels = all(doc, 'netRelation').map((e) => [child(e, 'elementA')!.getAttribute('ref'), child(e, 'elementB')!.getAttribute('ref'), e.getAttribute('positionOnA'), e.getAttribute('positionOnB'), e.getAttribute('navigability')]);
    expect(rels).toEqual([
      ['ne_T1_1', 'ne_T1_2', '1', '0', 'Both'],
      ['ne_T1_1', 'ne_W1_1', '1', '0', 'Both'],
      ['ne_T1_2', 'ne_W1_1', '0', '0', 'None'],
      ['ne_T2_1', 'ne_W1_1', '0', '1', 'Both'],
    ]);
    expect(all(doc, 'networkResource')).toHaveLength(8);
  });

  it('writes tracks, the switch and signals with locations', () => {
    const t1 = byId(doc, 'trk_T1');
    expect(t1.getAttribute('type')).toBe('mainTrack');
    expect(child(t1, 'name')!.getAttribute('name')).toBe('Main line');
    expect(child(t1, 'designator')!.getAttribute('entry')).toBe('T1');
    expect(all(t1, 'associatedNetElement').map((a) => a.getAttribute('netElementRef'))).toEqual(['ne_T1_1', 'ne_T1_2']);

    const sw = byId(doc, 'sw_W1');
    expect([sw.getAttribute('type'), sw.getAttribute('continueCourse'), sw.getAttribute('branchCourse')]).toEqual(['ordinarySwitch', 'left', 'right']);
    expect(child(sw, 'rightBranch')!.getAttribute('netRelationRef')).toBe('nr_T1_1_W1_1');
    expect(child(sw, 'leftBranch')!.getAttribute('netRelationRef')).toBe('nr_T1_1_T1_2');
    expect(child(sw, 'spotLocation')!.getAttribute('intrinsicCoord')).toBe('1');

    const s1 = byId(doc, 'sig_S1');
    const sl = child(s1, 'spotLocation')!;
    expect([sl.getAttribute('netElementRef'), sl.getAttribute('intrinsicCoord'), sl.getAttribute('applicationDirection')]).toEqual(['ne_T1_1', '0.25', 'normal']);
    expect(child(sl, 'linearCoordinate')!.getAttribute('measure')).toBe('10050');
    expect(child(s1, 'isTrainMovementSignal')).not.toBeNull();
    expect(child(s1, 'signalConstruction')!.getAttribute('type')).toBe('light');
    expect(child(byId(doc, 'sig_S3'), 'isEtcsSignal')).not.toBeNull();
    expect(all(doc, 'signalIS')).toHaveLength(3);
  });

  it('writes the balise group, balises, axle counter and TVD section', () => {
    const bg = byId(doc, 'bg_BG1');
    expect(child(bg, 'isEurobaliseGroup')!.getAttribute('countryID')).toBe('353');
    expect(child(bg, 'isEurobaliseGroup')!.getAttribute('groupID')).toBe('1201');
    expect(child(bg, 'applicationType')!.getAttribute('value')).toBe('ETCS');
    expect(bg.getAttribute('numberOfBalisesInGroup')).toBe('2');
    const b2 = byId(doc, 'bal_B2');
    expect(b2.getAttribute('belongsToBaliseGroup')).toBe('bg_BG1');
    expect(child(b2, 'isEurobalise')!.getAttribute('positionInGroup')).toBe('1');
    const tde = byId(doc, 'tde_AC1');
    expect([tde.getAttribute('type'), tde.getAttribute('detectedObject')]).toEqual(['axleCounter', 'axle']);
    const tvd = byId(doc, 'tvd_TS1');
    expect(tvd.getAttribute('technology')).toBe('axleCounter');
    expect(child(tvd, 'hasDemarcatingTraindetector')!.getAttribute('ref')).toBe('tde_AC1');
  });

  it('writes the route in the interlocking part', () => {
    const rt = byId(doc, 'rt_R1');
    const facing = child(rt, 'facingSwitchInPosition')!;
    expect(facing.getAttribute('inPosition')).toBe('right');
    expect(child(facing, 'refersToSwitch')!.getAttribute('ref')).toBe('il_sw_W1');
    expect(child(byId(doc, 'il_sw_W1'), 'refersTo')!.getAttribute('ref')).toBe('sw_W1');
    const entry = child(child(rt, 'routeEntry')!, 'refersTo')!.getAttribute('ref')!;
    const exit = child(child(rt, 'routeExit')!, 'refersTo')!.getAttribute('ref')!;
    expect(child(byId(doc, entry), 'refersTo')!.getAttribute('ref')).toBe('sig_S1');
    expect(child(byId(doc, exit), 'refersTo')!.getAttribute('ref')).toBe('sig_S3');
    expect(byId(doc, 'il_sig_S1').getAttribute('function')).toBe('main');
  });

  it('writes the layout as a visualization and the rest in the rd extension', () => {
    const proj = all(doc, 'spotElementProjection').find((p) => p.getAttribute('refersToElement') === 'sig_S1')!;
    const c = child(proj, 'coordinate')!;
    expect([c.getAttribute('x'), c.getAttribute('y')]).toEqual(['50', '114']);
    expect(all(doc, 'linearElementProjection')).toHaveLength(4);
    const ext = Array.from(doc.getElementsByTagNameNS(RD_NS, 'object'));
    const s1 = ext.find((e) => e.getAttribute('ref') === 'sig_S1')!;
    expect(s1.getAttribute('rdAspects')).toBe('3');
    const s3 = ext.find((e) => e.getAttribute('ref') === 'sig_S3')!;
    expect(s3.getAttribute('rdNotes')).toBe('Zażółć gęślą');
    const route = ext.find((e) => e.getAttribute('ref') === 'rt_R1')!;
    expect(route.getAttribute('rdLength')).toBe('691');
    expect(route.getAttribute('rdSections')).toBe('T1, T2');
  });

  it('has unique NCName ids and nothing unplaced', () => {
    const ids = all(doc, '*').map((e) => e.getAttribute('id')).filter((x): x is string => !!x);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isNcName)).toBe(true);
    expect(r.unplaced).toEqual([]);
    expect(r.extensionOnly).toEqual([]);
  });
});

describe('railML export details', () => {
  it('orients netElements nominally and maps reverse signals to applicationDirection="reverse"', () => {
    const l = new Layout();
    // drawn right to left
    l.line('track', { id: 'T9' }, [[500, 100], [0, 100]]);
    l.obj('signal', { id: 'S9', direction: 'reverse' }, 400, 86);
    l.obj('signal', { id: 'S8', direction: 'nominal' }, 100, 114);
    const doc = parse(exportRailml(l.model, { date: DATE }).xml);
    const ane = all(doc, 'associatedNetElement')[0];
    expect([ane.getAttribute('keepsOrientation'), ane.getAttribute('intrinsicCoordBegin'), ane.getAttribute('intrinsicCoordEnd')]).toEqual(['false', '1', '0']);
    const proj = all(doc, 'linearElementProjection')[0];
    expect(all(proj, 'coordinate').map((c) => c.getAttribute('x'))).toEqual(['0', '500']);
    const sl = (id: string): Element => child(byId(doc, id), 'spotLocation')!;
    expect([sl('sig_S9').getAttribute('intrinsicCoord'), sl('sig_S9').getAttribute('applicationDirection')]).toEqual(['0.8', 'reverse']);
    expect([sl('sig_S8').getAttribute('intrinsicCoord'), sl('sig_S8').getAttribute('applicationDirection')]).toEqual(['0.2', 'normal']);
  });

  it('lists objects that are not on a track and objects without a railML element', () => {
    const l = new Layout();
    l.line('track', { id: 'T1' }, [[0, 100], [300, 100]]);
    l.obj('signal', { id: 'S1', direction: 'nominal' }, 150, 400);
    l.obj('leu', { id: 'LEU1' }, 50, 300);
    l.obj('train', { id: 'TR1', maxSpeed: '160' }, 100, 300);
    const r = exportRailml(l.model, { date: DATE });
    expect(r.unplaced.map((p) => p.id)).toEqual(['S1']);
    expect(r.extensionOnly.map((p) => p.id)).toEqual(['LEU1', 'TR1']);
    const doc = parse(r.xml);
    expect(child(byId(doc, 'sig_S1'), 'spotLocation')).toBeNull();
    const ext = Array.from(doc.getElementsByTagNameNS(RD_NS, 'object'));
    const train = ext.find((e) => e.getAttribute('kind') === 'train')!;
    expect([train.getAttribute('rdId'), train.getAttribute('rdMaxSpeed'), train.getAttribute('x'), train.getAttribute('y')]).toEqual(['TR1', '160', '100', '300']);
    expect(checkRailmlStructure(doc)).toEqual([]);
    // a signal without a location keeps its direction in the extension
    expect(ext.find((e) => e.getAttribute('ref') === 'sig_S1')!.getAttribute('rdDirection')).toBe('nominal');
  });

  it('writes pure railML 3.2 without the extension', () => {
    const r = exportRailml(specLayout().model, { date: DATE, extension: false });
    const doc = parse(r.xml);
    expect(doc.getElementsByTagNameNS(RD_NS, '*')).toHaveLength(0);
    expect(r.xml).not.toContain('xmlns:rd');
    expect(checkRailmlStructure(doc)).toEqual([]);
  });

  it('reports structural problems of broken documents', () => {
    const doc = parse(
      `<railML xmlns="${RAILML_NS}" version="3.2"><infrastructure id="is"><topology><netElements><netElement id="a"/><netElement id="a"/></netElements></topology>` +
        `<functionalInfrastructure><tracks><track id="t" type="weird"><linearLocation id="ll"><associatedNetElement netElementRef="zz" keepsOrientation="true"/></linearLocation></track></tracks></functionalInfrastructure></infrastructure></railML>`
    );
    const problems = checkRailmlStructure(doc);
    expect(problems).toEqual(
      expect.arrayContaining([
        'Duplicate id "a" (<netElement> and <netElement>)',
        '<topology> (is) needs at least 1 <networks>',
        '<netElement> (a) needs at least 1 <associatedPositioningSystem>',
        '<track> (t) @type="weird" is not one of mainTrack, secondaryTrack, sidingTrack, connectingTrack',
        '<associatedNetElement> (ll) @netElementRef="zz" refers to no element',
      ])
    );
  });
});

describe('railML export: diagram default NID_C (rdCountryId)', () => {
  const countryOf = (model: Parameters<typeof exportRailml>[0], id: string): string | null => {
    const doc = parse(exportRailml(model, { date: DATE }).xml);
    const eu = all(doc, 'isEurobaliseGroup').find((e) => (e.parentNode as Element).getAttribute('id') === id);
    return eu?.getAttribute('countryID') ?? null;
  };

  it('a balise group without NID_C gets countryID from the diagram default (510 when not set)', () => {
    const l = new Layout();
    l.line('track', { id: 'T1', kmStart: '0', kmEnd: '1' }, [[0, 100], [600, 100]]);
    l.obj('baliseGroup', { id: 'BG1', nidBg: '12', count: '1' }, 100, 100, 40, 24, 'rounded=1;dashed=1;fillColor=none;');
    l.obj('baliseGroup', { id: 'BG2', nidC: '7', nidBg: '13', count: '1' }, 300, 100, 40, 24, 'rounded=1;dashed=1;fillColor=none;');
    expect(countryOf(l.model, 'bg_BG1')).toBe('510');
    expect(countryOf(l.model, 'bg_BG2')).toBe('7');
    setCountryId(l.model, '353');
    expect(countryOf(l.model, 'bg_BG1')).toBe('353');
    const r = exportRailml(l.model, { date: DATE });
    expect(r.issues.filter((i) => i.rule === 'required')).toEqual([]);
    expect(checkRailmlStructure(parse(r.xml))).toEqual([]);
    // the default is not written into the drawing
    expect(collectObjects(l.model).find((o) => o.id === 'BG1')!.values.nidC).toBe('');
  });

  it('the setting is saved in the .drawio file (root cell attribute) and read back', () => {
    const l = new Layout();
    setCountryId(l.model, '353');
    const xml = exportModelToDrawioXml(l.model);
    expect(xml).toMatch(/<object [^>]*rdCountryId="353"[^>]*id="0"/);
    const back = new GraphDataModel();
    importDrawioXmlIntoModel(xml, back);
    expect(readCountryId(back)).toBe('353');
  });
});

describe('railML export: insulated rail joints (TC joint markers)', () => {
  it('writes trainDetectionElement insulatedRailJoint and the sections it demarcates; import reads them back', () => {
    const l = new Layout();
    l.line('track', { id: 'T1', kmStart: '0', kmEnd: '0.6' }, [[0, 100], [600, 100]]);
    l.line('trackSection', { id: 'TC1', sectionType: 'tc', trackId: 'T1' }, [[0, 100], [300, 100]]);
    l.line('trackSection', { id: 'TC2', sectionType: 'tc', trackId: 'T1' }, [[300, 100], [600, 100]]);
    l.obj('insulatedJoint', { id: 'J1', trackId: 'T1', sections: 'TC1, TC2' }, 300, 100, 10, 12, 'group');
    const r = exportRailml(l.model, { date: DATE });
    const doc = parse(r.xml);
    expect(checkRailmlStructure(doc)).toEqual([]);
    expect(r.unplaced).toEqual([]);
    const tde = byId(doc, 'ij_J1');
    expect(tde.localName).toBe('trainDetectionElement');
    expect(tde.getAttribute('type')).toBe('insulatedRailJoint');
    expect(child(tde, 'spotLocation')).not.toBeNull();
    for (const id of ['tvd_TC1', 'tvd_TC2']) {
      expect(all(byId(doc, id), 'hasDemarcatingTraindetector').map((e) => e.getAttribute('ref'))).toEqual(['ij_J1']);
    }
    const back = importRailml(r.xml);
    const joint = collectObjects(back.model).find((o) => o.kind.id === 'insulatedJoint')!;
    expect(joint.id).toBe('J1');
    expect(joint.values.sections).toBe('TC1, TC2');
  });
});
