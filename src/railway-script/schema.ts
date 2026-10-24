/**
 * @file schema.ts
 * @brief The Railway Script JSON Schema (draft-07), built from the language tables and the
 *        railway catalogue (enums, ranges). Published as
 *        public/schemas/railway-script-1.schema.json (a test keeps the file equal to
 *        `buildRailwayScriptSchema()`), so editors can validate `.rdl.yaml` / `.rdl.json` files via
 *        `$schema` or yaml-language-server. The app validates with the same object (validate.ts).
 *
 * Unknown keys are allowed by the schema (no `additionalProperties: false`): the app reports them
 * as warnings and keeps them on round trips.
 */
import type { FieldDef, KindId } from '../railway/catalogue';
import { getKind } from '../railway/catalogue';
import { COMPUTED_FIELDS, KEY_ALIASES, LISTS, SCHEMA_ID, SCRIPT_VERSION, TRACK_NESTED_LISTS, stateValuesFor } from './language';

export type JsonSchema = Record<string, unknown>;

const ref = (name: string): JsonSchema => ({ $ref: `#/definitions/${name}` });
const num = (description?: string): JsonSchema => ({ type: 'number', ...(description ? { description } : {}) });

function fieldSchema(f: FieldDef): JsonSchema {
  const range = { ...(f.min !== undefined ? { minimum: f.min } : {}), ...(f.max !== undefined ? { maximum: f.max } : {}) };
  const description = `${f.label}${f.unit ? ` [${f.unit}]` : ''}${f.help ? ` — ${f.help}` : ''}`;
  switch (f.type) {
    case 'number':
      return { type: 'number', ...range, description };
    case 'integer':
      return { type: 'integer', ...range, description };
    case 'km':
      return { ...ref('km'), description };
    case 'enum': {
      const values: Array<string | number> = (f.options ?? []).map((o) => o.value);
      // numeric options (ETCS level 0..3) may be written as YAML numbers
      for (const o of f.options ?? []) if (/^\d+$/.test(o.value)) values.push(Number(o.value));
      return { enum: values, description };
    }
    case 'ref':
      return { ...ref('id'), description };
    case 'refList':
      return { ...ref('idList'), description };
    default:
      return { type: ['string', 'number', 'boolean'], description };
  }
}

/** Catalogue fields of a kind as script properties (canonical names, catalogue names and aliases). */
function catalogueProperties(kind: KindId): Record<string, JsonSchema> {
  const props: Record<string, JsonSchema> = {};
  const def = getKind(kind)!;
  const computed = COMPUTED_FIELDS[kind] ?? [];
  for (const f of def.fields) {
    if (f.key === 'trackId') {
      props.track = { ...ref('id'), description: 'Track ID (implied inside a track item)' };
      continue;
    }
    if (f.key === 'km') {
      props.at = { ...ref('km'), description: 'km position on the track (number, or chainage text "12+345")' };
      continue;
    }
    const s = fieldSchema(f);
    if (computed.includes(f.key)) s.description = `${String(s.description)} (computed when omitted)`;
    props[f.key] = s;
    for (const alias of KEY_ALIASES[kind]?.[f.key] ?? []) props[alias] = { ...s };
  }
  return props;
}

/** Runtime state keys of a kind (`state` / `aspect`, docs/STATES.md). */
function stateProperties(kind: KindId): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  const state = stateValuesFor(kind, 'state');
  if (state) out.state = { enum: state, description: `Runtime state (default ${state[0]}; docs/STATES.md)` };
  const aspect = stateValuesFor(kind, 'aspect');
  if (aspect) out.aspect = { enum: aspect, description: `Signal aspect (default ${aspect[0]}; not for marker boards / stop markers)` };
  return out;
}

const layout = (): Record<string, JsonSchema> => ({
  x: num('Layout override: x of the centre (a track: of its first point), drawing units'),
  y: num('Layout override: y of the centre (a track: of its line), drawing units'),
});

function objectDef(kind: KindId, extra: Record<string, JsonSchema>, required: string[], more: JsonSchema = {}): JsonSchema {
  const def = getKind(kind)!;
  return {
    type: 'object',
    description: `${def.label} (railway object kind "${kind}")`,
    required,
    properties: { id: ref('id'), ...catalogueProperties(kind), ...stateProperties(kind), ...extra, ...layout() },
    ...more,
  };
}

const anyRequired = (...keys: string[]): JsonSchema => ({ anyOf: keys.map((k) => ({ required: [k] })) });

/** Nested lists of a track item (their items need no `track`). */
function nestedLists(): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const key of TRACK_NESTED_LISTS) {
    const kind = LISTS.find((l) => l.key === key)!.kind;
    out[key] = { type: 'array', description: `${getKind(kind)!.plural} on this track`, items: ref(kind) };
  }
  return out;
}

export function buildRailwayScriptSchema(): JsonSchema {
  const definitions: Record<string, JsonSchema> = {
    id: { type: ['string', 'number'], minLength: 1, description: 'Object ID (unique per kind, case-insensitive)', 'x-expected': 'an ID' },
    idList: {
      anyOf: [{ type: 'string' }, { type: 'array', items: ref('id') }],
      description: 'IDs: a list, or text separated by commas',
      'x-expected': 'a list of IDs or comma-separated text',
    },
    km: {
      anyOf: [{ type: 'number' }, { type: 'string', pattern: '^\\s*-?\\d+\\+\\d{1,3}([.,]\\d+)?\\s*$' }],
      description: 'km value: a number (12.345) or chainage text ("12+345")',
      'x-expected': 'a km value (a number such as 12.345, or chainage text such as "12+345")',
    },
    page: {
      type: 'object',
      description: 'Layout options of the generated drawing',
      properties: {
        scale: { type: 'number', exclusiveMinimum: 0, description: 'Drawing units per metre (default 0.5)' },
        laneSpacing: { type: 'number', exclusiveMinimum: 0, description: 'Distance between lanes, drawing units (default 80)' },
        origin: {
          type: 'object',
          description: 'Where the smallest km of lane 0 is drawn (default x 40, y 80)',
          properties: { x: num(), y: num() },
        },
      },
    },
    track: {
      type: 'object',
      description: 'Track: a straight line from startKm to endKm on its lane (nominal direction = increasing km = left to right)',
      required: ['id'],
      allOf: [anyRequired('startKm', 'kmStart', 'start', 'StartPos'), anyRequired('endKm', 'kmEnd', 'end', 'EndPos')],
      properties: {
        id: ref('id'),
        ...catalogueProperties('track'),
        start: num('Start position in metres (= startKm × 1000)'),
        end: num('End position in metres (= endKm × 1000)'),
        StartPos: num('Alias of start (metres)'),
        EndPos: num('Alias of end (metres)'),
        lane: { type: 'integer', description: 'Vertical row (0 = top main line, 1 below, -1 above); automatic when omitted' },
        kind: { enum: ['main', 'siding'], description: 'main (default) or siding (drawn thinner)' },
        ...stateProperties('track'),
        ...nestedLists(),
        bufferStops: {
          type: 'array',
          description: 'Buffer stops on this track: "start" / "end" (ID BS-<track>-start/end) or { id, at: start|end|km }',
          items: { anyOf: [{ enum: ['start', 'end'] }, ref('bufferStop')], 'x-expected': '"start", "end" or { id, at }' },
        },
        ...layout(),
      },
    },
    points: objectDef(
      'points',
      {
        to: { ...ref('id'), description: 'Diverging track (its nearer end starts at the points)' },
        type: { type: 'string', description: 'Points type (free text, e.g. ordinary, slip)' },
      },
      ['id', 'at', 'to']
    ),
    signal: objectDef('signal', {}, ['id', 'at']),
    baliseGroup: objectDef(
      'baliseGroup',
      {
        balises: {
          anyOf: [
            { type: 'integer', minimum: 1, maximum: 8 },
            {
              type: 'array',
              items: {
                anyOf: [
                  ref('id'),
                  { type: 'object', required: ['id'], properties: { id: ref('id'), at: ref('km'), direction: { enum: ['nominal', 'reverse'] }, notes: { type: 'string' } } },
                ],
                'x-expected': 'a balise ID or { id, at }',
              },
            },
          ],
          description: 'Balises of the group: a count (IDs <group>-1, ...) or a list of IDs / { id, at }',
          'x-expected': 'a number of balises (1–8) or a list of balises',
        },
        etcs: {
          type: 'object',
          description: 'ETCS telegram data of the group (docs/architecture/etcs-data.md): { header, packets: [{ nid, vars, pig? }], balises? }',
          properties: { header: { type: 'object' }, packets: { type: 'array', items: { type: 'object', required: ['nid'], properties: { nid: { type: 'integer' }, vars: { type: 'object' } } } } },
        },
      },
      ['id', 'at']
    ),
    balise: objectDef('balise', {}, ['id', 'at']),
    axleCounter: objectDef('axleCounter', {}, ['id', 'at']),
    insulatedJoint: objectDef('insulatedJoint', {}, ['id', 'at']),
    trackSection: objectDef(
      'trackSection',
      {
        from: { anyOf: [ref('km'), ref('id')], description: 'Start: km, or the ID of an axle counter / insulated joint / balise on the track', 'x-expected': 'a km value or a detection point ID' },
        to: { anyOf: [ref('km'), ref('id')], description: 'End: km, or the ID of an axle counter / insulated joint on the track', 'x-expected': 'a km value or a detection point ID' },
      },
      ['id'],
      { allOf: [anyRequired('from', 'startKm', 'kmStart'), anyRequired('to', 'endKm', 'kmEnd')] }
    ),
    levelCrossing: objectDef('levelCrossing', {}, ['id', 'at']),
    bufferStop: objectDef('bufferStop', { at: { anyOf: [ref('km'), { enum: ['start', 'end'] }], description: 'km, or the track end (start/end)', 'x-expected': 'a km value, "start" or "end"' } }, ['id', 'at']),
    leu: objectDef('leu', {}, ['id', 'at']),
    rbc: objectDef('rbc', {}, ['id']),
    train: objectDef(
      'train',
      {
        track: { ...ref('id'), description: 'Track ID (implied inside a track item)' },
        at: { ...ref('km'), description: 'km of the train front' },
        direction: { enum: ['nominal', 'reverse'], description: 'Direction of travel' },
      },
      ['id', 'at']
    ),
    route: objectDef(
      'route',
      {
        via: {
          anyOf: [
            { type: 'object', additionalProperties: { enum: ['normal', 'reverse', 'N', 'R', '+', '-'] } },
            { type: 'string' },
          ],
          description: 'Required points positions, e.g. { W1: reverse } or "W1:reverse, W2:normal" (computed when omitted)',
          'x-expected': 'a map of points positions such as { W1: reverse }',
        },
      },
      ['id'],
      { allOf: [anyRequired('from', 'entrySignal'), anyRequired('to', 'exitSignal')] }
    ),
  };

  const properties: Record<string, JsonSchema> = {
    $schema: { type: 'string', description: 'URL or path of this schema' },
    railwayScript: { const: SCRIPT_VERSION, description: 'Railway Script language version (1)' },
    name: { type: 'string', description: 'Diagram name' },
    page: ref('page'),
  };
  for (const { key, kind } of LISTS) {
    const placed = kind !== 'track' && kind !== 'route' && kind !== 'rbc' && kind !== 'trackSection';
    const item = placed ? { allOf: [ref(kind), { required: ['track'] }] } : ref(kind);
    properties[key] = { type: 'array', description: getKind(kind)!.plural, items: item };
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: SCHEMA_ID,
    title: 'Railway Script',
    description: 'Railway Drawer schematic layout language (docs/RAILWAY-SCRIPT.md). YAML or JSON; km based, nominal direction = increasing km = left to right.',
    type: 'object',
    required: ['railwayScript'],
    properties,
    definitions,
  };
}
