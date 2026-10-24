# Symbol sizes

Default sizes (bounding box w×h, draw.io units = px at 100 %) of the railway symbols: the palette
entries of the four railway libraries (`public/libraries/ertms.xml`, `ertms-extra.xml`,
`railway-pl.xml`, `track-layout.xml`), the symbols the schematic builder draws for the railML
import and the Railway Script (`src/railway/schematic.ts`), and the symbols inside the built-in
ERTMS templates.

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
