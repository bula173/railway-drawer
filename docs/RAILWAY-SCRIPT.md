# Railway Script

A text language for railway / ERTMS schematic layouts. You describe tracks, points, signals,
balises, train detection, routes and trains by **km position**; Railway Drawer draws the layout
with the ERTMS library symbols and keeps text and drawing in sync **both ways**.

- Syntax: **YAML** (comments allowed) or **JSON** (JSON is valid YAML).
- Files: `*.rdl.yaml` / `*.rdl.json` (File > Import > Railway Script… / File > Export > Railway Script…; the editor tab: Railway > Railway Script Editor).
- Schema: [`public/schemas/railway-script-1.schema.json`](../public/schemas/railway-script-1.schema.json)
  (JSON Schema draft-07, `$id` `https://railwaydrawer.mksystemdesign.org/schemas/railway-script-1.schema.json`).
- Version key: `railwayScript: 1` (required).
- Direction convention (project convention): **nominal = increasing km = left to right**; reverse
  is the opposite. A "Signal Right" symbol is a nominal signal.

## A first example

```yaml
# yaml-language-server: $schema=https://railwaydrawer.mksystemdesign.org/schemas/railway-script-1.schema.json
railwayScript: 1
name: Station with two points
tracks:
  - id: T1
    name: Main track
    startKm: 0.000
    endKm: 1.600
    points:
      - { id: W1, at: 0.400, to: T2, hand: right }
      - { id: W2, at: 1.200, to: T2, hand: left }
    signals:
      - { id: S1, at: 0.200, direction: nominal, type: main, aspects: 3 }
      - { id: S4, at: 1.000, direction: nominal, type: main }
  - id: T2
    kind: siding
    startKm: 0.400
    endKm: 1.200
    signals:
      - { id: S3, at: 1.000, direction: nominal, type: shunting }
routes:
  - { id: R1, from: S1, to: S4 }                    # path computed (W1 normal)
  - { id: R2, from: S1, to: S3, via: { W1: reverse } }
```

The same as JSON:

```json
{ "railwayScript": 1, "tracks": [ { "id": "T1", "StartPos": 0, "EndPos": 1000 } ] }
```

The Railway Script tab has three more examples (**Examples…**): *Simple line*, *Station with two
points*, *ETCS Level 2 block* (marker boards, balise groups, axle counter sections, RBC, train).

## Document

| Key | Meaning |
|---|---|
| `railwayScript` | `1` (required) |
| `name` | diagram name (tab / project name on import) |
| `page` | layout options: `scale` (drawing units per metre, default `0.5`), `laneSpacing` (default `80`), `origin: { x, y }` (where the smallest km of lane 0 is drawn, default `40, 80`) |
| `tracks`, `points`, `signals`, `baliseGroups`, `balises`, `axleCounters`, `joints`, `sections`, `levelCrossings`, `bufferStops`, `leus`, `rbcs`, `trains`, `routes` | lists of objects |

Every object has an `id` (unique per kind, case-insensitive). Objects on a track have `track`
(track ID) and `at` (km). Objects can also be written **inside a track item** (`tracks[].signals`,
`.points`, `.balises`, `.baliseGroups`, `.axleCounters`, `.joints`, `.sections`, `.levelCrossings`,
`.bufferStops`, `.leus`, `.trains`): the track is then implied.

**km values** are numbers (`12.345`) or chainage text (`"12+345"`). Metres are only used by the
`start`/`end`/`StartPos`/`EndPos` aliases of tracks.

**Layout overrides**: any object may have `x` and `y` (centre of the object; for a track: its
first point / its line, in drawing units). They are written by the drawing → text sync when you move
an object away from its track.

**Unknown keys** are reported as warnings (with line:column) and kept; they do nothing.

### Kinds

Every railway object kind of the catalogue (`src/railway/catalogue.ts`) maps; the generated cells
carry the same `rd*` attributes as objects inserted from the palette, so the Data and Checks panels,
snap to track, the Route tool, route tables and the railML export work on generated drawings.
Catalogue field names are accepted as keys (e.g. `nidC`, `nidBg`, `aspects`, `notes`), plus these
script keys:

| List | Kind | Keys (besides the catalogue fields) |
|---|---|---|
| `tracks` | track | `startKm`/`kmStart`, `endKm`/`kmEnd` or `start`/`end`/`StartPos`/`EndPos` (metres); `lane` (row: 0, 1 below, -1 above; automatic when omitted), `kind: main\|siding`, `bufferStops: [start, end]` (IDs `BS-<track>-start/end`) or `[{ id, at: start\|end\|km }]`, nested lists |
| `points` | points | `track`, `at`, `to` (diverging track; its nearer end starts at the points), `hand: left\|right` (read from the toe: looking from the toe towards the frog, leg to the left = left; derived from the drawing when omitted), `position`, `type` (free text) |
| `signals` | signal | `track`, `at`, `direction: nominal\|reverse`, `type` (= `signalType`: `main`, `shunting`, `markerBoard`, `etcsStopMarker`), `aspects` (1–6); `routes` is computed |
| `baliseGroups` | baliseGroup | `track`, `at`, `direction`, `nidC`, `nidBg`, `function`, `leu`, `balises`: a count (`2` → balises `<group>-1`, `<group>-2`) or a list of IDs / `{ id, at, direction }`; optional `etcs`: the group's ETCS telegram data `{ header, packets: [{ nid, vars, pig? }] }` (docs/architecture/etcs-data.md) |
| `balises` | balise | `track`, `at`, `group` (= `groupId`), `position`, `direction` |
| `axleCounters` | axleCounter | `track`, `at`; `sections` is filled from the sections that start/end at it |
| `joints` | insulatedJoint (track circuit joint, the ERTMS "TC" marker) | `track`, `at`; `sections` is filled from the sections that start/end at it |
| `sections` | trackSection | `track`, `from`/`to` (km or the ID of a detection point on the track), or `startKm`/`endKm`; `type` (= `sectionType`: `tc`, `axleCounter`) |
| `levelCrossings` | levelCrossing | `track`, `at`, `protection` |
| `bufferStops` | bufferStop | `track`, `at` (km, `start` or `end`) |
| `leus` | leu | `track`, `at` |
| `rbcs` | rbc | `nidC`, `nidRbc` (drawn in a row below the layout unless `x`/`y`) |
| `trains` | train | `track`, `at` (front), `direction`, `length`, `etcsLevel`, `maxSpeed`, `rbc` |
| `routes` | route | `from`/`to` (= `entrySignal`/`exitSignal`), `via: { W1: reverse }` or `"W1:reverse, W2:normal"` (required points positions; the path is computed with the route search, `src/railway/routes.ts`), `overlap`, `sections` (optional; computed); `length` is computed |

### Runtime states (scenarios in text)

Optional keys describe the runtime state of an object (docs/STATES.md), so a scenario can be written
as text:

| Key | Objects | Values (default first) |
|---|---|---|
| `state` | tracks, sections, points, routes | `free`, `occupied`, `reserved`, `overlap`, `locked`, `disturbed` |
| `state` | level crossings | `open`, `closed`, `disturbed` |
| `state` | balise groups' balises, LEUs, axle counters, joints | `free`, `disturbed` |
| `aspect` | signals (not marker boards / ETCS stop markers) | `stop`, `proceed`, `caution`, `shunt`, `dark` |
| `position` | points (the catalogue field) | `normal`, `reverse`, `moving`, `outOfControl` |

```yaml
sections:
  - { id: TC1, track: T1, from: 0.000, to: 0.300, state: occupied }
signals:
  - { id: S1, track: T1, at: 0.100, aspect: proceed }
tracks:
  - id: T1
    points:
      - { id: W1, at: 0.300, to: T2, hand: right, position: reverse }
```

The script is the source: a missing key is the default (as drawn). Applying sets the state **and
its look** (colours, lamps, faded legs; `applyObjectStates`, same undo step); objects whose state
already matches are not touched (applying twice changes nothing). An unknown value is an error, a
key on an object without that state a warning (ignored). Drawing -> text: a state set on the canvas
(context menu, Railway menu, Data panel, Alt shortcuts, route commands) writes the key; back to the
default removes it. "Generate from drawing" writes the non-default states.

### Layout rules

- x from km: `x = origin.x + (km − smallest km) × 1000 × scale`; y from the lane:
  `y = origin.y + lane × laneSpacing`.
- Lanes not given: the first track is lane 0; a track reached through points goes one lane
  **below** for a right-hand points in the direction of the leg (above for left-hand), like the
  railML import's generated layout. The hand is read from the toe: the hand is read from the **toe**: standing at the switch toe (blade tips) and looking towards the frog, a diverging leg to the left = `left`, to the right = `right` (on screen: toe on the left and leg going up = left, leg going down = right; toe on the right: leg going down = left); e.g. points
  at km 0.4 with the diverging track further on (toe on the left) and `hand: left` draw that track
  one lane above. Lanes that are taken (overlapping x) are skipped.
- A points leg runs from the points' km on its track to the nearer end of the diverging track;
  that end is moved so the leg is at least one lane spacing long (45°).
- Signals and LEUs sit beside the track on the right-hand side of their direction (nominal below a
  left-to-right track, reverse above), balises / axle counters / buffer stops centred, trains above.
- Symbols: ERTMS library (`public/libraries/ertms.xml`): Track, Point Right (legs), Signal Right
  3/4, Signal Left 3, Single Balise Right / Balise Left, Train; the railML import's fallback shapes
  for the rest; marker boards / ETCS stop markers as small blue / yellow boards.
- Routes are edges on the Routes layer (`rd-routes`), like the Route tool makes them.

## Validation and errors

Errors and warnings show in the Railway Script tab with `line:column` (click to jump) and are
underlined in the text; line numbers of problem lines are coloured.

1. YAML syntax (duplicate keys included).
2. The JSON Schema (types, enums, ranges such as NID_C 0–1023, required keys, km format).
3. Semantic checks: duplicate IDs, unknown tracks / signals / points / detection points, km outside
   the track (warning: drawn at the track end), track start = end, points onto their own track or the
   same lane, routes without a path (warning: drawn as a straight line).

**A script with errors is never applied**: the drawing stays as it is.

## Two-way sync

- **Text → drawing (Apply)**: the Apply button, Ctrl/Cmd+Enter, or Auto-apply (500 ms after
  typing, only when there are no errors). Generated cells carry `rdScript="<kind>:<id>"` (and
  `rdScriptShape`). An apply touches only them: new objects are added, removed ones deleted, a
  changed symbol is replaced, the rest is moved / gets its new data. Your own cells stay. One apply
  = **one undo step**; applying unchanged text changes nothing. A railway object without
  `rdScript` whose kind and ID match a script object (e.g. inserted from the palette) is adopted
  (replaced by the generated cell; its own extra attributes are kept). The label and the style of a
  generated cell you edited are kept (until its symbol changes).
- **Drawing → text**: after each drawing edit (debounced) the script is updated through the YAML
  document API, so comments stay; values of existing keys are replaced in place (the rest of the
  text is byte for byte unchanged), new keys / deleted or appended items re-print the YAML
  (comments kept, spacing normalized). JSON scripts stay JSON.
  - move an object along / onto a track → `at` (km of the position, metres; the snap's `rdKm`), and
    `track`; move it away from every track → `x`/`y`;
  - move a track → `lane` (when it lands on the lane grid) or `y`, sideways → `x`;
  - Data panel edits → the matching keys (`km` → `at`, `signalType` → `type`, …);
  - delete → the item is removed (a deleted signal also removes the routes from/to it);
  - a railway object inserted from the palette onto a script track, a new route made with the
    Route tool between script signals → appended to its list (`{ id, track, at, … }`).
  - Undo/redo of an apply restores the text of before/after it.
- **Conflict rule**: the drawing is only written into the text while the text is *in sync* (no
  unapplied edits, no errors). When you edit the drawing while the text has unapplied edits, the
  text is not touched and a banner offers **Apply script** (the drawing follows the text, your
  drawing edit is replaced) or **Use drawing** (the text edits are discarded, then the drawing edit
  is written).
- **Limits**: points legs, section lines and route paths are derived (moving them changes nothing
  in the text; a new track or points must be added in the text); balises of a group given by a count
  and buffer stops given as `start`/`end` are derived too (move/delete them in the text); formatting
  of re-printed YAML is normalized; "Generate from drawing" redraws the objects in the schematic
  layout on the next Apply (positions are expressed as km, not kept as x/y).

## Generate from drawing

The tab's **From drawing** button (and File > Export > Railway Script… on a diagram without a
script) writes a script for the railway objects of the drawing: tracks (km start/end; else
km from their length or drawing length), `page.scale` / lanes / origin from the drawing, points legs
(the track they leave, `at`, `to`), objects on tracks by `rdTrackId`/`rdKm` (else the nearest
track), balise groups with their balises, sections lying on tracks, RBCs, trains, routes with their
points positions. Objects that cannot be expressed are listed in a notification.

## Storage

The script is saved with the tab: in the `.drawio` file as the main page's `<diagram
rdRailwayScript="…">` attribute (draw.io keeps unknown `<diagram>` attributes, as for
`rdScenarios`; newlines as `&#xa;`, tabs become two spaces), in share links (`#R…`), with cloud
saves, and in the browser cache (`tabs[].railwayScript`). The drawing itself is ordinary draw.io
content.

## Editor support

Add the schema to the file for completion and validation in editors with the YAML language server
(VS Code "YAML"):

```yaml
# yaml-language-server: $schema=https://railwaydrawer.mksystemdesign.org/schemas/railway-script-1.schema.json
```

or `"$schema": "…/railway-script-1.schema.json"` in JSON. The app serves the file at
`<app>/schemas/railway-script-1.schema.json`.

## Implementation

`src/railway-script/`: `language.ts` (lists, key aliases), `schema.ts` (the JSON Schema; the public
file is kept equal by a test), `validate.ts` (draft-07 subset validator interpreting that schema),
`parse.ts` (eemeli/yaml `yaml` 2.9.1, positions), `model.ts` (normalized model + semantic checks),
`layout.ts`, `build.ts` (cells via `src/railway/schematic.ts`, shared with the railML import),
`apply.ts` (reconcile into the tab, one undo step), `sync.ts` (drawing → text), `generate.ts`,
`session.ts` (per tab: apply / sync / undo / conflicts), `script-ui.ts` + `railway-script.css`
(panel, import/export; lazy chunk with the YAML parser), `script-store.ts` and
`install-railway-script.ts` (main chunk). Tests: `src/railway-script/__tests__/`,
`tests/e2e/railway-script.spec.ts`.
