/**
 * @file index.ts
 * @brief draw.io-style palette sidebar for the maxGraph editor (public API).
 */
export type { LibraryEntry, PaletteDef, PaletteEngine, PaletteEntry, PaletteMeta } from './contracts';
export { fallbackEngine, fallbackParseMxLibrary } from './contracts';
export {
  createDrawioPaletteView,
  getDrawioPaletteEngine,
  getDrawioThumbnailRenderer,
  renderEntryForParity,
  resetDrawioPaletteRenderer,
  setDrawioPaletteEngine,
  EXPANDED_STORAGE_KEY,
  PALETTE_DRAG_TYPE,
  VISIBLE_STORAGE_KEY,
} from './drawio-palette-view';
export type {
  DrawioPaletteView,
  DrawioPaletteViewOptions,
  LazyPaletteSource,
  PaletteClickModifiers,
  PaletteMenuItem,
  PaletteSource,
} from './drawio-palette-view';
export {
  applyDrawioDefaultStyles,
  cellsFromModelXml,
  createCellsForEntry,
  insertEntry,
  wrapModelXml,
} from './entry-cells';
export { extractShapeNames, libraryToPaletteDef, LIBRARIES_STORAGE_KEY } from './library-adapter';
export type { LibraryMeta, StoredLibrary } from './library-adapter';
export {
  ertmsElementsPaletteDef,
  ertmsPaletteSource,
  loadErtmsLibraryEntries,
  loadErtmsTemplates,
  resetErtmsLibraryCache,
} from './ertms-source';
export { THUMB_BORDER, THUMB_SIZE, ThumbnailRenderer } from './thumbnail-renderer';
export {
  APP_BASIC_MERGE,
  APP_GROUPS_HIDDEN_KEY,
  appShapeEntry,
  entrySignature,
  MERGED_APP_GROUPS,
  MERGED_DRAWIO_PALETTES,
  MERGED_SECTION_ID,
  MERGED_SECTION_TITLE,
  mergeGeneralPalette,
  migrateMergedPaletteFlags,
  shapesTabPalettes,
} from './shapes-tab-palettes';
export type { AppShapeMerge } from './shapes-tab-palettes';
