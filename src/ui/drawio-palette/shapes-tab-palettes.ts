/**
 * @file shapes-tab-palettes.ts
 * @brief The palette list of the Shapes tab: draw.io's palettes in draw.io order, with draw.io's
 *        "Basic" palette and the app's own "Basic" shape group merged into one "General" section.
 *
 * Merged "General" = draw.io General (draw.io order), then the draw.io Basic entries whose cell
 * is not already in General, then the app Basic shapes (src/shapes/basic) that have no draw.io
 * equivalent. App shapes with an equivalent draw.io entry are not listed (see APP_BASIC_MERGE);
 * where that entry lives in another palette (Advanced, Misc), a copy of it is appended so the
 * shape stays in the section, inserted with the draw.io style. The app shape registrations stay:
 * old files using them still load and render (and keep their `rdShape` round trip).
 */
import { loadPalette, PALETTES } from '../../drawio-shapes/palettes';
import type { DrawioPaletteId } from '../../drawio-shapes/palettes';
import { styleToString } from '../../services/drawio-xml';
import type { ShapeConfig } from '../../shapes/registry';
import type { PaletteDef, PaletteEntry } from './contracts';
import { EXPANDED_STORAGE_KEY, VISIBLE_STORAGE_KEY } from './drawio-palette-view';
import { entrySignature } from './entry-cells';
import type { LazyPaletteSource } from './drawio-palette-view';
import { safeStorage } from './library-adapter';

export { entrySignature };

/** Id and title of the merged section (draw.io's first, default-open palette). */
export const MERGED_SECTION_ID = 'general';
export const MERGED_SECTION_TITLE = 'General';
/** draw.io palettes shown inside the merged section instead of as their own section. */
export const MERGED_DRAWIO_PALETTES: readonly DrawioPaletteId[] = ['basic'];
/** App shape groups (shapeRegistry) shown inside the merged section instead of their own group. */
export const MERGED_APP_GROUPS: readonly string[] = ['Basic'];
/** localStorage key of the hidden app shape groups (array of group names). */
export const APP_GROUPS_HIDDEN_KEY = 'railway-drawer-hidden-shape-groups';

/**
 * How an app Basic shape (by ShapeConfig id) relates to the draw.io palettes, compared by the
 * rendered shape. `duplicate`: the merged section already has this draw.io cell (the app shape
 * is not listed). `native`: draw.io has it in another palette; a copy of that entry is appended.
 * App shapes not listed here have no draw.io equivalent and are appended as app shapes.
 */
export type AppShapeMerge =
  | { kind: 'duplicate'; palette: DrawioPaletteId; style: string }
  | { kind: 'native'; palette: DrawioPaletteId; style: string };

const dup = (palette: DrawioPaletteId, style: string): AppShapeMerge => ({ kind: 'duplicate', palette, style });

export const APP_BASIC_MERGE: Readonly<Record<string, AppShapeMerge>> = {
  rectangle: dup('general', 'rounded=0;whiteSpace=wrap;html=1;'),
  rounded_rectangle: dup('general', 'rounded=1;whiteSpace=wrap;html=1;roundedPerimeter=1;'),
  circle: dup('general', 'ellipse;whiteSpace=wrap;html=1;shapeInside=1;aspect=fixed;'),
  ellipse: dup('general', 'ellipse;whiteSpace=wrap;html=1;shapeInside=1;'),
  oval: dup('general', 'ellipse;whiteSpace=wrap;html=1;shapeInside=1;'),
  diamond: dup('general', 'rhombus;whiteSpace=wrap;html=1;shapeInside=1;'),
  lozenge: dup('general', 'rhombus;whiteSpace=wrap;html=1;shapeInside=1;'),
  triangle: dup('general', 'triangle;whiteSpace=wrap;html=1;shapeInside=1;'),
  hexagon: dup('general', 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;shapeInside=1;fixedSize=1;'),
  trapezoid: dup('general', 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;shapeInside=1;fixedSize=1;'),
  cylinder: dup('general', 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;'),
  pentagon: dup('basic', 'whiteSpace=wrap;html=1;shape=mxgraph.basic.pentagon'),
  star: dup('basic', 'verticalLabelPosition=bottom;verticalAlign=top;html=1;shape=mxgraph.basic.star'),
  // right and bottom edges only
  right_angle: dup('basic', 'shape=partialRectangle;whiteSpace=wrap;html=1;top=0;left=0;fillColor=none;'),
  cross: { kind: 'native', palette: 'advanced', style: 'shape=cross;whiteSpace=wrap;html=1;' },
  line: { kind: 'native', palette: 'misc', style: 'line;strokeWidth=2;html=1;' },
};

function mergedEntryId(suffix: string): string {
  return `${MERGED_SECTION_ID}-app-${suffix.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

/**
 * Titles of appended app shapes whose app label names a different draw.io shape (draw.io's
 * "Double Rectangle" in Advanced has a double border; the app's has a centre line).
 */
const APP_ENTRY_TITLES: Readonly<Record<string, string>> = {
  double_rectangle: 'Divided Rectangle',
};

/** Palette entry for an app shape (inserted with the app style, as the old app shape group did). */
export function appShapeEntry(shape: ShapeConfig): PaletteEntry {
  const shapeName = typeof shape.style.shape === 'string' ? shape.style.shape : '';
  return {
    id: mergedEntryId(shape.id),
    title: APP_ENTRY_TITLES[shape.id] ?? shape.label,
    tags: `${shape.label} ${shape.id.replace(/_/g, ' ')} railway drawer`.toLowerCase(),
    kind: 'vertex',
    width: shape.width,
    height: shape.height,
    style: styleToString(shape.style),
    shapeNames: shapeName ? [shapeName] : [],
    cls: 'd',
    source: 'src/shapes/basic/registry.ts',
  };
}

/** draw.io palettes (besides General and Basic) the merge copies entries from. */
export function nativeSourcePalettes(): DrawioPaletteId[] {
  const out: DrawioPaletteId[] = [];
  for (const m of Object.values(APP_BASIC_MERGE)) {
    if (m.kind === 'native' && !out.includes(m.palette)) out.push(m.palette);
  }
  return out;
}

/**
 * The merged "General" section. `defs` holds the loaded draw.io palettes by id (general, basic
 * and the `nativeSourcePalettes()`); `appShapes` the app's Basic group shapes.
 */
export function mergeGeneralPalette(
  defs: Partial<Record<DrawioPaletteId, PaletteDef>>,
  appShapes: readonly ShapeConfig[],
): PaletteDef {
  const general = defs.general;
  if (!general) throw new Error('mergeGeneralPalette: the draw.io General palette is required');
  const entries: PaletteEntry[] = [];
  const seen = new Set<string>();
  const add = (entry: PaletteEntry): boolean => {
    const sig = entrySignature(entry);
    if (seen.has(sig)) return false;
    seen.add(sig);
    entries.push(entry);
    return true;
  };
  for (const entry of general.entries) add(entry);
  for (const id of MERGED_DRAWIO_PALETTES) for (const entry of defs[id]?.entries ?? []) add(entry);

  const listedStyles = new Set(entries.map((e) => e.style).filter((s): s is string => !!s));
  for (const shape of appShapes) {
    const merge = APP_BASIC_MERGE[shape.id];
    if (merge?.kind === 'duplicate' && listedStyles.has(merge.style)) continue;
    if (merge?.kind === 'native') {
      const source = defs[merge.palette]?.entries.find((e) => e.style === merge.style);
      if (source) {
        add({ ...source, id: mergedEntryId(shape.id) });
        continue;
      }
    }
    // no draw.io equivalent (or its palette data changed): keep the app shape
    add(appShapeEntry(shape));
  }

  const sources = [general, ...MERGED_DRAWIO_PALETTES.map((id) => defs[id])].filter((d): d is PaletteDef => !!d);
  return {
    id: MERGED_SECTION_ID,
    title: MERGED_SECTION_TITLE,
    drawioTag: general.drawioTag,
    source: sources.map((d) => d.source).join(' + '),
    entries,
  };
}

/**
 * The Shapes tab palettes: PALETTES in draw.io order without the merged ones, General replaced
 * by the merged section. `appShapes` is read when the section loads.
 */
export function shapesTabPalettes(
  appShapes: () => readonly ShapeConfig[],
  load: (id: string) => Promise<PaletteDef> = loadPalette,
): LazyPaletteSource[] {
  return PALETTES.filter((meta) => !(MERGED_DRAWIO_PALETTES as readonly string[]).includes(meta.id)).map((meta) => {
    if (meta.id !== MERGED_SECTION_ID) return { ...meta, load: () => load(meta.id) };
    const ids: DrawioPaletteId[] = ['general', ...MERGED_DRAWIO_PALETTES, ...nativeSourcePalettes()];
    return {
      ...meta,
      title: MERGED_SECTION_TITLE,
      load: async () => {
        const loaded = await Promise.all(ids.map((id) => load(id)));
        const defs: Partial<Record<DrawioPaletteId, PaletteDef>> = {};
        ids.forEach((id, i) => (defs[id] = loaded[i]));
        return mergeGeneralPalette(defs, appShapes());
      },
    };
  });
}

function readJson(storage: Storage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function asFlags(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Moves stored show/hide and expanded flags of the merged palettes and app groups onto the merged
 * section: it is shown when General, draw.io Basic or the app Basic group was shown (all default
 * to shown), and expanded when General was (default) or Basic was expanded. Runs before the
 * Shapes tab is built; idempotent (the old flags are removed).
 */
export function migrateMergedPaletteFlags(storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    const visible = asFlags(readJson(storage, VISIBLE_STORAGE_KEY)) ?? {};
    const expanded = asFlags(readJson(storage, EXPANDED_STORAGE_KEY)) ?? {};
    const hiddenRaw = readJson(storage, APP_GROUPS_HIDDEN_KEY);
    const hidden = Array.isArray(hiddenRaw) ? hiddenRaw.filter((x): x is string => typeof x === 'string') : [];
    const mergedIds = MERGED_DRAWIO_PALETTES as readonly string[];

    const oldVisible = mergedIds.filter((id) => id in visible);
    const oldHidden = hidden.filter((g) => MERGED_APP_GROUPS.includes(g));
    if (oldVisible.length > 0 || oldHidden.length > 0) {
      const shown = (v: unknown): boolean => v !== false;
      const anyShown =
        shown(visible[MERGED_SECTION_ID]) ||
        mergedIds.some((id) => shown(visible[id])) ||
        MERGED_APP_GROUPS.some((g) => !hidden.includes(g));
      for (const id of oldVisible) delete visible[id];
      if (anyShown) delete visible[MERGED_SECTION_ID];
      else visible[MERGED_SECTION_ID] = false;
      storage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify(visible));
      if (oldHidden.length > 0) {
        storage.setItem(APP_GROUPS_HIDDEN_KEY, JSON.stringify(hidden.filter((g) => !oldHidden.includes(g))));
      }
    }

    const oldExpanded = mergedIds.filter((id) => id in expanded);
    if (oldExpanded.length > 0) {
      if (oldExpanded.some((id) => expanded[id] === true)) expanded[MERGED_SECTION_ID] = true;
      for (const id of oldExpanded) delete expanded[id];
      storage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expanded));
    }
  } catch {
    // storage blocked or full: the defaults apply
  }
}
