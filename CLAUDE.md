# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Railway Drawer: vanilla TypeScript + Vite web app for railway (ERTMS/ETCS) diagrams. No framework, no React.

**Decision: one editor.** The **Railway Drawer editor** (maxGraph, `@maxgraph/core` pinned exactly to 0.10.3: the app
patches internals; `src/__tests__/maxgraph-patch-canary.test.ts` lists them and must pass after any bump) is the product: all
railway features (data, routes, checks, scenarios, sharing) live there. UI text says "Railway Drawer editor"
(never "legacy"/"maxGraph editor").

**The embedded draw.io mode (diagrams.net iframe, "draw.io compatibility view", self-hosted draw.io under
`<app>/drawio/`) was removed on the user's decision.** draw.io compatibility now means the **file format and the
shapes**: native `<mxfile>`/`<mxGraphModel>` read/write (`src/services/drawio-xml.ts`), `.drawio` open/save/import/
export, `#R` share links (also as app.diagrams.net links), the stencil engine and the draw.io palettes/shapes
(`src/drawio-shapes`, `src/ui/drawio-palette`, `scripts/drawio-palettes`, `public/stencils`), the ERTMS library
(`public/libraries/ertms.xml`) and templates. Never weaken that path. **The guard is
`src/services/__tests__/drawio-compat.test.ts`** (fixtures in draw.io's own file format plus the real ERTMS
draw.io library: load -> save round trip must be semantically lossless and the output valid draw.io XML; see
"draw.io compatibility guard" below). Old `?editor=drawio|legacy|main` links still open the
app (the parameter is ignored).

## Commands

Node version: `.nvmrc` (24).

```bash
npm run dev                 # Vite dev server on http://localhost:3000 (host: true, so also on the LAN)
npm run build               # tsc (typecheck) + vite build --base ./  -> dist/ (relative base: same build works at / and /railway-drawer/)
npm run preview             # serve dist/
npm run typecheck           # tsc --noEmit (src, excluding __tests__)
npm run typecheck:tests     # tsc --noEmit -p tsconfig.test.json (src/**/__tests__)
npm run typecheck:e2e       # tsc --noEmit -p tsconfig.e2e.json (tests/e2e + playwright.config.ts)
npm run lint                # eslint src worker tools/mcp-local/src + stylelint src/**/*.css (errors must stay at 0)
npm test                    # vitest watch (jsdom)
npm run test:run            # vitest once
npx vitest run src/__tests__/ui/tab-cache-restore.test.ts   # single file
npx vitest run -t "restores"                                 # tests by name
npm run test:e2e            # Playwright, chromium, starts vite itself (E2E_PORT, default 3000)
npm run drawio:palettes     # regenerate palettes + stencil sets from the pinned draw.io tag (Node >= 22.18)
npm run typecheck:worker    # tsc for worker/ (workers-types) and tools/mcp-local (node)
npm run build:mcp-local     # local stdio MCP server -> tools/mcp-local/dist/railway-drawer-mcp.mjs (docs/AI.md)
npx wrangler deploy --dry-run --outdir <tmp>   # validate the Worker bundle (needs dist/); never deploy from here
node scripts/railml/validate.ts [--xsd railml3.xsd] [files]  # dev only: xmllint against the railML 3.2 XSD (not vendored)
```

CI (`.github/workflows/build-and-deploy.yml`) runs typecheck, typecheck:tests, typecheck:worker, typecheck:e2e, lint (eslint src, worker,
tools/mcp-local/src + stylelint), test:run, build, `wrangler deploy --dry-run` and the
Playwright subset (legacy-smoke, drawio-palette, templates, scenarios, style-edit, share, gitlab, ertms-data,
scenario-uml-text, theme-contrast, remote-persist, scenario-doc, editor-commands, dark-shapes, ertms-routes, railml, drawio-compat,
interaction, hover-arrows, railway-script, ux-batch, ux-batch2a, ux-batch2b, ux-batch3, move-connect, object-states, canvas-scroll,
railway-shapes, backlog-ui, ai, ai-scenarios, all-shapes, access-identity, press-to-move, print-sheets, train-run, interlocking, csp). No
draw.io download is needed (`scripts/drawio-palettes` only runs locally, its output is committed). It does not deploy.

E2E specs (what each covers, helpers, CI rules): [docs/architecture/e2e.md](docs/architecture/e2e.md). CI fails on flaky
tests (a test that passes only on a retry fails) and on CSP violations; all specs run on any port, headless, offline.

## Golden rules

1. **Behaviour first.** The e2e specs are the safety net (press-to-move, theme-contrast, csp, ux-batch*, ...). Run the
   affected specs after a change and the full CI list before handing over.
2. **Layers** `core <- document <- features <- ui` (eslint-plugin-boundaries). Do not add to the TODO exceptions.
3. **One of each:** one keyboard dispatcher (`src/ui/commands/keymap.ts`), one command registry (every menu /
   context-menu / toolbar / key action is a `Command` in `src/ui/commands/`), one modal primitive
   (`src/core/modal.ts`, `openAppModal` on top), one event bus (`src/core/event-bus.ts`), one storage module
   (`src/core/safe-storage.ts` + `storage-keys.ts`), one graph setup (`src/ui/setup-graph.ts`), one sanitizer
   (`src/security/sanitize.ts`), one token set (`src/styles/variables.css`).
4. **Panels are session views**, created once and bound to the active `DiagramSession` (`src/ui/session.ts`);
   per-tab controllers bind to their own graph only. Never bind shared DOM per tab, never patch `addEventListener`.
5. **Document state lives in `DiagramDocument`** (`tab.document`); `SaveLoadController` is file I/O only. New
   per-file data = a project section (`src/services/project-sections.ts`).
6. **No raw** `localStorage` / `sessionStorage`, `new CustomEvent`, `as unknown as EventSource`, window globals,
   `alert` / `confirm` / `prompt`, `console.log` / `info` / `debug` (use `drawio/logger.ts`). Guard tests fail on them.
7. **Colours** only as `--rd-*` tokens with a light and a dark value (stylelint; theme-contrast enforces WCAG AA).
   Never key chrome colours off `prefers-color-scheme`; diagram content keeps its own colours.
8. **draw.io compatibility** is the file format and the shapes: never weaken
   `src/services/__tests__/drawio-compat.test.ts` (change its fixtures only deliberately).
9. **maxGraph 0.10.3 is pinned exactly**; edit cells through the model inside one `batchUpdate`; never write
   `graph.getCellStyle(cell)` back into a cell (`src/ui/style-edit.ts`). After a bump, `maxgraph-patch-canary.test.ts`.
10. **Heavy, user-triggered UI is lazy** (`import()` on first use); dead code is deleted, not kept "for later".
11. Commit messages and docs: keep facts in `docs/architecture/*.md` current when behaviour changes.

## Where things live

| Area | Code | Docs |
|---|---|---|
| Boot order | `src/main.ts`, `src/main-editor.ts`, `src/boot/*.ts` | [boot.md](docs/architecture/boot.md) |
| Shell building blocks (layers, bus, storage, setup, document, sessions, commands, modal) | `src/core`, `src/document`, `src/ui/{session,session-views,setup-graph,app-context}.ts`, `src/ui/commands` | [infrastructure.md](docs/architecture/infrastructure.md) |
| Tabs, autosave, commands / keys, menus, toolbar, panels, dialogs, canvas interaction, hover arrows, layers, project name | `src/ui/tabs.ts`, `src/ui/*.ts` | [editor.md](docs/architecture/editor.md) |
| Theming, styles, canvas grid / scrolling / pan | `src/styles`, `src/drawio-shapes/theme`, `src/ui/canvas-scroll.ts`, `src/ui/pan.ts` | [theming.md](docs/architecture/theming.md) |
| File format, draw.io compatibility guard | `src/format`, `src/services/drawio-xml.ts`, `src/document` | [file-format.md](docs/architecture/file-format.md) |
| draw.io shapes (engine, palettes, stencils) | `src/drawio-shapes`, `src/ui/drawio-palette`, `scripts/drawio-palettes` | [drawio-shapes.md](docs/architecture/drawio-shapes.md) |
| All draw.io libraries, More shapes, user libraries | `src/ui/drawio-palette` | [drawio-libraries.md](docs/architecture/drawio-libraries.md) |
| Railway symbol size standard (library generators, schematic builder, Normalize Symbol Sizes) | `src/railway/symbol-sizes.{json,ts}`, `scripts/ertms-library`, `scripts/railway-libraries` | [symbol-sizes.md](docs/architecture/symbol-sizes.md) |
| Templates | `src/ui/templates` | [templates.md](docs/architecture/templates.md) |
| Railway object data, Data / Checks panels | `src/railway` | [railway-data.md](docs/architecture/railway-data.md) |
| Topology, routes, snapping, km | `src/railway` | [railway-tools.md](docs/architecture/railway-tools.md) |
| Interlocking table, conflict matrix, rule checks + settings | `src/railway/{interlocking,rule-checks,rule-settings}.ts` | [rules.md](docs/architecture/rules.md) |
| Object states | `src/railway/states*.ts` | [object-states.md](docs/architecture/object-states.md), docs/STATES.md |
| railML 3.2 | `src/railml` | [railml.md](docs/architecture/railml.md), docs/RAILML.md |
| Railway Script | `src/railway-script` | [railway-script.md](docs/architecture/railway-script.md), docs/RAILWAY-SCRIPT.md |
| Pages, print sheets (page setup, title block, revisions, legend, sheet references, sheet PDF / Print…) | `src/document/diagram-document.ts` (pages), `src/print`, `src/print/ui` | [print-sheets.md](docs/architecture/print-sheets.md) |
| Scenarios (steps, view, exports, UML, Markdown) | `src/scenarios` | [scenarios.md](docs/architecture/scenarios.md) |
| Train run (simulation, run view, scenario from run, AI tool) | `src/railway/train-run`, `src/scenarios/train-run-scenario.ts` | [train-run.md](docs/architecture/train-run.md) |
| PlantUML (editor tab, step UML) | `src/ui/plantuml-editor.ts`, `src/services/plantuml-*.ts`, `src/services/*-diagram-renderer.ts` | [plantuml.md](docs/architecture/plantuml.md) |
| AI assistant | `src/ai`, `worker/`, `tools/mcp-local` | [ai.md](docs/architecture/ai.md), docs/AI.md |
| Sharing, links, remote providers | `src/share` | [sharing.md](docs/architecture/sharing.md), docs/GITLAB.md, docs/SHAREPOINT.md |
| Deploy, security headers / CSP, LAN | `wrangler.jsonc`, `worker/`, `public/_headers`, `vite.config.ts` | [deploy.md](docs/architecture/deploy.md) |
| Tests (unit setup, e2e) | `src/**/__tests__`, `tests/e2e` | [tests.md](docs/architecture/tests.md), [e2e.md](docs/architecture/e2e.md) |

## Adding things

- **A menu item / shortcut / toolbar button:** a `Command` in the matching `src/ui/commands/*.ts` (`shortcut` + `keys` +
  `help` for a key), the `data-action` (menus) or `data-command` (toolbar) in `index.html`. The registry test checks
  ids, shortcut uniqueness and Help.
- **A panel:** a view in `src/ui/session-views.ts`: DOM listeners once, graph listeners via `ActiveSessionBinding`.
- **A dialog:** `openAppModal` (themed) or `openModal` on your own elements (`src/core/modal.ts`).
- **A per-file datum:** a project section (`registerProjectSection`: attributes / pages, `load`, `toCache` / `fromCache`)
  and its typed accessor (`defineSectionAccessor`).
- **A graph behaviour:** an installer in `src/ui/setup-graph.ts` (mind the order), idempotent via `installOnce`.
- **A storage key:** `src/core/storage-keys.ts` (`rd.<area>.<name>`), accessed via `src/core/safe-storage.ts`.
- **A boot step:** a function in `src/boot/*.ts`, called from `src/main-editor.ts` at its place in the order.
