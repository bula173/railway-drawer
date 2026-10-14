# draw.io palette data and stencils

Regenerates the draw.io palette JSON and the vendored stencil XML from one pinned draw.io release
(`DRAWIO_TAG` in `fetch-sources.ts`, currently **v32.4.1**). Outputs are committed; run the scripts
only when bumping the tag or changing the extraction.

Requires Node >= 22.18 (native TypeScript type stripping; `npx tsx <file>` also works). No npm
dependencies beyond Node built-ins.

```bash
node scripts/drawio-palettes/fetch-sources.ts            # download + verify (VERSION and SHA-256), copy LICENSE files
node scripts/drawio-palettes/decode-stencils-bundle.ts   # js/stencils.min.js -> public/stencils/*.xml
node scripts/drawio-palettes/extract-palettes.ts         # Sidebar*.js -> src/drawio-shapes/palettes/data/*.json
npx vitest run src/drawio-shapes/palettes                # validate the output
```

## Steps

1. **fetch-sources.ts** downloads from
   `https://raw.githubusercontent.com/jgraph/drawio/<tag>/` into a cache outside the repo
   (`$DRAWIO_CACHE_DIR`, default `<os.tmpdir()>/drawio-<tag>`; `.cache/` is not git-ignored here).
   It checks the upstream `VERSION` file against the tag and every file against the pinned SHA-256
   table, then copies `LICENSE` to `third_party/drawio/LICENSE` and `stencils/LICENSE` to
   `public/stencils/LICENSE`. `--force` re-downloads; `--print-hashes` prints the table (update it
   when bumping the tag).
2. **decode-stencils-bundle.ts** reads the `f['<file>'] = '<base64>'` map in `js/stencils.min.js`.
   Each payload is deflate-raw (inflated with `finishFlush: Z_SYNC_FLUSH`) of draw.io's Xml2Js binary
   node stream; `decodeStencilBundleEntry()` is a port of the bundle's own `decode()`. Writes
   `public/stencils/basic.xml`, `flowchart.xml`, `arrows.xml` and `mscae/enterprise.xml` (the last one
   is needed by the ERTMS library: `mxgraph.mscae.enterprise.wireless_connection`). To vendor another
   set, add it to `VENDORED_STENCILS`.
3. **extract-palettes.ts** runs draw.io's real palette functions (`addGeneralPalette`,
   `addMiscPalette`, `addAdvancedPalette` from `js/grapheditor/Sidebar.js`; `addBasicPalette`,
   `addArrows2Palette`, `addFlowchartPalette` from `js/diagramly/sidebar/Sidebar-*.js`; the legacy
   `addStencilPalette('arrows', …)` call from `js/diagramly/sidebar/Sidebar.js`) in a `node:vm`
   sandbox with a recording `Sidebar` stub, in `Sidebar.init` order. Entry order, titles, sizes,
   styles, values and tags are draw.io's. Composite entries become mxGraphModel XML (mxCodec form,
   `UserObject` for cells with attributes); the 10 compressed data entries are decompressed
   (`Graph.decompress` semantics). `shapeNames` lists every `shape=` value (and shape-selecting named
   style such as `ellipse`) including those inside `xml`. `cls`:
   - `a` maxGraph core shape (`@maxgraph/core` 0.10.3 `register-shapes.js`),
   - `b` stencil from the vendored XML,
   - `c` JS shape registered by `Shapes.js` / `shapes/mx*.js` (wins over a stencil of the same name, as in draw.io),
   - `d` other mechanism (edges, text, image, swimlane/container, composite cells, data entries).

Expected counts at v32.4.1: General 45, Misc 54, Advanced 33, Basic 76, Arrows (arrows2) 31,
Arrows (legacy) 34, Flowchart 34.

Licensing: draw.io is Apache-2.0 (`third_party/drawio/LICENSE`); the stencil libraries carry the
extra terms in `public/stencils/LICENSE`. See `third_party/drawio/README.md`.
