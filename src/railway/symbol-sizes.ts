/**
 * @file symbol-sizes.ts
 * @brief The symbol size standard (symbol-sizes.json; docs/architecture/symbol-sizes.md): one
 *        default box per symbol class (every signal one box, every board on a post one box, one
 *        size per balise / axle counter / joint / LEU / RBC / buffer stop / level crossing / km post,
 *        trains one height, one stroke width for tracks and points legs). The library generators
 *        (scripts/ertms-library, scripts/railway-libraries) read the same JSON; the schematic
 *        builder, the train run and Arrange > Normalize Symbol Sizes use it here. Existing drawings
 *        are never resized on open: the standard is the default for new symbols.
 */
import type { KindId } from './catalogue';
import standard from './symbol-sizes.json';

export interface Size {
  w: number;
  h: number;
}

export const SYMBOL_SIZES = standard;

/** Symbol classes of the standard (a board on a post: ETCS marker boards, Ne / W boards, ...). */
export type SymbolClass =
  | 'signal'
  | 'board'
  | 'balise'
  | 'axleCounter'
  | 'insulatedJoint'
  | 'leu'
  | 'rbc'
  | 'bufferStop'
  | 'levelCrossing'
  | 'train';

/** Signal types drawn as a board on a post (the board box), not as a signal with lamps. */
export const BOARD_SIGNAL_TYPES: ReadonlySet<string> = new Set(['markerBoard', 'etcsStopMarker']);

/** The standard class of a railway object (null: no standard box, e.g. tracks, balise groups). */
export function symbolClassOf(kind: KindId | null | undefined, signalType = ''): SymbolClass | null {
  switch (kind) {
    case 'signal':
      return BOARD_SIGNAL_TYPES.has(signalType) ? 'board' : 'signal';
    case 'balise':
    case 'axleCounter':
    case 'insulatedJoint':
    case 'leu':
    case 'rbc':
    case 'bufferStop':
    case 'levelCrossing':
    case 'train':
      return kind;
    default:
      return null;
  }
}

/** Default box of a class (a train: the default width at the standard height). */
export function standardSize(cls: SymbolClass): Size {
  const s = standard[cls] as { w: number; h: number };
  return { w: s.w, h: s.h };
}

/**
 * Width/height a symbol of `cls` drawn `current` gets from the standard: the class box, for a
 * train the standard height with its drawn aspect (even width, as the generators).
 */
export function normalisedSize(cls: SymbolClass, current: Size): Size {
  if (cls === 'train') {
    const h = standard.train.h;
    if (!(current.w > 0 && current.h > 0)) return standardSize('train');
    return { w: 2 * Math.round((current.w * h) / current.h / 2), h };
  }
  return standardSize(cls);
}

/** Stroke width of tracks and points legs in every library. */
export const LINE_STROKE_WIDTH = standard.line.strokeWidth;
