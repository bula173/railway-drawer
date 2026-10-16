/**
 * Railway checks: every rule with a failing and a passing case, issue order and counts.
 */
import { describe, expect, it } from 'vitest';
import { Cell, Geometry, GraphDataModel, Point } from '@maxgraph/core';
import type { KindId } from '../catalogue';
import { buildDataValue } from '../object-data';
import { SIGNAL_TRACK_DISTANCE, collectObjects, countIssues, validateModel } from '../validation';
import type { Issue, RuleId } from '../validation';
import { centerOf, projectOnPolyline, trackPolyline } from '../geometry';

class Builder {
  model = new GraphDataModel();
  layer = this.model.getRoot()!.getChildAt(0);
  private n = 0;

  obj(kind: KindId, values: Record<string, string>, geo: { x?: number; y?: number; w?: number; h?: number } = {}, parent?: Cell): Cell {
    const cell = new Cell(buildDataValue('', { kind, values }), new Geometry(geo.x ?? 0, geo.y ?? 0, geo.w ?? 20, geo.h ?? 20), {});
    cell.setVertex(true);
    cell.setId(`c${++this.n}`);
    this.model.add(parent ?? this.layer, cell);
    return cell;
  }

  /** A track drawn as an edge from (x1,y1) to (x2,y2). */
  track(values: Record<string, string>, x1: number, y1: number, x2: number, y2: number, kind: KindId = 'track'): Cell {
    const geo = new Geometry();
    geo.relative = true;
    geo.setTerminalPoint(new Point(x1, y1), true);
    geo.setTerminalPoint(new Point(x2, y2), false);
    const cell = new Cell(buildDataValue('', { kind, values }), geo, {});
    cell.setEdge(true);
    cell.setId(`c${++this.n}`);
    this.model.add(this.layer, cell);
    return cell;
  }

  issues(rule?: RuleId): Issue[] {
    const all = validateModel(this.model);
    return rule ? all.filter((i) => i.rule === rule) : all;
  }
}

describe('validation rules', () => {
  it('duplicate-id: same kind, case-insensitive; other kinds may share an ID', () => {
    const b = new Builder();
    const s1 = b.obj('signal', { id: 'S1' });
    const s2 = b.obj('signal', { id: 's1 ' });
    b.obj('balise', { id: 'S1', groupId: 'BG1' });
    b.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '1' });
    const dup = b.issues('duplicate-id');
    expect(dup.map((i) => i.cellId)).toEqual([s1.getId(), s2.getId()]);
    expect(dup[0]).toMatchObject({ severity: 'error', kind: 'signal', field: 'id' });
    expect(dup[0].message).toBe('Duplicate signal ID "S1" (also used by 1 other signal)');

    const ok = new Builder();
    ok.obj('signal', { id: 'S1' });
    ok.obj('signal', { id: 'S2' });
    expect(ok.issues('duplicate-id')).toEqual([]);
  });

  it('required: missing ID is an error, missing NID_BG/NID_C a warning', () => {
    const b = new Builder();
    b.obj('signal', {});
    b.obj('baliseGroup', { id: 'BG1' });
    const req = b.issues('required');
    expect(req.map((i) => [i.severity, i.field])).toEqual([
      ['error', 'id'],
      ['warning', 'nidC'],
      ['warning', 'nidBg'],
    ]);
    expect(req[0].message).toBe('Signal has no ID (cell c1)');
    expect(req[1].message).toBe('NID_C of balise group BG1 is not set');

    const ok = new Builder();
    ok.obj('baliseGroup', { id: 'BG1', nidC: '0', nidBg: '0' });
    expect(ok.issues('required')).toEqual([]);
  });

  it('invalid-value: ranges NID_BG 0–16383, NID_C 0–1023, count 1–8, numbers and options', () => {
    const b = new Builder();
    b.obj('baliseGroup', { id: 'BG1', nidC: '1024', nidBg: '16384', count: '9', km: 'abc', function: 'magic' });
    b.obj('signal', { id: 'S1', aspects: '2.5' });
    const bad = b.issues('invalid-value');
    expect(bad.map((i) => i.field)).toEqual(['nidC', 'nidBg', 'count', 'km', 'function', 'aspects']);
    expect(bad.every((i) => i.severity === 'error')).toBe(true);
    expect(bad[1].message).toBe('Balise group BG1: NID_BG 16384 is out of range 0–16383');
    expect(bad[3].message).toContain('"abc" is not a number');

    const ok = new Builder();
    ok.obj('baliseGroup', { id: 'BG1', nidC: '1023', nidBg: '16383', count: '8', km: '12+345', function: 'infill' });
    ok.obj('baliseGroup', { id: 'BG2', nidC: '0', nidBg: '0', count: '1' });
    expect(ok.issues('invalid-value')).toEqual([]);
  });

  it('balise-without-group', () => {
    const b = new Builder();
    b.obj('balise', { id: 'B1' });
    expect(b.issues('balise-without-group')).toHaveLength(1);
    expect(b.issues('balise-without-group')[0]).toMatchObject({ severity: 'error', message: 'Balise B1 does not belong to a balise group' });

    const ok = new Builder();
    ok.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '1' });
    ok.obj('balise', { id: 'B1', groupId: 'bg1' });
    expect(ok.issues()).toEqual([]);
  });

  it('group-count: balises in group vs members; group-position: duplicates and positions above the count', () => {
    const b = new Builder();
    const g = b.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '2', count: '2' });
    b.obj('balise', { id: 'B1', groupId: 'BG1', position: '1' });
    b.obj('balise', { id: 'B2', groupId: 'BG1', position: '1' });
    b.obj('balise', { id: 'B3', groupId: 'BG1', position: '3' });
    const count = b.issues('group-count');
    expect(count).toHaveLength(1);
    expect(count[0]).toMatchObject({ cellId: g.getId(), severity: 'warning' });
    expect(count[0].message).toBe('Balise group BG1 has 2 balises in group, but 3 balises belong to it');
    const pos = b.issues('group-position').map((i) => i.message);
    expect(pos).toEqual([
      'Balise B2 has the same position 1 in group BG1 as balise B1',
      'Balise B3 has position 3, but group BG1 has only 2 balises',
    ]);

    const ok = new Builder();
    ok.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '2', count: '2' });
    ok.obj('balise', { id: 'B1', groupId: 'BG1', position: '1' });
    ok.obj('balise', { id: 'B2', groupId: 'BG1', position: '2' });
    // a group without drawn members is not reported
    ok.obj('baliseGroup', { id: 'BG2', nidC: '1', nidBg: '3', count: '4' });
    expect(ok.issues()).toEqual([]);
  });

  it('missing-reference: track, group, LEU, RBC, routes, signals, sections', () => {
    const b = new Builder();
    b.obj('signal', { id: 'S1', trackId: 'T9', routes: 'R1, R2' });
    b.obj('route', { id: 'R1', entrySignal: 'S1', exitSignal: 'S7' });
    b.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '1', leuId: 'LEU1' });
    b.obj('train', { id: 'TR1', rbcId: 'RBC1' });
    b.obj('axleCounter', { id: 'AC1', sections: 'TS1' });
    const missing = b.issues('missing-reference').map((i) => i.message);
    expect(missing).toEqual([
      'Signal S1: track "T9" does not exist (no track or track section with this ID)',
      'Signal S1: routes "R2" does not exist (no route with this ID)',
      'Route R1: exit signal "S7" does not exist (no signal with this ID)',
      'Balise group BG1: leu "LEU1" does not exist (no leu with this ID)',
      'Train TR1: rbc "RBC1" does not exist (no rbc with this ID)',
      'Axle counter AC1: track sections "TS1" does not exist (no track section with this ID)',
    ]);

    const ok = new Builder();
    ok.track({ id: 'T9' }, 0, 0, 100, 0);
    ok.obj('signal', { id: 'S1', trackId: 't9', routes: 'R1' }, { x: 0, y: -10 });
    ok.obj('route', { id: 'R1', entrySignal: 'S1' });
    expect(ok.issues('missing-reference')).toEqual([]);
  });

  it('signal-off-track: distance to its own track, or to any track when none is named', () => {
    const b = new Builder();
    b.track({ id: 'T1' }, 0, 100, 400, 100);
    b.obj('signal', { id: 'S1', trackId: 'T1' }, { x: 50, y: 300, w: 40, h: 20 }); // centre y=310 -> 210 px
    b.obj('signal', { id: 'S2' }, { x: 200, y: 0, w: 40, h: 20 }); // centre y=10 -> 90 px
    b.obj('signal', { id: 'S3' }, { x: 100, y: 75, w: 40, h: 20 }); // centre y=85 -> 15 px: fine
    const off = b.issues('signal-off-track');
    expect(off.map((i) => i.message)).toEqual([
      `Signal S1 is 210 px away from its track T1 (max ${SIGNAL_TRACK_DISTANCE} px)`,
      'Signal S2 is not placed on or near a track (nearest is 90 px away)',
    ]);
    expect(off.every((i) => i.severity === 'warning')).toBe(true);

    // no tracks at all: nothing to compare against
    const none = new Builder();
    none.obj('signal', { id: 'S1' }, { x: 500, y: 500 });
    expect(none.issues('signal-off-track')).toEqual([]);

    // a signal group inside a parent container: absolute position counts
    const nested = new Builder();
    nested.track({ id: 'T1' }, 0, 100, 400, 100);
    const container = nested.obj('levelCrossing', { id: 'LC1' }, { x: 100, y: 80, w: 100, h: 40 });
    nested.obj('signal', { id: 'S1', trackId: 'T1' }, { x: 10, y: 10, w: 20, h: 10 }, container); // abs centre (120, 95)
    expect(nested.issues('signal-off-track')).toEqual([]);
  });

  it('km-order: km not monotonic along the track; km-outside-track', () => {
    const b = new Builder();
    b.track({ id: 'T1', kmStart: '10', kmEnd: '11' }, 0, 100, 1000, 100);
    b.obj('signal', { id: 'S1', trackId: 'T1', km: '10.1' }, { x: 100, y: 80 });
    b.obj('signal', { id: 'S2', trackId: 'T1', km: '10.5' }, { x: 300, y: 80 });
    b.obj('signal', { id: 'S3', trackId: 'T1', km: '10.3' }, { x: 500, y: 80 });
    b.obj('signal', { id: 'S4', trackId: 'T1', km: '10.9' }, { x: 700, y: 80 });
    b.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '1', trackId: 'T1', km: '12' }, { x: 900, y: 90 });
    expect(b.issues('km-order').map((i) => i.message)).toEqual([
      'Signal S3 at km 10.3 is out of order along track T1 (follows signal S2 at km 10.5)',
    ]);
    expect(b.issues('km-outside-track').map((i) => i.message)).toEqual(['Balise group BG1 at km 12 lies outside track T1 (km 10–11)']);

    // decreasing km along the drawing is fine, too
    const ok = new Builder();
    ok.track({ id: 'T1' }, 0, 100, 1000, 100);
    ok.obj('signal', { id: 'S1', trackId: 'T1', km: '5.9' }, { x: 100, y: 80 });
    ok.obj('signal', { id: 'S2', trackId: 'T1', km: '5.5' }, { x: 300, y: 80 });
    ok.obj('balise', { id: 'B1', trackId: 'T1', km: '5.2', groupId: 'BG1' }, { x: 500, y: 90 });
    ok.obj('baliseGroup', { id: 'BG1', nidC: '1', nidBg: '1', trackId: 'T1', km: '5.2' }, { x: 500, y: 90 });
    expect(ok.issues()).toEqual([]);
  });

  it('unknown-kind', () => {
    const b = new Builder();
    const doc = document.implementation.createDocument(null, null, null);
    const value = doc.createElement('object');
    value.setAttribute('rdKind', 'tunnel');
    const cell = new Cell(value, new Geometry(0, 0, 10, 10), {});
    cell.setVertex(true);
    cell.setId('x');
    b.model.add(b.layer, cell);
    expect(b.issues()).toEqual([{ severity: 'warning', rule: 'unknown-kind', cellId: 'x', message: 'Unknown railway object kind "tunnel" (cell x)' }]);
  });

  it('sorts errors first and counts', () => {
    const b = new Builder();
    b.obj('baliseGroup', { id: 'BG1' }); // 2 warnings
    b.obj('signal', {}); // error
    const issues = b.issues();
    expect(issues.map((i) => i.severity)).toEqual(['error', 'warning', 'warning']);
    expect(countIssues(issues)).toEqual({ errors: 1, warnings: 2 });
    expect(collectObjects(b.model)).toHaveLength(2);
  });
});

describe('geometry', () => {
  it('projects onto polylines and uses vertex long axes as tracks', () => {
    expect(projectOnPolyline({ x: 5, y: 3 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual({ distance: 3, along: 5 });
    expect(projectOnPolyline({ x: 13, y: 8 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual({ distance: 3, along: 18 });
    const rail = new Cell('', new Geometry(10, 20, 200, 6), {});
    rail.setVertex(true);
    expect(trackPolyline(rail)).toEqual([{ x: 10, y: 23 }, { x: 210, y: 23 }]);
    expect(centerOf(rail)).toEqual({ x: 110, y: 23 });
  });
});
