# Boot

- `index.html` is the static shell of the editor (`#app-container`: top bar, menus, toolbar,
  panels, `#graph-container`, `#tabs-container`). Controllers bind to these ids.
- `src/main.ts`: sign-in answer pages (GitLab / Entra redirect) only run their auth bridge; otherwise it drops the
  remembered mode of the removed editor switch (`clearRetiredEditorMode()`, `src/services/retired-drawio-mode.ts`)
  and dynamically imports `main-editor.ts` (so auth-bridge loads never download maxGraph). `?editor=` is ignored.
- The removed draw.io view had its own autosave (`railway-drawer-drawio-doc`, `{xml,title,savedAt}`):
  `install-sharing.ts` opens it once as new tabs after the `#R` link handling (`openDiagramFile` in
  `share/share-open.ts`, blank pages skipped), then removes the key.
- `src/main-editor.ts` is the documented boot order (no other logic) calling the composition functions of `src/boot/`
  (no module there has top-level side effects): `bootShell` (`registerDrawioCodecs()` first, before any file or cache
  load; stencil engine, page-wide maxGraph patches, shapes, the commands, Help, side panels, toolbar, menu bar),
  `bootTabs` (theme, `TabManager` with its session views, cache restore or a first tab, project name editor, status bar
  version), `bootRailwayFeatures` (scenarios, railway data / routes / states, railML), `bootKeyboard` (the one keymap on
  the active tab, the scenario view's keys first), `bootLifecycle` (`beforeunload` flushes the cache; the tabs are
  destroyed on `pagehide`, not persisted, because beforeunload can be cancelled: unsaved remote changes prompt),
  `bootCanvasDrop`, `bootLeftPanel` (left panel tabs, Railway Script, AI, the AppContext), `bootShapesTab` (shape toolbar
  + draw.io palettes, ERTMS tab), `bootNarrowScreen`, `bootStartCard`, `bootTemplates`, `bootSharing` (+ Access identity),
  `bootCustomShapes` (shape designer). Keep that order (listeners and CSS cascade follow it).
- Rarely used features are separate chunks loaded with `import()` on first use: the shape designer
  (`ui/shape-designer.ts`, opened from Extras > Design Custom Shapes… = `open-shape-designer` / `edit-custom-shape`), the
  route tables dialog (`railway/route-tables-dialog.ts`), the XLSX writer (`railway/xlsx.ts`), scenario PDF/slides
  export (`jspdf`, `svg2pdf.js`), GitLab/SharePoint loaders, the draw.io palette JSON, railML import/export
  (`railml/railml-ui.ts` with export/import/structure) and the local PlantUML sequence renderer
  (`services/plantuml-sequence-svg.ts`, imported by `scenarios/step-uml.ts` on the first rendering). Keep new heavy,
  user-triggered UI lazy the same way. Build chunks (vite.config.ts `manualChunks`): `maxgraph` (@maxgraph/core,
  ~542 kB), `drawio-shapes` (`src/drawio-shapes/js`, ~228 kB, self-contained: only maxGraph imports, so no chunk cycle;
  preloaded in parallel with `main-editor`, ~780 kB, was ~941 kB); `chunkSizeWarningLimit` 800 (reason in the config).
- Dead code: modules not reachable from `src/main.ts` (and not test-only helpers) are deleted, not kept "for later";
  the old hand-written shape classes (`src/shapes/{uml,bpmn,cloud,...}`), `src/store`, `src/contexts`,
  `src/types`, the color picker/palette controllers etc. were removed in the cleanup.
  The Pencil/Brush/Eraser/Line freehand tools (`src/ui/drawing.ts`, a raster canvas overlay whose strokes were never
  saved, undone or exported) and their toolbar buttons were removed too; draw shapes/lines with the palette or toolbar.
