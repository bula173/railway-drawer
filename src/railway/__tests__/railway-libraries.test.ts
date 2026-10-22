/**
 * The railway draw.io libraries of the Shapes tab (public/libraries/ertms-extra.xml,
 * railway-pl.xml, track-layout.xml; src/ui/railway-libraries.ts): every entry parses as a draw.io
 * library entry with a size and search tags, titles are unique, typed entries carry the catalogue
 * attributes and get free IDs on insert (references follow), lit signals have identifiable lamps
 * that take the aspect colour, directions follow the titles (Right/prawy = nominal), and a library
 * inserted as a whole has no check errors.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Cell, Graph } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { registerDrawioCodecs, styleToString } from '../../services/drawio-xml';
import { insertEntry, libraryToPaletteDef } from '../../ui/drawio-palette';
import type { PaletteEntry } from '../../ui/drawio-palette';
import { RAILWAY_LIBRARIES } from '../../ui/railway-libraries';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { KIND_ATTR, getKind, kindForPaletteEntry } from '../catalogue';
import { allCells, getCellKind, readAttr } from '../object-data';
import { STATE_COLORS } from '../states';
import { cellSchemeId, setStateOnCells, signalLamps } from '../state-apply';
import { prepareRailwayInsert } from '../install-railway-data';
import { validateModel } from '../validation';

const ROOT = resolve(__dirname, '../../../public');

function libraryEntries(file: string): PaletteEntry[] {
  const lib = RAILWAY_LIBRARIES.find((l) => l.file === file)!;
  const parsed = parseMxLibrary(readFileSync(resolve(ROOT, file), 'utf8'));
  return libraryToPaletteDef(parsed, { id: lib.id, title: lib.title, tags: lib.tags, source: lib.file }).entries;
}

const LIBS = RAILWAY_LIBRARIES.map((lib) => ({ ...lib, entries: libraryEntries(lib.file) }));

/** Attributes each typed entry must carry (catalogue keys), by kind. */
const REQUIRED: Record<string, string[]> = {
  signal: ['rdSignalType', 'rdDirection'],
  balise: ['rdDirection'],
  baliseGroup: ['rdCount', 'rdFunction', 'rdDirection'],
  points: ['rdHand', 'rdPosition'],
  levelCrossing: ['rdProtection'],
  trackSection: ['rdSectionType'],
  train: ['rdEtcsLevel'],
};

beforeAll(() => {
  registerDrawioCodecs();
  const proto = (globalThis as unknown as { SVGElement: { prototype: { getBBox?: () => unknown } } }).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
});

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

function insert(g: Graph, entry: PaletteEntry, at = { x: 300, y: 300 }): Cell[] {
  return insertEntry(g, entry, at, (cells) => prepareRailwayInsert(g, cells, entry), false);
}

function subtree(cell: Cell): Cell[] {
  return [cell, ...(cell.children ?? []).flatMap(subtree)];
}

function typed(cells: Cell[]): Cell[] {
  return cells.flatMap(subtree).filter((c) => getCellKind(c) !== null);
}

describe('railway libraries', () => {
  it('has the three libraries with many entries', () => {
    expect(LIBS.map((l) => l.id)).toEqual(['etcs-extra', 'rail-pl', 'track-layout']);
    expect(LIBS[0].entries.length).toBeGreaterThanOrEqual(45);
    expect(LIBS[1].entries.length).toBeGreaterThanOrEqual(60);
    expect(LIBS[2].entries.length).toBeGreaterThanOrEqual(30);
  });

  it('titles are unique across the libraries and the ERTMS library', () => {
    const titles = LIBS.flatMap((l) => l.entries.map((e) => e.title));
    expect(new Set(titles).size).toBe(titles.length);
    const ertms = parseMxLibrary(readFileSync(resolve(ROOT, 'libraries/ertms.xml'), 'utf8')).map((e) => (e.title ?? '').trim());
    expect(titles.filter((t) => ertms.includes(t))).toEqual([]);
  });

  for (const lib of LIBS) {
    describe(lib.title, () => {
      it('every entry is a sized draw.io cells entry with search tags', () => {
        for (const e of lib.entries) {
          expect(e.kind, e.title).toBe('cells');
          expect(e.width, e.title).toBeGreaterThan(0);
          expect(e.height, e.title).toBeGreaterThan(0);
          expect(e.title.trim(), e.title).toBe(e.title);
          expect((e.tags ?? '').split(' ').length, e.title).toBeGreaterThan(4);
          expect(e.xml, e.title).toMatch(/^<mxGraphModel><root><mxCell id="0"\/><mxCell id="1" parent="0"\/>/);
        }
      });

      it('every entry inserts; typed objects carry the catalogue attributes and get free IDs', () => {
        graph = createTestGraph();
        for (const e of lib.entries) {
          const cells = insert(graph, e);
          expect(cells.length, e.title).toBeGreaterThan(0);
          for (const c of typed(cells)) {
            const kind = getCellKind(c)!;
            const value = c.getValue() as Element;
            expect(readAttr(c, 'rdId'), `${e.title} id`).toMatch(new RegExp(`^${getKind(kind)!.idPrefix}\\d+$`));
            for (const attr of REQUIRED[kind] ?? []) expect(readAttr(c, attr), `${e.title} ${attr}`).toBeTruthy();
            // only attributes the catalogue knows for the kind
            const known = new Set([KIND_ATTR, 'rdId', ...getKind(kind)!.fields.map((f) => f.attr)]);
            for (const a of Array.from(value.attributes)) if (a.name.startsWith('rd')) expect(known.has(a.name), `${e.title} ${a.name}`).toBe(true);
          }
          const kindsInEntry = typed(cells).map((c) => getCellKind(c));
          if (kindsInEntry.length > 0) expect(kindForPaletteEntry(e)?.kind, e.title).toBe(kindsInEntry[0]);
          else expect(kindForPaletteEntry(e), e.title).toBeNull();
        }
        // IDs are unique per kind over the whole library inserted once
        const ids = allCells(graph.getDataModel()).filter((c) => getCellKind(c) !== null).map((c) => `${getCellKind(c)}:${readAttr(c, 'rdId')}`);
        expect(new Set(ids).size).toBe(ids.length);
        // no check errors (warnings such as "off track" / NID_BG are fine; a single balise, like the
        // ERTMS "Single Balise", gets its group from the user)
        const errors = validateModel(graph.getDataModel()).filter((i) => i.severity === 'error' && i.rule !== 'balise-without-group');
        expect(errors.map((i) => `${i.rule}: ${i.message}`)).toEqual([]);
      });

      it('directions follow the titles (Right/prawy/z prawej = nominal)', () => {
        graph = createTestGraph();
        for (const e of lib.entries) {
          const right = /\b(Right|prawy|prawa)\b/.test(e.title) && !/\btoe\b/.test(e.title);
          const left = /\b(Left|lewy|lewa)\b/.test(e.title) && !/\btoe\b/.test(e.title);
          for (const c of typed(insert(graph, e))) {
            const dir = readAttr(c, 'rdDirection');
            if (!dir) continue;
            if (right) expect(dir, e.title).toBe('nominal');
            if (left) expect(dir, e.title).toBe('reverse');
          }
        }
      });
    });
  }

  it('lit signals have one lamp per aspect and the lamps take the aspect colour', () => {
    let lit = 0;
    for (const lib of LIBS) {
      for (const e of lib.entries) {
        graph = createTestGraph();
        for (const signal of typed(insert(graph, e)).filter((c) => getCellKind(c) === 'signal')) {
          if (cellSchemeId(signal) !== 'signal') {
            expect(['markerBoard', 'etcsStopMarker'], e.title).toContain(readAttr(signal, 'rdSignalType'));
            continue;
          }
          lit++;
          const lamps = signalLamps(graph, signal);
          // light signals: one lamp per aspect; semaphores / discs (kształtowe): the night lamp or the disc
          if (/kształtow/.test(e.title)) expect(lamps.length, e.title).toBeGreaterThanOrEqual(1);
          else expect(lamps.length, e.title).toBe(Number(readAttr(signal, 'rdAspects')));
          const others = subtree(signal).filter((c) => c !== signal && !lamps.includes(c));
          const before = others.map((c) => styleToString(c.getStyle()));
          setStateOnCells(graph, [signal], 'aspect', 'proceed');
          for (const lamp of lamps) expect(styleToString(lamp.getStyle()), e.title).toContain(`fillColor=${STATE_COLORS.lampProceed}`);
          expect(others.map((c) => styleToString(c.getStyle())), e.title).toEqual(before);
        }
        cleanupTestGraph(graph);
        graph = null;
      }
    }
    expect(lit).toBeGreaterThanOrEqual(30);
  });

  it('balise groups: the balises reference their group and follow its new ID', () => {
    graph = createTestGraph();
    const entry = LIBS[0].entries.find((e) => e.title === 'Balise Group 2 Right')!;
    insert(graph, entry);
    const second = typed(insert(graph, entry, { x: 500, y: 300 }));
    const group = second.find((c) => getCellKind(c) === 'baliseGroup')!;
    expect(readAttr(group, 'rdId')).toBe('BG2');
    const balises = second.filter((c) => getCellKind(c) === 'balise');
    expect(balises.map((b) => readAttr(b, 'rdGroupId'))).toEqual(['BG2', 'BG2']);
    expect(balises.map((b) => readAttr(b, 'rdId'))).toEqual(['B3', 'B4']);
    expect(balises.map((b) => readAttr(b, 'rdPosition'))).toEqual(['1', '2']);
  });

  it('points hand is physical: toe left + leg up = left', () => {
    graph = createTestGraph();
    const pl = LIBS[1].entries;
    const hand = (title: string): string | null =>
      typed(insert(graph!, pl.find((e) => e.title === title)!)).filter((c) => getCellKind(c) === 'points').map((c) => readAttr(c, 'rdHand'))[0];
    expect(hand('Rozjazd zwyczajny lewy')).toBe('left');
    expect(hand('Rozjazd zwyczajny prawy')).toBe('right');
  });
});
