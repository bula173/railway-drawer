/**
 * @file view-internals.ts
 * @brief What the lazily loaded parts of the palette view (More shapes dialog, search over all
 *        draw.io libraries, user library actions) may use of the view.
 */
import type { PaletteCatalogue, PaletteEntry } from '../../drawio-shapes/palettes';

export interface PaletteViewInternals {
  /** The draw.io catalogue (null until loaded or without a catalogue). */
  catalogue: PaletteCatalogue | null;
  isLibraryVisible(libraryId: string): boolean;
  setLibraryVisible(libraryId: string, visible: boolean): void;
  isPaletteVisible(paletteId: string): boolean;
  /** Ids of the catalogue sections of a library (empty when other sections stand for it). */
  libraryPalettes(libraryId: string): string[];
  /** Loads a palette section's entries (also for hidden sections). */
  loadEntries(paletteId: string): Promise<PaletteEntry[]>;
  /** A palette tile (click/drag/preview like the section tiles); null for an unknown palette. */
  createTile(paletteId: string, entry: PaletteEntry): HTMLElement | null;
  thumbnail(entry: PaletteEntry, size?: number): Promise<SVGSVGElement>;
  /** Signatures of the entries the visible sections currently show (search dedupe). */
  shownSignatures(): Set<string>;
  /** Shows the palette's library and opens and scrolls to the palette. */
  revealPalette(paletteId: string): void;
}
