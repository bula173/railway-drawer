import { afterEach, describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import { StatusBarController } from '../../ui/statusbar';

const graphs: Graph[] = [];
afterEach(() => {
  graphs.splice(0).forEach((g) => g.destroy());
  document.body.replaceChildren();
});

function tabGraph(shown: boolean): Graph {
  const div = document.createElement('div');
  div.style.display = shown ? 'block' : 'none';
  document.body.appendChild(div);
  const graph = new Graph(div);
  graphs.push(graph);
  return graph;
}

describe('StatusBarController', () => {
  it('shows the selection count of the shown tab only, and syncs it on a tab switch', () => {
    const status = document.createElement('span');
    status.id = 'status-selected';
    status.textContent = '0';
    document.body.appendChild(status);
    const shown = tabGraph(true);
    const hidden = tabGraph(false);
    const shownBar = new StatusBarController(shown);
    const hiddenBar = new StatusBarController(hidden);
    const a = shown.insertVertex(shown.getDefaultParent(), null, 'a', 0, 0, 10, 10);
    const b = shown.insertVertex(shown.getDefaultParent(), null, 'b', 0, 0, 10, 10);
    shown.setSelectionCells([a, b]);
    expect(status.textContent).toBe('2');
    // a background tab (e.g. a script applied to it) does not overwrite the count
    const c = hidden.insertVertex(hidden.getDefaultParent(), null, 'c', 0, 0, 10, 10);
    hidden.setSelectionCells([c]);
    expect(status.textContent).toBe('2');
    // tab switch: TabManager calls syncSelection on the newly shown tab
    shown.container.style.display = 'none';
    hidden.container.style.display = 'block';
    hiddenBar.syncSelection();
    expect(status.textContent).toBe('1');
    shownBar.syncSelection(); // hidden now: no change
    expect(status.textContent).toBe('1');
  });
});
