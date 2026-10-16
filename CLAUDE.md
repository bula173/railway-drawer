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
E2E_PORT=80 npm run test:e2e   # what the draw.io embed spec needs, see below
E2E_PORT=80 npm run test:parity # maxGraph vs draw.io pixel comparison of every palette entry (see below)
npm run drawio:palettes     # regenerate palettes + stencil sets from the pinned draw.io tag (Node >= 22.18)
```

CI (`.github/workflows/build-and-deploy.yml`) runs typecheck, typecheck:tests, lint, test:run, build. It does not deploy.

### E2E and port 80

`embed.diagrams.net` answers **HTTP 403** to iframes whose Referer has a non-default port
(`http://localhost:3000/`) and to the `HeadlessChrome` user agent. So:

- `tests/e2e/drawio-embed.spec.ts` skips itself with a hint on port 3000; it only runs for real with
  `E2E_PORT=80` (macOS lets non-root bind :80; on Linux set `VITE_DRAWIO_URL` to a self-hosted draw.io).
- The chromium project uses `devices['Desktop Chrome']`, which sends a normal Chrome UA even headless.
- `tests/e2e/legacy-smoke.spec.ts` works on any port (drop shape, Ctrl+Z/Ctrl+Y, switch to draw.io and back,
  draw.io mode loads no maxGraph module).
- vitest includes `src/**/*.test.ts` and `tests/e2e/parity/__tests__/**/*.test.ts` (the parity harness's
  own unit tests); Playwright only runs `tests/e2e/*.spec.ts` (`testMatch`). `tsconfig.json` only covers `src`.
- `tests/e2e/drawio-parity.spec.ts`: renders every palette entry (7 draw.io palettes + ERTMS, 347) in
  embed.diagrams.net (`export` message, served from a routed `http://localhost/parity/drawio-host.html`) and
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
  Skips itself on port != 80 (`PARITY_ANY_PORT=1` overrides), offline (`E2E_OFFLINE=1`) or on a 403.
  Last full run: 335 pass, 0 warn, 0 fail, 12 expected (images with draw.io-relative `img/` paths,
  sketch=1, `%date%` placeholders, the List templates draw.io's export does not lay out, the mermaid
  Sankey gradient band). ERTMS: 40/40 pass.
- `tests/e2e/drawio-palette.spec.ts` (any port): Shapes tab (no draw.io/Stencils tabs) renders the palettes, "More shapes…" toggles palettes and app groups, inserts keep draw.io styles, autosave
  writes real draw.io shape names.
- `tests/e2e/share.spec.ts` (any port): Share dialog, `#R` link round trip into a fresh browser context, downloads.
- `tests/e2e/templates.spec.ts` (any port): ERTMS palette 18 entries, Templates tab 22 ERTMS templates (search,
  insert, open as new diagram, drag), tab bar labels not cut, Save as Template… -> reload -> insert, rename, delete.

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
  Shapes tab (shape toolbar + draw.io palettes), shape designer. `beforeunload` flushes the cache, then destroys the tabs.

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
- `VITE_DRAWIO_URL` (default `https://embed.diagrams.net/`) and `VITE_DRAWIO_PARAMS` select the draw.io server.
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
  fail|replace|rename)`, optional `createShareLink`). `providers/registry.ts` lists them (SharePoint first; GitLab next).
  Dialogs (`ui/remote-dialogs.ts`) and the Share dialog render providers generically.
- `remote-session.ts`: per-tab binding (provider id + ref + version, in memory only), `SaveLoadController.setSaveHandler`
  redirects Ctrl+S / File > Save to `saveBack` (version conflict -> overwrite / save as copy / cancel); File > Save As…
  (`saveProjectToDisk`) always downloads. Status bar `#status-remote-item` "Stored in:". TabManager now dispatches
  `window` events `tab-changed` (switchTab) and `tab-closed` (closeTab).
- **SharePoint** (`providers/sharepoint/`, docs/SHAREPOINT.md): disabled unless `VITE_MSAL_CLIENT_ID` is set at build
  time (`VITE_MSAL_TENANT_ID` default `organizations`, `VITE_SHAREPOINT_DEFAULT_SITE` `host:/sites/Name`). vite.config.ts
  `define`s these keys (empty when unset) so `import.meta.env.VITE_MSAL_CLIENT_ID ? () => import(...) : null` is a
  constant: unconfigured builds contain no MSAL code and no SharePoint chunk. Plain http (except localhost) ->
  "SharePoint requires HTTPS — use https://railwaydrawer.mksystemdesign.org". `@azure/msal-browser` is pinned (5.24.0):
  popup with redirect fallback; msal 5 needs `broadcastResponseToMainFrame` on the redirect page, and the redirect URI is
  the app itself, so `main.ts` runs `auth-bridge.ts` instead of the editor when the URL carries `state`+`code|error`.
  `graph-client.ts`: Graph v1.0 via fetch (nextLink paging, 429/503 retry, PUT < 4 MB else upload session, If-Match ->
  412 `GraphConflictError`, createLink, invite). Scopes: Sites.Read.All (browse), Files.ReadWrite.All (content, links).
- Tests: `src/share/__tests__/` (link codec incl. draw.io's algorithm via node:zlib, Graph client with mocked fetch,
  dialog, remote session, provider, config), `tests/e2e/share.spec.ts` (any port: copy link -> fresh context opens the
  tabs, downloads, damaged link, SharePoint "Not configured").

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
