/**
 * @file palette-captions.ts
 * @brief Short captions under the captioned railway palette tiles (ERTMS, ERTMS/ETCS extra, PKP PLK, Track
 *        layout): the tile caption has room for two lines of ~11 characters, so long titles were cut before the
 *        part that tells entries apart ("Turnout 1:9 Right (toe…"). The caption keeps the distinguishing part
 *        ("1:9 R toe L", "Tm prawa", "Wjazdowy lewy"); the full title stays the tooltip and the search text.
 *        Display only: library files and titles are unchanged.
 */

/** Titles up to this length are shown as they are (two caption lines). */
export const CAPTION_MAX = 22;

const SIDE = (s: string): string => (s.toLowerCase() === 'left' ? 'L' : 'R');

/** Specific shortenings: [pattern, replacement]; the first match wins. */
const RULES: ReadonlyArray<[RegExp, string | ((...m: string[]) => string)]> = [
  // track layout points: "Points 1:9 Right (toe left)" -> "1:9 R toe L"
  [/^(?:Points|Turnout) (1:\d+) (Left|Right) \(toe (left|right)\)$/i, (_m, ratio, hand, toe) => `${ratio} ${SIDE(hand)} toe ${SIDE(toe)}`],
  // PKP PLK tarcze: the code tells them apart ("Tarcza manewrowa Tm prawa" -> "Tarcza Tm prawa")
  [/^Tarcza ostrzegawcza kształtowa (prawa|lewa)$/, 'To kształtowa $1'],
  [/^Tarcza ostrzegawcza świetlna (To) (prawa|lewa)$/, 'Tarcza $1 $2'],
  [/^Tarcza [a-ząćęłńóśźż]+(?: [a-ząćęłńóśźż]+)? ([A-Z][A-Za-z]*\d*) (prawa|lewa)$/, 'Tarcza $1 $2'],
  // semafory: drop the common word ("Semafor 3-komorowy prawy" -> "3-komorowy prawy")
  [/^Semafor kształtowy (\d)-ramienny (prawy|lewy)$/, 'Kształtowy $1-ram. $2'],
  [/^Semafor (\S+) (prawy|lewy)$/, (_m, kind, side) => `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${side}`],
  [/^Powtarzacz semafora (prawy|lewy)$/, 'Powtarzacz $1'],
  [/^Sygnał zastępczy (Sz) (prawy|lewy)$/, 'Sygnał $1 $2'],
  [/^Wskaźnik (W\d+) \(.*\)$/, 'Wskaźnik $1'],
  [/^Sygnalizator przejazdowy \(drogowy\)$/, 'Sygnalizator drogowy'],
  [/^Rozjazd krzyżowy (pojedynczy|podwójny)$/, (_m, kind) => `Rkp${kind === 'podwójny' ? 'd' : ''} ${kind}`],
];

/** Word abbreviations for the remaining long titles (EN). */
const WORDS: ReadonlyArray<[RegExp, string]> = [
  [/\bBalise Group\b/g, 'BG'],
  [/\bSwitchable\b/g, 'Switch.'],
  [/\bAnnouncement\b/g, 'Ann.'],
  [/\bTransition\b/g, 'Trans.'],
];

/** The caption of a palette tile with this title (the title when it already fits). */
export function shortPaletteCaption(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  // family rules apply to every member (consistent captions in a grid), abbreviations only to long titles
  for (const [re, rep] of RULES) {
    if (re.test(t)) return typeof rep === 'string' ? t.replace(re, rep) : t.replace(re, rep as (...m: string[]) => string);
  }
  let out = t;
  for (const [re, rep] of WORDS) {
    if (out.length <= CAPTION_MAX) break;
    out = out.replace(re, rep);
  }
  return out;
}

/** The entry with its short caption (only when it differs from the title). */
export function withShortCaption<T extends { title: string; caption?: string }>(entry: T): T {
  const caption = shortPaletteCaption(entry.title);
  return caption === entry.title ? entry : { ...entry, caption };
}
