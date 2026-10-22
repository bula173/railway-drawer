# Object states (occupancy, route set, aspects, points position)

Runtime states of railway objects for scenarios and presentations: a track section shown occupied,
a route set, a signal at proceed, points in reverse. They are **not infrastructure data** and are not
exported to railML.

## Where a state lives

| Attribute | Objects | Values (missing = default) |
|---|---|---|
| `rdState` | track sections, tracks, points, routes | `free` (default), `occupied`, `reserved` (route set), `overlap`, `locked`, `disturbed` |
| `rdState` | level crossings | `open` (default), `closed`, `disturbed` (failure) |
| `rdState` | balises, LEUs, axle counters | `free` (working, default), `disturbed` (failed) |
| `rdAspect` | signals (main / shunting; not marker boards or ETCS stop markers) | `stop` (default), `proceed`, `caution`, `shunt`, `dark` |
| `rdPosition` | points (also the points' Data field "Position") | `normal` (default), `reverse`, `moving`, `outOfControl` |
| `rdBaseStyle` | any object with a state look | JSON of the drawn values of the style keys a state changed, per part |
| `rdRouteRestore` | a set route | JSON of the points positions before "Set Route" |

All are draw.io object attributes (`<object rdKind="trackSection" rdId="TC3" rdState="occupied" …>`),
so draw.io's Edit Data shows them and they survive draw.io saves.

## The colour scheme (one table)

`src/railway/states.ts`: `STATE_SCHEME` (allowed states per object group + their look) and
`STATE_COLORS`. Change a colour or add a state there; the context menu, the Railway menu handler,
the Data panel, the legend and the change lists all read it.

| Group | State | Look |
|---|---|---|
| Sections, tracks, points | Free | as drawn |
| | Occupied | stroke `#ff0000` (red) |
| | Reserved (route set) | stroke `#009e00` (green) |
| | Overlap | stroke `#7a9a00` (yellow-green), dashed `8 4` |
| | Locked | stroke `#2979ff` (blue) |
| | Disturbed | stroke `#e000e0` (magenta), dashed `2 2` ("flashing") |
| Points position (the diverging leg = the points cell) | Normal | leg at opacity 30 (faint) |
| | Reverse | leg as drawn |
| | Moving | leg dashed `4 4` |
| | Out of control | stroke `#e000e0`, dashed `2 2` |
| Routes (edges on the Routes layer) | Not set | as drawn (translucent orange) |
| | Set | stroke `#009e00`, opacity 80 |
| | In use (occupied) | stroke `#ff0000`, opacity 80 |
| Signals (lamps) | Stop | lamp fill `#ff0000` |
| | Proceed | lamp fill `#00c853` |
| | Caution | lamp fill `#ffd600` |
| | Shunt (lunar white) | lamp fill `#9aa7ff` |
| | Dark (no light) | lamp fill `none` |
| Level crossings | Open / Closed (secured) / Failure | as drawn / stroke `#2979ff` / stroke `#e000e0` dashed |
| Balises, LEUs, axle counters | Working / Failed | as drawn / stroke `#e000e0` dashed |

A position look wins over the state look (points out of control are magenta even when occupied);
occupancy and position combine otherwise (occupied + normal = red, faint leg).

**Colour rules**: every state colour is saturated (chroma >= 0.3), strokes have >= 3:1 against the
white and >= 4.5:1 against the dark canvas (#121212). The dark rendering (`colors.ts`) keeps saturated
colours and floors strokes at 4.5:1, so the colours are drawn unchanged in both themes
(`src/railway/__tests__/states.test.ts` guards this, `tests/e2e/object-states.spec.ts` checks the
rendered SVG in the dark theme).

## What gets coloured

- Line objects (sections, tracks, points, routes, level crossings, equipment): a single cell gets
  `strokeColor` (`fillColor` when it has no stroke but a fill), `dashed`/`dashPattern`, `opacity`. A group
  (e.g. the ERTMS "TC" marker) colours its drawn parts: edges and stroked vertices by stroke, solid
  stroke-less parts (the marker bar) by fill; text parts never.
- Signals: the lamps = round-ish filled leaf vertices of the symbol (|w - h| <= 25 %, not text; the
  ERTMS signal groups' 9x9 lamp stencils); they get `fillColor` + `gradientColor=none`. All lamps take
  the aspect colour. A signal without such parts (a single shape) gets its own fill.
- Points: the points cell is the diverging leg (ERTMS "Point Left/Right"); the straight leg belongs
  to the track and is not faded.

## Applying and resetting (`src/railway/state-apply.ts`)

`applyObjectStates(graph, items)` writes the attributes AND the style keys in ONE undoable model edit
(`setRailwayData` + the style-edit helper `applyStyleToCells` inside one `beginUpdate`). Before a key
is overwritten, its drawn value (or "absent") is recorded in `rdBaseStyle` under the part's path (`""` =
the object cell, `"0.2"` = `children[0].children[2]`). A state without a look (Free, Reset) puts exactly
those values back and drops `rdBaseStyle`; keys keep their order and the remembered draw.io style
string, so a reset file is byte-identical to the drawn one (tested on every ERTMS template).
**Reset State** removes `rdState` / `rdAspect` and the look; the points position (data) stays.

Route commands (`runRouteCommand`, one undo step each):

- **Set Route**: route edge Set (green), its `rdSections` reserved, `rdOverlap` sections overlap, its
  `rdPoints` in the required positions (previous positions saved in `rdRouteRestore`), entry signal proceed.
- **Occupy Route**: route In use (red), its sections occupied, entry signal stop (train passed it).
- **Release Route**: route, sections and overlap free, entry signal stop, points back to the saved positions.

**Occupy / Free Sections Under Train**: track sections (lines, not TC markers) within 30 units of the
train's base line, else tracks.

## UI

- Context menu on a typed object: **State ▸**, **Aspect ▸** (signals), **Position ▸** (points) with the
  allowed values (radio check = the common current value, colour sample), Set / Occupy / Release
  Route on routes, Occupy / Free Sections Under Train on trains, Reset State. Several selected objects
  are set together (only those that allow the value), one undo step.
- Railway > Object State ▸: State ▸, Signal Aspect ▸, Points Position ▸, Set / Occupy / Release Route,
  Occupy Sections Under Train, Reset State, Reset All States, State Legend (legend over the canvas,
  localStorage `rd.railway.stateLegend`).
- Data panel: "State" / "Aspect" selects for objects with states; the points' Position field applies
  its look too.
- Scenarios: a step stores the drawing, so states are part of the step; "Show changes" lists
  `TC3: free → occupied`, `S1: aspect stop → proceed`, `W1: position normal → reverse` (the colour
  keys and lamp parts are folded into that line).

## Not exported

railML export skips `rdState`, `rdAspect`, `rdBaseStyle`, `rdRouteRestore`, and the rd extension's
`style` is the drawn style (state keys put back). `rdPosition` stays a points data field.
Railway Script: no `state` / `aspect` keys yet (follow-up); `position` of points is the existing field.
