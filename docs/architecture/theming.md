# Theming (light / dark chrome), canvas grid and scrolling

- One token set: `src/styles/variables.css` (imported first by `src/styles/index.css`, the chrome stylesheet:
  variables, components, then one file per area in the former style.css cascade order; `drawio/workspace.ts` imports it
  too). Semantic
  colors are `--rd-*` (`--rd-bg`, `--rd-surface`/`-2`/`-3`, `--rd-hover`, `--rd-active`, `--rd-text`, `--rd-text-muted`,
  `--rd-text-subtle`, `--rd-border`, `--rd-border-strong`, `--rd-accent`(+`-hover`, `-text`), `--rd-link`, `--rd-focus`,
  `--rd-selected`, `--rd-input-bg/-text/-border`, `--rd-button-bg/-text`, `--rd-danger`/`-solid`/`-bg`, `--rd-success*`,
  `--rd-warning*`, `--rd-info*`, `--rd-hint-*`, `--rd-badge-*`, `--rd-scenario-*`, `--rd-route-*` (route tool orange),
  `--rd-danger-hover`, `--rd-dirty`, `--rd-surface-overlay`, `--rd-shadow`, `--rd-overlay`, `--rd-backdrop`,
  `--rd-scrollbar*`, `--rd-canvas-bg`, `--rd-primary*`, `--rd-divider`, `--rd-focus-ring-soft`, `--rd-drop-highlight`,
  `--rd-shadow-subtle`, `--rd-scrim`). Light values on `:root`, dark on `:root[data-theme="dark"]`,
  each with `color-scheme`. The older names (`--background`, `--surface`, `--text`, `--text-secondary`, `--border`,
  `--divider`, `--primary*`, `--rd-chrome-*`) are aliases of them, left for older TS strings: the stylesheets use the
  `--rd-*` names, without fallbacks. **stylelint** (`.stylelintrc.json`, pinned, part of `npm run lint`) forbids colour
  literals (hex, named, rgb/hsl/… functions) outside variables.css; diagram content drawn by CSS (route highlight, km
  ruler, maxGraph handle rim) is allow-listed with described `stylelint-disable` comments
  (`src/__tests__/lint/stylelint.test.ts`). Never key chrome colors off `prefers-color-scheme`: `<html data-theme>`
  (index.html before first paint, then `src/drawio-shapes/theme/dark-mode.ts`) already resolves the stored choice
  (`rd.theme`) against the system.
- **Never hard-code a chrome color** (CSS, `style=""` in index.html, `element.style.*`/`cssText`/innerHTML in TS): use
  `var(--rd-...)` or a class. A literal color is only right in one theme (the old bug: dark backgrounds with the light
  theme's `#333` text). No per-component `:root[data-theme="dark"] .x { color: #... }` overrides either: if a component
  needs a new color, add a token with a light and a dark value. Text tokens meet WCAG AA (4.5:1) on the surfaces;
  `theme-contrast.spec.ts` enforces it.
- Shared classes in `src/styles/` (components.css, properties.css, context-menu.css, …): `.rd-input`, `.rd-btn` (`.rd-btn-on`, `.rd-btn-locked`), `.rd-btn-solid` +
  `.rd-btn-primary/-danger`, `.rd-field-label`, `.rd-field-caption`, `.rd-section`, `.rd-caret`, `.rd-sep`, `.rd-strong`,
  `.rd-tip`, `.context-menu(-item)`, `.prop-tab(.active)`, `.collapsible-header`. Dialogs built in TS with `cssText`
  use `var(--rd-...)` in those strings. Unstyled
  inputs/selects/textareas get `--rd-input-*` from a zero-specificity `:where()` rule.
- Not chrome (keep their own colors): diagram cells (dark rendering = `graph-compat.ts` `setDrawioDarkMode`), palette /
  template / step thumbnails, PlantUML SVGs (white background like PlantUML), the exported scenario HTML (light).
- Dark rendering of diagrams (render-time only; cell styles, saved files and image/PDF/slide exports stay light):
  `colors.ts` `adaptiveDarkColor` inverts only neutral colours (chroma < `KEEP_CHROMA` 0.3: black -> #ededed,
  white -> #121212, greys, draw.io's pale fills) like draw.io's `getInverseColor`; saturated colours (signal red / green /
  yellow, track colours) are kept. `light-dark(a, b)` takes `b`, except a saturated `a` with a hue-less `b` (the ERTMS
  library's stale `light-dark(#e00000, #5f5f5f)`) keeps `a`. Then `graph-compat.ts` `applyDarkContrast` floors the
  resolved style: strokes / label borders >= 4.5:1 on the canvas (so >= 3:1 on the palette surface too), font >= 7:1 on
  the canvas or >= 4.5:1 on the cell's opaque fill / label background (the light font colour wins when it reads better
  there, e.g. white on a kept red fill). HTML label text colours get the same floor (`resolveHtmlLabelColors(..., text)`),
  stencil-own colours (`<strokecolor color=...>`, node defaults) adapt in `stencil-fixes.ts` `stencilColor`, and maxGraph's
  fixed blue drop-target / connected-edge-handle feedback is lightened in dark mode (`handle-colors.ts`). Thumbnails are
  cached per colour mode (`drawioColorModeKey`) and the palette / Templates / Scenarios panels re-render them on
  `onDrawioColorModeChange`. Images (`image=` / data-URI SVGs) are not recoloured.
- Canvas: tab graph divs get `--rd-canvas-bg` (#fff / draw.io's #121212); the grid is a transparent SVG tile from
  `src/ui/grid-background.ts` (`applyGridBackground`, used by `GridController` and `CanvasProperties`): both tiles
  (#e0e0e0 / draw.io dark #424242) are custom properties on the container and CSS picks one by `data-theme`, so a
  theme switch needs no listener and inactive tabs follow. The grid follows the zoom (cells doubled while < 5 px) and
  starts at the graph origin (`setGridView`, fed by canvas-scroll.ts; one background tile holds several cells, >= 256 px,
  sized in 1/64 px, so the browser's tiling from the scroll origin does not drift off the graph grid); `background-attachment: local` makes it cover the
  whole scrollable area. Canvas scrollbars: `--rd-canvas-scrollbar-thumb/-hover/-track` (thumb >= 3:1 on the track),
  12 px `::-webkit-scrollbar` on `.rd-graph-canvas` (`scrollbar-color: auto` there, else Chromium ignores them).
- Scrolling canvas (`src/ui/canvas-scroll.ts`, draw.io's infinite canvas, page view off): each tab graph div
  (`.rd-graph-canvas`) is the scroll container, `#graph-container` is overflow hidden, so maxGraph's own scrolling
  (scrollCellToVisible, autoscroll while dragging, PanningHandler) works. `graph.sizeDidChange` keeps the content's
  400-unit tiles (`SCROLL_TILE`) plus padding (visible size - 34 px) on every side scrollable and sets `view.translate`
  itself (content at negative coordinates reachable), compensating the scroll so nothing moves on screen: never rely on
  `view.translate` being 0 or set it yourself (it is reset); convert with
  `(scrollLeft + px) / scale - translate.x`. `graph.zoom` / `zoomTo` / `zoomIn` / `zoomOut` keep the view centre
  (10-500 %), `zoomActual` and `fit` centre the content, Ctrl/Cmd+wheel and pinch zoom around the pointer
  (`zoomCanvasAt`); a plain `graph.zoomTo(s)` (center false, maxGraph's default) keeps the view's top-left corner, the
  zoom select uses `zoomTo(s, true)`; Shift+wheel scrolls horizontally, a plain wheel scrolls natively. `resetCanvasScroll` after
  `DiagramDocument.load` (origin at the top-left, or the content's top-left when it reaches into negative
  coordinates); a hidden tab gets its scroll position back when shown (ResizeObserver). Arrow-key nudges scroll the
  selection into view. Pan (`src/ui/pan.ts`, PanningHandler plugin): a left drag on the EMPTY background pans like a map
  (grab / grabbing cursor; `isPanningTrigger`: no cell state, no modifier; a press on a shape, edge, handle or a group's
  gap still selects / moves; a click without a move still clears the selection; a pan never ends in a click);
  Shift+drag (Alt+drag forced, Ctrl/Cmd+drag) on the background = rubber band; Space+drag (also over shapes) and
  middle-drag pan via the force-panning path; right-drag stays the context menu. Overlays positioned in view coordinates as absolute children of
  the graph div (hover arrows, previews) or in the overlay pane (`GraphOverlay`: km ruler, route tool) scroll with it;
  fixed-position editors subtract `scrollLeft/Top`.
