/**
 * @file colors.ts
 * @brief draw.io color compatibility: `light-dark(a, b)` and the `default` color keyword.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Graph.js:8005-8016 (shapeForegroundColor /
 * shapeBackgroundColor), :15367-15450 (replaceDefaultColors / getDefaultColor) and
 * mxUtils.parseLightDarkColor.
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Graph.js
 *
 * maxGraph writes style colors straight into SVG presentation attributes, where neither
 * `light-dark()` nor `default` is valid, so both resolve to the light-theme value. draw.io's
 * own regex accepts only one level of parentheses per argument; this parser balances
 * parentheses, so `light-dark(rgb(1, 2, 3), light-dark(...))` works too.
 */

export interface LightDark {
  light: string;
  dark: string;
}

/** Light-theme foreground: Graph.prototype.shapeForegroundColor = light-dark(#000000, #ffffff). */
export const DEFAULT_FOREGROUND = '#000000';
/** Light-theme background: Graph.prototype.shapeBackgroundColor = light-dark(#ffffff, var(--ge-dark-color, #121212)). */
export const DEFAULT_BACKGROUND = '#ffffff';
/** Dark values, used for `default<Key>=invert`. */
const DARK_FOREGROUND = '#ffffff';
const DARK_BACKGROUND = '#121212';

/** Keys whose `default` value is the shape foreground color (Graph.js:15382-15392). */
export const FOREGROUND_DEFAULT_KEYS: ReadonlySet<string> = new Set([
  'fontColor',
  'gradientColor',
  'strokeColor',
  'imageBorder',
  'labelBorderColor',
]);

/** Keys whose `default` value is the shape background color. */
export const BACKGROUND_DEFAULT_KEYS: ReadonlySet<string> = new Set([
  'fillColor',
  'imageBackground',
  'swimlaneFillColor',
  'labelBackgroundColor',
]);

/** Splits on `sep` at parenthesis depth 0. */
export function splitTopLevel(text: string, sep = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === sep && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

/** Index of the `)` closing the `(` at `open`, or -1. */
function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}

const LIGHT_DARK = 'light-dark(';

/**
 * Parses a value that is exactly `light-dark(<light>, <dark>)` (case-insensitive, any
 * whitespace). Returns null for anything else. The arguments are returned unresolved.
 */
export function parseLightDark(value: string): LightDark | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.slice(0, LIGHT_DARK.length).toLowerCase() !== LIGHT_DARK) return null;
  const close = matchParen(text, LIGHT_DARK.length - 1);
  if (close !== text.length - 1) return null;
  const parts = splitTopLevel(text.slice(LIGHT_DARK.length, close));
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { light: parts[0], dark: parts[1] };
}

/**
 * Resolves `light-dark()` (recursively) to one side and `var(--x, fallback)` to its fallback.
 * Other values are returned unchanged.
 */
export function resolveLightDark(value: string, dark = false, depth = 0): string {
  if (depth > 8) return value;
  const ld = parseLightDark(value);
  if (ld) return resolveLightDark(dark ? ld.dark : ld.light, dark, depth + 1);
  const text = value.trim();
  if (/^var\(/i.test(text) && matchParen(text, 3) === text.length - 1) {
    const parts = splitTopLevel(text.slice(4, -1));
    if (parts.length >= 2) return resolveLightDark(parts.slice(1).join(', '), dark, depth + 1);
  }
  return value;
}

export type DefaultColorMode = 'invert' | 'page' | undefined;

/**
 * Resolves one style color value for SVG output (light theme):
 * `light-dark(a, b)` -> a; `default` -> the foreground/background color for `key`
 * (`invert` swaps to the dark value, `page` uses the page background, white).
 */
export function resolveColorValue(value: unknown, key: string, mode?: DefaultColorMode): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'default') {
    const fg = FOREGROUND_DEFAULT_KEYS.has(key);
    const bg = BACKGROUND_DEFAULT_KEYS.has(key);
    if (!fg && !bg) return value;
    if (mode === 'page') return DEFAULT_BACKGROUND;
    if (mode === 'invert') return fg ? DARK_FOREGROUND : DARK_BACKGROUND;
    return fg ? DEFAULT_FOREGROUND : DEFAULT_BACKGROUND;
  }
  if (value.indexOf('(') < 0) return value;
  return resolveLightDark(value);
}

/**
 * Rewrites every `light-dark(...)` inside CSS text (an HTML label's inline styles) to its
 * light value, e.g. `color: light-dark(rgb(224, 0, 0), rgb(237, 237, 237))` ->
 * `color: rgb(224, 0, 0)`. Unbalanced occurrences are left alone.
 */
export function resolveLightDarkInCss(text: string): string {
  if (typeof text !== 'string') return text;
  const lower = text.toLowerCase();
  let pos = lower.indexOf(LIGHT_DARK);
  if (pos < 0) return text;
  let out = '';
  let last = 0;
  while (pos >= 0) {
    const close = matchParen(text, pos + LIGHT_DARK.length - 1);
    if (close < 0) break;
    const ld = parseLightDark(text.slice(pos, close + 1));
    out += text.slice(last, pos) + (ld ? resolveLightDarkInCss(resolveLightDark(ld.light)) : text.slice(pos, close + 1));
    last = close + 1;
    pos = lower.indexOf(LIGHT_DARK, last);
  }
  return out + text.slice(last);
}
