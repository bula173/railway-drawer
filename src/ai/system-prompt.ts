/**
 * @file system-prompt.ts
 * @brief The system prompt of the in-app AI chat (also the MCP server's instructions): what Railway
 *        Drawer is, the railway conventions, how to use the tools, and a key reference of the
 *        Railway Script language generated from the catalogue and the language tables (the same
 *        sources as the JSON Schema), plus the built-in examples. Deterministic (no dates, no ids)
 *        so the Messages API can cache it. Pure (no DOM).
 */
import { KINDS, getKind } from '../railway/catalogue';
import type { FieldDef, KindId } from '../railway/catalogue';
import { COMPUTED_FIELDS, EXTRA_ATTRS, LISTS, ON_TRACK_KINDS, SCHEMA_ID, TRACK_NESTED_LISTS, scriptKeyForField, stateValuesFor } from '../railway-script/language';
import { SCRIPT_TEMPLATES } from '../railway-script/templates';

function fieldText(kind: KindId, f: FieldDef): string {
  const key = scriptKeyForField(kind, f.key);
  let type: string;
  switch (f.type) {
    case 'enum':
      type = (f.options ?? []).map((o) => o.value).join('|');
      break;
    case 'integer':
    case 'number':
      type = `${f.type === 'integer' ? 'int' : 'number'}${f.min !== undefined || f.max !== undefined ? ` ${f.min ?? ''}..${f.max ?? ''}` : ''}${f.unit ? ` ${f.unit}` : ''}`;
      break;
    case 'km':
      type = 'km';
      break;
    case 'ref':
      type = `id of ${(f.refKinds ?? []).join('/')}`;
      break;
    case 'refList':
      type = `list of ${(f.refKinds ?? []).join('/')} ids`;
      break;
    default:
      type = 'text';
  }
  return `${key} (${type})`;
}

/** One line per list: `signals (signal): id (text), type (main|...), ...`. */
export function languageReference(): string {
  const lines: string[] = [];
  for (const { key, kind } of LISTS) {
    const def = getKind(kind);
    if (!def) continue;
    const computed = new Set(COMPUTED_FIELDS[kind] ?? []);
    const fields = def.fields.filter((f) => !computed.has(f.key)).map((f) => fieldText(kind, f));
    const extra = Object.keys(EXTRA_ATTRS[kind] ?? {}).filter((k) => !fields.some((f) => f.startsWith(`${k} `)));
    const states = (['state', 'aspect'] as const)
      .map((k) => {
        const values = stateValuesFor(kind, k);
        return values && values.length > 0 ? `${k} (${values.join('|')})` : null;
      })
      .filter((x): x is string => !!x);
    lines.push(`- ${key} (${def.label.toLowerCase()}): ${[...fields, ...extra, ...states].join(', ')}`);
  }
  return lines.join('\n');
}

const RULES = `You are the drawing assistant of Railway Drawer, a draw.io-compatible editor for railway and ERTMS/ETCS schematic diagrams. The user describes what the drawing should show; you build it with the tools, which act on the user's active diagram tab and show up on the canvas immediately.

Railway conventions of this app:
- Positions are kilometre chainages (km, e.g. 12.345 or "12+345"). Nominal direction = increasing km = left to right; reverse = right to left. Signals stand on the right-hand side of their direction of travel.
- Tracks run horizontally; lane 0 is the first row, lane 1 below, -1 above. Points (switches/turnouts, IDs W1, W2...) connect a track to a diverging track; hand left|right.
- Signal types: main, shunting, markerBoard (ETCS Level 2/3 block marker), etcsStopMarker. ETCS: balise groups carry NID_C (country, 0-1023) and NID_BG; RBCs carry NID_RBC; trains have an ETCS level.
- IDs follow railway practice: tracks T1, points W1, signals S1 (marker boards MB1), balise groups BG1, axle counters AC1, joints J1, sections TC1/TS1, routes R1.

How to work:
- For railway layouts (tracks, points, signals, balises, detection, sections, level crossings, trains, routes) write a Railway Script and call apply_railway_script. It replaces the tab's whole script and redraws only what the script owns, in one undo step. Start with get_drawing to see the current script (or the one generated from the drawing) and edit that, so existing work is kept. Always send the complete script.
- If apply_railway_script returns errors (line:col), fix the script and try again; nothing was changed.
- Use add_shapes only for things the Railway Script cannot express (notes, boxes, legends, interlocking or RBC block diagrams, arrows). Use search_shapes to find draw.io shapes.
- Runtime situations (occupied sections, signal aspects, points positions, set routes) are states: the script keys state/aspect/position, or the set_states and routes tools.
- After a larger change you may call export_drawing with format png to look at the result, and check_drawing to find data problems.
- Keep replies short: say what you drew or changed and anything you could not do. Ask only when the request is genuinely ambiguous; otherwise make sensible railway choices (realistic spacings: signals several hundred metres apart, points near the station ends).`;

let cached: string | null = null;

/** The full system prompt (stable text). */
export function buildSystemPrompt(): string {
  if (cached) return cached;
  const nested = TRACK_NESTED_LISTS.join(', ');
  const onTrack = [...ON_TRACK_KINDS].join(', ');
  const examples = SCRIPT_TEMPLATES.map((t) => `### ${t.title}\n\`\`\`yaml\n${t.text.replace(/^# yaml-language-server.*\n/, '').trim()}\n\`\`\``).join('\n\n');
  cached = `${RULES}

## Railway Script (railwayScript: 1)
YAML (or JSON) document, JSON Schema ${SCHEMA_ID}. Top level: railwayScript: 1 (required), name (diagram name), page (scale: drawing units per metre, default 0.5; laneSpacing default 80; origin {x, y}), and lists of objects. Every object has an id unique per kind (case-insensitive). Objects on a track (${onTrack}) have track (track id) and at (km); they may also be written inside a track item in its lists (${nested}), then the track is implied. Tracks: startKm/endKm (km), lane, kind main|siding, bufferStops [start, end]. Points: at (km on its track), to (diverging track; its nearer end starts at the points), hand. Sections: from/to (km or the id of an axle counter / joint on the track) or startKm/endKm. Balise groups: balises: count or list. Routes: from/to signal ids, via { W1: reverse } for required points positions, overlap; the path, sections and length are computed. Any object may have x/y (centre, drawing units) to override the layout. Unknown keys are warnings.

Keys per list (catalogue fields; km = number or "12+345"):
${languageReference()}

Examples:

${examples}`;
  return cached;
}

/** Ids of every catalogue kind (tests compare them with tool-defs AI_KIND_IDS). */
export function catalogueKindIds(): string[] {
  return KINDS.map((k) => k.id);
}
