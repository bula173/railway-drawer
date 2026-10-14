import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Cell, Graph } from '@maxgraph/core';
import { installDrawioCompat } from '../graph-compat';
import {
  formatDate,
  getGlobalVariable,
  installPlaceholders,
  isReplacePlaceholders,
  replacePlaceholders,
  setPlaceholderContext,
  setPlaceholderVariables,
  toUnit,
  UNITS,
} from '../placeholders';
import { installUserObjectLabels } from '../../../services/drawio-xml';
import { cellsFromModelXml } from '../../../ui/drawio-palette/entry-cells';
import misc from '../../palettes/data/misc.json';

let container: HTMLElement;
let graph: Graph;

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
});

afterEach(() => {
  graph?.destroy();
  container?.remove();
});

/** Graph set up as the app does (tabs.ts / thumbnail-renderer.ts). */
function newGraph(): Graph {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  installUserObjectLabels(graph);
  installDrawioCompat(graph);
  return graph;
}

function userObject(attrs: Record<string, string>, tag = 'UserObject'): Element {
  const el = document.implementation.createDocument(null, null, null).createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function addVertex(g: Graph, value: unknown, parent?: Cell, size: [number, number] = [80, 20]): Cell {
  let cell!: Cell;
  g.batchUpdate(() => {
    cell = g.insertVertex({ parent: parent ?? g.getDefaultParent(), value, position: [0, 0], size });
  });
  return cell;
}

// Thu Mar 7 2024 09:05:03.042 local time
const FIXED = new Date(2024, 2, 7, 9, 5, 3, 42);

describe('formatDate (Graph.prototype.formatDate)', () => {
  it('formats draw.io masks', () => {
    expect(formatDate(FIXED, 'ddd mmm dd yyyy HH:MM:ss')).toBe('Thu Mar 07 2024 09:05:03');
    expect(formatDate(FIXED, 'dddd, mmmm d, yyyy')).toBe('Thursday, March 7, 2024');
    expect(formatDate(FIXED, 'isoDate')).toBe('2024-03-07');
    expect(formatDate(FIXED, 'shortTime')).toBe('9:05 AM');
    expect(formatDate(FIXED, 'h:MM:ss tt l')).toBe('9:05:03 am 042');
    expect(formatDate(FIXED, 'dS mmm yy')).toBe('7th Mar 24');
    expect(formatDate(FIXED, "yyyy'T'HH")).toBe('2024T09');
    expect(formatDate(FIXED)).toBe('Thu Mar 07 2024 09:05:03');
  });

  it('supports UTC and ordinal suffixes', () => {
    const d = new Date(Date.UTC(2024, 0, 22, 23, 0, 0));
    expect(formatDate(d, 'UTC:yyyy-mm-dd HH:MM Z')).toBe('2024-01-22 23:00 UTC');
    expect(formatDate(new Date(2024, 0, 1), 'dS')).toBe('1st');
    expect(formatDate(new Date(2024, 0, 2), 'dS')).toBe('2nd');
    expect(formatDate(new Date(2024, 0, 11), 'dS')).toBe('11th');
    expect(formatDate(new Date(2024, 0, 23), 'dS')).toBe('23rd');
  });

  it('throws for invalid dates', () => {
    expect(() => formatDate('not a date', 'yyyy')).toThrow(SyntaxError);
  });
});

describe('toUnit (Editor.toUnit)', () => {
  it('converts pixels', () => {
    expect(toUnit(100, UNITS.INCHES)).toBe(1);
    expect(toUnit(39.37, UNITS.MILLIMETERS)).toBe(10);
    expect(toUnit(39.37, UNITS.CENTIMETERS)).toBe(1);
    expect(toUnit(3937, UNITS.METERS)).toBe(1);
    expect(toUnit(12.34, undefined)).toBe(12.3);
  });
});

describe('replacePlaceholders', () => {
  it('replaces %name% from the cell and its ancestors, %id%, sizes and escapes', () => {
    const g = newGraph();
    const parent = addVertex(g, userObject({ label: 'group', owner: 'Ops', name: 'outer' }), undefined, [200, 100]);
    const child = addVertex(g, userObject({ label: '', placeholders: '1', name: 'inner' }), parent, [120, 40]);
    child.setId('c1');
    const r = (s: string) => replacePlaceholders(g, child, s);
    expect(r('%name% of %owner%')).toBe('inner of Ops');
    expect(r('%id% %width%x%height%')).toBe('c1 120x40');
    expect(r('%width_in% in')).toBe('1.2 in');
    expect(r('%missing% stays')).toBe('%missing% stays');
    expect(r('%%name% literal')).toBe('%name% literal');
    expect(r('%label% %tooltip%')).toBe('%label% %tooltip%');
    expect(r('page %pagenumber% of %pagecount%, next %pagenumber+1%')).toBe('page 1 of 1, next 2');
  });

  it('uses the page context and custom variables', () => {
    const g = newGraph();
    const cell = addVertex(g, userObject({ label: '', placeholders: '1' }));
    setPlaceholderContext(g, { page: () => 'Layout', pageNumber: () => 2, pageCount: () => 3, filename: () => 'line.drawio', now: () => FIXED });
    setPlaceholderVariables(g, { project: 'ETCS L2' });
    expect(replacePlaceholders(g, cell, '%page% %pagenumber%/%pagecount% %filename% %project% %pagecount-1%')).toBe(
      'Layout 2/3 line.drawio ETCS L2 2'
    );
    expect(replacePlaceholders(g, cell, '%date{isoDate}%')).toBe('2024-03-07');
    expect(getGlobalVariable('date', g)).toBe(FIXED.toLocaleDateString());
    expect(getGlobalVariable('timestamp', g)).toBe(FIXED.toLocaleString());
  });
});

describe('installPlaceholders', () => {
  it('is installed by installDrawioCompat and replaces labels in getLabel only', () => {
    const g = newGraph();
    setPlaceholderContext(g, { now: () => FIXED });
    const cell = addVertex(g, userObject({ label: '%name% Text', placeholders: '1', name: 'Variable' }));
    expect(isReplacePlaceholders(cell)).toBe(true);
    expect(g.getLabel(cell)).toBe('Variable Text');
    // Editing shows the raw label, as in draw.io
    expect(g.convertValueToString(cell)).toBe('%name% Text');
  });

  it('leaves labels of cells without placeholders=1 alone', () => {
    const g = newGraph();
    const cell = addVertex(g, userObject({ label: '%name%', name: 'x' }));
    expect(isReplacePlaceholders(cell)).toBe(false);
    expect(g.getLabel(cell)).toBe('%name%');
    expect(isReplacePlaceholders(addVertex(g, 'plain %id%'))).toBe(false);
  });

  it('takes the label from the `placeholder` attribute', () => {
    const g = newGraph();
    const parent = addVertex(g, userObject({ label: '', title: 'From parent' }), undefined, [200, 100]);
    const cell = addVertex(g, userObject({ label: 'ignored', placeholders: '1', placeholder: 'title' }), parent);
    expect(g.getLabel(cell)).toBe('From parent');
  });

  it('renders the draw.io "Timestamp" palette entry (misc-8) with the formatted date', () => {
    const g = newGraph();
    installPlaceholders(g, { now: () => FIXED });
    const ts = (misc as unknown as { entries: { id: string; xml: string }[] }).entries.find((e) => e.id === 'misc-8-timestamp');
    expect(ts).toBeTruthy();
    const cells = cellsFromModelXml(ts!.xml);
    g.batchUpdate(() => {
      g.addCells(cells, g.getDefaultParent(), null, null, null);
    });
    expect(g.getLabel(cells[0])).toBe('Thu Mar 07 2024 09:05:03');
  });
});
