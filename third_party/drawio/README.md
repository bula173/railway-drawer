# draw.io (jgraph/drawio) — third-party material

This repository vendors data from, and contains TypeScript ports of, the draw.io web app.

- Upstream: https://github.com/jgraph/drawio
- Pinned tag: **v32.4.1** (newest git tag when this was set up; `embed.diagrams.net` served 32.5.1,
  which has no tag, so raw URLs for it do not resolve). Its `VERSION` file reads `32.4.1`.
- Raw source base: `https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/<path>`
- Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG.
- License: Apache License 2.0, see [LICENSE](./LICENSE) (copied verbatim from
  `https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/LICENSE`).

## Stencil libraries: additional terms

`public/stencils/LICENSE` is a verbatim copy of
`https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/stencils/LICENSE`.
It adds a restriction on the icon sets and stencil libraries (and derivatives, including
conversions to other formats, traced reproductions, substantially similar visual representations
and AI-generated images made with them as reference or training input): they may not be used as
software assets in, distributed for use with, or incorporated into **Atlassian products or products
distributed through the Atlassian marketplace or plugin ecosystem** without explicit written
permission. The restriction does not apply to end-user diagram output (exported images or documents).
Railway Drawer is not an Atlassian product; keep that file next to the vendored stencils and do not
ship them in an Atlassian plugin.

## Upstream files used (all at v32.4.1)

| Upstream path (`src/main/webapp/…` unless noted) | Used for |
| --- | --- |
| `LICENSE` (repo root) | `third_party/drawio/LICENSE` |
| `VERSION` (repo root) | tag verification in `scripts/drawio-palettes/fetch-sources.ts` |
| `stencils/LICENSE` | `public/stencils/LICENSE` |
| `js/stencils.min.js` | decoded into `public/stencils/**.xml` (all 204 sets) |
| `js/grapheditor/Sidebar.js` | General/Misc/Advanced/UML palette functions (evaluated by `safe-js.ts`, see below) |
| `js/diagramly/sidebar/Sidebar.js` | `initPalettes()` (sidebar order), library lists, `configuration`, `updateEntries()` (More shapes categories) |
| `js/diagramly/sidebar/Sidebar-*.js` (all but `Sidebar-Advanced.js`) | every other palette |
| `js/grapheditor/Shapes.js`, `shapes/**/*.js` | JS shape names (palette classification), the shape ports and the vendored shape modules |
| `js/diagramly/Editor.js` | `mxStencilRegistry.libraries` (basename -> stencil sets and shape files) |
| `js/diagramly/Dialogs.js` | reference for the More shapes dialog |
| `resources/dia.txt` | English palette titles (`mxResources.get`) |
| `mxgraph/src/util/mxConstants.js`, `mxgraph/src/util/mxUtils.js` | constant values / helpers of the compatibility layer |
| `img/**` | palette images, copied to `public/img/` (vendor notices: `third_party/drawio-libraries/`) |
| `js/grapheditor/Graph.js` | `getBasenameForStencil` (line 22346), stencil set parsing, color handling (engine port) |

Every file except `VERSION`/`LICENSE` and the files listed in `SOURCE_FILES` is fetched by commit
(`9034053fba80a435e27d68d374bc564b83917ae9`, the commit of tag v32.4.1) and checked against that
commit's git blob ids. The downloaded sources are data: `scripts/drawio-palettes/safe-js.ts`
parses them with the TypeScript parser and evaluates the palette functions in its own closed
interpreter (no `eval`, `node:vm` or `Function`), and `vendor-shapes.ts` only parses and copies
the shape files.

Skipped: `Sidebar-Advanced.js` (it only appends draw.io's live ELK layout containers, which this
app does not implement). No icon set was skipped for licensing reasons.

## Generated / vendored files in this repo

Reproduce with the scripts in `scripts/drawio-palettes/` (see its README). Each file records `drawioTag: "v32.4.1"`.

- `public/stencils/**.xml` — all 204 stencil sets decoded from `js/stencils.min.js` with a port of
  its own `decode()`; attribute values are exactly what draw.io passes to `mxStencil` (only the
  whitespace layout is regenerated).
- `public/img/**` — draw.io's palette images (`img/lib/**`, clipart), unmodified.
- `src/drawio-shapes/palettes/data/*.json` — 504 palettes (13,971 entries: order, titles, sizes,
  styles, values, tags) extracted by evaluating draw.io's own palette functions; compressed data
  entries are decompressed into mxGraphModel XML. `catalogue.json` (libraries, More shapes
  categories, counts) and `search-index.json` (titles/tags of every entry).
- `src/drawio-shapes/vendor/*.js` — 46 shape modules (703 shapes), upstream code unmodified inside an
  `install(mx)` wrapper; `index.json` (module -> shapes, dependencies, `mxStencilRegistry.libraries`),
  `mx-constants.json`.

## Ports (TypeScript, carry the Apache-2.0 header and "Ported from jgraph/drawio v32.4.1 <path>:<line>")

- `scripts/drawio-palettes/decode-stencils-bundle.ts` — `decode()` of `js/stencils.min.js`.
- `src/drawio-shapes/palettes/index.ts` — `getBasenameForStencil` from `js/grapheditor/Graph.js`.
- `src/drawio-shapes/engine/**` — stencil engine and color compatibility (Graph.js, Editor.js, EditorUi.js).
- `src/drawio-shapes/js/shapes-core/**`, `src/drawio-shapes/js/shapes-edges/**` — `js/grapheditor/Shapes.js`.
- `src/drawio-shapes/js/mx-libs/**` — `shapes/mxBasic.js`, `shapes/mxArrows.js`, `shapes/mxFlowchart.js`.
- `src/drawio-shapes/vendor-runtime/mx-shim.ts` — mxGraph API subset (`mxUtils`, `mxConstants`, shape base classes)
  for the vendored modules (from `mxgraph/src/util/mxUtils.js` and maxGraph equivalents).
