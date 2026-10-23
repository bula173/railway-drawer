# Scenarios

- Per tab (diagram): `ScenarioSet` (`scenario-model.ts`) held by the tab's document (`tab.document.scenarios`, a project section:
  `scenarios/project-section.ts`); a scenario = id/name/description + ordered steps; a step =
  id/name/description + three parts: `xml`, a snapshot of the tab's whole drawing (`serializeToXml()`, a draw.io
  `<mxGraphModel>`), `uml` (PlantUML source, usually a sequence diagram; '' = none) and `text` (Markdown; '' = none).
  `cleanMultiline` normalizes both: `\n` line ends, tabs -> 4 spaces, XML-invalid control characters dropped, cap
  100 000 chars (attribute normalization would turn literal tabs/CRs into spaces in draw.io).
  Reads return copies; changes notify subscribers. `sanitizeScenarios` cleans untrusted data (cache, files):
  unique ids, names capped (80/200), steps without a model dropped.
- **File format** (`scenario-format.ts`): main page first, with `rdScenarios='{"v":1,"scenarios":[{id,name,description}]}'`
  on its `<diagram>` (order, empty scenarios); then one page per step, `name="<Scenario> / <n>. <step>"`, attributes
  `rdScenarioId rdScenarioName [rdScenarioDescription] rdStepId rdStepName [rdStepDescription] [rdStepUml] [rdStepText]`,
  page id = step id when unique; then the preserved non-scenario `extraPages`. `rdStepUml`/`rdStepText` are only written
  when non-empty; newlines are character references (`&#10;` from Chrome's XMLSerializer, `&#xa;` from `xmlUtils.getXml`),
  which draw.io's save keeps (verified against draw.io v32.4.1 while the embed mode existed). Decision: no extra text cell is added to the step page
  for draw.io viewers (it would change the snapshot); draw.io shows the attributes only in the file. draw.io v32.4.1 keeps unknown `<diagram>` attributes
  (page node kept as `DiagramPage.node` and cloned on save, Pages.js:12 / EditorUi.js:2520; also on "Duplicate page",
  so duplicate step ids are made unique on load) — verified live against draw.io v32.4.1 (former embed spec). Parse:
  pages with `rdStepId`/`rdScenarioId` become steps (compressed pages ok; an unreadable one stays a kept page),
  scenarios in index order, then scenarios only named by step pages; `extraPageNames` (the "only the first page is
  shown" warning) lists only non-step pages. Loading a file replaces the tab's scenarios.
- Cache: `CacheData.tabs[].scenarios` (only when non-empty; restored even if the drawing fails). Steps duplicate the
  model, so adding/updating a step flushes the cache at once and warns when storage is full (plus the usual indicator).
- Share links: `buildShareMxfile` gets `pageAttributes` + `scenarioPages` (after the tab's page, before its kept pages);
  `splitSharedFile` keeps step pages with the page before them (tabs, not pages, count against `MAX_SHARED_PAGES`).
  Remote providers save `getProjectXml()`, so scenarios are included.
- View (`scenario-view.ts` `ScenarioViewer`): a separate disabled Graph (`configureDiagramRendering` from
  `src/ui/diagram-graph-setup.ts`, shared with tab graphs, + stencil autoload) mounted in `#graph-container` while the
  live tab div is only hidden: the live model, selection and undo history are never touched. Banner "<Scenario> — step
  i/n: <step>", Prev/Next, "Replace drawing with this step…" (confirm; `replaceDrawingWithSnapshot` = one undoable
  root change), "Back to editing". `body.rd-scenario-viewing` disables menu bar, toolbar, left panel and properties.
  Closes on tab switch/close and when its steps are deleted; follows renames/updates/reorders.
- **Side panel** of the view (`aside.rd-scn-side`, right of the canvas): UML on top, Markdown below, re-rendered only when
  the step's `uml`/`text` changed (stale async UML results dropped); Prev/Next/keys switch drawing + UML + text together;
  collapse toggle `.rd-scn-side-toggle`, state in localStorage `rd.scenario.sidePanel` (`collapsed`|`open`).
- **One-click step** (scenarios-panel.ts): "+ Add step" captures the drawing at once as "Step n" with its name field focused
  in the row (`scenario-step-name-input`; Enter/blur keeps, Esc keeps "Step n"; double-click a name to rename); the row's ▸
  (`.rd-scn-step-details-toggle`) opens optional description / PlantUML / Markdown (`scenario-step-details`, saved on
  change); hint "Set up the drawing and the object states first…"; "Add with details…" (`.rd-scn-add-step-details`) is the
  dialog flow (e2e specs that fill the dialog use it). The view graph keeps its view on setRoot (`resetViewOnRootChange =
  false`): before, a step of a zoomed / scrolled drawing was shown blank.
- **Step editor** (`step-editor.ts` `openStepEditor`, used by "Add with details…" and Edit…): `.rd-tpl-modal.rd-scn-editor` with
  `template-name`/`template-description` inputs (same as the template dialogs, so old tests/flows work), drawing fieldset
  (add: current drawing captured; edit: radio keep / replace with current drawing), PlantUML textarea `step-uml` + preview
  `.rd-scn-uml-preview`, Markdown textarea `step-text` + preview `.rd-scn-md-preview` (debounced 300 ms), "Server…" row for
  the optional PlantUML server. Enter in a text field or Ctrl/Cmd+Enter saves, Enter in a textarea is a newline, Esc
  cancels; no click-outside cancel. Steps show UML/Text badges in the list.
- **PlantUML** (decision): the app's PlantUML tab (`plantuml-parser.ts` + `*-diagram-renderer.ts`) builds maxGraph cells
  and only knows participants/plain messages/one-line notes, so steps use a new local renderer
  `src/services/plantuml-sequence-svg.ts` (PlantUML text -> SVG string, offline): participants (all 8 kinds, aliases,
  colours, stereotypes), `->` `-->` `->>` `<-` `<->` `->x` `->o` `[->` `->]` `-[#c]>`, self messages, `\n`, autonumber,
  notes (left/right/over, multi-line, hnote/rnote), ref, alt/else/opt/loop/par/break/critical/group (nested),
  activate/deactivate/destroy, `++`/`--`/`return`, `== divider ==`, `...` delays, `|||`, title; unknown lines -> warnings
  shown under the diagram. Text width is estimated (no canvas). All text escaped, colours validated.
  `step-uml.ts` `renderStepUml`: sequence -> local; other diagram types -> PlantUML server only if the user set one
  (`src/services/plantuml-server.ts`, localStorage `rd.plantuml.server`, no default: nothing is ever sent otherwise);
  GET `<server>/svg/<encoded>` (UTF-8 -> deflate-raw via CompressionStream -> PlantUML base64 `0-9A-Za-z-_`),
  credentials omitted, no referrer, 15 s timeout, answers sanitized (`sanitizeSvgMarkup`: no script/foreignObject/on*/
  animations, only `#`/raster data:image hrefs), cached per server+text; errors are shown ("PlantUML server offline — …", HTTP status).
- **Markdown** (`markdown.ts`, in-house, no dependency): headings, paragraphs, hard breaks, emphasis/strong/strike, code
  spans/fences, quotes, nested lists, task items, pipe tables (alignment classes), hr, links (http(s)/mailto/#, always
  `target=_blank rel="noopener noreferrer"`), autolinks, images (https or base64 data:image only). Raw HTML is shown as
  text; output then goes through the allow-list `sanitizeHtml` before insertion/export.
- **One sanitizer** (`src/security/sanitize.ts`, DOMPurify pinned exactly, NOTICE): `sanitizeHtmlLabel` (draw.io HTML
  labels, HTML profile only, safe-CSS `style`, links http(s)/mailto/tel/#/relative, images https/relative/data:image),
  `sanitizeMarkdownFragment` (markdown.ts `sanitizeHtml`, the renderer's tag set + URL rules), `sanitizeSvgMarkup`
  (PlantUML server SVG). Never add another hand-written deny-list; fails closed without a DOM. Tests:
  `src/security/__tests__/sanitize.test.ts` (OWASP/mXSS payloads, every html=1 label of the palettes/libraries unchanged).
- **Export** (`scenario-export.ts`): File > "Export Scenario (HTML)…" (`data-action="exportScenarioHtml"` -> bus event
  `scenario-export-request` -> `install-scenarios.ts`: the scenario shown, else the only one with steps, else a chooser)
  and ⇩ per scenario in the panel. One self-contained HTML file `<diagram> - <scenario>.html`: CSP meta (no scripts),
  per step drawing as `data:image/svg+xml` `<img>` (`renderXmlToSvgDocument` from diagram-image-export),
  UML inline SVG, sanitized Markdown; steps break pages when printed (for the later PDF).
- **Step diff** (`scenario-diff.ts`, pure XML/DOMParser): `diffSnapshots(prev, cur)` matches drawable cells by id: added,
  removed, moved (geometry x/y/parent, size; edges: terminals/points = rerouted) and changed (style keys, label — HTML stripped
  only with `html=1` — and `<object>` data attributes, e.g. `rdAspects` -> "S2: aspects changed"); moved wins over changed for
  the colour. `buildDiffHighlightXml` returns a NEW model XML (snapshots never change): the step plus highlight cells
  (`rdDiff=<kind>` style; outlines green #2e7d32 / blue #1565c0 / orange #ef6c00, red dashed ghost #c62828 with the old name
  at the old absolute place, edges as thick polylines) in an own top layer `rd-diff-layer` (last root child = drawn
  top-most in the view and in the image exports, which draw every visible layer; the old `inFirstLayer` option is gone).
- **View additions** (`scenario-view.ts`, CSS `scenario-doc.css`): banner "Show changes" check box (localStorage
  `rd.scenario.showChanges`) -> the view graph loads the highlight copy, legend `[data-testid=scenario-diff-legend]` over
  the canvas, side-panel section "Changes" (`.rd-scn-side-changes li[data-kind]`, counts), `data-diff-added|removed|moved|changed`
  on the view; first step: "nothing to compare". Autoplay (`scenario-autoplay.ts` `ScenarioAutoplay`): ▶ Play/⏸ Pause
  `.rd-scn-play-btn`, interval select (1/2/3/5/10/20 s, default 3), Loop; settings in localStorage `rd.scenario.autoplay`;
  stops at the last step (Play there restarts from step 1), manual Prev/Next restarts the interval, closing the view pauses.
  Keys: Space = `toggle-play` in `scenarioKeyAction`; keys on focused check boxes/radios/buttons navigate (only text inputs,
  selects, textareas pass).
- **PDF** (`scenario-pdf.ts` + `pdf-layout.ts` + `pdf-fonts.ts`, all dynamic imports from `install-scenarios.ts`): decision —
  jsPDF 4.2.1 + svg2pdf.js 2.8.1 (pinned, lazy chunks; jsPDF's optional html2canvas/purify chunks are emitted but never
  loaded) give a real file without a print dialog; browser print-to-PDF cannot be triggered without the dialog. Title page
  (name, description, diagram, date, step list with page numbers + internal links), per step: "Step i of n", name,
  description, drawing (raster PNG 2x via `renderXmlToSvgDocument` + canvas: maxGraph SVG uses `<foreignObject>` for HTML
  labels, which svg2pdf cannot draw), optional changes legend/list, UML as VECTORS (svg2pdf; fonts mapped to the doc
  families; regular face set first because svg2pdf inherits the current style; raster fallback), Markdown laid out as PDF
  text (headings, paragraphs with bold/italic/code/strike/links as link annotations, nested/ordered/task lists, quotes,
  code blocks, pipe tables with alignment, hr, data: PNG/JPEG images), footer "Page i of n". A4 portrait/landscape. Fonts:
  the standard 14 (Latin-1) unless any text needs more (`needsUnicodeFont`: Polish letters, ...) -> DejaVu Sans/Bold/Mono
  TTFs (npm `dejavu-fonts-ttf`, emitted by Vite as `?url` assets, ~1.8 MB, fetched only then, embedded whole: such PDFs are
  ~1–2 MB); fonts unavailable -> transliteration (`toLatin1`).
- **Slides** (`scenario-slides.ts`): one HTML file "<diagram> - <scenario> (slides).html": title slide + one slide per step
  (drawing as data: SVG img, optional Changes, UML inline SVG, sanitized Markdown). The only script is the constant
  `SLIDES_SCRIPT` (←/→, PageUp/PageDown, Space/Shift+Space, Home/End, F fullscreen, buttons, `#n`), allowed by its SHA-256
  in the CSP (`slidesScriptHash`, sync `sha256` from the GitLab PKCE module: works without crypto.subtle); selectors are
  scoped (`#deck > section.slide`, `nav.controls > [data-rd=…]`) so UML/Markdown content cannot hijack them. No JS: slides
  stacked; print: one per page. PPTX: not implemented (optional; would need pptxgenjs ~0.5 MB).
- Export wiring: File > Export Scenario (PDF)… / (Slides)… (`data-action="exportScenarioPdf|exportScenarioSlides"` -> the same
  `scenario-export-request` event with `detail.format`), panel buttons ⎙ (`.rd-scn-export-pdf`) and ▭
  (`.rd-scn-export-slides`); `exportScenarioDoc(format, id?)` opens `openScenarioDocDialog` (`scenario-doc-export.ts`:
  scenario select when several, A4 portrait/landscape remembered in `rd.scenario.pdfOrientation`, "Highlight changes"
  preset from the view's toggle). Tests inject `docDialog`, `renderDrawingPng`, `pdfDeps`.
- Templates store only cells (no scenarios), so they are unaffected; cache, share links and remote providers serialize
  the step pages/JSON and carry `uml`/`text` automatically.
- Keyboard: the keymap's interceptor (`bootKeyboard`) calls `scenarios.handleKeydown(e)` right after Ctrl+S; only while the
  view is open: ←/PageUp, →/PageDown, Home/End, Esc, Space (autoplay); editing shortcuts are prevented, every other key is stopped
  (`scenario-keys.ts` `scenarioKeyAction`); fields/IME and Ctrl+S pass.
- Panel (`scenarios-panel.ts`, `#scenarios-panel`): "+ New scenario", per scenario "▶ Present" (`.rd-scn-play`) + "⋯"
  (`.rd-scn-more`, role=menu `.rd-scn-menu`, position fixed, Esc/↑/↓): Edit… / Duplicate / Export HTML / Export PDF /
  Export Slides / Delete… (items keep the classes `.rd-scn-edit`, `-duplicate`, `-export`, `-export-pdf`,
  `-export-slides`, `-delete`), expandable step list (lazy 64x40 thumbnails from the palette's shared renderer; per step
  "⋯": Edit… / Update from drawing (confirm) / Duplicate / Move up / Move down / Delete…, classes `.rd-scn-step-*`;
  drag to reorder), "+ Add step"; names ellipsize with a title tooltip; targets >= 24 px. E2E opens "⋯" first. Dialogs = `promptTemplateDetails`/`confirmTemplateDialog`. Wiring:
  `install-scenarios.ts`. File > New opens a new tab (the current tab and its scenarios stay).
- Tests: `src/scenarios/__tests__/` (model, format/round trip/draw.io edits/share split, tabs + cache + view + keys +
  panel; `scenario-uml-text-format.test.ts` multi-line UML/Markdown round trips incl. a draw.io-style re-save, cache,
  share; `markdown.test.ts` rendering + XSS payloads; `scenario-uml-text-view.test.ts` editor/previews, side panel
  Prev/Next, collapse, edit keep/replace, HTML export), `src/__tests__/services/plantuml-scenario.test.ts` (sequence
  parser/SVG, encoding vs PlantUML's documented example, mocked server, no request without a server),
  `tests/e2e/scenarios.spec.ts` and `tests/e2e/scenario-uml-text.spec.ts` (any port). Scenario documents:
  `scenario-diff.test.ts` (kinds, data keys, edges, nesting, highlight XML in own top layer, drawn last by `cellsFromModelXml`), `scenario-pdf.test.ts` (real
  jsPDF in jsdom, streams inflated with node:zlib: pages, page numbers, Markdown text, link annotations, landscape, changes,
  real DejaVu files vs. transliteration, svg2pdf vs. raster fallback), `scenario-slides.test.ts` (structure, escaping, CSP
  hash = node:crypto SHA-256, navigation script run in jsdom), `scenario-doc-view.test.ts` (Show changes in the view graph,
  autoplay with fake timers, Space, exports through `installScenarios`, options dialog), `tests/e2e/scenario-doc.spec.ts`.
