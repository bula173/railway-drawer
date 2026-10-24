# Symbol sizes

Default sizes (bounding box w×h, draw.io units = px at 100 %) of the railway symbols: the palette
entries of the four railway libraries (`public/libraries/ertms.xml`, `ertms-extra.xml`,
`railway-pl.xml`, `track-layout.xml`), the symbols the schematic builder draws for the railML
import and the Railway Script (`src/railway/schematic.ts`), and the symbols inside the built-in
ERTMS templates.

## The standard

One file holds it: `src/railway/symbol-sizes.json`, read by both library generators
(`scripts/ertms-library/build_app_library.py`, `scripts/railway-libraries/build_railway_libraries.py`)
and by the app (`src/railway/symbol-sizes.ts`: schematic builder, train run, Arrange > Normalize
Symbol Sizes). Boxes are on the draw.io 10 px grid where the symbol stands beside a track (signals,
boards, equipment, trains); symbols centred on the track line have even sizes, so their centre lands
on the grid point of the line. **Existing drawings are not changed on open**: the standard is the
default of new inserts; Arrange > Normalize Symbol Sizes applies it to a selection (one undo step).

| Class | Members | Box w×h | Layout / text |
|---|---|---|---|
| Signal | every lit, arm and disc signal: ERTMS "Signal …", PKP semafory, tarcze To / Osp / Tz / Tm, Sz, powtarzacz, semafory kształtowe; schematic signals | **50×20** for every lamp count | head band 12 on the track side (Right / nominal: top, below the track; Left / reverse: bottom), mast at x = 1 (49 mirrored) spanning the head band, arm at its middle to the lamp row; lamps **Ø 8**, contiguous, the row centred in x 6..50 (5 lamps fill it); label band 8 on the far side (ERTMS ID text, font 8); disc Ø 10; arms 10×3 |
| Board on a post | ETCS stop / location markers (`markerBoard`, `etcsStopMarker`), level transition, RBC border, cab signalling, neutral section, pantograph, track condition, non-stopping, release speed boards, PKP wskaźniki W1 / W4 / W8 / W9 / W24, D1, kilometrowy, Track layout speed boards | **30×20** | post at x = 1 full height, arm at y 10; text face 20×14, symbol face 14×14, centred beside the post; labels font 7 bold |
| Balise | every fixed / switchable / ERTMS balise | **12×12** | centred on the line |
| Balise group | ETCS extra groups | **(16 n − 4)×24**, linked +2 (link arrow) | balises 12 at a pitch of 16, `%rdId%` label row 10 (font 8) |
| Axle counter | Axle Counter Head; schematic | **12×12** | centred |
| Joint | ERTMS "TC", Insulated Rail Joint, Styk izolowany; template TC markers | **10×12** | centred (a loose joint bar in a template keeps its 2×8 drawing) |
| LEU | LEU (also ACE, OC boxes) | **30×20** | font 8 bold |
| RBC | RBC (also IXL) | **40×30** | font 10 bold |
| Buffer stop | Kozioł oporowy; schematic | **14×20** | stop bar centred on the line; Track End 10×20 |
| Level crossing | Przejazd kat. A–D, Level Crossing | **20×40** | |
| km post | km Post 10×20; Hectometre Mark, Słupek hektometrowy 10×10 | | label below, font 8 |
| Location annotations | End of Authority, Danger Point, Supervised Location | **12×24** | label below, font 8 |
| Train | every train | height **20**, width = drawn aspect (ERTMS "Train" / new train run train 50×20, Train Connected 50×20, ETCS Train 76×20) | texts keep their box |
| Lines | tracks, points legs, Track Section in every library | strokeWidth **6** (the ERTMS track) | schematic section overlay 2, Railway Script sidings 3 (deliberate) |
| Snap | | gap 4 between line and a signal / board / LEU box | `src/railway/snap.ts` (box based: one box, one offset) |

Not standardised (one entry each, sizes unchanged): platforms, buildings (Nastawnia / Posterunek
60×30), bridge, tunnel, GSM-R mast, RIU, Euroloop, MA arrows, overlap, km ruler, gradient boards,
rogatka, road lights, frog, derailers, track pieces and turnout sets (their geometry is the track).
The legacy `src/shapes/ertms` placeholder shapes (render-only, for old files) keep their sizes.

## What changed

- **ERTMS library** (`build_app_library.py`, the user's `ERTMSDrawioTemplate/ERTMS.xml` untouched):
  "Signal Left 3" 43×24, "Signal Right 3" 42×26, "SIgnal Right 4" 46×24 re-laid out in the signal box
  (cells, ids, styles and stencils kept; lamps 9 -> 8); "Train Connected" 68×27 -> 50×20; the
  entries' `w`/`h` follow. **Templates**: 90 signals (35..57 × 20..32) -> 50×20, each kept at its
  centre along the track and re-placed beside its nearest track at the snap gap on the side drawn
  (head toward the track, ID text in the label band); 107 TC joint marker groups (10..13 × 12) ->
  10×12 around their centre; 19 trains (68×16..72×32) -> 20 high. `template-semantics.test.ts`
  proves the templates mean the same: objects, data, places on the topology, route paths and
  lengths, interlocking table and conflicts, rule-check findings equal the snapshot taken before.
- **ERTMS/ETCS extra**: marker / location markers 17×14 and boards 19..23×14 -> 30×20; balise
  groups unchanged; LEU / ACE / OC 30×16 -> 30×20, RBC 40×24 -> 40×30, IXL 44×28 -> 40×30;
  Insulated Rail Joint 8×16 -> 10×12; ETCS Train 60×16 -> 76×20; End of Authority 10×24 -> 12×24.
- **PKP**: light signals 22..46×12, tarcze 20×11 / 18×14, Sz 14×12, semafory kształtowe 28..38×16
  -> 50×20 (Tz / Tm lamps 7 -> 8); wskaźniki / D1 / kilometrowy -> 30×20; kozioł 14×18 -> 14×20;
  styk 8×16 -> 10×12; słupek hektometrowy 8×14 -> 10×10; Nastawnia / Posterunek -> 60×30; tracks and
  legs strokeWidth 4 -> 6.
- **Track layout**: tracks, legs, Track Section strokeWidth 4 -> 6; Track End 10×18 -> 10×20;
  km Post 8×16 -> 10×20; Hectometre Mark 8×10 -> 10×10; speed boards -> 30×20 (font 7).
- **Schematic builder** (`schematic.ts`; railML import, Railway Script): `defaultSize` from the
  standard (axle counter 10×10 -> 12×12, buffer stop 6×24 -> 14×20 drawn as a stop bar, level
  crossing 30×40 -> 20×40, LEU 34×18 -> 30×20, RBC 50×30 -> 40×30, fallback signal 20×20 -> 50×20);
  ETCS marker boards (10×16 rectangles) -> `markerBoardSymbol`, a board on a post in the 30×20 box
  with the ID above. Signals, balises, joints and trains come from the ERTMS library (now standard).
- **Train run**: a new train is 50×20 (`NEW_TRAIN_SIZE` from the standard).
- **Click / drag insert, hover-arrow clones**: insert the entry as stored (so the standard); a
  hover-arrow clone copies its source's size (`cloneForConnect`).
- Lamps stay round filled leaf parts (states), signals and boards stay railway objects (press on the
  body moves, the small-symbol sizer rule), snap offsets come from the box (now one per class).

Tests: `src/railway/__tests__/symbol-sizes.test.ts` (every palette entry of each class and every
template symbol has the standard size, lamp diameter, head band and mast place; a new entry that
deviates fails), `schematic-sizes.test.ts`, `normalize-sizes.test.ts`, `template-semantics.test.ts`;
e2e `railway-shapes.spec.ts` (signals from ERTMS, PKP and ETCS extra insert with equal boxes).

## Audit before the standard (commit 6ae19b7)

Palette entries by catalogue kind and subtype (ERTMS: the 18 palette elements; the 19 templates
are listed below).

#### Signals

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | Signal Left 3 | main, 3 aspect(s), reverse | 43×24 |
| ERTMS | Signal Right 3 | main, 3 aspect(s), nominal | 42×26 |
| ERTMS | SIgnal Right 4 | main, 4 aspect(s), nominal | 46×24 |
| PKP | Semafor 2-komorowy prawy | main, 2 aspect(s), nominal | 22×12 |
| PKP | Semafor 2-komorowy lewy | main, 2 aspect(s), reverse | 22×12 |
| PKP | Semafor 3-komorowy prawy | main, 3 aspect(s), nominal | 30×12 |
| PKP | Semafor 3-komorowy lewy | main, 3 aspect(s), reverse | 30×12 |
| PKP | Semafor 4-komorowy prawy | main, 4 aspect(s), nominal | 38×12 |
| PKP | Semafor 4-komorowy lewy | main, 4 aspect(s), reverse | 38×12 |
| PKP | Semafor 5-komorowy prawy | main, 5 aspect(s), nominal | 46×12 |
| PKP | Semafor 5-komorowy lewy | main, 5 aspect(s), reverse | 46×12 |
| PKP | Semafor wjazdowy prawy | main, 5 aspect(s), nominal | 46×12 |
| PKP | Semafor wjazdowy lewy | main, 5 aspect(s), reverse | 46×12 |
| PKP | Semafor wyjazdowy prawy | main, 4 aspect(s), nominal | 38×12 |
| PKP | Semafor wyjazdowy lewy | main, 4 aspect(s), reverse | 38×12 |
| PKP | Semafor drogowy prawy | main, 4 aspect(s), nominal | 38×12 |
| PKP | Semafor drogowy lewy | main, 4 aspect(s), reverse | 38×12 |
| PKP | Semafor odstępowy prawy | main, 3 aspect(s), nominal | 30×12 |
| PKP | Semafor odstępowy lewy | main, 3 aspect(s), reverse | 30×12 |
| PKP | Powtarzacz semafora prawy | main, 2 aspect(s), nominal | 24×12 |
| PKP | Powtarzacz semafora lewy | main, 2 aspect(s), reverse | 24×12 |
| PKP | Tarcza ostrzegawcza świetlna To prawa | main, 2 aspect(s), nominal | 22×12 |
| PKP | Tarcza ostrzegawcza świetlna To lewa | main, 2 aspect(s), reverse | 22×12 |
| PKP | Tarcza ostrzegawcza kształtowa prawa | main, 2 aspect(s), nominal | 18×14 |
| PKP | Tarcza ostrzegawcza kształtowa lewa | main, 2 aspect(s), reverse | 18×14 |
| PKP | Tarcza ostrzegawcza przejazdowa Osp prawa | main, 2 aspect(s), nominal | 22×12 |
| PKP | Tarcza ostrzegawcza przejazdowa Osp lewa | main, 2 aspect(s), reverse | 22×12 |
| PKP | Tarcza zaporowa Tz prawa | shunting, 2 aspect(s), nominal | 20×11 |
| PKP | Tarcza zaporowa Tz lewa | shunting, 2 aspect(s), reverse | 20×11 |
| PKP | Tarcza manewrowa Tm prawa | shunting, 2 aspect(s), nominal | 20×11 |
| PKP | Tarcza manewrowa Tm lewa | shunting, 2 aspect(s), reverse | 20×11 |
| PKP | Sygnał zastępczy Sz prawy | main, 1 aspect(s), nominal | 14×12 |
| PKP | Sygnał zastępczy Sz lewy | main, 1 aspect(s), reverse | 14×12 |
| PKP | Semafor kształtowy 1-ramienny prawy | main, 2 aspect(s), nominal | 28×16 |
| PKP | Semafor kształtowy 1-ramienny lewy | main, 2 aspect(s), reverse | 28×16 |
| PKP | Semafor kształtowy 2-ramienny prawy | main, 3 aspect(s), nominal | 38×16 |
| PKP | Semafor kształtowy 2-ramienny lewy | main, 3 aspect(s), reverse | 38×16 |

#### Boards / markers

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | Gradient | gradient board (stencil) | 455×55 |
| ETCS extra | ETCS Stop Marker Right | ETCS etcsStopMarker | 17×14 |
| ETCS extra | ETCS Stop Marker Left | ETCS etcsStopMarker | 17×14 |
| ETCS extra | ETCS Location Marker Right | ETCS markerBoard | 17×14 |
| ETCS extra | ETCS Location Marker Left | ETCS markerBoard | 17×14 |
| ETCS extra | Level Transition L0 | board on a post | 21×14 |
| ETCS extra | Level Transition L1 | board on a post | 21×14 |
| ETCS extra | Level Transition L2 | board on a post | 21×14 |
| ETCS extra | Level Transition L3 | board on a post | 21×14 |
| ETCS extra | Level Transition NTC | board on a post | 21×14 |
| ETCS extra | Level Transition Announcement | board on a post | 21×14 |
| ETCS extra | RBC Border Announcement | board on a post | 23×14 |
| ETCS extra | RBC Border | board on a post | 23×14 |
| ETCS extra | Cab Signalling Begin | board on a post | 23×14 |
| ETCS extra | Cab Signalling End | board on a post | 23×14 |
| ETCS extra | Neutral Section Announcement | board on a post | 19×14 |
| ETCS extra | Neutral Section Begin | board on a post | 19×14 |
| ETCS extra | Neutral Section End | board on a post | 19×14 |
| ETCS extra | Lower Pantograph | board on a post | 19×14 |
| ETCS extra | Raise Pantograph | board on a post | 19×14 |
| ETCS extra | Track Condition Board | board on a post | 23×14 |
| ETCS extra | Non-Stopping Area Board | board on a post | 23×14 |
| ETCS extra | Release Speed Board | board on a post | 21×14 |
| PKP | Wskaźnik W1 | board on a post | 21×14 |
| PKP | Wskaźnik W4 | board on a post | 21×14 |
| PKP | Wskaźnik W8 (ograniczenie prędkości) | board on a post | 21×14 |
| PKP | Wskaźnik W9 (zapowiedź ograniczenia) | board on a post | 21×14 |
| PKP | Wskaźnik W24 | board on a post | 21×14 |
| PKP | Wskaźnik (pusty) | board on a post | 21×14 |
| PKP | Tarcza D1 (Stój) | board on a post | 17×14 |
| PKP | Wskaźnik kilometrowy | board on a post | 21×14 |
| Track layout | Gradient Board Up | gradient board (stencil) | 20×26 |
| Track layout | Gradient Board Down | gradient board (stencil) | 20×26 |
| Track layout | Speed Board | board on a post | 21×14 |
| Track layout | Speed Warning Board | board on a post | 21×14 |

#### Balises

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | Single Balise Right | nominal | 12×12 |
| ERTMS | Balise Left | reverse | 12×12 |
| ETCS extra | Fixed Balise Right | nominal | 12×12 |
| ETCS extra | Fixed Balise Left | reverse | 12×12 |
| ETCS extra | Switchable Balise Right | nominal | 12×12 |
| ETCS extra | Switchable Balise Left | reverse | 12×12 |

#### Balise groups

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ETCS extra | Balise Group 2 Right | 2 balises | 28×24 |
| ETCS extra | Balise Group 2 Left | 2 balises | 28×24 |
| ETCS extra | Switchable Balise Group 2 Right | 2 balises | 28×24 |
| ETCS extra | Switchable Balise Group 2 Left | 2 balises | 28×24 |
| ETCS extra | Balise Group 3 Right | 3 balises | 44×24 |
| ETCS extra | Linked Balise Group Right | 2 balises, linked | 28×26 |
| ETCS extra | Linked Balise Group Left | 2 balises, linked | 28×26 |

#### Axle counters

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ETCS extra | Axle Counter Head | axleCounter | 12×12 |

#### Joints

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | TC | insulatedJoint | 10×12 |
| ETCS extra | Insulated Rail Joint | insulatedJoint | 8×16 |
| PKP | Styk izolowany | insulatedJoint | 8×16 |

#### LEU / RBC

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ETCS extra | RBC | rbc | 40×24 |
| ETCS extra | LEU | leu | 30×16 |

#### Buffer stops

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| PKP | Kozioł oporowy z prawej | bufferStop | 14×18 |
| PKP | Kozioł oporowy z lewej | bufferStop | 14×18 |
| Track layout | Track End Right | track end (untyped) | 10×18 |
| Track layout | Track End Left | track end (untyped) | 10×18 |

#### Level crossings

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| PKP | Przejazd kat. A | levelCrossing | 20×40 |
| PKP | Przejazd kat. B | levelCrossing | 20×40 |
| PKP | Przejazd kat. C | levelCrossing | 20×40 |
| PKP | Przejazd kat. D | levelCrossing | 20×40 |
| Track layout | Level Crossing | levelCrossing | 20×40 |

#### Track, points legs (lines)

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | Track | track, strokeWidth 6 | 158×1 |
| ERTMS | Point Left | points, strokeWidth 6 | 53×73 |
| ERTMS | Point Right | points, strokeWidth 6 | 53.43×74 |
| PKP | Rozjazd zwyczajny lewy | points+track, strokeWidth 4 | 100×20 |
| PKP | Rozjazd zwyczajny prawy | points+track, strokeWidth 4 | 100×20 |
| PKP | Rozjazd łukowy lewy | points+track, strokeWidth 4 | 100×20 |
| PKP | Rozjazd łukowy prawy | points+track, strokeWidth 4 | 100×20 |
| PKP | Skrzyżowanie torów | track, strokeWidth 4 | 100×40 |
| PKP | Rozjazd krzyżowy pojedynczy | points+track, strokeWidth 4 | 100×40 |
| PKP | Rozjazd krzyżowy podwójny | points+track, strokeWidth 4 | 100×40 |
| Track layout | Straight Track | track, strokeWidth 4 | 120×1 |
| Track layout | Straight Track Short | track, strokeWidth 4 | 60×1 |
| Track layout | Vertical Track | track, strokeWidth 4 | 1×60 |
| Track layout | Diagonal Track Up | track, strokeWidth 4 | 40×40 |
| Track layout | Diagonal Track Down | track, strokeWidth 4 | 40×40 |
| Track layout | Track Section | trackSection, strokeWidth 4 | 120×1 |
| Track layout | Points 1:9 Left (toe left) | points+track, strokeWidth 4 | 100×20 |
| Track layout | Points 1:9 Right (toe left) | points+track, strokeWidth 4 | 100×20 |
| Track layout | Points 1:9 Right (toe right) | points+track, strokeWidth 4 | 100×20 |
| Track layout | Points 1:9 Left (toe right) | points+track, strokeWidth 4 | 100×20 |
| Track layout | Points 1:12 Left (toe left) | points+track, strokeWidth 4 | 120×20 |
| Track layout | Points 1:12 Right (toe left) | points+track, strokeWidth 4 | 120×20 |
| Track layout | Points 1:12 Right (toe right) | points+track, strokeWidth 4 | 120×20 |
| Track layout | Points 1:12 Left (toe right) | points+track, strokeWidth 4 | 120×20 |
| Track layout | Single Crossover Down | points+track, strokeWidth 4 | 120×30 |
| Track layout | Single Crossover Up | points+track, strokeWidth 4 | 120×30 |
| Track layout | Scissors Crossover | points+track, strokeWidth 4 | 120×30 |
| Track layout | Diamond Crossing | track, strokeWidth 4 | 100×40 |
| Track layout | Single Slip | points+track, strokeWidth 4 | 100×40 |
| Track layout | Double Slip | points+track, strokeWidth 4 | 100×40 |

#### km posts

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| PKP | Słupek hektometrowy | untyped | 8×14 |
| Track layout | km Post | untyped | 8×16 |
| Track layout | Hectometre Mark | untyped | 8×10 |
| Track layout | km Ruler | untyped | 100×10 |

#### Trains

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | Train | train | 50×20 |
| ERTMS | Train Connected | train | 68×27 |
| ETCS extra | ETCS Train Right | train | 60×16 |
| ETCS extra | ETCS Train Left | train | 60×16 |

#### Annotations

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ETCS extra | End of Authority | location marker | 10×24 |
| ETCS extra | Danger Point | location marker | 12×24 |
| ETCS extra | Supervised Location | location marker | 12×24 |

#### Other

| Library | Entry | Subtype | w×h |
|---|---|---|---|
| ERTMS | MA | untyped | 180×118 |
| ERTMS | Distance | untyped | 345×1 |
| ERTMS | Line  | untyped | 1×71 |
| ERTMS | SSP | untyped | 447×57 |
| ERTMS | SSP Curve | untyped | 417×58 |
| ERTMS | Line | untyped | 105×1 |
| ETCS extra | Euroloop | untyped | 80×10 |
| ETCS extra | Axle Counter Evaluator | untyped | 30×16 |
| ETCS extra | Radio Infill Unit | untyped | 24×24 |
| ETCS extra | GSM-R Mast | untyped | 20×32 |
| ETCS extra | Interlocking | untyped | 44×28 |
| ETCS extra | Object Controller | untyped | 30×16 |
| ETCS extra | MA Arrow Right | untyped | 100×12 |
| ETCS extra | MA Arrow Left | untyped | 100×12 |
| ETCS extra | Overlap | untyped | 60×14 |
| PKP | Rogatka | untyped | 30×8 |
| PKP | Sygnalizator przejazdowy (drogowy) | untyped | 16×30 |
| PKP | Krzyżownica | untyped | 24×12 |
| PKP | Wykolejnica prawa | untyped | 14×10 |
| PKP | Wykolejnica lewa | untyped | 14×10 |
| PKP | Peron jednokrawędziowy | untyped | 160×12 |
| PKP | Peron wyspowy | untyped | 160×24 |
| PKP | Nastawnia | untyped | 60×28 |
| PKP | Posterunek | untyped | 60×24 |
| Track layout | Platform Edge | untyped | 120×8 |
| Track layout | Platform | untyped | 120×16 |
| Track layout | Bridge | untyped | 60×24 |
| Track layout | Tunnel | untyped | 60×24 |
| Track layout | Track Number | untyped | 20×14 |

#### Symbols inside the built-in ERTMS templates (`ertms.xml` entries 18..36)

| Kind | Aspects | w×h (count) |
|---|---|---|
| balise | - | 12×12 (72) |
| baliseGroup | - | 25×10 (1), 40×10 (71) |
| insulatedJoint | - | 10×12 (46), 11×12 (7), 12×12 (14), 13×12 (40), 2×8 (4) |
| signal | 3 | 35×25 (2), 40×23 (1), 41.5×24 (9), 42×26 (14), 42×27 (3), 42×30 (10), 42×32 (1), 42.6×25 (4), 43×24 (5), 44.5×26 (1), 45×20 (7), 47×22 (4), 51×27 (1), 54×26 (2) |
| signal | 4 | 46×24 (1), 48×22 (3), 48×26 (1), 51×23 (1), 51×23.5 (1), 51.6×25 (4), 51.6×25 (6), 52×24 (4), 52×25 (2), 53×24 (1), 54×26 (1), 57×22 (1) |
| train | - | 68×16 (2), 68×26 (1), 68×27 (4), 68×28 (1), 72×32 (11) |

#### Schematic builder (`src/railway/schematic.ts`: railML import, Railway Script)

Signals, balises, joints / TC and trains use the ERTMS library entries above ("Signal Right 3",
"SIgnal Right 4", "Signal Left 3", "Single Balise Right", "Balise Left", "TC", "Train"); the
other kinds were drawn with fallback shapes of `defaultSize`:

| Kind | Fallback w×h |
|---|---|
| signal (no library; Railway Script ETCS markers: 10×16) | 20×20 |
| balise | 12×12 |
| axleCounter | 10×10 |
| insulatedJoint / trackSection marker | 10×12 |
| bufferStop | 6×24 |
| levelCrossing | 30×40 |
| leu | 34×18 |
| rbc | 50×30 |
| train | 50×20 |
| other kinds | 24×24 |

Lines: ERTMS track / points legs strokeWidth 6, ETCS extra / PKP / Track layout tracks and legs 4,
Track layout "Track Section" 4, schematic section overlay 2 (Railway Script sidings 3).
