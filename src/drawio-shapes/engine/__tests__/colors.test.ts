import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_DEFAULT_KEYS,
  FOREGROUND_DEFAULT_KEYS,
  parseLightDark,
  resolveColorValue,
  resolveLightDark,
  resolveLightDarkInCss,
  splitTopLevel,
} from '../colors';

describe('parseLightDark', () => {
  it('parses hex, names and nested rgb()', () => {
    expect(parseLightDark('light-dark(#ffffff, #323200)')).toEqual({ light: '#ffffff', dark: '#323200' });
    expect(parseLightDark('light-dark(#DEDEDE,#EDEDED)')).toEqual({ light: '#DEDEDE', dark: '#EDEDED' });
    expect(parseLightDark('light-dark(white, black)')).toEqual({ light: 'white', dark: 'black' });
    expect(parseLightDark('light-dark(rgb(224, 0, 0), rgb(237, 237, 237))')).toEqual({
      light: 'rgb(224, 0, 0)',
      dark: 'rgb(237, 237, 237)',
    });
    expect(parseLightDark(' LIGHT-DARK( rgba(1, 2, 3, 0.5) , #000 ) ')).toEqual({
      light: 'rgba(1, 2, 3, 0.5)',
      dark: '#000',
    });
  });

  it('parses var() with fallbacks and nested light-dark()', () => {
    expect(parseLightDark('light-dark(#ffffff, var(--ge-dark-color, #121212))')).toEqual({
      light: '#ffffff',
      dark: 'var(--ge-dark-color, #121212)',
    });
    expect(parseLightDark('light-dark(light-dark(red, blue), green)')).toEqual({
      light: 'light-dark(red, blue)',
      dark: 'green',
    });
  });

  it('rejects anything that is not exactly one light-dark()', () => {
    expect(parseLightDark('#ffffff')).toBeNull();
    expect(parseLightDark('light-dark(#fff)')).toBeNull();
    expect(parseLightDark('light-dark(#fff, #000) extra')).toBeNull();
    expect(parseLightDark('light-dark(rgb(1,2,3), #000')).toBeNull();
  });

  it('splitTopLevel ignores commas inside parentheses', () => {
    expect(splitTopLevel('rgb(1, 2, 3), var(--x, #fff)')).toEqual(['rgb(1, 2, 3)', 'var(--x, #fff)']);
  });
});

describe('resolveLightDark / resolveColorValue', () => {
  it('picks the light value, recursively', () => {
    expect(resolveLightDark('light-dark(light-dark(red, blue), green)')).toBe('red');
    expect(resolveLightDark('light-dark(light-dark(red, blue), green)', true)).toBe('green');
  });

  it('resolves var() to its fallback', () => {
    expect(resolveLightDark('light-dark(var(--a, #111111), #222222)')).toBe('#111111');
    expect(resolveLightDark('light-dark(#ffffff, var(--ge-dark-color, #121212))', true)).toBe('#121212');
    expect(resolveLightDark('var(--no-fallback)')).toBe('var(--no-fallback)');
  });

  it('leaves plain colors alone', () => {
    expect(resolveColorValue('#404040', 'strokeColor')).toBe('#404040');
    expect(resolveColorValue('none', 'fillColor')).toBe('none');
    expect(resolveColorValue(undefined, 'fillColor')).toBeUndefined();
    expect(resolveColorValue('rgb(1, 2, 3)', 'fillColor')).toBe('rgb(1, 2, 3)');
  });

  it("maps 'default' per key (Graph.js replaceDefaultColors)", () => {
    for (const key of ['fontColor', 'gradientColor', 'strokeColor', 'imageBorder', 'labelBorderColor']) {
      expect(FOREGROUND_DEFAULT_KEYS.has(key)).toBe(true);
      expect(resolveColorValue('default', key)).toBe('#000000');
      expect(resolveColorValue('default', key, 'invert')).toBe('#ffffff');
    }
    for (const key of ['fillColor', 'imageBackground', 'swimlaneFillColor', 'labelBackgroundColor']) {
      expect(BACKGROUND_DEFAULT_KEYS.has(key)).toBe(true);
      expect(resolveColorValue('default', key)).toBe('#ffffff');
      expect(resolveColorValue('default', key, 'page')).toBe('#ffffff');
    }
    expect(resolveColorValue('default', 'shadowColor')).toBe('default');
  });
});

describe('resolveLightDarkInCss', () => {
  it('rewrites light-dark() inside inline CSS', () => {
    expect(resolveLightDarkInCss('color: light-dark(rgb(224, 0, 0), rgb(237, 237, 237));')).toBe(
      'color: rgb(224, 0, 0);'
    );
    const html =
      '<font style="color: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); background: LIGHT-DARK(#fff, #000)">A</font>';
    expect(resolveLightDarkInCss(html)).toBe('<font style="color: rgb(0, 0, 0); background: #fff">A</font>');
  });

  it('leaves text without (balanced) light-dark() alone', () => {
    expect(resolveLightDarkInCss('plain label')).toBe('plain label');
    expect(resolveLightDarkInCss('broken light-dark(#fff, #000')).toBe('broken light-dark(#fff, #000');
  });
});
