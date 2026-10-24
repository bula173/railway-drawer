# Main editor (tabs, commands, menus, panels, canvas interaction)

- `src/ui/tabs.ts` `TabManager`: each tab owns its own `Graph` (a div inside `#graph-container`), its
  `GraphCommandService`, its `DiagramDocument` (`tab.document`, `src/document/diagram-document.ts`) and the controllers
  with per-tab state that bind to the graph (and its div) only: `SaveLoadController` (file I/O over the document),
  clipboard, delete, pan (Space pan mode), grid / grid snap, image upload, paste image, alignment, grouping,
  transform, duplicate offset, export image, text editor, hover arrows. `destroyTab()` calls their `destroy()`.
  **Session views** (`src/ui/session.ts`, `session-views.ts`): the shared panels are created ONCE by the TabManager
  (`tabManager.views`: Properties, Layers, status bar, connector fields, Canvas Properties, the other property fields
  and the zoom select (`interactive-ui.ts`), menu state (Undo / Redo, grid), context menu, PlantUML editor). A
  `DiagramSession` (`TabData` extends it: id, graph, command service, document) is made the active one by the
  TabManager (first tab, tab switch, none while the shown tab closes, destroy) and announced on the bus
  (`active-session-changed`, declared by module augmentation in session.ts); each view rebinds its graph listeners to
  the active session with `ActiveSessionBinding` (disposers), so an edit on a background tab never touches the visible
  panels (`src/__tests__/ui/session-views.test.ts`). Per-tab view state is kept per graph (Canvas Properties
  request, PlantUML group being edited). The Data / Checks panels (railway) follow the same event. A new panel is a
  view (DOM listeners bound once, graph listeners via ActiveSessionBinding), never a per-tab controller on shared DOM;
  there is no listener capture any more (a guard test fails on an `EventTarget.prototype.addEventListener` patch).
  Per-graph state that must also hold for background tabs is a setupGraph installer (`layer-default-parent`,
  `popup-selection-off`).
- Autosave: `TabManager.saveToCache()` every 5 s (next idle period) through `src/services/cache-service.ts`: index
  `rd.cache.index` + one key per tab `rd.cache.tab.<id>` (version 2; the version 1 single key `railway-drawer-cache` is
  still read and migrated once; failed saves set the stale marker). Each tab's entry is built by its document
  (`DiagramDocument.cacheEntryJson`: the model is serialised again only after a model change or a change of the
  serialisation inputs, sections only after their change). Call `tabManager.flushCache()` before anything that leaves
  the page. Tabs that fail to restore keep their cached XML until edited (`DiagramDocument.keepUnrestoredXml`).
- Style edits (`src/ui/style-edit.ts`, used by `PropertiesPanel`, `EdgePropertiesController`, `InteractiveUIController`):
  like draw.io's setCellStyles, only the edited keys of each selected cell's OWN style change (one undoable edit). Never
  write `graph.getCellStyle(cell)` back into a cell: it is the resolved style (maxGraph's stylesheet deletes `none`
  values, base style names are merged away, light-dark()/default/inherit resolved), which brought back outlines, fills
  and arrow heads on draw.io/template cells. Displays use the resolved style (`effectiveColor`: missing color = none).
  maxGraph only dashes with `dashed=1`; `dashPattern` is space separated. Copy / Paste Style (format painter,
  `GraphCommandService.copyStyle/pasteStyle`) = draw.io's Graph.pasteStyle with `PASTE_STYLE_KEYS` (Graph.cellStyles:
  visual keys only, never shape/stencil/locked/rd*) through `pasteStyleToCells` (locked cells skipped, one undo step).
- `src/services/graph-command-service.ts` `GraphCommandService` (one per tab): undo/redo via maxGraph
  `UndoManager` wired like `Editor.installUndoHandler` (records `InternalEvent.UNDO` from model and view;
  undo/redo replays do not re-record), plus copy/cut/paste/delete/selectAll. `DiagramDocument.load()` clears history.
- **Commands** (`src/ui/commands/`): every menu item (`data-action`), context-menu item, toolbar button
  (`data-command`) and keyboard shortcut runs a registered `Command { id, label, run(ctx), isEnabled?, isChecked?,
  shortcut?, keys?, help? }` (families: `railwayRoute:`, `railwayState:`, `exportRailway:`, `drawio:` get the rest of the
  id as `ctx.arg`) on the active tab (`ctx.tab`); `ctx.source` (menu / contextMenu / toolbar / panel / keyboard) and the
  context menu's `ctx.target` (right-clicked cells, click position) select the few variants (context Paste at the click
  point, Ctrl/Cmd+D = offset copy, Ctrl/Cmd+1 = fit 20 px; a `panel` arrange command does nothing while the active graph
  is hidden). The Properties > Arrange buttons are `data-command` buttons (z-order, Rotate 90°, Flip, Group / Ungroup,
  Snap to Grid `snapToGrid`, Copy Size `matchSize`, Lock `toggleLock`; bound by `session-views.ts` with source `panel`,
  Arrange > Normalize Symbol Sizes `normalizeSymbolSizes`: the selected railway symbols get their standard box,
  one undo step, lazy `src/railway/normalize-sizes.ts`, see [symbol-sizes.md](symbol-sizes.md);
  one undo step each); the panel's model listener refreshes the rotation field, flip and lock state. Contributions: file, edit, view, arrange, railway, features
  (scenarios, Railway Script, railML, share; the AI assistant has none), help. Adding an action = a command (+ the
  `data-action` in index.html); `src/ui/commands/__tests__/registry.test.ts` fails on a data-action without a command,
  a shared shortcut, or a shortcut without a key binding or Help row.
- Keyboard: ONE dispatcher (`src/ui/commands/keymap.ts`, installed by `bootKeyboard`) runs each command key once on the
  active tab. Capture phase (the shell rules): `always` bindings first (Ctrl/Cmd+S, also while typing), then the
  interceptors (scenario view), then — unless `shouldIgnoreGraphShortcut(e, graph)` (`src/core/keyboard-guard.ts`: input,
  textarea, select, contentEditable, IME composition, cell editor) says the user is typing, the key is on `#menu-bar` /
  `#context-menu` / toolbar dropdowns / the left-panel overflow menu, or Delete/Backspace is on the left-panel tab strip —
  every matching `graph` binding (Ctrl/Cmd+Z/Y/Shift+Z/C/X/V/A, Ctrl/Cmd+Shift+I/E/A/K/P, Delete/Backspace, Escape,
  Alt+Shift+A, arrow-key nudge). Bubble phase (after element handlers, so a field / tab button that stops a key keeps
  it), each with its former guard: Enter/Space label editing, Space pan mode (keyup leaves it), Escape closing the menus
  and the context menu, Ctrl/Cmd +/=/-/0/1 zoom (not in `<input>`/`<textarea>`), Ctrl/Cmd+G / Shift+G, Ctrl/Cmd+H/J/R /
  Shift+R, Ctrl/Cmd+D, F1, Alt+F/O/R/N/V/1-4 object states. Every matching binding runs, in registration order. Never
  bind a `document` keydown for an app shortcut: add `keys` to a command.
- Shortcut hints are generated from the registry: `src/ui/shortcut-keys.ts` (`shortcutSpecFor`, `applyShortcutHints`:
  right-aligned `<kbd class="rd-kbd">` (Ctrl+…, ⌘ symbols on macOS) + `aria-keyshortcuts` on menu and context-menu items;
  text changes via `setMenuItemLabel`), toolbar tooltips (`data-shortcut` = a command id), Help > Keyboard Shortcuts
  (`ui/commands/help.ts` `helpSections`: each command's `help` rows + the mouse / menu gestures; `shortcuts-help.ts`
  `ShortcutsHelpController`, bus event `shortcuts-help-request`, F1 not over another dialog).
- Menus (`src/ui/menu.ts` `installMenuBar`, once; items run their command through `runMenuAction`, which refreshes the
  graph after it like before; opening a menu syncs check marks / disabled items from `isChecked` / `isEnabled`,
  `menu-state.ts`): WAI-ARIA menubar (`#menu-bar` role=menubar, buttons role=menuitem +
  aria-haspopup/aria-expanded/aria-controls, roving tabindex, items role=menuitem / menuitemcheckbox, submenu title
  aria-haspopup); ↓/Enter/Space open + first item, ↑ last item, ←/→ other menu, Home/End, Enter/Space run, Esc closes and
  focuses the button, Tab closes. Item clicks are delegated per dropdown (generated remote items keep their own handlers);
  `aria-disabled="true"` items do nothing (Edit > Undo/Redo follow the undo history, `MenuStateView`). `data-action`
  values and selectors are stable (tests). Menus: File (New, Open…, provider items, Save, Save As…, Save as Template…,
  Import ▸ draw.io File (New Tab) / railML / Railway Script / Image as Custom Shape, Export ▸ Download .drawio (`export`) /
  PNG / SVG / railML / Railway Script / Railway Data ▸ / Scenario ▸, Share…, Print), Edit, View (zoom, Grid = the toolbar grid
  button = Properties > Canvas grid via `grid-toggle.ts`, Dark Mode, ERTMS Tab, Connection Arrows), Arrange, **Railway**
  (route tool + tables, Update Route Paths, Recalculate km, Edit Data…, Run Checks, Railway Script Editor, Object State ▸,
  Snap to Track, Show Routes, km Ruler), Extras (PlantUML Editor, Design Custom Shapes…), Help. Each `data-action` exists once. Submenus =
  `.menu-submenu[data-submenu]` > `.menu-submenu-title` (aria-haspopup, aria-expanded) + `.menu-submenu-list` (role=menu,
  nestable), shown by CSS :hover / :focus-within; → / Enter open on the first item, ← / Esc back to the title. e2e:
  `tests/e2e/menu-helpers.ts` `clickMenuItem(page, menu, action)` / `revealMenuItem(item)` hover the submenu chain.
  File > New = `TabManager.openNewTab()` (draw.io-like: new tab "Diagram <n>",
  shown, its project named alike); the "+" button and the first start do the same. Help > About = `showAboutDialog`.
- Side panels (`src/ui/side-panels.ts` `installSidePanels`, replaces resizable-panels.ts): left (Shapes) / right
  (Format) collapse via the toolbar's `#btn-toggle-left-panel` / `#btn-toggle-right-panel` (aria-pressed), View > Shapes
  Panel / Format Panel (`toggleLeftPanel` / `toggleRightPanel`, menuitemcheckbox) and Ctrl/Cmd+Shift+K / +P (dispatcher, like
  draw.io); `.rd-panel-collapsed`. Resize handles: role=separator, 8 px hit area along the inner edge (`.panel-resize-handle`, 2 px
  accent line on hover/focus/drag), arrow keys 16 px (Shift 64). Widths (180-520) and collapsed state in localStorage
  `rd.sidePanels`. Narrow screens: `body.rd-narrow` (narrow-screen.ts, below 900 px; rule in narrow-screen.css) hides both panels;
  a toggle then opens one for the session (`.rd-panel-open-narrow`), the stored state is untouched.
- Left tab strip (`src/ui/left-panel-tabs.ts`): one row; when the labels do not fit, the bar gets `.rd-tabs-compact` and
  inactive tabs show only their icon (`TAB_ICONS` -> `TOOLBAR_ICONS` shapes/templates/layers/uml/script/train; tooltip and
  aria-label = the label), so all tabs fit the default 240 px panel; tabs that still do not fit (the active one always stays) get
  `.rd-tab-overflow` and are listed in the "»" menu (`.left-panel-tab-more` -> `.left-panel-overflow-menu` role=menu,
  `.left-panel-overflow-item[data-tab]`, arrows/Esc), relaid on resize / switch / close. Every tab button has `data-tab`.
  Each tab is a `.left-panel-tab-btn[data-tab]` wrapper (no button in a button) with its `button.left-panel-tab-label`
  (label in a span); PlantUML and ERTMS also get a sibling `button.tab-close-btn` ("Close <tab> tab", Tab-reachable),
  Delete on the focused tab closes it (the keymap ignores Delete/Backspace on `.left-panel-tabbar`), and
  the » menu lists `.left-panel-overflow-close[data-tab]` "Close <tab>" after such a tab (Delete on its item too);
  reopened by Extras > PlantUML Editor / View > ERTMS Tab.
- Toolbar (`index.html` `#toolbar-container` role=toolbar, chrome by `src/ui/toolbar.ts` `installToolbar`, once): groups
  (role=group) Zoom | Edit (Undo, Redo, Delete) | Insert (rectangle, ellipse, diamond, line, connect two selected, image as
  custom shape) | Arrange (Grid toggle = View > Grid, format painter, Align / distribute dropdown `#btn-align` ->
  `#align-menu` with AlignmentController's `#btn-align-*` / `#btn-distribute-*`) | Railway (Route tool, Run checks, km
  ruler mirroring the menu item via `data-mirror-action`) | View (panels, fullscreen). Buttons carry `data-icon`
  (`TOOLBAR_ICONS`, inline 24x24 stroke SVG, no emoji), `data-label` (-> aria-label) and optional `data-shortcut` (an
  command id -> tooltip "Undo (Ctrl+Z)") and `data-command` (the command a click runs, bound once by
  `bindCommandButtons`); toggles use aria-pressed. The same icon set serves the rest of the
  chrome (`applyInlineIcons` for `[data-rd-icon]`, `setInlineIcon`): top-bar logo (train) and Share, Properties text
  alignment, layer eye/lock, shape designer, remote file browser; no emoji anywhere in the chrome. Align / distribute
  (AlignmentController): cloned geometries via `model.setGeometry` in one batchUpdate (one undo step), locked cells
  skipped (also as reference). Removed: pan ‹ ›, the green "+" rectangle, the toolbar
  shape-designer button (Extras), the single Distribute button.
- Dialogs: ONE modal primitive, `src/core/modal.ts` `openModal` (in core so the features may use it): on the caller's
  overlay / dialog elements (their DOM classes kept for tests and the contrast audits) it sets role=dialog,
  aria-modal, aria-labelledby (title) or aria-label, traps the focus, Esc = cancel, Enter (outside buttons / links /
  text areas) = submit, custom keys first (`onKey`), backdrop press = cancel (mousedown or click), stacking (only the
  topmost modal takes keys; overlays removed without close() are released), keys kept from the app shortcuts (window
  capture + stopPropagation), focus returned. Used by `src/ui/app-dialogs.ts` (`.rd-tpl-modal` look): `openAppModal`,
  `promptSaveAs` (File > Save As…: name -> `renameActiveProject` + download `<name>.drawio`), `confirmDialog`,
  `showAboutDialog` (`APP_VERSION`/`BUILD_ID`/`BUILD_TIME` from `config/build-id.ts`, the status bar's source;
  `VITE_APP_VERSION` = package.json version via vite.config.ts); and by the share modal, template dialogs, railML
  dialogs, route tables, Railway Script export, scenario dialogs (export chooser, PDF / slides options, step editor),
  the user library prompt, shape designer, image upload and duplicate dialog. Use them (or notifications) instead of
  alert()/confirm() in the chrome; a new dialog uses openModal / openAppModal (`src/core/__tests__/modal.test.ts`).
- Properties panel states (`src/ui/properties-state.ts` `setPropertiesPanelState`, the only place that toggles
  `#prop-placeholder` / `#canvas-props` / `#prop-editor` / `#edge-properties` / `#prop-selection-header`; `data-state` on
  `#property-content`): none (nothing selected), canvas (after a click on the empty canvas, checked after maxGraph handled
  the click and only while the selection is empty), cell (header `selectionTitle`: "Signal S1" for railway objects, else the
  label, "Shape"/"Group"/"Connector"; "3 shapes"/"2 connectors"/"4 items"). Owned by the `PropertiesPanel` view; the Style
  tab is shown first (draw.io Format panel). Zoom: the status bar view's `syncZoom` on SCALE and SCALE_AND_TRANSLATE and
  on a session change: `#status-zoom` + `#zoom-level` (a non-preset zoom gets its own `data-custom` option).
- Save status (`save-status.ts`): "Saved in browser" (autosave), "✓ Saved to <file.drawio | provider>" after a real
  save/open (`markAsSavedToDisk(target)`); File > Save / Save As download `<project>.drawio`.
- `src/services/service-registry.ts` holds tabManager/notifications/etc. (typed by `ui/app-services.ts` declaration
  merging) and `src/ui/app-context.ts` the shell objects (tabManager, notify, saveStatus, leftPanelTabs; provided by
  `bootLeftPanel`) instead of `window` globals; a guard test fails on a new window global (only the dev/e2e fake
  remote hook `window.__rdFakeRemote` exists).
- maxGraph 0.10 API: `GraphDataModel` has no getParent/getChildCount/getChildAt/getChildren/`children` (use
  `cell.parent`, `cell.children`, `cell.getChildAt`, `model.add(parent, cell, index)`), `Graph` has no `getModel()`
  (`getDataModel()`) or `getCanvas()` (`graph.view.getCanvas()`). Edit cells through the model (`model.setGeometry`,
  `model.setStyle`, `model.add`) inside one `batchUpdate`, never `cell.setGeometry/setStyle` (not undoable, no events).
  `graph.orderCells` does not sort the selection itself: pass `styleUtils.sortCells(cells, true)`.
- Z-order and selection commands live in `GraphCommandService` (`toFront`/`toBack`/`bringForward`/`sendBackward`,
  `selectAll` = draw.io's `graph.selectAll(null, true)`, skipped on a `locked=1` layer); Arrange menu, context menu
  and Ctrl+A call them. Bring Forward/Send Backward = `stepOrder`: a cell swaps only with an unselected neighbour.
- Lock = draw.io's style key `locked=1` (`src/ui/cell-lock.ts`, installed per tab graph by `installCellLocking`):
  `graph.isCellLocked` = maxGraph's || `locked=1` on the cell or an ancestor (group/layer), which maxGraph's
  movable/resizable/bendable/editable/disconnectable/label-movable checks use; deletable, rotatable and
  `isValidSource`/`isValidTarget` also refuse locked cells; locked cells stay selectable, cells on a `locked=1` layer
  are not selectable. Context menu Lock/Unlock and the Properties Lock button = `toggleCellsLocked` (draw.io
  `lockUnlock`: first cell decides; via `setCellStyleValues`, one undo step). Delete/cut/context Delete pass
  `graph.getDeletableCells(selection)` to `removeCells`, so a locked cell's edges stay too (draw.io deleteCells).
  Properties Arrange X/Y/W/H, constrain, rotation, Rotate 90°, flips are disabled while the shown cell is locked
  (`graph.isCellLocked`: also via its group/layer; refreshed on model changes) and their handlers skip locked cells.
  Arrow keys = `GraphCommandService.nudge` (1 px, Shift = grid size; `getMovableCells` of the topmost selected cells,
  one undo step; only when the focus is on the canvas/body; snap to track only refreshes km/track, never moves: `withSnapDataOnly`).
- Canvas interaction like draw.io (`src/ui/connections.ts` `installDrawioConnectionStart`, `src/ui/canvas-interaction.ts`):
  maxGraph's ConnectionHandler started an edge from a vertex's central hotspot (and the old fallback had a centre
  connection point), so a middle drag drew an edge and a click on a group child selected the child. Now
  `isValidSource` is false until a connection started (only connection points start one; targets unchanged).
  **Press to move** (user report "clicking an object draws an arrow or it cannot be moved"; regression
  `tests/e2e/press-to-move.spec.ts`): a new connection starts from a point only when the press is within
  `SOURCE_POINT_TOLERANCE` (3 screen px, not zoomed; maxGraph's mouse box reached ~6.5 px) of the 'x' AND not more than
  `SOURCE_POINT_INWARD` (1 px) inside the shape from it (`isOnSourcePoint`); small shapes (< `SMALL_SHAPE_PX` 32 on screen)
  and railway symbols only from points on their bounds, pressed on the edge pixel or outside; never in the central 50 %;
  the grid-snapped point maxGraph also tests never starts one. Like draw.io Graph.js: no source points on a SELECTED cell
  (`isStateIgnored`, reset on selection change; a press on a selected shape always moves it), Alt hides the points.
  Cursors are honest: default on the empty background (grabbing while panning, grab with Space), `move` over a movable
  shape (`rd-cursor-move` where the DOM misses it), crosshair only on a highlighted point (`rd-cursor-connect`). Connection points like draw.io: shapes without own
  points (`points` style, stencil, JS-shape constraints) get draw.io's per-shape defaults (`defaultConnectionConstraints`:
  rectangle/group/image 16 = corners, quarters, midpoints; ellipse 8; rhombus; triangle), drawn with draw.io's blue 'x'
  (`CONNECTION_POINT_IMAGE`, data: SVG; maxGraph's `images/point.gif` is not shipped, so points were invisible); valid
  targets outlined `#00a8ff` (`installDrawioEdgeEnds`). An edge end dropped on a body (not on a point) connects floating:
  maxGraph 0.10.3's EdgeHandler passed `outline = true` to updatePreviewState, which stored the drop position as a fixed
  entry point; `outline` is set to `outlineConnect` (false) per edge handler. ERTMS symbols connect as a whole
  (`installSymbolGroupConnect`, a `Cell.prototype.isConnectable` patch): a group vertex with `rdKind` is connectable
  (the library's `connectable="0"` stays in the file), its descendants are not, so maxGraph's connectable-parent
  fallback hits the group. `installGroupBackgroundHit` (canvas-interaction.ts): a MOUSE_DOWN on the background inside
  any shape's bounds (transparent ellipse/stencil/icon corners, triangle balises, group gaps; `cellAtBackgroundPoint`:
  `vertexAt` = the smallest object whose bounds hold the point, so an insulated joint inside a signal's bounds wins; else
  the nearest edge within `EDGE_HIT_TOLERANCE` 6 + strokeWidth/2; tiny <1 px vertices grown by the tolerance) gets that
  cell's state, so it is selected/moved (pan only when nothing is there); MOUSE_MOVE/MOUSE_UP over connectable vertices
  (points show, an edge end dropped in a gap connects); cheap `isNearGraphBounds` pre-check. A press whose DOM target is an
  unselected edge's line inside a vertex's bounds goes to the vertex when it is a railway symbol or the press is only in the
  line's hit halo (`vertexOverEdge`: a signal beside a track, a balise on a marker line). Alt+click = the cell behind
  (draw.io isTransparentClickEvent, cycling; maxGraph 0.10.3's own version never finds one). `installPressToMove`
  (installed by the tab's ConnectionHandler after the draw.io handles): Shift+click toggles like Ctrl/Cmd (draw.io
  isToggleEvent); `companionCells` move with the dragged object (balises whose `groupId` is a dragged balise group and lie
  in its frame; unconnected `points` legs starting on a dragged track: track-layout turnouts); small shapes and railway
  symbols get only the bottom-right sizer, outside small ones (`manageSizers`), so their body moves instead of resizing.
  Snap to track ignores tracks moved/added in the same edit (`excludeTargets`: a dragged template keeps its layout);
  the drag feedback collects the snap targets once per drag (`snapContext`). `installRailwaySplitRules`: no edge split when a
  railway object is dropped on an edge or an edge is a railway object (a balise on a track split the track into two
  edges connected to it) or with Alt/Shift (draw.io); a group with `rdKind` is never a drop target. Moving: draw.io's
  grid (gridSize 10, `gridEnabled` = View > Grid; per tab: a file's `grid` / `gridSize` on `<mxGraphModel>` are applied on
  load and written back on save, `grid-toggle.ts` `applyGridSettings` / `syncGridUi` on tab switch and load; `snapDelta` aligns an off-grid cell only on moves of half a grid step or
  more), Alt held during the drag = no grid and no track snap (Alt or Shift pressed before a press on the empty
  background = rubber band; a plain drag there pans, src/ui/pan.ts), no guides, drag start tolerance 4 px. Context menu
  (`contextSelectionFor`): a right-click inside the selection (cell or ancestor selected) keeps it, else the topmost
  selectable ancestor is selected; edges get the cell menu; maxGraph's PopupMenuHandler selection is off
  (`selectOnPopup`/`clearSelectionOnBackground` = false: it changed/cleared the selection on mouse-up after Lock).
- Connection arrows = draw.io HoverIcons (`src/ui/hover-arrows.ts` `HoverArrowsController`, one per tab, built in
  `TabManager.createTab` after the graph setup (ConnectionHandler patches), `tab.hoverArrowsController`): four DOM arrows (draw.io's images,
  `--rd-hover-arrow` / `-outline` tokens, 50 % opacity until hovered) in the graph div around (never over: outside the union of the cell's bounds, its shape's bounding box and its label's bounding box, `hoverArrowAnchorBounds`: a press on a label outside the vertex, e.g. a km post's, moves the cell) the cell a click would
  select (`hoverArrowCell`: group before its children, unlocked incl. group/layer, connectable or a group, no edges,
  `allowArrows=0` honoured) after a 140 ms rest; never while a button is down, editing, Route tool active
  (`.rd-route-tool-active`) or in the scenario view (`body.rd-scenario-viewing`). Hidden outside the cell+arrows box
  (+10 px), on container leave/scroll, selection change, edit start, Escape (the `edit.clearSelection` command calls `escape()`), Alt;
  repositioned on view/model changes; an arrow over another (not 3x larger) cell or an edge is hidden (draw.io
  checkCollisions). Click = `connectVertex` (draw.io Graph.connectVertex, one batchUpdate so one undo step and the ERTMS
  snap joins it): an unlocked cell within 40 px of the point 80 (`defaultEdgeLength`) beyond the side is connected,
  else a clone (`graph.cloneCells`, `prepareClonedCells`: next free railway ID per kind, `rdRoutes`/`rdRailml*Id`/
  `rdRailmlNetElements` dropped; one shared module `src/railway/clone.ts`, also used by copy/paste, Ctrl+D duplicate,
  palette and template inserts: free IDs kept, colliding ones renumbered, references among the clones follow) is added 80 away in the source's parent and connected; Ctrl/Cmd = always clone,
  Shift = no clone (dangling edge), Ctrl+Shift = clone without edge; the new cell (else the edge) is selected. Edges get
  the connection handler's style (graph default). Drag = `ConnectionHandler.start` from the cell (draw.io
  HoverIcons.drag); while it runs `isCreateTarget` is true, so a drop on blank canvas inserts a prepared clone at the
  pointer (selected), a drop on a cell connects (floating / its connection point). Hovering an arrow shows
  `.rd-hover-arrow-preview` (dashed clone box, or solid outline of the target). Setting: View > Connection Arrows
  (`data-action="toggleConnectionArrows"`, Alt+Shift+A), localStorage `rd.connectionArrows` (default on). Not ported:
  draw.io's shape picker on plain click / blank drop, containers as clone parents, Ctrl+Shift+drag port constraint,
  touch. Tests: `src/__tests__/ui/hover-arrows.test.ts`, `tests/e2e/hover-arrows.spec.ts`.
- ERTMS palette display (`src/ui/ertms-display.ts`, wraps `ertmsPaletteSource` in boot/panels.ts): titles trimmed and
  "SIgnal" -> "Signal", "Point Left/Right" -> "Points Left/Right" (`kindForLibraryTitle` takes both), the dashed one of the
  two "Line" entries -> "Dashed Line" at display time only (ertms.xml stays byte-identical), EN+PL railway search tags by kind / title
  word (`RAILWAY_SEARCH_TAGS`: signal semafor sygnalizator, balise balisa, points switch turnout zwrotnica, axle counter
  licznik osi, buffer stop kozioł, track tor, level crossing przejazd, LEU, RBC, train pociąg); UI text says "points"
  (catalogue label "Points"). ERTMS is the FIRST section of the Shapes tab (`palettes: [ertms, ...shapesTabPalettes()]`,
  `defaultExpanded: ['ertms', 'general']`, stored flags win) with captioned tiles (`captionPalettes: ['ertms']`,
  `.rd-dp-caption`); the optional ERTMS tab stays off by default (the Shapes tab already leads with ERTMS).
- **Railway libraries** (`src/ui/railway-libraries.ts` `RAILWAY_LIBRARIES` / `railwayLibrarySources`, the only hook:
  three entries in the Shapes-tab `palettes` after ERTMS + `captionPalettes`): "ERTMS/ETCS extra" (`etcs-extra`,
  `public/libraries/ertms-extra.xml`: ETCS stop/location marker boards, level transition / RBC border / cab signalling /
  neutral section / pantograph / track condition / release speed boards, fixed + switchable balises, balise groups (2, 3,
  linked), Euroloop, RBC, LEU, axle counter head + evaluator, insulated rail joint, radio infill, GSM-R mast, IXL, OC,
  ETCS trains, MA arrows, EoA, danger point, SvL, overlap), "Polish signalling (PKP PLK)" (`rail-pl`,
  `railway-pl.xml`: semafory 2–5-komorowe, wjazdowy/wyjazdowy/drogowy/odstępowy, powtarzacz, tarcze To/Osp/Tz/Tm,
  Sz, semafory kształtowe, wskaźniki W1/W4/W8/W9/W24/D1 (code boards), przejazdy kat. A–D, rogatka, sygnalizator,
  kozioł, rozjazdy zwyczajne/łukowe, skrzyżowanie, Rkp/Rkpd, krzyżownica, styk, wykolejnice, perony, nastawnia,
  posterunek, hektometr, km) and "Track layout" (`track-layout`, `track-layout.xml`: straight/vertical/diagonal
  tracks, track section, track ends, turnouts 1:9/1:12 x hand x toe side, crossovers single/scissors, diamond, slips,
  platforms, bridge, tunnel, level crossing, km post/hectometre/km ruler, gradient/speed boards, track number). Lazy
  (fetched when a section opens or a search runs). **Generated**: `python3 -I scripts/railway-libraries/build_railway_libraries.py
  public/libraries` (deterministic; never hand-edit the three files; the docstring has the conventions). Plain
  draw.io styles and inline `stencil(...)` shapes (accents `fillColor2`), editable colours, connection points; tags EN +
  PL per entry (`tags` key of the `<mxlibrary>` entries, ignored by draw.io). Typed entries store catalogue
  attributes (`rdKind`, `rdSignalType`, `rdDirection` Right/prawy = nominal, `rdAspects` = lamps, `rdHand` physical
  from the toe, `rdProtection`, `rdFunction`, ...); signals are groups with round filled lamp vertices (states);
  default sizes follow the symbol size standard ([symbol-sizes.md](symbol-sizes.md), `src/railway/symbol-sizes.json`,
  read by both generators; `symbol-sizes.test.ts` fails on an entry that deviates);
  turnouts/crossovers/slips are multi-cell sets (track edges + points legs, topology.ts). On insert
  `prepareRailwayInsert` runs `renumberInsertedObjects` for every non-ERTMS entry (free IDs, `BG1`/`B1` references
  follow); `kindForPaletteEntry` reads the first `rdKind` of a non-ERTMS entry's XML (click placement). **Licensing:
  the symbols are original work of this repository (no proprietary symbol files copied); the Polish/ETCS pictograms
  are conventional schematic depictions, not copies of PKP PLK / ERA drawings.** Tests:
  `src/railway/__tests__/railway-libraries.test.ts`, `tests/e2e/railway-shapes.spec.ts`, dark-shapes thumbnails.
- Palette tile captions (`src/ui/palette-captions.ts`, display only): `PaletteEntry.caption` (default the title) keeps the
  distinguishing part of long titles in the two-line captions of the ERTMS and railway sections ("1:9 R toe L", "Tarcza Tm
  prawa", "3-komorowy prawy"); the title stays the tooltip / search text. The generated track-layout turnouts are
  "Points 1:<n> Left|Right (toe left|right)" and the PKP PLK tarcze "… prawa / lewa" (feminine).
- Editor commands (UX batch 3): double-click on a railway object (`railwayObjectOf`: the cell or its nearest ancestor
  with rdKind; a double-click in a symbol group's gap resolves by `cellAtBackgroundPoint`) opens the in-place ID field
  (`TextEditorController.startIdEditing`) -> `src/railway/rename-id.ts` `renameObjectId` (unique per kind, no spaces /
  commas, ref/refList fields + a route's points text follow, a literal label equal to the old ID follows; one undo step);
  Shift+double-click = `railway-edit-data-request`; plain shapes keep label editing; `.rd-graph-canvas svg` is
  `user-select: none`. Selection colour = `--rd-selection` (handle-colors.ts `SELECTION_COLOR` #0f8bd0 / #29b6f2, round
  sizers with a white rim, same hit bounds). More than `MULTI_SELECTION_BOX_MIN` (10) selected cells: no per-cell handlers,
  one dashed box (`src/ui/multi-selection-box.ts`, installed per tab). Railway drawings opened into an empty tab (template
  Open as new diagram, railML import, Railway Script applied into an empty tab) zoom to the
  fit scale clamped to 150–200 % (`src/ui/railway-zoom.ts`; fit < 75 % = plain fit), new tabs stay 100 %; no separate
  "Zoom to fit symbols" item (View > Fit exists). Edit menu: Duplicate (`duplicateCells`, also Ctrl/Cmd+D and the context
  menu), Select Vertices / Edges / None (Ctrl/Cmd+Shift+I / E / A, `src/ui/arrange-commands.ts`); Arrange: Align ▸, Distribute
  ▸, Group/Ungroup (`groupSelection`), Rotate 90°, Flip H/V, Lock/Unlock (`toggleLock`). Esc closes the More shapes dialog,
  the image upload and the shape designer; F1 does not open over another dialog (`otherDialogOpen`). maxGraph's folding
  defaults are draw.io's data: SVG icons (`installDefaultFoldingImages`, no `expanded.gif` 404); picture graphs (thumbnails,
  scenario view) have folding off.
- Palette click placement (`src/ui/click-insert.ts` `clickInsertPlacement`, palette option `clickPlacement`; drag/drop
  unchanged): snap-kind symbol (signal, balise, axle counter, LEU) + one selected track/track section -> the visible point
  of its line nearest the view centre (snap.ts then snaps + sets track/km); one selected unlocked vertex + a vertex entry
  -> 80 px beside it, centred on that side, moved along the side while taken (down for east/west, right for
  south/north), connected by an edge (draw.io dropAndConnect). Side = draw.io itemClicked's modifiers without its Alt
  (draw.io connects only on Alt+Click; here Alt+Click skips it): plain click east, or south when a shape already lies
  in the band east of the selection (`hasEastNeighbour`), Shift east, Ctrl/Cmd north, Ctrl/Cmd+Shift west (also Enter /
  Space on a tile; `clickDirection`, `placeBeside`). Else the view centre, cascading right/down to a free spot. One
  model update (one undo), new cell selected, no container drop. Not ported: draw.io's Shift+Click shape replace.
- Start card (`src/ui/start-card.ts`, boot/panels.ts): over an empty active tab (Insert ERTMS symbols / Open template… /
  Open file… / Import railML… / Railway Script… / F1); dismissed by any model change making it non-empty, its actions,
  Esc, ×; "Don't show again" = localStorage `rd.startCard.hidden`. A non-modal `openFloatingPanel` (core/modal.ts) while
  shown: role=dialog labelled by its title, Esc only when no modal is open, focus back when it was inside. Hidden while dragging (drops reach the canvas).
  Automated browsers (`navigator.webdriver`) do not get it unless `rd.startCard.force` = '1' (e2e clicks the canvas centre).
- Narrow screens (`src/ui/narrow-screen.ts`): < 900 px -> `body.rd-narrow` (fallback CSS hides both side panels and
  `.panel-resize-handle`) + dismissible banner (`rd.narrowBanner.dismissed`). Start card actions that need the left
  panel (Insert ERTMS symbols, Open template…, Railway Script…) call `ensurePanelShown('left')` (side-panels.ts): opened
  for the session there (`.rd-panel-open-narrow`), stored state untouched.
- Layers panel (`src/ui/layers.ts`) = the model's real layers (root children, listed top-most first, unnamed =
  "Background", `rd-routes` = "Routes"): current layer = `graph.setDefaultParent`; + Layer = `model.add(root, …)`;
  delete = `removeCells([layer], false)`; eye = `model.setVisible`; padlock = `locked=1` on the layer cell. All undoable
  and saved in the .drawio file. The old app-only layers (`rdLayerId` / `__layerId`) are no longer used by the panel
  (still read and written back verbatim by drawio-xml.ts when a model already has real layers). One-time migration
  (`src/services/legacy-layers.ts` `migrateLegacyLayers`, run by `DiagramDocument.load` on the scratch model, so
  for files, cache, links and remote opens): a model with ONE real layer and cells carrying `rdLayerId` gets one draw.io
  layer per old id (`layer-0` = the existing layer, then `layer-<timestamp>` in creation order, named `Layer <n>` like
  the old defaults — the old names/visibility/lock were only ever in memory, never in a file or the cache; the old id
  becomes the layer id when free), top-level cells move in z-order, edges follow a terminal, a layer whose cells were
  all `visible=0` becomes a hidden layer; `rdLayerId` is dropped. Tab modified: `hasUnsavedLoadChanges()` ->
  save status unsaved, cache rewritten on restore, remote binding dirty. Files without `rdLayerId` are untouched.
  Tests: `src/services/__tests__/legacy-layers.test.ts` (fixture `fixtures/legacy/legacy-layers.drawio`).
- Project name: each tab has its own project (`tab.document.getProjectName()`: Save/Export file names,
  `<diagram name>`). Top-bar `.document-title` shows the active tab's (`TabManager.switchTab`; a background tab's
  `setProjectName` does not touch it: SaveLoadController follows `onProjectNameChange` only while its graph is shown). Rename (`ProjectNameEditor(tabManager)`) -> `tabManager.renameActiveProject`:
  the active tab's project, and its tab label too when the label equals the old project name (tabs opened from
  links/remote files are named after it); cached at once. File > Save As… goes through it too. Mirror rule: renaming a
  tab label (double-click, `editTabName`) that equals the tab's project name renames the project as well. Cache: `tabs[].projectName` per tab (top-level
  `projectName` = active tab's; caches of earlier versions without it give it to the active tab).
- Image export: File > Export > PNG Image…/SVG Image… (`data-action="exportPng|exportSvg"`, the commands run the active
  tab's `ExportImageController`) uses `diagram-image-export.ts` like the Share dialog and scenario exports: draw.io
  light colours even in the dark theme (thumbnail renderer option `light` pins the hidden graph with
  `setGraphColorMode`), on the model's `background` (`modelBackground`, white by default). Every VISIBLE layer is
  drawn in model order (`cellsFromModelXml`: children of each layer, groups kept, `visible="0"` layers skipped like
  draw.io, edges into a hidden layer dropped), also `rd-routes` when shown and in the scenario exports. `tab.document.exportAsJson()` (no menu item; .drawio is the
  exchange format) = `{format:'railway-drawer-cells', version:1, name, cells}` read from the saved draw.io XML.
