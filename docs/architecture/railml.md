# railML 3.2

- **UI** (`install-railml.ts`, main chunk, called from `boot/features.ts` after `installRailwayRoutes`): File > Import >
  railML 3.2… (`data-action="importRailml"`), File > Export > railML 3.2… (`exportRailml`) -> their commands emit
  the bus event `railml-request` `{action}`; File > Open (the `open` command, ui/commands/file.ts, accepts `.railml`) and a file
  dropped on `#graph-container` whose root is `<railML>` (`looksLikeRailml`) -> `{action:'open', text, name}`. The
  handler lazy-loads `railml-ui.ts` (dialogs `.rd-railml-dialog` on the `.rd-route-dialog` classes, `railml.css`,
  tokens only; `data-testid` `railml-export-dialog` / `railml-import-dialog`).
- **Export** (`export.ts` `exportRailml(model, {title, date, extension, pretty})`, pure, jsdom): runs `validateModel`
  first (counts in the dialog, never blocks). Topology = one `netElement` per `buildTopology` piece, oriented nominal
  (increasing x / y), so `applicationDirection` normal = our nominal; length in m (track length/km scale, else
  drawing units); ends' km as `linearCoordinate` on `lps01` (m); `netRelation` per piece pair at each node
  (positionOnA/B, navigability from `passage()`: Both/None); `networks/network/level Micro`. Objects located with
  `locateObject` (points: toe piece at the junction) -> `spotLocation` (`intrinsicCoord`, `applicationDirection`,
  km). `infrastructureVisualization` = piece polylines + cell centres. Objects sorted by kind, natural ID (stable
  output). Result: `xml`, `counts`, `unplaced` (no location), `extensionOnly` (LEU, train), `issues`, `preserved`.
- **Mapping** (`mapping.ts` `KIND_MAPPINGS`; prefixes `sig_ bal_ bg_ trk_ sw_ tvd_ tde_ ij_ bus_ lc_ rbc_ rt_`, IL `il_`):
  track -> `track` + `linearLocation`; points -> `switchIS` (ordinarySwitch, branchCourse = hand (toe rule; empty -> `junctionHand`), left/rightBranch
  netRelationRef) + `switchIL`; signal -> `signalIS` (main/shunting: isTrainMovementSignal + signalConstruction light;
  marker board/stop marker: isEtcsSignal + board) + `signalIL@function`; insulatedJoint -> `trainDetectionElement` type insulatedRailJoint (+ demarcation like axle counters); balise -> `balise` (belongsToBaliseGroup,
  isEurobalise positionInGroup = position-1); baliseGroup -> `baliseGroup` (applicationType ETCS, isEurobaliseGroup
  countryID/groupID); axleCounter -> `trainDetectionElement` axleCounter; trackSection -> IL `tvdSection`
  (hasDemarcatingTraindetector; no location in 3.2); bufferStop, levelCrossing (`protection`) -> IS; rbc -> IL
  `radioBlockCentre`; route -> IL `route` (routeEntry/Exit refersTo signalIL, facing/trailingSwitchInPosition
  left/right, hasTvdSection, overlap); conflicting route pairs with their codes and the flank
  protection (interlocking.ts) -> only `rdConflicts` / `rdFlank` on the route's rd extension object (derived: recomputed
  by the export, ignored by the import; no core element, the railML 3.2 IL conflict names are not verified without the
  XSD, [rules.md](rules.md)). **Unmapped**: leu, train (rd extension only). Name + `designator
  register="_RailwayDrawer" entry=<rdId>` on every object.
- **rd extension** (`rd:railwayDrawer` last root child, ns `https://railwaydrawer.mksystemdesign.org/railml/rd/1`,
  option in the dialog): `rd:object kind ref` with the fields railML does not hold (aspects, remarks, km start/end,
  route length, ...), single-cell `style`/`w`/`h`, `netElements` of points legs/section lines, `v_*` value attributes.
- **Import** (`import.ts` `importRailml(text, {symbols})` -> `{modelXml, model, name, warnings, counts, preserved,
  usedVisualization}`; UI: new tab via `createTab` + `tab.document.load`, notes dialog): layout from the
  visualization when every netElement has a projection, else generated (left to right, km/length, diverging branch
  one lane down/up by branchCourse); cells with the ERTMS library entries (`loadErtmsLibraryEntries`: Track, Point
  Right, Signal Right 3/4, Signal Left 3, (Single) Balise Right/Left, TC, Train), simple shapes otherwise; routes
  re-created on `rd-routes` through the drawn topology (undrawn TVD sections -> sections from the drawing, railML list
  kept in `rdRailmlTvdSections`); objects without location in a row below. Imported ids kept in `rdRailmlId`,
  `rdRailmlIlId`, `rdRailmlNetElements` (export reuses them: export -> import -> export is byte-stable).
- **Preserved** (`preserve.ts`): unknown railML (containers by path, children/attributes of mapped objects by owner id
  `<id>` or `<id>/<child>`) in the root cell's data attribute `rdRailml` (draw.io diagram data; saved/cached), written
  back by the export (`applyPreserved`, schema order from `schema-order.ts`).
- **Validation**: `structure.ts` `checkRailmlStructure(doc)` (required attrs/children, enums, NCName unique ids,
  typed references), shown in the export dialog; the XSD is not vendored (railML.org licence: restricted CC BY-NC-ND
  4.0, distribution only via railML.org) -> `scripts/railml/validate.ts` (xmllint, `RAILML_XSD`).
- Tests: `src/railml/__tests__/` (`railml-export.test.ts` spec layout vs `fixtures/spec-layout.expected.railml`,
  directions, unplaced, pure railML, structure checks; `railml-import.test.ts` `station-topology.railml` /
  `station-visualization.railml`, preservation, .drawio round trip of the store, byte-stable round trips;
  `railml-mapping.test.ts` every kind mapped + documented), `tests/e2e/railml.spec.ts`.
