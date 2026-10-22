# railML 3.2 import and export

Railway Drawer reads and writes [railML](https://www.railml.org) **3.2** files (`src/railml/`).

- **File > Export > railML 3.2…** writes the active tab. The railway checks run first; a dialog shows
  what will be written, the check results, objects that could not be placed on the topology and
  objects without a railML element. It never blocks the export. Option: include the Railway Drawer
  extension (`rd:`, default on) for a lossless re-import; off = pure railML 3.2.
- **File > Import > railML 3.2…**, **File > Open** of a `.railml`/`.xml` whose root is `<railML>`, and a
  railML file **dropped on the canvas** open the file in a **new tab**. Notes (unplaced objects,
  preserved content, generated layout, ...) are listed in a dialog.

The modules are pure DOM (`DOMParser`/`XMLSerializer`) and maxGraph model code, unit-tested in jsdom.
The UI (`railml-ui.ts`) and both converters are a lazy chunk loaded on the first railML action;
the main bundle only carries `install-railml.ts` and the root sniffing (`xml.ts`).

| File | Role |
|---|---|
| `src/railml/xml.ts` | namespaces, NCName ids, DOM helpers, pretty printer, `looksLikeRailml` |
| `src/railml/mapping.ts` | kind -> railML mapping table (`KIND_MAPPINGS`), enumerations |
| `src/railml/schema-order.ts` | child order of the railML 3.2 elements written (XSD sequences) |
| `src/railml/export.ts` | `exportRailml(model, options)` |
| `src/railml/import.ts` | `importRailml(text, { symbols })` -> draw.io model |
| `src/railml/preserve.ts` | unknown railML kept on the diagram (`rdRailml`) and written back |
| `src/railml/structure.ts` | structural checks (`checkRailmlStructure`) |
| `src/railml/install-railml.ts`, `railml-ui.ts`, `railml.css` | menu wiring, dialogs |
| `scripts/railml/validate.ts` | optional XSD validation with `xmllint` (dev only) |

## Document structure written

```
<railML xmlns="https://www.railml.org/schemas/3.2" xmlns:dc xmlns:gml xmlns:xsi [xmlns:rd] version="3.2">
  <metadata>        dc:title (project name), dc:creator, dc:date
  <common id="co01"><positioning><linearPositioningSystems>
      <linearPositioningSystem id="lps01" units="m" startMeasure endMeasure linearReferencingMethod="absolute">  (km, in metres)
  <infrastructure id="is01">
    <topology>
      <netElements>  one <netElement> per topology piece (length in m, associatedPositioningSystem with
                     intrinsicCoordinate 0/1 and their km as linearCoordinate on lps01)
      <netRelations> every pair of pieces at a node: positionOnA/B, navigability Both/None
      <networks><network><level descriptionLevel="Micro"> networkResource per netElement/netRelation
    <functionalInfrastructure>  balises, baliseGroups, bufferStops, levelCrossingsIS, signalsIS, switchesIS,
                                tracks, trainDetectionElements (schema order)
  <interlocking>
    <assetsForInterlockings><assetsForInterlocking id="ail01">
      tvdSections, switchesIL, signalsIL, routes, overlaps
    <radioBlockCentres>
  <visualizations><infrastructureVisualizations><infrastructureVisualization id="vis01">
      linearElementProjection per netElement (and per track section drawn as a line),
      spotElementProjection per located object: screen coordinates of the drawing (units, y down)
  <rd:railwayDrawer version="1">   optional extension, last child of the root
```

## Mapping of the catalogue kinds

| Kind (`rdKind`) | railML 3.2 | Fields in railML | rd extension |
|---|---|---|---|
| track | `functionalInfrastructure/tracks/track` (`type="mainTrack"`), `linearLocation` over its netElements (`associatedNetElement` with `sequence`, `intrinsicCoordBegin/End`, `keepsOrientation`) | id (designator), name | kmStart, kmEnd, length, remarks (km also as netElement linearCoordinates) |
| points | `switchIS` `type="ordinarySwitch"`, `branchCourse` = hand, `continueCourse` = the other side, `leftBranch`/`rightBranch` `netRelationRef`, `spotLocation` on the toe netElement at the junction; plus `switchIL` (`refersTo`, `branchLeft`/`branchRight` = tracks) | id, hand (from the geometry when empty), km | position, remarks, the leg's netElements |
| signal | `signalIS` with `spotLocation` (`applicationDirection`); main/shunting: `isTrainMovementSignal` + `signalConstruction type="light"`, `isSwitchable="true"`; marker board / ETCS stop marker: `isEtcsSignal` + `signalConstruction type="board"`; plus `signalIL` (`refersTo`, `function` main/shunting) | id, type (stop marker: rd), direction, km, routes (derived) | aspects, remarks, signalType=etcsStopMarker |
| balise | `balise` `belongsToBaliseGroup`, `isEurobalise positionInGroup` = position - 1 | id, group, position, direction, km | remarks |
| baliseGroup | `baliseGroup` `numberOfBalisesInGroup`, `applicationType value="ETCS"`, `isEurobaliseGroup countryID` (NID_C) `groupID` (NID_BG) | id, NID_C + NID_BG (both needed; a group without NID_C exports the diagram's default `rdCountryId`, 510 when not set), count, direction, km | function, LEU, remarks |
| axleCounter | `trainDetectionElement type="axleCounter" detectedObject="axle"` | id, km, sections (via `tvdSection/hasDemarcatingTraindetector`) | remarks |
| trackSection | interlocking `tvdSection` (`technology` trackCircuit/axleCounter); railML 3.2 gives TVD sections no location: geometry only as a visualization projection | id, detection type | track, length, km start/end, remarks, the section line's netElements |
| bufferStop | `bufferStop` with `spotLocation` | id, km | remarks |
| levelCrossing | `levelCrossingIS`, `protection` (full barriers = `barriers="singleFullBarrier"`, half = `singleHalfBarrier` (import also `doubleHalfBarrier`), lights only = `barriers="none" lights="flashing"`, passive = `hasActiveProtection="false"`) | id, protection, km | remarks |
| rbc | interlocking `radioBlockCentres/radioBlockCentre` | id | NID_C, NID_RBC (no confirmed 3.2 attribute), remarks |
| route | interlocking `route`: `routeEntry`/`routeExit` `refersTo` signalIL, `facingSwitchInPosition`/`trailingSwitchInPosition` (`inPosition` left/right from the points hand, facing/trailing from the path), `hasTvdSection`, `routeExit/hasOverlap` -> `overlap` (`activeForApproachRoute`, `hasTvdSection`) | id, entry, exit, points, sections/overlap when they are TVD sections | length, sections/overlap naming tracks |
| leu | **not mapped** (railML 3.2 has no LEU; `linesideElectronicUnitsIL` is 3.3) | — | everything + position |
| train | **not mapped** (not infrastructure) | — | everything + position |

Every object also gets `<name name="<rdId>" language="en"/>` and
`<designator register="_RailwayDrawer" entry="<rdId>"/>`. Not in the catalogue, so not written:
borders, platforms, stations/operational points, speed sections, electrification, ... (an imported
file keeps them, see "Preserved content").

**Direction convention**: nominal = left to right (increasing x; vertical: increasing y), the
project's convention (CLAUDE.md "Railway engineering tools"). Every netElement is oriented in the
nominal direction, so `applicationDirection="normal"` (intrinsic 0 -> 1) is our *nominal* and
`"reverse"` our *reverse*; objects without a direction get `"both"` (signals, balises, groups) or none.

**Ids**: railML ids are NCNames, unique per document: `<prefix><rdId>` (`sig_S1`, `bal_B1`, `bg_BG1`,
`trk_T1`, `sw_W1`, `tvd_TS1`, `tde_AC1`, `bus_`, `lc_`, `rbc_`, `rt_R1`; IL objects `il_<id>`;
netElements `ne_<link>_<n>` along the link; netRelations `nr_<A>_<B>`), duplicates get `_2`, ...
Our rdId stays the designator. Imported objects keep their railML ids in the cell attributes
`rdRailmlId`, `rdRailmlIlId` and `rdRailmlNetElements`, so export -> import -> export is stable and
references of preserved content stay valid.

**Lengths and km**: netElement `length` in metres from the track's `rdLength` or km span (drawing
units where neither is set, like the route lengths). km = `linearCoordinate@measure` / 1000 on `lps01`;
on import measures of positioning systems in `m` or `km` are used.

## rd extension (`xmlns:rd="https://railwaydrawer.mksystemdesign.org/railml/rd/1"`)

`<rd:railwayDrawer version="1">` holds one `<rd:object kind="..." ref="<railML id>" .../>` per object
with: the catalogue fields railML does not hold (as their `rd*` attribute names; `""` = explicitly
empty, e.g. a track reference the location would otherwise give), `style` and `w`/`h` of single-cell
shapes (library groups are re-created from the ERTMS library), `x`/`y` for objects without railML
element, `netElements` (points legs, section lines), and `v_<name>` for other value attributes
(labels with `%rdId%`, ...). Objects without railML element have no `ref`. With the extension the
import restores the drawing exactly; without it, everything is derived from railML.

Not confirmed: whether the railML 3.2 XSD accepts a foreign-namespace element as the last child of
`<railML>`. If a validator rejects it, export with the extension switched off.

## Import

- **Layout**: when every netElement has a `linearElementProjection` the projections are used
  (spot projections = object centres). Otherwise a schematic layout is generated: netElements left
  to right (intrinsic 0 -> 1), lengths from the km of their ends, else `length`, else 100 m; the
  diverging branch of each switch goes one lane down (right-hand branch of a switch facing the
  nominal direction) or up; objects at their `intrinsicCoord`, signals beside the track like the
  snap tool does (right-hand side of their direction). Disconnected parts are stacked.
- **Shapes**: the same ERTMS library entries the palette inserts (Track, Point Right, Signal
  Right 3 / Right 4 / Left 3, Single Balise Right / Balise Left, TC, Train) with their styles;
  simple draw.io shapes for axle counters, buffer stops, level crossings, RBCs, LEUs, balise groups
  (dashed frame around their balises). Without the library (offline): simple shapes.
- **Points**: the diverging netElement is drawn as the points leg when no track contains it;
  otherwise a short leg (generated layout: the diagonal; drawn layouts: 40 units) is split off it.
- **Routes** are re-created on the Routes layer with their path through the drawn topology. railML
  TVD sections have no location: when a route's TVD sections are not drawn, its sections are taken
  from the drawing and the railML TVD list is kept (`rdRailmlTvdSections`) and written back.
- **Objects without location** (e.g. TVD sections, RBCs) go to a row below the drawing.

## Preserved content

Everything the importer does not map is kept in a store on the diagram's root cell (draw.io data
attribute `rdRailml`, saved in .drawio files, the cache and share links) and written back on export:
unknown containers and elements by their parent path (`operationalPoints`, `timetable`, `rollingstock`,
other train detection elements, extra `dc:*` metadata, ...), unknown children and attributes of mapped
objects by the object's railML id (e.g. `isSpeedSignal`, foreign `designator`s, `track@type`,
`switchIL@preferredPosition`), and of the single children the export writes (`leftBranch@branchingSpeed`,
`routeExit/hasDangerPoint`, ...). Regenerated, not preserved: the topology's own extra content
(`netElement` children other than the positioning, `netRelation` names), other positioning systems
(their measures are converted to lps01). Projections of the first visualization that refer to
preserved elements are kept; further visualizations are kept whole.
Preserved items whose object was deleted are dropped (the export dialog says how many).

## Validation and the XSD licence

There is no XSD validator in the browser. `checkRailmlStructure` checks what we write: required
elements/attributes, enumerations, unique NCName ids and that references resolve (to the right
element type). The export dialog shows its findings.

`scripts/railml/validate.ts` (dev only) validates files with `xmllint --schema` against the official
XSD if you have it locally:

```bash
RAILML_XSD=/path/to/railml3.2/schema/railml3.xsd node scripts/railml/validate.ts out.railml
node scripts/railml/validate.ts --xsd /path/to/railml3.xsd src/railml/__tests__/fixtures/*.railml
```

**Licence (checked 2026-10)**: the railML 3 schemas are licensed under a restricted Creative Commons
Attribution-NonCommercial-NoDerivatives 4.0 licence (or a commercial licence); the railML licence
terms say the schemas may only be distributed through railML.org, downloading requires registration
and accepting the terms, and productive/commercial use of a railML interface requires certification
by railML.org; software describing its railML support must mention railML.org
([licence](https://www.railml.org/en/licence), [schemas](https://www.railml.org/en/schemas)).
So the XSD is **not vendored** in this repository; download it yourself from railml.org. The railML
3 wiki (element names used here) is under the "railML adapted CC-BY-NC-ND-4.0" licence; this code
contains no copied wiki text. railML® is a registered trademark of railML.org e.V.

## Limits

- Element names follow the railML 3 wiki (wiki3.railml.org) schema exports; the generated files have
  not been validated against the XSD here (not vendored). Points of uncertainty: the order of the
  root children (the wiki lists them alphabetically; `metadata` first is used), whether tIDs must be
  UUIDs for IL elements (the wiki says "xs:ID or UUID" for IS and "UUID pattern" for some IL pages;
  NCNames are written), and the `rd:` extension placement.
- Only ordinary switches; crossings, double slips, derailers, borders, platforms, speeds are not
  modelled (kept when imported).
- One linear positioning system; km assumed in metres along the drawing's tracks.
- Signals' `positionAtTrack` is always `right` (our convention); on import the side follows the
  direction, not the attribute.
- `facingSwitchInPosition` vs `trailingSwitchInPosition` comes from the route's path in the drawing.
- railML 3.2 TVD sections have no location: without the extension a section's line is lost unless a
  visualization projection refers to it.
