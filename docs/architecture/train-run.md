# Train run (animated route run)

Railway > Train Run… (`data-action="railwayRoute:trainRun"` -> bus event `railway-route-request` "trainRun"):
a train runs over a route or a chain of consecutive routes; the object states change over time, the train cell moves
along the track, and the run can become a scenario. Code: `src/railway/train-run/`, `src/scenarios/train-run-scenario.ts`,
`src/ai/train-run-tool.ts`; wiring in `src/boot/features.ts`.

## Model (pure, no DOM)

- **Path** (`run-path.ts` `buildRunPath(model, routeIds)`): each route's path is the topology path with its stored
  sections (as Railway > Update Route Paths; else the first path, with a warning). Routes must be consecutive (each
  starts at the exit signal of the one before), else an error. Result in metres from the entry signal of the first
  route: `blocks` (track section, track where no section covers the piece, points leg without a section = a `points`
  block), `segments` (drawn line per piece, km scale of the section/track), `points` (required positions + where the
  train passes the junction, found at the node between two path pieces), `overlap` (stored `rdOverlap` of the LAST
  route, else the path's; route sections are dropped from it), `lengthM`. Pieces without length / km count 1 drawing
  unit = 1 m: `approximate` + warning "drawing units are used as metres". Helpers `pointAtM` (position + direction,
  extrapolated before the start), `kmAtM`, `lineBetween`.
- **Speed limits** (optional data): attribute `rdSpeedLimit` (or `rdVmax`, km/h) on a section / track / points. Not
  a catalogue field (no Data panel entry yet; set it in the file, Railway Script attrs or the AI).
- **Simulation** (`simulate.ts` `simulateRun(path, {speedKmh, lengthM, useSpeedLimits, setupS = 5, dwellS = 0,
  overlapReleaseS = 30})`): the head starts at the entry signal (the train standing before it is not modelled);
  constant speed, or with `useSpeedLimits` the lowest limit of the blocks the train covers (head to tail): the
  profile is piecewise constant between the block ends and those + train length (no acceleration / braking).
  Events (sorted by time, ties: route set, depart, signal, enter, clear, points, route released, arrival, overlap):
  - t = 0 `route-set` per route: route reserved, its sections reserved, points positioned + `locked`, the last route's
    overlap `overlap`, entry signal proceed; `depart` after `setupS` (route setting / MA time);
  - `signal-passed` (head at a route's entry signal): signal stop, route occupied ("in use");
  - `head-enter` block occupied; `tail-clear` (head at block end + length) block free = sequential release;
    `points-released` (tail past the junction; legs that are blocks release with the block) points free, position
    kept; `route-released` when all blocks of a route are released;
  - `arrive` at the exit signal of the last route (blocks under the train stay occupied); `overlap-released`
    `overlapReleaseS` after the stop; the run ends at max(arrival + dwell, overlap release).
  `statesAt(run, t)` folds the changes up to t per object (`block:`/`points:`/`signal:`/`route:` + ID).
- **Renderer** (`run-renderer.ts` `RunRenderer(graph, run, {cellId})`): matches objects by railway ID (a section wins
  over a track of the same ID), remembers their values before the run and applies the difference to the state at t
  with `applyObjectStates` (same look as Object State; "free"/"stop" written as no state); moves the train cell (head
  at the head position, body behind it, 12 units above a horizontal track / beside a vertical one; groups' offsets
  respected); creates a new train (`shape=ertms-train`, next free `TR<n>`, `rdLength`) when none is chosen; `restore()`
  puts everything back. Scrubbing back restores remembered values.

## View (`run-view.ts`, lazy chunk; `install-train-run.ts`)

- Same pattern as the scenario view: a separate graph (factory from boot: `new Graph` + `setupGraph(graph, 'view')`)
  loaded with `serializeToXml()` of the active tab, mounted in `#graph-container`, the tab's graph div hidden (zoom
  and scroll copied). The animation edits only that model (no undo manager, not saved): the live model, its undo
  history and autosave are never touched, so Close (button or Esc) shows the drawing exactly as it was.
  `body.rd-train-run-viewing` fades and disables menus, toolbar, left panel, properties, Data/Checks.
- Panel `[data-testid=train-run-view]`: bar `.rd-trn-bar` with settings (routes text field with a datalist of
  consecutive chains, prefilled from the selected route(s); train select = trains of the drawing + "New train",
  prefilled from the selection / first train; speed and length default to the train's `rdMaxSpeed` / `rdLength`;
  Section limits; Dwell; Overlap release) — any change re-simulates from t = 0; playback: ▶ Play / ⏸ Pause
  (requestAnimationFrame, simulated time += real time × multiplier, stops at the end), ⏮ / ⏭ previous / next event
  time, multiplier 1× 2× 5× 10×, range scrubber (0.1 s), time `t s / end s`, status (head m, km, km/h); "Create
  scenario from run", "Keep final state", Close; warnings/errors line `.rd-trn-message` (approximate lengths, IDs of
  the run missing in the drawing, no path). Right: event list `.rd-trn-events` (time + label; past / current
  highlighted; click = seek). A translucent purple polyline in the view overlay pane (`GraphOverlay`,
  `.rd-trn-extent`) shows the train's real length along the track. Data attributes for tests: `data-state`
  (ready|error), `data-t`, `data-head-m`, `data-occupied` (occupied block IDs), `data-playing`.
- Keys (keymap interceptor added in boot/features.ts, before the scenario view's): Esc closes, Space play/pause,
  ←/→ previous/next event; fields keep their keys; Ctrl/Cmd+S passes; other editing keys are blocked.
- Closes on tab switch / close; opening it closes the scenario view. `ServiceRegistry.get('trainRun')` = the handle
  (`open`, `getView()` -> `getGraph()`, `getRun()`, `seek`, ...) for e2e.
- **Keep final state**: a `RunRenderer` on the live graph shows the end of the run inside one model update = ONE undo
  step (states, train moved / new train added), then the view closes.

## Scenario from a run (`src/scenarios/train-run-scenario.ts`)

- `runMoments` groups events with the same time; one step per moment: name from short labels ("Route R1 set",
  "Departure, S1 to stop, TC1 occupied", "TC1 freed", "Arrival at S2", "Overlap TC3 released"; ≤ 80 chars, "+n more"),
  description `t = 15 s`, Markdown text (time, head position in m from the first entry signal + km when the track has
  km, speed, the event labels; step 1 also a table train / routes / path / speed / length and the warnings), PlantUML
  sequence (Interlocking, RBC only for ETCS level 2 = the train's `rdEtcsLevel`, new train = 2, Train: MA request ->
  route request -> set and locked -> MA granted (EoA, length), position reports, section releases, overlap release;
  only syntax the local renderer knows). Snapshots: the tab's XML imported into a scratch model + `new Graph(detached
  div, model, [], live stylesheet)`, `RunRenderer.showAt(t)`, `exportModelToDrawioXml`; the live drawing is unchanged.
- `addRunScenario(set, run, steps)` = "Train run R1 → R2" with a description; the UI adds it to `tab.document.scenarios`
  and shows the Scenarios panel, so the view, autoplay, Show changes, HTML/PDF/slides exports work as for any scenario.

## AI tool `simulate_train_run`

`{routes: [..], speedKmh, lengthM, train?, useSpeedLimits?, dwellS?, overlapReleaseS?, setupS?, createScenario?,
scenarioName?, uml?}` (tool-defs.ts; executor `src/ai/train-run-tool.ts`): returns routes, lengthM, approximate,
departS/arriveS/durationS, `events` [{t, type, subject, label, headM, km?, speedKmh}], warnings; unknown route/train ->
error listing the valid ids; createScenario -> the scenario (id, name, step names) in ONE undoable edit
(`scenarioEdit` from scenario-tools.ts: Ctrl+Z / Undo AI turn remove it). The drawing is not changed. Mentioned in the
system prompt (Scenarios section).

## Limits

- No acceleration/braking curves, no approach section before the entry signal, no flank protection or route
  conflicts (feature/interlocking), no partial route release timers besides the overlap; trains are not reversed.
- The train symbol keeps its drawn size (the overlay shows the real length); it is placed by the head point.
- Speed limits only from `rdSpeedLimit`/`rdVmax` attributes.

## Tests

`src/railway/train-run/__tests__/simulate.test.ts` (path, chain, errors, approximate, km, event order/times, sequential
release, signal back to stop, overlap timer, dwell, speed limits, points lock/release, renderer scrub/restore/new
train), `src/scenarios/__tests__/train-run-scenario.test.ts` (moments, names, text, UML parses, snapshot states and
train positions, source unchanged), `src/ai/__tests__/train-run-tool.test.ts`, `tests/e2e/train-run.spec.ts`, the
theme-contrast audit (`Train run panel`, `Train run events list`, both themes).
