# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Railway Drawer: vanilla TypeScript + Vite web app for railway (ERTMS/ETCS) diagrams. Two editors in one page:
the **legacy maxGraph editor** (`@maxgraph/core` 0.10, default) and the **embedded draw.io editor**
(diagrams.net iframe with the ERTMS shape library). No framework, no React.

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
npm run test:parity         # maxGraph vs draw.io pixel comparison of every palette entry (see below)
npm run drawio:selfhost     # download + stage the self-hosted draw.io (dev/build do it automatically)
npm run drawio:palettes     # regenerate palettes + stencil sets from the pinned draw.io tag (Node >= 22.18)
```

CI (`.github/workflows/build-and-deploy.yml`) runs typecheck, typecheck:tests, lint, test:run, build and the
Playwright subset (legacy-smoke, drawio-palette, templates, scenarios, style-edit, share, gitlab, ertms-data,
scenario-uml-text, theme-contrast, remote-persist, drawio-embed, drawio-parity). `~/.cache/railway-drawer` (self-hosted draw.io) is kept with
`actions/cache` (key = hash of `scripts/drawio-selfhost/**` + `scripts/drawio-palettes/fetch-sources.ts`). It does not deploy.

### E2E and draw.io

draw.io mode and the draw.io specs use the **self-hosted** draw.io (`<app>/drawio/`, see "Self-hosted draw.io"
below): any port, headless, offline. `embed.diagrams.net` (only with `VITE_DRAWIO_URL=https://embed.diagrams.net/`)
answers **HTTP 403** to iframes whose Referer has a non-default port (`http://localhost:3000/`) and to the
`HeadlessChrome` user agent, so with it use `E2E_PORT=80` (macOS lets non-root bind :80).

- `tests/e2e/drawio-embed.spec.ts` (any port): self-hosted by default; aborts and fails on every request that
  leaves localhost and on every 4xx/5xx of a draw.io file. With `VITE_DRAWIO_URL` (the dev server and the spec
  both read it) it targets that editor and skips itself with a hint on a 403 / when unreachable / `E2E_OFFLINE=1`.
- The chromium project uses `devices['Desktop Chrome']`, which sends a normal Chrome UA even headless.
- `tests/e2e/legacy-smoke.spec.ts` works on any port (drop shape, Ctrl+Z/Ctrl+Y, switch to draw.io and back,
  draw.io mode loads no maxGraph module).
- vitest includes `src/**/*.test.ts` and `tests/e2e/parity/__tests__/**/*.test.ts` (the parity harness's
  own unit tests); Playwright only runs `tests/e2e/*.spec.ts` (`testMatch`). `tsconfig.json` only covers `src`.
- `tests/e2e/drawio-parity.spec.ts` (any port): renders every palette entry (7 draw.io palettes + ERTMS, 347) in
  the self-hosted draw.io v32.4.1 (`export` message from a host page routed at `<app>/__parity/drawio-host.html`;
  a routed `http://localhost/` page may not frame `localhost:<port>`: Chrome Local Network Access) — or in
  `VITE_DRAWIO_URL` (host page routed at `http://localhost/parity/drawio-host.html`) — and
  in the app through `window.__rdParity.render(xml, {scale, border, background})` (`src/debug/parity-hook.ts`,
  installed only in dev builds or with `?parity=1`; it mirrors draw.io's PNG export: an SVG at view scale 1
  laid out like `Graph.getSvg`, rasterized with `ctx.scale(scale)` like `Editor.exportToCanvas`, so
  rounding and the 0.5 px stroke offsets match; `__rdParity.svg(xml, opts)` returns that SVG for
  debugging), then compares them (`tests/e2e/parity/compare.ts`: best
  alignment within ±2 px, a pixel differs only if its colour is not found within 1 px in the other image;
  pixelmatch gives the strict count). pass <= 2 %, warn <= 6 %, fail above; accepted differences are listed
  with a reason in `tests/e2e/parity/expected-mismatch.json`. Do not edit `src/` while it runs: Vite reloads
  the page and the remaining entries error.
  Report: `test-results/drawio-parity/index.html`. `PARITY_FILTER=<palette|id>`, `PARITY_LIMIT=<n>`.
  Self-hosted: a missing draw.io fails. With `VITE_DRAWIO_URL`: skips itself on port != 80
  (`PARITY_ANY_PORT=1` overrides), offline (`E2E_OFFLINE=1`) or on a 403.
  Last full run (self-hosted v32.4.1, port 3102, headless, ~50 s): 339 pass, 0 warn, 0 fail, 8 expected (images x3,
  labels x2, lists x2, the Sankey link), ERTMS 40/40. Earlier run against embed.diagrams.net: 335 pass, 0 warn, 0 fail, 12 expected (images with draw.io-relative `img/` paths,
  sketch=1, `%date%` placeholders, the List templates draw.io's export does not lay out, the mermaid
  Sankey gradient band). ERTMS: 40/40 pass.
- `tests/e2e/drawio-palette.spec.ts` (any port): Shapes tab (no draw.io/Stencils tabs) renders the palettes, "More shapes…" toggles palettes and app groups, inserts keep draw.io styles, autosave
  writes real draw.io shape names.
- `tests/e2e/share.spec.ts` (any port): Share dialog, `#R` link round trip into a fresh browser context, downloads.
- `tests/e2e/gitlab.spec.ts` (any port): GitLab "Not configured" -> runtime settings -> Open/Save + sign-in button,
  File-menu items without reload, `?gitlab=` link on an unconfigured browser. Requests to the fake GitLab URL are
  intercepted and must not happen.
- `tests/e2e/remote-persist.spec.ts` (any port): dev-only fake provider (below): open a "remote" file, edit (dirty dot),
  reload (beforeunload prompt accepted), binding restored unverified, Ctrl+S saves with the stored version; after a
  reload signed out + remote changed -> sign-in dialog -> conflict dialog; status-bar menu Reload (confirm), File >
  Unlink (also after reload); File > Open from disk unbinds.
- `tests/e2e/scenarios.spec.ts` (any port): new scenario, 3 steps, ←/→ presentation, Esc restores the live drawing and
  its undo history, rename/reorder (↓ and drag)/delete step, reload, File > Save pages "<Scenario> / <n>. <step>",
  reopen; replace drawing (confirm, Ctrl+Z). `drawio-embed.spec.ts` also round-trips a scenario file through draw.io
  (incl. multi-line `rdStepUml`/`rdStepText` with quotes, markup and Polish characters).
- `tests/e2e/scenario-uml-text.spec.ts` (any port): step editor with PlantUML sequence + Markdown (live previews), 2 steps,
  view step 1 -> side panel UML svg + Markdown heading/list, Next -> step 2 content (drawing too), ← back, collapse kept
  over a reload, edit keeps the values, File > Save `.drawio` has `rdStepUml`/`rdStepText`, File > Export Scenario (HTML)
  has 2 drawings (data: SVG images), 2 UML SVGs and the Markdown. Fails if anything goes to a PlantUML server.
- `tests/e2e/templates.spec.ts` (any port): ERTMS palette 18 entries, Templates tab 22 ERTMS templates (search,
  insert, open as new diagram, drag), tab bar labels not cut, Save as Template… -> reload -> insert, rename, delete.
- `tests/e2e/ertms-data.spec.ts` (any port): ERTMS palette signal/balise get their kind and IDs on insert, Data panel
  fields (km chainage `12+345`, enum, text with Polish characters), duplicate signal ID -> Checks error + badge,
  click selects the cell, Edit -> fix clears it, Ctrl+Z/Ctrl+Y, File > Export Railway Data > Signals (CSV: BOM, rows),
  reload keeps the data, File > Save writes `<object rdKind=... rdId=...>`.
- `tests/e2e/theme-contrast.spec.ts` (any port): light and dark theme (localStorage `rd.theme` with the opposite
  system preference emulated, and View > Dark Mode both ways): opens every surface (menus + submenu, toolbar, left tabs
  Shapes/Templates/Layers/PlantUML/ERTMS, Properties canvas/Text/Style/Arrange, Data, Checks, Scenarios, scenario
  dialog + step editor + view, context menu, Save as Template (with error), Share, Keyboard Shortcuts, image upload,
  shape designer, all 4 notification types, status/tab bars) and requires WCAG contrast >= 4.5 (3 for large or
  symbol-only text; disabled exempt) between each visible text's color and its effective background (ancestors
  composited until opaque). Diagram content (tab graphs, thumbnails, SVG, canvas) is skipped. Offenders are listed as
  `theme: surface | selector | "text" | fg on bg = ratio`. Screenshots: `test-results/theme-contrast/<theme>-*.png`.
- `tests/e2e/style-edit.spec.ts` (any port): line color/width/dash and fill through the Properties panel on cells from an
  ERTMS template, a user template and the draw.io/ERTMS palettes (group first click, child second click); checks the
  cell's own style and the SVG. Reads the graph via `import('/src/services/service-registry.ts')` (dev server only).

## Architecture

### Boot: one editor per page load

- `index.html` is the static shell of the legacy editor (`#app-container`: top bar, menus, toolbar,
  panels, `#graph-container`, `#tabs-container`). Controllers bind to these ids. A `<style>` in `<head>`
  hides `#app-container` when `body[data-editor="drawio"]`, so draw.io mode never flashes the shell.
- `src/main.ts` only calls `startEditor({ loadLegacy: () => import('./legacy-main') })`.
- `src/drawio/boot.ts` resolves the mode (`src/drawio/editorMode.ts`: `?editor=drawio|legacy` > localStorage
  `railway-drawer-editor-mode` > `'legacy'`), sets `body[data-editor]`, then dynamically imports either
  `legacy-main.ts` or `drawio/workspace.ts`. Both are lazy chunks: draw.io mode never downloads the
  `maxgraph` chunk (vite `manualChunks`) and legacy mode never downloads the workspace.
- Switching = `switchEditorMode(mode)`: persist + full reload with `?editor=<mode>`. Never mount both editors.
  Legacy -> draw.io: top-bar toggle `.editor-toggle [data-editor-mode]` and View > "Switch to draw.io editor"
  (`data-action="switchEditorDrawio"` -> `MenuController` dispatches `editor-switch-request` on `window`);
  `legacy-main.ts` calls `tabManager.flushCache()` before reloading. draw.io -> legacy: the workspace's
  "maxGraph editor" button flushes the draw.io autosave first. Both sides `confirm()` before reloading when that
  write failed (storage full), since the reload would drop the unsaved edits.
- `src/legacy-main.ts` is the whole legacy boot: `registerDrawioCodecs()` first (before any file or cache
  load), shapes, `TabManager`, cache restore, the global keyboard dispatcher, drop handler, left panel,
  Shapes tab (shape toolbar + draw.io palettes), shape designer. `beforeunload` flushes the cache; the tabs are destroyed
  on `pagehide` (not persisted), because beforeunload can be cancelled (unsaved remote changes prompt).

### Theming (light / dark app chrome)

- One token set: `src/styles/variables.css` (imported by `style.css`; `drawio/workspace.ts` imports it too). Semantic
  colors are `--rd-*` (`--rd-bg`, `--rd-surface`/`-2`/`-3`, `--rd-hover`, `--rd-active`, `--rd-text`, `--rd-text-muted`,
  `--rd-text-subtle`, `--rd-border`, `--rd-border-strong`, `--rd-accent`(+`-hover`, `-text`), `--rd-link`, `--rd-focus`,
  `--rd-selected`, `--rd-input-bg/-text/-border`, `--rd-button-bg/-text`, `--rd-danger`/`-solid`/`-bg`, `--rd-success*`,
  `--rd-warning*`, `--rd-info*`, `--rd-hint-*`, `--rd-badge-*`, `--rd-scenario-*`, `--rd-shadow`, `--rd-overlay`,
  `--rd-backdrop`, `--rd-scrollbar*`, `--rd-canvas-bg`). Light values on `:root`, dark on `:root[data-theme="dark"]`,
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
- Canvas: tab graph divs get `--rd-canvas-bg` (#fff / draw.io's #121212); the grid is a transparent SVG tile from
  `src/ui/grid-background.ts` (`applyGridBackground`, used by `GridController` and `CanvasProperties`): both tiles
  (#e0e0e0 / draw.io dark #424242) are custom properties on the container and CSS picks one by `data-theme`, so a
  theme switch needs no listener and inactive tabs follow.

### Legacy editor (maxGraph)

- `src/ui/tabs.ts` `TabManager`: each tab owns its own `Graph` (a div inside `#graph-container`) and its own
  full set of controllers (properties, menu, toolbar, clipboard, save/load, layers, zoom, ...).
  **Listener capture rule:** controllers are constructed inside `captureSharedListeners()`, which patches
  `EventTarget.prototype.addEventListener` and records every listener bound outside the tab's graph div
  (shared DOM, `document`, `window`). Only the active tab's recorded listeners are attached; switching tabs
  detaches/reattaches them; closing removes them. Consequences for a new controller:
  - bind shared-DOM/document listeners in its constructor (so they are captured), or
  - if it binds later (dialog open, edit start), scope the listener itself: remove it when the
    dialog/edit ends and in `destroy()` (see `DuplicateOffsetController`, `TextEditorController`).
  - `once` listeners are not recorded. Listeners added in `legacy-main.ts` are global, not per tab.
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
- Keyboard: a single capture-phase `keydown` dispatcher in `legacy-main.ts` runs each shortcut once on the
  active tab (Ctrl/Cmd+Z/Y/Shift+Z/C/X/V/A/S, Delete/Backspace, Escape). Per-tab controllers must not
  bind their own `document` keydown for these. Everything except Ctrl+S is skipped when
  `shouldIgnoreGraphShortcut(e, graph)` (`src/ui/delete.ts`) says the user is typing (input, textarea,
  contentEditable, IME composition, cell editor active).
- `src/services/service-registry.ts` holds tabManager/notifications/etc. instead of `window` globals
  (leftovers: `window.__leftPanelTabs` set in `legacy-main.ts`, `window.__saveStatusIndicator` set in
  `src/ui/save-status.ts`; `src/ui/project-name-editor.ts` still reads `window.__tabManager`, which nothing sets).

### File format (legacy editor): native draw.io XML

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

### draw.io shapes in the maxGraph editor (`src/drawio-shapes/`, pinned to jgraph/drawio **v32.4.1**)

Ports of draw.io's own code (Apache-2.0; attribution in `NOTICE`, every ported file has the header and
upstream `file:line` references; `third_party/drawio/` has the license and the upstream file list).
`DRAWIO_TAG` (engine and palettes) names the tag; bump it only together with `npm run drawio:palettes`.

- `engine/`: stencil engine. `installStencilEngine({ baseUrl })` (once, in `legacy-main.ts`) patches
  `CellRenderer.createShape` for `shape=stencil(<base64 deflate>)` and wraps `StencilShapeRegistry.getStencil`
  (JS shapes win over stencils of the same name, as in draw.io). Named stencil sets (`mxgraph.basic.*`, ...)
  are fetched from `public/stencils/<basename>.xml` by `ensureStencilsForXml(xmlOrStyles)` (only basic,
  flowchart, arrows and mscae/enterprise are vendored). `installDrawioCompat(graph)` resolves `light-dark()`
  and `default` colours (light theme). `parseMxLibrary` / `entryToCells` read any `<mxlibrary>`.
- `js/shapes-core/` (Shapes.js vertex shapes + perimeters), `js/shapes-edges/` (table, flexArrow, link,
  partialRectangle, curvedText, ...; `installTableSupport(graph)`: table/stack layouts, collapsed tables),
  `js/mx-libs/` (shapes/mxBasic.js, mxArrows.js, mxFlowchart.js). All registered under the exact draw.io
  names by `registerDrawioJsShapes()` in `src/shapes/index.ts`, before the app's own shapes. draw.io's
  `hexagon` replaces maxGraph's core hexagon; the app's hexagon is `customHexagon`/`hexagon-shape`.
  `src/shapes/drawio-arrows/` keeps the old `mxarrows.Arrows2*` keys as aliases (export writes the real names).
- `palettes/`: `PALETTES` + `loadPalette(id)` (one lazy chunk per palette): General 45, Misc 54, Advanced 33,
  Basic 76, Arrows (arrows2) 31, Flowchart 34, legacy Arrows 34 (hidden by default). Generated JSON in
  `palettes/data/`; never edit it by hand.
- Regenerating (`npm run drawio:palettes`, see `scripts/drawio-palettes/README.md`): fetch-sources.ts downloads
  the pinned files (SHA-256 checked) into `$DRAWIO_CACHE_DIR` or the OS temp dir, decode-stencils-bundle.ts
  writes `public/stencils/*.xml` from js/stencils.min.js, extract-palettes.ts runs the real Sidebar-*.js
  palette functions in a `node:vm` sandbox and writes `palettes/data/*.json`. Outputs are deterministic.
- UI: `src/ui/drawio-palette/` (`createDrawioPaletteView`), mounted in `legacy-main.ts` inside the single
  **Shapes** tab of the left panel (`#shapes-container` = `#app-shapes-container` (ShapeToolbar groups) +
  `#custom-shapes-container` + `#drawio-palette-container`). There is no separate draw.io or Stencils tab:
  the palette's "More shapes…" menu toggles the draw.io palettes and, via `extraMenuItems`, the app shape
  groups (hidden groups in localStorage `railway-drawer-hidden-shape-groups`). Optional **ERTMS** tab (View > ERTMS Tab,
  closeable, state in localStorage `railway-drawer-ertms-tab`): a second palette view with only the ERTMS
  library (`userLibraries: false`, `showMoreMenu: false`, own flags via `storageKeySuffix`, no dropTarget —
  the Shapes-tab view handles its drops since palette/entry ids are the same). Order: draw.io palettes, then ERTMS (`public/libraries/ertms.xml`,
  the default ERTMS palette, showing only its 18 simple elements — the 22 scenario diagrams are ERTMS templates,
  see Templates below; the `src/shapes/ertms` placeholders are renderers only, for old files), then
  user libraries ("Import library…", stored in localStorage `rd.drawioLibraries`). Thumbnails come from one
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
  The palette's hidden thumbnail/parity graph gets the same set.
  `ConnectionHandler` uses draw.io's connection points (`getDrawioConnectionConstraints`) when a shape has them.
- Saving draw.io-styled cells is byte-identical: `parseDrawioStyle` (codec and palette inserts) remembers
  the original string and the export writes it back while the parsed style is unchanged; `addAppDefaults`
  only writes colours/arrows where the app would render differently from draw.io's defaults.
  `src/__tests__/services/drawio-xml-palettes.test.ts` checks every palette entry and every ERTMS tile.

### Templates (`src/ui/templates/`, left-panel tab "Templates")

- Built-in **ERTMS templates**: `splitErtmsLibrary` (`ertms-templates.ts`) classifies `public/libraries/ertms.xml`
  by content: more than `TEMPLATE_CELL_THRESHOLD` (80) drawable cells (`mxCell` vertex/edge, nested included)
  = template (scenarios have 102..265, the simple elements 1..44). 40 entries -> 18 elements / 22 templates
  (tested against the real file). Names "ERTMS scenario <n>" (library order) + a subtitle of the 3 rarest
  labels across scenarios (phrases before ids); every label is a search tag. Ids `ertms-tpl-<library index>`.
  `ertmsPaletteSource` (Shapes and ERTMS tabs) filters to the elements, entry ids keep the library index
  (`ertms-<index>-<slug>`); `loadErtmsTemplates` shares the one download. The parity harness reads the
  library itself, so it still covers all 40 entries. The draw.io-mode library (`src/drawio/ertmsLibrary.ts`) is unchanged.
- **User templates**: `TemplateStore` (`template-store.ts`), localStorage `railway-drawer-templates`,
  `{ version: 1, templates: [{ id, name, description?, xml, width, height, created, updated }] }`; `xml` is a
  native draw.io `<mxGraphModel>`. Bare arrays read as v1; a newer version makes the store read-only (writes
  throw, data untouched); a failed write (quota) rolls back and throws `TemplateStorageError` -> notification.
  Export/import as a draw.io library (`<mxlibrary>`, uncompressed `{xml,w,h,aspect,title,description}`; opens in
  draw.io's sidebar); import uses the engine's `parseMxLibrary` (compressed entries, image entries -> image cell).
- **Save as Template…**: File menu and canvas context menu (`data-action="saveAsTemplate"` -> `window`
  event `save-template-request` -> `legacy-main.ts`), and the tab's "Save…" button. `extractTemplate`
  (`template-extract.ts`): selected cells minus those with a selected ancestor (descendants come along) + unselected
  edges whose both terminals are inside; a selected edge to an outside cell is kept dangling; absolute
  coordinates, moved to (0,0), `rdLayerId` dropped, styles verbatim. Nothing selected = whole diagram (all
  layers flattened; a context-menu click on the empty canvas clears the selection, so it saves everything).
  Name dialog `promptTemplateDetails` (`template-dialogs.ts`, name required, Enter/Escape; a window capture
  keydown listener keeps keys away from the shortcut dispatcher while it is open).
- Panel (`templates-panel.ts`): search, "My templates" (Save…/Import…/Export…, empty-state hint, ✎/× on tiles)
  above "ERTMS templates"; tiles 120x72 thumbnails from the shared palette renderer (lazy, IntersectionObserver).
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
- **Catalogue** (`catalogue.ts`): 13 kinds (signal, balise, baliseGroup, track, trackSection, points, levelCrossing,
  bufferStop, rbc, leu, axleCounter, train, route), fields typed text/number/integer/km/enum/ref/refList with
  unit/min/max (NID_C 0–1023, NID_BG/NID_RBC 0–16383, balises in group 1–8, aspects 1–6). Every kind has `id`
  (required, generated `S1`, `BG1`, ... from `idPrefix`, case-insensitive unique per kind).
- **Pre-assigned kinds**: ERTMS library entries by title (`kindForLibraryTitle`: Signal Left/Right n -> signal with
  direction reverse/nominal and n aspects, (Single) Balise Left/Right -> balise, TC -> trackSection tc, Track ->
  track, Point Left/Right -> points with hand, Train/Train Connected -> train; MA/Distance/Line/Gradient/SSP: none)
  through the palette option `prepareInsert` -> `insertEntry(..., prepare)` (same undo step, only single-cell
  entries, only `ertms-*` entries, not draw.io palettes); app railway shapes by style shape (`kindForStyle`, drop
  handler in `legacy-main.ts`). Templates/paste keep the data they carry.
- **Checks** (`validation.ts`, model only, `geometry.ts` for absolute positions): duplicate-id, required (ID error,
  NID_C/NID_BG warning), invalid-value, unknown-kind, balise-without-group (error), group-count / group-position
  (warning), missing-reference (error), signal-off-track (warning: centre > `SIGNAL_TRACK_DISTANCE` 40 px from its
  track, or from every track when it names none and tracks/sections/points exist), km-order (warning: majority
  direction of km along the track polyline, needs >= 3 objects), km-outside-track (warning).
- **UI** (`install-railway-data.ts`, called from `legacy-main.ts` after `installScenarios`): right-panel switch is
  generic now (`installRightPanelSwitch`: buttons' `aria-controls` name the panels, `right-panel-view` window event):
  Properties | Data | Checks | Scenarios. `data-panel.ts`: kind select (+ none), fields (enum select, ref inputs with a
  datalist of IDs, problems from the last check under the field), multi-select edits common fields ("(mixed)", ID
  disabled). Edits go to the cells the fields were rendered for (a field's blur `change` fires after a canvas click
  already changed the selection). `checks-panel.ts`: Run checks, Live (debounced 400 ms on model changes; localStorage
  `rd.railway.liveChecks`), badge on the switch, issue click selects the cell, "Edit" opens Data on the field, report
  buttons. Global listeners bound to the active tab's selection/data model (rebound on `tab-changed`/`tab-closed`).
  Menus dispatch window events: `railway-edit-data-request` (Extras > Edit Data…, context menu Edit Data...),
  `railway-checks-request` (Extras > Railway Checks), `railway-export-request` (File > Export Railway Data submenu,
  `data-action="exportRailway:<report>"` handled in `MenuController.executeMenuAction`).
- **Reports** (`report.ts`, `xlsx.ts`): signals, balises + groups, tracks + sections, points, all objects; sorted by km
  (`km`, else `kmStart`; none last), then kind order, then natural ID order. CSV = UTF-8 BOM, CRLF, RFC 4180 quoting,
  formula injection guarded (`'` prefix unless numeric). `.xlsx` = dependency-free stored ZIP (CRC32) with one sheet
  per report (inline strings, numbers as numbers, bold frozen header).
- Tests: `src/railway/__tests__/` (catalogue + real ERTMS library mapping, object data round trip/undo/insert,
  every rule, CSV/xlsx, panels with real tabs).

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
  which draw.io's save keeps (verified in `drawio-embed.spec.ts`). Decision: no extra text cell is added to the step page
  for draw.io viewers (it would change the snapshot); draw.io shows the attributes only in the file. draw.io v32.4.1 keeps unknown `<diagram>` attributes
  (page node kept as `DiagramPage.node` and cloned on save, Pages.js:12 / EditorUi.js:2520; also on "Duplicate page",
  so duplicate step ids are made unique on load) — verified live in `tests/e2e/drawio-embed.spec.ts`. Parse:
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
- Templates store only cells (no scenarios), so they are unaffected; cache, share links and remote providers serialize
  the step pages/JSON and carry `uml`/`text` automatically.
- Keyboard: the dispatcher in `legacy-main.ts` calls `scenarios.handleKeydown(e)` right after Ctrl+S; only while the
  view is open: ←/PageUp, →/PageDown, Home/End, Esc; editing shortcuts are prevented, every other key is stopped
  (`scenario-keys.ts` `scenarioKeyAction`); fields/IME and Ctrl+S pass.
- Panel (`scenarios-panel.ts`, `#scenarios-panel`): "+ New scenario", per scenario ▷ present / ✎ / ⧉ / × (confirm),
  expandable step list (lazy 64x40 thumbnails from the palette's shared renderer, ↑ ↓ ⟳ update-from-drawing (confirm)
  ✎ ⧉ ×, drag to reorder), "+ Add step". Dialogs = `promptTemplateDetails`/`confirmTemplateDialog`. Wiring:
  `install-scenarios.ts`. File > New (model.clear) keeps the tab's scenarios, like its extra pages.
- Tests: `src/scenarios/__tests__/` (model, format/round trip/draw.io edits/share split, tabs + cache + view + keys +
  panel; `scenario-uml-text-format.test.ts` multi-line UML/Markdown round trips incl. a draw.io-style re-save, cache,
  share; `markdown.test.ts` rendering + XSS payloads; `scenario-uml-text-view.test.ts` editor/previews, side panel
  Prev/Next, collapse, edit keep/replace, HTML export), `src/__tests__/services/plantuml-scenario.test.ts` (sequence
  parser/SVG, encoding vs PlantUML's documented example, mocked server, no request without a server),
  `tests/e2e/scenarios.spec.ts` and `tests/e2e/scenario-uml-text.spec.ts` (any port).

### draw.io editor (`src/drawio/`)

- `workspace.ts`: toolbar (New, Open…, Download .drawio, Export SVG, maxGraph editor), iframe, spinner,
  "not reachable" banner after 20 s, debounced (1 s) autosave to localStorage `railway-drawer-drawio-doc`
  (separate from the legacy cache), flushed on pagehide/hidden tab/dispose. Loading another document
  remounts the iframe.
- `protocol.ts`: embed client for `proto=json&configure=1`. Handshake: `configure` -> host sends
  `{action:'configure', config}`; `init` -> host sends `{action:'load', xml, autosave:1, title}`; `load` -> ready.
  Gotchas: every outgoing message must be a JSON **string** (objects are silently dropped); draw.io posts with
  targetOrigin `*`, so incoming messages are checked for origin AND `source === iframe.contentWindow`; never put
  `xml` in an export request (it replaces the open diagram); the `load` event's `xml` is an echo of the input,
  not normalized output; error replies have no `event` field; configure has a timeout with a fallback config.
- `ertmsLibrary.ts`: fetches `public/libraries/ertms.xml` (`<mxlibrary>`, 40 tiles; license in
  `public/libraries/ERTMS-LICENSE.txt`) relative to `import.meta.env.BASE_URL`; the JSON body is read via
  `textContent` (entity-decoded, otherwise every tile shows "Error:"); passed inline as `data`, never `url`
  (draw.io would proxy it). Bump `DRAWIO_CONFIG_VERSION` when the config changes (resets draw.io sidebar state).
- `VITE_DRAWIO_URL` (default: the self-hosted copy, `selfHostedDrawioUrl(import.meta.env.BASE_URL)` =
  `/drawio/` in dev, `./drawio/` in the relative build, so it works at `/` and at `/railway-drawer/`) and
  `VITE_DRAWIO_PARAMS` select the draw.io server; `VITE_DRAWIO_URL=https://embed.diagrams.net/` restores the
  public editor.

### Self-hosted draw.io (`scripts/drawio-selfhost/`)

- `fetch-drawio.ts` (`npm run drawio:selfhost`; run automatically by the Vite plugin): downloads the official
  `draw.war` of the pinned tag (`DRAWIO_TAG` from `scripts/drawio-palettes/fetch-sources.ts`, v32.4.1, 46 MiB),
  checks `WAR_SHA256`, extracts a trimmed copy with a built-in zip reader into
  `$DRAWIO_SELFHOST_CACHE_DIR` (default `~/.cache/railway-drawer/drawio-v32.4.1/`: `draw.war` + `site/`). The
  site is rebuilt when the tag, the war hash, the script or `config/*.js` change (stamp `site/.rd-selfhost.json`).
  `DRAWIO_WAR=<file>` uses a pre-downloaded war (offline machines). Nothing of it is in git.
- Trimmed out (war 3154 files / 117 MiB -> **2796 files / 64.1 MiB**, largest `js/app.min.js` 9.7 MiB):
  WEB-INF (servlet + placeholder OAuth secrets), META-INF, `*.map`, dev sources (`js/diagramly`,
  `js/grapheditor`, `mxgraph/src`; only used with `?dev=1`), Atlassian/Teams/cloud integrations
  (`js/integrate.min.js` 19 MB, `connect/`, `js/onedrive`, `js/dropbox`, `*.html` callbacks), `js/viewer.min.js`,
  the service worker + workbox and `clear.html` (it would wipe the localStorage of the whole origin = the app's
  data). Fails if > 20,000 files or a file > 25 MiB (Cloudflare Workers static assets limits).
- `config/PreConfig.js` / `config/PostConfig.js` replace draw.io's: `DRAWIO_BASE_URL`/`DRAWIO_LIGHTBOX_URL` =
  the copy's own folder, `DRAWIO_VIEWER_URL` = its `js/viewer-static.min.js`, `EXPORT_URL = null` (PDF via
  print), and forced `urlParams` (bootstrap.js loads PreConfig before app.min.js on non-diagrams.net hosts):
  `offline=1 stealth=1 lockdown=1 pwa=0 plugins=0`, no gapi/picker/db/od/gh/gl/tr/ms365; PostConfig nulls
  `ICONSEARCH_PATH`, `ICON_SERVICE_PATH`, `DRAWIO_LOG_URL`. Verified: a full draw.io-mode session makes no
  request outside localhost (the embed spec enforces it). Embed parameters still come from `protocol.ts`.
- `vite-plugin.ts` (`drawioSelfHost()` in `vite.config.ts`): stages the site in `configResolved`, serves it at
  `<base>drawio/` in the dev server (own middleware before Vite's, so draw.io's HTML is not transformed;
  `index.html` for directories, 404 outside the site) and copies it to `dist/drawio/` in `writeBundle`.
  Disabled under vitest and with `DRAWIO_SELFHOST=0` (then set `VITE_DRAWIO_URL`). A build fails when draw.io
  cannot be prepared; the dev server only warns (draw.io mode then shows the "not reachable" banner with a
  self-hosted hint).
- Deploy: `npm run build` (also the Cloudflare Workers Builds command) downloads it (no persistent cache there,
  ~46 MiB from GitHub per build); `dist/` = app + `drawio/`. Cloudflare Workers static assets: 20,000 files
  (free plan) / 25 MiB per file, no total size limit -> fits. `deploy.sh` checks `dist/drawio/index.html`
  locally and on the LAN server (`http://192.168.10.22/railway-drawer/drawio/` needs a directory index).
- **Same-origin iframe (security)**: the self-hosted draw.io runs on the app's origin, so it could read the
  app's DOM, localStorage (shared quota; draw.io's keys start with `.` / `mxSettings`) and cookies. We accept
  that for the pinned, SHA-256-checked copy with external services disabled. No `sandbox` attribute: draw.io
  needs `allow-scripts` + `allow-same-origin`, which together are no boundary for same-origin content (the
  frame could remove its own sandbox); embed.diagrams.net is cross-origin and isolated by the browser anyway.
  The protocol still checks `origin` (= the app origin) and `source === iframe.contentWindow`.
- The maxGraph editor shows the same `public/libraries/ertms.xml` (elements in the Shapes/ERTMS tabs, scenarios as templates). The old maxGraph-side
  ERTMS placeholder shapes (`src/shapes/ertms/index.ts`) are only registered as renderers, for old files.

### Sharing (`src/share/`)

- `install-sharing.ts` (called from `legacy-main.ts`) wires everything: top-bar `#share-btn` and File > Share…
  (`data-action="share"` -> `window` event `share-request`) open `share-dialog.ts`; File-menu items
  "Open from/Save to <provider>…" are generated into `#file-menu-remote-items` for available providers.
- **Link with the diagram** (`share-link.ts`, `share-mxfile.ts`): all tabs (+ each tab's preserved pages) as one
  `<mxfile>` (`buildShareMxfile`, unique page ids) -> `#R` + base64url(deflateRaw(encodeURIComponent(xml)))
  (CompressionStream). The app.diagrams.net link uses draw.io's exact format (`'#R' + encodeURIComponent(Graph.compress(xml))`,
  standard base64; EditorUi.js:9545 / App.js:6669). The reader accepts both alphabets and raw-XML `#R` links,
  caps the hash, the inflated stream and the decoded XML (5 MB), and never evaluates anything. Links over 32k chars get a warning.
- Incoming links (`share-open.ts`): on start and on `hashchange`, the hash is stripped (replaceState) and each page opens in a
  **new tab** via `SaveLoadController.loadProjectXml` (existing tabs kept; a lone empty tab is closed). `drawio/boot.ts`
  starts the legacy editor for a `#R` hash even when draw.io mode is remembered (the remembered mode is not changed).
- Downloads: .drawio (all tabs), PNG/SVG of the current tab via `src/ui/diagram-image-export.ts` (the parity
  harness's draw.io-like export pipeline, now shared with `src/debug/parity-hook.ts`), Web Share API buttons only
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
  URL; the descriptor stores it in sessionStorage `rd.gitlab.pendingOpen` and strips it; `drawio/boot.ts` forces the
  legacy editor for it. Status bar "GitLab: group/project › branch › path".
- Tests: `src/share/__tests__/` (link codec incl. draw.io's algorithm via node:zlib, Graph client with mocked fetch,
  dialog, remote session, provider, config; `gitlab.test.ts`: PKCE vectors, OAuth popup/redirect/refresh, bridge,
  client paging/errors, provider against an in-memory GitLab, config/links, descriptor; `gitlab-session.test.ts`:
  save fields, conflict actions, incoming links, Share-dialog settings; `remote-persist.test.ts`: binding format, restore +
  save back (sign-in, conflict), Reload/Unlink, dirty state), `src/__tests__/ui/remote-binding-cache.test.ts` (real
  TabManager + installSharing: old cache, reload round trip with the fake provider, close/beforeunload), `tests/e2e/share.spec.ts` (any port: copy
  link -> fresh context opens the tabs, downloads, damaged link, SharePoint "Not configured"), `tests/e2e/gitlab.spec.ts`.

## Deploy

- Production: **Cloudflare Workers Builds** on push (configured in the Cloudflare dashboard; reads
  `wrangler.jsonc`: static-assets-only Worker serving `./dist`, SPA not-found handling). `npm run deploy`
  (= build + `wrangler deploy`) does the same from a local machine; `npm run preview:cf` runs it in `wrangler dev`.
- LAN: `./deploy.sh` -> `npm ci`, `npm run build`, timestamped backup of
  `root@192.168.10.22:/var/www/html/railway-drawer`, scp `dist/`, verify. Served at
  `http://192.168.10.22/railway-drawer/` (port 80, so the draw.io embed works there).

## Tests

- Unit/integration: `src/**/__tests__/**/*.test.ts`, vitest + jsdom, setup `src/__tests__/setup.ts`.
  `@maxgraph/core` is inlined (`server.deps.inline`) because its ESM has extensionless imports;
  `--no-experimental-webstorage` keeps Node's own localStorage from shadowing jsdom's.
- `src/__tests__/ui/tab-cache-restore.test.ts` mirrors the startup sequence of `legacy-main.ts`; keep them in sync.
