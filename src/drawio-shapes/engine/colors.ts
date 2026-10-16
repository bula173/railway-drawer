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
 * `light-dark()` nor `default` is valid, so both resolve to one side here: the light value by
 * default, the dark value when the caller passes `dark = true` (dark mode). draw.io's
 * own regex accepts only one level of parentheses per argument; this parser balances
 * parentheses, so `light-dark(rgb(1, 2, 3), light-dark(...))` works too.
 *
 * Adaptive colors (Graph.adaptiveColors, Graph.js:2247-2260/8161/15505-15535): in dark mode
 * draw.io renders every plain color with `light-dark(c, mxUtils.getInverseColor(c))` ('auto',
 * the default), keeps plain colors as they are ('simple') or ignores dark mode for the
 * diagram ('none', color-scheme: light). getInverseColor and parseColor are ported from
 * src/main/webapp/mxgraph/mxClient.js (mxUtils.getInverseColor / parseColor / getLightDarkColor).
 */

export interface LightDark {
  light: string;
  dark: string;
}

/** Light-theme foreground: Graph.prototype.shapeForegroundColor = light-dark(#000000, #ffffff). */
export const DEFAULT_FOREGROUND = '#000000';
/** Light-theme background: Graph.prototype.shapeBackgroundColor = light-dark(#ffffff, var(--ge-dark-color, #121212)). */
export const DEFAULT_BACKGROUND = '#ffffff';
/** Dark values, used for `default<Key>=invert` and dark mode. */
const DARK_FOREGROUND = '#ffffff';
const DARK_BACKGROUND = '#121212';

/** Editor.darkColor (Editor.js:350): dark page background and shapeBackgroundColor's dark side. */
export const DARK_PAGE_BACKGROUND = DARK_BACKGROUND;

/** Graph.adaptiveColors values ('auto' is draw.io's default, Graph.defaultAdaptiveColors). */
export type AdaptiveColors = 'auto' | 'simple' | 'none';

/** Options for dark-mode aware resolution. Omitted = light theme (the previous behaviour). */
export interface ColorResolveOptions {
  /** Resolve for dark mode. */
  dark?: boolean;
  /** Graph.adaptiveColors, default 'auto'. */
  adaptive?: AdaptiveColors;
  /** Page background for `default<Key>=page` (Graph.getPageBackgroundColor); null = default page. */
  pageBackground?: string | null;
}

/** True when dark values apply: dark mode and adaptiveColors != 'none'. */
export function isDarkResolve(options?: ColorResolveOptions): boolean {
  return !!options?.dark && options.adaptive !== 'none';
}

/** CSS named colors that can appear in draw.io styles (mxUtils.color2hex uses a canvas). */
const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', purple: '#800080', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', maroon: '#800000', olive: '#808000', lime: '#00ff00', aqua: '#00ffff',
  cyan: '#00ffff', teal: '#008080', navy: '#000080', fuchsia: '#ff00ff', magenta: '#ff00ff',
  pink: '#ffc0cb', brown: '#a52a2a', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3', whitesmoke: '#f5f5f5', gold: '#ffd700',
  darkred: '#8b0000', darkgreen: '#006400', darkblue: '#00008b', lightblue: '#add8e6',
  lightgreen: '#90ee90', lightyellow: '#ffffe0', indigo: '#4b0082', violet: '#ee82ee',
  beige: '#f5f5dc', ivory: '#fffff0', khaki: '#f0e68c', coral: '#ff7f50', salmon: '#fa8072',
  tomato: '#ff6347', crimson: '#dc143c', chocolate: '#d2691e', tan: '#d2b48c',
  skyblue: '#87ceeb', steelblue: '#4682b4', royalblue: '#4169e1', dimgray: '#696969',
  dimgrey: '#696969', slategray: '#708090', slategrey: '#708090',
};

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * mxUtils.parseColor: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` and CSS named colors.
 * Returns null for anything else (none, transparent, var(), light-dark(), ...).
 */
export function parseColor(value: unknown): RgbaColor | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  const rgb = /^rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
  if (rgb) {
    return {
      r: parseInt(rgb[1], 10),
      g: parseInt(rgb[2], 10),
      b: parseInt(rgb[3], 10),
      a: rgb[4] != null ? parseFloat(rgb[4]) : 1,
    };
  }
  let hex = NAMED_COLORS[text] ?? text;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) return null;
  hex = hex.substring(1);
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
    a: hex.length > 6 ? parseFloat((parseInt(hex.substring(6, 8), 16) / 255).toFixed(3)) : 1,
  };
}

/**
 * mxUtils.getInverseColor(color, lightness = 93, hue = 180): the dark-mode counterpart of a
 * plain color (white -> #121212, black -> #ededed, hue rotated by 180 degrees). Returns the
 * input for colors it cannot parse.
 */
export function getInverseColor(color: string, lightness = 93, hue = 180): string {
  const invert = (n: number) => Math.round((lightness / 100) * (255 - n) + n * (1 - lightness / 100));
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(255, n)));

  if (color.toLowerCase() === 'transparent') return color;
  const c = parseColor(color);
  if (c == null) return color;

  const f = invert(c.r);
  const g = invert(c.g);
  const k = invert(c.b);
  const m = Math.cos((hue * Math.PI) / 180);
  const s = Math.sin((hue * Math.PI) / 180);
  const a = [
    0.2126 + 0.7874 * m - 0.2126 * s, 0.7152 - 0.7152 * m - 0.7152 * s, 0.0722 - 0.0722 * m + 0.9278 * s,
    0.2126 - 0.2126 * m + 0.143 * s, 0.7152 + (1 - 0.7152) * m + 0.14 * s, 0.0722 - 0.0722 * m - 0.283 * s,
    0.2126 - 0.2126 * m - 0.7874 * s, 0.7152 - 0.7152 * m + 0.7152 * s, 0.0722 + 0.9278 * m + 0.0722 * s,
  ];
  const r = clamp(a[0] * f + a[1] * g + a[2] * k);
  const gg = clamp(a[3] * f + a[4] * g + a[5] * k);
  const b = clamp(a[6] * f + a[7] * g + a[8] * k);

  return (
    '#' +
    (16777216 | (r << 16) | (gg << 8) | b).toString(16).slice(1) +
    (c.a < 1 ? ('0' + Math.round(255 * c.a).toString(16)).slice(-2) : '')
  );
}

/**
 * Dark side of a plain (non light-dark) color, as mxUtils.parseLightDarkColor derives it:
 * 'auto' inverts it, 'simple' keeps it; var(...) colors are kept.
 */
export function adaptColor(color: string, adaptive: AdaptiveColors = 'auto'): string {
  if (adaptive !== 'auto' || /^var\(/i.test(color.trim())) return color;
  return getInverseColor(color);
}

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
 * Resolves one style color value for SVG output:
 * `light-dark(a, b)` -> a (b in dark mode); `default` -> the foreground/background color for
 * `key` (`invert` swaps light and dark, `page` uses the page background). In dark mode with
 * adaptiveColors 'auto' a plain color becomes mxUtils.getInverseColor(color), as draw.io's
 * SVG canvas renders it. `options` omitted = light theme.
 */
export function resolveColorValue(
  value: unknown,
  key: string,
  mode?: DefaultColorMode,
  options?: ColorResolveOptions,
): unknown {
  if (typeof value !== 'string') return value;
  const dark = isDarkResolve(options);
  if (value === 'default') {
    const fg = FOREGROUND_DEFAULT_KEYS.has(key);
    const bg = BACKGROUND_DEFAULT_KEYS.has(key);
    if (!fg && !bg) return value;
    if (mode === 'page') {
      const page = options?.pageBackground;
      if (page != null && page !== '' && page !== 'none' && page !== 'transparent') {
        return resolveColorValue(page, 'fillColor', undefined, options);
      }
      return dark ? DARK_PAGE_BACKGROUND : DEFAULT_BACKGROUND;
    }
    // invert: light-dark(dark, light) (Graph.getDefaultColor)
    if (mode === 'invert' ? !dark : dark) return fg ? DARK_FOREGROUND : DARK_BACKGROUND;
    return fg ? DEFAULT_FOREGROUND : DEFAULT_BACKGROUND;
  }
  if (!dark) {
    if (value.indexOf('(') < 0) return value;
    return resolveLightDark(value);
  }
  // light-dark() has an explicit dark side; var() colors are never inverted (parseLightDarkColor)
  if (parseLightDark(value) || /^\s*var\(/i.test(value)) return resolveLightDark(value, true);
  const resolved = value.indexOf('(') < 0 ? value : resolveLightDark(value, true);
  return parseColor(resolved) != null ? adaptColor(resolved, options?.adaptive ?? 'auto') : resolved;
}

/**
 * Rewrites every `light-dark(...)` inside CSS text (an HTML label's inline styles) to its
 * light value (dark value with `dark = true`), e.g.
 * `color: light-dark(rgb(224, 0, 0), rgb(237, 237, 237))` -> `color: rgb(224, 0, 0)`.
 * Unbalanced occurrences are left alone.
 */
export function resolveLightDarkInCss(text: string, dark = false): string {
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
    out +=
      text.slice(last, pos) +
      (ld ? resolveLightDarkInCss(resolveLightDark(dark ? ld.dark : ld.light, dark), dark) : text.slice(pos, close + 1));
    last = close + 1;
    pos = lower.indexOf(LIGHT_DARK, last);
  }
  return out + text.slice(last);
}

/** One CSS declaration list (`a: b; c: d`): light-dark() picks a side; plain colors adapt in dark mode. */
function adaptDeclarations(css: string, options: ColorResolveOptions): string {
  const dark = isDarkResolve(options);
  return splitTopLevel(css, ';')
    .map((decl) => {
      const colon = decl.indexOf(':');
      if (colon < 0) return decl;
      const prop = decl.slice(0, colon);
      const value = decl.slice(colon + 1).trim();
      let next = value;
      if (/light-dark\(/i.test(value)) next = resolveLightDarkInCss(value, dark);
      else if (dark && parseColor(value) != null) next = adaptColor(value, options.adaptive ?? 'auto');
      return next === value ? decl : `${prop}: ${next}`;
    })
    .join('; ');
}

/**
 * HTML label colors for the current mode (Graph.addLightDarkColors, Graph.js): every
 * `light-dark()` in the label resolves to the light/dark side; in dark mode with adaptiveColors
 * 'auto' every plain color in `style` attributes and `<font color>` is inverted the way draw.io
 * renders it. Light mode is exactly resolveLightDarkInCss(html).
 */
export function resolveHtmlLabelColors(html: string, options?: ColorResolveOptions): string {
  if (typeof html !== 'string') return html;
  if (!isDarkResolve(options)) return resolveLightDarkInCss(html);
  const opts = options!;
  const adaptive = opts.adaptive ?? 'auto';
  let out = html.replace(/(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, (_m, pre: string, q: string, css: string) =>
    `${pre}${q}${adaptDeclarations(css, opts)}${q}`,
  );
  out = out.replace(/(<font\b[^>]*?\scolor\s*=\s*)(["'])([^"']*)\2/gi, (m, pre: string, q: string, color: string) => {
    if (/light-dark\(/i.test(color)) return `${pre}${q}${resolveLightDarkInCss(color, true)}${q}`;
    return parseColor(color) != null ? `${pre}${q}${adaptColor(color, adaptive)}${q}` : m;
  });
  return resolveLightDarkInCss(out, true);
}
