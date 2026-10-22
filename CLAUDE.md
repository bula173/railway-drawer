# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Railway Drawer: vanilla TypeScript + Vite web app for railway (ERTMS/ETCS) diagrams. No framework, no React.

**Decision: one editor.** The **Railway Drawer editor** (maxGraph, `@maxgraph/core` 0.10) is the product: all
railway features (data, routes, checks, scenarios, sharing) live there. UI text says "Railway Drawer editor"
(never "legacy"/"maxGraph editor").

**The embedded draw.io mode (diagrams.net iframe, "draw.io compatibility view", self-hosted draw.io under
`<app>/drawio/`) was removed on the user's decision.** draw.io compatibility now means the **file format and the
shapes**: native `<mxfile>`/`<mxGraphModel>` read/write (`src/services/drawio-xml.ts`), `.drawio` open/save/import/
export, `#R` share links (also as app.diagrams.net links), the stencil engine and the draw.io palettes/shapes
(`src/drawio-shapes`, `src/ui/drawio-palette`, `scripts/drawio-palettes`, `public/stencils`), the ERTMS library
(`public/libraries/ertms.xml`) and templates. Never weaken that path. **The guard is
`src/services/__tests__/drawio-compat.test.ts`** (fixtures in draw.io's own file format plus the real ERTMS
draw.io library: load -> save round trip must be semantically lossless and the output valid draw.io XML; see
"draw.io compatibility guard" below). Old `?editor=drawio|legacy|main` links still open the
app (the parameter is ignored).

## Commands

Node version: `.nvmrc` (24).

```bash
npm run dev                 # Vite dev server on http://localhost:3000 (host: true, so also on the LAN)
npm run build               # tsc (typecheck) + vite build --base ./  -> dist/ (relative base: same build works at / and /railway-drawer/)
npm run preview             # serve dist/
npm run typecheck           # tsc --noEmit (src, excluding __tests__)
npm run typecheck:tests     # tsc --noEmit -p tsconfig.test.json (src/**/__tests__)
npm run typecheck:e2e       # tsc --noEmit -p tsconfig.e2e.json (tests/e2e + playwright.config.ts)
npm run lint                # eslint src (no-explicit-any is a warning; errors must stay at 0)
npm test                    # vitest watch (jsdom)
npm run test:run            # vitest once
npx vitest run src/__tests__/ui/tab-cache-restore.test.ts   # single file
npx vitest run -t "restores"                                 # tests by name
npm run test:e2e            # Playwright, chromium, starts vite itself (E2E_PORT, default 3000)
npm run drawio:palettes     # regenerate palettes + stencil sets from the pinned draw.io tag (Node >= 22.18)
npm run typecheck:worker    # tsc for worker/ (workers-types) and tools/mcp-local (node)
npm run build:mcp-local     # local stdio MCP server -> tools/mcp-local/dist/railway-drawer-mcp.mjs (docs/AI.md)
npx wrangler deploy --dry-run --outdir <tmp>   # validate the Worker bundle (needs dist/); never deploy from here
node scripts/railml/validate.ts [--xsd railml3.xsd] [files]  # dev only: xmllint against the railML 3.2 XSD (not vendored)
```

CI (`.github/workflows/build-and-deploy.yml`) runs typecheck, typecheck:tests, typecheck:worker, lint (src, worker,
tools/mcp-local/src), test:run, build, `wrangler deploy --dry-run` and the
Playwright subset (legacy-smoke, drawio-palette, templates, scenarios, style-edit, share, gitlab, ertms-data,
scenario-uml-text, theme-contrast, remote-persist, scenario-doc, editor-commands, dark-shapes, ertms-routes, railml, drawio-compat,
interaction, hover-arrows, railway-script, ux-batch, ux-batch2a, ux-batch2b, move-connect, object-states, canvas-scroll,
railway-shapes, backlog-ui, ai). No
draw.io download is needed (`scripts/drawio-palettes` only runs locally, its output is committed). It does not deploy.

### E2E

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
  Table/Interlocking dialog on a loaded layout, scenario view with "Show changes" legend/Changes list and autoplay
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
- `tests/e2e/ertms-routes.spec.ts` (any port): loads a layout (T1, T2, points W1, S1-S3) with `saveLoadController.load`,
  Route tool (toolbar `#btn-route-tool`, clicks on signals) creates R1 (S1->S3, W1 reverse) and R2 (S1->S2, W1 normal),
  Railway > Route Table… rows + CSV/XLSX, Interlocking tab lists R1/R2, route edited in the Data panel, wrong points
  position -> `route-points` issue, Railway > Show Routes, ERTMS signal dropped near T1 snaps (side, rdTrackId, km),
  moved next to T2 re-snaps, Ctrl+Z/Ctrl+Y, Railway > Recalculate km, km ruler.
- `tests/e2e/railml.spec.ts` (any port): layout (T1/T2, W1, S1-S3, BG1 with B1/B2, AC1, route R1) loaded with
  `saveLoadController.load`; File > Export > railML 3.2… dialog (counts, checks, extension box) -> download parsed in the
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
  signal S1, route R1 via `saveLoadController.load`): TC2 State ▸ Occupied -> rendered stroke red, File > Save has
  `rdState="occupied"` + `rdBaseStyle` + `strokeColor=#ff0000`, radio check, Reset State restores, one Ctrl+Z step each;
  S1 Aspect ▸ Proceed -> both lamps green (mast unchanged); W1 Position ▸ Normal (opacity 0.3) / Reverse; multi-selection
  (one undo); Data panel State select; route Set (sections/route green, W1 reverse, S1 proceed) / Railway > Object State >
  Occupy Route / Release (W1 back); State Legend; scenario "Show changes" lists `TC2: free → occupied` and `S2: aspect stop →
  proceed`; dark theme renders the state colours unchanged; Reset All States. Screenshots `test-results/object-states/`.
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
  search "tarcza" (Polish tarcze) and "marker board" (the 4 ETCS marker boards); "Turnout 1:9 Left (toe left)" inserts T1
  + W1 (hand left) and File > Export railML 3.2… downloads a parseable file with one `switchIS`.
- `tests/e2e/ux-batch2b.spec.ts` (any port): ERTMS palette first + expanded, captions, EN/PL search in the ERTMS section (zwrotnica, semafor,
  balisa); palette click placement (cascade without overlap, next to the selected shape + edge, balise onto the selected
  track = its track reference, one undo each); scenario "▶ Present" + "⋯" menu (items, Esc, Duplicate, 24 px targets);
  start card (forced via `rd.startCard.force`: Esc, drop passes and dismisses, ERTMS action focuses the palette, "Don't
  show again"); template topic names + hover preview; 390 px `rd-narrow` banner (dismissible) and canvas width > 300.
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
  toggle opens one), left tab strip (one row, » overflow menu with keyboard, chosen tab moves into the row, PlantUML closeable
  and reopened from Extras, a wide panel shows all tabs). e2e helpers in `tests/e2e/menu-helpers.ts`: `clickMenuItem`,
  `revealMenuItem`, `openLeftTab` (row or » menu), `leftTabLabels`.
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

## Architecture

### Boot

- `index.html` is the static shell of the editor (`#app-container`: top bar, menus, toolbar,
  panels, `#graph-container`, `#tabs-container`). Controllers bind to these ids.
- `src/main.ts`: sign-in answer pages (GitLab / Entra redirect) only run their auth bridge; otherwise it drops the
  remembered mode of the removed editor switch (`clearRetiredEditorMode()`, `src/services/retired-drawio-mode.ts`)
  and dynamically imports `main-editor.ts` (so auth-bridge loads never download maxGraph). `?editor=` is ignored.
- The removed draw.io view had its own autosave (`railway-drawer-drawio-doc`, `{xml,title,savedAt}`):
  `install-sharing.ts` opens it once as new tabs after the `#R` link handling (`openDiagramFile` in
  `share/share-open.ts`, blank pages skipped), then removes the key.
- `src/main-editor.ts` (formerly `legacy-main.ts`) is the whole main-editor boot: `registerDrawioCodecs()` first (before any file or cache
  load), shapes, `TabManager`, cache restore, the global keyboard dispatcher, drop handler, left panel,
  Shapes tab (shape toolbar + draw.io palettes), shape designer. `beforeunload` flushes the cache; the tabs are destroyed
  on `pagehide` (not persisted), because beforeunload can be cancelled (unsaved remote changes prompt).
- Rarely used features are separate chunks loaded with `import()` on first use: the shape designer
  (`ui/shape-designer.ts`, opened from Extras > Design Custom Shapes… = `open-shape-designer` / `edit-custom-shape`), the
  route tables dialog (`railway/route-tables-dialog.ts`), the XLSX writer (`railway/xlsx.ts`), scenario PDF/slides
  export (`jspdf`, `svg2pdf.js`), GitLab/SharePoint loaders, the draw.io palette JSON, railML import/export
  (`railml/railml-ui.ts` with export/import/structure) and the local PlantUML sequence renderer
  (`services/plantuml-sequence-svg.ts`, imported by `scenarios/step-uml.ts` on the first rendering). Keep new heavy,
  user-triggered UI lazy the same way. Build chunks (vite.config.ts `manualChunks`): `maxgraph` (@maxgraph/core,
  ~542 kB), `drawio-shapes` (`src/drawio-shapes/js`, ~228 kB, self-contained: only maxGraph imports, so no chunk cycle;
  preloaded in parallel with `main-editor`, ~700 kB, was ~941 kB); `chunkSizeWarningLimit` 800 (reason in the config).
- Dead code: modules not reachable from `src/main.ts` (and not test-only helpers) are deleted, not kept "for later";
  the old hand-written shape classes (`src/shapes/{uml,bpmn,cloud,...}`), `src/store`, `src/contexts`,
  `src/types`, the color picker/palette controllers etc. were removed in the cleanup.
  The Pencil/Brush/Eraser/Line freehand tools (`src/ui/drawing.ts`, a raster canvas overlay whose strokes were never
  saved, undone or exported) and their toolbar buttons were removed too; draw shapes/lines with the palette or toolbar.

### Theming (light / dark app chrome)

- One token set: `src/styles/variables.css` (imported by `style.css`; `drawio/workspace.ts` imports it too). Semantic
  colors are `--rd-*` (`--rd-bg`, `--rd-surface`/`-2`/`-3`, `--rd-hover`, `--rd-active`, `--rd-text`, `--rd-text-muted`,
  `--rd-text-subtle`, `--rd-border`, `--rd-border-strong`, `--rd-accent`(+`-hover`, `-text`), `--rd-link`, `--rd-focus`,
  `--rd-selected`, `--rd-input-bg/-text/-border`, `--rd-button-bg/-text`, `--rd-danger`/`-solid`/`-bg`, `--rd-success*`,
  `--rd-warning*`, `--rd-info*`, `--rd-hint-*`, `--rd-badge-*`, `--rd-scenario-*`, `--rd-route-*` (route tool orange),
  `--rd-danger-hover`, `--rd-dirty`, `--rd-surface-overlay`, `--rd-shadow`, `--rd-overlay`, `--rd-backdrop`,
  `--rd-scrollbar*`, `--rd-canvas-bg`). Light values on `:root`, dark on `:root[data-theme="dark"]`,
  each with `color-scheme`. The older names (`--background`, `--surface`, `--text`, `--text-secondary`, `--border`,
  `--rd-chrome-*`) are aliases of them. Never key chrome colors off `prefers-color-scheme`: `<html data-theme>`
  (index.html before first paint, then `src/drawio-shapes/theme/dark-mode.ts`) already resolves the stored choice
  (`rd.theme`) against the system.
- **Never hard-code a chrome color** (CSS, `style=""` in index.html, `element.style.*`/`cssText`/innerHTML in TS): use
  `var(--rd-...)` or a class. A literal color is only right in one theme (the old bug: dark backgrounds with the light
  theme's `#333` text). No per-component `:root[data-theme="dark"] .x { color: #... }` overrides either: if a component
  needs a new color, add a token with a light and a dark value. Text tokens meet WCAG AA (4.5:1) on the surfaces;
  `theme-contrast.spec.ts` enforces it.
- Shared classes in `style.css`: `.rd-input`, `.rd-btn` (`.rd-btn-on`, `.rd-btn-locked`), `.rd-btn-solid` +
  `.rd-btn-primary/-danger`, `.rd-field-label`, `.rd-field-caption`, `.rd-section`, `.rd-caret`, `.rd-sep`, `.rd-strong`,
  `.rd-tip`, `.context-menu(-item)`, `.prop-tab(.active)`, `.collapsible-header`. Dialogs built in TS with `cssText`
  use `var(--rd-...)` in those strings. Unstyled
  inputs/selects/textareas get `--rd-input-*` from a zero-specificity `:where()` rule.
- Not chrome (keep their own colors): diagram cells (dark rendering = `graph-compat.ts` `setDrawioDarkMode`), palette /
  template / step thumbnails, PlantUML SVGs (white background like PlantUML), the exported scenario HTML (light).
- Dark rendering of diagrams (render-time only; cell styles, saved files and image/PDF/slide exports stay light):
  `colors.ts` `adaptiveDarkColor` inverts only neutral colours (chroma < `KEEP_CHROMA` 0.3: black -> #ededed,
  white -> #121212, greys, draw.io's pale fills) like draw.io's `getInverseColor`; saturated colours (signal red / green /
  yellow, track colours) are kept. `light-dark(a, b)` takes `b`, except a saturated `a` with a hue-less `b` (the ERTMS
  library's stale `light-dark(#e00000, #5f5f5f)`) keeps `a`. Then `graph-compat.ts` `applyDarkContrast` floors the
  resolved style: strokes / label borders >= 4.5:1 on the canvas (so >= 3:1 on the palette surface too), font >= 7:1 on
  the canvas or >= 4.5:1 on the cell's opaque fill / label background (the light font colour wins when it reads better
  there, e.g. white on a kept red fill). HTML label text colours get the same floor (`resolveHtmlLabelColors(..., text)`),
  stencil-own colours (`<strokecolor color=...>`, node defaults) adapt in `stencil-fixes.ts` `stencilColor`, and maxGraph's
  fixed blue drop-target / connected-edge-handle feedback is lightened in dark mode (`handle-colors.ts`). Thumbnails are
  cached per colour mode (`drawioColorModeKey`) and the palette / Templates / Scenarios panels re-render them on
  `onDrawioColorModeChange`. Images (`image=` / data-URI SVGs) are not recoloured.
- Canvas: tab graph divs get `--rd-canvas-bg` (#fff / draw.io's #121212); the grid is a transparent SVG tile from
  `src/ui/grid-background.ts` (`applyGridBackground`, used by `GridController` and `CanvasProperties`): both tiles
  (#e0e0e0 / draw.io dark #424242) are custom properties on the container and CSS picks one by `data-theme`, so a
  theme switch needs no listener and inactive tabs follow. The grid follows the zoom (cells doubled while < 5 px) and
  starts at the graph origin (`setGridView`, fed by canvas-scroll.ts; one background tile holds several cells, >= 256 px,
  sized in 1/64 px, so the browser's tiling from the scroll origin does not drift off the graph grid); `background-attachment: local` makes it cover the
  whole scrollable area. Canvas scrollbars: `--rd-canvas-scrollbar-thumb/-hover/-track` (thumb >= 3:1 on the track),
  12 px `::-webkit-scrollbar` on `.rd-graph-canvas` (`scrollbar-color: auto` there, else Chromium ignores them).
- Scrolling canvas (`src/ui/canvas-scroll.ts`, draw.io's infinite canvas, page view off): each tab graph div
  (`.rd-graph-canvas`) is the scroll container, `#graph-container` is overflow hidden, so maxGraph's own scrolling
  (scrollCellToVisible, autoscroll while dragging, PanningHandler) works. `graph.sizeDidChange` keeps the content's
  400-unit tiles (`SCROLL_TILE`) plus padding (visible size - 34 px) on every side scrollable and sets `view.translate`
  itself (content at negative coordinates reachable), compensating the scroll so nothing moves on screen: never rely on
  `view.translate` being 0 or set it yourself (it is reset); convert with
  `(scrollLeft + px) / scale - translate.x`. `graph.zoom` / `zoomTo` / `zoomIn` / `zoomOut` keep the view centre
  (10-500 %), `zoomActual` and `fit` centre the content, Ctrl/Cmd+wheel and pinch zoom around the pointer
  (`zoomCanvasAt`); a plain `graph.zoomTo(s)` (center false, maxGraph's default) keeps the view's top-left corner, the
  zoom select uses `zoomTo(s, true)`; Shift+wheel scrolls horizontally, a plain wheel scrolls natively. `resetCanvasScroll` after
  `SaveLoadController.load` (origin at the top-left, or the content's top-left when it reaches into negative
  coordinates); a hidden tab gets its scroll position back when shown (ResizeObserver). Arrow-key nudges scroll the
  selection into view. Pan (`src/ui/pan.ts`, PanningHandler plugin): a left drag on the EMPTY background pans like a map
  (grab / grabbing cursor; `isPanningTrigger`: no cell state, no modifier; a press on a shape, edge, handle or a group's
  gap still selects / moves; a click without a move still clears the selection; a pan never ends in a click);
  Shift+drag (Alt+drag forced, Ctrl/Cmd+drag) on the background = rubber band; Space+drag (also over shapes) and
  middle-drag pan via the force-panning path; right-drag stays the context menu. Overlays positioned in view coordinates as absolute children of
  the graph div (hover arrows, previews) or in the overlay pane (`GraphOverlay`: km ruler, route tool) scroll with it;
  fixed-position editors subtract `scrollLeft/Top`.

### Main editor (Railway Drawer editor, maxGraph)

- `src/ui/tabs.ts` `TabManager`: each tab owns its own `Graph` (a div inside `#graph-container`) and its own
  full set of controllers (properties, menu, toolbar, clipboard, save/load, layers, zoom, ...).
  **Listener capture rule:** controllers are constructed inside `captureSharedListeners()`, which patches
  `EventTarget.prototype.addEventListener` and records every listener bound outside the tab's graph div
  (shared DOM, `document`, `window`). Only the active tab's recorded listeners are attached; switching tabs
  detaches/reattaches them; closing removes them. Consequences for a new controller:
  - bind shared-DOM/document listeners in its constructor (so they are captured), or
  - if it binds later (dialog open, edit start), scope the listener itself: remove it when the
    dialog/edit ends and in `destroy()` (see `DuplicateOffsetController`, `TextEditorController`).
  - `once` listeners are not recorded. Listeners added in `main-editor.ts` are global, not per tab.
  - add it to the controller object returned in `createTab()`; `destroyTab()` calls its `destroy()`.
- Autosave: `TabManager.saveToCache()` every 5 s into localStorage `railway-drawer-cache`
  (`src/services/cache-service.ts`, version `'1'`; mismatch drops the cache; failed saves set
  `railway-drawer-cache-stale`). Call `tabManager.flushCache()` before anything that leaves the page.
  Tabs that fail to restore keep their cached XML until edited (`unrestoredTabXml`).
- Style edits (`src/ui/style-edit.ts`, used by `PropertiesPanel`, `EdgePropertiesController`, `InteractiveUIController`):
  like draw.io's setCellStyles, only the edited keys of each selected cell's OWN style change (one undoable edit). Never
  write `graph.getCellStyle(cell)` back into a cell: it is the resolved style (maxGraph's stylesheet deletes `none`
  values, base style names are merged away, light-dark()/default/inherit resolved), which brought back outlines, fills
  and arrow heads on draw.io/template cells. Displays use the resolved style (`effectiveColor`: missing color = none).
  maxGraph only dashes with `dashed=1`; `dashPattern` is space separated.
- `src/services/graph-command-service.ts` `GraphCommandService` (one per tab): undo/redo via maxGraph
  `UndoManager` wired like `Editor.installUndoHandler` (records `InternalEvent.UNDO` from model and view;
  undo/redo replays do not re-record), plus copy/cut/paste/delete/selectAll. `SaveLoadController.load()` clears history.
- Keyboard: a single capture-phase `keydown` dispatcher in `main-editor.ts` runs each shortcut once on the
  active tab (Ctrl/Cmd+Z/Y/Shift+Z/C/X/V/A/S, Delete/Backspace, Escape, arrow-key nudge). Per-tab controllers must not
  bind their own `document` keydown for these. Everything except Ctrl+S is skipped when
  `shouldIgnoreGraphShortcut(e, graph)` (`src/ui/delete.ts`) says the user is typing (input, textarea,
  contentEditable, IME composition, cell editor active), and for keys on `#menu-bar` / `#context-menu`.
  `src/ui/shortcut-keys.ts` `ACTION_SHORTCUTS` describes the real bindings (dispatcher, ZoomController, GroupingController,
  DuplicateOffsetController, F1) by `data-action`; `applyShortcutHints` adds the right-aligned `<kbd class="rd-kbd">` (Ctrl+…,
  ⌘ symbols on macOS) + `aria-keyshortcuts` to menu and context-menu items (text changes via `setMenuItemLabel`). Keep it in
  step with the handlers. Help > Keyboard Shortcuts / F1 = `ShortcutsHelpController` (window event `shortcuts-help-request`).
- Menus (`MenuController`, `src/ui/menu.ts`): WAI-ARIA menubar (`#menu-bar` role=menubar, buttons role=menuitem +
  aria-haspopup/aria-expanded/aria-controls, roving tabindex, items role=menuitem / menuitemcheckbox, submenu title
  aria-haspopup); ↓/Enter/Space open + first item, ↑ last item, ←/→ other menu, Home/End, Enter/Space run, Esc closes and
  focuses the button, Tab closes. Item clicks are delegated per dropdown (generated remote items keep their own handlers);
  `aria-disabled="true"` items do nothing (Edit > Undo/Redo follow the undo history, `UndoRedoController`). `data-action`
  values and selectors are stable (tests). Menus: File (New, Open…, provider items, Save, Save As…, Save as Template…,
  Import ▸ draw.io File (New Tab) / railML / Railway Script / Image as Custom Shape, Export ▸ Download .drawio (`export`) /
  PNG / SVG / railML / Railway Script / Railway Data ▸ / Scenario ▸, Share…, Print), Edit, View (zoom, Grid = the toolbar grid
  button = Properties > Canvas grid via `grid-toggle.ts`, Dark Mode, ERTMS Tab, Connection Arrows), Arrange, **Railway**
  (route tool + tables, Update Route Paths, Recalculate km, Edit Data…, Run Checks, Railway Script Editor, Object State ▸,
  Snap to Track, Show Routes, km Ruler), Extras (PlantUML Editor, Design Custom Shapes…), Help. Each `data-action` exists once. Submenus =
  `.menu-submenu[data-submenu]` > `.menu-submenu-title` (aria-haspopup, aria-expanded) + `.menu-submenu-list` (role=menu,
  nestable), shown by CSS :hover / :focus-within; → / Enter open on the first item, ← / Esc back to the title. e2e:
  `tests/e2e/menu-helpers.ts` `clickMenuItem(page, menu, action)` / `revealMenuItem(item)` hover the submenu chain.
  File > New = `TabManager.openNewTab()` (draw.io-like: new tab "Diagram <n>",
  shown, its project named alike); the "+" button and the first start do the same. Help > About = `showAboutDialog`.
- Side panels (`src/ui/side-panels.ts` `installSidePanels`, replaces resizable-panels.ts): left (Shapes) / right
  (Format) collapse via the toolbar's `#btn-toggle-left-panel` / `#btn-toggle-right-panel` (aria-pressed), View > Shapes
  Panel / Format Panel (`toggleLeftPanel` / `toggleRightPanel`, menuitemcheckbox) and Ctrl/Cmd+Shift+K / +P (dispatcher, like
  draw.io); `.rd-panel-collapsed`. Resize handles: role=separator, 8 px hit area along the inner edge (`.panel-resize-handle`, 2 px
  accent line on hover/focus/drag), arrow keys 16 px (Shift 64). Widths (180-520) and collapsed state in localStorage
  `rd.sidePanels`. Narrow screens: `body.rd-narrow` (narrow-screen.ts, below 900 px; rule in narrow-screen.css) hides both panels;
  a toggle then opens one for the session (`.rd-panel-open-narrow`), the stored state is untouched.
- Left tab strip (`src/ui/left-panel-tabs.ts`): one row; tabs that do not fit (the active one always stays) get
  `.rd-tab-overflow` and are listed in the "»" menu (`.left-panel-tab-more` -> `.left-panel-overflow-menu` role=menu,
  `.left-panel-overflow-item[data-tab]`, arrows/Esc), relaid on resize / switch / close. Every tab button has `data-tab`.
  Each tab is a `.left-panel-tab-btn[data-tab]` wrapper (no button in a button) with its `button.left-panel-tab-label`
  (label in a span); PlantUML and ERTMS also get a sibling `button.tab-close-btn` ("Close <tab> tab", Tab-reachable),
  Delete on the focused tab closes it (main-editor's dispatcher ignores Delete/Backspace on `.left-panel-tabbar`), and
  the » menu lists `.left-panel-overflow-close[data-tab]` "Close <tab>" after such a tab (Delete on its item too);
  reopened by Extras > PlantUML Editor / View > ERTMS Tab.
- Toolbar (`index.html` `#toolbar-container` role=toolbar, chrome by `src/ui/toolbar.ts` `installToolbar`, once): groups
  (role=group) Zoom | Edit (Undo, Redo, Delete) | Insert (rectangle, ellipse, diamond, line, connect two selected, image as
  custom shape) | Arrange (Grid toggle = View > Grid, format painter, Align / distribute dropdown `#btn-align` ->
  `#align-menu` with AlignmentController's `#btn-align-*` / `#btn-distribute-*`) | Railway (Route tool, Run checks, km
  ruler mirroring the menu item via `data-mirror-action`) | View (panels, fullscreen). Buttons carry `data-icon`
  (`TOOLBAR_ICONS`, inline 24x24 stroke SVG, no emoji), `data-label` (-> aria-label) and optional `data-shortcut` (an
  `ACTION_SHORTCUTS` key -> tooltip "Undo (Ctrl+Z)"); toggles use aria-pressed. The same icon set serves the rest of the
  chrome (`applyInlineIcons` for `[data-rd-icon]`, `setInlineIcon`): top-bar logo (train) and Share, Properties text
  alignment, layer eye/lock, shape designer, remote file browser; no emoji anywhere in the chrome. Align / distribute
  (AlignmentController): cloned geometries via `model.setGeometry` in one batchUpdate (one undo step), locked cells
  skipped (also as reference). Actions stay bound by id in the per-tab
  controllers (InteractiveUIController, ZoomController, ...). Removed: pan ‹ ›, the green "+" rectangle, the toolbar
  shape-designer button (Extras), the single Distribute button.
- Themed dialogs (`src/ui/app-dialogs.ts`, `.rd-tpl-modal` look): `openAppModal` (role=dialog, aria-modal, labelledby,
  backdrop, focus trap, Esc cancel, Enter submit, focus returned, keys kept from the dispatcher), `promptSaveAs` (File >
  Save As…: name -> `renameActiveProject` + download `<name>.drawio`), `confirmDialog`, `messageDialog`, `showAboutDialog`
  (`APP_VERSION`/`BUILD_ID`/`BUILD_TIME` from `config/build-id.ts`, the status bar's source; `VITE_APP_VERSION` =
  package.json version via vite.config.ts). Use them (or notifications) instead of alert()/confirm() in the chrome.
- Properties panel states (`src/ui/properties-state.ts` `setPropertiesPanelState`, the only place that toggles
  `#prop-placeholder` / `#canvas-props` / `#prop-editor` / `#edge-properties` / `#prop-selection-header`; `data-state` on
  `#property-content`): none (nothing selected), canvas (after a click on the empty canvas, checked after maxGraph handled
  the click and only while the selection is empty), cell (header `selectionTitle`: "Signal S1" for railway objects, else the
  label, "Shape"/"Group"/"Connector"; "3 shapes"/"2 connectors"/"4 items"). Owned by `PropertiesPanel`; the Style tab is
  shown first (draw.io Format panel). Zoom: `StatusBarController.syncZoom` on SCALE and SCALE_AND_TRANSLATE and on tab
  switch: `#status-zoom` + `#zoom-level` (a non-preset zoom gets its own `data-custom` option).
- Save status (`save-status.ts`): "Saved in browser" (autosave), "✓ Saved to <file.drawio | provider>" after a real
  save/open (`markAsSavedToDisk(target)`); File > Save / Save As download `<project>.drawio`.
- `src/services/service-registry.ts` holds tabManager/notifications/etc. instead of `window` globals
  (leftovers: `window.__leftPanelTabs` set in `main-editor.ts`, `window.__saveStatusIndicator` set in
  `src/ui/save-status.ts`).
- maxGraph 0.10 API: `GraphDataModel` has no getParent/getChildCount/getChildAt/getChildren/`children` (use
  `cell.parent`, `cell.children`, `cell.getChildAt`, `model.add(parent, cell, index)`), `Graph` has no `getModel()`
  (`getDataModel()`) or `getCanvas()` (`graph.view.getCanvas()`). Edit cells through the model (`model.setGeometry`,
  `model.setStyle`, `model.add`) inside one `batchUpdate`, never `cell.setGeometry/setStyle` (not undoable, no events).
  `graph.orderCells` does not sort the selection itself: pass `styleUtils.sortCells(cells, true)`.
- Z-order and selection commands live in `GraphCommandService` (`toFront`/`toBack`/`bringForward`/`sendBackward`,
  `selectAll` = draw.io's `graph.selectAll(null, true)`, skipped on a `locked=1` layer); Arrange menu, context menu
  and Ctrl+A call them. Bring Forward/Send Backward = `stepOrder`: a cell swaps only with an unselected neighbour.
- Lock = draw.io's style key `locked=1` (`src/ui/cell-lock.ts`, installed per tab graph by `installCellLocking`):
  `graph.isCellLocked` = maxGraph's || `locked=1` on the cell or an ancestor (group/layer), which maxGraph's
  movable/resizable/bendable/editable/disconnectable/label-movable checks use; deletable, rotatable and
  `isValidSource`/`isValidTarget` also refuse locked cells; locked cells stay selectable, cells on a `locked=1` layer
  are not selectable. Context menu Lock/Unlock and the Properties Lock button = `toggleCellsLocked` (draw.io
  `lockUnlock`: first cell decides; via `setCellStyleValues`, one undo step). Delete/cut/context Delete pass
  `graph.getDeletableCells(selection)` to `removeCells`, so a locked cell's edges stay too (draw.io deleteCells).
  Properties Arrange X/Y/W/H, constrain, rotation, Rotate 90°, flips are disabled while the shown cell is locked
  (`graph.isCellLocked`: also via its group/layer; refreshed on model changes) and their handlers skip locked cells.
  Arrow keys = `GraphCommandService.nudge` (1 px, Shift = grid size; `getMovableCells` of the topmost selected cells,
  one undo step; only when the focus is on the canvas/body; snap to track only refreshes km/track, never moves: `withSnapDataOnly`).
- Canvas interaction like draw.io (`src/ui/connections.ts` `installDrawioConnectionStart`, `src/ui/canvas-interaction.ts`):
  maxGraph's ConnectionHandler started an edge from a vertex's central hotspot (and the old fallback had a centre
  connection point), so a middle drag drew an edge and a click on a group child selected the child. Now
  `isValidSource` is false until a connection started (only connection points start one; targets unchanged), and a
  source press in the central 50 % of a vertex never hits a point. Connection points like draw.io: shapes without own
  points (`points` style, stencil, JS-shape constraints) get draw.io's per-shape defaults (`defaultConnectionConstraints`:
  rectangle/group/image 16 = corners, quarters, midpoints; ellipse 8; rhombus; triangle), drawn with draw.io's blue 'x'
  (`CONNECTION_POINT_IMAGE`, data: SVG; maxGraph's `images/point.gif` is not shipped, so points were invisible); valid
  targets outlined `#00a8ff` (`installDrawioEdgeEnds`). An edge end dropped on a body (not on a point) connects floating:
  maxGraph 0.10.3's EdgeHandler passed `outline = true` to updatePreviewState, which stored the drop position as a fixed
  entry point; `outline` is set to `outlineConnect` (false) per edge handler. ERTMS symbols connect as a whole
  (`installSymbolGroupConnect`, a `Cell.prototype.isConnectable` patch): a group vertex with `rdKind` is connectable
  (the library's `connectable="0"` stays in the file), its descendants are not, so maxGraph's connectable-parent
  fallback hits the group. `installGroupBackgroundHit`: a MOUSE_DOWN on the background inside a transparent group (vertex
  with children, `getCellAt`) gets the group's state, so it is selected/moved; MOUSE_MOVE/MOUSE_UP too when the group is
  connectable (its points show, an edge end dropped in a gap connects). `installRailwaySplitRules`: no edge split when a
  railway object is dropped on an edge or an edge is a railway object (a balise on a track split the track into two
  edges connected to it) or with Alt/Shift (draw.io); a group with `rdKind` is never a drop target. Moving: draw.io's
  grid (gridSize 10, `gridEnabled` = View > Grid; per tab: a file's `grid` / `gridSize` on `<mxGraphModel>` are applied on
  load and written back on save, `grid-toggle.ts` `applyGridSettings` / `syncGridUi` on tab switch and load; `snapDelta` aligns an off-grid cell only on moves of half a grid step or
  more), Alt held during the drag = no grid and no track snap (Alt or Shift pressed before a press on the empty
  background = rubber band; a plain drag there pans, src/ui/pan.ts), no guides, drag start tolerance 4 px. Context menu
  (`contextSelectionFor`): a right-click inside the selection (cell or ancestor selected) keeps it, else the topmost
  selectable ancestor is selected; edges get the cell menu; maxGraph's PopupMenuHandler selection is off
  (`selectOnPopup`/`clearSelectionOnBackground` = false: it changed/cleared the selection on mouse-up after Lock).
- Connection arrows = draw.io HoverIcons (`src/ui/hover-arrows.ts` `HoverArrowsController`, one per tab, built in
  `TabManager.createTab` after `ConnectionHandler`, `tab.hoverArrowsController`): four DOM arrows (draw.io's images,
  `--rd-hover-arrow` / `-outline` tokens, 50 % opacity until hovered) in the graph div around the cell a click would
  select (`hoverArrowCell`: group before its children, unlocked incl. group/layer, connectable or a group, no edges,
  `allowArrows=0` honoured) after a 140 ms rest; never while a button is down, editing, Route tool active
  (`.rd-route-tool-active`) or in the scenario view (`body.rd-scenario-viewing`). Hidden outside the cell+arrows box
  (+10 px), on container leave/scroll, selection change, edit start, Escape (dispatcher calls `escape()`), Alt;
  repositioned on view/model changes; an arrow over another (not 3x larger) cell or an edge is hidden (draw.io
  checkCollisions). Click = `connectVertex` (draw.io Graph.connectVertex, one batchUpdate so one undo step and the ERTMS
  snap joins it): an unlocked cell within 40 px of the point 80 (`defaultEdgeLength`) beyond the side is connected,
  else a clone (`graph.cloneCells`, `prepareClonedCells`: next free railway ID per kind, `rdRoutes`/`rdRailml*Id`/
  `rdRailmlNetElements` dropped) is added 80 away in the source's parent and connected; Ctrl/Cmd = always clone,
  Shift = no clone (dangling edge), Ctrl+Shift = clone without edge; the new cell (else the edge) is selected. Edges get
  the connection handler's style (graph default). Drag = `ConnectionHandler.start` from the cell (draw.io
  HoverIcons.drag); while it runs `isCreateTarget` is true, so a drop on blank canvas inserts a prepared clone at the
  pointer (selected), a drop on a cell connects (floating / its connection point). Hovering an arrow shows
  `.rd-hover-arrow-preview` (dashed clone box, or solid outline of the target). Setting: View > Connection Arrows
  (`data-action="toggleConnectionArrows"`, Alt+Shift+A), localStorage `rd.connectionArrows` (default on). Not ported:
  draw.io's shape picker on plain click / blank drop, containers as clone parents, Ctrl+Shift+drag port constraint,
  touch. Tests: `src/__tests__/ui/hover-arrows.test.ts`, `tests/e2e/hover-arrows.spec.ts`.
- ERTMS palette display (`src/ui/ertms-display.ts`, wraps `ertmsPaletteSource` in main-editor.ts): titles trimmed and
  "SIgnal" -> "Signal" at display time only (ertms.xml stays byte-identical), EN+PL railway search tags by kind / title
  word (`RAILWAY_SEARCH_TAGS`: signal semafor sygnalizator, balise balisa, points switch turnout zwrotnica, axle counter
  licznik osi, buffer stop kozioł, track tor, level crossing przejazd, LEU, RBC, train pociąg); UI text says "points"
  (catalogue label "Points"). ERTMS is the FIRST section of the Shapes tab (`palettes: [ertms, ...shapesTabPalettes()]`,
  `defaultExpanded: ['ertms', 'general']`, stored flags win) with captioned tiles (`captionPalettes: ['ertms']`,
  `.rd-dp-caption`); the optional ERTMS tab stays off by default (the Shapes tab already leads with ERTMS).
- **Railway libraries** (`src/ui/railway-libraries.ts` `RAILWAY_LIBRARIES` / `railwayLibrarySources`, the only hook:
  three entries in the Shapes-tab `palettes` after ERTMS + `captionPalettes`): "ERTMS/ETCS extra" (`etcs-extra`,
  `public/libraries/ertms-extra.xml`: ETCS stop/location marker boards, level transition / RBC border / cab signalling /
  neutral section / pantograph / track condition / release speed boards, fixed + switchable balises, balise groups (2, 3,
  linked), Euroloop, RBC, LEU, axle counter head + evaluator, insulated rail joint, radio infill, GSM-R mast, IXL, OC,
  ETCS trains, MA arrows, EoA, danger point, SvL, overlap), "Polish signalling (PKP PLK)" (`rail-pl`,
  `railway-pl.xml`: semafory 2–5-komorowe, wjazdowy/wyjazdowy/drogowy/odstępowy, powtarzacz, tarcze To/Osp/Tz/Tm,
  Sz, semafory kształtowe, wskaźniki W1/W4/W8/W9/W24/D1 (code boards), przejazdy kat. A–D, rogatka, sygnalizator,
  kozioł, rozjazdy zwyczajne/łukowe, skrzyżowanie, Rkp/Rkpd, krzyżownica, styk, wykolejnice, perony, nastawnia,
  posterunek, hektometr, km) and "Track layout" (`track-layout`, `track-layout.xml`: straight/vertical/diagonal
  tracks, track section, track ends, turnouts 1:9/1:12 x hand x toe side, crossovers single/scissors, diamond, slips,
  platforms, bridge, tunnel, level crossing, km post/hectometre/km ruler, gradient/speed boards, track number). Lazy
  (fetched when a section opens or a search runs). **Generated**: `python3 -I scripts/railway-libraries/build_railway_libraries.py
  public/libraries` (deterministic; never hand-edit the three files; the docstring has the conventions). Plain
  draw.io styles and inline `stencil(...)` shapes (accents `fillColor2`), editable colours, connection points; tags EN +
  PL per entry (`tags` key of the `<mxlibrary>` entries, ignored by draw.io). Typed entries store catalogue
  attributes (`rdKind`, `rdSignalType`, `rdDirection` Right/prawy = nominal, `rdAspects` = lamps, `rdHand` physical
  from the toe, `rdProtection`, `rdFunction`, ...); signals are groups with round filled lamp vertices (states);
  turnouts/crossovers/slips are multi-cell sets (track edges + points legs, topology.ts). On insert
  `prepareRailwayInsert` runs `renumberInsertedObjects` for every non-ERTMS entry (free IDs, `BG1`/`B1` references
  follow); `kindForPaletteEntry` reads the first `rdKind` of a non-ERTMS entry's XML (click placement). **Licensing:
  the symbols are original work of this repository (no proprietary symbol files copied); the Polish/ETCS pictograms
  are conventional schematic depictions, not copies of PKP PLK / ERA drawings.** Tests:
  `src/railway/__tests__/railway-libraries.test.ts`, `tests/e2e/railway-shapes.spec.ts`, dark-shapes thumbnails.
- Palette click placement (`src/ui/click-insert.ts` `clickInsertPlacement`, palette option `clickPlacement`; drag/drop
  unchanged): snap-kind symbol (signal, balise, axle counter, LEU) + one selected track/track section -> the visible point
  of its line nearest the view centre (snap.ts then snaps + sets track/km); one selected unlocked vertex + a vertex entry
  -> 80 px beside it, centred on that side, moved along the side while taken (down for east/west, right for
  south/north), connected by an edge (draw.io dropAndConnect). Side = draw.io itemClicked's modifiers without its Alt
  (draw.io connects only on Alt+Click; here Alt+Click skips it): plain click east, or south when a shape already lies
  in the band east of the selection (`hasEastNeighbour`), Shift east, Ctrl/Cmd north, Ctrl/Cmd+Shift west (also Enter /
  Space on a tile; `clickDirection`, `placeBeside`). Else the view centre, cascading right/down to a free spot. One
  model update (one undo), new cell selected, no container drop. Not ported: draw.io's Shift+Click shape replace.
- Start card (`src/ui/start-card.ts`, main-editor.ts): over an empty active tab (Insert ERTMS symbols / Open template… /
  Open file… / Import railML… / Railway Script… / F1); dismissed by any model change making it non-empty, its actions,
  Esc, ×; "Don't show again" = localStorage `rd.startCard.hidden`. Hidden while dragging (drops reach the canvas).
  Automated browsers (`navigator.webdriver`) do not get it unless `rd.startCard.force` = '1' (e2e clicks the canvas centre).
- Narrow screens (`src/ui/narrow-screen.ts`): < 900 px -> `body.rd-narrow` (fallback CSS hides both side panels and
  `.panel-resize-handle`) + dismissible banner (`rd.narrowBanner.dismissed`). Start card actions that need the left
  panel (Insert ERTMS symbols, Open template…, Railway Script…) call `ensurePanelShown('left')` (side-panels.ts): opened
  for the session there (`.rd-panel-open-narrow`), stored state untouched.
- Layers panel (`src/ui/layers.ts`) = the model's real layers (root children, listed top-most first, unnamed =
  "Background", `rd-routes` = "Routes"): current layer = `graph.setDefaultParent`; + Layer = `model.add(root, …)`;
  delete = `removeCells([layer], false)`; eye = `model.setVisible`; padlock = `locked=1` on the layer cell. All undoable
  and saved in the .drawio file. The old app-only layers (`rdLayerId` / `__layerId`) are no longer used by the panel
  (still read and written back verbatim by drawio-xml.ts when a model already has real layers). One-time migration
  (`src/services/legacy-layers.ts` `migrateLegacyLayers`, run by `SaveLoadController.load` on the scratch model, so
  for files, cache, links and remote opens): a model with ONE real layer and cells carrying `rdLayerId` gets one draw.io
  layer per old id (`layer-0` = the existing layer, then `layer-<timestamp>` in creation order, named `Layer <n>` like
  the old defaults — the old names/visibility/lock were only ever in memory, never in a file or the cache; the old id
  becomes the layer id when free), top-level cells move in z-order, edges follow a terminal, a layer whose cells were
  all `visible=0` becomes a hidden layer; `rdLayerId` is dropped. Tab modified: `hasUnsavedLoadChanges()` ->
  save status unsaved, cache rewritten on restore, remote binding dirty. Files without `rdLayerId` are untouched.
  Tests: `src/services/__tests__/legacy-layers.test.ts` (fixture `fixtures/legacy/legacy-layers.drawio`).
- Project name: each tab has its own project (`saveLoadController.getProjectName()`: Save/Export file names,
  `<diagram name>`). Top-bar `.document-title` shows the active tab's (`TabManager.switchTab`; a background tab's
  `setProjectName` does not touch it). Rename (`ProjectNameEditor(tabManager)`) -> `tabManager.renameActiveProject`:
  the active tab's project, and its tab label too when the label equals the old project name (tabs opened from
  links/remote files are named after it); cached at once. File > Save As… goes through it too. Mirror rule: renaming a
  tab label (double-click, `editTabName`) that equals the tab's project name renames the project as well. Cache: `tabs[].projectName` per tab (top-level
  `projectName` = active tab's; caches of earlier versions without it give it to the active tab).
- Image export: File > Export > PNG Image…/SVG Image… (`data-action="exportPng|exportSvg"`, per-tab `ExportImageController` set
  on the tab's MenuController) uses `diagram-image-export.ts` like the Share dialog and scenario exports: draw.io
  light colours even in the dark theme (thumbnail renderer option `light` pins the hidden graph with
  `setGraphColorMode`), on the model's `background` (`modelBackground`, white by default). Every VISIBLE layer is
  drawn in model order (`cellsFromModelXml`: children of each layer, groups kept, `visible="0"` layers skipped like
  draw.io, edges into a hidden layer dropped), also `rd-routes` when shown and in the scenario exports. `SaveLoadController.exportAsJson()` (no menu item; .drawio is the
  exchange format) = `{format:'railway-drawer-cells', version:1, name, cells}` read from the saved draw.io XML.

### File format (main editor): native draw.io XML

`src/services/drawio-xml.ts`. maxGraph 0.10 reads mxGraph XML but only writes `<GraphDataModel>`, which
draw.io cannot open; this module writes and reads draw.io `<mxfile>/<diagram>/<mxGraphModel>/<mxCell>`.

- Saves are `.drawio` (`SaveLoadController` + `ProjectService`); the cache stores `<mxGraphModel>` per tab,
  plus pages 2..n (`extraPages`, `pageId`) so multi-page files survive a reload and a save.
- App-only data lives in style keys draw.io preserves: `rdShape` (legacy app shape such as `customHexagon`
  exported as a similar draw.io shape via `DRAWIO_SHAPE_MAP`; restored on import, added keys removed;
  draw.io shape names are native now and never mapped), `rdOwn`, `rdLayerId`, `rdPlantUml`
  (base64 JSON). `IMAGE_FALLBACK_SHAPES` (ertms-signal/track/train/balise) export as SVG images.
- Import fixes maxGraph codec gaps (`registerDrawioCodecs()`: replacement `mxCell` codec, `mxRectangle`),
  registers draw.io named styles, renders `UserObject`/`<object>` labels, rejects XML nested deeper than
  `MAX_MODEL_XML_DEPTH`.
- Legacy `<GraphDataModel>` files/caches still load (`importModelXml` / `isLegacyModelXml`). Restored legacy
  cache tabs are rewritten to draw.io format immediately (`CacheService.isLegacyGraphXml` ->
  `TabManager.restoreFromCache` calls `saveToCache`); the cache version was deliberately not bumped.
- `load()` decodes into a scratch model first; the current diagram is only replaced on success.

### draw.io compatibility guard

The embedded draw.io editor was removed on the user's decision, so nothing runs real draw.io any more.
**`src/services/__tests__/drawio-compat.test.ts` is the guard** (with `tests/e2e/drawio-compat.spec.ts` in the app):
- Fixtures in draw.io's own format (`src/services/__tests__/fixtures/drawio/`): `compat-multipage.drawio` (plain pages +
  one compressed), `compat-compressed.drawio` (all pages compressed, `compressed="true"`), same content: 4 pages
  (layout with rdScenarios, a scenario step page, "Notes", "Archive"), 3 layers (one hidden + locked), group, dangling
  edge, orthogonal edge with waypoints + edge label, `<object>` with placeholders and custom attributes,
  `<UserObject>` with link/tags, core shapes (hexagon, cylinder3, rhombus, ellipse), JS shape `mxgraph.arrows2.arrow`,
  stencil `mxgraph.flowchart.collate`; `compat-library.xml` (`<mxlibrary>`: escaped, compressed and image entries).
  Plus the older `src/__tests__/fixtures/drawio/*.drawio` and the real ERTMS library (`public/libraries/ertms.xml`,
  the app's copy of the user's `ERTMSDrawioTemplate/ERTMS.xml` (never edit that original), 37 entries: see Templates).
- Path under test = File > Open / Save: `SaveLoadController.loadProjectXml` -> `getProjectXml`. Required: valid draw.io
  XML (`<mxfile>`, one `<diagram>` per page, `mxGraphModel/root`, cells 0 and 1, no namespaces); same pages, order,
  names, ids and `<diagram>` attributes; same cells in draw.io's depth-first order, kinds, parents, terminals, values,
  every wrapper attribute; every original style entry and the style string itself kept (the save may only add
  explicit app defaults); geometry incl. points/terminal points/offset/alternate bounds (1/1000 px); page settings;
  hidden pages byte-identical (compressed stays compressed); stable second save; `rdShape` app shapes; `#R` links.
- Change the fixtures only deliberately, by hand in draw.io's layout. A compressed page is
  `base64(deflateRaw(encodeURIComponent(modelXml)))` (node:zlib `deflateRawSync`). Never weaken an assertion to make
  a change pass.

### draw.io shapes in the maxGraph editor (`src/drawio-shapes/`, pinned to jgraph/drawio **v32.4.1**)

Ports of draw.io's own code (Apache-2.0; attribution in `NOTICE`, every ported file has the header and
upstream `file:line` references; `third_party/drawio/` has the license and the upstream file list).
`DRAWIO_TAG` (engine and palettes) names the tag; bump it only together with `npm run drawio:palettes`.

- `engine/`: stencil engine. `installStencilEngine({ baseUrl })` (once, in `main-editor.ts`) patches
  `CellRenderer.createShape` for `shape=stencil(<base64 deflate>)` and wraps `StencilShapeRegistry.getStencil`
  (JS shapes win over stencils of the same name, as in draw.io). Named stencil sets (`mxgraph.basic.*`, ...)
  are fetched from `public/stencils/<basename>.xml` by `ensureStencilsForXml(xmlOrStyles)` (all 204 sets are vendored; see "All draw.io
  libraries"). `installDrawioCompat(graph)` resolves `light-dark()`
  and `default` colours (light theme). `parseMxLibrary` / `entryToCells` read any `<mxlibrary>`.
- `js/shapes-core/` (Shapes.js vertex shapes + perimeters), `js/shapes-edges/` (table, flexArrow, link,
  partialRectangle, curvedText, ...; `installTableSupport(graph)`: table/stack layouts, collapsed tables),
  `js/mx-libs/` (shapes/mxBasic.js, mxArrows.js, mxFlowchart.js). All registered under the exact draw.io
  names by `registerDrawioJsShapes()` in `src/shapes/index.ts`, before the app's own shapes. draw.io's
  `hexagon` replaces maxGraph's core hexagon; the app's hexagon is `customHexagon`/`hexagon-shape`.
  `src/shapes/drawio-arrows/` keeps the old `mxarrows.Arrows2*` keys as aliases (export writes the real names).
- `palettes/`: `PALETTES` + `loadPalette(id)` (one lazy chunk per palette, any of the 504 ids; `loadPaletteCatalogue()`,
  `loadPaletteSearchIndex()`): General 45, Misc 54, Advanced 33,
  Basic 76, Arrows (arrows2) 31, Flowchart 34, legacy Arrows 34 (hidden by default). Generated JSON in
  `palettes/data/`; never edit it by hand.
- Regenerating (`npm run drawio:palettes`, see `scripts/drawio-palettes/README.md`): fetch-sources.ts downloads
  the pinned files (SHA-256 checked) into `$DRAWIO_CACHE_DIR` or the OS temp dir, decode-stencils-bundle.ts
  writes `public/stencils/*.xml` from js/stencils.min.js, extract-palettes.ts runs the real Sidebar-*.js
  palette functions in a `node:vm` sandbox and writes `palettes/data/*.json`. Outputs are deterministic.
- UI: `src/ui/drawio-palette/` (`createDrawioPaletteView`), mounted in `main-editor.ts` inside the single
  **Shapes** tab of the left panel (`#shapes-container` = `#app-shapes-container` (ShapeToolbar groups) +
  `#custom-shapes-container` + `#drawio-palette-container`). There is no separate draw.io or Stencils tab:
  the palette's "More shapes…" menu toggles the draw.io palettes and, via `extraMenuItems`, the app shape
  groups (hidden groups in localStorage `railway-drawer-hidden-shape-groups`). **One "General" section**
  (`shapes-tab-palettes.ts`, `shapesTabPalettes()`): draw.io General (draw.io order), then draw.io Basic
  (entries with the same cell as General dropped), then app Basic shapes without a draw.io equivalent
  (`APP_BASIC_MERGE`: duplicates such as rectangle/circle/hexagon/star are not listed; Cross and Line are
  copies of draw.io's Advanced/Misc entries; Divided (app "Double") Rectangle and Chevron keep the app shape,
  saved with `rdShape`). No separate "Basic" section, no app "Basic" group (registrations kept for old files),
  one "General" toggle; `migrateMergedPaletteFlags()` moves stored `basic`/app-`Basic` flags onto `general`
  (shown if any of the three was shown). Search lists a shape once (`entrySignature`, first section wins).
  `PALETTES` itself still lists draw.io's palettes 1:1. Optional **ERTMS** tab (View > ERTMS Tab,
  closeable, state in localStorage `railway-drawer-ertms-tab`): a second palette view with only the ERTMS
  library (`userLibraries: false`, `showMoreMenu: false`, own flags via `storageKeySuffix`, no dropTarget —
  the Shapes-tab view handles its drops since palette/entry ids are the same). Order: draw.io palettes, then ERTMS (`public/libraries/ertms.xml`,
  the default ERTMS palette, showing only its 18 simple elements — the 19 scenario diagrams are ERTMS templates,
  see Templates below; the `src/shapes/ertms` placeholders are renderers only, for old files), then
  user libraries ("＋ Add library", stored in localStorage `rd.drawioLibraries`; see "All draw.io libraries"). Thumbnails come from one
  hidden graph (draw.io defaults, table support). Click inserts at the view centre, drag drops at the pointer
  (dataTransfer type `application/x-rd-drawio-entry`).
- maxGraph 0.10.3 gaps fixed for draw.io content (engine/): `stencil-fixes.ts` (StencilShape read
  `large-arc-flag="0"` as true, so stencil arcs were wrong; `<fillcolor color="accentColor" default=..>` style
  keys), `html-labels.ts` (`html=1` cells render sanitized HTML labels; maxGraph only has a graph-wide flag),
  `view-fixes.ts` (edge styles for edges without a source terminal; `inherit` style values),
  `shape-fixes.ts` (rounded edges use `arcSize / 2` like mxPolyline; `shadow=1` is draw.io's CSS
  `drop-shadow()` filter instead of maxGraph's offset copies, whose fill was the boolean flag), and
  `graph-compat.ts` (`DrawioTextShape`: draw.io's label `baseSpacingTop = 5` / `baseSpacingBottom = 1`,
  Graph.js:212; `minSvgStrokeWidth = 0.1`, Graph.js:941). maxGraph
  registers its core shapes when the first `Graph` is created, which silently replaced draw.io's `hexagon`:
  `registerDrawioJsShapes()` calls `Graph.prototype.registerDefaults()` first.
- Tab graphs (`TabManager.createTab`): `applyDrawioDefaultStyles` (draw.io's styles/default.xml: white fill,
  black stroke, Helvetica, rounded edges with classic arrow), named styles, `installDrawioCompat`,
  `installDrawioHtmlLabels`, `installDanglingEdgeStyles`, `installInheritStyleValues`,
  `installTableSupport`, `installStencilAutoload` (`src/ui/drawio-stencil-autoload.ts`: every model change
  -> `ensureStencilsForXml` -> `graph.refresh()`, which covers open, cache restore, paste and inserts).
  The palette's hidden thumbnail/export graph gets the same set.
  `ConnectionHandler` uses draw.io's connection points (`getDrawioConnectionConstraints`) when a shape has them.
- Saving draw.io-styled cells is byte-identical: `parseDrawioStyle` (codec and palette inserts) remembers
  the original string and the export writes it back while the parsed style is unchanged; `addAppDefaults`
  only writes colours/arrows where the app would render differently from draw.io's defaults.
  `src/__tests__/services/drawio-xml-palettes.test.ts` checks every palette entry and every ERTMS tile.

### All draw.io libraries (504 palettes, 13,971 entries; "More shapes…", search, user libraries)

- **Generator** (`npm run drawio:palettes`, `scripts/drawio-palettes/README.md`): `fetch-sources.ts` fetches every
  `js/diagramly/sidebar/Sidebar-*.js`, `shapes/**`, `img/**` (+ Editor.js, Dialogs.js, resources/dia.txt, mxConstants.js)
  **by commit** `9034053f…` (tag v32.4.1), each file checked against the commit's git blob id. Downloaded sources are
  data: `safe-js.ts` is a closed tree-walking interpreter (TypeScript parser, no eval/vm/Function; prototype-less
  objects, allow-listed pure methods) in which `extract-palettes.ts` runs grapheditor Sidebar.js (General..UML), every
  Sidebar-*.js (not Sidebar-Advanced.js: ELK live layout containers) and Sidebar.js `initPalettes()`/`updateEntries()`
  against a recording Sidebar stub. The 7 old palette files are byte-identical. Writes `palettes/data/<id>.json` (file =
  id, or `p-<slug>` for ids with spaces), `catalogue.json` (draw.io's More shapes categories, 69 libraries =
  `Sidebar.configuration`, palettes with counts/JS shapes/stencils, vendor `attribution`/`notice`/`vendorIcons` from
  `libraries.ts`), `search-index.json` (`title\ttags` per entry), `third_party/drawio-libraries/*.md` (one notice per
  vendor), copies all 2094 `img/**` images to `public/img/` (styles keep `image=img/lib/...`, resolved against the app
  base). `decode-stencils-bundle.ts` writes all 204 stencil sets. Never edit generated files by hand.
- **JS shape libraries** (`vendor-shapes.ts` -> `src/drawio-shapes/vendor/*.js`, 46 modules / 703 shapes): upstream
  `shapes/**/*.js` (not mxBasic/mxArrows/mxFlowchart, which are TS ports) and the 40 Shapes.js shapes the TS port lacks
  (`Shapes-extra.js`: statements of those classes + their local dependencies, AST-selected), copied **unmodified** into
  `export default function install(mx) { var mxShape = mx.mxShape, ...; <upstream> }` (`// @ts-nocheck`,
  `/* eslint-disable */`). Free identifiers are checked against the shim (unknown global = generator error); undeclared
  assignments become module `var`s; top-level names other files use go through `mx.publish`/`mx.lookup` (`deps` in
  `vendor/index.json`, e.g. ArchiMate4 -> ArchiMate3). `index.json` also has `mxStencilRegistry.libraries` from
  Editor.js (basename -> stencil files + modules; sets missing from the bundle, e.g. sap.xml, dropped) and per module the
  stencils it draws itself. `vendor-runtime/mx-shim.ts`: mxShape/mxActor/... = ES5-callable wrappers of the maxGraph
  classes (or the app's registered draw.io ports): `Base.call(this)` copies a fresh instance's fields that the upstream
  prototypes do not define; `strokewidth` alias; mxUtils/mxConstants subsets (`vendor/mx-constants.json`);
  `mxCellRenderer.registerShape` never replaces an app shape; `getShape()` wraps TS classes (statics `cst`/
  `customProperties` on the prototype); `Graph.handleFactory` -> `registerDrawioHandleFactory` (handles/install.ts);
  `GraphDataModel.prototype.getParent` added for mxRack.js. `vendor-runtime/loader.ts` (lazy chunk) installs modules
  (deps first, once) via `import.meta.glob`.
- **Loading**: `ensureStencilsForXml` (engine) collects unknown shape names and, for registered vendored JS shapes, the
  basenames whose library was not requested yet; then dynamically imports the loader -> modules + stencil files ->
  `js:<module>` in the result so callers refresh. Opening a drawing, inserting, thumbnails and pastes all go through it.
- **UI** (`src/ui/drawio-palette/`): `createDrawioPaletteView({ catalogue (default = showMoreMenu), skipCataloguePalettes })`
  adds every catalogue palette as a hidden lazy section (`.rd-dp-catalogue`, `data-library`, ⓘ attribution) after the
  built-in sections, before user libraries, once `loadPaletteCatalogue()` resolved (`view.catalogueReady`); palette data
  loads on expand/search only; `ready` still covers just the built-in sections. Main editor passes
  `skipCataloguePalettes: ['basic']` (merged General). "More shapes…" = dialog `.rd-dp-menu` (`role=dialog`): "In the
  Shapes tab" rows (unchanged `.rd-dp-menu-row`, data-palette-id / data-menu-item-id), then `more-shapes-dialog.ts`
  (lazy): filter, draw.io categories + "Legacy" (azure, veeam, arrows not in draw.io's dialog), one checkbox per library
  (`input[data-library-id]`, toggles all its palettes, flags in `rd.drawioPalettes.visible`, first palette expands),
  preview pane (count, attribution, 24 thumbnails). Defaults unchanged (ERTMS, railway libraries, General, Misc, Advanced,
  Arrows, Flowchart on; every draw.io library off). Search: the inline filter as before, plus `global-search.ts` (lazy,
  150 ms debounce): `search-index.json` over palettes that are not shown, grouped by library (sorted by hits, 6 groups
  with up to 24 tiles, others "Show N results", "Show library"), deduped against the visible results. Thumbnails:
  shared renderer cache + IntersectionObserver as before; dark mode: draw.io libraries use the adaptive rendering,
  vendor icons (images, fixed-colour stencils; `vendorIcons`) are not recoloured.
- **User libraries** (localStorage `rd.drawioLibraries`, `{ id, title, text }`, text = native `<mxlibrary>`):
  "＋ Add library" (`user-library-actions.ts`, lazy) = import file / open from URL / new empty library; sections have ＋
  (add selection: `extractTemplate` -> `{xml, w, h, aspect, title}`), ✎ rename, ⤓ export (`<title>.xml`), × remove;
  palette tiles dragged onto a library section are added, and a canvas move gesture released over it adds the selection
  (GraphHandler reset, the cells stay). Serialized JSON body is XML-escaped (well-formed; draw.io reads it). The
  Templates tab stays separate (whole diagrams/scenarios with name/description, own store and mxlibrary export).
- **Shape catalogue API** (for code that picks shapes by name, e.g. the AI assistant): `src/drawio-shapes/palettes/
  shape-catalogue.ts` (import it dynamically): `listShapeLibraries()` (id, title, More shapes category, count, palettes,
  attribution), `searchShapes(query, { limit, libraries })` -> `{ library, palette, entry }` (entry = PaletteEntry with
  the exact draw.io style / XML, insert with `insertEntry`), `paletteEntries(id)`.
- Tests: `src/__tests__/drawio-palettes/safe-js.test.ts`, `src/drawio-shapes/palettes/__tests__/catalogue.test.ts`,
  `src/drawio-shapes/vendor-runtime/__tests__/vendor-shapes.test.ts` (renders all 9,400+ JS/stencil vertex entries),
  `src/ui/drawio-palette/__tests__/user-libraries.test.ts`, `tests/e2e/all-shapes.spec.ts`.

### Templates (`src/ui/templates/`, left-panel tab "Templates")

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
  removed; coloured MA/route highlight edges stay decoration on top), points (diagonal track edges, hand down-right =
  left; short legs extended onto the track) and TVD sections: `trackSection` TC<n> edges with the track's style on
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
  event `save-template-request` -> `main-editor.ts`), and the tab's "Save…" button. `extractTemplate`
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
  Open as new diagram (`openTemplateAsNewDiagram`: `tabManager.createTab(name)` + `saveLoadController.load`,
  the tab is closed again if the load fails), Rename…/Delete… (user). Drag (`application/x-rd-template`) onto
  `#graph-container` inserts at the drop point.
- The left tab bar wraps (no cut labels at ~230px); tests in `src/ui/templates/__tests__/`.

### Railway object data (`src/railway/`, right panel "Data" and "Checks")

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
  track, Point Left/Right -> points with hand, Train/Train Connected -> train; MA/Distance/Line/Gradient/SSP: none)
  through the palette option `prepareInsert` -> `insertEntry(..., prepare)` (same undo step, only single-cell
  entries, only `ertms-*` entries, not draw.io palettes); app railway shapes by style shape (`kindForStyle`, drop
  handler in `main-editor.ts`). Templates/paste keep the data they carry.
- **Diagram settings** (`project-settings.ts`): root cell (id 0) attribute `rdCountryId` = default NID_C of the
  diagram (missing = `DEFAULT_COUNTRY_ID` 510, Poland; invalid = no default); balise groups without NID_C use it
  (`applyProjectDefaults` in `validateModel` and the railML export -> `countryID`; the drawing is not changed). Edited
  in the Data panel with nothing selected ("Diagram railway settings", `#rd-rw-country`, one undo step); a balise
  group's empty NID_C field shows it as placeholder. Library templates do not pin NID_C (they follow the diagram).
- **Checks** (`validation.ts`, model only, `geometry.ts` for absolute positions): duplicate-id, required (ID error,
  NID_C/NID_BG warning; NID_C only when the diagram has no usable default), invalid-value, unknown-kind, balise-without-group (error), group-count / group-position
  (warning), missing-reference (error), signal-off-track (warning: centre > `SIGNAL_TRACK_DISTANCE` 40 px from its
  track, or from every track when it names none and tracks/sections/points exist), km-order (warning: majority
  direction of km along the track polyline, needs >= 3 objects), km-outside-track (warning).
- **UI** (`install-railway-data.ts`, called from `main-editor.ts` after `installScenarios`): right-panel switch is
  generic now (`installRightPanelSwitch`: buttons' `aria-controls` name the panels, `right-panel-view` window event):
  Properties | Data | Checks | Scenarios. `data-panel.ts`: kind select (+ none), fields (enum select, ref inputs with a
  datalist of IDs, problems from the last check under the field), multi-select edits common fields ("(mixed)", ID
  disabled). Edits go to the cells the fields were rendered for (a field's blur `change` fires after a canvas click
  already changed the selection). `checks-panel.ts`: Run checks, Live (debounced 400 ms on model changes; localStorage
  `rd.railway.liveChecks`), badge on the switch, issue click selects the cell, "Edit" opens Data on the field, report
  buttons. Global listeners bound to the active tab's selection/data model (rebound on `tab-changed`/`tab-closed`).
  Menus dispatch window events: `railway-edit-data-request` (Railway > Edit Data…, context menu Edit Data...),
  `railway-checks-request` (Railway > Run Checks, toolbar `#btn-railway-checks`), `railway-export-request` (File > Export > Railway Data submenu,
  `data-action="exportRailway:<report>"` handled in `MenuController.executeMenuAction`).
- **Reports** (`report.ts`, `xlsx.ts`): signals, balises + groups, tracks + sections, points, all objects; sorted by km
  (`km`, else `kmStart`; none last), then kind order, then natural ID order. CSV = UTF-8 BOM, CRLF, RFC 4180 quoting,
  formula injection guarded (`'` prefix unless numeric). `.xlsx` = dependency-free stored ZIP (CRC32) with one sheet
  per report (inline strings, numbers as numbers, bold frozen header).
- Tests: `src/railway/__tests__/` (catalogue + real ERTMS library mapping, object data round trip/undo/insert,
  every rule, CSV/xlsx, panels with real tabs).

### Railway engineering tools (`src/railway/`: topology, routes, snapping, km)

- **Topology** (`topology.ts` `buildTopology(objects)`, model only): links = cells of kind track/trackSection/points
  with a centre line (edges, or vertices whose long side >= 3x the short side, >= `MIN_LINK_LENGTH` 15; a 10x12 TC marker
  is no link). A points edge (ERTMS "Point Left/Right") is the diverging leg; a compact points vertex is a junction node.
  A section lying on a track (ends + middle within `JOIN_TOLERANCE` 8) is not a link but names the track pieces it covers.
  Links are cut where another link's end, a points vertex or a covering section's end touches them; ends within 8 are
  one node (edges with vertex terminals end at the vertex centre). Node with 3 pieces + a points leg (or at a points
  vertex) = points junction: reverse = leg (vertex: piece outside the straightest pair), toe = straight piece most
  opposite to reverse. `passage()`: turns over 90° impossible; toe<->normal needs normal, toe<->reverse reverse,
  normal<->reverse impossible. **Direction convention** (confirmed project convention, not an assumption): nominal =
  left to right, i.e. increasing x (vertical pieces: increasing y), like the ERTMS "Signal Right" symbol; reverse =
  the opposite. `locate()` puts objects on the nearest piece within 40, preferring their `rdTrackId`.
- **Routes** (`routes.ts`): `findRoutePaths(topo, entry, exit)` = DFS from the entry signal in its direction (none =
  both), each piece once, stops at the next signal facing the same way, ends when passing the exit signal in its
  direction; returns all paths (shortest first, max 8, deduplicated) with points + required positions, sections in
  order (`blockOf`: section, else track; points legs skipped), overlap (first section beyond the exit signal, normal
  preferred), length (metres from the link's `rdLength` or km span; drawing units where unknown -> `approximate`).
  Route kind fields: entry/exit signal, `points` (text `W1:normal, W2:reverse`; `parsePointsList` also takes N/R/+/-),
  `sections`, `overlap` (refLists), `length` [m]. `detectConflicts` = pairs sharing a section (path or overlap) or
  needing opposite points positions; `buildRouteTable` / `buildConflictTable` -> report.ts `Table`s.
- **Route objects** (`route-store.ts`): an edge per route on its own layer `rd-routes` ("Routes", a root child, saved as a
  draw.io layer), translucent orange, label `%rdId%`, `movable/bendable/editable=0`; `addRoute` = one undo step (layer
  if missing + edge + the ID appended to the entry signal's `rdRoutes`). Railway > Show Routes toggles the layer's
  `visible` directly (view state, saved with the file, not undoable). Railway > Update Route Paths recomputes
  geometry/length from the drawing (path with the stored sections). Route edges are selectable -> Data panel edits them.
- **Route tool** (`route-tool.ts` `RouteTool`): toolbar `#btn-route-tool` / Railway > Route Tool; while active a
  capture-phase listener on `#graph-container` swallows pointer events (no selection/moves), hit test `signalAt`
  (bounds + 6, else nearest centre within 25). Floating panel `.rd-route-tool` (status, path radios
  `.rd-route-path`, ID input prefilled `R<n>`, "Create route"), highlight in `graph-overlay.ts` `GraphOverlay` (SVG
  group in the view's overlay pane, transform = scale/translate, not in the model). Esc/✕ leaves; tab switch leaves.
- **Tables** (`route-tables-dialog.ts`): Railway > Route Table… / Interlocking Table… -> `.rd-route-dialog` with tabs
  Routes / Interlocking, Export CSV (shown tab, `<diagram>-routes.csv` / `-interlocking.csv`) and XLSX (both sheets).
- **Checks** (`route-checks.ts`, run from `validateObjects`): `route-endpoint` (no entry/exit, same signal, endpoint
  of another kind; the generic missing-reference skips such IDs), `route-path` (no path in the signal direction, or
  sections not a continuous path), `route-points` (syntax, unknown/contradictory points, missing or wrong required
  position; warning: listed points not on the path). Conflicts are not issues (interlocking table).
- **Snap to track** (`snap.ts`): signals, balises, axle counters, LEUs inserted or moved so that the gap between the
  shape and a track/section line (centre distance minus the half extent across the line) is at most `SNAP_RADIUS_PX`
  15 screen px (`snapGapAtScale`: 15 / zoom graph units) and the nearest line point is not beyond a track end (the snap
  only moves perpendicular to the track) are put on it (balise/axle counter centred; signal on the right-hand side of its travel direction:
  nominal = below a left-to-right track, reverse above; LEU nominal side; gap `SNAP_GAP` 4), get `rdTrackId` (track
  preferred over a section drawn on it) and, when the track has km start/end, `rdKm`. Runs in the model's
  `BEFORE_UNDO` (like maxGraph's LayoutManager), so it is part of the same undo step; ignores edits with a RootChange
  (loads, snapshots). Off while Alt is held (window capture listeners track `altKey`), data-only for arrow-key nudges
  (`withSnapDataOnly`). While dragging (SelectionHandler), the track a drop would snap onto is outlined (`CellHighlight`
  `#00a8ff`, class `rd-track-snap-highlight`, graph div `data-rd-track-snap=<track id>`; `previewSnap`). Railway > Snap
  to Track, localStorage `rd.railway.snapToTrack` (default on). Installed on every tab graph (`installRailwayRoutes`
  sweeps on start/`tab-changed`). `SNAP_DISTANCE` 40 is only the "belongs to the track" distance (Railway Script sync).
- **km** (`km.ts`): linear from km start (first point of the centre line) to km end; Railway > Recalculate km sets `rdKm`
  of objects naming a track with km start/end (within 60, rounded to metres, one undo step). Railway > km Ruler (toolbar `#btn-km-ruler`)
  (localStorage `rd.railway.kmRuler`): ticks/labels (`12+345`) along the selected track(s) in an overlay; round step so
  ticks are >= 40 units apart, every 5th step and the ends labelled.
- Wiring (`install-railway-routes.ts`, one call in `main-editor.ts`): menu items `data-action="railwayRoute:<cmd>"`
  (tool, routeTable, conflictTable, updateRoutes, recalcKm, toggleSnap, toggleRoutes, toggleKmRuler) -> MenuController
  dispatches window event `railway-route-request`; `aria-checked` kept in sync. `getRailwayRoutes()` returns the handle.
- Tests: `src/railway/__tests__/routes.test.ts` (topology incl. sections/vertex points, path search over points and
  signal directions, route tool, route object draw.io round trip + undo, conflicts/tables, route checks, snapping math +
  undoable snap, km interpolation/recalc/ruler), `tests/e2e/ertms-routes.spec.ts`.

### Object states (`src/railway/states.ts`, `state-apply.ts`, `state-menu.ts`, `install-railway-states.ts`; docs/STATES.md)

- Runtime states (not infrastructure, not exported to railML): `rdState` (sections/tracks/points/routes: free | occupied |
  reserved | overlap | locked | disturbed; level crossings open | closed | disturbed; balises/LEUs/axle counters free |
  disturbed), `rdAspect` (signals except marker boards / stop markers: stop | proceed | caution | shunt | dark), `rdPosition`
  (points: the catalogue field, normal | reverse | moving | outOfControl). Missing = default (free / open / stop / normal) =
  as drawn. **One table** `STATE_SCHEME` + `STATE_COLORS` (saturated, >= 3:1 on white and >= 4.5:1 on #121212, so the dark
  rendering keeps them unchanged; unit-tested). Occupied
  also draws the line thicker (`widthScale` 1.5, at least +2; drawn width kept in `rdBaseStyle`) so it differs from tracks drawn red.
- `applyObjectStates` = attributes + style keys (`strokeColor`/`fillColor`/`gradientColor`/`dashed`/`dashPattern`/`opacity`)
  of the object, its drawn parts (groups) or a signal's lamps (round-ish filled leaf vertices; else the signal's own fill)
  via `applyStyleToCells`, ONE undo step; the drawn values are remembered in `rdBaseStyle` (JSON per part path) and put back
  exactly (key order + remembered draw.io string: `applyStyleToCells` now copies `copyRawDrawioStyle`, so a reset saves
  byte-identical styles; tested on every ERTMS template). Reset State keeps `rdPosition` (data), drops state/aspect/look.
  `runRouteCommand` set / occupy / release (sections, overlap, points with `rdRouteRestore`, entry signal);
  `occupyUnderTrains`.
- UI: context menu section `[data-rd-state-menu]` before Edit Data (State ▸ / Aspect ▸ / Position ▸ as `.rd-ctx-sub` with
  `position: fixed` `.rd-ctx-submenu` lists of `menuitemradio`s `[data-state-cmd]`, route/train items, Reset State; hover or
  →/Enter opens, ←/Esc closes); Railway > Object State ▸ (`data-action="railwayState:<cmd>"` -> window event
  `railway-state-request`, handled on the active tab's selection); State Legend (`rd.railway.stateLegend`); Data panel
  State/Aspect selects (points Position field applies its look). Scenario diff: `TC3: free → occupied`, colour keys and
  lamp parts folded in (`describeStateChanges`). railML export skips the state attributes and writes the drawn style.
- Keyboard: Alt+F/O/R (free/occupied/reserved), Alt+N/V (points), Alt+1..4 (aspects) on the selection
  (`state-shortcuts.ts` by `event.code`; keydown listener in install-railway-states.ts, canvas focus only; hints via
  `ACTION_SHORTCUTS['railwayState:<cmd>']`, context menu kbd, Help section "Object states").
- Points reverse: the straight continuation (part of the track) is faded by a view overlay (`points-fade.ts`
  `installPointsFade` per tab graph from install-railway-states: topology junction -> normal piece for the leg's
  length, canvas-coloured line at 70 % in the overlay pane, class `rd-points-fade`; not in the model/exports).
- Tests: `src/railway/__tests__/states.test.ts`, `states-templates.test.ts`, `points-fade.test.ts`, `tests/e2e/object-states.spec.ts`.

### railML 3.2 (`src/railml/`, details and the full table in docs/RAILML.md)

- **UI** (`install-railml.ts`, main chunk, called from `main-editor.ts` after `installRailwayRoutes`): File > Import >
  railML 3.2… (`data-action="importRailml"`), File > Export > railML 3.2… (`exportRailml`) -> `MenuController` dispatches
  window event `railml-request` `{action}`; File > Open (`MenuController.openProject`, accepts `.railml`) and a file
  dropped on `#graph-container` whose root is `<railML>` (`looksLikeRailml`) -> `{action:'open', text, name}`. The
  handler lazy-loads `railml-ui.ts` (dialogs `.rd-railml-dialog` on the `.rd-route-dialog` classes, `railml.css`,
  tokens only; `data-testid` `railml-export-dialog` / `railml-import-dialog`).
- **Export** (`export.ts` `exportRailml(model, {title, date, extension, pretty})`, pure, jsdom): runs `validateModel`
  first (counts in the dialog, never blocks). Topology = one `netElement` per `buildTopology` piece, oriented nominal
  (increasing x / y), so `applicationDirection` normal = our nominal; length in m (track length/km scale, else
  drawing units); ends' km as `linearCoordinate` on `lps01` (m); `netRelation` per piece pair at each node
  (positionOnA/B, navigability from `passage()`: Both/None); `networks/network/level Micro`. Objects located with
  `locateObject` (points: toe piece at the junction) -> `spotLocation` (`intrinsicCoord`, `applicationDirection`,
  km). `infrastructureVisualization` = piece polylines + cell centres. Objects sorted by kind, natural ID (stable
  output). Result: `xml`, `counts`, `unplaced` (no location), `extensionOnly` (LEU, train), `issues`, `preserved`.
- **Mapping** (`mapping.ts` `KIND_MAPPINGS`; prefixes `sig_ bal_ bg_ trk_ sw_ tvd_ tde_ ij_ bus_ lc_ rbc_ rt_`, IL `il_`):
  track -> `track` + `linearLocation`; points -> `switchIS` (ordinarySwitch, branchCourse = hand, left/rightBranch
  netRelationRef) + `switchIL`; signal -> `signalIS` (main/shunting: isTrainMovementSignal + signalConstruction light;
  marker board/stop marker: isEtcsSignal + board) + `signalIL@function`; insulatedJoint -> `trainDetectionElement` type insulatedRailJoint (+ demarcation like axle counters); balise -> `balise` (belongsToBaliseGroup,
  isEurobalise positionInGroup = position-1); baliseGroup -> `baliseGroup` (applicationType ETCS, isEurobaliseGroup
  countryID/groupID); axleCounter -> `trainDetectionElement` axleCounter; trackSection -> IL `tvdSection`
  (hasDemarcatingTraindetector; no location in 3.2); bufferStop, levelCrossing (`protection`) -> IS; rbc -> IL
  `radioBlockCentre`; route -> IL `route` (routeEntry/Exit refersTo signalIL, facing/trailingSwitchInPosition
  left/right, hasTvdSection, overlap). **Unmapped**: leu, train (rd extension only). Name + `designator
  register="_RailwayDrawer" entry=<rdId>` on every object.
- **rd extension** (`rd:railwayDrawer` last root child, ns `https://railwaydrawer.mksystemdesign.org/railml/rd/1`,
  option in the dialog): `rd:object kind ref` with the fields railML does not hold (aspects, remarks, km start/end,
  route length, ...), single-cell `style`/`w`/`h`, `netElements` of points legs/section lines, `v_*` value attributes.
- **Import** (`import.ts` `importRailml(text, {symbols})` -> `{modelXml, model, name, warnings, counts, preserved,
  usedVisualization}`; UI: new tab via `createTab` + `saveLoadController.load`, notes dialog): layout from the
  visualization when every netElement has a projection, else generated (left to right, km/length, diverging branch
  one lane down/up by branchCourse); cells with the ERTMS library entries (`loadErtmsLibraryEntries`: Track, Point
  Right, Signal Right 3/4, Signal Left 3, (Single) Balise Right/Left, TC, Train), simple shapes otherwise; routes
  re-created on `rd-routes` through the drawn topology (undrawn TVD sections -> sections from the drawing, railML list
  kept in `rdRailmlTvdSections`); objects without location in a row below. Imported ids kept in `rdRailmlId`,
  `rdRailmlIlId`, `rdRailmlNetElements` (export reuses them: export -> import -> export is byte-stable).
- **Preserved** (`preserve.ts`): unknown railML (containers by path, children/attributes of mapped objects by owner id
  `<id>` or `<id>/<child>`) in the root cell's data attribute `rdRailml` (draw.io diagram data; saved/cached), written
  back by the export (`applyPreserved`, schema order from `schema-order.ts`).
- **Validation**: `structure.ts` `checkRailmlStructure(doc)` (required attrs/children, enums, NCName unique ids,
  typed references), shown in the export dialog; the XSD is not vendored (railML.org licence: restricted CC BY-NC-ND
  4.0, distribution only via railML.org) -> `scripts/railml/validate.ts` (xmllint, `RAILML_XSD`).
- Tests: `src/railml/__tests__/` (`railml-export.test.ts` spec layout vs `fixtures/spec-layout.expected.railml`,
  directions, unplaced, pure railML, structure checks; `railml-import.test.ts` `station-topology.railml` /
  `station-visualization.railml`, preservation, .drawio round trip of the store, byte-stable round trips;
  `railml-mapping.test.ts` every kind mapped + documented), `tests/e2e/railml.spec.ts`.

### Railway Script (`src/railway-script/`, left-panel tab "Railway Script", docs/RAILWAY-SCRIPT.md)

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
  `page.scale`, y from lanes; auto lanes from points hand; legs to the diverging track's nearer end), `build.ts` (cells with
  `src/railml/schematic.ts` = `ModelBuilder`/`Symbols`/fallback styles moved out of the railML import and shared; routes via
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
- Storage: `ProjectService.railwayScript` (`RailwayScriptStore`, `script-store.ts`, main chunk) -> main page `<diagram
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

### Scenarios (`src/scenarios/`, right panel "Properties | Data | Checks | Scenarios")

- Per tab (diagram): `ScenarioSet` (`scenario-model.ts`) held by the tab's `ProjectService.scenarios`
  (`saveLoadController.getScenarios()`); a scenario = id/name/description + ordered steps; a step =
  id/name/description + three parts: `xml`, a snapshot of the tab's whole drawing (`serializeToXml()`, a draw.io
  `<mxGraphModel>`), `uml` (PlantUML source, usually a sequence diagram; '' = none) and `text` (Markdown; '' = none).
  `cleanMultiline` normalizes both: `\n` line ends, tabs -> 4 spaces, XML-invalid control characters dropped, cap
  100 000 chars (attribute normalization would turn literal tabs/CRs into spaces in draw.io).
  Reads return copies; changes notify subscribers. `sanitizeScenarios` cleans untrusted data (cache, files):
  unique ids, names capped (80/200), steps without a model dropped.
- **File format** (`scenario-format.ts`): main page first, with `rdScenarios='{"v":1,"scenarios":[{id,name,description}]}'`
  on its `<diagram>` (order, empty scenarios); then one page per step, `name="<Scenario> / <n>. <step>"`, attributes
  `rdScenarioId rdScenarioName [rdScenarioDescription] rdStepId rdStepName [rdStepDescription] [rdStepUml] [rdStepText]`,
  page id = step id when unique; then the preserved non-scenario `extraPages`. `rdStepUml`/`rdStepText` are only written
  when non-empty; newlines are character references (`&#10;` from Chrome's XMLSerializer, `&#xa;` from `xmlUtils.getXml`),
  which draw.io's save keeps (verified against draw.io v32.4.1 while the embed mode existed). Decision: no extra text cell is added to the step page
  for draw.io viewers (it would change the snapshot); draw.io shows the attributes only in the file. draw.io v32.4.1 keeps unknown `<diagram>` attributes
  (page node kept as `DiagramPage.node` and cloned on save, Pages.js:12 / EditorUi.js:2520; also on "Duplicate page",
  so duplicate step ids are made unique on load) — verified live against draw.io v32.4.1 (former embed spec). Parse:
  pages with `rdStepId`/`rdScenarioId` become steps (compressed pages ok; an unreadable one stays a kept page),
  scenarios in index order, then scenarios only named by step pages; `extraPageNames` (the "only the first page is
  shown" warning) lists only non-step pages. Loading a file replaces the tab's scenarios.
- Cache: `CacheData.tabs[].scenarios` (only when non-empty; restored even if the drawing fails). Steps duplicate the
  model, so adding/updating a step flushes the cache at once and warns when storage is full (plus the usual indicator).
- Share links: `buildShareMxfile` gets `pageAttributes` + `scenarioPages` (after the tab's page, before its kept pages);
  `splitSharedFile` keeps step pages with the page before them (tabs, not pages, count against `MAX_SHARED_PAGES`).
  Remote providers save `getProjectXml()`, so scenarios are included.
- View (`scenario-view.ts` `ScenarioViewer`): a separate disabled Graph (`configureDiagramRendering` from
  `src/ui/diagram-graph-setup.ts`, shared with tab graphs, + stencil autoload) mounted in `#graph-container` while the
  live tab div is only hidden: the live model, selection and undo history are never touched. Banner "<Scenario> — step
  i/n: <step>", Prev/Next, "Replace drawing with this step…" (confirm; `replaceDrawingWithSnapshot` = one undoable
  root change), "Back to editing". `body.rd-scenario-viewing` disables menu bar, toolbar, left panel and properties.
  Closes on tab switch/close and when its steps are deleted; follows renames/updates/reorders.
- **Side panel** of the view (`aside.rd-scn-side`, right of the canvas): UML on top, Markdown below, re-rendered only when
  the step's `uml`/`text` changed (stale async UML results dropped); Prev/Next/keys switch drawing + UML + text together;
  collapse toggle `.rd-scn-side-toggle`, state in localStorage `rd.scenario.sidePanel` (`collapsed`|`open`).
- **Step editor** (`step-editor.ts` `openStepEditor`, used by "+ Add step" and ✎): `.rd-tpl-modal.rd-scn-editor` with
  `template-name`/`template-description` inputs (same as the template dialogs, so old tests/flows work), drawing fieldset
  (add: current drawing captured; edit: radio keep / replace with current drawing), PlantUML textarea `step-uml` + preview
  `.rd-scn-uml-preview`, Markdown textarea `step-text` + preview `.rd-scn-md-preview` (debounced 300 ms), "Server…" row for
  the optional PlantUML server. Enter in a text field or Ctrl/Cmd+Enter saves, Enter in a textarea is a newline, Esc
  cancels; no click-outside cancel. Steps show UML/Text badges in the list.
- **PlantUML** (decision): the app's PlantUML tab (`plantuml-parser.ts` + `*-diagram-renderer.ts`) builds maxGraph cells
  and only knows participants/plain messages/one-line notes, so steps use a new local renderer
  `src/services/plantuml-sequence-svg.ts` (PlantUML text -> SVG string, offline): participants (all 8 kinds, aliases,
  colours, stereotypes), `->` `-->` `->>` `<-` `<->` `->x` `->o` `[->` `->]` `-[#c]>`, self messages, `\n`, autonumber,
  notes (left/right/over, multi-line, hnote/rnote), ref, alt/else/opt/loop/par/break/critical/group (nested),
  activate/deactivate/destroy, `++`/`--`/`return`, `== divider ==`, `...` delays, `|||`, title; unknown lines -> warnings
  shown under the diagram. Text width is estimated (no canvas). All text escaped, colours validated.
  `step-uml.ts` `renderStepUml`: sequence -> local; other diagram types -> PlantUML server only if the user set one
  (`src/services/plantuml-server.ts`, localStorage `rd.plantuml.server`, no default: nothing is ever sent otherwise);
  GET `<server>/svg/<encoded>` (UTF-8 -> deflate-raw via CompressionStream -> PlantUML base64 `0-9A-Za-z-_`),
  credentials omitted, no referrer, 15 s timeout, answers sanitized (`sanitizeSvgMarkup`: no script/foreignObject/on*,
  only `#`/data:image hrefs), cached per server+text; errors are shown ("PlantUML server offline — …", HTTP status).
- **Markdown** (`markdown.ts`, in-house, no dependency): headings, paragraphs, hard breaks, emphasis/strong/strike, code
  spans/fences, quotes, nested lists, task items, pipe tables (alignment classes), hr, links (http(s)/mailto/#, always
  `target=_blank rel="noopener noreferrer"`), autolinks, images (https or base64 data:image only). Raw HTML is shown as
  text; output then goes through the allow-list `sanitizeHtml` (DOM, `<template>`) before insertion/export.
- **Export** (`scenario-export.ts`): File > "Export Scenario (HTML)…" (`data-action="exportScenarioHtml"` -> window event
  `scenario-export-request` -> `install-scenarios.ts`: the scenario shown, else the only one with steps, else a chooser)
  and ⇩ per scenario in the panel. One self-contained HTML file `<diagram> - <scenario>.html`: CSP meta (no scripts),
  per step drawing as `data:image/svg+xml` `<img>` (`renderXmlToSvgDocument` from diagram-image-export),
  UML inline SVG, sanitized Markdown; steps break pages when printed (for the later PDF).
- **Step diff** (`scenario-diff.ts`, pure XML/DOMParser): `diffSnapshots(prev, cur)` matches drawable cells by id: added,
  removed, moved (geometry x/y/parent, size; edges: terminals/points = rerouted) and changed (style keys, label — HTML stripped
  only with `html=1` — and `<object>` data attributes, e.g. `rdAspects` -> "S2: aspects changed"); moved wins over changed for
  the colour. `buildDiffHighlightXml` returns a NEW model XML (snapshots never change): the step plus highlight cells
  (`rdDiff=<kind>` style; outlines green #2e7d32 / blue #1565c0 / orange #ef6c00, red dashed ghost #c62828 with the old name
  at the old absolute place, edges as thick polylines) in an own top layer `rd-diff-layer` (last root child = drawn
  top-most in the view and in the image exports, which draw every visible layer; the old `inFirstLayer` option is gone).
- **View additions** (`scenario-view.ts`, CSS `scenario-doc.css`): banner "Show changes" check box (localStorage
  `rd.scenario.showChanges`) -> the view graph loads the highlight copy, legend `[data-testid=scenario-diff-legend]` over
  the canvas, side-panel section "Changes" (`.rd-scn-side-changes li[data-kind]`, counts), `data-diff-added|removed|moved|changed`
  on the view; first step: "nothing to compare". Autoplay (`scenario-autoplay.ts` `ScenarioAutoplay`): ▶ Play/⏸ Pause
  `.rd-scn-play-btn`, interval select (1/2/3/5/10/20 s, default 3), Loop; settings in localStorage `rd.scenario.autoplay`;
  stops at the last step (Play there restarts from step 1), manual Prev/Next restarts the interval, closing the view pauses.
  Keys: Space = `toggle-play` in `scenarioKeyAction`; keys on focused check boxes/radios/buttons navigate (only text inputs,
  selects, textareas pass).
- **PDF** (`scenario-pdf.ts` + `pdf-layout.ts` + `pdf-fonts.ts`, all dynamic imports from `install-scenarios.ts`): decision —
  jsPDF 4.2.1 + svg2pdf.js 2.8.1 (pinned, lazy chunks; jsPDF's optional html2canvas/purify chunks are emitted but never
  loaded) give a real file without a print dialog; browser print-to-PDF cannot be triggered without the dialog. Title page
  (name, description, diagram, date, step list with page numbers + internal links), per step: "Step i of n", name,
  description, drawing (raster PNG 2x via `renderXmlToSvgDocument` + canvas: maxGraph SVG uses `<foreignObject>` for HTML
  labels, which svg2pdf cannot draw), optional changes legend/list, UML as VECTORS (svg2pdf; fonts mapped to the doc
  families; regular face set first because svg2pdf inherits the current style; raster fallback), Markdown laid out as PDF
  text (headings, paragraphs with bold/italic/code/strike/links as link annotations, nested/ordered/task lists, quotes,
  code blocks, pipe tables with alignment, hr, data: PNG/JPEG images), footer "Page i of n". A4 portrait/landscape. Fonts:
  the standard 14 (Latin-1) unless any text needs more (`needsUnicodeFont`: Polish letters, ...) -> DejaVu Sans/Bold/Mono
  TTFs (npm `dejavu-fonts-ttf`, emitted by Vite as `?url` assets, ~1.8 MB, fetched only then, embedded whole: such PDFs are
  ~1–2 MB); fonts unavailable -> transliteration (`toLatin1`).
- **Slides** (`scenario-slides.ts`): one HTML file "<diagram> - <scenario> (slides).html": title slide + one slide per step
  (drawing as data: SVG img, optional Changes, UML inline SVG, sanitized Markdown). The only script is the constant
  `SLIDES_SCRIPT` (←/→, PageUp/PageDown, Space/Shift+Space, Home/End, F fullscreen, buttons, `#n`), allowed by its SHA-256
  in the CSP (`slidesScriptHash`, sync `sha256` from the GitLab PKCE module: works without crypto.subtle); selectors are
  scoped (`#deck > section.slide`, `nav.controls > [data-rd=…]`) so UML/Markdown content cannot hijack them. No JS: slides
  stacked; print: one per page. PPTX: not implemented (optional; would need pptxgenjs ~0.5 MB).
- Export wiring: File > Export Scenario (PDF)… / (Slides)… (`data-action="exportScenarioPdf|exportScenarioSlides"` -> the same
  `scenario-export-request` event with `detail.format`), panel buttons ⎙ (`.rd-scn-export-pdf`) and ▭
  (`.rd-scn-export-slides`); `exportScenarioDoc(format, id?)` opens `openScenarioDocDialog` (`scenario-doc-export.ts`:
  scenario select when several, A4 portrait/landscape remembered in `rd.scenario.pdfOrientation`, "Highlight changes"
  preset from the view's toggle). Tests inject `docDialog`, `renderDrawingPng`, `pdfDeps`.
- Templates store only cells (no scenarios), so they are unaffected; cache, share links and remote providers serialize
  the step pages/JSON and carry `uml`/`text` automatically.
- Keyboard: the dispatcher in `main-editor.ts` calls `scenarios.handleKeydown(e)` right after Ctrl+S; only while the
  view is open: ←/PageUp, →/PageDown, Home/End, Esc, Space (autoplay); editing shortcuts are prevented, every other key is stopped
  (`scenario-keys.ts` `scenarioKeyAction`); fields/IME and Ctrl+S pass.
- Panel (`scenarios-panel.ts`, `#scenarios-panel`): "+ New scenario", per scenario "▶ Present" (`.rd-scn-play`) + "⋯"
  (`.rd-scn-more`, role=menu `.rd-scn-menu`, position fixed, Esc/↑/↓): Edit… / Duplicate / Export HTML / Export PDF /
  Export Slides / Delete… (items keep the classes `.rd-scn-edit`, `-duplicate`, `-export`, `-export-pdf`,
  `-export-slides`, `-delete`), expandable step list (lazy 64x40 thumbnails from the palette's shared renderer; per step
  "⋯": Edit… / Update from drawing (confirm) / Duplicate / Move up / Move down / Delete…, classes `.rd-scn-step-*`;
  drag to reorder), "+ Add step"; names ellipsize with a title tooltip; targets >= 24 px. E2E opens "⋯" first. Dialogs = `promptTemplateDetails`/`confirmTemplateDialog`. Wiring:
  `install-scenarios.ts`. File > New opens a new tab (the current tab and its scenarios stay).
- Tests: `src/scenarios/__tests__/` (model, format/round trip/draw.io edits/share split, tabs + cache + view + keys +
  panel; `scenario-uml-text-format.test.ts` multi-line UML/Markdown round trips incl. a draw.io-style re-save, cache,
  share; `markdown.test.ts` rendering + XSS payloads; `scenario-uml-text-view.test.ts` editor/previews, side panel
  Prev/Next, collapse, edit keep/replace, HTML export), `src/__tests__/services/plantuml-scenario.test.ts` (sequence
  parser/SVG, encoding vs PlantUML's documented example, mocked server, no request without a server),
  `tests/e2e/scenarios.spec.ts` and `tests/e2e/scenario-uml-text.spec.ts` (any port). Scenario documents:
  `scenario-diff.test.ts` (kinds, data keys, edges, nesting, highlight XML in own top layer, drawn last by `cellsFromModelXml`), `scenario-pdf.test.ts` (real
  jsPDF in jsdom, streams inflated with node:zlib: pages, page numbers, Markdown text, link annotations, landscape, changes,
  real DejaVu files vs. transliteration, svg2pdf vs. raster fallback), `scenario-slides.test.ts` (structure, escaping, CSP
  hash = node:crypto SHA-256, navigation script run in jsdom), `scenario-doc-view.test.ts` (Show changes in the view graph,
  autoplay with fake timers, Space, exports through `installScenarios`, options dialog), `tests/e2e/scenario-doc.spec.ts`.

### AI assistant (`src/ai/`, docs/AI.md)

- One tool core for the in-app chat and MCP: `tool-defs.ts` (12 tools, JSON Schemas, `additionalProperties: false`),
  `schema-check.ts` (strict validator, also used by the Worker / local server), `tools.ts` `executeAiTool(target, name,
  input)` (never throws; at most ONE undoable edit per call, edits reported for "Undo AI turn"), `target.ts` `AiTarget`
  (graph, undo, Railway Script store/session, optional catalogue/templates/render/download), `app-target.ts` (the ACTIVE
  tab, resolved per call), `shape-search.ts`, `system-prompt.ts` (Railway Script reference generated from catalogue +
  language tables + `SCRIPT_TEMPLATES`; deterministic for caching). Pure modules (no DOM at import): tool-defs,
  schema-check, system-prompt, bridge/protocol, bridge/relay, mcp/* — keep them so (the Worker bundles them).
- Chat: right panel view `ai` (`index.html` `[data-right-panel="ai"]` -> `#ai-panel`; `install-ai.ts` in the main chunk
  lazy-loads `ai-panel.ts` with `@anthropic-ai/sdk`). `chat/chat-loop.ts` `ChatSession`: manual streaming loop on
  `client.beta.messages.stream` (user's key, `dangerouslyAllowBrowser`), adaptive thinking (summarized), effort, top-level
  `cache_control`, `eager_input_streaming` tools, `fallbacks: "default"` for models that support it, append-only history,
  30 tool rounds, Stop closes open tool_use blocks. `chat/settings.ts`: localStorage `rd.ai.settings` (key, model default
  `claude-opus-5-5`, effort, confirmChanges). Confirm mode applies, shows a diffSnapshots summary and waits Keep/Discard
  (Discard = `undoOwnEdits`). Assistant Markdown via scenarios/markdown.ts, images removed (no exfiltration via URLs).
- Bridge/MCP: `bridge/protocol.ts` (token `rdp1.<session>.<secret>`, SHA-256 hash via the pure-JS sha256 of gitlab/pkce.ts,
  frames, limits), `bridge/relay.ts` `BridgeRelay` (hello/claim, constant-time auth, expiry <= 12 h, one browser,
  60 calls/min, 180 s timeout), `bridge/client.ts` (browser WebSocket, sequential calls, backoff), `bridge/pairing.ts`
  (sessionStorage `rd.ai.pairing`, localStorage `rd.ai.local`, client configs), `mcp/mcp-server.ts`
  (`@modelcontextprotocol/server` McpServer, JSON Schemas as Standard Schema), `mcp/http.ts` (stateless `createMcpHandler`,
  Bearer or `?pair=`, 512 KB cap). Worker: `worker/index.ts` (`/mcp`, `/api/ai-bridge/<session>/ws` same-origin only,
  else ASSETS), `worker/ai-bridge.ts` Durable Object `AiBridge` (hibernation API, pairing in storage, alarm cleanup).
  Local: `tools/mcp-local/src` (`main.ts` stdio, `bridge-server.ts` ws on 127.0.0.1 with origin allow-list,
  `headless*.ts` jsdom + tool core on a `.drawio` file).
- Tests: `src/ai/__tests__/` (tools on a jsdom tab, system prompt, chat loop against a fake SSE Messages API, protocol/relay,
  MCP endpoint over HTTP, local bridge + headless file), `tests/e2e/ai.spec.ts`; the AI panel is in theme-contrast.

### Sharing (`src/share/`)

- `install-sharing.ts` (called from `main-editor.ts`) wires everything: top-bar `#share-btn` and File > Share…
  (`data-action="share"` -> `window` event `share-request`) open `share-dialog.ts`; File-menu items
  "Open from/Save to <provider>…" are generated into `#file-menu-remote-items` for available providers.
- **Link with the diagram** (`share-link.ts`, `share-mxfile.ts`): all tabs (+ each tab's preserved pages) as one
  `<mxfile>` (`buildShareMxfile`, unique page ids) -> `#R` + base64url(deflateRaw(encodeURIComponent(xml)))
  (CompressionStream). The app.diagrams.net link uses draw.io's exact format (`'#R' + encodeURIComponent(Graph.compress(xml))`,
  standard base64; EditorUi.js:9545 / App.js:6669). The reader accepts both alphabets and raw-XML `#R` links,
  caps the hash, the inflated stream and the decoded XML (5 MB), and never evaluates anything. Links over 32k chars get a warning.
- Incoming links (`share-open.ts`): on start and on `hashchange`, the hash is stripped (replaceState) and each page opens in a
  **new tab** via `SaveLoadController.loadProjectXml` (existing tabs kept; a lone empty tab is closed). The same
  `openDiagramFile` opens the removed draw.io view's leftover autosave once.
- Downloads: .drawio (all tabs), PNG/SVG of the current tab via `src/ui/diagram-image-export.ts` (draw.io-like
  export pipeline: `Graph.getSvg` layout, `Editor.exportToCanvas` rasterizing), Web Share API buttons only
  when `navigator.canShare` accepts the file.
- **Cloud providers** (`providers/types.ts`): `StorageProviderDescriptor` (main bundle: id, label, `availability()`,
  `load()` = dynamic import, `resumePendingSignIn`) and `StorageProvider` (account, `list(path)` browse
  containers->folders->files, `open`, `save(file, xml, expectedVersion)` -> conflict result, `saveAs(path, name, xml,
  fail|replace|rename)`, optional `createShareLink`). `providers/registry.ts` lists them (SharePoint, then GitLab).
  Dialogs (`ui/remote-dialogs.ts`) and the Share dialog render providers generically. Optional generic extensions
  (added for GitLab): `saveFields(ctx)` (extra save inputs: rendered in the Save-to browse dialog per location and
  asked by `saveBack` on Ctrl+S via `askSaveOptions`; values are passed as an extra last argument only when present),
  `conflictActions`/`resolveConflict` (extra buttons in the conflict dialog, `ConflictChoice` `action:<id>`),
  `SaveResult.note/link` (link shown by `showResultLink`), `openRef` + descriptor `incomingLink/clearIncomingLink`
  (`RemoteSession.openIncomingLinks`, run after `resumePendingSignIns`; `askSignIn` dialog so the popup has a user
  gesture), descriptor `settings` (runtime settings form in the Share dialog; on save the section is redrawn and
  `onProviderSettingsChanged` rebuilds the File-menu items and retries incoming links). `ShareLinkCapability`
  `typesLegend/audiencesLegend`. The pending-redirect key moved to `providers/pending.ts`.
- `remote-session.ts`: per-tab binding (provider id + ref + version), `SaveLoadController.setSaveHandler`
  redirects Ctrl+S / File > Save to `saveBack` (version conflict -> overwrite / save as copy / cancel); File > Save As…
  (`saveProjectToDisk`) always downloads. Status bar `#status-remote-item` "Stored in:". TabManager now dispatches
  `window` events `tab-changed` (switchTab) and `tab-closed` (closeTab).
- **Bindings persist with the tab cache** (`remote-binding.ts`): `CacheData.tabs[].remote` = `{ v: 1, providerId, ref,
  version, name, location, webUrl?, parentPath, savedAt, dirty }` (optional field, cache version stays `'1'`; old caches
  restore unbound; unknown `v`/malformed -> ignored; credential-like keys are stripped on write and read; tokens stay in
  the providers' own storage). `restoreFromCache` runs before sharing, so TabManager keeps each tab's raw entry
  (`takeCachedRemote`) until `installSharing` calls `restoreBinding`, then writes through
  `setRemoteCacheWriter(remoteSession.persistedBinding)`. Bind/save/reload/unlink flush the cache at once.
  A restored binding is **unverified** (`data-verified` on the status item) until the next save/reload: `saveBack` asks
  `askSignIn` first when the provider has no account, sends the stored version (remote changed -> conflict dialog) and,
  when a call fails because the session ended (account gone), asks to sign in and retries once (`withSignIn`).
  Actions (active tab): File menu "Reload from <provider>…" / "Unlink from <provider>" (in `#file-menu-remote-items`,
  rebuilt on tab change/binding change) and the clickable status item's popup (`ui/remote-menu.ts`: Save now, Reload,
  Unlink, Open in <provider>). Reload = confirm (`askConfirm`, "Discard the changes" when dirty) -> provider
  `reopen(file)` (optional `StorageProvider` method; SharePoint downloadText, GitLab read) -> `loadProjectXml` into the
  same tab. Unlink keeps the content. File > Open from disk (`SaveLoadController.onLocalFileOpened`) unbinds.
- **Dirty tracking**: fingerprint (`contentFingerprint` of `getProjectXml()`) at the last open/save; model/scenario
  changes (`watchTab`) re-check it debounced (300 ms), so undo back to the saved state is clean. `dirty` is persisted;
  a tab restored dirty stays dirty until saved/reloaded. UI: `.rd-remote-dirty-dot` in the tab (TabManager
  `setTabDecorator`), `data-dirty` on the status item; the tab × asks (`setCloseGuard` -> `confirmCloseTab`,
  `window.confirm`) and `beforeunload` prompts only when a bound tab has unsaved remote changes.
- **Test provider** (`src/debug/fake-remote-provider.ts`, "Test storage", id `fake-remote`): registered by
  `installSharing` only when `import.meta.env.DEV` and localStorage `rd.fakeRemote` = `'1'` (production builds drop it:
  no `rd.fakeRemote` in `dist/`). Files in localStorage `rd.fakeRemote.files` (`{path: {xml, version: 'v<n>'}}`), save
  log `rd.fakeRemote.log`, signed-in flag sessionStorage `rd.fakeRemote.account`, `window.__rdFakeRemote.put()` to
  change a file "remotely".
- **SharePoint** (`providers/sharepoint/`, docs/SHAREPOINT.md): disabled unless `VITE_MSAL_CLIENT_ID` is set at build
  time (`VITE_MSAL_TENANT_ID` default `organizations`, `VITE_SHAREPOINT_DEFAULT_SITE` `host:/sites/Name`). vite.config.ts
  `define`s these keys (empty when unset) so `import.meta.env.VITE_MSAL_CLIENT_ID ? () => import(...) : null` is a
  constant: unconfigured builds contain no MSAL code and no SharePoint chunk. Plain http (except localhost) ->
  "SharePoint requires HTTPS — use https://railwaydrawer.mksystemdesign.org". `@azure/msal-browser` is pinned (5.24.0):
  popup with redirect fallback; msal 5 needs `broadcastResponseToMainFrame` on the redirect page, and the redirect URI is
  the app itself, so `main.ts` runs `auth-bridge.ts` instead of the editor when the URL carries `state`+`code|error`.
  `graph-client.ts`: Graph v1.0 via fetch (nextLink paging, 429/503 retry, PUT < 4 MB else upload session, If-Match ->
  412 `GraphConflictError`, createLink, invite). Scopes: Sites.Read.All (browse), Files.ReadWrite.All (content, links).
- **GitLab** (`providers/gitlab/`, docs/GITLAB.md): gitlab.com or self-hosted (also plain-http LAN). Config =
  build-time `VITE_GITLAB_URL`, `VITE_GITLAB_CLIENT_ID`, `VITE_GITLAB_DEFAULT_PROJECT` (vite.config.ts `define`s them,
  empty when unset) overridden by runtime settings in localStorage `rd.gitlab.settings` (Share > GitLab settings;
  only differences from the build defaults are stored; changing URL/app id drops tokens). Unlike SharePoint the chunk
  (`gitlab-loader.ts`) is always built and only loaded when configured+used. Availability: not configured / invalid
  URL / https page + http GitLab (mixed content) / ready. OAuth 2.0 code + PKCE S256 public client (`oauth.ts`,
  `pkce.ts` with a JS SHA-256 fallback because `crypto.subtle` is missing on the http LAN page), scope `api` (smallest
  that allows REST commits + MRs), `state` prefix `rdgl-`: `main.ts` routes such loads to `gitlab/auth-bridge.ts`
  before the SharePoint check. Popup opened synchronously in the click, answer via BroadcastChannel `rd-gitlab-auth`
  (GitLab's sign-in page sends COOP same-origin, so no opener); popup closed = rejected only when the app window has
  focus again; blocked -> redirect (flow record in sessionStorage `rd.gitlab.oauth.flow`, bridge stores the answer
  and `location.replace`s back, `completeRedirect` in the loader). Tokens in sessionStorage `rd.gitlab.auth`
  (localStorage with "Stay signed in"), refresh 60 s before the 2 h expiry and after 401 (single flight). REST v4
  client `gitlab-client.ts` (X-Next-Page / Link paging, file paths encoded incl. `.`, UTF-8 base64,
  400 "changed since you started editing" -> `GitLabConflictError`, 413/"too large" -> `GitLabTooLargeError`).
  Provider: projects (default, starred, member; search) -> branches -> tree; version = `last_commit_id` (new one via
  HEAD `X-Gitlab-Last-Commit-Id`); save = PUT with commit message + `last_commit_id`; saveAs = POST (optional new
  branch created from the base first, rename = `name (2).drawio`); MR checkbox (409 -> reuse the open MR); conflict
  action "Save to new branch" branches from the version you started from; 50 MB client cap. Share link
  `?gitlab=<project>:<branch>:<path>` (parts percent-encoded, `/` kept; parsed from the raw query) + GitLab blob
  URL; the descriptor stores it in sessionStorage `rd.gitlab.pendingOpen` and strips it. Status bar "GitLab: group/project › branch › path".
- Tests: `src/share/__tests__/` (link codec incl. draw.io's algorithm via node:zlib, Graph client with mocked fetch,
  dialog, remote session, provider, config; `gitlab.test.ts`: PKCE vectors, OAuth popup/redirect/refresh, bridge,
  client paging/errors, provider against an in-memory GitLab, config/links, descriptor; `gitlab-session.test.ts`:
  save fields, conflict actions, incoming links, Share-dialog settings; `remote-persist.test.ts`: binding format, restore +
  save back (sign-in, conflict), Reload/Unlink, dirty state), `src/__tests__/ui/remote-binding-cache.test.ts` (real
  TabManager + installSharing: old cache, reload round trip with the fake provider, close/beforeunload), `tests/e2e/share.spec.ts` (any port: copy
  link -> fresh context opens the tabs, downloads, damaged link, SharePoint "Not configured"), `tests/e2e/gitlab.spec.ts`.

## Deploy

- Production: **Cloudflare Workers Builds** on push (configured in the Cloudflare dashboard; reads
  `wrangler.jsonc`: Worker `worker/index.ts` + static assets `./dist` with SPA not-found handling; `run_worker_first` only
  for `/mcp` and `/api/ai-bridge/*`, every other path is served from the assets as before; Durable Object `AiBridge`,
  migration `v1` sqlite). The site is behind Cloudflare Access: `/mcp` needs its own Bypass application (docs/AI.md). `npm run deploy`
  (= build + `wrangler deploy`) does the same from a local machine; `npm run preview:cf` runs it in `wrangler dev`.
- LAN: `./deploy.sh` -> `npm ci`, `npm run build`, timestamped backup of
  `root@192.168.0.22:/var/www/html/railway-drawer`, scp `dist/`, verify. Served at
  `http://192.168.0.22/railway-drawer/`. Override the host with `SERVER_HOST=<ip> ./deploy.sh`.

## Tests

- Unit/integration: `src/**/__tests__/**/*.test.ts`, vitest + jsdom, setup `src/__tests__/setup.ts`.
  `@maxgraph/core` is inlined (`server.deps.inline`) because its ESM has extensionless imports;
  `--no-experimental-webstorage` keeps Node's own localStorage from shadowing jsdom's.
- `src/__tests__/ui/tab-cache-restore.test.ts` mirrors the startup sequence of `main-editor.ts`; keep them in sync.
