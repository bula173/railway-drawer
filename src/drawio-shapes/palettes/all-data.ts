/**
 * Lazy loaders of every generated palette file (src/drawio-shapes/palettes/data/*.json, one chunk
 * each). Kept out of index.ts: the map of 504 chunk imports is itself ~50 kB of code, so it is only
 * loaded when a draw.io library beyond the built-in palettes is opened or searched.
 */
const DATA_FILES = import.meta.glob<{ default: unknown }>(['./data/*.json', '!./data/catalogue.json', '!./data/search-index.json']);

/** The loader of `data/<file>.json`, or null when there is no such palette file. */
export function paletteDataLoader(file: string): (() => Promise<{ default: unknown }>) | null {
  return DATA_FILES[`./data/${file}.json`] ?? null;
}
