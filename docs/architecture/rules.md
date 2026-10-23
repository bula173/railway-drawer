# Rule checks and the interlocking table

## Configurable rule checks (`src/railway/rule-checks.ts`)

- **Run** from `validateModelReport` / `validateModel` (validation.ts) after the data and route rules, so they
  appear in the Checks panel (live checks, badge, issue click selects, "Edit" opens the Data panel), in
  `check_drawing` (AI) and in the railML export dialog counts. Each finding names the threshold; objects it is
  about besides the selected one are `Issue.related` (Checks panel: extra link buttons `.rd-rw-issue-rel`).
- **Notes** (`RuleNote`, Checks panel list `.rd-rw-notes`, "Info", not counted in the badge): a rule that cannot
  measure (no metres) skips the object and says so; a rule whose input the drawing does not model at all (no balise
  groups / no detection) says so once.
- **Distances**: along the drawn topology (`topology.ts`) in metres from the tracks' `length` or km start/end
  (`metresPerUnit` of the pieces). Where a walked stretch has no scale, the km of both objects is used when they
  name the same track; otherwise the object is skipped with a note. Walks follow every branch (points in both
  positions, no turns over 90°) and stop at the next signal of the same direction (or a track end).
- **Main signal** = signal type `main` or no type. Rules looking along the track need the signal's direction.

| Rule id | Label (EN / PL) | Default | Thresholds (default) | What it checks |
|---|---|---|---|---|
| `bg-signal-distance` | Balise group in front of a signal / Grupa balis przed semaforem | warning | min 0 m, max 50 m | The nearest balise group (group object or one of its balises) on the approach of every main signal, up to the previous signal of that direction, lies min..max in rear of it; none = finding. |
| `balise-order` | Balise order within a group / Kolejność balis w grupie | error | — | Balises of a group lie in position order 1..n in the group direction (group `direction`, else the common direction of its balises; nominal = increasing x / along the track). |
| `overlap-length` | Minimum overlap length / Minimalna długość zakładki | warning | min 50 m | From the exit signal to the end of the stored overlap sections (interlocking.ts `walkOverlap`). |
| `overlap-required` | Route without overlap / Przebieg bez zakładki | warning | — | A route ending at a main signal has an overlap. |
| `detection-at-signal` | Detection point at a signal / Punkt detekcji przy semaforze | warning | min (clearance) 0 m, max 20 m | The first axle counter / insulated joint beyond every main signal (before the next signal) lies min..max beyond it. Only when the drawing has detection points. |
| `signal-side` | Signal on the correct side / Semafor po właściwej stronie | warning, **off by default** | side right | The signal's centre lies on that side of the track for its direction of travel (snap-to-track places nominal signals below a left-to-right track = right). |
| `signal-spacing` | Spacing of main signals / Odstęp semaforów | warning | min 200 m | Consecutive main signals of one direction (other signal types between are passed) are at least min apart (minimum block length). |
| `detection-between-signals` | Train detection between signals / Kontrola niezajętości między semaforami | warning | — | Between consecutive signals of one direction there is a track section (a piece covered by a TVD) or a detection point. Only when the drawing models detection. |
| `signal-direction` | Signal direction of routes / Kierunek semaforów przebiegów | warning | — | Entry and exit signals of routes have a direction (a wrong direction already gives `route-path`). |
| `points-detection` | Points without detection / Zwrotnica bez kontroli niezajętości | warning | — | One of the points' legs (toe/normal/reverse pieces) lies in a track section, or a detection point lies on a leg. Only when the drawing models detection. |

The defaults are placeholders, not PKP PLK (or any other) norms: set the project's values per diagram. The
dialog says so too. A rule can be off by default (`RuleDef.enabledByDefault: false`; the stored JSON then holds
`"enabled":true` when a diagram turns it on).

### Default calibration (built-in drawings, 2026-10-24)

Findings per rule with the defaults on the 19 templates of `public/libraries/ertms.xml` (ertms-extra, railway-pl
and track-layout have no templates) and the 3 Railway Script examples (`SCRIPT_TEMPLATES`), counted by a throw-away vitest run (findings / notes):

| Rule | ERTMS templates (19) | Script examples (3) | Kind of finding |
|---|---|---|---|
| `signal-side` | 56 in 13 templates (all "left of the track") | 0 | drawing convention |
| `bg-signal-distance` | 18 in 10 templates; 19 skip notes | 0; 2 notes "no balise groups" | no group at all (not the threshold) |
| `detection-at-signal` | 19 in 18 templates; 19 skip notes | 0; 2 notes "no detection points" | no detection point beyond the signal (not the threshold) |
| `overlap-length` | 0 | 2 (etcs-l2-block: 20 m < 50 m) | derived overlap, see below |
| `signal-spacing` | 0; 18 skip notes | 0 | — |
| others | 0 | 0; notes "no detection" (simple-line, station-two-points) | — |

- The templates have no km or track lengths, so every metre threshold is skipped there (notes): the thresholds
  could only be judged on the scaled script examples, where they give 2 findings.
- **`signal-side` is off by default**: the ERTMS templates (like most ERTMS/UNISIG figures) draw the signals of a
  left-to-right track above it, snap to track places them below; a schematic's side is a drawing convention, not
  evidence of the physical side. Turn it on for projects that draw signals on their physical side.
- `overlap-length` 50 m is kept: in `etcs-l2-block` the marker boards stand 20 m before the next axle counter and
  the derived overlap (routes.ts `overlapAfter`: the first section beyond the exit signal) is the rest of the
  route's own last section, 20 m. That is the derivation, not the threshold (store the overlap section on the
  route, e.g. `overlap: TS3`).
- Missing balise groups / detection points in the scenario templates are real gaps of those partial drawings and
  do not depend on a threshold; the defaults stay.

## Settings (`src/railway/rule-settings.ts`)

- Per diagram: root cell (id 0) data attribute `rdRuleSettings` (next to `rdCountryId`, project-settings.ts
  `setRootAttribute`), JSON with only the values that differ from the defaults
  (`{"overlap-length":{"params":{"min":120}},"signal-side":{"enabled":false}}`); no attribute = defaults. Saved in
  .drawio files / cache / share links like any draw.io diagram data. Unknown rules or keys and invalid values are
  ignored (defaults). One undoable edit per save; the live checks then re-run (model change).
- UI: Railway > Rule Settings… (`railwayRoute:ruleSettings`, lazy `rule-settings-dialog.ts`, `data-testid`
  `rule-settings-dialog`, rows `tr[data-rule]` with `[data-field=enabled|severity]` and `[data-param]`): on/off,
  severity, thresholds, English and Polish labels; Reset to defaults, Cancel, Save (invalid input or min > max is
  refused with a message).

## Interlocking table (`src/railway/interlocking.ts`)

- `computeInterlocking(objects, topo?)`: per route object (routes.ts `routeRecords`) the path through the drawing
  (`findRoutePaths`, the one with the stored sections, else the best agreement with the stored points). Stored data
  wins (points positions, sections, overlap); the drawing adds:
  - points role: **facing** (the path arrives on the toe) / **trailing**; overlap points (`role: overlap`);
  - travel direction per section (nominal/reverse);
  - overlap points and length (`walkOverlap`: beyond the exit signal into the stored overlap sections, else the
    first section beyond it, points normal preferred);
  - **flank protection** per points junction on the path / overlap: starting on the leg the route does not use,
    walk away from the points (all branches, at most `FLANK_MAX_DEPTH` 12 pieces): a signal reading towards the
    points (direction set) = "signal at Stop"; points reached on a leg = "those points in the other position"
    (crossover: W1 normal is protected by W2 normal); points reached on the toe = continue on both legs; a track end
    = nothing needed; limit reached without an element = "unprotected" (`none found for W3`). The route's own points
    are dropped. **Limits**: no derailers (no such kind), a signal of any type with a direction counts, signals
    without a direction are ignored, no fouling-point distances, one element per branch.
  - entry signal aspect (data): next signal = exit signal; marker board / ETCS stop marker -> ETCS MA; 2 aspects
    -> proceed only; else proceed (next proceeds) / caution (next at stop); reverse points on the path -> speed
    restriction. Not mapped to Ie-1 S-codes (left to the engineer).
- **Conflicts** (`detectInterlockingConflicts`, once per pair -> symmetric matrix): `S` section both paths use,
  `O` a section of one overlap that the other route uses and not both paths, `P` points needed in different
  positions (path or overlap), `F` flank points needed the other way by the other route (or the flank signal is the
  other route's entry signal), `D` opposing travel directions on an S/O section.
- **Tables**: `buildInterlockingTable(il, 'pl'|'en')` (PKP: Przebieg, Od semafora, Do semafora, Zwrotnice
  (położenie) `W1+`/`W1-`, Ochrona boczna, Odcinki izolowane/sekcje, Zakładka, Przebiegi wykluczające się
  `R2 (S,P)`, Sygnał na semaforze), `buildConflictMatrixTable` (diagonal `×`), `buildConflictPairsTable`.
- **Dialog** (`route-tables-dialog.ts`): tabs Route table / Interlocking table / Conflicts (legend, matrix
  `.rd-il-matrix td[data-row][data-col][data-codes]`, pairs `.rd-route-table`). Export CSV = shown tab
  (`-routes.csv`, `-interlocking.csv`, `-conflict-matrix.csv`); Export XLSX = `-routes.xlsx` with the sheets
  "Tablica zależności", "Macierz konfliktów", Routes, "Konflikty" ("English headers": Interlocking table, Conflict
  matrix, Routes, Conflicts). Railway > Interlocking Table… opens the interlocking tab, Conflict Matrix… the
  conflicts tab.
- **railML**: only in the rd extension of the route: `rdConflicts="R2:SP R3:F"` (other route : reason codes) and
  `rdFlank="W2:normal S3:stop"`. Derived, recomputed by every export, not read back by the import (byte-stable round
  trip). No core railML elements: the railML 3.2 IL names for conflicting routes (e.g. `conflictingRoutes`) are not
  verified (no vendored XSD, not in `mapping.ts`), so nothing unverified is written to the interlocking assets.
- **AI**: `get_interlocking_table` (`lang`), `get_route_conflicts` (pairs + matrix).
- Tests: `src/railway/__tests__/interlocking.test.ts` (single points station, crossover, opposing routes on
  parallel tracks, matrix symmetry, PL/EN tables, xlsx), `rule-checks.test.ts` (every rule pass/fail, no km,
  settings persistence/undo/round trip, all ERTMS templates), `tests/e2e/interlocking.spec.ts`.
