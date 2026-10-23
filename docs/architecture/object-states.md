# Object states

- Runtime states (not infrastructure, not exported to railML): `rdState` (sections/tracks/points/routes: free | occupied |
  reserved | overlap | locked | disturbed; level crossings open | closed | disturbed; balises/LEUs/axle counters free |
  disturbed), `rdAspect` (signals except marker boards / stop markers: stop | proceed | caution | shunt | dark), `rdPosition`
  (points: the catalogue field, normal | reverse | moving | outOfControl). Missing = default (free / open / stop / normal) =
  as drawn. **One table** `STATE_SCHEME` + `STATE_COLORS` (saturated, >= 3:1 on white and >= 4.5:1 on #121212, so the dark
  rendering keeps them unchanged; unit-tested). Occupied
  also draws the line thicker (`widthScale` 1.5, at least +2; drawn width kept in `rdBaseStyle`) so it differs from tracks drawn red.
- `applyObjectStates` = attributes + style keys (`strokeColor`/`fillColor`/`gradientColor`/`dashed`/`dashPattern`/`opacity`)
  of the object, its drawn parts (groups) or a signal's lamps (round-ish filled leaf vertices; else the signal's own fill)
  via `applyStyleToCells`, ONE undo step; the drawn values are remembered in `rdBaseStyle` (JSON per part path) and put back
  exactly (key order + remembered draw.io string: `applyStyleToCells` now copies `copyRawDrawioStyle`, so a reset saves
  byte-identical styles; tested on every ERTMS template). Reset State keeps `rdPosition` (data), drops state/aspect/look.
  `runRouteCommand` set / occupy / release (sections, overlap, points with `rdRouteRestore`, entry signal);
  `occupyUnderTrains`.
- UI: context menu section `[data-rd-state-menu]` before Edit Data (State ▸ / Aspect ▸ / Position ▸ as `.rd-ctx-sub` with
  `position: fixed` `.rd-ctx-submenu` lists of `menuitemradio`s `[data-state-cmd]`, route/train items, Reset State; hover or
  →/Enter opens, ←/Esc closes); Railway > Object State ▸ (`data-action="railwayState:<cmd>"` -> the `railwayState:` command -> bus event
  `railway-state-request`, handled on the active tab's selection); State Legend (`rd.railway.stateLegend`); Data panel
  State/Aspect selects (points Position field applies its look). Scenario diff: `TC3: free → occupied`, colour keys and
  lamp parts folded in (`describeStateChanges`). railML export skips the state attributes and writes the drawn style.
- Keyboard: Alt+F/O/R (free/occupied/reserved), Alt+N/V (points), Alt+1..4 (aspects) on the selection
  (`state-shortcuts.ts` by `event.code`; keydown listener in install-railway-states.ts, canvas focus only; hints via
  the `railwayState:` command's `memberShortcuts` / key binding (ui/commands/railway.ts), context menu kbd, Help section "Object states").
- Points reverse: the straight continuation (part of the track) is faded by a view overlay (`points-fade.ts`
  `installPointsFade` per tab graph from install-railway-states: topology junction -> normal piece for the leg's
  length, canvas-coloured line at 70 % in the overlay pane, class `rd-points-fade`; not in the model/exports).
- Tests: `src/railway/__tests__/states.test.ts`, `states-templates.test.ts`, `points-fade.test.ts`, `tests/e2e/object-states.spec.ts`.
