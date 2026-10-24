# ETCS balise data (`src/railway/etcs`)

Per balise group: the telegram header and a list of ETCS packets with their variables, edited in the
"ETCS data" editor, partly computed from the drawing, checked, exported. Reference: UNISIG SUBSET-026
v3.6.0 (Baseline 3 Release 2) chapter 7 (variables) and chapter 8 (packets); the packets used here have
the same layout in 3.7.0. Telegram capacity: SUBSET-036 (long telegram 830 / short 210 user bits).
**Nothing here is a vendored copy of the specification**: sizes and codes come from the specification
as we know it; the entries in "Uncertain details" below must be checked against the project's edition.

## Data model (`etcs-schema.ts`, `etcs-data.ts`)

- **Storage**: JSON in the attribute `rdEtcs` of the balise group cell (draw.io `<object>` data, so
  `.drawio` files, the autosave cache, share links keep it; it is not a catalogue field, so the Data panel
  shows a button instead of the JSON). The railML export writes it as `v_rdEtcs` on the group's
  `rd:object` (railML 3.2 has no packet content); the import puts it back (byte-stable round trip).

```json
{"v":1,
 "header":{"Q_UPDOWN":1,"M_VERSION":33,"Q_MEDIA":0,"M_DUP":0,"M_MCOUNT":"all","Q_LINK":1},
 "balises":[{"pig":1,"M_DUP":2}],
 "packets":[{"nid":5,"vars":{"Q_DIR":1,"Q_SCALE":1,"D_LINK":1200,"Q_NEWCOUNTRY":0,"NID_BG":12,
   "Q_LINKORIENTATION":1,"Q_LINKREACTION":1,"Q_LOCACC":5,"links":[{"D_LINK":800,"...":"..."}]},
   "auto":["D_LINK","NID_BG","links.0.D_LINK"],"pig":[0]}]}
```

- **Header** (50 bits, `HEADER_VARS`): Q_UPDOWN 1, M_VERSION 7, Q_MEDIA 1, N_PIG 3, N_TOTAL 3, M_DUP 2,
  M_MCOUNT 8, NID_C 10, NID_BG 14, Q_LINK 1. Stored: Q_UPDOWN, M_VERSION, Q_MEDIA, M_DUP, M_MCOUNT, Q_LINK
  (`balises[]` overrides M_DUP / M_MCOUNT per balise). **From the drawing, never stored**: NID_C (group's
  `rdNidC`, else the diagram default `rdCountryId`, 510), NID_BG (`rdNidBg`), N_TOTAL (max of the group's
  count, its balises, their highest position; minus 1), N_PIG = position − 1 per balise.
- **Packets** (`PACKETS`): 5 Linking, 12 Level 1 MA, 21 Gradient profile, 27 International SSP, 41 Level
  transition order, 44 Data for national applications, 46 Conditional level transition order, 65 TSR,
  66 TSR revocation, 72 Plain text, 79 Geographical position, 132 Danger for shunting, 136 Infill
  location reference, 137 Stop if in SR, 255 End of information (added to every telegram, never stored).
  Each packet starts with NID_PACKET 8, Q_DIR 2 (0 reverse, 1 nominal, 2 both — relative to the group's
  nominal direction = increasing N_PIG), L_PACKET 13 (computed), Q_SCALE 2 where the packet has distances.
  Layouts are item lists: variables (`{v}`; `key` when a name repeats, packet 72 `*_END`), iterations
  (`{iter}`: N_ITER 5 bits + entries under the key, e.g. `links`, `steps`, `diff`, `levels`) and
  conditional blocks (`{if, in}`, e.g. NID_C only when Q_NEWCOUNTRY = 1).
- **Values are physical**: distances in metres (encoded with Q_SCALE 0/1/2 = 10 cm / 1 m / 10 m, 15 bits,
  `toRaw` / `fromRaw`), speeds km/h (5 km/h steps, encoded rounded down), times s, gradients ‰; enums
  and integers as their code; special codes as keywords (`T_*: "inf"` = 1023, `V_STATIC / G_A: "end"`,
  `D_LEVELTR: "now"`, `M_MCOUNT: "all"` 255 / `"never"` 254, `NID_TSR: "nonrevocable"` 255,
  `V_RELEASE*: "national"` / `"onboard"`); X_TEXT a Latin-1 string (L_TEXT = its length);
  XUSER_DATA hex digits.
- **Validation** (`validateEtcsData`, also the rule `etcs-packet-invalid`): required variables, number
  syntax, integer, ranges, enum codes, distances that do not fit 15 bits at the packet's Q_SCALE (error:
  "use a larger Q_SCALE"), rounding to the Q_SCALE / 5 km/h step (warning), N_ITER: more than 31 entries,
  or an explicit `N_ITER` / `<key>_N_ITER` in the JSON that differs from the entries (error), unknown keys
  (warning), packet 255 in the list (warning), unknown packets, N_PIG of `pig` / `balises` outside the
  group, L_PACKET > 8191, telegram of a balise over 830 bits, duplicate packet + Q_DIR (warning),
  NID_C / NID_BG unknown.
- **Encoding** (`encodePacket`, `buildTelegrams`): fields in transmission order; per balise header +
  its packets (`pig` empty = all balises) + 255; bits and the user data as hex (before the SUBSET-036
  shaping/scrambling, not modelled).

## Computed values (`etcs-compute.ts`: groups and walks, used by the checks; `etcs-recompute.ts`: packet values + merge, lazy)

- **Group frame**: location reference = the balise with the lowest position (N_PIG 0), else the group
  symbol; orientation = from the positions of two balises (same piece: along the piece; else x / y),
  else the group `direction`, else the common direction of its balises. Packet direction → travel: Q_DIR 1
  = along the orientation; 0 = against it (nominal = left to right, railway-tools.md).
- **Walk** (`scanAhead`): from the location reference along the drawn topology (topology.ts) in the
  travel direction; **facing points: normal leg** (route-dependent data — switchable groups — is edited
  by hand; the note names the points); metres from the pieces' scale (track `length` or km start/end),
  else from the km of both objects on the same track; otherwise no value + note "no metres". Stops at
  the **second main signal** reading for the travel (`lookAhead`), or the track end / 200 000 units.
- **Packet 5**: the balise groups ahead (location reference hits) up to that stop, linked ones only
  (Q_LINK default 1), at most 8: D_LINK incremental (first from this group), NID_BG, Q_NEWCOUNTRY +
  NID_C when the NID_C differs, Q_LINKORIENTATION = 1 when the train passes the group along its
  orientation. With hand-set linking entries the stored NID_BG list is followed instead (up to 32 groups
  ahead), so differences are reported per entry.
- **Packet 12**: L_ENDSECTION = distance to the end of authority − the stored sections. EoA = the first
  main signal ahead, or the next one after it when the first is within the group distance of
  `bg-signal-distance` (max, default 50 m: the group is that signal's group).
- **Packet 21**: gradient from `rdGradient` (catalogue field "Gradient" [‰] on tracks / sections): a number
  for the whole piece, or `km:value` steps (`12.000:+3.5; 12+450:-2`, km on tracks with km start/end); sign
  = rising in the nominal direction (left to right). Section value before track value. Travel against
  nominal flips the sign. G_A rounded to the safe side (uphill down, downhill up); the last element is
  `G_A: "end"` at the end of the walk or where the data ends.
- **Packet 27**: V_STATIC from `rdSpeedLimit` (catalogue field "Speed limit" [km/h] on tracks, sections,
  points) or `rdVmax`: points leg, else section, else track; rounded down to 5 km/h; the last element
  `V_STATIC: "end"`. Q_FRONT 0, no train-category speeds.
- **Q_SCALE**: when a computed distance does not fit 15 bits, the packet's Q_SCALE is raised (note).
  Distances are rounded to the Q_SCALE resolution.
- **Recompute** (`recomputeGroup`, "Recompute from drawing"): every computed variable that is empty or
  marked `auto` (filled before and not edited since) takes the drawing's value and is marked; hand-set
  values stay and differences are listed (distances: more than the tolerance of the rule
  `etcs-linking-distance`, default 5 m) with "Use" in the editor. An iteration without hand-set values is
  replaced as a whole; schema defaults of a new packet count as unset.
- **Limits**: one path per direction (normal points); no route / switch-position dependent linking or
  MA; no train-category or axle-load SSP; gradients without a profile line symbol (the ERTMS "Gradient"
  symbols are decoration); MA sections, timers, danger point and overlap are not derived; packet 41/44/46/65/
  66/72/79/132/136/137 are manual.

## Editor (`etcs-dialog.ts`, lazy, `etcs-dialog.css`)

- Opened by Railway > ETCS Data… (`etcsData` command), the context menu "ETCS Data..." (only shown for a
  balise group or a balise) and the Data panel button "ETCS data…" of a single balise group
  (`data-testid="data-etcs-button"`, summary "2 packets: 5, 27"). All emit `railway-etcs-request`;
  `install-railway-data.ts` finds the selected group (or the group of a selected balise) and lazy-loads
  the dialog. Modal = `core/modal.ts` `openModal` on the route dialog classes (`data-testid="etcs-dialog"`).
- Tab "Header & packets": header fields, packet list (`.rd-etcs-packet-item[data-nid]`, Add with
  `.rd-etcs-add-select` + `.rd-etcs-add`, ↑ ↓ Remove), the packet form generated from the schema (inputs
  `[data-path="links.0.D_LINK"]`, enums as selects, units, ranges / special keywords as placeholder,
  help EN + PL from `etcs-help.ts`, "check spec" on uncertain variables, iterations with + Add / Remove,
  N_ITER shown, the balises (N_PIG) carrying the packet, L_PACKET). Badge "from drawing" on `auto` values;
  `.rd-etcs-mismatch` "drawing: …" + Use. Live validation list (`.rd-etcs-problems`), invalid inputs
  `aria-invalid`. Tab "Telegrams per balise": M_DUP / M_MCOUNT per balise, packets with bits, total of
  830, hex. Buttons: Recompute from drawing, Export JSON (`<group>-etcs.json`), Cancel, Save (refused
  with `.rd-etcs-error` while there are errors; one undoable edit).

## Checks (rule settings, [rules.md](rules.md))

`etcs-linking-missing`, `etcs-linking-distance` (tolerance 5 m), `etcs-no-packets`,
`etcs-duplicate-nid-bg` (error), `etcs-packet-direction`, `etcs-tsr-revocation`, `etcs-packet-invalid`
(error), in `etcs-checks.ts`, run by `checkRules`. A drawing without any `rdEtcs` is only checked for
duplicate NID_BG.

## Exports (`etcs-export.ts`, lazy) and other surfaces

- File > Export > Railway Data: **Balise ETCS data (CSV)** = the "Balise data" table (one row per group /
  packet / variable: group, NID_C, NID_BG, km, track, packet no., NID_PACKET, name, Q_DIR, balises,
  iteration, variable, value, unit, encoded, bits, source drawing / manual / derived / header);
  **(.xlsx)** = sheets "Balise groups" (summary: orientation, balises, Q_LINK, M_VERSION, packets, bits
  per balise, fits 830, errors, warnings) + "Balise data"; **(JSON)** = `{format: "railway-drawer-etcs",
  version, diagram, defaultNidC, groups: [{id, nidC, nidBg, km, track, balises, orientation, data}]}`;
  **Balise telegram report (HTML)** = printable report (header, packets with values / encoded / help,
  telegrams in hex; print to PDF).
- AI tools ([ai.md](ai.md)): `get_balise_data`, `set_balise_packets` (JSON schema + `validateEtcsData`),
  `recompute_balise_data`.
- Railway Script: optional `etcs` key on balise groups (the JSON object above), `rdEtcs` on the cell.

## Uncertain details (check against the project's SUBSET-026 edition)

- M_VERSION codes 16/17/32/33 for 1.0/1.1/2.0/2.1.
- M_LEVELTR / M_LEVELTEXTDISPLAY codes (0 L0, 1 NTC, 2 L1, 3 L2, 4 L3; 5 = no level limitation).
- Packet 44: NID_NTC after NID_XUSER = 102 and the free data length (L_PACKET minus the fields).
- Packet 72: Q_CONFTEXTDISPLAY / Q_TEXTREPORT (+ NID_TEXTMESSAGE, NID_C, NID_RBC) as in the 3.x layout.
- Special codes: V_RELEASE* 126 national / 127 on-board, D_TEXTDISPLAY / L_TEXTDISPLAY 32767,
  M_POSITION 1048575, M_MCOUNT 254 / 255.
- Telegram capacity 830 / 210 user bits (SUBSET-036).
- Default Q_LOCACC 5 m and Q_LINKREACTION 1 (service brake) are placeholders, not project values.

Tests: `src/railway/etcs/__tests__/etcs-data.test.ts` (schema, validation, Q_SCALE, encoding, D_LINK both
directions, orientation, NID_C change, L_ENDSECTION, SSP, gradient, recompute, every check, `.drawio` and
railML round trips), `tests/e2e/etcs-data.spec.ts`, the theme-contrast audit of the editor.
