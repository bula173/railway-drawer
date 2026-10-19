/**
 * Railway Script two-way sync: apply into a tab graph (one undo step, idempotent, keeps user
 * cells), drawing edits -> text (moves, data, deletes, inserts, Route tool) with comments kept,
 * undo of an apply, conflicts, and "Generate from drawing" round trips.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Cell, Geometry } from '@maxgraph/core';
import { centerOf, trackPolyline } from '../../railway/geometry';
import { buildDataValue, setRailwayData } from '../../railway/object-data';
import { addRoute } from '../../railway/route-store';
import { findRoutePaths } from '../../railway/routes';
import { buildTopology } from '../../railway/topology';
import { collectObjects } from '../../railway/validation';
import { generatedCells } from '../apply';
import { generateScript } from '../generate';
import { parseScript } from '../parse';
import { SCRIPT_TEMPLATES } from '../templates';
import type { Fixture } from './helpers';
import { attr, cellOf, fixture, objects } from './helpers';

const template = (id: string): string => SCRIPT_TEMPLATES.find((t) => t.id === id)!.text;

let f: Fixture | null = null;
afterEach(() => {
  f?.destroy();
  f = null;
});

const SCRIPT = `railwayScript: 1
# the main line
tracks:
  - id: T1          # main track
    startKm: 0.000
    endKm: 1.000
signals:
  - id: S1          # entry signal
    track: T1
    at: 0.200
    direction: nominal
    aspects: 3
  - { id: S2, track: T1, at: 0.800 }
routes:
  - { id: R1, from: S1, to: S2 }
`;

describe('apply (text -> drawing)', () => {
  it('draws the script as one undo step and keeps user cells', async () => {
    f = fixture(SCRIPT);
    const model = f.graph.getDataModel();
    const own = new Cell('note', new Geometry(10, 300, 80, 30), {});
    own.setVertex(true);
    model.add(f.graph.getDefaultParent(), own);
    expect(f.commands.canUndo()).toBe(true);
    f.commands.clearHistory();
    const r = await f.session.apply();
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ added: 4, updated: 0, replaced: 0, removed: 0 });
    expect([...objects(f.graph).keys()].sort()).toEqual(['route:R1', 'signal:S1', 'signal:S2', 'track:T1']);
    expect(attr(f.graph, 'signal:S1', 'rdKm')).toBe('0.2');
    expect(attr(f.graph, 'signal:S1', 'rdTrackId')).toBe('T1');
    expect(f.session.status()).toMatchObject({ dirty: false, conflict: false });
    // one undo step removes the whole drawing; the user's cell stays
    f.commands.undo();
    expect(objects(f.graph).size).toBe(0);
    expect(model.contains(own)).toBe(true);
    f.commands.redo();
    expect(objects(f.graph).size).toBe(4);
  });

  it('re-applying the same text changes nothing (no undo entry)', async () => {
    f = fixture(template('station-two-points'));
    await f.session.apply();
    f.commands.clearHistory();
    const before = generatedCells(f.graph.getDataModel()).byKey.size;
    const r = await f.session.apply();
    expect(r.counts).toEqual({ added: 0, updated: 0, replaced: 0, removed: 0 });
    expect(f.commands.canUndo()).toBe(false);
    expect(generatedCells(f.graph.getDataModel()).byKey.size).toBe(before);
  });

  it('a text edit moves, replaces and removes only the generated cells concerned', async () => {
    f = fixture(SCRIPT);
    await f.session.apply();
    const s1 = cellOf(f.graph, 'signal:S1');
    const x0 = centerOf(s1)!.x;
    f.commands.clearHistory();
    // S1 to km 0.4, S2 reverse (another symbol), R1 removed
    f.store.set(SCRIPT.replace('at: 0.200', 'at: 0.400').replace('{ id: S2, track: T1, at: 0.800 }', '{ id: S2, track: T1, at: 0.800, direction: reverse }').replace(/routes:\n.*\n/, ''), 'editor');
    const r = await f.session.apply();
    expect(r.counts).toMatchObject({ replaced: 1, removed: 1 });
    expect(cellOf(f.graph, 'signal:S1')).toBe(s1);
    expect(centerOf(s1)!.x).toBeCloseTo(x0 + 100, 1);
    expect(attr(f.graph, 'signal:S1', 'rdKm')).toBe('0.4');
    expect(attr(f.graph, 'signal:S2', 'rdScriptShape')).toBe('symbol:signal left 3');
    expect(objects(f.graph).has('route:R1')).toBe(false);
    f.commands.undo();
    expect(attr(f.graph, 'signal:S1', 'rdKm')).toBe('0.2');
    expect(objects(f.graph).has('route:R1')).toBe(true);
  });

  it('errors leave the drawing unchanged', async () => {
    f = fixture(SCRIPT);
    await f.session.apply();
    f.commands.clearHistory();
    f.store.set(SCRIPT.replace('at: 0.200', 'at: zero'), 'editor');
    const r = await f.session.apply();
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ severity: 'error', line: 10 });
    expect(f.commands.canUndo()).toBe(false);
    expect(attr(f.graph, 'signal:S1', 'rdKm')).toBe('0.2');
  });

  it('adopts a palette object with the same kind and ID', async () => {
    f = fixture(SCRIPT);
    const model = f.graph.getDataModel();
    const s = new Cell(buildDataValue('', { kind: 'signal', values: { id: 'S1', notes: 'mine' } }), new Geometry(500, 500, 20, 20), {});
    s.setVertex(true);
    model.add(f.graph.getDefaultParent(), s);
    s.getValue().setAttribute('tooltip', 'kept');
    await f.session.apply();
    expect(model.contains(s)).toBe(false);
    const s1 = cellOf(f.graph, 'signal:S1');
    expect(s1.getValue().getAttribute('rdScript')).toBe('signal:S1');
    expect(s1.getValue().getAttribute('tooltip')).toBe('kept');
    expect(collectObjects(model).filter((o) => o.id === 'S1')).toHaveLength(1);
  });
});

describe('drawing -> text', () => {
  it('a dragged signal gets its new km; comments and layout are kept', async () => {
    f = fixture(SCRIPT);
    await f.session.apply();
    const s1 = cellOf(f.graph, 'signal:S1');
    // 150 drawing units = 300 m to the right; the snap keeps it on T1 and sets rdKm
    f.graph.moveCells([s1], 150, 0);
    expect(attr(f.graph, 'signal:S1', 'rdKm')).toBe('0.5');
    const text = f.store.get();
    expect(text).toContain('  - id: S1          # entry signal\n    track: T1\n    at: 0.500\n');
    expect(text).toContain('# the main line\n');
    expect(text).toContain('  - id: T1          # main track\n');
    expect(text).toContain('  - { id: S2, track: T1, at: 0.800 }\n');
    expect(f.session.status()).toMatchObject({ dirty: false, conflict: false });
    // undo the drag: the text follows
    f.commands.undo();
    expect(f.store.get()).toContain('    at: 0.200\n');
  });

  it('a signal moved away from every track gets x/y', async () => {
    f = fixture(SCRIPT);
    await f.session.apply();
    f.graph.moveCells([cellOf(f.graph, 'signal:S1')], 0, 300);
    const p = parseScript(f.store.get());
    const s1 = p.model!.byMatch.get('signal:S1')!;
    expect(s1.km).toBe(0.2);
    expect(s1.y).toBeGreaterThan(300);
    // apply keeps it there
    await f.session.apply();
    expect(centerOf(cellOf(f.graph, 'signal:S1'))!.y).toBeCloseTo(s1.y!, 1);
  });

  it('Data panel edits, deletes, palette inserts and new routes update the text', async () => {
    f = fixture(template('station-two-points'));
    await f.session.apply();
    const model = f.graph.getDataModel();
    setRailwayData(model, [cellOf(f.graph, 'signal:S4')], { values: { aspects: '4', notes: 'Zażółć' } });
    let text = f.store.get();
    expect(text).toContain('- { id: S4, at: 1.000, direction: nominal, type: main, aspects: 4, notes: Zażółć }');
    // delete S2: the routes to it go too
    f.graph.removeCells([cellOf(f.graph, 'signal:S2')]);
    text = f.store.get();
    expect(text).not.toContain('id: S2,');
    expect(text).not.toContain('id: R3');
    expect(text).not.toContain('id: R4');
    expect(text).toContain('# main line through the station');
    // a palette signal dropped onto T2
    const t2y = trackPolyline(cellOf(f.graph, 'track:T2'))![0].y;
    const s = new Cell(buildDataValue('', { kind: 'signal', values: { id: 'S9', direction: 'reverse', signalType: 'main' } }), new Geometry(380, t2y - 30, 20, 20), {});
    s.setVertex(true);
    f.graph.addCell(s, f.graph.getDefaultParent());
    text = f.store.get();
    const p = parseScript(text);
    const s9 = p.model!.byMatch.get('signal:S9')!;
    expect(s9).toMatchObject({ trackId: 'T2', path: ['signals', 0] });
    expect(s9.values).toMatchObject({ direction: 'reverse', signalType: 'main' });
    // the Route tool's route S9 -> ... : a route between script signals is appended
    const objs = collectObjects(model);
    const e = objs.find((o) => o.id === 'S1')!;
    const x = objs.find((o) => o.id === 'S3')!;
    const path = findRoutePaths(buildTopology(objs), e, x).paths[0];
    addRoute(f.graph, path, e, x, 'R9');
    text = f.store.get();
    expect(text).toContain('- { id: R9, from: S1, to: S3, via: { W1: reverse } }');
    // applying the synced text keeps the drawing (the palette signal is adopted)
    const r = await f.session.apply();
    expect(r.ok).toBe(true);
    expect(collectObjects(model).filter((o) => o.id === 'S9')).toHaveLength(1);
  });

  it('a moved track changes its lane', async () => {
    f = fixture(template('station-two-points'));
    await f.session.apply();
    f.graph.moveCells([cellOf(f.graph, 'track:T2')], 0, 80);
    expect(f.store.get()).toMatch(/- id: T2\n(?:.*\n)*?\s+lane: 2\n/);
  });

  it('drawing edits while the text has unapplied edits: conflict, the text is not overwritten', async () => {
    f = fixture(SCRIPT);
    await f.session.apply();
    const edited = SCRIPT.replace('aspects: 3', 'aspects: 5');
    f.store.set(edited, 'editor');
    f.graph.moveCells([cellOf(f.graph, 'signal:S1')], 150, 0);
    expect(f.store.get()).toBe(edited);
    expect(f.session.status()).toMatchObject({ conflict: true, dirty: true });
    // "Use drawing": the edit is dropped, the drag is written
    f.session.useDrawing();
    expect(f.store.get()).toContain('aspects: 3');
    expect(f.store.get()).toContain('at: 0.500');
    expect(f.session.status().conflict).toBe(false);
  });

  it('undo of an apply restores the text applied before', async () => {
    f = fixture(SCRIPT);
    await f.session.apply();
    const moved = SCRIPT.replace('at: 0.200', 'at: 0.300');
    f.store.set(moved, 'editor');
    await f.session.apply();
    f.commands.undo();
    expect(f.store.get()).toBe(SCRIPT);
    f.commands.redo();
    expect(f.store.get()).toBe(moved);
  });

  it('JSON scripts stay JSON', async () => {
    const json = JSON.stringify({ railwayScript: 1, tracks: [{ id: 'T1', startKm: 0, endKm: 1 }], signals: [{ id: 'S1', track: 'T1', at: 0.2 }] }, null, 2);
    f = fixture(json);
    await f.session.apply();
    f.graph.moveCells([cellOf(f.graph, 'signal:S1')], 50, 0);
    expect(JSON.parse(f.store.get()).signals[0]).toEqual({ id: 'S1', track: 'T1', at: 0.3 });
  });
});

describe('generate from drawing', () => {
  for (const t of SCRIPT_TEMPLATES) {
    it(`round trip: ${t.id}`, async () => {
      f = fixture(t.text);
      await f.session.apply();
      const before = collectObjects(f.graph.getDataModel());
      const g = generateScript(f.graph.getDataModel(), 'X');
      const p = parseScript(g.text);
      expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      // the same objects with the same km
      for (const o of before) {
        const s = p.model!.byMatch.get(`${o.kind.id}:${o.id.toUpperCase()}`);
        expect(s, `${o.kind.id}:${o.id}`).toBeDefined();
        if (o.values.km && s!.km !== undefined) expect(s!.km).toBeCloseTo(Number(o.values.km), 3);
      }
      // drawn again from the generated script: same places
      const again = fixture(g.text);
      try {
        await again.session.apply();
        for (const o of before) {
          const c = objects(again.graph).get(`${o.kind.id}:${o.id}`)!;
          if (o.cell.isEdge()) {
            expect(trackPolyline(c.cell)!.map((q) => [Math.round(q.x), Math.round(q.y)])).toEqual(trackPolyline(o.cell)!.map((q) => [Math.round(q.x), Math.round(q.y)]));
          } else {
            const a = centerOf(o.cell)!;
            const b = centerOf(c.cell)!;
            expect(Math.hypot(a.x - b.x, a.y - b.y), `${o.kind.id}:${o.id}`).toBeLessThan(1.5);
          }
        }
      } finally {
        again.destroy();
      }
    });
  }

  it('writes the objects of a hand-drawn layout', async () => {
    const { specLayout } = await import('../../railml/__tests__/helpers');
    const l = specLayout();
    const g = generateScript(l.model, 'Spec');
    const p = parseScript(g.text);
    expect(p.hasErrors).toBe(false);
    const m = p.model!;
    expect(m.tracks.map((t) => [t.id, t.kmStart, t.kmEnd])).toEqual([
      ['T1', 10, 10.6],
      ['T2', 20, 20.5],
    ]);
    expect(m.byMatch.get('points:W1')).toMatchObject({ trackId: 'T1', km: 10.2 });
    expect(m.byMatch.get('signal:S1')).toMatchObject({ trackId: 'T1', km: 10.05 });
    expect(m.byMatch.get('route:R1')).toMatchObject({ from: 'S1', to: 'S3' });
    expect(g.text).toContain('balises: [ { id: B1, at: 10.09 }, { id: B2, at: 10.11 } ]');
  });
});
