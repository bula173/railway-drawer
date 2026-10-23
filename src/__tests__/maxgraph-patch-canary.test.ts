/**
 * "Patch canary" for @maxgraph/core: the app patches or reads maxGraph internals (private fields,
 * prototype methods, plugin ids) that are not covered by semver. @maxgraph/core is pinned exactly;
 * when it is bumped, this test lists every internal the app relies on, so a renamed/removed member
 * fails here instead of silently disabling a patch. Each entry names the app file that uses it.
 * When a check fails: re-read the patch in that file against the new maxGraph source.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CellEditorHandler,
  CellHighlight,
  CellRenderer,
  Cell,
  ConnectionHandler,
  ConnectorShape,
  ConstraintHandler,
  EdgeHandler,
  Graph,
  GraphDataModel,
  ImageShape,
  PanningHandler,
  PolylineShape,
  PopupMenuHandler,
  SelectionCellsHandler,
  SelectionHandler,
  Shape,
  StencilShape,
  VertexHandler,
} from '@maxgraph/core';

const ROOT = resolve(__dirname, '../..');
type AnyRecord = Record<string, unknown>;

function proto(cls: { prototype: unknown }): AnyRecord {
  return cls.prototype as AnyRecord;
}

describe('@maxgraph/core patch canary', () => {
  it('is pinned exactly to the installed 0.10.3', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@maxgraph/core']).toBe('0.10.3');
    const installed = JSON.parse(readFileSync(resolve(ROOT, 'node_modules/@maxgraph/core/package.json'), 'utf8')) as { version: string };
    expect(installed.version).toBe('0.10.3');
  });

  it('prototype methods the app wraps still exist', () => {
    const methods: Array<[string, AnyRecord, string[]]> = [
      // drawio-shapes/engine/sketch.ts, shape-fixes.ts, mx-shim.ts, thumbnail-renderer.ts, js shapes
      ['Shape', proto(Shape), ['beforePaint', 'afterPaint', 'paint', 'paintGlassEffect', 'updateBoundingBox', 'configureCanvas', 'redrawShape', 'augmentBoundingBox', 'getSvgScreenOffset', 'getArcSize']],
      ['ImageShape', proto(ImageShape), ['paintVertexShape']],
      ['PolylineShape', proto(PolylineShape), ['paintLine']],
      ['ConnectorShape', proto(ConnectorShape), ['augmentBoundingBox']],
      // drawio-shapes/engine/stencil-fixes.ts, stencil-registry.ts
      ['StencilShape', proto(StencilShape), ['drawNode']],
      ['CellRenderer', proto(CellRenderer), ['createShape']],
      // drawio-shapes/engine/handle-colors.ts
      ['CellHighlight', proto(CellHighlight), ['createShape', 'setHighlightColor']],
      ['EdgeHandler', proto(EdgeHandler), ['getHandleFillColor', 'updatePreviewState', 'mouseMove', 'getSelectionColor', 'createHandleShape']],
      ['VertexHandler', proto(VertexHandler), ['getSelectionColor', 'createSizerShape']],
      // ui/connections.ts (Cell.prototype.isConnectable), shapes/index.ts (registerDefaults)
      ['Cell', proto(Cell), ['isConnectable']],
      ['Graph', proto(Graph), ['registerDefaults', 'createEdgeHandler', 'createVertexHandler', 'getLabel', 'isHtmlLabel', 'postProcessCellStyle', 'convertValueToString']],
      // drawio-shapes/vendor-runtime/mx-shim.ts (adds getParent when missing: must stay missing or compatible)
      ['GraphDataModel', proto(GraphDataModel), ['getRoot', 'setStyle', 'setGeometry']],
      // text editing: curved-text.ts, delete.ts
      ['CellEditorHandler', proto(CellEditorHandler), ['getEditingCell', 'getInitialValue', 'startEditing', 'stopEditing']],
      // ui/connections.ts, ui/hover-arrows.ts
      ['ConnectionHandler', proto(ConnectionHandler), ['isValidSource', 'isValidTarget', 'start', 'reset', 'isCreateTarget']],
      ['ConstraintHandler', proto(ConstraintHandler), ['reset']],
      // drawio-shapes/behaviour/tables.ts, containers.ts, drawio-palette-view.ts
      ['SelectionHandler', proto(SelectionHandler), ['start', 'reset', 'getCells', 'isValidDropTarget', 'shouldRemoveCellsFromParent', 'selectCellForEvent']],
      // ui/pan.ts
      ['PanningHandler', proto(PanningHandler), ['isPanningTrigger', 'isForcePanningEvent', 'mouseUp']],
    ];
    const missing: string[] = [];
    for (const [name, p, members] of methods) {
      for (const m of members) if (typeof p[m] !== 'function') missing.push(`${name}.prototype.${m}`);
    }
    expect(missing).toEqual([]);
  });

  it('plugins, their ids and instance fields the app reads or sets', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    try {
      const plugin = (id: string): AnyRecord | undefined => graph.getPlugin(id) as AnyRecord | undefined;
      for (const id of ['CellEditorHandler', 'ConnectionHandler', 'PanningHandler', 'PopupMenuHandler', 'SelectionHandler', 'SelectionCellsHandler', 'TooltipHandler']) {
        expect(plugin(id), id).toBeTruthy();
      }
      // there is no 'GraphHandler' plugin in maxGraph (mxGraph's name): SelectionHandler is it
      expect(plugin('GraphHandler')).toBeUndefined();
      expect(plugin('SelectionHandler')).toBeInstanceOf(SelectionHandler);
      expect(plugin('SelectionCellsHandler')).toBeInstanceOf(SelectionCellsHandler);
      expect(plugin('PopupMenuHandler')).toBeInstanceOf(PopupMenuHandler);

      // ui/connections.ts + hover-arrows.ts: first, constraintHandler.{pointImage,currentFocus}, marker.validColor
      const connection = plugin('ConnectionHandler')!;
      expect(connection).toHaveProperty('first', null);
      expect(connection.constraintHandler).toBeInstanceOf(ConstraintHandler);
      const constraint = connection.constraintHandler as AnyRecord;
      expect(constraint).toHaveProperty('pointImage');
      expect(constraint).toHaveProperty('currentFocus', null);
      expect(connection.marker as AnyRecord).toHaveProperty('validColor');

      // railway/snap.ts, drawio-palette-view.ts: SelectionHandler.first / cells
      const selection = plugin('SelectionHandler')!;
      expect(selection).toHaveProperty('first', null);
      expect(selection).toHaveProperty('cells', null);

      // ui/pan.ts: useLeftButtonForPanning
      expect(plugin('PanningHandler')).toHaveProperty('useLeftButtonForPanning', false);
      // ui/context-menu.ts: selectOnPopup / clearSelectionOnBackground
      expect(plugin('PopupMenuHandler')).toHaveProperty('selectOnPopup', true);
      expect(plugin('PopupMenuHandler')).toHaveProperty('clearSelectionOnBackground', true);
      // drawio-shapes/js/shapes-edges/curved-text.ts
      expect(typeof (plugin('CellEditorHandler')!.getEditingCell as () => unknown)).toBe('function');
    } finally {
      graph.destroy();
      container.remove();
    }
  });

  it('EdgeHandler.outline still defaults to true and is passed to updatePreviewState (ui/connections.ts sets it to outlineConnect)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    try {
      const parent = graph.getDefaultParent();
      const a = graph.insertVertex(parent, null, 'A', 0, 0, 40, 40);
      const b = graph.insertVertex(parent, null, 'B', 100, 0, 40, 40);
      const edge = graph.insertEdge(parent, null, '', a, b);
      const state = graph.view.getState(edge)!;
      const handler = new EdgeHandler(state) as unknown as AnyRecord;
      expect(handler.outline).toBe(true);
      expect(handler.outlineConnect).toBe(false);
      // the call the app's patch neutralises
      expect(String(proto(EdgeHandler).mouseMove)).toContain('this.outline)');
    } finally {
      graph.destroy();
      container.remove();
    }
  });

  it('eval paths of maxGraph are off once the draw.io codecs are registered (files are untrusted)', async () => {
    const { registerDrawioCodecs } = await import('../services/drawio-xml');
    const core = await import('@maxgraph/core');
    registerDrawioCodecs();
    expect(core.StylesheetCodec.allowEval).toBe(false);
    expect(core.ObjectCodec.allowEval).toBe(false);
    expect(core.StencilShape.allowEval).toBe(false);
  });

  it("CellEditorHandler.getInitialValue escapes the label (the editor's innerHTML is not a sanitizer sink)", () => {
    expect(String(proto(CellEditorHandler).getInitialValue)).toContain('htmlEntities');
  });
});
