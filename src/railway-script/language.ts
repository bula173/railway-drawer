/**
 * @file language.ts
 * @brief Railway Script vocabulary (docs/RAILWAY-SCRIPT.md): which lists hold which railway object
 *        kind (src/railway/catalogue.ts), and how script keys map to the catalogue fields stored in
 *        the rd* attributes of the generated cells. Shared by the JSON Schema, the model reader,
 *        the drawing -> text sync and "Generate from drawing". No dependencies (main-chunk safe).
 */
import type { KindId } from '../railway/catalogue';
import { ASPECT_ATTR, STATE_ATTR, STATE_SCHEME, schemeIdFor } from '../railway/states';

/** Value of the required `railwayScript` key. */
export const SCRIPT_VERSION = 1;
export const SCHEMA_ID = 'https://railwaydrawer.mksystemdesign.org/schemas/railway-script-1.schema.json';

/** Top-level lists and the kind of their items. */
export const LISTS: ReadonlyArray<{ key: string; kind: KindId }> = [
  { key: 'tracks', kind: 'track' },
  { key: 'points', kind: 'points' },
  { key: 'signals', kind: 'signal' },
  { key: 'baliseGroups', kind: 'baliseGroup' },
  { key: 'balises', kind: 'balise' },
  { key: 'axleCounters', kind: 'axleCounter' },
  { key: 'joints', kind: 'insulatedJoint' },
  { key: 'sections', kind: 'trackSection' },
  { key: 'levelCrossings', kind: 'levelCrossing' },
  { key: 'bufferStops', kind: 'bufferStop' },
  { key: 'leus', kind: 'leu' },
  { key: 'rbcs', kind: 'rbc' },
  { key: 'trains', kind: 'train' },
  { key: 'routes', kind: 'route' },
];

/** Lists that may also be written inside a track item (the track is then implied). */
export const TRACK_NESTED_LISTS: readonly string[] = ['points', 'signals', 'baliseGroups', 'balises', 'axleCounters', 'joints', 'sections', 'levelCrossings', 'bufferStops', 'leus', 'trains'];

export function listForKind(kind: KindId): string {
  return LISTS.find((l) => l.kind === kind)!.key;
}

export function kindForList(key: string): KindId | null {
  return LISTS.find((l) => l.key === key)?.kind ?? null;
}

/** Kinds placed by `track` + `at` (km). */
export const ON_TRACK_KINDS: ReadonlySet<KindId> = new Set<KindId>(['signal', 'balise', 'baliseGroup', 'axleCounter', 'insulatedJoint', 'levelCrossing', 'bufferStop', 'leu', 'train', 'points']);

/**
 * Script key -> catalogue field key, per kind, for keys whose name differs from the catalogue
 * (first entry = the canonical script key; later ones are accepted aliases). Catalogue keys
 * themselves are always accepted too.
 */
export const KEY_ALIASES: Partial<Record<KindId, Record<string, string[]>>> = {
  signal: { signalType: ['type'] },
  balise: { groupId: ['group'] },
  baliseGroup: { leuId: ['leu'] },
  track: { kmStart: ['startKm'], kmEnd: ['endKm'] },
  trackSection: { sectionType: ['type'], kmStart: ['startKm'], kmEnd: ['endKm'] },
  train: { rbcId: ['rbc'] },
  route: { entrySignal: ['from'], exitSignal: ['to'] },
};

/** Common keys of every kind: `id` -> id, `track` -> trackId, `at` -> km. */
export const COMMON_SCRIPT_KEYS: Record<string, string> = { track: 'trackId', at: 'km' };

/**
 * Keys that are not catalogue fields but stored as extra attributes on the cell (so the drawing
 * keeps them and "Generate from drawing" can read them back).
 */
export const EXTRA_ATTRS: Partial<Record<KindId, Record<string, string>>> = {
  track: { kind: 'rdTrackKind', lane: 'rdLane' },
  points: { type: 'rdPointsType', to: 'rdDivergingTrack' },
  train: { direction: 'rdDirection', track: 'rdTrackId', at: 'rdKm' },
};

/**
 * Runtime state keys (docs/STATES.md; scenarios in text): `state` -> `rdState` (sections, tracks,
 * points, routes, level crossings, balises / LEUs / axle counters / joints), `aspect` -> `rdAspect`
 * (signals). The points position is the catalogue field `position`. Missing = the default (free,
 * open, stop): the script is the source, applying it sets the look (state-apply.ts).
 */
export const STATE_KEYS: Readonly<Record<'state' | 'aspect', string>> = { state: STATE_ATTR, aspect: ASPECT_ATTR };

/** Allowed values of a state key for a kind (signals: by type), or null when the kind has none. */
export function stateValuesFor(kind: KindId, key: 'state' | 'aspect', signalType = ''): string[] | null {
  const scheme = schemeIdFor(kind, signalType);
  const dim = scheme ? STATE_SCHEME[scheme][key] : undefined;
  return dim ? dim.options.map((o) => o.value) : null;
}

/** Catalogue field keys a script never writes directly (computed from the drawing / script). */
export const COMPUTED_FIELDS: Partial<Record<KindId, string[]>> = {
  signal: ['routes'],
  route: ['length'],
};

/** Script key used for a catalogue field of `kind` (canonical alias, `track`, `at`, else the field key). */
export function scriptKeyForField(kind: KindId, field: string): string {
  if (field === 'trackId') return 'track';
  if (field === 'km') return 'at';
  const aliases = KEY_ALIASES[kind]?.[field];
  return aliases?.[0] ?? field;
}

/** All script keys that mean the catalogue field `field` of `kind` (canonical first). */
export function scriptKeysForField(kind: KindId, field: string): string[] {
  const keys = [scriptKeyForField(kind, field), field, ...(KEY_ALIASES[kind]?.[field] ?? [])];
  return [...new Set(keys)];
}

/** Key of a script object (also the `rdScript` attribute of its generated cell). */
export function objectKey(kind: KindId, id: string): string {
  return `${kind}:${id}`;
}

/** `kind:id` (upper-case id) for case-insensitive matching. */
export function matchKey(kind: string, id: string): string {
  return `${kind}:${id.trim().toUpperCase()}`;
}
