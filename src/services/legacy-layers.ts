/**
 * @file legacy-layers.ts
 * @brief One-time migration of the old app-only layers into real draw.io layers.
 *
 * Earlier versions kept their own layers outside the model: every vertex carried its layer id as
 * the style key `rdLayerId` (`cell.__layerId` after the import, see drawio-xml.ts), all cells sat
 * in the model's one real layer, and the layer list itself (names, visibility, lock) only lived in
 * memory (src/ui/layers.ts before the real-layers panel; never in the file or the tab cache). The
 * ids were `layer-0` (the default "Layer 1") and `layer-<Date.now()>` for each added layer, named
 * `Layer <n>` in creation order; hiding a layer set `visible=0` on its cells.
 *
 * Such a model (one real layer, cells with `rdLayerId`) is turned into draw.io layers: the first
 * old layer stays the existing layer, every further one becomes a new root child (`Layer <n>`, the
 * old default names in creation order, its old id when free), the top-level cells move into their
 * layer in their z-order, edges (they never had an id) go with their source/target, a layer whose
 * cells were all hidden becomes a hidden layer with visible cells, and `rdLayerId` is dropped from
 * every cell. Models without `rdLayerId`, or with real layers already, are not touched.
 */
import { Cell, type GraphDataModel } from '@maxgraph/core';

type LayeredCell = Cell & { __layerId?: unknown };

/** What a migration did (null from migrateLegacyLayers: nothing to do). */
export interface LegacyLayerMigration {
  /** Old layers found (1: only the attribute was dropped). */
  layers: number;
  /** Real layers added to the model. */
  createdLayers: number;
  /** Cells that carried `rdLayerId`. */
  cells: number;
}

function layerIdOf(cell: Cell): string | null {
  const id = (cell as LayeredCell).__layerId;
  return id === undefined || id === null || id === '' ? null : String(id);
}

/** Old layers in creation order: `layer-0`, then `layer-<timestamp>` by time, then any other id. */
function orderLayerIds(idsInModelOrder: string[]): string[] {
  const rank = (id: string): [number, number] => {
    if (id === 'layer-0') return [0, 0];
    const m = /^layer-(\d+)$/.exec(id);
    return m ? [1, Number(m[1])] : [2, idsInModelOrder.indexOf(id)];
  };
  return [...idsInModelOrder].sort((a, b) => {
    const [ga, na] = rank(a);
    const [gb, nb] = rank(b);
    return ga - gb || na - nb;
  });
}

function descendants(cell: Cell, out: Cell[] = []): Cell[] {
  for (const child of cell.children ?? []) {
    out.push(child);
    descendants(child, out);
  }
  return out;
}

/** The child of `layer` that contains `cell` (the cell itself when it is one). */
function topOf(cell: Cell | null, layer: Cell): Cell | null {
  for (let c = cell; c; c = c.getParent()) if (c.getParent() === layer) return c;
  return null;
}

/**
 * Migrates `model` in place (see the file comment). Run on a freshly decoded model (before it is
 * shown): the changes go through the model, but the load clears the undo history anyway.
 * @returns what was done, or null when the model needs no migration
 */
export function migrateLegacyLayers(model: GraphDataModel): LegacyLayerMigration | null {
  const root = model.getRoot();
  const layers = root?.children ?? [];
  if (!root || layers.length !== 1) return null;
  const base = layers[0];
  const all = descendants(base);
  const tagged = all.filter((cell) => layerIdOf(cell) !== null);
  if (tagged.length === 0) return null;

  const tops = [...(base.children ?? [])];
  const firstSeen: string[] = [];
  for (const cell of all) {
    const id = layerIdOf(cell);
    if (id !== null && !firstSeen.includes(id)) firstSeen.push(id);
  }
  const ordered = orderLayerIds(firstSeen);
  const defaultId = ordered[0];

  // Old layer of each top-level cell: its own id, else (a group's) the first id among its parts,
  // else (edges, untagged vertices: the old default layer) the layer of a terminal
  const layerOfTop = new Map<Cell, string>();
  for (const top of tops) {
    const own = layerIdOf(top) ?? descendants(top).map(layerIdOf).find((id) => id !== null) ?? null;
    if (own !== null) layerOfTop.set(top, own);
  }
  for (const top of tops) {
    if (layerOfTop.has(top)) continue;
    let id: string | undefined;
    if (top.isEdge()) {
      for (const terminal of [top.getTerminal(true), top.getTerminal(false)]) {
        const t = topOf(terminal, base);
        if (t && layerOfTop.has(t)) {
          id = layerOfTop.get(t);
          break;
        }
      }
    }
    layerOfTop.set(top, id ?? defaultId);
  }

  let createdLayers = 0;
  model.batchUpdate(() => {
    const target = new Map<string, Cell>([[defaultId, base]]);
    ordered.slice(1).forEach((oldId, i) => {
      const layer = new Cell(`Layer ${i + 2}`);
      if (!model.getCell(oldId)) layer.setId(oldId);
      model.add(root, layer, root.getChildCount());
      target.set(oldId, layer);
      createdLayers++;
    });
    if (createdLayers > 0) {
      // Top-level cells in their z-order (children of groups move with the group)
      for (const top of tops) {
        const layer = target.get(layerOfTop.get(top) ?? defaultId) ?? base;
        if (layer !== base) model.add(layer, top, layer.getChildCount());
      }
      // A layer whose cells were all hidden (the old eye) is a hidden layer now
      for (const layer of target.values()) {
        const cells = layer.children ?? [];
        if (cells.length > 0 && cells.every((cell) => !cell.isVisible())) {
          for (const cell of cells) model.setVisible(cell, true);
          model.setVisible(layer, false);
        }
      }
    }
  });
  for (const cell of tagged) delete (cell as LayeredCell).__layerId;
  return { layers: ordered.length, createdLayers, cells: tagged.length };
}
