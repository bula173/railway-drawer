/**
 * @file legacy-layers.test.ts
 * @brief The one-time migration of the old app-only layers (`rdLayerId` on cells, one real layer)
 *        into draw.io layers, on the File > Open path (SaveLoadController.loadProjectXml).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GraphDataModel } from '@maxgraph/core';
import type { Cell, Graph } from '@maxgraph/core';
import { importModelXml, registerDrawioCodecs, registerDrawioNamedStyles, installUserObjectLabels } from '../drawio-xml';
import { migrateLegacyLayers } from '../legacy-layers';
import { createTabDocument, SaveLoadController } from '../../ui/saveload';
import { globalSaveStatusIndicator } from '../../ui/save-status';
import { createTestGraph, cleanupTestGraph } from '../../__tests__/setup';

const FIXTURE = readFileSync(resolve(__dirname, 'fixtures/legacy/legacy-layers.drawio'), 'utf8');
const COMPAT = readFileSync(resolve(__dirname, 'fixtures/drawio/compat-multipage.drawio'), 'utf8');

const ids = (cells: Cell[] | null | undefined): string[] => (cells ?? []).map((c) => c.getId() ?? '');

describe('old app layers (rdLayerId) -> draw.io layers', () => {
  let graphs: Graph[] = [];

  function newTab(): { graph: Graph; controller: SaveLoadController } {
    const graph = createTestGraph();
    registerDrawioNamedStyles(graph.getStylesheet());
    installUserObjectLabels(graph);
    graphs.push(graph);
    return { graph, controller: new SaveLoadController(createTabDocument(graph)) };
  }

  beforeAll(() => registerDrawioCodecs());
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    graphs.forEach(cleanupTestGraph);
    graphs = [];
    document.querySelectorAll('.notification-container, .notification').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('creates one layer per old layer, moves the cells in z-order and drops rdLayerId', async () => {
    const unsaved = vi.spyOn(globalSaveStatusIndicator, 'setUnsaved');
    const savedToDisk = vi.spyOn(globalSaveStatusIndicator, 'setSavedToDisk');
    const { graph, controller } = newTab();
    await controller.loadProjectXml(FIXTURE, 'old.drawio', { quiet: true });
    const model = graph.getDataModel();
    const root = model.getRoot()!;

    // layer-0 = the existing layer; the others in creation order, named like the old defaults
    expect(ids(root.children)).toEqual(['1', 'layer-1700000005000', 'layer-1700000009000']);
    expect(root.children!.map((l) => l.getValue() ?? '')).toEqual(['', 'Layer 2', 'Layer 3']);
    // z-order kept; edges follow their terminals (sig1 -> sig2), a free edge and untagged cells stay
    expect(ids(model.getCell('1')!.children)).toEqual(['track', 'free', 'plain']);
    expect(ids(model.getCell('layer-1700000005000')!.children)).toEqual(['sig1', 'grp', 'sig2', 'link']);
    expect(ids(model.getCell('grp')!.children)).toEqual(['grp-a', 'grp-b']);
    expect(model.getCell('link')!.getTerminal(true)).toBe(model.getCell('sig1'));
    expect(model.getCell('link')!.getTerminal(false)).toBe(model.getCell('sig2'));
    // a layer whose cells were all hidden (the old eye) is a hidden layer with visible cells
    expect(model.getCell('layer-1700000009000')!.isVisible()).toBe(false);
    expect(model.getCell('note')!.isVisible()).toBe(true);
    expect(model.getCell('layer-1700000005000')!.isVisible()).toBe(true);
    // the geometry is unchanged (all layers share the same coordinates)
    expect(model.getCell('grp-b')!.getGeometry()!.x).toBe(40);
    expect(model.getCell('sig2')!.getGeometry()!.x).toBe(300);
    // new cells still go to the first layer
    expect(graph.getDefaultParent()).toBe(model.getCell('1'));

    // the tab is modified: not "saved to disk"
    expect(controller.document.hasUnsavedLoadChanges()).toBe(true);
    expect(unsaved).toHaveBeenCalled();
    expect(savedToDisk).not.toHaveBeenCalled();

    // saved as draw.io layers, without rdLayerId
    const saved = controller.document.getProjectXml();
    expect(saved).not.toContain('rdLayerId');
    const doc = new DOMParser().parseFromString(saved, 'text/xml');
    const layerEls = Array.from(doc.getElementsByTagName('mxCell')).filter((c) => c.getAttribute('parent') === '0');
    expect(layerEls.map((c) => [c.getAttribute('id'), c.getAttribute('value'), c.getAttribute('visible')])).toEqual([
      ['1', null, null],
      ['layer-1700000005000', 'Layer 2', null],
      ['layer-1700000009000', 'Layer 3', '0'],
    ]);
    const note = Array.from(doc.getElementsByTagName('mxCell')).find((c) => c.getAttribute('id') === 'note')!;
    expect(note.getAttribute('visible')).toBeNull();
    expect(note.getAttribute('parent')).toBe('layer-1700000009000');

    // one-time: reopening the saved file changes nothing and leaves it saved
    const again = newTab();
    await again.controller.loadProjectXml(saved, 'old.drawio', { quiet: true });
    expect(again.controller.document.hasUnsavedLoadChanges()).toBe(false);
    expect(again.controller.document.getProjectXml()).toBe(saved);
  });

  it('only drops the attribute when every cell was on the old default layer', () => {
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="A" style="rounded=0;rdLayerId=layer-0;" vertex="1" parent="1"><mxGeometry width="40" height="20" as="geometry"/></mxCell>
<mxCell id="b" value="B" style="rounded=0;rdLayerId=layer-0;" vertex="1" parent="1"><mxGeometry x="60" width="40" height="20" as="geometry"/></mxCell>
</root></mxGraphModel>`;
    const { graph, controller } = newTab();
    controller.document.load(xml);
    const model = graph.getDataModel();
    expect(ids(model.getRoot()!.children)).toEqual(['1']);
    expect(ids(model.getCell('1')!.children)).toEqual(['a', 'b']);
    expect(controller.document.hasUnsavedLoadChanges()).toBe(true);
    expect(controller.document.serializeToXml()).not.toContain('rdLayerId');
  });

  it('leaves files without rdLayerId and files with real layers alone', () => {
    // draw.io files: nothing to migrate
    const model = new GraphDataModel();
    const doc = new DOMParser().parseFromString(COMPAT, 'text/xml');
    const first = doc.getElementsByTagName('mxGraphModel')[0];
    importModelXml(new XMLSerializer().serializeToString(first), model);
    expect(migrateLegacyLayers(model)).toBeNull();

    // real layers already: rdLayerId is kept as it is (read and written back verbatim)
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="L2" value="Top" parent="0"/>
<mxCell id="a" value="A" style="rounded=0;rdLayerId=layer-5;" vertex="1" parent="L2"><mxGeometry width="40" height="20" as="geometry"/></mxCell>
</root></mxGraphModel>`;
    const { graph, controller } = newTab();
    controller.document.load(xml);
    expect(controller.document.hasUnsavedLoadChanges()).toBe(false);
    expect(ids(graph.getDataModel().getRoot()!.children)).toEqual(['1', 'L2']);
    expect(controller.document.serializeToXml()).toContain('rdLayerId=layer-5;');
  });

  it('does not reuse an old layer id that a cell already has', () => {
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="layer-7" value="A" style="rounded=0;rdLayerId=layer-0;" vertex="1" parent="1"><mxGeometry width="40" height="20" as="geometry"/></mxCell>
<mxCell id="b" value="B" style="rounded=0;rdLayerId=layer-7;" vertex="1" parent="1"><mxGeometry x="60" width="40" height="20" as="geometry"/></mxCell>
</root></mxGraphModel>`;
    const model = new GraphDataModel();
    importModelXml(xml, model);
    expect(migrateLegacyLayers(model)).toEqual({ layers: 2, createdLayers: 1, cells: 2 });
    const layers = model.getRoot()!.children!;
    expect(layers).toHaveLength(2);
    expect(layers[1].getId()).not.toBe('layer-7');
    expect(layers[1].getValue()).toBe('Layer 2');
    expect(ids(layers[1].children)).toEqual(['b']);
    expect(ids(layers[0].children)).toEqual(['layer-7']);
  });
});
