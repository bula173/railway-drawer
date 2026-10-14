import { Graph, type Cell, type CellStyle } from '@maxgraph/core';

/** jsdom has no SVG layout: give every SVG element an empty getBBox so maxGraph can measure. */
export function stubGetBBox(): void {
  const proto = (window as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;

  if (typeof proto.getBBox !== 'function') {
    proto.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  }
}

export function createGraph(): { graph: Graph; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const graph = new Graph(container);

  return { graph, container };
}

export function insert(graph: Graph, style: Record<string, unknown>, w = 120, h = 80, x = 0, y = 0): Cell {
  const parent = graph.getDefaultParent();
  let cell!: Cell;

  graph.batchUpdate(() => {
    cell = graph.insertVertex(parent, null, '', x, y, w, h, style as CellStyle);
  });

  return cell;
}

/** All drawing elements (path, ellipse, rect) of the cell's shape node, in document order. */
export function shapeElements(graph: Graph, cell: Cell): Element[] {
  const state = graph.view.getState(cell);
  const node = state?.shape?.node;

  if (!node) return [];

  return Array.from(node.querySelectorAll('path, ellipse, rect')).filter(
    // the transparent hit-detection rectangle and the hidden stroke-tolerance copies of
    // stroke-only paths that maxGraph adds for event handling
    (el) =>
      !(el.tagName === 'rect' && el.getAttribute('fill') === 'transparent') &&
      el.getAttribute('visibility') !== 'hidden'
  );
}

export function paths(graph: Graph, cell: Cell): string[] {
  return shapeElements(graph, cell)
    .filter((el) => el.tagName === 'path')
    .map((el) => el.getAttribute('d') ?? '');
}

export interface PathCommand {
  cmd: string;
  args: number[];
}

/** Parses SVG path data into commands with numeric arguments. */
export function parsePath(d: string): PathCommand[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const result: PathCommand[] = [];

  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      result.push({ cmd: t, args: [] });
    } else if (result.length > 0) {
      result[result.length - 1].args.push(parseFloat(t));
    }
  }

  return result;
}

/** Command letters of a path, e.g. 'MLLLZ'. */
export function commandString(d: string): string {
  return parsePath(d)
    .map((c) => c.cmd)
    .join('');
}

/** End point of every command (the last x/y pair), Z has none. */
export function endPoints(d: string): Array<[number, number] | null> {
  return parsePath(d).map((c) => (c.args.length >= 2 ? [c.args[c.args.length - 2], c.args[c.args.length - 1]] : null));
}
