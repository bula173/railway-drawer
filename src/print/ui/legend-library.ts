/**
 * @file legend-library.ts
 * @brief The library symbols the sheet legend names: the titled entries of the ERTMS library
 *        (public/libraries/ertms.xml), loaded once on first use (sheet overlay / exports).
 */
import { loadErtmsLibraryEntries } from '../../ui/drawio-palette/ertms-source';
import { libraryTitleIndex } from '../legend';
import { setLegendLibrary } from '../sheet-plan';

let loading: Promise<void> | null = null;

/** Loads the ERTMS library titles into the legend once (the legend then names its symbols). */
export function ensureLegendLibrary(): Promise<void> {
  loading ??= loadErtmsLibraryEntries()
    .then((entries) => setLegendLibrary(libraryTitleIndex(entries)))
    .catch((error: unknown) => {
      console.warn('[Print] The ERTMS library could not be loaded for the legend:', error);
      loading = null;
    });
  return loading;
}
