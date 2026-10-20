/**
 * @file properties-state.ts
 * @brief The one place that decides what the Properties panel shows (index.html #property-content):
 *        `none` (nothing selected: the hint), `canvas` (the empty canvas was clicked: Canvas
 *        Properties) or `cell` (a selection: header naming it + the Text/Style/Arrange editor; the
 *        edge panel of EdgePropertiesController sits below it for connectors).
 */
import type { Cell, Graph } from '@maxgraph/core';
import { getKindDef, readObjectId } from '../railway/object-data';

export type PropertiesPanelState = 'none' | 'canvas' | 'cell';

function show(id: string, visible: boolean, display = 'block'): void {
  const node = document.getElementById(id);
  if (node) node.style.display = visible ? display : 'none';
}

/** Shows exactly one state of the shared Properties panel; `header` names the selection (cell state). */
export function setPropertiesPanelState(state: PropertiesPanelState, header = ''): void {
  const content = document.getElementById('property-content');
  if (content) content.dataset.state = state;
  show('prop-placeholder', state === 'none');
  show('canvas-props', state === 'canvas');
  show('prop-editor', state === 'cell', 'flex');
  if (state !== 'cell') show('edge-properties', false);
  const headerEl = document.getElementById('prop-selection-header');
  if (headerEl) {
    headerEl.hidden = state !== 'cell';
    headerEl.textContent = state === 'cell' ? header : '';
    if (state === 'cell') headerEl.title = header;
  }
}

/** Plain text of a (possibly HTML) label; DOMParser never runs scripts or loads images. */
function plainText(label: string): string {
  const text = /[<&]/.test(label) ? new DOMParser().parseFromString(label, 'text/html').body.textContent ?? '' : label;
  return text.replace(/\s+/g, ' ').trim();
}

const MAX_HEADER_LABEL = 40;

/**
 * Name of the selection for the panel header: a railway object as "<Kind> <ID>" ("Signal S1"),
 * otherwise its label, else "Shape" / "Group" / "Connector"; several cells: "3 shapes",
 * "2 connectors" or "4 items".
 */
export function selectionTitle(graph: Graph, cells: Cell[]): string {
  if (cells.length === 0) return '';
  if (cells.length > 1) {
    const edges = cells.filter((cell) => cell.isEdge()).length;
    if (edges === 0) return `${cells.length} shapes`;
    if (edges === cells.length) return `${cells.length} connectors`;
    return `${cells.length} items`;
  }
  const cell = cells[0];
  const kind = getKindDef(cell);
  if (kind) {
    const id = readObjectId(cell);
    return id ? `${kind.label} ${id}` : kind.label;
  }
  let label = '';
  try {
    label = plainText(String(graph.getLabel(cell) ?? ''));
  } catch {
    label = '';
  }
  if (label.length > MAX_HEADER_LABEL) label = `${label.slice(0, MAX_HEADER_LABEL - 1)}…`;
  if (label) return label;
  if (cell.isEdge()) return 'Connector';
  return cell.getChildCount() > 0 ? 'Group' : 'Shape';
}
