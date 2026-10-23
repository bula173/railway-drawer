/**
 * Interlocking table: points roles, overlap, flank protection, conflict codes and the matrix on
 * small layouts (single points station, crossover, opposing routes on parallel tracks), the
 * export tables (PL/EN) and the xlsx workbook.
 */
import { describe, expect, it } from 'vitest';
import { Layout, crossoverLayout, opposingLayout, stationLayout } from './layouts';
import {
  buildConflictMatrixTable,
  buildConflictPairsTable,
  buildInterlockingTable,
  computeInterlocking,
  conflictCodes,
  conflictMatrix,
  formatAspect,
  MATRIX_SELF,
} from '../interlocking';
import { buildXlsx } from '../xlsx';

describe('interlocking: single points station', () => {
  const l = stationLayout();
  l.route('R1', 'S1', 'S2');
  l.route('R2', 'S1', 'S3');
  const il = computeInterlocking(l.objects());

  it('lists points with position and facing/trailing role, sections and overlap', () => {
    const [r1, r2] = il.routes;
    expect(r1.points).toEqual([{ id: 'W1', position: 'normal', role: 'facing' }]);
    expect(r2.points).toEqual([{ id: 'W1', position: 'reverse', role: 'facing' }]);
    expect(r1.sections).toEqual(['T1']);
    expect(r2.sections).toEqual(['T1', 'T2']);
    expect(r2.overlap).toEqual(['T2']);
    expect(r2.overlapMetres).toBe(100);
    expect(r1.overlapMetres).toBe(50);
    expect(r1.directions).toEqual({ T1: 'nominal' });
  });

  it('finds no flank element where the other leg ends in a track end', () => {
    expect(il.routes[0].flank).toEqual([]);
    expect(il.routes[1].flank).toEqual([]);
    expect(il.routes[0].unprotected).toEqual([]);
  });

  it('conflict: shared section and opposite points positions', () => {
    expect(il.conflicts).toHaveLength(1);
    expect(il.conflicts[0]).toMatchObject({ a: 'R1', b: 'R2', codes: ['S', 'P'], sharedSections: ['T1'], points: ['W1 (normal/reverse)'] });
  });

  it('entry signal aspect data: proceed/caution, speed restriction over reverse points', () => {
    expect(il.routes[0].aspect).toMatchObject({ next: 'S2', aspects: [{ when: 'nextProceed', aspect: 'proceed' }, { when: 'nextStop', aspect: 'caution' }], speedRestricted: false });
    expect(il.routes[1].aspect.reversePoints).toEqual(['W1']);
    expect(formatAspect(il.routes[1].aspect, 'en')).toBe('Proceed (S3 proceed) / Caution (S3 at stop); speed restriction (W1 reverse)');
    expect(formatAspect(il.routes[1].aspect, 'pl')).toBe('Wolna droga (S3 zezwala na jazdę) / Ostrzeżenie (S3 Stój); ograniczenie prędkości (W1 w położeniu zwrotnym)');
  });

  it('marker board as next signal: ETCS movement authority; 2-aspect entry signal: proceed only', () => {
    const m = stationLayout();
    m.signal('S9', 'nominal', 450, 115, { signalType: 'markerBoard' });
    m.route('R1', 'S1', 'S9');
    expect(formatAspect(computeInterlocking(m.objects()).routes[0].aspect, 'en')).toBe('ETCS MA to S9');
    const n = stationLayout();
    n.route('R1', 'S1', 'S2');
    const objects = n.objects().map((o) => (o.id === 'S1' ? { ...o, values: { ...o.values, aspects: '2' } } : o));
    expect(formatAspect(computeInterlocking(objects).routes[0].aspect, 'en')).toBe('Proceed (2-aspect signal)');
  });
});

describe('interlocking: crossover', () => {
  const l = crossoverLayout();
  l.route('R1', 'S1', 'S2');
  l.route('R2', 'S3', 'S4');
  l.route('R3', 'S1', 'S4');
  const il = computeInterlocking(l.objects());
  const r = (id: string) => il.routes.find((x) => x.id === id)!;

  it('flank protection over the crossover: the other points in normal', () => {
    expect(r('R1').flank).toEqual([{ kind: 'points', id: 'W2', position: 'normal', protects: ['W1'] }]);
    expect(r('R2').flank).toEqual([{ kind: 'points', id: 'W1', position: 'normal', protects: ['W2'] }]);
  });

  it('flank protection by a signal at stop reading towards the points', () => {
    expect(r('R3').points).toEqual([
      { id: 'W1', position: 'reverse', role: 'facing' },
      { id: 'W2', position: 'reverse', role: 'trailing' },
    ]);
    expect(r('R3').flank).toEqual([{ kind: 'signal', id: 'S3', protects: ['W2'] }]);
  });

  it('parallel movements do not conflict; the crossover route conflicts with both (S, P, F)', () => {
    expect(conflictCodes(il, 'R1', 'R2')).toEqual([]);
    expect(conflictCodes(il, 'R1', 'R3')).toEqual(['S', 'P', 'F']);
    expect(conflictCodes(il, 'R2', 'R3')).toEqual(['S', 'P', 'F']);
    const c = il.conflicts.find((x) => x.a === 'R2' && x.b === 'R3')!;
    expect(c.flank).toEqual(['W1 (R2 flank normal/R3 reverse)', 'S3 (R3 flank stop/R2 entry)']);
  });

  it('the matrix is symmetric with an empty diagonal', () => {
    const m = conflictMatrix(il);
    for (let i = 0; i < m.length; i++) {
      expect(m[i][i]).toBeNull();
      for (let j = 0; j < m.length; j++) if (i !== j) expect(m[i][j]).toEqual(m[j][i]);
    }
    const t = buildConflictMatrixTable(il);
    expect(t.columns).toEqual(['Route', 'R1', 'R2', 'R3']);
    expect(t.rows).toEqual([
      ['R1', MATRIX_SELF, '', 'S P F'],
      ['R2', '', MATRIX_SELF, 'S P F'],
      ['R3', 'S P F', 'S P F', MATRIX_SELF],
    ]);
  });

  it('PKP-style interlocking table (pl) and the English one', () => {
    const pl = buildInterlockingTable(il, 'pl');
    expect(pl.title).toBe('Tablica zależności');
    expect(pl.columns).toEqual(['Przebieg', 'Od semafora', 'Do semafora', 'Zwrotnice (położenie)', 'Ochrona boczna', 'Odcinki izolowane/sekcje', 'Zakładka', 'Przebiegi wykluczające się', 'Sygnał na semaforze']);
    expect(pl.rows[2].slice(0, 8)).toEqual(['R3', 'S1', 'S4', 'W1-, W2-', 'S3 Stój', 'T1, T2', 'T2', 'R1 (S,P,F), R2 (S,P,F)']);
    const en = buildInterlockingTable(il, 'en');
    expect(en.rows[0].slice(0, 5)).toEqual(['R1', 'S1', 'S2', 'W1 normal (facing)', 'W2 normal']);
    expect(buildConflictMatrixTable(il, 'pl').title).toBe('Macierz konfliktów');
  });

  it('xlsx workbook with the PKP sheets', () => {
    const bytes = buildXlsx([buildInterlockingTable(il, 'pl'), buildConflictMatrixTable(il, 'pl')]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('<sheet name="Tablica zależności"');
    expect(text).toContain('<sheet name="Macierz konfliktów"');
    expect(text).toContain('Przebiegi wykluczające się');
  });
});

describe('interlocking: opposing routes on parallel tracks', () => {
  const l = opposingLayout();
  l.route('R1', 'S1', 'S3');
  l.route('R2', 'S2', 'S4');
  l.route('R3', 'S5', 'S6');
  const il = computeInterlocking(l.objects());

  it('opposing directions on the shared section: S and D; the other track is independent', () => {
    expect(il.routes.map((r) => r.directions)).toEqual([{ T1: 'nominal' }, { T1: 'reverse' }, { T2: 'reverse' }]);
    expect(conflictCodes(il, 'R1', 'R2')).toEqual(['S', 'D']);
    expect(conflictCodes(il, 'R1', 'R3')).toEqual([]);
    expect(conflictCodes(il, 'R2', 'R3')).toEqual([]);
    expect(il.conflicts[0].opposing).toEqual(['T1']);
  });

  it('pairs table keeps the reasons in words', () => {
    expect(buildConflictPairsTable(il).rows).toEqual([['R1', 'R2', 'T1', '', 'shared section + opposing directions']]);
    expect(buildConflictPairsTable(il, 'pl').rows[0][4]).toBe('wspólny odcinek + przeciwne kierunki jazdy');
  });
});

describe('interlocking: overlap conflicts and routes without path', () => {
  it('an overlap into another route is O', () => {
    const l = opposingLayout();
    // R9 on T2 names T1 (used by R1) as its overlap
    l.route('R1', 'S1', 'S3');
    const objects = l.objects();
    const extra = new Layout();
    extra.obj('route', { id: 'R9', entrySignal: 'S5', exitSignal: 'S6', sections: 'T2', overlap: 'T1' });
    const il = computeInterlocking([...objects, ...extra.objects()]);
    expect(conflictCodes(il, 'R1', 'R9')).toEqual(['O']);
  });

  it('a route whose signals are missing keeps its stored data', () => {
    const l = new Layout();
    l.obj('route', { id: 'R1', entrySignal: 'S1', exitSignal: 'S2', points: 'W1:reverse', sections: 'T1' });
    const il = computeInterlocking(l.objects());
    expect(il.routes[0]).toMatchObject({ pathFound: false, problem: 'signal S1 not found', points: [{ id: 'W1', position: 'reverse', role: null }], sections: ['T1'] });
  });
});
