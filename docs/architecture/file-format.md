# File format (native draw.io XML) and the draw.io compatibility guard

`src/services/drawio-xml.ts`. maxGraph 0.10 reads mxGraph XML but only writes `<GraphDataModel>`, which
draw.io cannot open; this module writes and reads draw.io `<mxfile>/<diagram>/<mxGraphModel>/<mxCell>`.

- Saves are `.drawio` (`DiagramDocument` + `ProjectService`; `SaveLoadController` is the file I/O over the document); the cache stores `<mxGraphModel>` per tab,
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

## draw.io compatibility guard

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
- Path under test = File > Open / Save: `SaveLoadController.loadProjectXml` (-> `DiagramDocument.applyParsedProject`) -> `DiagramDocument.getProjectXml`. Required: valid draw.io
  XML (`<mxfile>`, one `<diagram>` per page, `mxGraphModel/root`, cells 0 and 1, no namespaces); same pages, order,
  names, ids and `<diagram>` attributes; same cells in draw.io's depth-first order, kinds, parents, terminals, values,
  every wrapper attribute; every original style entry and the style string itself kept (the save may only add
  explicit app defaults); geometry incl. points/terminal points/offset/alternate bounds (1/1000 px); page settings;
  hidden pages byte-identical (compressed stays compressed); stable second save; `rdShape` app shapes; `#R` links.
- Change the fixtures only deliberately, by hand in draw.io's layout. A compressed page is
  `base64(deflateRaw(encodeURIComponent(modelXml)))` (node:zlib `deflateRawSync`). Never weaken an assertion to make
  a change pass.
