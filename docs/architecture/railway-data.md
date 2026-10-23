# Railway object data

- **Storage** (`object-data.ts`): a railway object is a cell whose value is a draw.io `<object>` element (an existing
  `<UserObject>` keeps its name) with `rdKind` plus one attribute per property (`rdId`, `rdKm`, `rdNidBg`, ...:
  `rd` + PascalCase key). Files stay 1:1 draw.io (attributes show in draw.io's Edit Data). Plain cells keep string
  values; removing the kind turns a value with only a `label` back into a string. "Show ID in label" writes
  `%rdId%` + `placeholders="1"` (rendered by `drawio-shapes/engine/placeholders.ts`, so `graph.getLabel` shows the ID
  and `convertValueToString` the raw `%rdId%`). Writes: `setRailwayData(model, cells, change, {autoId})` = one
  `model.setValue` per cell inside one update (one undo step, values cloned, never mutated); no-op edits add no history.
  Stored numbers are canonical (`12+345` / `12,345` -> `12.345`); unparseable input is stored as typed and reported.
- **Catalogue** (`catalogue.ts`): 14 kinds (signal, balise, baliseGroup, track, trackSection, points, levelCrossing,
  bufferStop, rbc, leu, axleCounter, insulatedJoint, train, route; insulatedJoint = the TC joint marker, ID `J<n>`,
  `sections` it separates), fields typed text/number/integer/km/enum/ref/refList with
  unit/min/max (NID_C 0–1023, NID_BG/NID_RBC 0–16383, balises in group 1–8, aspects 1–6); route fields see
  "Railway engineering tools" below. Every kind has `id`
  (required, generated `S1`, `BG1`, ... from `idPrefix`, case-insensitive unique per kind).
- **Pre-assigned kinds**: the ERTMS library entries store them (generated, see Templates); on insert also by title (`kindForLibraryTitle`: Signal Left/Right n -> signal with
  direction reverse/nominal and n aspects, (Single) Balise Left/Right -> balise, TC -> insulatedJoint (the tile is the 10x12 joint marker; sections are lines on the track), Track ->
  track, Point Left/Right -> points (hand NOT from the title: from the leg geometry, `handOfLegCell` in
  `prepareRailwayInsert`; the user's "Point Left" leg falls to the right = right-hand, "Point Right" = left-hand;
  titles kept), Train/Train Connected -> train; MA/Distance/Line/Gradient/SSP: none)
  through the palette option `prepareInsert` -> `insertEntry(..., prepare)` (same undo step, only single-cell
  entries, only `ertms-*` entries, not draw.io palettes); app railway shapes by style shape (`kindForStyle`, drop
  handler in `boot/canvas.ts`). Templates/paste keep the data they carry.
- **Diagram settings** (`project-settings.ts`): root cell (id 0) attribute `rdCountryId` = default NID_C of the
  diagram (missing = `DEFAULT_COUNTRY_ID` 510, Poland; invalid = no default); balise groups without NID_C use it
  (`applyProjectDefaults` in `validateModel` and the railML export -> `countryID`; the drawing is not changed). Edited
  in the Data panel with nothing selected ("Diagram railway settings", `#rd-rw-country`, one undo step); a balise
  group's empty NID_C field shows it as placeholder. Library templates do not pin NID_C (they follow the diagram).
  `rdRuleSettings` on the same root cell: the rule checks' settings ([rules.md](rules.md)).
- **Checks** (`validation.ts`, model only, `geometry.ts` for absolute positions): duplicate-id, required (ID error,
  NID_C/NID_BG warning; NID_C only when the diagram has no usable default), invalid-value, unknown-kind, balise-without-group (error), group-count / group-position
  (warning), missing-reference (error), signal-off-track (warning: centre > `SIGNAL_TRACK_DISTANCE` 40 px from its
  track, or from every track when it names none and tracks/sections/points exist), km-order (warning: majority
  direction of km along the track polyline, needs >= 3 objects), km-outside-track (warning).
- **UI** (`install-railway-data.ts`, called from `boot/features.ts` after `installScenarios`): right-panel switch is
  generic now (`installRightPanelSwitch`: buttons' `aria-controls` name the panels, `right-panel-view` bus event):
  Properties | Data | Checks | Scenarios. `data-panel.ts`: kind select (+ none), fields (enum select, ref inputs with a
  datalist of IDs, problems from the last check under the field), multi-select edits common fields ("(mixed)", ID
  disabled). Edits go to the cells the fields were rendered for (a field's blur `change` fires after a canvas click
  already changed the selection). `checks-panel.ts`: Run checks, Live (debounced 400 ms on model changes; localStorage
  `rd.railway.liveChecks`), badge on the switch, issue click selects the cell, "Edit" opens Data on the field, report
  buttons. Global listeners bound to the active tab's selection/data model (rebound on `tab-changed`/`tab-closed`).
  Menu commands emit bus events: `railway-edit-data-request` (Railway > Edit Data…, context menu Edit Data...),
  `railway-checks-request` (Railway > Run Checks, toolbar `#btn-railway-checks`), `railway-export-request` (File > Export > Railway Data submenu,
  `data-action="exportRailway:<report>"`: the `exportRailway:` command).
- **Reports** (`report.ts`, `xlsx.ts`): signals, balises + groups, tracks + sections, points, all objects; sorted by km
  (`km`, else `kmStart`; none last), then kind order, then natural ID order. CSV = UTF-8 BOM, CRLF, RFC 4180 quoting,
  formula injection guarded (`'` prefix unless numeric). `.xlsx` = dependency-free stored ZIP (CRC32) with one sheet
  per report (inline strings, numbers as numbers, bold frozen header).
- Tests: `src/railway/__tests__/` (catalogue + real ERTMS library mapping, object data round trip/undo/insert,
  every rule, CSV/xlsx, panels with real tabs).
