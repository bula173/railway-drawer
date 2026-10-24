# Railway engineering tools

- **Topology** (`topology.ts` `buildTopology(objects)`, model only): links = cells of kind track/trackSection/points
  with a centre line (edges, or vertices whose long side >= 3x the short side, >= `MIN_LINK_LENGTH` 15; a 10x12 TC marker
  is no link). A points edge (ERTMS "Point Left/Right") is the diverging leg; a compact points vertex is a junction node.
  A section lying on a track (ends + middle within `JOIN_TOLERANCE` 8) is not a link but names the track pieces it covers.
  Links are cut where another link's end, a points vertex or a covering section's end touches them; ends within 8 are
  one node (edges with vertex terminals end at the vertex centre). Node with 3 pieces + a points leg (or at a points
  vertex) = points junction: reverse = leg (vertex: piece outside the straightest pair), toe = straight piece most
  opposite to reverse. **Points hand convention** (user-confirmed): read from the TOE: standing at the toe (blade tips)
  looking towards the frog, the diverging leg to the left = left-hand (screen: toe left + leg up = left, toe left + leg
  down = right, toe right + leg down = left). ONE helper `src/railway/hand.ts` (`handFromGeometry(toe, leg)`,
  `handOfLeg` for a leg between two horizontal tracks: rising to the right = left, `legSide` for layouts,
  `handOfLegCell`) used by `junctionHand(topo, node)` (railML export when the hand is empty), railML import layout,
  Railway Script layout, ERTMS palette inserts; the generators mirror it as `hand_from_geometry` (both scripts);
  tests: `hand.test.ts`, `railml-hand.test.ts`, library data tests (stored rdHand = geometry). `passage()`: turns over 90° impossible; toe<->normal needs normal, toe<->reverse reverse,
  normal<->reverse impossible. **Direction convention** (confirmed project convention, not an assumption): nominal =
  left to right, i.e. increasing x (vertical pieces: increasing y), like the ERTMS "Signal Right" symbol; reverse =
  the opposite. `locate()` puts objects on the nearest piece within 40, preferring their `rdTrackId`.
- **Routes** (`routes.ts`): `findRoutePaths(topo, entry, exit)` = DFS from the entry signal in its direction (none =
  both), each piece once, stops at the next signal facing the same way, ends when passing the exit signal in its
  direction; returns all paths (shortest first, max 8, deduplicated) with points + required positions, sections in
  order (`blockOf`: section, else track; points legs skipped), overlap (first section beyond the exit signal, normal
  preferred), length (metres from the link's `rdLength` or km span; drawing units where unknown -> `approximate`).
  Route kind fields: entry/exit signal, `points` (text `W1:normal, W2:reverse`; `parsePointsList` also takes N/R/+/-),
  `sections`, `overlap` (refLists), `length` [m]. `detectConflicts` = pairs sharing a section (path or overlap) or
  needing opposite points positions; `buildRouteTable` / `buildConflictTable` -> report.ts `Table`s.
- **Route objects** (`route-store.ts`): an edge per route on its own layer `rd-routes` ("Routes", a root child, saved as a
  draw.io layer), translucent orange, label `%rdId%`, `movable/bendable/editable=0`; `addRoute` = one undo step (layer
  if missing + edge + the ID appended to the entry signal's `rdRoutes`). Railway > Show Routes toggles the layer's
  `visible` directly (view state, saved with the file, not undoable). Railway > Update Route Paths recomputes
  geometry/length from the drawing (path with the stored sections). Route edges are selectable -> Data panel edits them.
- **Route tool** (`route-tool.ts` `RouteTool`): toolbar `#btn-route-tool` / Railway > Route Tool; while active a
  capture-phase listener on `#graph-container` swallows pointer events (no selection/moves), hit test `signalAt`
  (bounds + 6, else nearest centre within 25). After the start signal: the signals with a path in its direction are
  outlined (`.rd-route-hl-target`), the others dimmed (`.rd-route-dim`), the status names them or says "no route in the
  signal direction" (`.rd-route-none`); Esc cancels the start signal, a second Esc leaves. Floating panel `.rd-route-tool` (`openFloatingPanel`, core/modal.ts: role=dialog "Route tool", Esc only while no modal is open, focus return; status, path radios
  `.rd-route-path`, ID input prefilled `R<n>`, "Create route"), highlight in `graph-overlay.ts` `GraphOverlay` (SVG
  group in the view's overlay pane, transform = scale/translate, not in the model). Esc/✕ leaves; tab switch leaves.
- **Tables** (`route-tables-dialog.ts`): Railway > Route Table… / Interlocking Table… / Conflict Matrix… -> `.rd-route-dialog`
  with tabs Route table / Interlocking table / Conflicts (matrix + pairs), Export CSV (shown tab) and XLSX (PKP sheets
  "Tablica zależności", "Macierz konfliktów" + routes + pairs; "English headers"). Interlocking model (flank protection,
  conflict codes S/O/P/F/D): [rules.md](rules.md).
- **Checks** (`route-checks.ts`, run from `validateObjects`): `route-endpoint` (no entry/exit, same signal, endpoint
  of another kind; the generic missing-reference skips such IDs), `route-path` (no path in the signal direction, or
  sections not a continuous path), `route-points` (syntax, unknown/contradictory points, missing or wrong required
  position; warning: listed points not on the path). Conflicts are not issues (interlocking table).
  The configurable engineering rules (balise group / detection distances, overlap, signal side and spacing, ...) and
  Railway > Rule Settings…: [rules.md](rules.md).
- **Snap to track** (`snap.ts`): signals, balises, axle counters, LEUs inserted or moved so that the gap between the
  shape and a track/section line (centre distance minus the half extent across the line) is at most `SNAP_RADIUS_PX`
  15 screen px (`snapGapAtScale`: 15 / zoom graph units) and the nearest line point is not beyond a track end (the snap
  only moves perpendicular to the track) are put on it (balise/axle counter centred; signal on the right-hand side of its travel direction:
  nominal = below a left-to-right track, reverse above; LEU nominal side; gap `SNAP_GAP` 4), get `rdTrackId` (track
  preferred over a section drawn on it) and, when the track has km start/end, `rdKm`. Runs in the model's
  `BEFORE_UNDO` (like maxGraph's LayoutManager), so it is part of the same undo step; ignores edits with a RootChange
  (loads, snapshots). Off while Alt is held (window capture listeners track `altKey`), data-only for arrow-key nudges
  (`withSnapDataOnly`). While dragging (SelectionHandler), the track a drop would snap onto is outlined (`CellHighlight`
  `#00a8ff`, class `rd-track-snap-highlight`, graph div `data-rd-track-snap=<track id>`; `previewSnap`). Railway > Snap
  to Track, localStorage `rd.railway.snapToTrack` (default on). Installed on every tab graph (`installRailwayRoutes`
  sweeps on start/`tab-changed`). `SNAP_DISTANCE` 40 is only the "belongs to the track" distance (Railway Script sync).
- **km** (`km.ts`): linear from km start (first point of the centre line) to km end; Railway > Recalculate km sets `rdKm`
  of objects naming a track with km start/end (within 60, rounded to metres, one undo step). Railway > km Ruler (toolbar `#btn-km-ruler`)
  (localStorage `rd.railway.kmRuler`): ticks/labels (`12+345`) along the selected track(s) in an overlay; round step so
  ticks are >= 40 units apart, every 5th step and the ends labelled.
- **Train run** (Railway > Train Run…, `railwayRoute:trainRun`, handled by `train-run/install-train-run.ts`): animated run
  over a route chain, see [train-run.md](train-run.md).
- Wiring (`install-railway-routes.ts`, one call in `boot/features.ts`): menu items `data-action="railwayRoute:<cmd>"`
  (tool, routeTable, conflictTable, conflictMatrix, ruleSettings, updateRoutes, recalcKm, toggleSnap, toggleRoutes, toggleKmRuler) -> the `railwayRoute:` command
  emits the bus event `railway-route-request` (also the toolbar route tool / km ruler buttons); `aria-checked` kept in sync.
- Tests: `src/railway/__tests__/routes.test.ts` (topology incl. sections/vertex points, path search over points and
  signal directions, route tool, route object draw.io round trip + undo, conflicts/tables, route checks, snapping math +
  undoable snap, km interpolation/recalc/ruler), `tests/e2e/ertms-routes.spec.ts`.
