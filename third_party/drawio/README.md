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
| `js/stencils.min.js` | decoded into `public/stencils/{basic,flowchart,arrows}.xml`, `public/stencils/mscae/enterprise.xml` |
| `js/grapheditor/Sidebar.js` | General/Misc/Advanced palette functions (run in a sandbox by the extractor) |
| `js/diagramly/sidebar/Sidebar.js` | sidebar order, legacy Arrows stencil palette (line 1481) |
| `js/diagramly/sidebar/Sidebar-Basic.js`, `Sidebar-Arrows2.js`, `Sidebar-Flowchart.js` | Basic/Arrows/Flowchart palettes |
| `js/grapheditor/Shapes.js`, `shapes/mxBasic.js`, `shapes/mxArrows.js`, `shapes/mxFlowchart.js` | JS shape names (palette classification) and the shape ports |
| `js/grapheditor/Graph.js` | `getBasenameForStencil` (line 22346), stencil set parsing, color handling (engine port) |

## Generated / vendored files in this repo

Reproduce with the scripts in `scripts/drawio-palettes/` (see its README). Each file records `drawioTag: "v32.4.1"`.

- `public/stencils/basic.xml`, `flowchart.xml`, `arrows.xml`, `mscae/enterprise.xml` — stencil sets
  decoded from `js/stencils.min.js` with a port of its own `decode()`; attribute values are exactly
  what draw.io passes to `mxStencil` (only the whitespace layout is regenerated).
- `src/drawio-shapes/palettes/data/{general,misc,advanced,basic,arrows2,arrows,flowchart}.json` —
  palette entries (order, titles, sizes, styles, values, tags) extracted by running draw.io's own
  palette functions; compressed data entries are decompressed into mxGraphModel XML.

## Ports (TypeScript, carry the Apache-2.0 header and "Ported from jgraph/drawio v32.4.1 <path>:<line>")

- `scripts/drawio-palettes/decode-stencils-bundle.ts` — `decode()` of `js/stencils.min.js`.
- `src/drawio-shapes/palettes/index.ts` — `getBasenameForStencil` from `js/grapheditor/Graph.js`.
- `src/drawio-shapes/engine/**` — stencil engine and color compatibility (Graph.js, Editor.js, EditorUi.js).
- `src/drawio-shapes/js/shapes-core/**`, `src/drawio-shapes/js/shapes-edges/**` — `js/grapheditor/Shapes.js`.
- `src/drawio-shapes/js/mx-libs/**` — `shapes/mxBasic.js`, `shapes/mxArrows.js`, `shapes/mxFlowchart.js`.
