/**
 * @file rule-settings.ts
 * @brief The configurable engineering rule checks (rule-checks.ts): their definitions (PL/EN
 *        labels, default severity, thresholds with defaults) and the per-diagram settings stored
 *        on the model's root cell as `rdRuleSettings` (draw.io diagram data, like `rdCountryId`,
 *        project-settings.ts): JSON with only the values that differ from the defaults, so a
 *        diagram without the attribute uses the defaults (docs/architecture/rules.md).
 */
import type { GraphDataModel } from '@maxgraph/core';
import { readRootAttribute, setRootAttribute } from './project-settings';

export const RULE_SETTINGS_ATTR = 'rdRuleSettings';

export type RuleSeverity = 'error' | 'warning';

export type RuleSetId =
  | 'bg-signal-distance'
  | 'balise-order'
  | 'overlap-length'
  | 'overlap-required'
  | 'detection-at-signal'
  | 'signal-side'
  | 'signal-spacing'
  | 'detection-between-signals'
  | 'signal-direction'
  | 'points-detection'
  | 'etcs-linking-missing'
  | 'etcs-linking-distance'
  | 'etcs-no-packets'
  | 'etcs-duplicate-nid-bg'
  | 'etcs-packet-direction'
  | 'etcs-tsr-revocation'
  | 'etcs-packet-invalid';

export interface Bi {
  en: string;
  pl: string;
}

export interface RuleParamDef {
  key: string;
  label: Bi;
  /** 'm' for distances; '' for options. */
  unit: 'm' | '';
  default: number | string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: Bi }>;
}

export interface RuleDef {
  id: RuleSetId;
  label: Bi;
  help: Bi;
  severity: RuleSeverity;
  /** false: off until the project turns it on (a check whose drawing convention varies). Default true. */
  enabledByDefault?: boolean;
  params: RuleParamDef[];
}

const metres = (key: string, en: string, pl: string, value: number, max = 10000): RuleParamDef => ({ key, label: { en, pl }, unit: 'm', default: value, min: 0, max });

export const RULE_DEFS: readonly RuleDef[] = [
  {
    id: 'bg-signal-distance',
    label: { en: 'Balise group in front of a signal', pl: 'Grupa balis przed semaforem' },
    help: {
      en: 'Every main signal (with a direction) needs a balise group on its approach (in rear of the signal, up to the previous signal) at a distance between min and max.',
      pl: 'Każdy semafor (z kierunkiem) ma grupę balis przed sobą (od strony dojazdu, do poprzedniego semafora) w odległości od min do max.',
    },
    severity: 'warning',
    params: [metres('min', 'min', 'min', 0), metres('max', 'max', 'max', 50)],
  },
  {
    id: 'balise-order',
    label: { en: 'Balise order within a group', pl: 'Kolejność balis w grupie' },
    help: {
      en: 'The balises of a group lie in increasing position 1..n in the group direction (nominal = left to right).',
      pl: 'Balisy grupy leżą w kolejności pozycji 1..n zgodnie z kierunkiem grupy (zasadniczy = od lewej do prawej).',
    },
    severity: 'error',
    params: [],
  },
  {
    id: 'overlap-length',
    label: { en: 'Minimum overlap length', pl: 'Minimalna długość zakładki' },
    help: {
      en: 'The overlap of a route, measured from the exit signal to the end of the overlap sections, is at least min long.',
      pl: 'Zakładka przebiegu, mierzona od semafora końcowego do końca odcinków zakładki, ma co najmniej min.',
    },
    severity: 'warning',
    params: [metres('min', 'min', 'min', 50)],
  },
  {
    id: 'overlap-required',
    label: { en: 'Route without overlap', pl: 'Przebieg bez zakładki' },
    help: {
      en: 'A route ending at a main signal (or a signal without type) has an overlap.',
      pl: 'Przebieg kończący się na semaforze (lub sygnale bez typu) ma zakładkę.',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'detection-at-signal',
    label: { en: 'Detection point at a signal', pl: 'Punkt detekcji przy semaforze' },
    help: {
      en: 'Beyond every main signal the first axle counter / insulated joint lies between min (clearance) and max from the signal.',
      pl: 'Za każdym semaforem pierwszy licznik osi / styk izolowany leży w odległości od min (prześwit) do max od semafora.',
    },
    severity: 'warning',
    params: [metres('min', 'min (clearance)', 'min (prześwit)', 0), metres('max', 'max', 'max', 20)],
  },
  {
    id: 'signal-side',
    label: { en: 'Signal on the correct side', pl: 'Semafor po właściwej stronie' },
    help: {
      en: 'A signal stands on the configured side of the track for its direction of travel (right-hand running: right). Off by default: schematic conventions differ (the ERTMS templates draw signals above a left-to-right track, snap to track places them below), so turn it on when the project draws signals on their physical side.',
      pl: 'Semafor stoi po ustawionej stronie toru względem kierunku jazdy (ruch prawostronny: po prawej). Domyślnie wyłączona: konwencje schematów są różne (szablony ERTMS rysują semafory nad torem biegnącym od lewej do prawej, przyciąganie do toru pod nim), więc włącz ją, gdy projekt rysuje semafory po ich rzeczywistej stronie.',
    },
    severity: 'warning',
    enabledByDefault: false,
    params: [
      {
        key: 'side',
        label: { en: 'side', pl: 'strona' },
        unit: '',
        default: 'right',
        options: [
          { value: 'right', label: { en: 'right', pl: 'prawa' } },
          { value: 'left', label: { en: 'left', pl: 'lewa' } },
        ],
      },
    ],
  },
  {
    id: 'signal-spacing',
    label: { en: 'Spacing of main signals', pl: 'Odstęp semaforów' },
    help: {
      en: 'Consecutive main signals of the same direction are at least min apart (minimum block length).',
      pl: 'Kolejne semafory tego samego kierunku są oddalone o co najmniej min (minimalna długość odstępu).',
    },
    severity: 'warning',
    params: [metres('min', 'min', 'min', 200, 100000)],
  },
  {
    id: 'detection-between-signals',
    label: { en: 'Train detection between signals', pl: 'Kontrola niezajętości między semaforami' },
    help: {
      en: 'Between two consecutive signals of the same direction there is a track section (TVD) or a detection point.',
      pl: 'Między kolejnymi semaforami tego samego kierunku jest odcinek izolowany (sekcja) lub punkt detekcji.',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'signal-direction',
    label: { en: 'Signal direction of routes', pl: 'Kierunek semaforów przebiegów' },
    help: {
      en: 'The entry and exit signals of a route have a direction (nominal/reverse) that the route travels in.',
      pl: 'Semafory początkowy i końcowy przebiegu mają kierunek (zasadniczy/przeciwny) zgodny z jazdą po przebiegu.',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'points-detection',
    label: { en: 'Points without detection', pl: 'Zwrotnica bez kontroli niezajętości' },
    help: {
      en: 'Every points lies in a track section (one of its legs) or has detection points on its legs.',
      pl: 'Każda zwrotnica leży w odcinku izolowanym (jedna z jej gałęzi) lub ma punkty detekcji na gałęziach.',
    },
    severity: 'warning',
    params: [],
  },
  // ---- ETCS balise data (etcs/etcs-checks.ts; docs/architecture/etcs-data.md)
  {
    id: 'etcs-linking-missing',
    label: { en: 'Linked group without linking packet', pl: 'Grupa linkowana bez pakietu linkowania' },
    help: {
      en: 'A balise group with ETCS data marked as linked (Q_LINK = 1) carries a linking packet (5).',
      pl: 'Grupa balis z danymi ETCS oznaczona jako linkowana (Q_LINK = 1) ma pakiet linkowania (5).',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'etcs-linking-distance',
    label: { en: 'Linking distance vs the drawing', pl: 'Odległość linkowania a rysunek' },
    help: {
      en: 'The D_LINK distances of packet 5 add up to the distance of each linked group (by NID_BG) along the drawing in the packet direction, within the tolerance.',
      pl: 'Suma odległości D_LINK pakietu 5 do każdej grupy linkowanej (wg NID_BG) zgadza się z odległością na rysunku w kierunku pakietu, z tolerancją.',
    },
    severity: 'warning',
    params: [metres('tolerance', 'tolerance', 'tolerancja', 5, 1000)],
  },
  {
    id: 'etcs-no-packets',
    label: { en: 'Balise group without packets', pl: 'Grupa balis bez pakietów' },
    help: {
      en: 'Once the drawing has ETCS data, every balise group has at least one packet (besides 255).',
      pl: 'Gdy rysunek ma dane ETCS, każda grupa balis ma co najmniej jeden pakiet (poza 255).',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'etcs-duplicate-nid-bg',
    label: { en: 'Duplicate NID_BG within NID_C', pl: 'Powtórzony NID_BG w NID_C' },
    help: {
      en: 'NID_BG identifies a balise group within its country / region NID_C (the diagram default when empty): no two groups share the pair.',
      pl: 'NID_BG identyfikuje grupę balis w obrębie NID_C (domyślnego dla rysunku, gdy puste): żadne dwie grupy nie mają tej samej pary.',
    },
    severity: 'error',
    params: [],
  },
  {
    id: 'etcs-packet-direction',
    label: { en: 'Packet direction vs the group', pl: 'Kierunek pakietu a grupa' },
    help: {
      en: 'A packet for one direction (Q_DIR nominal / reverse) needs an orientation of the group (direction, or two balises; a single balise must be linked), and linking / MA packets look towards the groups / signals of that direction.',
      pl: 'Pakiet dla jednego kierunku (Q_DIR) wymaga orientacji grupy (kierunek lub dwie balisy; pojedyncza balisa musi być linkowana), a pakiety linkowania / MA patrzą w stronę grup / semaforów tego kierunku.',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'etcs-tsr-revocation',
    label: { en: 'TSR without revocation', pl: 'TSR bez odwołania' },
    help: {
      en: 'Every revocable temporary speed restriction (packet 65, NID_TSR other than 255) is revoked by a packet 66 with the same NID_TSR somewhere in the drawing.',
      pl: 'Każde odwoływalne doraźne ograniczenie prędkości (pakiet 65, NID_TSR inny niż 255) ma pakiet 66 z tym samym NID_TSR w rysunku.',
    },
    severity: 'warning',
    params: [],
  },
  {
    id: 'etcs-packet-invalid',
    label: { en: 'Invalid ETCS packet data', pl: 'Błędne dane pakietów ETCS' },
    help: {
      en: 'The ETCS data of a group passes the editor\'s validation: ranges, required variables, N_ITER, Q_SCALE limits, telegram size.',
      pl: 'Dane ETCS grupy przechodzą walidację edytora: zakresy, wymagane zmienne, N_ITER, Q_SCALE, rozmiar telegramu.',
    },
    severity: 'error',
    params: [],
  },
];

export interface RuleConfig {
  enabled: boolean;
  severity: RuleSeverity;
  params: Record<string, number | string>;
}

export type RuleSettings = Record<RuleSetId, RuleConfig>;

export function getRuleDef(id: string): RuleDef | null {
  return RULE_DEFS.find((d) => d.id === id) ?? null;
}

export function defaultRuleSettings(): RuleSettings {
  const out = {} as RuleSettings;
  for (const d of RULE_DEFS) out[d.id] = { enabled: d.enabledByDefault !== false, severity: d.severity, params: Object.fromEntries(d.params.map((p) => [p.key, p.default])) };
  return out;
}

/** A parameter value as typed (number within min/max, or one of the options), or null when invalid. */
export function normalizeParam(p: RuleParamDef, value: unknown): number | string | null {
  if (p.options) return typeof value === 'string' && p.options.some((o) => o.value === value) ? value : null;
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value.trim().replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return null;
  if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) return null;
  return n;
}

/** Settings from the stored JSON (unknown rules/keys and invalid values fall back to the defaults). */
export function parseRuleSettings(text: string | null | undefined): RuleSettings {
  const settings = defaultRuleSettings();
  if (!text || !text.trim()) return settings;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return settings;
  }
  if (!raw || typeof raw !== 'object') return settings;
  for (const d of RULE_DEFS) {
    const entry = (raw as Record<string, unknown>)[d.id];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { enabled?: unknown; severity?: unknown; params?: unknown };
    const c = settings[d.id];
    if (typeof e.enabled === 'boolean') c.enabled = e.enabled;
    if (e.severity === 'error' || e.severity === 'warning') c.severity = e.severity;
    if (e.params && typeof e.params === 'object') {
      for (const p of d.params) {
        const v = normalizeParam(p, (e.params as Record<string, unknown>)[p.key]);
        if (v !== null) c.params[p.key] = v;
      }
    }
  }
  return settings;
}

/** The JSON stored on the diagram: only what differs from the defaults ('' = all defaults). */
export function serializeRuleSettings(settings: RuleSettings): string {
  const out: Record<string, { enabled?: boolean; severity?: RuleSeverity; params?: Record<string, number | string> }> = {};
  for (const d of RULE_DEFS) {
    const c = settings[d.id];
    if (!c) continue;
    const diff: { enabled?: boolean; severity?: RuleSeverity; params?: Record<string, number | string> } = {};
    if (c.enabled !== (d.enabledByDefault !== false)) diff.enabled = c.enabled;
    if (c.severity !== d.severity) diff.severity = c.severity;
    for (const p of d.params) {
      const v = c.params[p.key];
      if (v !== undefined && v !== p.default) (diff.params ??= {})[p.key] = v;
    }
    if (Object.keys(diff).length > 0) out[d.id] = diff;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : '';
}

export function readRuleSettings(model: GraphDataModel): RuleSettings {
  return parseRuleSettings(readRootAttribute(model, RULE_SETTINGS_ATTR));
}

/** Stores the settings on the diagram (one undoable edit; all defaults = no attribute). */
export function setRuleSettings(model: GraphDataModel, settings: RuleSettings): boolean {
  const text = serializeRuleSettings(settings);
  return setRootAttribute(model, RULE_SETTINGS_ATTR, text === '' ? null : text);
}
