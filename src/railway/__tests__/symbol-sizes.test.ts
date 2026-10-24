/**
 * The symbol size standard (symbol-sizes.json; docs/architecture/symbol-sizes.md) holds for every
 * palette entry of the four railway libraries and for the symbols inside the built-in ERTMS
 * templates: each entry of a class has the class box (a new entry that deviates fails here), lamps
 * one diameter at one height beside a mast at one place, balise groups scale by count, trains one
 * height, tracks and points legs one stroke width.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import type { LibraryEntry } from '../../drawio-shapes/engine';
import { LINE_STROKE_WIDTH, SYMBOL_SIZES, normalisedSize, standardSize, symbolClassOf } from '../symbol-sizes';
import type { KindId } from '../catalogue';

const ROOT = resolve(__dirname, '../../../public/libraries');
const FILES = ['ertms.xml', 'ertms-extra.xml', 'railway-pl.xml', 'track-layout.xml'];
const LIBRARIES = FILES.map((file) => ({ file, entries: parseMxLibrary(readFileSync(resolve(ROOT, file), 'utf8')) }));
const S = SYMBOL_SIZES;

interface Node {
  el: Element;
  cell: Element;
  id: string;
  parent: string;
  geo: Element | null;
}

function nodesOf(xml: string): Node[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.getElementsByTagName('root')[0];
  return Array.from(root.children).map((el) => {
    const cell = el.nodeName === 'mxCell' ? el : el.getElementsByTagName('mxCell')[0];
    return { el, cell, id: el.getAttribute('id') ?? '', parent: cell?.getAttribute('parent') ?? '', geo: cell?.getElementsByTagName('mxGeometry')[0] ?? null };
  }).filter((n) => n.cell);
}

const num = (e: Element | null, k: string): number => Number(e?.getAttribute(k) ?? 0) || 0;
const box = (n: Node): { x: number; y: number; w: number; h: number } => ({ x: num(n.geo, 'x'), y: num(n.geo, 'y'), w: num(n.geo, 'width'), h: num(n.geo, 'height') });
const isEdge = (n: Node): boolean => n.cell.getAttribute('edge') === '1';
const style = (n: Node): string => n.cell.getAttribute('style') ?? '';
const children = (nodes: Node[], n: Node): Node[] => nodes.filter((k) => k.parent === n.id);
const descendants = (nodes: Node[], n: Node): Node[] => children(nodes, n).flatMap((k) => [k, ...descendants(nodes, k)]);

function points(n: Node): Array<{ x: number; y: number }> {
  return Array.from(n.geo?.getElementsByTagName('mxPoint') ?? [])
    .filter((p) => p.getAttribute('as') === 'sourcePoint' || p.getAttribute('as') === 'targetPoint')
    .map((p) => ({ x: num(p, 'x'), y: num(p, 'y') }));
}

/** Lamps of a signal group: round leaf vertices (ellipses, the ERTMS lamp stencils). */
function lamps(nodes: Node[], top: Node): Node[] {
  return descendants(nodes, top).filter((k) => !isEdge(k) && children(nodes, k).length === 0
    && (/^ellipse/.test(style(k)) || /vsdxID=(229|231)\b/.test(style(k))));
}

/** Absolute box of `k` inside the group `top`. */
function absBox(nodes: Node[], top: Node, k: Node): { x: number; y: number; w: number; h: number } {
  const b = box(k);
  let p = nodes.find((n) => n.id === k.parent);
  while (p && p !== top) {
    b.x += box(p).x;
    b.y += box(p).y;
    const pid = p.parent;
    p = nodes.find((n) => n.id === pid);
  }
  return b;
}

type Cls = ReturnType<typeof symbolClassOf> | 'baliseGroup' | 'kmPost' | 'hectometrePost' | 'line' | null;

function classOf(entry: LibraryEntry, top: Node): Cls {
  const kind = top.el.getAttribute('rdKind') as KindId | null;
  if (kind === 'track' || kind === 'points' || kind === 'trackSection') return 'line';
  if (kind === 'baliseGroup') return 'baliseGroup';
  const cls = symbolClassOf(kind, top.el.getAttribute('rdSignalType') ?? '');
  if (cls) return cls;
  if ((entry.tags ?? '').startsWith('board tablica')) return 'board';
  if (entry.title === 'km Post') return 'kmPost';
  if (entry.title === 'Hectometre Mark' || entry.title === 'Słupek hektometrowy') return 'hectometrePost';
  return null;
}

/** Palette entries (the ERTMS library's titled elements; its templates are checked below). */
const ENTRIES = LIBRARIES.flatMap(({ file, entries }) => entries.filter((e) => e.xml && e.title).map((e) => ({ file, e, nodes: nodesOf(e.xml!) })));

describe('symbol size standard: palette entries', () => {
  it('classifies the railway symbols of every library', () => {
    const count: Record<string, number> = {};
    for (const { e, nodes } of ENTRIES) {
      const tops = nodes.filter((n) => n.parent === '1');
      const cls = classOf(e, tops[0]);
      if (cls) count[cls] = (count[cls] ?? 0) + 1;
    }
    expect(count.signal).toBeGreaterThanOrEqual(35);
    expect(count.board).toBeGreaterThanOrEqual(25);
    for (const k of ['balise', 'baliseGroup', 'axleCounter', 'insulatedJoint', 'leu', 'rbc', 'bufferStop', 'levelCrossing', 'train', 'line', 'kmPost', 'hectometrePost']) {
      expect(count[k], k).toBeGreaterThan(0);
    }
  });

  for (const { file, e, nodes } of ENTRIES) {
    const tops = nodes.filter((n) => n.parent === '1');
    const cls = classOf(e, tops[0]);
    if (!cls) continue;
    it(`${file} "${e.title}" (${cls}) has the standard size`, () => {
      const top = tops[0];
      if (cls === 'line') {
        for (const n of nodes.filter(isEdge)) {
          const k = n.el.getAttribute('rdKind');
          if (k === 'track' || k === 'points' || k === 'trackSection') expect(style(n), e.title).toMatch(new RegExp(`strokeWidth=${LINE_STROKE_WIDTH};`));
        }
        return;
      }
      if (cls === 'baliseGroup') {
        const balises = tops.filter((n) => n.el.getAttribute('rdKind') === 'balise');
        const linked = tops.some(isEdge);
        expect(e.w).toBe(S.baliseGroup.pitch * balises.length - (S.baliseGroup.pitch - S.balise.w));
        expect(e.h).toBe(linked ? S.baliseGroup.linkedH : S.baliseGroup.h);
        const xs = balises.map((b) => box(b).x).sort((a, b) => a - b);
        xs.forEach((x, i) => expect(x).toBe(i * S.baliseGroup.pitch));
        for (const b of balises) expect([box(b).w, box(b).h]).toEqual([S.balise.w, S.balise.h]);
        expect(style(top)).toContain(`fontSize=${S.baliseGroup.fontSize};`);
        return;
      }
      const want = cls === 'kmPost' || cls === 'hectometrePost' ? { w: S[cls].w, h: S[cls].h } : normalisedSize(cls, { w: e.w, h: e.h });
      expect({ w: e.w, h: e.h }, 'entry size').toEqual(want);
      expect({ w: box(top).w, h: box(top).h }, 'cell size').toEqual(want);
      if (cls === 'train') expect(e.h).toBe(S.train.h);
      if (cls === 'signal') {
        const ls = lamps(nodes, top);
        expect(ls.length, 'lamps').toBeGreaterThan(0);
        const disc = /kształtowa/.test(e.title);
        const nominal = top.el.getAttribute('rdDirection') === 'nominal';
        const headY = nominal ? 0 : S.signal.h - S.signal.head;
        for (const l of ls) {
          const b = absBox(nodes, top, l);
          if (!disc) expect([b.w, b.h], 'lamp diameter').toEqual([S.signal.lamp, S.signal.lamp]);
          expect(b.y + b.h / 2, 'lamp centre in the head band').toBeCloseTo(headY + S.signal.head / 2, 5);
        }
        // the mast: a vertical edge spanning the head band at the mast inset
        const masts = descendants(nodes, top).filter((k) => isEdge(k)).map(points).filter((p) => p.length === 2 && p[0].x === p[1].x);
        const mastX = nominal ? S.signal.mastInset : S.signal.w - S.signal.mastInset;
        expect(masts.some((p) => p[0].x === mastX && Math.min(p[0].y, p[1].y) === headY && Math.abs(p[0].y - p[1].y) === S.signal.head), 'mast').toBe(true);
      }
      if (cls === 'board') {
        const face = descendants(nodes, top).find((k) => !isEdge(k));
        const fb = face ? absBox(nodes, top, face) : null;
        expect([[S.board.face[0], S.board.face[1]], [S.board.symbolFace[0], S.board.symbolFace[1]]], 'face').toContainEqual([fb?.w, fb?.h]);
        if (face && face.el.getAttribute('value') && /fontSize=/.test(style(face))) expect(style(face)).toContain(`fontSize=${S.board.fontSize};`);
      }
    });
  }
});

describe('symbol size standard: symbols inside the built-in ERTMS templates', () => {
  const ertms = LIBRARIES[0].entries.filter((e) => e.xml && !e.title);
  it('every signal, TC joint marker and train of every template has the standard size', () => {
    expect(ertms.length).toBe(19);
    let signals = 0;
    for (const e of ertms) {
      const nodes = nodesOf(e.xml!);
      for (const n of nodes.filter((k) => k.parent === '1')) {
        const kind = n.el.getAttribute('rdKind') as KindId | null;
        const b = box(n);
        if (kind === 'signal') {
          signals++;
          expect({ w: b.w, h: b.h }).toEqual(standardSize('signal'));
          for (const l of lamps(nodes, n)) expect([box(l).w, box(l).h]).toEqual([S.signal.lamp, S.signal.lamp]);
        } else if (kind === 'insulatedJoint' && style(n).startsWith('group')) {
          expect({ w: b.w, h: b.h }).toEqual(standardSize('insulatedJoint'));
        } else if (kind === 'train') {
          expect(b.h).toBe(S.train.h);
        } else if (kind === 'balise') {
          expect({ w: b.w, h: b.h }).toEqual(standardSize('balise'));
        } else if (kind === 'track' || kind === 'points') {
          expect(style(n)).toMatch(new RegExp(`strokeWidth=${LINE_STROKE_WIDTH};`));
        }
      }
    }
    expect(signals).toBeGreaterThan(80);
  });
});
