/**
 * @file entry-cells.ts
 * @brief Builds maxGraph cells for palette entries and inserts them into a graph, as draw.io's
 *        Sidebar does (createVertexTemplate / createEdgeTemplate / createVertexTemplateFromData).
 *
 * Styles are parsed with the draw.io-preserving parser of `services/drawio-xml.ts`, so a save
 * writes back exactly the palette's style string. Composite entries are decoded with the same
 * importer the file loader uses.
 */
import { Cell, Geometry, GraphDataModel, Point } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import { copyRawDrawioStyle, importDrawioXmlIntoModel, parseDrawioStyle } from '../../services/drawio-xml';
import type { PaletteEntry } from './contracts';
import { dropCellsIntoContainerAt } from '../../drawio-shapes/behaviour';

/** Wraps bare `<root>` / `<mxCell>` fragments into an `<mxGraphModel>`. */
export function wrapModelXml(xml: string): string {
  const body = xml.trim().replace(/^<\?xml[^>]*\?>\s*/, '');
  if (/^<mxGraphModel[\s>/]/.test(body)) return body;
  if (/^<root[\s>/]/.test(body)) return `<mxGraphModel>${body}</mxGraphModel>`;
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel>`;
}

/** Top-level cells of a model XML (the children of its first layer). Throws on invalid XML. */
export function cellsFromModelXml(xml: string): Cell[] {
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(wrapModelXml(xml), model);
  const root = model.getRoot();
  const layer = root?.getChildAt(0);
  if (!layer) return [];
  const cells = [...(layer.children ?? [])];
  for (const cell of cells) cell.setParent(null);
  return cells;
}

/**
 * New cells for an entry (not part of any model). Vertices and edges follow draw.io's
 * createVertexTemplate / createEdgeTemplate; `cells` entries decode `entry.xml`.
 */
export function createCellsForEntry(entry: PaletteEntry): Cell[] {
  if (entry.kind === 'cells' || (entry.xml && entry.kind !== 'edge' && !entry.style)) {
    if (!entry.xml) return [];
    return cellsFromModelXml(entry.xml);
  }
  const style = parseDrawioStyle(entry.style ?? '');
  const cell = new Cell(entry.value ?? '', new Geometry(0, 0, entry.width, entry.height), style);
  if (entry.kind === 'edge') {
    const geo = cell.getGeometry()!;
    geo.setTerminalPoint(new Point(0, entry.height), true);
    geo.setTerminalPoint(new Point(entry.width, 0), false);
    geo.relative = true;
    cell.setEdge(true);
  } else {
    cell.setVertex(true);
  }
  return [cell];
}

/** Every style string of an entry, for stencil preloading. */
export function entryStyles(entry: PaletteEntry): string[] {
  const styles: string[] = [];
  if (entry.style) styles.push(entry.style);
  if (entry.xml) {
    const re = /\sstyle="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(entry.xml)) !== null) styles.push(decodeXmlAttr(m[1]));
  }
  for (const name of entry.shapeNames ?? []) styles.push(`shape=${name};`);
  return styles;
}

function decodeXmlAttr(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/** Point in graph coordinates at the centre of the visible part of the graph. */
export function getViewCenter(graph: Graph): { x: number; y: number } {
  const container = graph.container;
  const { scale, translate } = graph.view;
  const cx = (container?.scrollLeft ?? 0) + (container?.clientWidth ?? 0) / 2;
  const cy = (container?.scrollTop ?? 0) + (container?.clientHeight ?? 0) / 2;
  return { x: cx / scale - translate.x, y: cy / scale - translate.y };
}

/**
 * graph.cloneCells, plus the connections between the cloned cells: maxGraph 0.10's clone
 * mapping loses edge terminals of cells that come from another model.
 */
export function cloneWithTerminals(graph: Graph, cells: Cell[]): Cell[] {
  const clones = graph.cloneCells(cells, true);
  if (clones.length !== cells.length) return clones;
  const map = new Map<Cell, Cell>();
  const pair = (original: Cell, clone: Cell): void => {
    map.set(original, clone);
    // keeps the draw.io style string, so a save writes it back verbatim
    copyRawDrawioStyle(original.getStyle(), clone.getStyle());
    const a = original.children ?? [];
    const b = clone.children ?? [];
    for (let i = 0; i < a.length && i < b.length; i++) pair(a[i], b[i]);
  };
  cells.forEach((cell, i) => pair(cell, clones[i]));
  for (const [original, clone] of map) {
    if (!original.isEdge()) continue;
    for (const isSource of [true, false]) {
      const terminal = original.getTerminal(isSource);
      const mapped = terminal ? map.get(terminal) : undefined;
      if (mapped && clone.getTerminal(isSource) !== mapped) mapped.insertEdge(clone, isSource);
    }
  }
  return clones;
}

/**
 * Inserts an entry centred on `at` (graph coordinates; default: the view centre) as one
 * undoable edit, selects and returns the inserted cells.
 */
export function insertEntry(graph: Graph, entry: PaletteEntry, at?: { x: number; y: number }): Cell[] {
  const cells = createCellsForEntry(entry);
  if (cells.length === 0) return [];
  const bounds = graph.getBoundingBoxFromGeometry(cells, true);
  const bx = bounds?.x ?? 0;
  const by = bounds?.y ?? 0;
  const bw = bounds?.width ?? entry.width;
  const bh = bounds?.height ?? entry.height;
  const target = at ?? getViewCenter(graph);
  const x = graph.snap(target.x - bw / 2);
  const y = graph.snap(target.y - bh / 2);

  // Like draw.io's drop handler (importCells), but dangling edges are kept: maxGraph's
  // importCells clones with isCloneInvalidEdges() and drops edges without terminals.
  const clones = cloneWithTerminals(graph, cells);
  for (const clone of clones) clone.getGeometry()?.translate(x - bx, y - by);

  let inserted: Cell[] = [];
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    inserted = graph.addCells(clones, graph.getDefaultParent(), null, null, null);
    // Dropped onto a container/List: move into it at the drop position, like draw.io
    if (at) inserted = dropCellsIntoContainerAt(graph, inserted, target.x, target.y);
  } finally {
    model.endUpdate();
  }
  if (inserted.length > 0) graph.setSelectionCells(inserted);
  return inserted;
}

/**
 * draw.io's default vertex/edge styles (styles/default.xml, light theme), so cells without
 * explicit colours look as in draw.io. Shared with the tab graphs (services/drawio-xml.ts).
 */
export { applyDrawioDefaultStyles } from '../../services/drawio-xml';
