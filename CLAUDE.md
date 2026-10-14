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
- vitest only includes `src/**/*.test.ts` and excludes `tests/e2e/**`; `tsconfig.json` only covers `src`.

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
  shape toolbar/stencils, shape designer. `beforeunload` flushes the cache, then destroys the tabs.

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
- App-only data lives in style keys draw.io preserves: `rdShape` (app shape exported as a similar draw.io
  shape via `DRAWIO_SHAPE_MAP`; restored on import, added keys removed), `rdOwn`, `rdLayerId`, `rdPlantUml`
  (base64 JSON). `IMAGE_FALLBACK_SHAPES` (ertms-signal/track/train/balise) export as SVG images.
- Import fixes maxGraph codec gaps (`registerDrawioCodecs()`: replacement `mxCell` codec, `mxRectangle`),
  registers draw.io named styles, renders `UserObject`/`<object>` labels, rejects XML nested deeper than
  `MAX_MODEL_XML_DEPTH`.
- Legacy `<GraphDataModel>` files/caches still load (`importModelXml` / `isLegacyModelXml`). Restored legacy
  cache tabs are rewritten to draw.io format immediately (`CacheService.isLegacyGraphXml` ->
  `TabManager.restoreFromCache` calls `saveToCache`); the cache version was deliberately not bumped.
- `load()` decodes into a scratch model first; the current diagram is only replaced on success.

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
- The maxGraph-side ERTMS shapes (Signal, Train, Track, Balise) are separate: `src/shapes/ertms/index.ts`.

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
