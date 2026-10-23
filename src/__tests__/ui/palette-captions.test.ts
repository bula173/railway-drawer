/**
 * Palette tile captions (palette-captions.ts) keep the distinguishing part of long titles, the generated railway
 * libraries use "Points" and feminine "tarcza … prawa/lewa", the ERTMS display has no duplicate "Line" title.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAPTION_MAX, shortPaletteCaption } from '../../ui/palette-captions';
import { ertmsDisplayEntry } from '../../ui/ertms-display';
import { kindForLibraryTitle } from '../../railway/catalogue';
import type { PaletteEntry } from '../../ui/drawio-palette';

const ROOT = resolve(__dirname, '../../..');

function titles(file: string): string[] {
  const text = readFileSync(resolve(ROOT, 'public/libraries', file), 'utf8');
  const json = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as Array<{ title: string; tags: string }>;
  return json.map((e) => e.title);
}

describe('palette captions', () => {
  it('keeps the distinguishing part', () => {
    expect(shortPaletteCaption('Points 1:9 Right (toe left)')).toBe('1:9 R toe L');
    expect(shortPaletteCaption('Points 1:12 Left (toe right)')).toBe('1:12 L toe R');
    expect(shortPaletteCaption('Tarcza manewrowa Tm prawa')).toBe('Tarcza Tm prawa');
    expect(shortPaletteCaption('Tarcza ostrzegawcza przejazdowa Osp lewa')).toBe('Tarcza Osp lewa');
    expect(shortPaletteCaption('Tarcza ostrzegawcza kształtowa prawa')).toBe('To kształtowa prawa');
    expect(shortPaletteCaption('Semafor 3-komorowy prawy')).toBe('3-komorowy prawy');
    expect(shortPaletteCaption('Semafor kształtowy 2-ramienny lewy')).toBe('Kształtowy 2-ram. lewy');
    expect(shortPaletteCaption('Switchable Balise Group 2 Right')).toBe('Switchable BG 2 Right');
    expect(shortPaletteCaption('Signal Right 4')).toBe('Signal Right 4');
  });

  it('every caption of the railway libraries is unique per library and fits two lines', () => {
    for (const file of ['ertms-extra.xml', 'railway-pl.xml', 'track-layout.xml']) {
      const captions = titles(file).map(shortPaletteCaption);
      expect(new Set(captions).size, file).toBe(captions.length);
      expect(captions.filter((c) => c.length > CAPTION_MAX + 4), file).toEqual([]);
    }
  });

  it('generated libraries: EN "Points", feminine tarcze', () => {
    const layout = titles('track-layout.xml');
    expect(layout.filter((t) => t.startsWith('Turnout'))).toEqual([]);
    expect(layout).toContain('Points 1:9 Left (toe left)');
    const pl = titles('railway-pl.xml');
    expect(pl.filter((t) => /^Tarcza .* (prawy|lewy)$/.test(t))).toEqual([]);
    expect(pl).toContain('Tarcza zaporowa Tz prawa');
    expect(pl).toContain('Semafor 3-komorowy prawy');
  });

  it('ERTMS display: "Points Left", one "Dashed Line", kinds still found', () => {
    const entry = (title: string, style = ''): PaletteEntry => ({ id: 'x', title, kind: 'edge', width: 1, height: 1, style });
    expect(ertmsDisplayEntry(entry('Point Left')).title).toBe('Points Left');
    expect(kindForLibraryTitle('Points Left')?.kind).toBe('points');
    expect(ertmsDisplayEntry(entry('Line ', 'endArrow=none;dashed=1;')).title).toBe('Dashed Line');
    expect(ertmsDisplayEntry(entry('Line', 'endArrow=none;strokeWidth=3;')).title).toBe('Line');
  });
});
