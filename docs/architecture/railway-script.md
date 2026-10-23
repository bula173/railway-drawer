# Railway Script

- Language: YAML or JSON, `railwayScript: 1`, km based (nominal = increasing km = left to right); lists `tracks` (with
  `startKm/endKm`, aliases `kmStart/kmEnd`, metres `start/end/StartPos/EndPos`, `lane`, `kind`, `bufferStops`, nested lists),
  `points` (`at`, `to`, `hand`), `signals`, `baliseGroups` (`balises`: count or list), `balises`, `axleCounters`, `sections`
  (`from`/`to` km or detection point IDs), `levelCrossings`, `bufferStops`, `leus`, `rbcs`, `trains`, `routes` (`from`, `to`,
  `via`, `overlap`); catalogue field names are keys, `x`/`y` override positions; unknown keys = warnings (kept).
  `language.ts` (lists, aliases, EXTRA_ATTRS `rdTrackKind/rdLane/rdPointsType/rdDivergingTrack`, train `rdTrackId/rdKm/rdDirection`).
  Runtime states: optional `state` / `aspect` keys (`STATE_KEYS` -> rdState/rdAspect, enums from `STATE_SCHEME` per kind,
  `stateValuesFor`), points `position` = catalogue field; the script is the source (missing = default): `apply.ts`
  `stateChangeFor` -> `applyObjectStates` (look) in the same edit only where the effective state differs; `sync.ts`
  writes/unsets the keys on canvas state changes; `generate.ts` writes non-default states.
- Schema: `schema.ts` builds the draft-07 JSON Schema; `public/schemas/railway-script-1.schema.json` must equal it (test;
  `UPDATE_RS_SCHEMA=1 npx vitest run src/railway-script/__tests__/schema-storage.test.ts` rewrites it). `validate.ts` is a
  small validator interpreting that schema (agreement with ajv is tested: devDependency `ajv` 8.20.0 pinned, test-only,
  strict mode with `allowUnionTypes` + the `x-expected` annotation keyword); `model.ts` = semantic checks.
- Text -> drawing: `parse.ts` (npm `yaml` 2.9.1, eemeli/yaml, ISC; positions -> `line:col`), `layout.ts` (x from km with
  `page.scale`, y from lanes; auto lanes from points hand (toe rule, `legSide`); legs to the diverging track's nearer end), `build.ts` (cells with
  `src/railway/schematic.ts` = `ModelBuilder`/`Symbols`/fallback styles moved out of the railML import and shared; routes via
  `findRoutePaths`); generated top cells carry `rdScript="<kind>:<id>"` + `rdScriptShape`. `apply.ts` reconciles into the tab
  in ONE undoable edit (inside `withSnapSuspended`, snap.ts): remove gone, add new (generated order), replace on another
  `rdScriptShape` or adoption (unmarked object with the same kind+ID), else geometry + owned data (label/style/user attrs
  kept); unchanged text = no edit.
- Drawing -> text: `session.ts` (one `ScriptSession` per tab with a script; created by `install-railway-script.ts` for tabs
  whose store has text, so it works without the panel) listens to model CHANGE: ignored while applying; RootChange (load)
  = take drawing as synced; undo/redo of an apply edit (UndoableEdit remembered from the model UNDO event) = text before/after
  it; otherwise debounced `sync.ts`: diff against the snapshot of matched cells (moves -> `at`/`track` or `x`/`y`, tracks ->
  `lane`/`y`/`x`, Data edits -> keys, deletes (+ routes of a deleted signal), new palette objects on script tracks and Route
  tool routes -> appended). `editText` splices changed scalars into the original text (byte-exact elsewhere), structural edits
  re-print via the yaml Document (comments kept); JSON stays JSON. Only while the text is in sync (= last applied/synced text);
  else `conflict` (banner: Apply script / Use drawing).
- Storage: `tab.document.railwayScript` (a project section, `railway-script/project-section.ts`; `RailwayScriptStore`, `script-store.ts`, main chunk) -> main page `<diagram
  rdRailwayScript>` (draw.io keeps it; `\n` as `&#xa;`, tabs -> 2 spaces), share links (`pageAttributes`), cache
  `tabs[].railwayScript`, remote dirty tracking subscribes to it.
- UI (`script-ui.ts` + `railway-script.css`, lazy chunk with yaml): editor (textarea + `pre` highlight backdrop with `mark`s +
  line-number gutter), problems list (`[data-testid=railway-script-problems] li[data-severity]`, click selects the range),
  Apply (Ctrl/Cmd+Enter), Auto-apply (localStorage `rd.railwayScript.autoApply`, default on, 500 ms, only without errors),
  Examples (`templates.ts`), From drawing (`generate.ts`). File > Import > Railway Script… (`importRailwayScript`, new tab) /
  Export Railway Script… (`exportRailwayScript`, dialog `railway-script-export-dialog`, `.rdl.yaml`/`.rdl.json`) -> window
  event `railway-script-request`. `LeftPanelTabs.onTabSwitch` creates the panel on first show.
- Tests: `src/railway-script/__tests__/` (language/positions/aliases/templates, apply/sync/undo/conflict/generate round
  trips, schema vs file vs ajv, storage), `tests/e2e/railway-script.spec.ts`.
