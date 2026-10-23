# draw.io palette data and stencils

Regenerates the draw.io palette JSON and the vendored stencil XML from one pinned draw.io release
(`DRAWIO_TAG` in `fetch-sources.ts`, currently **v32.4.1**). Outputs are committed; run the scripts
only when bumping the tag or changing the extraction.

Requires Node >= 22.18 (native TypeScript type stripping; `npx tsx <file>` also works). Uses the
`typescript` dev dependency as parser; nothing else beyond Node built-ins.

**The downloaded sources are untrusted data and are never executed by a JavaScript engine.**
`safe-js.ts` parses them with the TypeScript parser and evaluates the palette functions in its own
closed interpreter: prototype-less objects, only allow-listed pure string/array/number/Math methods,
host stubs passed in explicitly, no `eval`/`node:vm`/`Function`, no access to Node or globals.
`vendor-shapes.ts` only parses and copies the shape files (they run in the browser app, as ports).

```bash
node scripts/drawio-palettes/fetch-sources.ts            # download + verify (VERSION, SHA-256, git blob ids), copy LICENSE files
node scripts/drawio-palettes/decode-stencils-bundle.ts   # js/stencils.min.js -> public/stencils/**.xml (all 204 sets)
node scripts/drawio-palettes/vendor-shapes.ts            # shapes/**.js -> src/drawio-shapes/vendor/*.js + index.json
node scripts/drawio-palettes/extract-palettes.ts         # Sidebar*.js -> palettes/data/*.json, catalogue, search index,
                                                         # public/img/**, third_party/drawio-libraries/*.md
npx vitest run src/drawio-shapes src/__tests__/drawio-palettes   # validate the output
```

## Steps

1. **fetch-sources.ts** downloads from
   `https://raw.githubusercontent.com/jgraph/drawio/<tag>/` into a cache outside the repo
   (`$DRAWIO_CACHE_DIR`, default `<os.tmpdir()>/drawio-<tag>`; `.cache/` is not git-ignored here).
   It checks the upstream `VERSION` file against the tag and every file against the pinned SHA-256
   table, then copies `LICENSE` to `third_party/drawio/LICENSE` and `stencils/LICENSE` to
   `public/stencils/LICENSE`. `--force` re-downloads; `--print-hashes` prints the table (update it
   when bumping the tag). Then it lists the commit's git tree (GitHub API, cached as
   `tree-<commit>.json`) and downloads `SOURCE_DIRS` (sidebar, shapes, img) and `COMMIT_FILES` from
   `raw.githubusercontent.com/jgraph/drawio/<commit>/`, each checked against its git blob id.
2. **decode-stencils-bundle.ts** reads the `f['<file>'] = '<base64>'` map in `js/stencils.min.js`.
   Each payload is deflate-raw (inflated with `finishFlush: Z_SYNC_FLUSH`) of draw.io's Xml2Js binary
   node stream; `decodeStencilBundleEntry()` is a port of the bundle's own `decode()`. Writes every
   set of the bundle (204 files) to `public/stencils/` (`--verbose` lists them); `VENDORED_STENCILS`
   are the sets the app needed first and are checked to exist.
3. **vendor-shapes.ts** wraps every `shapes/**/*.js` except the hand-ported mxBasic/mxArrows/
   mxFlowchart, plus the Shapes.js shapes the TS port lacks (`SHAPES_JS_EXTRA`), into
   `src/drawio-shapes/vendor/<id>.js` (`install(mx)`, upstream code verbatim); checks free identifiers
   against `SHIM_GLOBALS` (an unknown global fails), declares sloppy-mode implicit globals, links
   cross-file names (`mx.publish`/`mx.lookup`, `deps`), and writes `index.json` (modules, shapes,
   `mxStencilRegistry.libraries` from Editor.js) and `mx-constants.json` (values of mxConstants.js).
4. **extract-palettes.ts** evaluates draw.io's real palette functions (`js/grapheditor/Sidebar.js`
   General..UML, every `js/diagramly/sidebar/Sidebar-*.js` except `Sidebar-Advanced.js`, and
   `initPalettes()`/`updateEntries()` of `js/diagramly/sidebar/Sidebar.js`) with `safe-js.ts` against
   a recording `Sidebar` stub, in `initPalettes` order (504 palettes, 13,971 entries). Entry order, titles, sizes,
   styles, values and tags are draw.io's. Composite entries become mxGraphModel XML (mxCodec form,
   `UserObject` for cells with attributes); the 10 compressed data entries are decompressed
   (`Graph.decompress` semantics). `shapeNames` lists every `shape=` value (and shape-selecting named
   style such as `ellipse`) including those inside `xml`. `cls`:
   - `a` maxGraph core shape (`@maxgraph/core` 0.10.3 `register-shapes.js`),
   - `b` stencil from the vendored XML,
   - `c` JS shape registered by `Shapes.js` / `shapes/mx*.js` (wins over a stencil of the same name, as in draw.io),
   - `d` other mechanism (edges, text, image, swimlane/container, composite cells, data entries).

Expected counts at v32.4.1: General 45, Misc 54, Advanced 33, Basic 76, Arrows (arrows2) 31,
Arrows (legacy) 34, Flowchart 34; 504 palettes / 13,971 entries / 69 libraries in total; 46 vendored
shape modules (703 shapes); 204 stencil sets; 2094 images.

Also written by extract-palettes.ts: `catalogue.json` (draw.io's More shapes categories from
`updateEntries()`, libraries from `Sidebar.configuration`, per palette count, JS shapes and stencil
packages, vendor notices from `libraries.ts`), `search/search-index-NN.json` (the search index in ~200 kB shards, `search-shards.ts`), `public/img/**` (all of `img/`)
and `third_party/drawio-libraries/*.md`.

Licensing: draw.io is Apache-2.0 (`third_party/drawio/LICENSE`); the stencil libraries carry the
extra terms in `public/stencils/LICENSE`. See `third_party/drawio/README.md`. Vendor icon sets
(AWS, Azure, GCP, Cisco, ...) are listed in `libraries.ts`; their notices are generated into
`third_party/drawio-libraries/`.
