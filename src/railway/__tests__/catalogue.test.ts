/**
 * Catalogue: kinds/fields, number parsing, field problems, and the kinds pre-assigned to the
 * real ERTMS library entries (public/libraries/ertms.xml) and the app's railway shapes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { ertmsElementsPaletteDef } from '../../ui/drawio-palette/ertms-source';
import { createCellsForEntry } from '../../ui/drawio-palette/entry-cells';
import {
  ALL_DATA_ATTRS,
  KINDS,
  attrForKey,
  fieldValueProblem,
  formatStoredNumber,
  getKind,
  kindForLibraryTitle,
  kindForPaletteEntry,
  kindForStyle,
  normalizeFieldInput,
  parseNumber,
  splitRefList,
} from '../catalogue';

const ROOT = resolve(__dirname, '../../..');

describe('catalogue', () => {
  it('every kind has a required ID field and rd-prefixed attributes', () => {
    expect(KINDS.map((k) => k.id)).toEqual([
      'signal', 'balise', 'baliseGroup', 'track', 'trackSection', 'points', 'levelCrossing',
      'bufferStop', 'rbc', 'leu', 'axleCounter', 'insulatedJoint', 'train', 'route',
    ]);
    for (const kind of KINDS) {
      expect(kind.fields[0]).toMatchObject({ key: 'id', attr: 'rdId', required: 'error' });
      const keys = kind.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of kind.fields) {
        expect(f.attr).toBe(attrForKey(f.key));
        expect(f.attr).toMatch(/^rd[A-Z]/);
        if (f.type === 'enum') expect(f.options?.length).toBeGreaterThan(1);
        if (f.type === 'ref' || f.type === 'refList') for (const k of f.refKinds ?? []) expect(getKind(k)).not.toBeNull();
      }
    }
    expect(ALL_DATA_ATTRS.has('rdKind')).toBe(true);
    expect(ALL_DATA_ATTRS.has('rdNidBg')).toBe(true);
    expect(ALL_DATA_ATTRS.has('label')).toBe(false);
  });

  it('ERTMS ranges: NID_C 0–1023, NID_BG 0–16383, balises in group 1–8', () => {
    const bg = getKind('baliseGroup')!;
    const f = (key: string) => bg.fields.find((x) => x.key === key)!;
    expect([f('nidC').min, f('nidC').max]).toEqual([0, 1023]);
    expect([f('nidBg').min, f('nidBg').max]).toEqual([0, 16383]);
    expect([f('count').min, f('count').max]).toEqual([1, 8]);
    expect(fieldValueProblem(f('nidBg'), '16383')).toBeNull();
    expect(fieldValueProblem(f('nidBg'), '16384')).toMatch(/out of range 0–16383/);
    expect(fieldValueProblem(f('nidC'), '-1')).toMatch(/out of range/);
    expect(fieldValueProblem(f('count'), '2.5')).toMatch(/whole number/);
    expect(fieldValueProblem(f('count'), 'abc')).toMatch(/not a number/);
    expect(fieldValueProblem(f('function'), 'fixed')).toBeNull();
    expect(fieldValueProblem(f('function'), 'magic')).toMatch(/not a known value/);
    expect(fieldValueProblem(f('nidBg'), '')).toBeNull();
  });

  it('parses numbers with decimal comma and km chainage', () => {
    expect(parseNumber('12.345')).toBe(12.345);
    expect(parseNumber(' 12,5 ')).toBe(12.5);
    expect(parseNumber('12+345', 'km')).toBeCloseTo(12.345, 9);
    expect(parseNumber('0+050', 'km')).toBeCloseTo(0.05, 9);
    expect(parseNumber('12+5', 'km')).toBeCloseTo(12.005, 9);
    expect(parseNumber('12+345', 'number')).toBeNull();
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('12a')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
    expect(formatStoredNumber(0.1 + 0.2)).toBe('0.3');
    const km = getKind('signal')!.fields.find((f) => f.key === 'km')!;
    expect(normalizeFieldInput(km, ' 12+345 ')).toBe('12.345');
    expect(normalizeFieldInput(km, '12,3')).toBe('12.3');
    expect(normalizeFieldInput(km, 'x')).toBe('x');
    const routes = getKind('signal')!.fields.find((f) => f.key === 'routes')!;
    expect(normalizeFieldInput(routes, 'R1;R2 ,  R3,')).toBe('R1, R2, R3');
    expect(splitRefList('A, B;C\nD')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('pre-assigns kinds to the 18 real ERTMS library elements by title', () => {
    const entries = parseMxLibrary(readFileSync(resolve(ROOT, 'public/libraries/ertms.xml'), 'utf8'));
    const def = ertmsElementsPaletteDef(entries);
    expect(def.entries).toHaveLength(18);
    // titles as in the library ("Line " ends with a non-breaking space there)
    const kinds = def.entries.map((e) => [e.title.replace(/\s+$/u, ''), kindForPaletteEntry(e)?.kind ?? null]);
    expect(kinds).toEqual([
      ['Signal Left 3', 'signal'],
      ['Train', 'train'],
      ['Signal Right 3', 'signal'],
      ['Single Balise Right', 'balise'],
      ['TC', 'insulatedJoint'],
      ['SIgnal Right 4', 'signal'],
      ['Track', 'track'],
      ['Point Left', 'points'],
      ['Point Right', 'points'],
      ['MA', null],
      ['Distance', null],
      ['Line', null],
      ['Train Connected', 'train'],
      ['Gradient', null],
      ['SSP', null],
      ['SSP Curve', null],
      ['Line', null],
      ['Balise Left', 'balise'],
    ]);
    // entries that become objects insert exactly one top-level cell (the kind goes there)
    for (const e of def.entries.filter((x) => kindForPaletteEntry(x))) expect(createCellsForEntry(e)).toHaveLength(1);
  });

  it('presets: direction from Left/Right, aspect count from the title', () => {
    expect(kindForLibraryTitle('Signal Left 3')).toEqual({ kind: 'signal', values: { signalType: 'main', direction: 'reverse', aspects: '3' } });
    expect(kindForLibraryTitle('SIgnal Right 4')?.values).toMatchObject({ direction: 'nominal', aspects: '4' });
    expect(kindForLibraryTitle('Balise Left')?.values).toEqual({ direction: 'reverse' });
    // the hand comes from the entry's geometry (read from the toe), not from the title
    expect(kindForLibraryTitle('Point Right')?.values).toEqual({ position: 'normal' });
    // the TC tile is the joint marker of a track circuit, not a section line
    expect(kindForLibraryTitle('TC')).toEqual({ kind: 'insulatedJoint' });
    // draw.io palettes are not mapped even with the same title
    expect(kindForPaletteEntry({ id: 'general-3-track', title: 'Track', source: 'js/Sidebar.js:1' })).toBeNull();
  });

  it('maps app railway shapes by style', () => {
    expect(kindForStyle({ shape: 'customSignal' })?.kind).toBe('signal');
    expect(kindForStyle('shape=customRail;strokeWidth=2;')?.kind).toBe('track');
    expect(kindForStyle({ shape: 'customTrackCircuit' })).toEqual({ kind: 'trackSection', values: { sectionType: 'tc' } });
    expect(kindForStyle({ shape: 'ertms-balise' })?.kind).toBe('balise');
    expect(kindForStyle({ shape: 'rectangle' })).toBeNull();
    expect(kindForStyle(null)).toBeNull();
  });
});
