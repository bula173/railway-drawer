# Templates

- Built-in **ERTMS templates**: `splitErtmsLibrary` (`ertms-templates.ts`) classifies `public/libraries/ertms.xml`
  by content: more than `TEMPLATE_CELL_THRESHOLD` (80) drawable cells (`mxCell` vertex/edge, nested included)
  = template (scenarios have 102..265, the simple elements 1..44). 37 entries -> 18 elements / 19 templates
  (tested against the real file). Display names from the labels (`templateDisplayName`: first matching ERTMS topic in
  `TOPICS`, e.g. "Level transition L0 → L1", "Section timer (L1)" + the ETCS level label; repeats numbered "… 2"),
  `originalName` "ERTMS scenario <n>" (library order) in the tooltip and search; subtitle = the 3 rarest
  labels across scenarios (phrases before ids); every label is a search tag. Ids `ertms-tpl-<library index>`.
  `ertmsPaletteSource` (Shapes and ERTMS tabs) filters to the elements, entry ids keep the library index
  (`ertms-<index>-<slug>`); `loadErtmsTemplates` shares the one download. `drawio-compat.test.ts` parses the
  whole library (all 37 entries) as the draw.io compatibility guard.
- App library vs the user's export: scenarios 14, 15 and 18 of `ERTMSDrawioTemplate/ERTMS.xml` ("On-sight
  acknowledgement area (L2)", "On-sight movement authority (L1)", "PCA window and berth (L2)") were removed on the
  user's request; `REMOVED_ERTMS_SCENARIOS` keeps the original numbers in `originalName` (scenario 16 stays
  "ERTMS scenario 16"). Template ids `ertms-tpl-<library index>` follow the app file.
- Signal labels in the app library are `S<n>` (the user's `KBS<n>` labels were renamed in the app copy only); drawings
  opened from files keep whatever labels they have (no migration of user files).
- **The app library is generated**: `python3 -I scripts/ertms-library/build_app_library.py ../ERTMSDrawioTemplate/ERTMS.xml
  public/libraries/ertms.xml` (deterministic; untouched entries keep their bytes; see the script's docstring for every
  rule). Never hand-edit `public/libraries/ertms.xml`; change the script and rebuild. It removes scenarios 14/15/18,
  renames KBS -> S, and stores railway data as draw.io `<object>`/`<UserObject>` attributes (railML needs):
  palette elements = the title presets (`kindForLibraryTitle`, no ID: generated on insert); templates: signals
  (group with heads 229/231: type main / shunting for `SS<n>`, direction nominal when the mast is left of the lamps,
  aspects = lamps, ID from the label), balises (12x12 triangles within 40 of a track; direction west = reverse;
  group/position from a `BG<n>` label within 40, which becomes the `baliseGroup` with NID_BG n and count; a balise
  without a BG label becomes its own group (count 1, next free BG<n>, NID_BG n, `infill` for `*_infill`) on its function
  label within 25 (LTA/LTO/S2_BG/S4_infill in the two "Level transition L1 → L2" templates; not grouped by distance:
  LTA and S4_infill are 26 px apart but different groups); no NID_C (diagram default)), trains,
  tracks (all `vsdxID=17` stroke >= 4 horizontal edges on one y merged into one `track` T<n> edge; extra grey edges
  removed; coloured MA/route highlight edges stay decoration on top), points (diagonal track edges, hand from the leg read from the toe
  (`hand_from_geometry`): falling to the right = right, rising = left; short legs extended onto the track) and TVD sections: `trackSection` TC<n> edges with the track's style on
  top of the track (below the highlights), split at the TC joint markers on it (fallback: points legs, then
  signals, else one section), `rdTrackId`, `rdSectionType=tc`. TC joint markers on a track (centre within 8 of the line)
  = `insulatedJoint` J<n> with `rdTrackId` + `rdSections` (sections starting/ending within 15: railML
  `hasDemarcatingTraindetector`); markers off the tracks, labels, arrows, highlights: no kind.
  Sections drawn ON the track = topology.ts "sections on tracks" (names the pieces, not separate links), so routes,
  snap and the railML export (tracks + `tvdSection`s) work; recolouring a section = its own edge's strokeColor.
  The library stores no `rdState`/`rdAspect` (state feature: defaults free/stop/normal). `insertTemplate` renumbers
  taken IDs keeping the prefix (`renumberInsertedObjects`, `src/railway/insert-ids.ts`; references follow) and
  suspends snap to track. Tests: `src/railway/__tests__/ertms-library-data.test.ts` (typed symbols, sections cover
  every track end to end, unique IDs, double insert, routes found, railML export of every template: structure
  checks clean, no unplaced object, `tvdSection` count = sections, re-import keeps kinds/IDs).
- **User templates**: `TemplateStore` (`template-store.ts`), localStorage `railway-drawer-templates`,
  `{ version: 1, templates: [{ id, name, description?, xml, width, height, created, updated }] }`; `xml` is a
  native draw.io `<mxGraphModel>`. Bare arrays read as v1; a newer version makes the store read-only (writes
  throw, data untouched); a failed write (quota) rolls back and throws `TemplateStorageError` -> notification.
  Export/import as a draw.io library (`<mxlibrary>`, uncompressed `{xml,w,h,aspect,title,description}`; opens in
  draw.io's sidebar); import uses the engine's `parseMxLibrary` (compressed entries, image entries -> image cell).
- **Save as Template…**: File menu and canvas context menu (`data-action="saveAsTemplate"` -> `window`
  event `save-template-request` -> `boot/panels.ts`), and the tab's "Save…" button. `extractTemplate`
  (`template-extract.ts`): selected cells minus those with a selected ancestor (descendants come along) + unselected
  edges whose both terminals are inside; a selected edge to an outside cell is kept dangling; absolute
  coordinates, moved to (0,0), `rdLayerId` dropped, styles verbatim. Nothing selected = whole diagram (all
  layers flattened; a context-menu click on the empty canvas clears the selection, so it saves everything).
  Name dialog `promptTemplateDetails` (`template-dialogs.ts`, name required, Enter/Escape; a window capture
  keydown listener keeps keys away from the shortcut dispatcher while it is open).
- Panel (`templates-panel.ts`): search, "My templates" (Save…/Import…/Export…, empty-state hint, ✎/× on tiles)
  above "ERTMS templates"; tiles 200x120 thumbnails from the shared palette renderer (lazy, IntersectionObserver),
  one-line subtitle, hover = 480x300 preview (`.rd-tpl-preview`).
  Click -> popover: Insert into diagram (`insertTemplate` = `insertEntry` at the view centre, one undoable edit),
  Open as new diagram (`openTemplateAsNewDiagram`: `tabManager.createTab(name)` + `tab.document.load`,
  the tab is closed again if the load fails), Rename…/Delete… (user). Drag (`application/x-rd-template`) onto
  `#graph-container` inserts at the drop point.
- The left tab bar wraps (no cut labels at ~230px); tests in `src/ui/templates/__tests__/`.
