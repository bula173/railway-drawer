/**
 * @file catalogue.ts
 * @brief Typed catalogue of railway (ERTMS/ETCS) object kinds and their properties.
 *
 * A railway object is any cell whose value is a draw.io `<object>`/`<UserObject>` element with an
 * `rdKind` attribute (see object-data.ts). Each property is stored as its own attribute
 * (`rdId`, `rdKm`, `rdNidBg`, ...), so the data shows up in draw.io's Edit Data dialog and labels
 * can use draw.io placeholders such as `%rdId%`.
 *
 * Kinds are pre-assigned when ERTMS library entries (public/libraries/ertms.xml) or the app's
 * railway shapes are inserted (`kindForPaletteEntry`, `kindForStyle`); any shape can get a kind
 * in the Data panel.
 */

export type KindId =
  | 'signal'
  | 'balise'
  | 'baliseGroup'
  | 'track'
  | 'trackSection'
  | 'points'
  | 'levelCrossing'
  | 'bufferStop'
  | 'rbc'
  | 'leu'
  | 'axleCounter'
  | 'insulatedJoint'
  | 'train'
  | 'route';

export type FieldType =
  /** free text */
  | 'text'
  /** decimal number (`min`/`max`/`unit`) */
  | 'number'
  /** whole number (`min`/`max`) */
  | 'integer'
  /** kilometre position: decimal km, also accepts chainage `12+345` and a decimal comma */
  | 'km'
  /** one of `options` */
  | 'enum'
  /** the ID of another object of `refKinds` */
  | 'ref'
  /** several IDs of objects of `refKinds`, comma separated */
  | 'refList';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  /** Key used in code and reports (`id`, `km`, `nidBg`, ...). */
  key: string;
  /** Attribute name on the cell's value element (`rd` + PascalCase key). */
  attr: string;
  label: string;
  type: FieldType;
  unit?: string;
  min?: number;
  max?: number;
  options?: FieldOption[];
  refKinds?: KindId[];
  /** A missing value is reported with this severity. */
  required?: 'error' | 'warning';
  /** Short hint shown under the field. */
  help?: string;
}

export interface KindDef {
  id: KindId;
  label: string;
  plural: string;
  /** Prefix of generated IDs (`S1`, `BG1`, ...). */
  idPrefix: string;
  fields: FieldDef[];
}

/** Attribute holding the kind on the value element. */
export const KIND_ATTR = 'rdKind';
/** Attribute of the object ID (every kind has it). */
export const ID_ATTR = 'rdId';

/** `nidBg` -> `rdNidBg` */
export function attrForKey(key: string): string {
  return `rd${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function field(key: string, label: string, type: FieldType, extra: Partial<FieldDef> = {}): FieldDef {
  return { key, attr: attrForKey(key), label, type, ...extra };
}

const opts = (...pairs: Array<[string, string]>): FieldOption[] => pairs.map(([value, label]) => ({ value, label }));

const DIRECTION = opts(['nominal', 'Nominal'], ['reverse', 'Reverse']);
const TRACK_KINDS: KindId[] = ['track', 'trackSection'];

const idField = (label = 'ID', help?: string): FieldDef => field('id', label, 'text', { required: 'error', help });
const kmField = (label = 'km position'): FieldDef => field('km', label, 'km', { unit: 'km', help: 'e.g. 12.345 or 12+345' });
const trackField = (): FieldDef => field('trackId', 'Track', 'ref', { refKinds: TRACK_KINDS });
const notesField = (): FieldDef => field('notes', 'Remarks', 'text');

export const KINDS: readonly KindDef[] = [
  {
    id: 'signal',
    label: 'Signal',
    plural: 'Signals',
    idPrefix: 'S',
    fields: [
      idField('Signal ID', 'e.g. S12'),
      field('signalType', 'Type', 'enum', {
        options: opts(['main', 'Main signal'], ['shunting', 'Shunting signal'], ['markerBoard', 'Marker board'], ['etcsStopMarker', 'ETCS stop marker']),
      }),
      field('direction', 'Direction', 'enum', { options: DIRECTION }),
      kmField(),
      trackField(),
      field('aspects', 'Aspects', 'integer', { min: 1, max: 6 }),
      field('routes', 'Routes', 'refList', { refKinds: ['route'], help: 'Route IDs, comma separated' }),
      notesField(),
    ],
  },
  {
    id: 'balise',
    label: 'Balise',
    plural: 'Balises',
    idPrefix: 'B',
    fields: [
      idField('Balise ID'),
      field('groupId', 'Balise group', 'ref', { refKinds: ['baliseGroup'] }),
      field('position', 'Position in group', 'integer', { min: 1, max: 8 }),
      field('direction', 'Direction', 'enum', { options: DIRECTION }),
      kmField(),
      trackField(),
      notesField(),
    ],
  },
  {
    id: 'baliseGroup',
    label: 'Balise group',
    plural: 'Balise groups',
    idPrefix: 'BG',
    fields: [
      idField('BG ID'),
      field('nidC', 'NID_C', 'integer', { min: 0, max: 1023, required: 'warning', help: 'Country/region (0–1023)' }),
      field('nidBg', 'NID_BG', 'integer', { min: 0, max: 16383, required: 'warning', help: 'Balise group identity (0–16383)' }),
      field('count', 'Balises in group', 'integer', { min: 1, max: 8 }),
      field('direction', 'Direction', 'enum', { options: DIRECTION }),
      kmField(),
      trackField(),
      field('function', 'Function', 'enum', { options: opts(['fixed', 'Fixed'], ['switchable', 'Switchable'], ['infill', 'Infill']) }),
      field('leuId', 'LEU', 'ref', { refKinds: ['leu'] }),
      notesField(),
    ],
  },
  {
    id: 'track',
    label: 'Track',
    plural: 'Tracks',
    idPrefix: 'T',
    fields: [
      idField('Track ID'),
      field('name', 'Name', 'text'),
      field('length', 'Length', 'number', { unit: 'm', min: 0 }),
      field('kmStart', 'km start', 'km', { unit: 'km' }),
      field('kmEnd', 'km end', 'km', { unit: 'km' }),
      notesField(),
    ],
  },
  {
    id: 'trackSection',
    label: 'Track section',
    plural: 'Track sections',
    idPrefix: 'TS',
    fields: [
      idField('Section ID'),
      field('sectionType', 'Detection', 'enum', { options: opts(['tc', 'Track circuit (TC)'], ['axleCounter', 'Axle counter section']) }),
      field('trackId', 'Track', 'ref', { refKinds: ['track'] }),
      field('length', 'Length', 'number', { unit: 'm', min: 0 }),
      field('kmStart', 'km start', 'km', { unit: 'km' }),
      field('kmEnd', 'km end', 'km', { unit: 'km' }),
      notesField(),
    ],
  },
  {
    id: 'points',
    // "points" in all UI text (switch / turnout are search tags of the ERTMS palette entries)
    label: 'Points',
    plural: 'Points',
    idPrefix: 'W',
    fields: [
      idField('Points ID'),
      field('hand', 'Hand', 'enum', { options: opts(['left', 'Left'], ['right', 'Right']) }),
      // also the runtime position (states.ts: moving / out of control; Position ▸ in the context menu)
      field('position', 'Position', 'enum', {
        options: opts(['normal', 'Normal'], ['reverse', 'Reverse'], ['moving', 'Moving'], ['outOfControl', 'Out of control']),
      }),
      kmField(),
      trackField(),
      notesField(),
    ],
  },
  {
    id: 'levelCrossing',
    label: 'Level crossing',
    plural: 'Level crossings',
    idPrefix: 'LC',
    fields: [
      idField(),
      field('protection', 'Protection', 'enum', {
        options: opts(['fullBarriers', 'Full barriers'], ['halfBarriers', 'Half barriers'], ['lights', 'Lights only'], ['passive', 'Passive']),
      }),
      kmField(),
      trackField(),
      notesField(),
    ],
  },
  {
    id: 'bufferStop',
    label: 'Buffer stop',
    plural: 'Buffer stops',
    idPrefix: 'BS',
    fields: [idField(), kmField(), trackField(), notesField()],
  },
  {
    id: 'rbc',
    label: 'RBC',
    plural: 'RBCs',
    idPrefix: 'RBC',
    fields: [
      idField(),
      field('nidC', 'NID_C', 'integer', { min: 0, max: 1023 }),
      field('nidRbc', 'NID_RBC', 'integer', { min: 0, max: 16383 }),
      notesField(),
    ],
  },
  {
    id: 'leu',
    label: 'LEU',
    plural: 'LEUs',
    idPrefix: 'LEU',
    fields: [idField(), kmField(), trackField(), notesField()],
  },
  {
    id: 'axleCounter',
    label: 'Axle counter',
    plural: 'Axle counters',
    idPrefix: 'AC',
    fields: [
      idField('Detection point ID'),
      kmField(),
      trackField(),
      field('sections', 'Track sections', 'refList', { refKinds: ['trackSection'], help: 'Section IDs, comma separated' }),
      notesField(),
    ],
  },
  {
    // the joint of a track circuit (ERTMS "TC" marker): railML trainDetectionElement insulatedRailJoint
    id: 'insulatedJoint',
    label: 'Insulated rail joint',
    plural: 'Insulated rail joints',
    idPrefix: 'J',
    fields: [
      idField('Joint ID'),
      kmField(),
      trackField(),
      field('sections', 'Track sections', 'refList', { refKinds: ['trackSection'], help: 'Track circuit sections it separates, comma separated' }),
      notesField(),
    ],
  },
  {
    id: 'train',
    label: 'Train',
    plural: 'Trains',
    idPrefix: 'TR',
    fields: [
      idField('Train ID'),
      field('etcsLevel', 'ETCS level', 'enum', { options: opts(['0', 'Level 0'], ['1', 'Level 1'], ['2', 'Level 2'], ['3', 'Level 3'], ['NTC', 'NTC']) }),
      field('maxSpeed', 'Max speed', 'number', { unit: 'km/h', min: 0, max: 600 }),
      field('length', 'Length', 'number', { unit: 'm', min: 0 }),
      field('rbcId', 'RBC', 'ref', { refKinds: ['rbc'] }),
      notesField(),
    ],
  },
  {
    id: 'route',
    label: 'Route',
    plural: 'Routes',
    idPrefix: 'R',
    fields: [
      idField('Route ID'),
      field('entrySignal', 'Entry signal', 'ref', { refKinds: ['signal'] }),
      field('exitSignal', 'Exit signal', 'ref', { refKinds: ['signal'] }),
      field('points', 'Points (required positions)', 'text', { help: 'e.g. W1:normal, W2:reverse' }),
      field('sections', 'Track sections', 'refList', { refKinds: TRACK_KINDS, help: 'In order, comma separated' }),
      field('overlap', 'Overlap', 'refList', { refKinds: TRACK_KINDS, help: 'Sections beyond the exit signal (optional)' }),
      field('length', 'Length', 'number', { unit: 'm', min: 0 }),
      notesField(),
    ],
  },
];

const KIND_BY_ID = new Map<string, KindDef>(KINDS.map((k) => [k.id, k]));

export function getKind(id: string | null | undefined): KindDef | null {
  return id ? KIND_BY_ID.get(id) ?? null : null;
}

export function isKindId(id: unknown): id is KindId {
  return typeof id === 'string' && KIND_BY_ID.has(id);
}

/** Every attribute the catalogue defines (plus the kind), for removing data from a cell. */
export const ALL_DATA_ATTRS: ReadonlySet<string> = new Set([KIND_ATTR, ...KINDS.flatMap((k) => k.fields.map((f) => f.attr))]);

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

/**
 * Parses a number as typed by a user: decimal point or comma, and for km also chainage
 * (`12+345` = 12.345 km). Returns null for empty or unparseable text.
 */
export function parseNumber(text: string | null | undefined, type: FieldType = 'number'): number | null {
  if (text === null || text === undefined) return null;
  const t = String(text).trim().replace(/\s+/g, '');
  if (t === '') return null;
  if (type === 'km') {
    const chainage = /^(-?\d+)\+(\d{1,3})(?:[.,](\d+))?$/.exec(t);
    if (chainage) {
      const km = Number(chainage[1]);
      const metres = Number(`${chainage[2].padStart(3, '0')}${chainage[3] ? `.${chainage[3]}` : ''}`);
      const sign = chainage[1].startsWith('-') ? -1 : 1;
      return km + (sign * metres) / 1000;
    }
  }
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Canonical text of a number for storage (no float noise, `.` as decimal point). */
export function formatStoredNumber(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/**
 * Normalizes user input for a field before it is stored: numbers in canonical form (unparseable
 * text is kept as typed, so the checks can report it), ref lists as `A, B`, text trimmed.
 */
export function normalizeFieldInput(fieldDef: FieldDef, text: string): string {
  const t = text.trim();
  if (t === '') return '';
  if (fieldDef.type === 'number' || fieldDef.type === 'integer' || fieldDef.type === 'km') {
    const n = parseNumber(t, fieldDef.type);
    return n === null ? t : formatStoredNumber(n);
  }
  if (fieldDef.type === 'refList') return splitRefList(t).join(', ');
  return t;
}

/** IDs of a ref-list value (`A, B; C` -> [A, B, C]). */
export function splitRefList(text: string | null | undefined): string[] {
  if (!text) return [];
  return String(text)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** Problem with a single field value (type, range, option), or null. Empty values are fine here. */
export function fieldValueProblem(fieldDef: FieldDef, value: string | null | undefined): string | null {
  const t = (value ?? '').trim();
  if (t === '') return null;
  switch (fieldDef.type) {
    case 'number':
    case 'integer':
    case 'km': {
      const n = parseNumber(t, fieldDef.type);
      if (n === null) return `${fieldDef.label} "${t}" is not a number`;
      if (fieldDef.type === 'integer' && !Number.isInteger(n)) return `${fieldDef.label} must be a whole number (got ${t})`;
      const unit = fieldDef.unit ? ` ${fieldDef.unit}` : '';
      if (fieldDef.min !== undefined && fieldDef.max !== undefined && (n < fieldDef.min || n > fieldDef.max)) {
        return `${fieldDef.label} ${t} is out of range ${fieldDef.min}–${fieldDef.max}${unit}`;
      }
      if (fieldDef.min !== undefined && n < fieldDef.min) return `${fieldDef.label} ${t} is below ${fieldDef.min}${unit}`;
      if (fieldDef.max !== undefined && n > fieldDef.max) return `${fieldDef.label} ${t} is above ${fieldDef.max}${unit}`;
      return null;
    }
    case 'enum':
      return fieldDef.options?.some((o) => o.value === t) ? null : `${fieldDef.label} "${t}" is not a known value`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Pre-assigned kinds
// ---------------------------------------------------------------------------------------------

export interface KindPreset {
  kind: KindId;
  /** Field values set on insert (keys as in the catalogue). */
  values?: Record<string, string>;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * ERTMS library entries (public/libraries/ertms.xml, matched by title, case-insensitive) that
 * represent railway objects. "Left"/"Right" symbols get the reverse/nominal direction, the
 * number in a signal title is its aspect count.
 */
export function kindForLibraryTitle(title: string): KindPreset | null {
  const t = normalizeTitle(title);
  let m = /^signal (left|right) (\d)$/.exec(t);
  if (m) return { kind: 'signal', values: { signalType: 'main', direction: m[1] === 'left' ? 'reverse' : 'nominal', aspects: m[2] } };
  m = /^(?:single )?balise (left|right)$/.exec(t);
  if (m) return { kind: 'balise', values: { direction: m[1] === 'left' ? 'reverse' : 'nominal' } };
  // the "TC" tile is the joint marker of a track circuit (10x12), not a section line
  if (t === 'tc') return { kind: 'insulatedJoint' };
  if (t === 'track') return { kind: 'track' };
  m = /^point (left|right)$/.exec(t);
  if (m) return { kind: 'points', values: { hand: m[1], position: 'normal' } };
  if (t === 'train' || t === 'train connected') return { kind: 'train' };
  return null;
}

/** True for entries of the ERTMS library (palette entry ids `ertms-<index>-<slug>`, source `libraries/ertms.xml#<index>`). */
export function isErtmsLibraryEntry(entry: { id: string; source?: string }): boolean {
  return entry.id.startsWith('ertms-') || (entry.source ?? '').includes('ertms.xml');
}

/**
 * Kind of a palette entry, or null: ERTMS library entries by title (preset values), other library
 * entries by the `rdKind` their (first) object carries (railway libraries, user libraries).
 */
export function kindForPaletteEntry(entry: { id: string; title: string; source?: string; xml?: string }): KindPreset | null {
  if (isErtmsLibraryEntry(entry)) return kindForLibraryTitle(entry.title);
  const kind = entry.xml ? /<(?:object|UserObject)\b[^>]*?\srdKind="([A-Za-z]+)"/.exec(entry.xml)?.[1] : undefined;
  return isKindId(kind) ? { kind } : null;
}

/** App railway shapes (src/shapes/railway, src/shapes/ertms) by style `shape`. */
const SHAPE_KINDS: Record<string, KindPreset> = {
  customRail: { kind: 'track' },
  customSignal: { kind: 'signal' },
  customSignalHead: { kind: 'signal' },
  customSwitch: { kind: 'points' },
  customCrossing: { kind: 'levelCrossing' },
  customBuffer: { kind: 'bufferStop' },
  customEOLMarker: { kind: 'bufferStop' },
  customDetectionPoint: { kind: 'axleCounter' },
  customTrackSection: { kind: 'trackSection' },
  customTrackCircuit: { kind: 'trackSection', values: { sectionType: 'tc' } },
  customTrain: { kind: 'train' },
  customRBC: { kind: 'rbc' },
  'ertms-signal': { kind: 'signal' },
  'ertms-balise': { kind: 'balise' },
  'ertms-track': { kind: 'track' },
  'ertms-train': { kind: 'train' },
};

/** Kind pre-assigned for a cell style (object or draw.io style string), or null. */
export function kindForStyle(style: unknown): KindPreset | null {
  let shape: unknown = null;
  if (typeof style === 'string') shape = /(?:^|;)shape=([^;]+)/.exec(style)?.[1] ?? null;
  else if (style && typeof style === 'object') shape = (style as Record<string, unknown>).shape;
  return typeof shape === 'string' ? SHAPE_KINDS[shape] ?? null : null;
}
