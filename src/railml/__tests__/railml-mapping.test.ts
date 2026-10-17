/**
 * railML mapping table: every catalogue kind is mapped (or listed as unmapped), the table in
 * docs/RAILML.md and the CLAUDE.md section list every kind, enumerations convert both ways.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KINDS } from '../../railway/catalogue';
import { KIND_MAPPINGS, UNMAPPED_KINDS, protectionFromRailml, protectionToRailml, technologyFromRailml, technologyToRailml } from '../mapping';
import { IdAllocator, isNcName, ncName } from '../xml';

const doc = (name: string): string => readFileSync(resolve(__dirname, '../../..', name), 'utf8');

describe('railML mapping', () => {
  it('covers every catalogue kind; LEU and train are the unmapped ones', () => {
    expect(KIND_MAPPINGS.map((m) => m.kind).sort()).toEqual(KINDS.map((k) => k.id).sort());
    expect([...UNMAPPED_KINDS].sort()).toEqual(['leu', 'train']);
    for (const m of KIND_MAPPINGS) {
      const kind = KINDS.find((k) => k.id === m.kind)!;
      for (const key of m.mapped) expect(kind.fields.some((f) => f.key === key)).toBe(true);
    }
    expect(new Set(KIND_MAPPINGS.map((m) => m.prefix)).size).toBe(KIND_MAPPINGS.length);
  });

  it('documents every kind in docs/RAILML.md and CLAUDE.md', () => {
    const md = doc('docs/RAILML.md');
    const claude = doc('CLAUDE.md');
    for (const k of KINDS) {
      expect(md).toMatch(new RegExp(`^\\| ${k.id} \\|`, 'm'));
      expect(claude).toContain(k.id);
    }
    expect(claude).toContain('railml.spec.ts');
  });

  it('converts level crossing protection and section detection both ways', () => {
    for (const p of ['fullBarriers', 'halfBarriers', 'lights', 'passive']) {
      const attrs = protectionToRailml(p)!;
      const el = document.createElementNS('https://www.railml.org/schemas/3.2', 'protection');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      expect(protectionFromRailml(el)).toBe(p);
    }
    expect(protectionToRailml('other')).toBeNull();
    for (const t of ['tc', 'axleCounter']) expect(technologyFromRailml(technologyToRailml(t))).toBe(t);
  });

  it('makes unique NCName ids', () => {
    expect(ncName('S 1/a')).toBe('S_1_a');
    expect(ncName('12')).toBe('_12');
    expect(ncName('Zażółć')).toBe('Zazo_c');
    expect(isNcName('sig_S1')).toBe(true);
    expect(isNcName('1a')).toBe(false);
    const ids = new IdAllocator();
    expect([ids.take('sig_S1'), ids.take('sig_S1'), ids.take('sig_S1')]).toEqual(['sig_S1', 'sig_S1_2', 'sig_S1_3']);
    expect(ids.claim('sig_S1')).toBe(false);
    expect(ids.claim('x y')).toBe(false);
  });
});
