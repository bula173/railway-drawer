# All draw.io libraries

- **Generator** (`npm run drawio:palettes`, `scripts/drawio-palettes/README.md`): `fetch-sources.ts` fetches every
  `js/diagramly/sidebar/Sidebar-*.js`, `shapes/**`, `img/**` (+ Editor.js, Dialogs.js, resources/dia.txt, mxConstants.js)
  **by commit** `9034053f…` (tag v32.4.1), each file checked against the commit's git blob id. Downloaded sources are
  data: `safe-js.ts` is a closed tree-walking interpreter (TypeScript parser, no eval/vm/Function; prototype-less
  objects, allow-listed pure methods) in which `extract-palettes.ts` runs grapheditor Sidebar.js (General..UML), every
  Sidebar-*.js (not Sidebar-Advanced.js: ELK live layout containers) and Sidebar.js `initPalettes()`/`updateEntries()`
  against a recording Sidebar stub. The 7 old palette files are byte-identical. Writes `palettes/data/<id>.json` (file =
  id, or `p-<slug>` for ids with spaces), `catalogue.json` (draw.io's More shapes categories, 69 libraries =
  `Sidebar.configuration`, palettes with counts/JS shapes/stencils, vendor `attribution`/`notice`/`vendorIcons` from
  `libraries.ts`), `search/search-index-NN.json` (`title\ttags` per entry, ~200 kB shards so no chunk exceeds the size warning; all loaded on the first search and concatenated, `loadPaletteSearchIndex`), `third_party/drawio-libraries/*.md` (one notice per
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
  `skipCataloguePalettes: ['basic']` (merged General). "More shapes…" = modal dialog `.rd-dp-menu` (`openModal` on the `.rd-dp-menu-backdrop` inside the palette root while open; aria-modal, focus trap, Esc, backdrop press closes, focus back to the button): "In the
  Shapes tab" rows (unchanged `.rd-dp-menu-row`, data-palette-id / data-menu-item-id), then `more-shapes-dialog.ts`
  (lazy): filter, draw.io categories + "Legacy" (azure, veeam, arrows not in draw.io's dialog), one checkbox per library
  (`input[data-library-id]`, toggles all its palettes, flags in `rd.drawioPalettes.visible`, first palette expands),
  preview pane (count, attribution, 24 thumbnails). Defaults unchanged (ERTMS, railway libraries, General, Misc, Advanced,
  Arrows, Flowchart on; every draw.io library off). Search: the inline filter as before, plus `global-search.ts` (lazy,
  150 ms debounce): the search index over palettes that are not shown, grouped by library (sorted by hits, 6 groups
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
