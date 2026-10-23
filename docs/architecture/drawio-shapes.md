# draw.io shapes in the maxGraph editor

Ports of draw.io's own code (Apache-2.0; attribution in `NOTICE`, every ported file has the header and
upstream `file:line` references; `third_party/drawio/` has the license and the upstream file list).
`DRAWIO_TAG` (engine and palettes) names the tag; bump it only together with `npm run drawio:palettes`.

- `engine/`: stencil engine. `installStencilEngine({ baseUrl })` (once, in `boot/shell.ts`) patches
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
- UI: `src/ui/drawio-palette/` (`createDrawioPaletteView`), mounted by `boot/panels.ts` inside the single
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
  keys), `html-labels.ts` (`html=1` cells render sanitized HTML labels; maxGraph only has a graph-wide flag; the sanitizing
  getLabel must stay the OUTERMOST wrapper: `configureDiagramRendering` installs it last),
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
