/**
 * Selection colour (handle-colors.ts): draw.io blue instead of maxGraph's green, the same values as the chrome token
 * `--rd-selection`, readable (>= 3:1) on the light and the dark canvas; vertex / edge handlers use it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EdgeHandler, Rectangle, VertexHandler } from '@maxgraph/core';
import { SELECTION_COLOR, installDarkFeedbackColors, selectionColor } from '../handle-colors';
import { contrastRatio } from '../colors';

const css = readFileSync(resolve(__dirname, '../../../styles/variables.css'), 'utf8');

function tokenValues(name: string): string[] {
  return [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1].toLowerCase());
}

describe('selection colour', () => {
  it('mirrors --rd-selection (light, dark) and contrasts with both canvases', () => {
    expect(tokenValues('--rd-selection')).toEqual([SELECTION_COLOR.light, SELECTION_COLOR.dark]);
    expect(contrastRatio(SELECTION_COLOR.light, '#ffffff') ?? 0).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(SELECTION_COLOR.dark, '#121212') ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('replaces the green selection border and sizer fill', () => {
    installDarkFeedbackColors();
    const vp = VertexHandler.prototype as unknown as { graph: null; getSelectionColor(): string; createSizerShape(b: Rectangle, i: number, f?: string): { fill: string; stroke: string } };
    const ep = EdgeHandler.prototype as unknown as { graph: null; getSelectionColor(): string };
    expect(vp.getSelectionColor.call({ graph: null })).toBe(selectionColor(null));
    expect(ep.getSelectionColor.call({ graph: null })).toBe(SELECTION_COLOR.light);
    const sizer = vp.createSizerShape.call({ graph: null }, new Rectangle(0, 0, 7, 7), 0);
    expect(sizer.fill).toBe(SELECTION_COLOR.light);
    expect(sizer.stroke).toBe('#ffffff');
    // explicit non-green fills (label handle) stay
    expect(vp.createSizerShape.call({ graph: null }, new Rectangle(0, 0, 7, 7), -1, '#FFFF00').fill).toBe('#FFFF00');
  });
});
