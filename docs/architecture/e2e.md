# E2E specs (tests/e2e)

- CI fails on flaky tests (`failOnFlakyTests` with CI set): the 2 retries only absorb infrastructure failures and a
  test that passes only on a retry fails the run. Production code has no `console.log`/`info`/`debug` (eslint
  `no-console` error, warn/error allowed): log through `src/drawio/logger.ts` (debug only in dev builds).
- All specs run on any port, headless and offline (`E2E_PORT`, default 3000). The chromium project uses
  `devices['Desktop Chrome']`.
- vitest includes `src/**/*.test.ts`; Playwright only runs `tests/e2e/*.spec.ts` (`testMatch`). `tsconfig.json` only covers `src`.
- `tests/e2e/legacy-smoke.spec.ts`: drop shape, Ctrl+Z/Ctrl+Y, reload keeps it; no editor switch in the top bar or
  the View menu; `?editor=drawio|legacy|main` opens the editor and drops `railway-drawer-editor-mode`; the former
  draw.io view's autosaved document (`railway-drawer-drawio-doc`) opens once as new tabs.
- `tests/e2e/drawio-compat.spec.ts`: File > Open of draw.io files (compressed multi-page fixture, draw.io desktop
  fixture) -> labels render -> File > Export As… writes a valid `<mxfile>` with the same pages, ids, cells, wrapper
  attributes and styles, hidden pages unchanged, stable re-export; Templates > Import… of the ERTMS library
  (37 entries) and Export… as `<mxlibrary>`.
- `tests/e2e/drawio-palette.spec.ts` (any port): Shapes tab (no draw.io/Stencils tabs) renders the palettes, one merged "General" (no "Basic" section/menu entry, flag migration, merged app shapes insert, search without duplicates), "More shapes…" toggles, inserts keep draw.io styles, autosave
  writes real draw.io shape names.
- `tests/e2e/share.spec.ts` (any port): Share dialog, `#R` link round trip into a fresh browser context, downloads.
  Provider sections: "Not configured — <reason>" (user text), admin steps (`availability.details`: VITE_* variables, app
  registrations) + `helpUrl` ("Setup guide") only in the collapsed "How to enable" disclosure (`share-provider-<id>-howto`);
  runtime settings (`share-provider-<id>-settings`) are collapsed by default.
- `tests/e2e/gitlab.spec.ts` (any port): GitLab "Not configured" -> runtime settings -> Open/Save + sign-in button,
  File-menu items without reload, `?gitlab=` link on an unconfigured browser. Requests to the fake GitLab URL are
  intercepted and must not happen.
- `tests/e2e/remote-persist.spec.ts` (any port): dev-only fake provider (below): open a "remote" file, edit (dirty dot),
  reload (beforeunload prompt accepted), binding restored unverified, Ctrl+S saves with the stored version; after a
  reload signed out + remote changed -> sign-in dialog -> conflict dialog; status-bar menu Reload (confirm), File >
  Unlink (also after reload); File > Open from disk unbinds.
- `tests/e2e/scenarios.spec.ts` (any port): new scenario, 3 steps, ←/→ presentation, Esc restores the live drawing and
  its undo history, rename/reorder (↓ and drag)/delete step, reload, File > Save pages "<Scenario> / <n>. <step>",
  reopen; replace drawing (confirm, Ctrl+Z).
- `tests/e2e/scenario-uml-text.spec.ts` (any port): step editor with PlantUML sequence + Markdown (live previews), 2 steps,
  view step 1 -> side panel UML svg + Markdown heading/list, Next -> step 2 content (drawing too), ← back, collapse kept
  over a reload, edit keeps the values, File > Save `.drawio` has `rdStepUml`/`rdStepText`, File > Export Scenario (HTML)
  has 2 drawings (data: SVG images), 2 UML SVGs and the Markdown. Fails if anything goes to a PlantUML server.
- `tests/e2e/scenario-doc.spec.ts` (any port): 3 steps that add/move/restyle/remove hexagons (graph via the service
  registry), "Show changes" (legend, data-diff-* counts, Changes list, highlight strokes in the view SVG, snapshots without
  `rdDiff`), autoplay (1 s, Space plays to the end and stops, Space pauses), File > Export Scenario (PDF)… landscape (%PDF,
  pages >= 4, DejaVu embedded, 3 images, no "UML as vector failed" warning), Slides from the panel button (3 step slides,
  highlighted drawings, opened as a data: page under its CSP: keys move, counter).
- `tests/e2e/templates.spec.ts` (any port): ERTMS palette 18 entries, Templates tab 19 ERTMS templates (search,
  insert, open as new diagram, drag), tab bar labels not cut, Save as Template… -> reload -> insert, rename, delete.
- `tests/e2e/ertms-data.spec.ts` (any port): ERTMS palette signal/balise get their kind and IDs on insert, Data panel
  fields (km chainage `12+345`, enum, text with Polish characters), duplicate signal ID -> Checks error + badge,
  click selects the cell, Edit -> fix clears it, Ctrl+Z/Ctrl+Y, File > Export > Railway Data > Signals (CSV: BOM, rows),
  reload keeps the data, File > Save writes `<object rdKind=... rdId=...>`.
- `tests/e2e/theme-contrast.spec.ts` (any port): light and dark theme (localStorage `rd.theme` with the opposite
  system preference emulated, and View > Dark Mode both ways): opens every surface (menus incl. Railway + File > Import / Export > Railway Data / Scenario submenus, toolbar, left tabs
  Shapes/Templates/Layers/PlantUML/ERTMS, Properties canvas/Text/Style/Arrange, Data, Checks, Scenarios, AI (settings, pairing), scenario
  dialog + step editor + view, context menu, Save as Template (with error), Share, Keyboard Shortcuts, About, Save As
  (with error), image upload,
  shape designer, all 4 notification types, status/tab bars; a second test per theme: context menu with the railway Position ▸ submenu open, Railway > Object State submenu,
  states legend, Route tool panel + Route
  Table/Interlocking dialog on a loaded layout, Train run panel + events list, scenario view with "Show changes" legend/Changes list and autoplay
  running, scenario PDF export options, fake-remote (`rd.fakeRemote`) Open dialog, status menu, Reload confirm; a third test
  per theme: Railway Script tab with an example made invalid (error + warning: problem list, gutter, inline marks), conflict
  banner and toolbar; the editor's text-transparent highlight mirror carries `data-contrast-skip` (its text is skipped only
  while fully transparent) and its `mark`s are checked instead: underline >= 3 on the editor and mark background, editor
  text >= 4.5 on the mark background) and requires WCAG contrast >= 4.5 (3 for large or
  symbol-only text; disabled exempt) between each visible text's color and its effective background (ancestors
  composited until opaque). Diagram content (tab graphs, thumbnails, SVG, canvas) is skipped. Offenders are listed as
  `theme: surface | selector | "text" | fg on bg = ratio`. Screenshots: `test-results/theme-contrast/<theme>-*.png`.
- `tests/e2e/dark-shapes.spec.ts` (any port): dark theme diagram content. Inserts an ERTMS signal, balise, track, point,
  train, a Text and a default Rectangle from the palette plus a `mxgraph.basic.star` with `strokeColor=#000000`, an
  inline `stencil(...)` whose own XML paints `#000000`, a dark-grey HTML label and blue text, and requires every
  rendered SVG stroke >= 3:1 and every label colour >= 4.5:1 against the canvas (#121212); the stored cell styles stay
  unchanged; selection border/handles and `feedbackColor('#0000FF')` >= 3:1. General + ERTMS + the three railway library thumbnails (strokes
  and text against the thumb's background) and the first template thumbnails (strokes) likewise; the Track thumbnail has
  the canvas's stroke; View > Dark Mode back to light re-renders thumbnails light. File > Export As (.drawio, minus
  `modified`/`etag`/`agent`/`version`) and the PNG export (decoded pixels, SHA-256) are identical in light and dark.
  Screenshots: `test-results/dark-shapes/*.png`.
- `tests/e2e/ertms-routes.spec.ts` (any port): loads a layout (T1, T2, points W1, S1-S3) with `tab.document.load`,
  Route tool (toolbar `#btn-route-tool`, clicks on signals) creates R1 (S1->S3, W1 reverse) and R2 (S1->S2, W1 normal),
  Railway > Route Table… rows + CSV/XLSX, Interlocking tab lists R1/R2, route edited in the Data panel, wrong points
  position -> `route-points` issue, Railway > Show Routes, ERTMS signal dropped near T1 snaps (side, rdTrackId, km),
  moved next to T2 re-snaps, Ctrl+Z/Ctrl+Y, Railway > Recalculate km, km ruler.
- `tests/e2e/railml.spec.ts` (any port): layout (T1/T2, W1, S1-S3, BG1 with B1/B2, AC1, route R1) loaded with
  `tab.document.load`; File > Export > railML 3.2… dialog (counts, checks, extension box) -> download parsed in the
  page (4 netElements, a None relation, signals, switch branchCourse, balise group, axle counter, route entry ->
  signalIL -> signalIS, facing switch); File > Import > railML 3.2… (file chooser, `station-topology.railml`) -> new active tab
  "Station Arnau", notes dialog, cells per kind, signal data incl. `rdRailmlId`, ERTMS group symbol, route on
  `rd-routes`; re-export keeps the preserved `operationalPoint`; File > Open of a `.railml` and a file drop on
  `#graph-container` (`station-visualization.railml`) open new tabs at the visualization coordinates.
- `tests/e2e/editor-commands.spec.ts` (any port): Arrange > Bring Forward / Send Backward (multi-selection, one undo
  step each) + To Front / To Back on the layer's child order and the SVG stacking, Edit > Select All and Ctrl+A (layer
  cells + descendants like draw.io; not while typing in the title field), File > Export > PNG/SVG in light and dark
  theme (PNG signature, white corner, the cell's own light fill; SVG parses, has the labels, `#dae8fc`, white
  background), `exportAsJson()` of the active tab, project rename in the top bar -> Export As… file name +
  `<diagram name>`, kept over a reload, Esc cancels.
- `tests/e2e/interaction.spec.ts` (any port, real `page.mouse` input): press+drag in the middle of a rectangle/ellipse moves
  it (one undo step, no edge), a multi-selection moves together, a connection starts from a connection point (A -> B),
  group: first click selects the group, second the child, a drag on a child moves the group; an edge moves by its body
  and reconnects by its end handle; ERTMS (Signal Right 3/Left 3, Single Balise Right, Train) and General palette shapes
  move when dragged by the middle (the signal's centre is a gap of its group); locked cell / cell on a locked layer:
  Arrange X/Y/W/H/rotation/flip disabled, late change events ignored; arrow keys nudge (1 px, Shift = grid, one undo
  step each, never locked cells, not while typing); right-click Lock/Unlock keeps the selection (single, multi, group via
  its child or a gap, edge); project name per tab (rename, switch, label = project name relabelled, export names,
  reload); File > Open of a file with old app layers (`rdLayerId`) -> 3 draw.io layers, unsaved, saved without rdLayerId.
- `tests/e2e/hover-arrows.spec.ts` (any port, real `page.mouse` input): hover shows 4 arrows just outside the shape
  (constant size at zoom 2), leaving / Escape / a pressed button hide them; click on the right arrow -> clone 80 to the
  right + edge, selected, one undo removes both (faded clone preview on arrow hover); a shape in the arrow's direction is
  connected instead (target preview), Cmd/Ctrl+click clones anyway; drag from an arrow onto B -> edge A->B, onto the blank
  canvas -> connected clone at the drop point (one undo step), an arrow lying on an edge is hidden; locked cell / locked
  layer: none; Alt hides; View > Connection Arrows off (persisted over a reload), Alt+Shift+A on; ERTMS Signal Right 3
  clone keeps kind/direction and gets `S2` (no duplicate-id check); a signal clone on a track snaps in the same undo
  step (`rdTrackId`, `rdKm`); no arrows on the track edge or with the Route tool; arrow fill >= 3:1 on the light and dark canvas.
- `tests/e2e/move-connect.spec.ts` (any port, real `page.mouse` input, 1600x1100 viewport): drags of a rectangle, an ERTMS
  signal (group), a balise, a track (edge) and a template text cell land where released (±1 px) with the grid off and on the
  grid with it on, at zoom 100 % and 150 %; Alt held while dragging ignores grid and track snap; a signal 60 px from a track
  stays, 8 px snaps beside it with the track highlighted during the drag (`.rd-track-snap-highlight`,
  `data-rd-track-snap` on the graph div); ArrowDown moves a snapped signal 1 px; a balise dropped on a track does not split
  it, nor goes into a signal; the dragged cell is the one under the pointer; connecting: 16 visible 'x' points on a
  rectangle, from a quarter point (fixed exit, floating entry, blue target), balise -> signal group, signal point ->
  rectangle, a new edge ends at the release point, an edge end dropped on a body connects floating, hover-arrow drag.
- `tests/e2e/press-to-move.spec.ts` (any port, real `page.mouse` input, 1600x1100): every kind of object (draw.io
  rectangle 40x20 / 120x60, ellipse, text, image, AWS icon, mxgraph.basic stencil, ERTMS signal group, balise, PKP semafor
  group, turnout, track, connector, template group) hovered, pressed over a grid incl. near edges/corners and dragged 30 px:
  each press moves it unless it is on a visible connection point (helper rule = `isOnSourcePoint`), at 100 % (small ones
  also 200 %); on a point of an unselected rectangle connects, 2 px inside / selected moves; background pans, Shift+drag
  rubber band; Shift+click toggles, Alt+click selects behind (cycling); a selected small symbol moves from its body (no
  resize); a signal in a track's hit halo moves itself; a turnout leg follows its track. Shared helper
  `tests/e2e/helpers/press-probe-lib.ts`; the full 5x5 grid at 100/200 % is `tests/e2e/helpers/press-probe.spec.ts`
  (`PRESS_PROBE=1 PRESS_PROBE_OUT=<file.md>`), drag smoothness `tests/e2e/helpers/drag-perf.spec.ts` (`DRAG_PERF=1`);
  both are skipped otherwise.
- `tests/e2e/canvas-scroll.spec.ts` (any port, real `page.mouse` / keyboard input, scrollbars shown: the spec drops
  Playwright's `--hide-scrollbars`): zoomed in, the tab graph div scrolls (not `#graph-container`) with 12 px scrollbars;
  wheel scrolls, Shift+wheel horizontally, Ctrl+wheel zooms keeping the point under the pointer (±3 px), zoom buttons /
  View menu / zoom select keep the view centre, Fit centres the content; content at negative coordinates is reachable and
  clickable (also at 400 %); grid lines (pixel checks) in all four far corners at 400 %, at 200 %, after enlarging the
  window and after Fit, scrollbar thumb/track pixels (light, dark); hover arrows and the km ruler stay on their shapes
  after zoom + scroll; the State Legend stays fixed above the scrollbar; dragging a shape / Shift+drag rubber band at the
  edge autoscrolls; a drag on the empty background pans (no selection change, nothing moves, also purely horizontal),
  Shift+drag rubber-bands, a click on the background clears the selection, a press on a shape still moves it;
  Space+drag and middle-drag pan; a tab keeps zoom and scroll across a tab switch.
- `tests/e2e/object-states.spec.ts` (any port, real right-clicks; layout with sections TC1-TC3, points W1, lamp-group
  signal S1, route R1 via `tab.document.load`): TC2 State ▸ Occupied -> rendered stroke red, File > Save has
  `rdState="occupied"` + `rdBaseStyle` + `strokeColor=#ff0000`, radio check, Reset State restores, one Ctrl+Z step each;
  S1 Aspect ▸ Proceed -> both lamps green (mast unchanged); W1 Position ▸ Normal (opacity 0.3) / Reverse; multi-selection
  (one undo); Data panel State select; route Set (sections/route green, W1 reverse, S1 proceed) / Railway > Object State >
  Occupy Route / Release (W1 back); State Legend; scenario "Show changes" lists `TC2: free → occupied` and `S2: aspect stop →
  proceed`; dark theme renders the state colours unchanged; Reset All States. Screenshots `test-results/object-states/`.
- `tests/e2e/train-run.spec.ts` (any port; layout TC1-TC4 200 m, S1-S3, R1/R2, train TR1 ETCS L2 72 km/h 100 m via
  `tab.document.load`): Railway > Train Run… (defaults from TR1, routes "R1, R2", 13 events), t = 0 reserved green /
  overlap / S1 proceed in the view graph, play at 10×: a MutationObserver log of `data-occupied` = '' → TC1 → TC1,TC2 →
  TC2 → TC2,TC3 → TC3 (times within 1 s), the train cell moves monotonically to S3, live model untouched while playing,
  end state, scrubber t = 17 s (TC1/TC2 rendered #ff0000, head 240 m), ⏭ / ←, Esc restores the exact XML with no undo
  step; selected route preselected, "Create scenario from run" -> Scenarios panel "6 steps" with names, ▶ Present
  shows text + UML (position report), saved project = drawing unchanged + 6 step pages; Keep final state = one Ctrl+Z.
  Screenshots `test-results/train-run/`.
- `tests/e2e/ai-scenarios.spec.ts` (any port, Anthropic API mocked with `page.route`, no key/network): "Przygotuj scenariusz
  wjazdu pociągu…" -> mocked list_templates / insert_template (newTab, "Level transition L1 → L2") / build_scenario (3 steps
  with states) / view_scenario -> friendly tool-log lines, new active tab, incremental step states, the scenario view steps
  1/3 -> 3/3, the Scenarios panel lists the steps; confirm mode: Discard of add_scenario_step removes the step and its states.
- `tests/e2e/ai.spec.ts` (any port, Anthropic API mocked with `page.route`, SSE from `src/ai/__tests__/sse.ts`, no key/network):
  AI panel key masked + only in localStorage `rd.ai.settings` (cache/other storage/requests never contain it), Remove; a typed
  request -> mocked tool calls (get_drawing, apply_railway_script, set_states) draw T1/S1/S2 -> "Undo AI turn" (2 steps);
  confirm mode card -> Discard undoes and the next request's tool_result says so; "Create pairing code" (URL `/mcp?pair=rdp1.…`,
  Claude Code command, kept over a reload in sessionStorage `rd.ai.pairing`, Disconnect); local bridge round trip
  (`tools/mcp-local/src/bridge-server.ts` started in the test process, panel connects, relayed apply draws, wrong secret refused).
- `tests/e2e/railway-script.spec.ts` (any port): Railway Script tab: a typed script (tracks, points, signals, route) is drawn
  by auto-apply ("Applied: 7 objects", `rdScript`, route on `rd-routes`), a text km edit moves the signal, a real mouse drag
  of the signal updates `at` in the text (comments/other lines kept), an enum error is listed at `13:col`, click selects it,
  the drawing stays unchanged, reload keeps the script ("In sync with the drawing"); File > Import > Railway Script… (new
  tab named after `name`), File > Export > Railway Script… (.rdl.yaml = the text, .rdl.json = the data, generated for a tab
  without a script).
- `tests/e2e/all-shapes.spec.ts` (any port): every draw.io library. More shapes… dialog (draw.io's categories, all
  libraries off, ⓘ trademark note on vendor sets, preview pane, filter) turns on UML, BPMN 2.0, AWS 2026; their
  sections render (vendored JS shapes + stencils, no thumbnail errors); Actor, Lambda, Actor Lifeline insert and the
  autosave holds their exact draw.io styles; the choice survives a reload. Search "actor"/"lambda"/"router" lists
  hidden libraries grouped by library (a result inserts, "Show library" adds it). User libraries: ＋ Add library > import
  file, insert + ＋ (add selection), drag a General tile onto it, ✎ rename, reload keeps it, ⤓ export = draw.io
  `<mxlibrary>` (escaped JSON body, 3 entries, style verbatim), × removes.
- `tests/e2e/railway-shapes.spec.ts` (any port): the railway library sections follow ERTMS (ERTMS/ETCS extra, Polish
  signalling (PKP PLK), Track layout; captioned, > 30 tiles each); "Semafor 3-komorowy prawy" inserts as signal S1
  (main, nominal, 3 aspects) and Railway > Object State > Proceed / Stop paints its 3 lamps; a second semafor gets S2;
  search "tarcza" (Polish tarcze) and "marker board" (the 4 ETCS marker boards); "Points 1:9 Left (toe left)" inserts T1
  + W1 (hand left) and File > Export railML 3.2… downloads a parseable file with one `switchIS`.
- `tests/e2e/ux-batch2b.spec.ts` (any port): ERTMS palette first + expanded, captions, EN/PL search in the ERTMS section (zwrotnica, semafor,
  balisa); palette click placement (cascade without overlap, next to the selected shape + edge, balise onto the selected
  track = its track reference, one undo each); scenario "▶ Present" + "⋯" menu (items, Esc, Duplicate, 24 px targets);
  start card (forced via `rd.startCard.force`: Esc, drop passes and dismisses, ERTMS action focuses the palette, "Don't
  show again"); template topic names + hover preview; 390 px `rd-narrow` banner (dismissible) and canvas width > 300.
- `tests/e2e/ux-batch3.spec.ts` (any port): double-click on a railway signal edits its ID in place (`rd-id-editor`; route
  entry follows, one undo step, duplicate refused with `aria-invalid`, Esc), Shift+double-click opens Data, plain shapes keep
  label editing, `user-select: none` on diagram labels; selection colours #0f8bd0 / #29b6f2 (never #00FF00); a template
  opened as a new diagram is at 150–200 %, inserted into a drawing it is one `.rd-multi-selection-box` without handlers and a
  drag moves every cell by the same delta; route tool guidance (2 `.rd-route-hl-target`, S4 `.rd-route-dim`, "no route in
  the signal direction", Esc cancels the start then leaves); one-click "+ Add step" (name field focused, Enter / Esc), row
  details (Markdown -> Text badge), Edit… dialog, step view of a zoomed + scrolled drawing shows the drawing; Arrange (Align,
  Distribute, Group/Ungroup, Rotate 90°, Flip, Lock/Unlock) / Edit (Duplicate, Select Vertices/Edges/None + keys) menus; Esc
  closes More shapes (selection kept), F1 not over Save As; no HTTP >= 400 on load; compact left tabs at 1440 px.
- `tests/e2e/ux-batch.spec.ts` (any port): menubar keyboard pattern (roles, ↓/↑/Home/End, ←/→ between menus, Enter, Esc
  returns focus) and `<kbd>` shortcut hints, Help > Keyboard Shortcuts (keys + mouse), Help > About = `#status-version`
  (package.json), Properties states none / canvas / cell incl. a transparent group selected by a click in its gap and the
  selection header ("Group", "2 shapes"), zoom select 100% at launch and after +/−/select/menu/fit, "+" and File > New open
  and show "Diagram <n>" (title in sync, no native dialog), context menu (13px, hints, Delete last after a separator, kept
  inside the window at the bottom-right), Save As (themed, focus trap, Esc, Enter downloads `<name>.drawio` and renames),
  Share dialog (one "Not configured", "How to enable" and provider settings collapsed), no start-up toast, "Saved in
  browser", Undo/Redo buttons disabled/enabled with the history.
- `tests/e2e/ux-batch2a.spec.ts` (any port): Railway menu (order of items, mouse, keyboard from File with →, End,
  Enter toggles km Ruler and the toolbar button follows; no railway items left in View/Extras, no emoji in the menus), File
  top level + Import / Export submenus (hover incl. nested Railway Data / Scenario, Download .drawio, keyboard → / ← / Enter /
  Esc with aria-expanded, Import > Image opens the upload dialog), toolbar (no emoji, every visible button has an SVG icon,
  aria-label, tooltip starting with it and >= 24 px, removed buttons and freehand tools gone, 6 groups, grid toggle =
  View > Grid, Align dropdown keyboard + Align top), side panels (toolbar / Ctrl+Shift+P / Ctrl+Shift+K / View menu, kept
  after reload, 8 px resize handle with hover line, drag + keyboard resize remembered, `body.rd-narrow` hides both and a
  toggle opens one), left tab strip (one row; at 1440 px all tabs fit as the compact strip; a 180 px panel puts the rest
  behind the » overflow menu with keyboard, chosen tab moves into the row, PlantUML closeable and reopened from Extras, a
  wide panel shows all tabs). e2e helpers in `tests/e2e/menu-helpers.ts`: `clickMenuItem`,
  `revealMenuItem`, `openLeftTab` (row or » menu), `leftTabLabels`.
- `tests/e2e/access-identity.spec.ts` (any port): top-bar Cloudflare Access user (`src/ui/access-identity.ts`; dev-only
  localStorage `rd.accessProbe` = '1' makes the localhost app ask): `/cdn-cgi/access/get-identity` routed to JSON ->
  email (ellipsis, tooltip) + "Log out" button before Share, icon-only below 900 px, click -> `/cdn-cgi/access/logout`;
  404 -> nothing shown, no app console errors; contrast (text 4.5, icons 3) of the element in light and dark.
- `tests/e2e/backlog-ui.spec.ts` (any port, real mouse / keyboard input): Align left / Distribute vertically on a
  rubber-band selection with a locked cell (locked one stays, one Ctrl+Z step each, Ctrl+Y); left tabs: no button in a
  button, PlantUML's "Close PlantUML tab" reached by Tab + Enter, Delete on the focused tab closes it (the selected shape
  stays), with a 180 px panel the » menu's "Close PlantUML" item (keyboard); 390 px: start card "Insert ERTMS symbols"
  opens the left panel for the session (`rd-panel-open-narrow`, stored state unchanged, hidden again after a reload);
  File > Open of a draw.io file with `grid="0" gridSize="20"` -> grid off (View > Grid / toolbar / `.rd-grid-on`), a new
  tab has its own grid, switching back, Download .drawio writes grid/gridSize back, toolbar toggle -> `grid="1"`, kept
  over a reload; palette click next to a selection: below when the east side is taken, Shift east, Ctrl/Cmd north,
  Ctrl/Cmd+Shift west, one undo each; tab label rename renames the matching project (title, export name), Save As
  relabels a tab named like the project, a label of its own stays (also over a reload).
- `tests/e2e/style-edit.spec.ts` (any port): line color/width/dash and fill through the Properties panel on cells from an
  ERTMS template, a user template and the draw.io/ERTMS palettes (group first click, child second click); checks the
  cell's own style and the SVG. Reads the graph via `import('/src/services/service-registry.ts')` (dev server only).
