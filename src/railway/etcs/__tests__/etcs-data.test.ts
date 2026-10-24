/**
 * ETCS balise data: packet schema + validation (ranges, required, N_ITER), Q_SCALE conversion,
 * telegram encoding, computed values from small layouts (D_LINK both directions, L_ENDSECTION,
 * SSP, gradient), recompute (auto vs manual, mismatches), the rule checks, and the JSON round
 * trip through a .drawio file and the railML rd extension.
 */
import { GraphDataModel } from '@maxgraph/core';
import { describe, expect, it } from 'vitest';
import { Layout } from '../../__tests__/layouts';
import { importRailml } from '../../../railml/import';
import { exportRailml } from '../../../railml/export';
import { exportModelToDrawioXml, importDrawioXmlIntoModel } from '../../../services/drawio-xml';
import { readAttr } from '../../object-data';
import { checkRules } from '../../rule-checks';
import type { RuleSetId, RuleSettings } from '../../rule-settings';
import { RULE_DEFS, defaultRuleSettings } from '../../rule-settings';
import { collectObjects, validateModel } from '../../validation';
import { applyProjectDefaults } from '../../project-settings';
import type { EtcsGroupData, EtcsPacket } from '../etcs-data';
import {
  ETCS_ATTR,
  buildTelegrams,
  emptyEtcsData,
  encodePacket,
  fromRaw,
  newPacket,
  packetLength,
  parseEtcsData,
  readEtcsData,
  serializeEtcsData,
  setEtcsData,
  toRaw,
  validateEtcsData,
} from '../etcs-data';
import { buildEtcsEnv } from '../etcs-compute';
import { computePacket, recomputeGroup } from '../etcs-recompute';
import { PACKETS, VARS } from '../etcs-schema';
import { VARIABLE_COLUMNS, buildEtcsHtmlReport, buildEtcsJson, buildEtcsSummaryTable, buildEtcsVariableTable } from '../etcs-export';

const CTX = { nidC: 510, nidBg: 12, nTotal: 1 };

/** T1 0..1000 (1000 m), S1 at 150, S2 at 800 (nominal), groups BG1 / BG2 / BG3 at 100 / 400 / 700 with two balises each. */
function lineLayout(extra: (l: Layout) => void = () => undefined): Layout {
  const l = new Layout();
  l.line('track', { id: 'T1', length: '1000', kmStart: '10', kmEnd: '11' }, [[0, 100], [1000, 100]]);
  l.signal('S1', 'nominal', 150, 114, { signalType: 'main', trackId: 'T1' });
  l.signal('S2', 'nominal', 800, 114, { signalType: 'main', trackId: 'T1' });
  let nid = 1;
  for (const [g, x] of [['BG1', 100], ['BG2', 400], ['BG3', 700]] as const) {
    l.obj('baliseGroup', { id: g, nidBg: String(nid++), count: '2', direction: 'nominal', trackId: 'T1' }, x - 15, 90, 30, 20);
    l.obj('balise', { id: `${g}-1`, groupId: g, position: '1', trackId: 'T1' }, x - 10, 95, 10, 10);
    l.obj('balise', { id: `${g}-2`, groupId: g, position: '2', trackId: 'T1' }, x, 95, 10, 10);
  }
  extra(l);
  return l;
}

function env(l: Layout, bgSignalMax = 50) {
  return buildEtcsEnv(applyProjectDefaults(collectObjects(l.model), '510'), { bgSignalMax });
}

const group = (l: Layout, id: string, max = 50) => {
  const e = env(l, max);
  return { e, g: e.groups.find((x) => x.o.id === id)! };
};

function only(id: RuleSetId, params: Record<string, number> = {}): RuleSettings {
  const s = defaultRuleSettings();
  for (const d of RULE_DEFS) s[d.id].enabled = d.id === id;
  Object.assign(s[id].params, params);
  return s;
}

const cellOf = (l: Layout, id: string) => collectObjects(l.model).find((o) => o.id === id)!.cell;

describe('ETCS packet schema and validation', () => {
  it('has the required packets with unique variables', () => {
    expect(PACKETS.map((p) => p.nid)).toEqual([5, 12, 21, 27, 41, 44, 46, 65, 66, 72, 79, 132, 136, 137, 255]);
    const walk = (items: (typeof PACKETS)[number]['items']): string[] => items.flatMap((it) => ('v' in it ? [it.v] : walk(it.items)));
    for (const p of PACKETS) for (const v of walk(p.items)) expect(VARS[v], `${p.nid}: ${v}`).toBeDefined();
  });

  it('a new linking packet: defaults, length 69 bits without iterations', () => {
    const p = newPacket(5);
    expect(p.vars).toMatchObject({ Q_DIR: 1, Q_SCALE: 1, Q_NEWCOUNTRY: 0, Q_LINKORIENTATION: 1, Q_LINKREACTION: 1, Q_LOCACC: 5, links: [] });
    p.vars.D_LINK = 1200;
    p.vars.NID_BG = 7;
    expect(packetLength(p)).toBe(69);
    const fields = encodePacket(p);
    expect(fields.find((f) => f.name === 'L_PACKET')!.raw).toBe(69);
    expect(fields.map((f) => f.name)).toEqual(['NID_PACKET', 'Q_DIR', 'L_PACKET', 'Q_SCALE', 'D_LINK', 'Q_NEWCOUNTRY', 'NID_BG', 'Q_LINKORIENTATION', 'Q_LINKREACTION', 'Q_LOCACC', 'N_ITER']);
  });

  it('reports required variables, ranges, enums and the N_ITER count', () => {
    const p = newPacket(5);
    p.vars.NID_BG = 20000;
    p.vars.Q_LINKREACTION = 3;
    p.vars.links = [{ D_LINK: 100, Q_NEWCOUNTRY: 0, NID_BG: 3, Q_LINKORIENTATION: 1, Q_LINKREACTION: 1, Q_LOCACC: 5 }];
    p.vars.N_ITER = 2;
    const data: EtcsGroupData = { ...emptyEtcsData(), packets: [p] };
    const msgs = validateEtcsData(data, CTX).filter((x) => x.severity === 'error').map((x) => x.message);
    expect(msgs).toContainEqual(expect.stringContaining('D_LINK is required'));
    expect(msgs).toContainEqual(expect.stringContaining('NID_BG 20000 is outside 0–16383'));
    expect(msgs).toContainEqual(expect.stringContaining('Q_LINKREACTION 3 is not one of 0, 1, 2'));
    expect(msgs).toContainEqual(expect.stringContaining('N_ITER = 2 but links has 1 entry'));
  });

  it('checks distances against Q_SCALE and speeds against 5 km/h steps', () => {
    const p = newPacket(65);
    Object.assign(p.vars, { NID_TSR: 3, D_TSR: 40000, L_TSR: 120.25, Q_FRONT: 0, V_TSR: 83 });
    const problems = validateEtcsData({ ...emptyEtcsData(), packets: [p] }, CTX);
    expect(problems.find((x) => x.path === 'packets.0.D_TSR')!.message).toContain('does not fit Q_SCALE 1 m (max 32767 m)');
    expect(problems.find((x) => x.path === 'packets.0.L_TSR')).toMatchObject({ severity: 'warning' });
    expect(problems.find((x) => x.path === 'packets.0.V_TSR')!.message).toContain('encoded as 80 km/h');
    p.vars.Q_SCALE = 2;
    expect(validateEtcsData({ ...emptyEtcsData(), packets: [p] }, CTX).some((x) => x.path === 'packets.0.D_TSR' && x.severity === 'error')).toBe(false);
  });

  it('converts physical values with Q_SCALE (10 cm / 1 m / 10 m) and special codes', () => {
    const d = VARS.D_LINK;
    expect([0, 1, 2].map((q) => toRaw(d, 1250, q))).toEqual([12500, 1250, 125]);
    expect([0, 1, 2].map((q) => fromRaw(d, 125, q))).toEqual([12.5, 125, 1250]);
    expect(toRaw(VARS.V_STATIC, 120)).toBe(24);
    expect(fromRaw(VARS.V_STATIC, 24)).toBe(120);
    expect(toRaw(VARS.V_STATIC, 'end')).toBe(127);
    expect(fromRaw(VARS.T_LOA, 1023)).toBe('inf');
    expect(toRaw(VARS.G_A, 'end')).toBe(255);
  });

  it('encodes the telegrams per balise (header 50 bits, N_PIG, packets per balise, 255)', () => {
    const data = emptyEtcsData();
    const p = newPacket(137);
    p.pig = [1];
    data.packets.push(p);
    const [t0, t1] = buildTelegrams(data, CTX);
    expect(t0.bits).toBe(50 + 8);
    expect(t1.bits).toBe(50 + (8 + 2 + 13 + 1) + 8);
    expect(t0.header.find((f) => f.name === 'N_PIG')!.raw).toBe(0);
    expect(t1.header.find((f) => f.name === 'N_PIG')!.raw).toBe(1);
    // Q_UPDOWN 1, M_VERSION 33 (0100001), Q_MEDIA 0 -> 1 0100001 0 ...
    expect(t0.hex.startsWith('A1')).toBe(true);
  });

  it('JSON: parse / serialize is stable, invalid JSON is reported', () => {
    const data = emptyEtcsData();
    data.packets.push({ ...newPacket(5), auto: ['D_LINK'] });
    const text = serializeEtcsData(data);
    expect(serializeEtcsData(parseEtcsData(text).data!)).toBe(text);
    expect(parseEtcsData('{oops').problems[0].message).toContain('not valid JSON');
  });
});

describe('ETCS values computed from the drawing', () => {
  it('D_LINK to the next groups in the nominal direction (incremental, orientation, NID_BG)', () => {
    const l = lineLayout();
    const { e, g } = group(l, 'BG1');
    const comp = computePacket(e, g, newPacket(5))!;
    expect(comp.vars).toMatchObject({ D_LINK: 300, NID_BG: 2, Q_NEWCOUNTRY: 0, Q_LINKORIENTATION: 1 });
    expect(comp.vars.links).toEqual([{ D_LINK: 300, NID_BG: 3, Q_NEWCOUNTRY: 0, Q_LINKORIENTATION: 1 }]);
  });

  it('D_LINK in the reverse direction: groups passed against their orientation', () => {
    const l = lineLayout();
    const { e, g } = group(l, 'BG3');
    const p = newPacket(5);
    p.vars.Q_DIR = 0;
    const comp = computePacket(e, g, p)!;
    expect(comp.vars).toMatchObject({ D_LINK: 300, NID_BG: 2, Q_LINKORIENTATION: 0 });
    expect(comp.vars.links).toEqual([{ D_LINK: 300, NID_BG: 1, Q_NEWCOUNTRY: 0, Q_LINKORIENTATION: 0 }]);
  });

  it('a group drawn right to left (balise 1 right of balise 2) has the reverse orientation', () => {
    const l = lineLayout((x) => {
      x.obj('baliseGroup', { id: 'BG9', nidBg: '9', count: '2', trackId: 'T1' }, 535, 90, 30, 20);
      x.obj('balise', { id: 'B91', groupId: 'BG9', position: '1', trackId: 'T1' }, 550, 95, 10, 10);
      x.obj('balise', { id: 'B92', groupId: 'BG9', position: '2', trackId: 'T1' }, 540, 95, 10, 10);
    });
    const { e, g } = group(l, 'BG2');
    expect(e.groups.find((x) => x.o.id === 'BG9')!.orientation).toBe('reverse');
    const comp = computePacket(e, g, newPacket(5))!;
    expect(comp.vars).toMatchObject({ D_LINK: 160, NID_BG: 9, Q_LINKORIENTATION: 0 });
  });

  it('another NID_C: Q_NEWCOUNTRY 1 with NID_C', () => {
    const l = lineLayout();
    const bg2 = collectObjects(l.model).find((o) => o.id === 'BG2')!;
    l.model.setValue(bg2.cell, (() => {
      const v = (bg2.cell.getValue() as Element).cloneNode(true) as Element;
      v.setAttribute('rdNidC', '300');
      return v;
    })());
    const { e, g } = group(l, 'BG1');
    expect(computePacket(e, g, newPacket(5))!.vars).toMatchObject({ Q_NEWCOUNTRY: 1, NID_C: 300, NID_BG: 2 });
  });

  it('L_ENDSECTION: to the next main signal, or past "its" signal within the group distance', () => {
    const l = lineLayout();
    let { e, g } = group(l, 'BG1');
    expect(computePacket(e, g, newPacket(12))!.vars.L_ENDSECTION).toBe(55);
    ({ e, g } = group(l, 'BG1', 60));
    expect(computePacket(e, g, newPacket(12))!.vars.L_ENDSECTION).toBe(705);
  });

  it('SSP from the speed limits of the track and a section, to the end of the walk', () => {
    const l = lineLayout((x) => {
      x.line('trackSection', { id: 'TS1', trackId: 'T1' }, [[500, 100], [1000, 100]]);
    });
    const t1 = collectObjects(l.model).find((o) => o.id === 'T1')!;
    const ts1 = collectObjects(l.model).find((o) => o.id === 'TS1')!;
    const set = (cell: typeof t1.cell, attr: string, v: string) => {
      const val = (cell.getValue() as Element).cloneNode(true) as Element;
      val.setAttribute(attr, v);
      l.model.setValue(cell, val);
    };
    set(t1.cell, 'rdSpeedLimit', '120');
    set(ts1.cell, 'rdVmax', '83');
    const { e, g } = group(l, 'BG1');
    const comp = computePacket(e, g, newPacket(27))!;
    expect(comp.vars).toMatchObject({ D_STATIC: 0, V_STATIC: 120 });
    expect(comp.vars.steps).toEqual([
      { D_STATIC: 405, V_STATIC: 80 },
      { D_STATIC: 300, V_STATIC: 'end' },
    ]);
  });

  it('gradient profile: sign by travel direction, safe-side rounding, km steps', () => {
    const l = lineLayout();
    const t1 = collectObjects(l.model).find((o) => o.id === 'T1')!;
    const val = (t1.cell.getValue() as Element).cloneNode(true) as Element;
    val.setAttribute('rdGradient', '10.000:+2.5; 10.500:-4');
    l.model.setValue(t1.cell, val);
    let { e, g } = group(l, 'BG1');
    const nominal = computePacket(e, g, newPacket(21))!;
    expect(nominal.vars).toMatchObject({ D_GRADIENT: 0, Q_GDIR: 1, G_A: 2 });
    expect(nominal.vars.steps).toEqual([
      { D_GRADIENT: 405, Q_GDIR: 0, G_A: 4 },
      { D_GRADIENT: 300, Q_GDIR: 1, G_A: 'end' },
    ]);
    ({ e, g } = group(l, 'BG3'));
    const p = newPacket(21);
    p.vars.Q_DIR = 0;
    const reverse = computePacket(e, g, p)!;
    // walking right to left: -4 ‰ becomes +4 (uphill), +2.5 becomes 2.5 downhill -> 3
    expect(reverse.vars).toMatchObject({ D_GRADIENT: 0, Q_GDIR: 1, G_A: 4 });
    expect((reverse.vars.steps as unknown[])[0]).toEqual({ D_GRADIENT: 195, Q_GDIR: 0, G_A: 3 });
  });

  it('no metres in the drawing: nothing computed, a note', () => {
    const l = new Layout();
    l.line('track', { id: 'T1' }, [[0, 100], [1000, 100]]);
    l.obj('baliseGroup', { id: 'BG1', nidBg: '1', direction: 'nominal', trackId: 'T1' }, 90, 90, 20, 20);
    l.obj('baliseGroup', { id: 'BG2', nidBg: '2', direction: 'nominal', trackId: 'T1' }, 490, 90, 20, 20);
    const { e, g } = group(l, 'BG1');
    const comp = computePacket(e, g, newPacket(5))!;
    expect(comp.vars).toEqual({});
    expect(comp.notes.join(' ')).toContain('no metres');
  });

  it('recompute fills empty values (auto) and keeps hand-set ones, reporting differences', () => {
    const l = lineLayout();
    const { e, g } = group(l, 'BG1');
    const data = emptyEtcsData();
    data.packets.push(newPacket(5));
    const first = recomputeGroup(e, g, data);
    expect(first.data.packets[0].vars).toMatchObject({ D_LINK: 300, NID_BG: 2 });
    expect(first.data.packets[0].auto).toContain('D_LINK');
    expect(first.data.packets[0].auto).toContain('links.0.D_LINK');
    expect(first.mismatches).toEqual([]);
    // a hand-set distance: kept, reported
    const edited = first.data;
    edited.packets[0].vars.D_LINK = 250;
    edited.packets[0].auto = edited.packets[0].auto!.filter((p) => p !== 'D_LINK');
    const second = recomputeGroup(e, g, edited);
    expect(second.data.packets[0].vars.D_LINK).toBe(250);
    expect(second.mismatches).toHaveLength(1);
    expect(second.mismatches[0]).toMatchObject({ path: 'D_LINK', stored: 250, computed: 300 });
  });
});

describe('ETCS rule checks', () => {
  const withData = (l: Layout, id: string, data: EtcsGroupData) => setEtcsData(l.model, [cellOf(l, id)], data);
  const issues = (l: Layout, rule: RuleSetId, params: Record<string, number> = {}) =>
    checkRules(applyProjectDefaults(collectObjects(l.model), '510'), only(rule, params)).issues.filter((i) => i.rule === rule);
  const linking = (d: number, nidBg: number): EtcsPacket => ({ nid: 5, vars: { ...newPacket(5).vars, D_LINK: d, NID_BG: nidBg } });

  it('linked group without linking packet; group without packets', () => {
    const l = lineLayout();
    withData(l, 'BG1', { ...emptyEtcsData(), packets: [newPacket(137)] });
    expect(issues(l, 'etcs-linking-missing').map((i) => i.objectId)).toEqual(['BG1']);
    expect(issues(l, 'etcs-no-packets').map((i) => i.objectId)).toEqual(['BG2', 'BG3']);
  });

  it('linking distance vs the drawing (tolerance), unknown linked group', () => {
    const l = lineLayout();
    withData(l, 'BG1', { ...emptyEtcsData(), packets: [linking(300, 2)] });
    expect(issues(l, 'etcs-linking-distance')).toEqual([]);
    withData(l, 'BG1', { ...emptyEtcsData(), packets: [linking(290, 2)] });
    expect(issues(l, 'etcs-linking-distance')[0].message).toContain('totals 290 m, the drawing gives 300 m; tolerance 5 m');
    expect(issues(l, 'etcs-linking-distance', { tolerance: 15 })).toEqual([]);
    withData(l, 'BG1', { ...emptyEtcsData(), packets: [linking(300, 77)] });
    expect(issues(l, 'etcs-linking-distance')[0].message).toContain('NID_BG 77 is not ahead');
  });

  it('duplicate NID_BG within NID_C (diagram default), TSR without revocation, invalid data', () => {
    const l = lineLayout((x) => x.obj('baliseGroup', { id: 'BG4', nidBg: '2', trackId: 'T1' }, 900, 90, 20, 20));
    expect(issues(l, 'etcs-duplicate-nid-bg').map((i) => i.objectId)).toEqual(['BG2', 'BG4']);
    const tsr = newPacket(65);
    Object.assign(tsr.vars, { NID_TSR: 4, D_TSR: 100, L_TSR: 200, V_TSR: 40 });
    withData(l, 'BG1', { ...emptyEtcsData(), packets: [tsr] });
    expect(issues(l, 'etcs-tsr-revocation')[0].message).toContain('NID_TSR 4');
    const rev = newPacket(66);
    rev.vars.NID_TSR = 4;
    withData(l, 'BG3', { ...emptyEtcsData(), packets: [rev] });
    expect(issues(l, 'etcs-tsr-revocation')).toEqual([]);
    withData(l, 'BG2', { ...emptyEtcsData(), packets: [newPacket(5)] });
    expect(issues(l, 'etcs-packet-invalid')[0].message).toContain('D_LINK is required');
  });

  it('packet direction: a single unlinked balise needs Q_DIR both; MA towards the signals', () => {
    const l = lineLayout((x) => x.obj('baliseGroup', { id: 'BG5', nidBg: '5', count: '1', trackId: 'T1' }, 940, 90, 20, 20));
    const unlinked = { ...emptyEtcsData(), packets: [newPacket(132)] };
    unlinked.header.Q_LINK = 0;
    withData(l, 'BG5', unlinked);
    expect(issues(l, 'etcs-packet-direction')[0].message).toContain('single unlinked balise');
    const ma = newPacket(12);
    ma.vars.Q_DIR = 0;
    ma.vars.L_ENDSECTION = 100;
    withData(l, 'BG2', { ...emptyEtcsData(), packets: [ma] });
    expect(issues(l, 'etcs-packet-direction').map((i) => i.objectId)).toContain('BG2');
  });

  it('drawings without ETCS data: no findings besides duplicate NID_BG, in validateModel', () => {
    const l = lineLayout();
    expect(validateModel(l.model).filter((i) => i.rule.startsWith('etcs-'))).toEqual([]);
  });
});

describe('ETCS data round trips', () => {
  const sample = (): EtcsGroupData => {
    const d = emptyEtcsData();
    const p = newPacket(72);
    p.vars.X_TEXT = 'Uwaga: "ŁÓDŹ" <&>';
    d.packets.push({ ...newPacket(5), vars: { ...newPacket(5).vars, D_LINK: 300, NID_BG: 2 }, auto: ['D_LINK'] }, p);
    d.balises = [{ pig: 1, M_DUP: 2 }];
    return d;
  };

  it('.drawio file keeps the rdEtcs attribute byte for byte', () => {
    const l = lineLayout();
    setEtcsData(l.model, [cellOf(l, 'BG1')], sample());
    const before = readAttr(cellOf(l, 'BG1'), ETCS_ATTR);
    const back = new GraphDataModel();
    importDrawioXmlIntoModel(exportModelToDrawioXml(l.model), back);
    const bg1 = collectObjects(back).find((o) => o.id === 'BG1')!;
    expect(readAttr(bg1.cell, ETCS_ATTR)).toBe(before);
    expect(readEtcsData(bg1.cell).data).toEqual(parseEtcsData(before).data);
  });

  it('railML export keeps it in the rd extension; import restores it; export again is stable', () => {
    const l = lineLayout();
    setEtcsData(l.model, [cellOf(l, 'BG1')], sample());
    const before = readAttr(cellOf(l, 'BG1'), ETCS_ATTR);
    const r = exportRailml(l.model, { date: '2026-10-24T00:00:00Z' });
    expect(r.xml).toContain('v_rdEtcs=');
    const back = importRailml(r.xml);
    const bg1 = collectObjects(back.model).find((o) => o.id === 'BG1')!;
    expect(readAttr(bg1.cell, ETCS_ATTR)).toBe(before);
    // the first import adds the symbols' styles; from then on export -> import -> export is byte-stable
    const second = exportRailml(back.model, { date: '2026-10-24T00:00:00Z' }).xml;
    const third = exportRailml(importRailml(second).model, { date: '2026-10-24T00:00:00Z' }).xml;
    expect(third).toBe(second);
    expect(second).toContain(`v_rdEtcs="${before.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`);
  });
});

describe('ETCS exports', () => {
  it('variable table, summary, JSON and HTML report', () => {
    const l = lineLayout();
    const p5 = { ...newPacket(5), vars: { ...newPacket(5).vars, D_LINK: 300, NID_BG: 2 }, auto: ['D_LINK'] };
    const p72 = newPacket(72);
    p72.vars.X_TEXT = 'Hello <b>';
    setEtcsData(l.model, [cellOf(l, 'BG1')], { ...emptyEtcsData(), packets: [p5, p72] });
    const e = env(l);
    const vars = buildEtcsVariableTable(e);
    expect(vars.columns).toEqual(VARIABLE_COLUMNS);
    const row = (name: string) => vars.rows.find((r) => r[0] === 'BG1' && r[5] !== 0 && r[11] === name)!;
    expect(row('D_LINK').slice(5)).toEqual([1, 5, 'Linking', 'nominal', '0 1', '', 'D_LINK', 300, 'm', 300, 15, 'drawing']);
    expect(row('NID_BG')[16]).toBe('manual');
    expect(row('L_PACKET')[16]).toBe('derived');
    expect(row('X_TEXT').slice(12, 16)).toEqual(['Hello <b>', '', 'Hello <b>', 72]);
    expect(vars.rows.filter((r) => r[11] === 'NID_PACKET' && r[6] === 255)).toHaveLength(1);
    const summary = buildEtcsSummaryTable(e);
    expect(summary.rows.map((r) => r[0])).toEqual(['BG1', 'BG2', 'BG3']);
    expect(summary.rows[0][9]).toBe('5, 72, 255');
    expect(summary.rows[1][9]).toBe('no ETCS data');
    const json = JSON.parse(buildEtcsJson(e, l.model, 'Line'));
    expect(json).toMatchObject({ format: 'railway-drawer-etcs', version: 1, defaultNidC: '510' });
    expect(json.groups[0].data.packets[0].vars.D_LINK).toBe(300);
    const html = buildEtcsHtmlReport(e, 'Line <1>', new Date('2026-10-24T00:00:00Z'));
    expect(html).toContain('<title>Line &lt;1&gt; — ETCS balise telegrams</title>');
    expect(html).toContain('Hello &lt;b&gt;');
    expect(html).not.toContain('Hello <b>');
  });
});
