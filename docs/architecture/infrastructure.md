# Infrastructure (how the shell is put together)

The shared building blocks every change builds on. Each has a guard (unit test or lint rule).

## Layers (eslint-plugin-boundaries, `eslint.config.js`)

`core <- document <- features <- ui`. A layer imports its own layer and the ones to its left.

| Layer | Directories |
|---|---|
| core | `src/core`, `src/format`, `src/drawio-shapes`, `src/shapes`, `src/security`, `src/drawio` (logger), `src/config` |
| document | `src/document` (DiagramDocument), `src/services` |
| features | `src/railway` (the domain base the others may use), `src/scenarios`, `src/railway-script`, `src/railml`, `src/ai`, `src/share` |
| ui | `src/ui`, `src/boot`, `src/debug`, `src/main.ts`, `src/main-editor.ts` |

The listed exceptions in the config are current reality with a TODO each (feature UI glue that uses the shell,
type-only imports of UI types in feature install signatures, a few cross-feature imports, the clipboard's railway
renumbering); new code must not add to them. Probe test: `src/__tests__/lint/boundaries.test.ts`.

## Core helpers

- `core/install-once.ts` `installOnce(target, key)`: the one idempotency helper for patches (graph method wrappers,
  handler augmentations); page-wide installs use `createInstallScope()`.
- `core/event-bus.ts` `emit` / `on` / `off`: the typed app event bus (`AppEventMap`; upper layers add events by
  module augmentation, e.g. `ui/session.ts` `active-session-changed`). Guard: no `new CustomEvent(` outside it.
- `core/graph-events.ts`: `onGraphEvent` / `onModelChange` / `onSelectionChange` / `onViewTransform` return disposers;
  `Disposers` collects them. Guard: no `as unknown as EventSource` casts.
- `core/safe-storage.ts` (the only module touching Web Storage) + `core/storage-keys.ts` (every key string). Guard: no
  raw `localStorage` / `sessionStorage` and no key strings elsewhere.
- `core/keyboard-guard.ts` `shouldIgnoreGraphShortcut` (typing in inputs / contentEditable / IME / cell editor).
- `core/modal.ts` `openModal`: the one modal primitive (role=dialog, aria-modal, labelledby / label, focus trap,
  Esc / Enter, backdrop, stacking, focus return; the caller's DOM classes kept). `ui/app-dialogs.ts` `openAppModal`,
  `confirmDialog`, `promptSaveAs`, `showAboutDialog` are built on it. Guard: no native `alert` / `confirm` / `prompt`.
- `drawio/logger.ts`: logging (debug only in dev builds); eslint `no-console` (warn / error allowed).
- `core/load-failure.ts` `reportLoadFailure(level, category, message, err)`: every lazy loader (palettes, catalogue,
  library search, stencils, vendor shape modules, templates, lazy panels, PDF fonts) reports its failure through it. A
  failure while the page is being left (`pagehide`, or within 5 s of `beforeunload`) or an `AbortError` is logged at
  debug and returns false (the caller skips its notification); a real failure logs at `level`, returns true and the
  caller shows its error state ("Could not load this palette", templates error, notification).

## Graph setup

`ui/setup-graph.ts` `setupGraph(graph, 'editor' | 'view' | 'thumbnail')`: the ordered installer list (the order is the
composition of the method wrappers; `src/__tests__/ui/setup-graph.test.ts` pins it), `teardownGraph` before
`graph.destroy()`, `installGlobalGraphPatches()` once per page. Per-graph behaviour that must also hold for background
tabs is an installer here (e.g. `layer-default-parent`, `popup-selection-off`), not a panel listener.

## The tab: document, session, controllers

- `document/diagram-document.ts` `DiagramDocument` (`tab.document`): the model reference with its load /
  serialisation (page settings, grid, PlantUML metadata, legacy-layer migration), the project (name, metadata, pages
  2..n, page id), the feature sections (`services/project-sections.ts`: `load`, `toCache` / `fromCache`, `subscribe`;
  typed accessors `doc.scenarios`, `doc.railwayScript` added by the features), the remote binding slot (save handler,
  binding restored from the cache) and the autosave state (`cacheEntryJson`, incremental). View effects of a load are
  injected (`DocumentViewHooks`: grid background, scroll reset; `ui/saveload.ts` `createTabDocument`).
- `ui/saveload.ts` `SaveLoadController`: file I/O over the document (save / download, open file or text, export,
  notifications, save status, top-bar title).
- `ui/session.ts`: `DiagramSession` (id, graph, command service, document; `TabData` extends it), the active session
  (`setActiveSession`, bus event `active-session-changed`) and `ActiveSessionBinding`. `ui/session-views.ts`: the
  panels created once by the TabManager and bound to the active session. Per-tab controllers bind to their graph only.
  Guard: `src/__tests__/ui/session-views.test.ts` (background-tab edits never reach the panels; no listener capture).

## Commands and keys

`ui/commands/`: `Command` registry (`registry.ts`), the one keyboard dispatcher (`keymap.ts`) and the contributions
(file, edit, view, arrange, railway, features, help). Menus (`ui/menu.ts` `installMenuBar`), the context menu, toolbar
buttons (`data-command`) and keys dispatch through it; menu hints, tooltips and Help are generated from it. Guard:
`src/ui/commands/__tests__/registry.test.ts`. Details: [editor.md](editor.md).

## Boot

`src/main-editor.ts` lists the boot steps of `src/boot/` in order (see [boot.md](boot.md)).

## Shell objects

`ui/app-context.ts` (`appContext()`: tabManager, notify, saveStatus, leftPanelTabs) and
`services/service-registry.ts` (typed by `ui/app-services.ts`) instead of `window` globals. Guard: no new window
globals (only the dev / e2e fake remote hook).

## Styles

`src/styles/index.css` (tokens `variables.css`, `components.css`, one file per area) and the feature stylesheets
imported by their modules. Colours only as `--rd-*` tokens (stylelint). See [theming.md](theming.md).
