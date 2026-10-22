/**
 * Railway Script language: parsing, schema validation with line:column, aliases, the model, and
 * text -> drawing for the example templates.
 */
import { describe, expect, it } from 'vitest';
import { ROUTES_LAYER_ID } from '../../railway/route-store';
import { centerOf, trackPolyline } from '../../railway/geometry';
import { handOfLeg } from '../../railway/hand';
import { collectObjects, validateModel } from '../../railway/validation';
import { ertmsEntries } from '../../railml/__tests__/helpers';
import { buildScriptModel } from '../build';
import { parseScript } from '../parse';
import { SCRIPT_TEMPLATES } from '../templates';

const template = (id: string): string => SCRIPT_TEMPLATES.find((t) => t.id === id)!.text;

function values(text: string): Map<string, Record<string, string>> {
  const p = parseScript(text);
  expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const b = buildScriptModel(p.model!, ertmsEntries());
  return new Map(collectObjects(b.model).map((o) => [`${o.kind.id}:${o.id}`, Object.fromEntries(Object.entries(o.values).filter(([, v]) => v !== ''))]));
}

describe('parse and validate', () => {
  it('reports YAML syntax errors with line and column', () => {
    const p = parseScript('railwayScript: 1\ntracks:\n  - id: T1\n   startKm: 0\n');
    expect(p.hasErrors).toBe(true);
    expect(p.model).toBeNull();
    expect(p.diagnostics[0].line).toBe(4);
  });

  it('reports schema errors at the offending value', () => {
    const text = 'railwayScript: 1\ntracks:\n  - id: T1\n    startKm: 0\n    endKm: 1\nsignals:\n  - { id: S1, track: T1, at: 0.5, direction: sideways }\n';
    const p = parseScript(text);
    const d = p.diagnostics.find((x) => x.severity === 'error')!;
    expect(d.message).toContain('signals[0].direction');
    expect(d.message).toContain('is not one of nominal, reverse');
    expect([d.line, d.col]).toEqual([7, 46]);
    expect(text.slice(d.from, d.to)).toBe('sideways');
  });

  it('reports missing keys, bad km text and the wrong version', () => {
    const p = parseScript('railwayScript: 2\ntracks:\n  - id: T1\n    startKm: 0\nsignals:\n  - { id: S1, track: T1, at: "1,2km" }\n');
    const msgs = p.diagnostics.map((d) => `${d.line}: ${d.message}`);
    expect(msgs).toContain('1: railwayScript: must be 1, got 2');
    expect(msgs.some((m) => m.startsWith('3: tracks[0]: needs one of: endKm, kmEnd, end, EndPos'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('6: signals[0].at: expected a km value'))).toBe(true);
  });

  it('warns about unknown keys at the key and keeps going', () => {
    const text = 'railwayScript: 1\ncolour: red\ntracks:\n  - { id: T1, startKm: 0, endKm: 1, gauge: 1435 }\n';
    const p = parseScript(text);
    expect(p.hasErrors).toBe(false);
    expect(p.model).not.toBeNull();
    const w = p.diagnostics.filter((d) => d.severity === 'warning');
    expect(w.map((d) => [d.line, text.slice(d.from, d.to)])).toEqual([
      [2, 'colour'],
      [4, 'gauge'],
    ]);
  });

  it('checks references, duplicates and km ranges', () => {
    const p = parseScript(
      [
        'railwayScript: 1',
        'tracks:',
        '  - { id: T1, startKm: 0, endKm: 1 }',
        '  - { id: t1, startKm: 2, endKm: 3 }',
        'signals:',
        '  - { id: S1, track: T9, at: 0.5 }',
        '  - { id: S2, track: T1, at: 1.5 }',
        'routes:',
        '  - { id: R1, from: S2, to: S7, via: { W3: reverse } }',
      ].join('\n')
    );
    const msgs = p.diagnostics.map((d) => `${d.severity} ${d.line}: ${d.message}`);
    expect(msgs).toEqual([
      'error 4: Track ID "t1" is used twice',
      'error 6: Signal S1: unknown track "T9"',
      'warning 7: Signal S2: km 1.5 is outside track T1 (0–1); drawn at the track end',
      'error 9: Route R1: unknown signal "S7"',
      'error 9: Route R1: unknown points "W3"',
    ]);
  });

  it('accepts JSON (it is YAML)', () => {
    const p = parseScript('{"railwayScript": 1, "tracks": [{"id": "T1", "StartPos": 0, "EndPos": 1000}]}');
    expect(p.hasErrors).toBe(false);
    expect(p.json).toBe(true);
    expect(p.model!.tracks[0]).toMatchObject({ id: 'T1', kmStart: 0, kmEnd: 1 });
  });
});

describe('aliases and values', () => {
  it('reads StartPos/EndPos and start/end in metres, chainage and the alias keys', () => {
    const v = values(
      [
        'railwayScript: 1',
        'tracks:',
        '  - id: T1',
        '    StartPos: 0',
        '    EndPos: 1000',
        '    Points: []',
        '    points:',
        '      - { id: W1, at: "0+300", to: T2 }',
        '  - { id: T2, start: 350, end: 800 }',
        '  - { id: T3, kmStart: 2, endKm: 2.5 }',
        'signals:',
        '  - { id: S1, track: T1, at: "0+100", signalType: shunting }',
        '  - { id: S2, track: T2, at: 0.7, type: main, direction: nominal }',
        'routes:',
        '  - { id: R1, entrySignal: S1, exitSignal: S2, via: "W1:R" }',
      ].join('\n')
    );
    expect(v.get('track:T1')).toMatchObject({ kmStart: '0', kmEnd: '1', length: '1000' });
    expect(v.get('track:T2')).toMatchObject({ kmStart: '0.35', kmEnd: '0.8' });
    expect(v.get('track:T3')).toMatchObject({ kmStart: '2', kmEnd: '2.5' });
    expect(v.get('points:W1')).toEqual({ id: 'W1', km: '0.3', trackId: 'T1', hand: 'right' });
    expect(v.get('signal:S1')).toMatchObject({ signalType: 'shunting', km: '0.1', trackId: 'T1', routes: 'R1' });
    expect(v.get('signal:S2')).toMatchObject({ signalType: 'main', km: '0.7', trackId: 'T2' });
    expect(v.get('route:R1')).toMatchObject({ entrySignal: 'S1', exitSignal: 'S2', points: 'W1:reverse', sections: 'T1, T2' });
  });

  it('puts objects nested in a track item on that track', () => {
    const p = parseScript('railwayScript: 1\ntracks:\n  - id: A\n    startKm: 5\n    endKm: 6\n    signals:\n      - { id: S1, at: 5.5 }\n    trains:\n      - { id: TR1, at: 5.2, length: 120, direction: reverse }\n');
    expect(p.hasErrors).toBe(false);
    const s = p.model!.byMatch.get('signal:S1')!;
    expect(s).toMatchObject({ trackId: 'A', km: 5.5, path: ['tracks', 0, 'signals', 0] });
    expect(p.model!.byMatch.get('train:TR1')!.attrs).toEqual({ rdDirection: 'reverse', rdTrackId: 'A', rdKm: '5.2' });
  });
});

describe('text -> drawing (example templates)', () => {
  it('simple line: track, buffer stops, signals beside the track, routes on the Routes layer', () => {
    const p = parseScript(template('simple-line'));
    const b = buildScriptModel(p.model!, ertmsEntries());
    expect(b.counts).toEqual({ track: 1, signal: 4, bufferStop: 2, route: 2 });
    const objs = new Map(collectObjects(b.model).map((o) => [`${o.kind.id}:${o.id}`, o]));
    const t1 = trackPolyline(objs.get('track:T1')!.cell)!;
    expect(t1).toEqual([
      { x: 40, y: 80 },
      { x: 1040, y: 80 },
    ]);
    // nominal signal below a left-to-right track, reverse above (snap.ts convention)
    expect(centerOf(objs.get('signal:S1')!.cell)!.y).toBeGreaterThan(80);
    expect(centerOf(objs.get('signal:S4')!.cell)!.y).toBeLessThan(80);
    expect(centerOf(objs.get('signal:S1')!.cell)!.x).toBeCloseTo(140, 0);
    // ERTMS library symbol: "Signal Right 3" group with the ID text
    const s1 = objs.get('signal:S1')!.cell;
    expect(s1.getChildCount()).toBeGreaterThan(3);
    expect(s1.getValue().getAttribute('rdScriptShape')).toBe('symbol:signal right 3');
    expect(s1.getValue().getAttribute('rdScript')).toBe('signal:S1');
    const r1 = objs.get('route:R1')!;
    expect(r1.cell.getParent()?.getId()).toBe(ROUTES_LAYER_ID);
    expect(r1.values).toMatchObject({ entrySignal: 'S1', exitSignal: 'S2', length: '800' });
    expect(b.issues).toEqual([]);
  });

  it('station: the loop goes below for right-hand points, routes take the points positions', () => {
    const v = values(template('station-two-points'));
    expect(v.get('route:R1')).toMatchObject({ points: 'W1:normal', sections: 'T1' });
    expect(v.get('route:R2')).toMatchObject({ points: 'W1:reverse', sections: 'T1, T2' });
    expect(v.get('route:R4')).toMatchObject({ points: 'W2:reverse', sections: 'T2, T1' });
    expect(v.get('signal:S1')!.routes).toBe('R1, R2');
    const p = parseScript(template('station-two-points'));
    const b = buildScriptModel(p.model!, ertmsEntries());
    const objs = new Map(collectObjects(b.model).map((o) => [`${o.kind.id}:${o.id}`, o]));
    const t2 = trackPolyline(objs.get('track:T2')!.cell)!;
    expect(t2[0].y).toBe(160);
    const w1 = trackPolyline(objs.get('points:W1')!.cell)!;
    expect(w1).toEqual([
      { x: 240, y: 80 },
      { x: 320, y: 160 },
    ]);
    expect(t2[0]).toEqual(w1[1]);
    // the siding is drawn thinner, the drawing passes the railway checks
    expect(objs.get('track:T2')!.cell.getValue().getAttribute('rdScriptShape')).toBe('track:siding');
    expect(validateModel(b.model).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('ETCS L2 block: sections between axle counters, balise groups with balises, RBC and train', () => {
    const v = values(template('etcs-l2-block'));
    expect(v.get('trackSection:TS2')).toMatchObject({ sectionType: 'axleCounter', trackId: 'T1', kmStart: '11', kmEnd: '12', length: '1000' });
    expect(v.get('axleCounter:AC2')!.sections).toBe('TS1, TS2');
    expect(v.get('baliseGroup:BG1')).toMatchObject({ nidC: '353', nidBg: '101', count: '2', km: '10.9' });
    expect(v.get('balise:BG1-1')).toMatchObject({ groupId: 'BG1', position: '1', trackId: 'T1' });
    expect(Number(v.get('balise:BG1-1')!.km)).toBeLessThan(10.9);
    expect(v.get('signal:MB1')).toMatchObject({ signalType: 'markerBoard', routes: 'R1' });
    expect(v.get('route:R1')).toMatchObject({ sections: 'TS1, TS2', overlap: 'TS2' });
    expect(v.get('train:TR1')).toMatchObject({ etcsLevel: '2', length: '200', rbcId: 'RBC1' });
    expect(v.get('rbc:RBC1')).toMatchObject({ nidC: '353', nidRbc: '1' });
  });

  it('reports a route without a path as a warning at the route', () => {
    const text = 'railwayScript: 1\ntracks:\n  - { id: T1, startKm: 0, endKm: 1 }\nsignals:\n  - { id: S1, track: T1, at: 0.2 }\n  - { id: S2, track: T1, at: 0.8, direction: reverse }\nroutes:\n  - { id: R1, from: S1, to: S2 }\n';
    const p = parseScript(text);
    const b = buildScriptModel(p.model!, ertmsEntries());
    expect(b.issues.map((i) => i.message)).toEqual([expect.stringContaining('Route R1: no path from S1 to S2')]);
  });
});

describe('points hand (read from the toe: leg to the left looking from the toe towards the frog = left)', () => {
  const script = (hand: string, t2: [number, number]): string =>
    [
      'railwayScript: 1',
      'tracks:',
      '  - id: T1',
      '    startKm: 0',
      '    endKm: 1',
      ...(hand ? [] : ['    lane: 0']),
      '    points:',
      `      - { id: W1, at: 0.5, to: T2${hand ? `, hand: ${hand}` : ''} }`,
      `  - { id: T2, startKm: ${t2[0]}, endKm: ${t2[1]}${hand ? '' : ', lane: 1'} }`,
    ].join('\n');
  const AFTER: [number, number] = [0.6, 0.9]; // toe on the left of W1
  const BEFORE: [number, number] = [0.1, 0.4]; // toe on the right of W1

  it.each([
    ['left', AFTER, 'up'],
    ['right', AFTER, 'down'],
    ['left', BEFORE, 'down'],
    ['right', BEFORE, 'up'],
  ] as const)('hand %s, diverging track %j -> drawn %s', (hand, t2, side) => {
    const b = buildScriptModel(parseScript(script(hand, t2)).model!, ertmsEntries());
    const objs = new Map(collectObjects(b.model).map((o) => [`${o.kind.id}:${o.id}`, o]));
    const y1 = trackPolyline(objs.get('track:T1')!.cell)![0].y;
    const y2 = trackPolyline(objs.get('track:T2')!.cell)![0].y;
    expect(side === 'up' ? y2 < y1 : y2 > y1).toBe(true);
    const leg = trackPolyline(objs.get('points:W1')!.cell)!;
    expect(handOfLeg(leg[0], leg[leg.length - 1])).toBe(hand);
  });

  it('without a hand, it is derived from the drawn leg (diverging track a lane below, toe left = right)', () => {
    const b = buildScriptModel(parseScript(script('', AFTER)).model!, ertmsEntries());
    expect(collectObjects(b.model).find((o) => o.kind.id === 'points')!.values.hand).toBe('right');
    const before = buildScriptModel(parseScript(script('', BEFORE)).model!, ertmsEntries());
    expect(collectObjects(before.model).find((o) => o.kind.id === 'points')!.values.hand).toBe('left');
  });
});
