/**
 * @file states.ts
 * @brief Runtime states of railway objects and their colour scheme (pure: no graph access).
 *
 * States are stored on the object cell as draw.io attributes (saved in the file, shown in draw.io's
 * Edit Data), the colours they stand for are written into the cells' own styles by state-apply.ts:
 * - `rdState`: track sections, tracks, points, routes (`free` | `occupied` | `reserved` (route
 *   set) | `overlap` | `locked` | `disturbed`), level crossings (`open` | `closed` | `disturbed`),
 *   balises / LEUs / axle counters (`free` = working | `disturbed` = failed);
 * - `rdAspect`: signals (`stop` | `proceed` | `caution` | `shunt` | `dark`);
 * - `rdPosition`: points (`normal` | `reverse` | `moving` | `outOfControl`; the catalogue field).
 * A missing attribute is the default (free / open / stop / normal) and draws the object as drawn.
 *
 * The whole scheme is the one table `STATE_SCHEME` (+ `STATE_COLORS`), documented with a legend in
 * docs/STATES.md: change a colour or a state there. The colours are saturated (chroma >= 0.3) and
 * have >= 3:1 against the white and >= 4.5:1 against the dark canvas, so the dark rendering
 * (drawio-shapes/engine/colors.ts: neutral colours invert, saturated ones are kept, strokes floored
 * at 4.5:1) draws them unchanged; a unit test guards this.
 */
import type { KindId } from './catalogue';

export const STATE_ATTR = 'rdState';
export const ASPECT_ATTR = 'rdAspect';
/** Points position: the catalogue field `position` of points. */
export const POSITION_ATTR = 'rdPosition';
/** JSON of the style keys a state changed, per target cell path: `{"": {"strokeColor": "#000"}}`. */
export const BASE_STYLE_ATTR = 'rdBaseStyle';
/** On a set route: JSON of the points positions before "Set route" (`{"W1": "normal", "W2": ""}`). */
export const ROUTE_RESTORE_ATTR = 'rdRouteRestore';
/** Attributes that only hold runtime state (not infrastructure data): kept out of railML. */
export const RUNTIME_STATE_ATTRS: ReadonlySet<string> = new Set([STATE_ATTR, ASPECT_ATTR, BASE_STYLE_ATTR, ROUTE_RESTORE_ATTR]);

export type StateDimension = 'state' | 'aspect' | 'position';
export const STATE_DIMENSIONS: readonly StateDimension[] = ['state', 'aspect', 'position'];

export const DIMENSION_ATTR: Readonly<Record<StateDimension, string>> = {
  state: STATE_ATTR,
  aspect: ASPECT_ATTR,
  position: POSITION_ATTR,
};

export const DIMENSION_LABEL: Readonly<Record<StateDimension, string>> = {
  state: 'State',
  aspect: 'Aspect',
  position: 'Position',
};

/** What a state looks like. Missing keys keep the drawn style. */
export interface StateVisual {
  /** Line colour: strokes of the object (fills of stroke-less parts such as a TC marker bar). */
  stroke?: string;
  /** Lamp fill of a signal (`none` = dark); a signal without lamp parts gets its own fill. */
  lamp?: string;
  /** Dashed line with this pattern (space separated, maxGraph `dashPattern`). */
  dashPattern?: string;
  /** Opacity 0..100 of the object (an inactive points leg). */
  opacity?: number;
  /**
   * Thicker line: the drawn `strokeWidth` (1 when absent) times this factor, at least
   * `+ OCCUPIED_WIDTH_MIN_ADD` (occupied: tells the state apart from a track drawn red).
   */
  widthScale?: number;
}

export interface StateOption {
  value: string;
  /** Menu / Data panel label. */
  label: string;
  /** Lower-case word in change lists ("TC3: free → occupied"). */
  word: string;
  visual: StateVisual;
}

export interface DimensionScheme {
  dimension: StateDimension;
  /** The value a missing attribute means. */
  defaultValue: string;
  options: readonly StateOption[];
}

export type SchemeId = 'section' | 'points' | 'route' | 'signal' | 'levelCrossing' | 'equipment';

/** The state colours (one place; see the module comment for the contrast rules). */
export const STATE_COLORS = {
  occupied: '#ff0000',
  reserved: '#009e00',
  overlap: '#7a9a00',
  locked: '#2979ff',
  disturbed: '#e000e0',
  lampStop: '#ff0000',
  lampProceed: '#00c853',
  lampCaution: '#ffd600',
  lampShunt: '#9aa7ff',
} as const;

/** Dash patterns: overlap = long dashes, disturbed / out of control = "flashing" short dashes. */
export const STATE_DASHES = { overlap: '8 4', disturbed: '2 2', moving: '4 4' } as const;
/** Opacity of the inactive (diverging) leg of points in the normal position. */
export const INACTIVE_LEG_OPACITY = 30;
/** Opacity of a set / occupied route edge (drawn routes are 60). */
export const ROUTE_STATE_OPACITY = 80;
/**
 * Occupied lines are drawn thicker than drawn: tracks drawn red in the ERTMS library (and by users)
 * would otherwise look the same as an occupied (red) one. Width x 1.5, at least + 2.
 */
export const OCCUPIED_WIDTH_SCALE = 1.5;
export const OCCUPIED_WIDTH_MIN_ADD = 2;

/** The stroke width of a line drawn `drawn` wide (style value or absent) under `scale`. */
export function scaledStrokeWidth(drawn: unknown, scale: number): number {
  const n = typeof drawn === 'number' ? drawn : Number.parseFloat(String(drawn ?? ''));
  const base = Number.isFinite(n) && n > 0 ? n : 1;
  return Math.round(Math.max(base * scale, base + OCCUPIED_WIDTH_MIN_ADD) * 100) / 100;
}

const opt = (value: string, label: string, visual: StateVisual, word = label.replace(/\s*\(.*\)$/, '').toLowerCase()): StateOption => ({
  value,
  label,
  word,
  visual,
});

const TRACK_STATES: readonly StateOption[] = [
  opt('free', 'Free', {}),
  opt('occupied', 'Occupied', { stroke: STATE_COLORS.occupied, widthScale: OCCUPIED_WIDTH_SCALE }),
  opt('reserved', 'Reserved (route set)', { stroke: STATE_COLORS.reserved }),
  opt('overlap', 'Overlap', { stroke: STATE_COLORS.overlap, dashPattern: STATE_DASHES.overlap }),
  opt('locked', 'Locked', { stroke: STATE_COLORS.locked }),
  opt('disturbed', 'Disturbed', { stroke: STATE_COLORS.disturbed, dashPattern: STATE_DASHES.disturbed }),
];

const state = (options: readonly StateOption[], defaultValue = 'free'): DimensionScheme => ({ dimension: 'state', defaultValue, options });

/**
 * THE scheme: allowed states per object group and their visuals. Groups: `section` = track
 * sections and tracks, `points`, `route` (route edges on the Routes layer), `signal` (main and
 * shunting signals; marker boards and stop markers are unlit boards: no aspects),
 * `levelCrossing`, `equipment` = balises, LEUs, axle counters.
 */
export const STATE_SCHEME: Readonly<Record<SchemeId, Partial<Record<StateDimension, DimensionScheme>>>> = {
  section: { state: state(TRACK_STATES) },
  points: {
    state: state(TRACK_STATES),
    position: {
      dimension: 'position',
      defaultValue: 'normal',
      options: [
        // the points cell is the diverging leg (ERTMS "Point Left/Right"): faint while normal
        opt('normal', 'Normal', { opacity: INACTIVE_LEG_OPACITY }),
        opt('reverse', 'Reverse', {}),
        opt('moving', 'Moving', { dashPattern: STATE_DASHES.moving }),
        opt('outOfControl', 'Out of control', { stroke: STATE_COLORS.disturbed, dashPattern: STATE_DASHES.disturbed }),
      ],
    },
  },
  route: {
    state: state([
      opt('free', 'Not set', {}),
      opt('reserved', 'Set', { stroke: STATE_COLORS.reserved, opacity: ROUTE_STATE_OPACITY }),
      opt('occupied', 'In use (occupied)', { stroke: STATE_COLORS.occupied, opacity: ROUTE_STATE_OPACITY }),
    ]),
  },
  signal: {
    aspect: {
      dimension: 'aspect',
      defaultValue: 'stop',
      options: [
        opt('stop', 'Stop', { lamp: STATE_COLORS.lampStop }),
        opt('proceed', 'Proceed', { lamp: STATE_COLORS.lampProceed }),
        opt('caution', 'Caution', { lamp: STATE_COLORS.lampCaution }),
        opt('shunt', 'Shunt (lunar white)', { lamp: STATE_COLORS.lampShunt }),
        opt('dark', 'Dark (no light)', { lamp: 'none' }),
      ],
    },
  },
  levelCrossing: {
    state: state(
      [
        opt('open', 'Open', {}),
        opt('closed', 'Closed (secured)', { stroke: STATE_COLORS.locked }),
        opt('disturbed', 'Failure', { stroke: STATE_COLORS.disturbed, dashPattern: STATE_DASHES.disturbed }),
      ],
      'open'
    ),
  },
  equipment: {
    state: state([opt('free', 'Working', {}), opt('disturbed', 'Failed', { stroke: STATE_COLORS.disturbed, dashPattern: STATE_DASHES.disturbed })]),
  },
};

const SCHEME_BY_KIND: Partial<Record<KindId, SchemeId>> = {
  track: 'section',
  trackSection: 'section',
  points: 'points',
  route: 'route',
  signal: 'signal',
  levelCrossing: 'levelCrossing',
  balise: 'equipment',
  leu: 'equipment',
  axleCounter: 'equipment',
};

/** Signal types without lamps (no aspects). */
const UNLIT_SIGNAL_TYPES = new Set(['markerBoard', 'etcsStopMarker']);

/** The scheme of an object kind (signals: by type), or null (no runtime states). */
export function schemeIdFor(kind: KindId | null | undefined, signalType = ''): SchemeId | null {
  if (!kind) return null;
  if (kind === 'signal' && UNLIT_SIGNAL_TYPES.has(signalType.trim())) return null;
  return SCHEME_BY_KIND[kind] ?? null;
}

/** The dimensions a scheme has, in menu order. */
export function schemeDimensions(id: SchemeId): DimensionScheme[] {
  const s = STATE_SCHEME[id];
  return STATE_DIMENSIONS.map((d) => s[d]).filter((d): d is DimensionScheme => !!d);
}

export function stateOption(id: SchemeId, dimension: StateDimension, value: string): StateOption | null {
  return STATE_SCHEME[id][dimension]?.options.find((o) => o.value === value) ?? null;
}

/** The stored value, or the dimension's default when missing / unknown. */
export function effectiveValue(id: SchemeId, dimension: StateDimension, stored: string): string {
  const dim = STATE_SCHEME[id][dimension];
  if (!dim) return '';
  return dim.options.some((o) => o.value === stored) ? stored : dim.defaultValue;
}

/** The combined look of an object's state values (the position / aspect look wins over the state's). */
export function composeVisual(id: SchemeId, values: Partial<Record<StateDimension, string>>): StateVisual {
  const out: StateVisual = {};
  for (const d of STATE_DIMENSIONS) {
    const v = values[d];
    if (!v) continue;
    Object.assign(out, stateOption(id, d, v)?.visual ?? {});
  }
  return out;
}

/** How a part of the object takes a visual. */
export type TargetRole = 'stroke' | 'fill' | 'lamp';

/** The style keys a visual sets on a part with `role` (empty: the part keeps its drawn style). */
export function visualStyleKeys(visual: StateVisual, role: TargetRole): Record<string, unknown> {
  const keys: Record<string, unknown> = {};
  if (role === 'lamp') {
    if (visual.lamp !== undefined) {
      keys.fillColor = visual.lamp;
      keys.gradientColor = 'none';
    }
  } else if (visual.stroke !== undefined) {
    keys[role === 'stroke' ? 'strokeColor' : 'fillColor'] = visual.stroke;
  }
  if (visual.dashPattern !== undefined && role === 'stroke') {
    keys.dashed = 1;
    keys.dashPattern = visual.dashPattern;
  }
  if (visual.opacity !== undefined) keys.opacity = visual.opacity;
  return keys;
}

/** Per target path, the drawn values of the style keys a state changed (null = key was absent). */
export type BaseStyles = Record<string, Record<string, unknown>>;

export function parseBaseStyles(text: string | null | undefined): BaseStyles {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: BaseStyles = {};
    for (const [path, keys] of Object.entries(parsed as Record<string, unknown>)) {
      if (!/^(\d+(\.\d+)*)?$/.test(path) || !keys || typeof keys !== 'object' || Array.isArray(keys)) continue;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(keys as Record<string, unknown>)) {
        if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
      }
      if (Object.keys(clean).length > 0) out[path] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeBaseStyles(base: BaseStyles): string {
  const entries = Object.entries(base).filter(([, keys]) => Object.keys(keys).length > 0);
  return entries.length === 0 ? '' : JSON.stringify(Object.fromEntries(entries));
}

/**
 * A style with the drawn values a state replaced put back (the own style of the object cell for
 * path ''): what railML's rd extension stores instead of the state colours.
 */
export function styleWithoutState(style: Record<string, unknown>, base: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!base) return style;
  const out = { ...style };
  for (const [k, v] of Object.entries(base)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Change lists (scenario "Show changes")
// ---------------------------------------------------------------------------------------------

/** The scheme of an object from its data attributes (`rdKind`, `rdSignalType`). */
export function schemeIdOfData(data: Record<string, string>): SchemeId | null {
  return schemeIdFor((data.rdKind ?? '') as KindId, data.rdSignalType ?? '');
}

function wordOf(id: SchemeId | null, dimension: StateDimension, value: string): string {
  if (id) {
    const dim = STATE_SCHEME[id][dimension];
    if (dim) return stateOption(id, dimension, value || dim.defaultValue)?.word ?? value;
  }
  return value || 'default';
}

/**
 * Phrases for the state changes between two attribute sets of one object: `free → occupied`,
 * `aspect stop → proceed`, `position normal → reverse` (missing = the default).
 */
export function describeStateChanges(before: Record<string, string>, after: Record<string, string>): string[] {
  const id = schemeIdOfData(after) ?? schemeIdOfData(before);
  const out: string[] = [];
  for (const d of STATE_DIMENSIONS) {
    const attr = DIMENSION_ATTR[d];
    const a = before[attr] ?? '';
    const b = after[attr] ?? '';
    if (a === b) continue;
    if (d === 'position' && id !== 'points') continue; // balise position in group: data, not state
    const from = wordOf(id, d, a);
    const to = wordOf(id, d, b);
    if (from === to) continue;
    out.push(d === 'state' ? `${from} → ${to}` : `${d} ${from} → ${to}`);
  }
  return out;
}

/** Style keys a state may change (folded into the state phrase in change lists). */
export const STATE_STYLE_KEYS: ReadonlySet<string> = new Set(['strokeColor', 'fillColor', 'gradientColor', 'dashed', 'dashPattern', 'opacity', 'strokeWidth']);
