/**
 * @file placeholders.ts
 * @brief draw.io label placeholders (`placeholders=1`): `%name%`, `%id%`, `%date{mask}%`, ...
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Graph.js (Graph.prototype.placeholderPattern,
 * isReplacePlaceholders, getLabel, convertValueToString, getGlobalVariable, formatDate,
 * replacePlaceholders, updatePlaceholders), src/main/webapp/js/grapheditor/Editor.js
 * (Editor.toUnit, mxConstants.PIXELS_PER_MM / PIXELS_PER_INCH) and
 * src/main/webapp/js/diagramly/EditorUi.js (%page%, %pagenumber%, %pagecount%, %filename%).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Graph.js
 * formatDate is Steven Levithan's dateFormat (MIT), as included in draw.io.
 *
 * Semantics (as in draw.io): a cell whose value is a UserObject/object element with
 * `placeholders="1"` shows its `label` attribute with every `%name%` replaced by
 * - `%id%`: the cell id;
 * - `%width%`, `%height%` (vertices; `%width_mm%`, `_cm`, `_in`, `_m`, `_current`);
 * - `%length%` of the ancestor edge (same unit suffixes);
 * - the attribute `name` of the cell or its nearest ancestor that has it;
 * - global variables: `%date%`, `%time%`, `%timestamp%`, `%date{mask}%`, `%page%`,
 *   `%pagenumber%`, `%pagecount%` (with `+n`/`-n`), `%filename%` and custom variables
 *   (see setPlaceholderVariables).
 * `%%name%` keeps `%name%` literally, unknown names stay as they are, `%label%` and `%tooltip%`
 * are never replaced. With a `placeholder="attr"` attribute the label is the value of `attr`
 * on the cell or an ancestor (convertValueToString) and is not replaced further.
 */
import type { Cell, Graph } from '@maxgraph/core';

/** Graph.prototype.placeholderPattern */
export const PLACEHOLDER_PATTERN = /%(date\{.*\}|[^%{}"'=;]+)%/g;

/** mxConstants measurement units (grapheditor Editor.js). */
export const UNITS = { POINTS: 1, MILLIMETERS: 2, INCHES: 3, METERS: 4, CENTIMETERS: 5 } as const;
export const PIXELS_PER_MM = 3.937;
export const PIXELS_PER_INCH = 100;

/** Editor.toUnit: unscaled pixels in the given unit (rounded as draw.io shows them). */
export function toUnit(pixels: number, unit: number | undefined): number {
  if (unit === UNITS.INCHES) return Math.round((pixels * 1000) / PIXELS_PER_INCH) / 1000;
  if (unit === UNITS.MILLIMETERS) return Math.round((pixels * 1000) / PIXELS_PER_MM) / 1000;
  if (unit === UNITS.METERS) return Math.round((pixels * 100000) / (PIXELS_PER_MM * 1000)) / 100000;
  if (unit === UNITS.CENTIMETERS) return Math.round((pixels * 10000) / (PIXELS_PER_MM * 10)) / 10000;
  return Math.round(pixels * 10) / 10;
}

const DAY_NAMES = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];
const DATE_MASKS: Record<string, string> = {
  default: 'ddd mmm dd yyyy HH:MM:ss',
  shortDate: 'm/d/yy',
  mediumDate: 'mmm d, yyyy',
  longDate: 'mmmm d, yyyy',
  fullDate: 'dddd, mmmm d, yyyy',
  shortTime: 'h:MM TT',
  mediumTime: 'h:MM:ss TT',
  longTime: 'h:MM:ss TT Z',
  isoDate: 'yyyy-mm-dd',
  isoTime: 'HH:MM:ss',
  isoDateTime: "yyyy-mm-dd'T'HH:MM:ss",
  isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",
};
const DATE_TOKEN = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g;
const TIMEZONE = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g;
const TIMEZONE_CLIP = /[^-+\dA-Z]/g;

function pad(val: unknown, len = 2): string {
  let s = String(val);
  while (s.length < len) s = `0${s}`;
  return s;
}

/**
 * Graph.prototype.formatDate: formats a date with a dateFormat mask (or a named mask such as
 * `isoDate`). A `UTC:` prefix formats in UTC. Throws a SyntaxError for an invalid date.
 */
export function formatDate(date?: Date | string | number, mask?: string, utc = false): string {
  const d0 = date != null && date !== '' ? new Date(date) : new Date();
  if (isNaN(d0.getTime())) throw new SyntaxError('invalid date');
  let m = String(DATE_MASKS[mask ?? ''] ?? (mask || DATE_MASKS.default));
  if (m.slice(0, 4) === 'UTC:') {
    m = m.slice(4);
    utc = true;
  }
  const d = utc ? d0.getUTCDate() : d0.getDate();
  const D = utc ? d0.getUTCDay() : d0.getDay();
  const mo = utc ? d0.getUTCMonth() : d0.getMonth();
  const y = utc ? d0.getUTCFullYear() : d0.getFullYear();
  const H = utc ? d0.getUTCHours() : d0.getHours();
  const M = utc ? d0.getUTCMinutes() : d0.getMinutes();
  const s = utc ? d0.getUTCSeconds() : d0.getSeconds();
  const L = utc ? d0.getUTCMilliseconds() : d0.getMilliseconds();
  const o = utc ? 0 : d0.getTimezoneOffset();
  const flags: Record<string, string | number> = {
    d,
    dd: pad(d),
    ddd: DAY_NAMES[D],
    dddd: DAY_NAMES[D + 7],
    m: mo + 1,
    mm: pad(mo + 1),
    mmm: MONTH_NAMES[mo],
    mmmm: MONTH_NAMES[mo + 12],
    yy: String(y).slice(2),
    yyyy: y,
    h: H % 12 || 12,
    hh: pad(H % 12 || 12),
    H,
    HH: pad(H),
    M,
    MM: pad(M),
    s,
    ss: pad(s),
    l: pad(L, 3),
    L: pad(L > 99 ? Math.round(L / 10) : L),
    t: H < 12 ? 'a' : 'p',
    tt: H < 12 ? 'am' : 'pm',
    T: H < 12 ? 'A' : 'P',
    TT: H < 12 ? 'AM' : 'PM',
    Z: utc ? 'UTC' : (String(d0).match(TIMEZONE) ?? ['']).pop()!.replace(TIMEZONE_CLIP, ''),
    o: (o > 0 ? '-' : '+') + pad(Math.floor(Math.abs(o) / 60) * 100 + (Math.abs(o) % 60), 4),
    S: ['th', 'st', 'nd', 'rd'][d % 10 > 3 ? 0 : (Number((d % 100) - (d % 10) !== 10) * d) % 10],
  };
  return m.replace(DATE_TOKEN, ($0) => ($0 in flags ? String(flags[$0]) : $0.slice(1, $0.length - 1)));
}

/** Page information for %page%, %pagenumber%, %pagecount% and %filename% (EditorUi). */
export interface PlaceholderContext {
  /** Name of the current page (tab). */
  page?: () => string | null | undefined;
  /** 1-based number of the current page. Default 1. */
  pageNumber?: () => number | null | undefined;
  /** Number of pages. Default 1. */
  pageCount?: () => number | null | undefined;
  /** Title of the current file. */
  filename?: () => string | null | undefined;
  /** Clock for the date placeholders (tests). */
  now?: () => Date;
  /** Custom global variables (draw.io `vars` URL parameter / file variables). */
  vars?: Record<string, string | number>;
}

const CONTEXT = Symbol.for('rd.drawioPlaceholderContext');
const INSTALLED = Symbol.for('rd.drawioPlaceholdersInstalled');

type PlaceholderGraph = Graph & { [CONTEXT]?: PlaceholderContext; [INSTALLED]?: boolean };

/** Sets the page/file information and custom variables for a graph's placeholders. */
export function setPlaceholderContext(graph: Graph, context: PlaceholderContext): void {
  (graph as PlaceholderGraph)[CONTEXT] = { ...context };
}

/** Merges custom global variables (draw.io `vars`) into the graph's placeholder context. */
export function setPlaceholderVariables(graph: Graph, vars: Record<string, string | number>): void {
  const g = graph as PlaceholderGraph;
  g[CONTEXT] = { ...g[CONTEXT], vars: { ...g[CONTEXT]?.vars, ...vars } };
}

function contextOf(graph: Graph | null | undefined): PlaceholderContext {
  return (graph as PlaceholderGraph | null | undefined)?.[CONTEXT] ?? {};
}

/** Graph.prototype.getGlobalVariable plus the EditorUi/Editor overrides. */
export function getGlobalVariable(name: string, graph?: Graph | null): string | number | null {
  const ctx = contextOf(graph);
  if (name === 'filename') {
    const v = ctx.filename?.();
    if (v != null) return v;
  } else if (name === 'page') {
    const v = ctx.page?.();
    if (v != null) return v;
  } else if (name === 'pagenumber') {
    return ctx.pageNumber?.() ?? 1;
  } else if (name === 'pagecount') {
    return ctx.pageCount?.() ?? 1;
  }
  const now = ctx.now?.() ?? new Date();
  let val: string | number | null = null;
  if (name === 'date') val = now.toLocaleDateString();
  else if (name === 'time') val = now.toLocaleTimeString();
  else if (name === 'timestamp') val = now.toLocaleString();
  else if (name.substring(0, 5) === 'date{') {
    try {
      val = formatDate(now, name.substring(5, name.length - 1));
    } catch {
      // Keeps the placeholder if the date is invalid
    }
  }
  if (val == null && ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, name)) val = ctx.vars[name];
  return val;
}

function isElement(value: unknown): value is Element {
  return value != null && typeof value === 'object' && typeof (value as Element).getAttribute === 'function';
}

/** Graph.prototype.isReplacePlaceholders: value is an element with `placeholders="1"`. */
export function isReplacePlaceholders(cell: Cell | null | undefined): boolean {
  const value = cell?.value as unknown;
  return isElement(value) && value.getAttribute('placeholders') === '1';
}

/** Value of attribute `name` on the cell or its nearest ancestor with an element value that has it. */
function lookupAttribute(cell: Cell | null, name: string): string | null {
  let current: Cell | null = cell;
  while (current) {
    const v = current.value as unknown;
    if (isElement(v) && v.hasAttribute(name)) return v.getAttribute(name) ?? '';
    current = current.getParent();
  }
  return null;
}

function unitOf(suffix: string, graph: Graph | null | undefined): number | undefined {
  const map: Record<string, number | undefined> = {
    mm: UNITS.MILLIMETERS,
    cm: UNITS.CENTIMETERS,
    in: UNITS.INCHES,
    m: UNITS.METERS,
    current: (graph?.view as unknown as { unit?: number } | undefined)?.unit,
  };
  return Object.prototype.hasOwnProperty.call(map, suffix) ? map[suffix] : undefined;
}

/**
 * Graph.prototype.replacePlaceholders: replaces the placeholders in `str` for `cell`. `vars` are
 * used for names that are neither cell data nor global variables.
 */
export function replacePlaceholders(
  graph: Graph | null | undefined,
  cell: Cell,
  str: string | null | undefined,
  vars?: Record<string, unknown> | null
): string {
  if (str == null) return '';
  const result: string[] = [];
  const pattern = new RegExp(PLACEHOLDER_PATTERN.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(str))) {
    const val = match[0];
    if (val.length > 2 && val !== '%label%' && val !== '%tooltip%') {
      let tmp: unknown = null;
      if (match.index > last && str.charAt(match.index - 1) === '%') {
        tmp = val.substring(1);
      } else {
        const name = val.substring(1, val.length - 1);
        if (name === 'id') {
          tmp = cell.id;
        } else if (name.substring(0, 5) === 'width' && cell.isVertex()) {
          const geo = cell.geometry;
          if (geo) tmp = name.length > 5 ? toUnit(geo.width, unitOf(name.substring(6), graph)) : geo.width;
        } else if (name.substring(0, 6) === 'height' && cell.isVertex()) {
          const geo = cell.geometry;
          if (geo) tmp = name.length > 6 ? toUnit(geo.height, unitOf(name.substring(7), graph)) : geo.height;
        } else if (name.substring(0, 6) === 'length') {
          let edge: Cell | null = cell;
          while (edge && !edge.isEdge()) edge = edge.getParent();
          const state = edge && graph ? graph.view.getState(edge) : null;
          if (state) {
            const len = Math.round(state.length / graph!.view.scale);
            tmp = name.length > 6 ? toUnit(len, unitOf(name.substring(7), graph)) : len;
          }
        } else if (name.indexOf('{') < 0) {
          tmp = lookupAttribute(cell, name);
        }
        if (tmp == null) {
          if ((name.substring(0, 9) === 'pagecount' && name.length > 9) || (name.substring(0, 10) === 'pagenumber' && name.length > 10)) {
            const m = name.match(/(pagecount|pagenumber)[\s]*([+-])[\s]*(\d+)/);
            if (m) {
              const n = parseInt(m[3], 10);
              const base = getGlobalVariable(m[1], graph);
              tmp = typeof base === 'number' ? base + (m[2] === '+' ? n : -n) : `${base}${m[2] === '+' ? n : -n}`;
            }
          } else {
            tmp = getGlobalVariable(name, graph);
          }
        }
        if (tmp == null && vars) tmp = vars[name];
      }
      result.push(str.substring(last, match.index) + (tmp != null ? String(tmp) : val));
      last = match.index + val.length;
    }
  }
  result.push(str.substring(last));
  return result.join('');
}

/** Graph.prototype.convertValueToString for element values (raw label, `placeholder` attribute). */
export function convertElementValueToString(cell: Cell): string {
  const value = cell.value as Element;
  if (isReplacePlaceholders(cell) && value.getAttribute('placeholder') != null) {
    return lookupAttribute(cell, value.getAttribute('placeholder')!) || '';
  }
  return value.getAttribute('label') || '';
}

/**
 * Installs draw.io placeholders on a graph (idempotent): convertValueToString returns the raw
 * label of `placeholders="1"` cells (so editing shows `%name%`), getLabel replaces the
 * placeholders (Graph.prototype.getLabel). Install after installUserObjectLabels.
 */
export function installPlaceholders(graph: Graph, context?: PlaceholderContext): void {
  const g = graph as PlaceholderGraph;
  if (context) setPlaceholderContext(graph, context);
  if (g[INSTALLED]) return;
  g[INSTALLED] = true;

  const baseConvert = graph.convertValueToString.bind(graph);
  graph.convertValueToString = (cell: Cell): string =>
    isReplacePlaceholders(cell) ? convertElementValueToString(cell) : baseConvert(cell);

  const baseGetLabel = graph.getLabel.bind(graph);
  graph.getLabel = (cell: Cell): string | null => {
    const label = baseGetLabel(cell);
    if (typeof label === 'string' && isReplacePlaceholders(cell) && (cell.value as Element).getAttribute('placeholder') == null) {
      return replacePlaceholders(graph, cell, label);
    }
    return label;
  };
}

/** Graph.prototype.updatePlaceholders: re-renders all cells with placeholders (e.g. new date). */
export function updatePlaceholders(graph: Graph): void {
  let validate = false;
  for (const cell of Object.values(graph.getDataModel().cells ?? {})) {
    if (isReplacePlaceholders(cell)) {
      graph.view.invalidate(cell, false, false);
      validate = true;
    }
  }
  if (validate) graph.view.validate();
}
