/**
 * Train run simulation (run-path.ts, simulate.ts, run-renderer.ts): path of one route / a chain in
 * metres, event order and times (head enters / tail clears, sequential release, entry signal back
 * to stop, arrival, overlap release timer), speed limits, points locked / released, approximate
 * lengths, the renderer on a graph (states at t, scrubbing back, train position, restore).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GraphDataModel } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import { importDrawioXmlIntoModel } from '../../../services/drawio-xml';
import { cleanupTestGraph, createTestGraph } from '../../../__tests__/setup';
import { readAttr } from '../../object-data';
import { buildRunPath, kmAtM, pointAtM } from '../run-path';
import type { RunPath } from '../run-path';
import { headAt, simulateRun, speedAt, statesAt, timeAtM } from '../simulate';
import type { RunEvent } from '../simulate';
import { RunRenderer } from '../run-renderer';
import { POINTS_LAYOUT, lineLayout } from './fixtures';

function modelOf(xml: string): GraphDataModel {
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(xml, model);
  return model;
}

function pathOf(xml: string, routes: string[]): RunPath {
  const res = buildRunPath(modelOf(xml), routes);
  expect(res.error).toBeUndefined();
  return res.path!;
}

const brief = (events: RunEvent[]): string[] => events.map((e) => `${Math.round(e.t * 100) / 100} ${e.type} ${e.subject}`);

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

describe('run path', () => {
  it('one route: blocks in metres, overlap, signals', () => {
    const path = pathOf(lineLayout(), ['R1']);
    expect(path.lengthM).toBeCloseTo(400);
    expect(path.approximate).toBe(false);
    expect(path.blocks.map((b) => [b.id, b.kind, Math.round(b.startM), Math.round(b.endM)])).toEqual([
      ['TC1', 'section', 0, 200],
      ['TC2', 'section', 200, 400],
    ]);
    expect(path.overlap).toEqual(['TC3']);
    expect(path.routes.map((r) => [r.id, r.entry, r.exit])).toEqual([['R1', 'S1', 'S2']]);
    expect(pointAtM(path, 150).p).toEqual({ x: 150, y: 100 });
    expect(pointAtM(path, -50).p).toEqual({ x: -50, y: 100 });
  });

  it('a chain of consecutive routes; the overlap of the last one', () => {
    const path = pathOf(lineLayout(), ['R1', 'R2']);
    expect(path.lengthM).toBeCloseTo(600);
    expect(path.blocks.map((b) => `${b.id}@${b.routeId}`)).toEqual(['TC1@R1', 'TC2@R1', 'TC3@R2']);
    expect(path.overlap).toEqual(['TC4']);
  });

  it('errors: unknown route, not consecutive, none', () => {
    expect(buildRunPath(modelOf(lineLayout()), ['R9']).error).toMatch(/R9/);
    expect(buildRunPath(modelOf(lineLayout()), ['R2', 'R1']).error).toMatch(/consecutive/);
    expect(buildRunPath(modelOf(lineLayout()), []).error).toMatch(/Choose a route/);
  });

  it('without lengths: drawing units as metres with a warning', () => {
    const path = pathOf(lineLayout({ noLengths: true }), ['R1']);
    expect(path.approximate).toBe(true);
    expect(path.lengthM).toBeCloseTo(400);
    expect(path.warnings[0]).toMatch(/drawing units/);
    const run = simulateRun(path, { speedKmh: 72, lengthM: 100 });
    expect(run.warnings[0]).toMatch(/approximate/);
  });

  it('km of a position when the track has km start/end', () => {
    const path = pathOf(lineLayout({ kmOnTc1: true }), ['R1']);
    expect(kmAtM(path, 100)).toBeCloseTo(12.1);
    expect(kmAtM(path, 300)).toBeNull();
  });
});

describe('simulation', () => {
  it('one route at constant speed: event order and times', () => {
    // 72 km/h = 20 m/s, train 100 m, departs after 5 s
    const run = simulateRun(pathOf(lineLayout(), ['R1']), { speedKmh: 72, lengthM: 100 });
    expect(brief(run.events)).toEqual([
      '0 route-set R1',
      '5 depart S1',
      '5 signal-passed S1',
      '5 head-enter TC1',
      '15 head-enter TC2',
      '20 tail-clear TC1',
      '25 arrive S2',
      '55 overlap-released TC3',
    ]);
    expect(run.departS).toBe(5);
    expect(run.arriveS).toBeCloseTo(25);
    expect(run.durationS).toBeCloseTo(55);
    const set = run.events[0].changes;
    expect(set).toContainEqual({ kind: 'route', id: 'R1', state: 'reserved' });
    expect(set).toContainEqual({ kind: 'section', id: 'TC1', state: 'reserved' });
    expect(set).toContainEqual({ kind: 'section', id: 'TC3', state: 'overlap' });
    expect(set).toContainEqual({ kind: 'signal', id: 'S1', aspect: 'proceed' });
    expect(run.events[2].changes).toContainEqual({ kind: 'signal', id: 'S1', aspect: 'stop' });
    expect(run.events.find((e) => e.subject === 'TC2' && e.type === 'head-enter')!.speedKmh).toBeCloseTo(72);
    expect(run.events.find((e) => e.type === 'arrive')!.speedKmh).toBe(0);
  });

  it('chain: sequential release, route released, intermediate signal back to stop', () => {
    const run = simulateRun(pathOf(lineLayout(), ['R1', 'R2']), { speedKmh: 72, lengthM: 100, dwellS: 10, overlapReleaseS: 20 });
    expect(brief(run.events)).toEqual([
      '0 route-set R1',
      '0 route-set R2',
      '5 depart S1',
      '5 signal-passed S1',
      '5 head-enter TC1',
      '15 head-enter TC2',
      '20 tail-clear TC1',
      '25 signal-passed S2',
      '25 head-enter TC3',
      '30 tail-clear TC2',
      '30 route-released R1',
      '35 arrive S3',
      '55 overlap-released TC4',
    ]);
    // only the last route's overlap is set; R1's "overlap" TC3 is R2's section
    const changes = run.events.slice(0, 2).flatMap((e) => e.changes);
    expect(changes.filter((c) => c.state === 'overlap').map((c) => c.id)).toEqual(['TC4']);
    expect(statesAt(run, 29).get('block:TC2')?.state).toBe('occupied');
    expect(statesAt(run, 30).get('block:TC2')?.state).toBe('free');
    expect(statesAt(run, 30).get('route:R1')?.state).toBe('free');
    expect(statesAt(run, 40).get('signal:S2')?.aspect).toBe('stop');
    expect(run.durationS).toBeCloseTo(55);
  });

  it('dwell longer than the overlap timer ends the run later', () => {
    const run = simulateRun(pathOf(lineLayout(), ['R1']), { speedKmh: 72, lengthM: 100, dwellS: 60, overlapReleaseS: 10 });
    expect(run.events.at(-1)!.t).toBeCloseTo(35);
    expect(run.durationS).toBeCloseTo(85);
  });

  it('per-section speed limits (rdSpeedLimit) slow the train while any part of it is in the section', () => {
    const path = pathOf(lineLayout({ tc2Extra: 'rdSpeedLimit="36"' }), ['R1', 'R2']);
    expect(path.blocks[1].limitKmh).toBe(36);
    const constant = simulateRun(path, { speedKmh: 72, lengthM: 100 });
    expect(constant.arriveS).toBeCloseTo(35);
    const limited = simulateRun(path, { speedKmh: 72, lengthM: 100, useSpeedLimits: true });
    // 0..200 at 20 m/s (10 s), 200..500 at 10 m/s (30 s: the tail leaves TC2 at 500), 500..600 at 20 m/s (5 s)
    expect(timeAtM(limited, 200)).toBeCloseTo(15);
    expect(timeAtM(limited, 500)).toBeCloseTo(45);
    expect(limited.arriveS).toBeCloseTo(50);
    expect(speedAt(limited, 20)).toBeCloseTo(36);
    expect(speedAt(limited, 47)).toBeCloseTo(72);
    expect(headAt(limited, 25)).toBeCloseTo(300);
    expect(limited.events.find((e) => e.type === 'tail-clear' && e.subject === 'TC2')!.t).toBeCloseTo(45);
  });

  it('points: positioned and locked at the set, occupied / released with their leg', () => {
    const path = pathOf(POINTS_LAYOUT, ['R1']);
    expect(path.blocks.map((b) => `${b.id}:${b.kind}`)).toEqual(['TC1:section', 'W1:points', 'TC3:section']);
    expect(path.points).toEqual([{ id: 'W1', position: 'reverse', routeId: 'R1', atM: expect.closeTo(110, 0) }]);
    const run = simulateRun(path, { speedKmh: 36, lengthM: 50 });
    expect(run.events[0].changes).toContainEqual({ kind: 'points', id: 'W1', position: 'reverse', state: 'locked' });
    const types = brief(run.events).map((s) => s.split(' ').slice(1).join(' '));
    expect(types).toEqual([
      'route-set R1',
      'depart S1',
      'signal-passed S1',
      'head-enter TC1',
      'head-enter W1',
      'tail-clear TC1',
      'head-enter TC3',
      'tail-clear W1',
      'arrive S3',
    ]);
    const freed = run.events.find((e) => e.type === 'tail-clear' && e.subject === 'W1')!;
    expect(statesAt(run, freed.t).get('points:W1')).toEqual({ kind: 'points', id: 'W1', position: 'reverse', state: 'free' });
  });

  it('a train longer than the route never clears a block', () => {
    const run = simulateRun(pathOf(lineLayout(), ['R1']), { speedKmh: 72, lengthM: 500 });
    expect(run.events.filter((e) => e.type === 'tail-clear')).toEqual([]);
  });
});

describe('renderer', () => {
  it('shows states at t, scrubs back, moves the train and restores the drawing', () => {
    graph = createTestGraph();
    importDrawioXmlIntoModel(lineLayout({ train: true }), graph.getDataModel());
    const model = graph.getDataModel();
    const run = simulateRun(buildRunPath(model, ['R1']).path!, { speedKmh: 72, lengthM: 100 });
    const r = new RunRenderer(graph, run, { cellId: 'tr1' });
    expect(r.missing).toEqual([]);
    expect(r.trainId).toBe('TR1');
    const tc1 = model.getCell('tc1')!;
    r.showAt(0);
    expect(readAttr(tc1, 'rdState')).toBe('reserved');
    expect(readAttr(model.getCell('s1'), 'rdAspect')).toBe('proceed');
    r.showAt(10); // head at 100 m
    expect(readAttr(tc1, 'rdState')).toBe('occupied');
    expect(readAttr(model.getCell('tc2'), 'rdState')).toBe('reserved');
    expect(readAttr(model.getCell('s1'), 'rdAspect')).toBe('');
    const geo = model.getCell('tr1')!.getGeometry()!;
    expect(geo.x + geo.width).toBeCloseTo(100);
    expect(geo.y + geo.height).toBeLessThan(100);
    r.showAt(21);
    expect(readAttr(tc1, 'rdState')).toBe('');
    r.showAt(2); // back: occupied/free undone
    expect(readAttr(tc1, 'rdState')).toBe('reserved');
    expect(model.getCell('tr1')!.getGeometry()!.x + 60).toBeCloseTo(0);
    r.restore();
    expect(readAttr(tc1, 'rdState')).toBe('');
    expect(readAttr(tc1, 'rdBaseStyle')).toBe('');
    expect(model.getCell('tr1')!.getGeometry()!.x).toBe(-120);
  });

  it('creates a new train when none is chosen and removes it on restore', () => {
    graph = createTestGraph();
    importDrawioXmlIntoModel(lineLayout(), graph.getDataModel());
    const run = simulateRun(buildRunPath(graph.getDataModel(), ['R1']).path!, { speedKmh: 72, lengthM: 100 });
    const r = new RunRenderer(graph, run, { cellId: null });
    expect(r.trainId).toBe('TR1');
    r.showAt(run.durationS);
    const train = r.getTrainCell()!;
    expect(readAttr(train, 'rdKind')).toBe('train');
    expect(readAttr(train, 'rdLength')).toBe('100');
    expect(train.getGeometry()!.x + train.getGeometry()!.width).toBeCloseTo(400);
    r.restore();
    expect(graph.getDataModel().contains(train)).toBe(false);
  });
});
