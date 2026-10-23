# Print sheets (drawing sheets with frame, title block, revisions, legend)

`src/print` (feature layer) and `src/print/ui` (ui layer: dialogs, canvas overlay, exports; eslint boundaries).
Guards: `src/print/__tests__/print-sheets.test.ts`, `src/document/__tests__/diagram-pages.test.ts`,
`tests/e2e/print-sheets.spec.ts`, the print dialogs in `tests/e2e/theme-contrast.spec.ts`.

## Pages

A tab shows one drawing page of its file (`DiagramDocument`): the main page (index 0: project name, the feature
sections: scenarios, Railway Script, title block) and the kept pages 2..n (`extraPages`, serialized `<diagram>`).
`showPage(i)` keeps the main page's model XML, writes an edited page back into its slot (unedited pages stay
byte-identical, compressed ones compressed) and loads page i (not undoable, like a load). Save, share and the tab
cache always write every page in file order; a restored tab shows the main page. `addPage` / `renamePage` /
`removePage`; bus event `rd-pages-changed`. Scenario step pages are not drawing pages. View > Pages… / Next Page /
Previous Page. Page links: `listPages()` gives the main page an id before the first save.

## File format (per page, draw.io-compatible)

| What | Where |
|---|---|
| Format + orientation | draw.io's `<mxGraphModel pageWidth pageHeight>` (draw.io px: A4 827 x 1169, A3 1169 x 1654, A2 1654 x 2336, A1 2339 x 3300, A0 3300 x 4681; landscape swapped; other sizes = custom paper from 100 dpi) |
| Fixed scale 1:n | `pageScale="n"` + root attribute `rdSheetScale="fixed"` (missing = fit to the sheet, pageScale 1) |
| Sheet border shown | draw.io's page view `page="1"` (draw.io opens the file in page view too) |
| Margins, filing margin | root cell (id 0) attributes `rdSheetMargins="top right bottom left"` (mm, default 10), `rdSheetFiling` (mm, default 10) |
| Blocks off | `rdSheetFrame` / `rdSheetTitleBlock` / `rdSheetRevisions` / `rdSheetLegend` = `"0"` |
| Page overrides | `rdSheetTitle`, `rdSheetNumber`, `rdDrawingNumber` |
| Title block (document) | main page `<diagram rdTitleBlock="{json}">`: project, title, drawingNumber, scale, designed, checked, approved, date, revision, company, status, logo (PNG/JPEG data URL), lang (`pl` default / `en`) |
| Revisions (document) | main page `<diagram rdRevisions="[{rev,date,description,author,checked}]">` |
| Continuation marker | `<UserObject label="ciąg dalszy na arkuszu 3" link="data:page/id,<diagram id>" rdSheetRef="continuation">`, draw.io's arrow shape |

Page settings change through `DiagramDocument.setPageSettings` (one undoable model edit, like draw.io's
ChangePageSetup); root attributes are model edits in the same transaction. The title block is a project section
(`src/print/project-section.ts`, tab cache key `titleBlock`); share links carry every section's attributes.

## Layout (paper mm, `sheet-geometry.ts`)

Frame at the margins (left margin + filing margin). Title block 180 x 50 mm in the frame's bottom-right corner
(Polish layout: company / logo, Funkcja-Imię i nazwisko for Projektował / Sprawdził / Zatwierdził, Status; Projekt,
Tytuł rysunku, Nr rysunku, Rewizja, Skala, Arkusz x z n, Data; EN labels with `lang: en`). Revision table above it
(header + rows of 5 mm, at least one empty row). Legend (title + 7 rows per 55 mm column) left of the title block on
the frame's bottom edge, or above the revision table when there is no room (A4 portrait). Empty scale = `1:n` or
"bez skali" / "NTS"; empty revision = the last revision row; sheet x = the page's number override or its position,
n = the number of drawing pages.

Drawing: fixed scale prints the page's region (0, 0) - page size x pageScale (draw.io's page at the origin) onto
the paper, clipped to the frame (a marker cell at the origin locates it in the rendered SVG). Fit scales the
drawing's bounds into the larger of the free areas above / beside the blocks.

Legend (`legend.ts`): railway objects by kind (`rdKind`, catalogue labels; signals by `rdSignalType`) and
shapes whose style matches a titled ERTMS library entry (loaded once, `ui/legend-library.ts`); one entry per
symbol in order of appearance, the sample cell rendered as its symbol. Markers are not listed.

## Canvas, exports, print

- View > Show Sheet Border (`sheet-overlay.ts`): the decorations of `sheet-svg.ts` in the graph's background pane
  (paper mm -> drawing units -> view transform), themed through `rd-sheet-*` classes, `pointer-events: none`,
  redrawn on view changes, page / page-setting events and (debounced) model / title-block changes. Not cells.
- Continuation markers (`install-print.ts`): a click (no drag, no Shift / Alt) goes to the target page; labels
  are refreshed when the pages change and resolved again in every export.
- File > Export > Sheets (PDF / SVG / PNG)… (`sheet-export.ts`, lazy): pages to export; PDF = one page per sheet
  in its paper size (jsPDF `unit: mm`, compressed), the composed sheet SVG drawn with svg2pdf.js after HTML labels
  (`<foreignObject>`) became SVG text; DejaVu Sans embedded (`scenarios/pdf-fonts.ts`), so Polish letters print and
  extract (ToUnicode); a sheet svg2pdf cannot draw is embedded as a raster image (200 dpi, capped at 8000 px).
- File > Print…: the composed sheets in `#rd-print-root`; `print-sheets.css` hides the app in `@media print`
  and gives each sheet its paper size through named `@page` rules (`data-paper="A3-landscape"`); the container is
  removed on `afterprint`. No inline script / style elements (CSP).
- Commands: `ui/commands/print.ts` (pageSetup, titleBlock, revisions, exportSheets, toggleSheetBorder, pages,
  nextPage, previousPage, insertSheetRef) and `print` in `file.ts`.
- AI tools (`src/ai/tools.ts`): `set_title_block` (title block fields / sheet format of the shown page) and
  `export_sheets` (PDF download of all pages).
