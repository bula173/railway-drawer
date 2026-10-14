/**
 * Native draw.io format: writer, reader, legacy <GraphDataModel> loading and golden fixtures.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Cell, Geometry, Graph, GraphDataModel, Point, Rectangle } from '@maxgraph/core';
import type { CellStyle } from '@maxgraph/core';
import {
  DRAWIO_SHAPE_MAP,
  IMAGE_FALLBACK_SHAPES,
  exportModelToDrawioXml,
  getUserObjectLabel,
  importDrawioXmlIntoModel,
  importLegacyXmlIntoModel,
  installUserObjectLabels,
  isLegacyModelXml,
  parseStyleString,
  registerDrawioCodecs,
  registerDrawioNamedStyles,
  styleToString,
  type PageSettings,
} from '../../services/drawio-xml';
import { ProjectService } from '../../services/project-service';
import { SaveLoadController } from '../../ui/saveload';
import { PlantUmlGroupManager } from '../../services/plantuml-group-manager';
import { registerErtmsShapes } from '../../shapes/ertms';
import { createTestGraph, cleanupTestGraph } from '../setup';

const fixture = (name: string): string => readFileSync(resolve(__dirname, '../fixtures/drawio', name), 'utf8');

const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, 'text/xml');

/** All cell elements (mxCell, or the UserObject wrapper) under <root>, by id. */
function cellElements(xml: string): Map<string, Element> {
  const doc = parseXml(xml);
  const root = doc.getElementsByTagName('root')[0];
  const map = new Map<string, Element>();
  for (const el of Array.from(root.children)) map.set(el.getAttribute('id') ?? '', el);
  return map;
}

/** The <mxCell> of a cell element (itself, or the child of a UserObject wrapper). */
const innerCell = (el: Element): Element =>
  el.nodeName === 'mxCell' ? el : (Array.from(el.children).find((c) => c.nodeName === 'mxCell') as Element);

/** Exports, imports into a fresh model, exports again: the two exports must be identical. */
function roundTrip(model: GraphDataModel, page?: PageSettings): { xml: string; model: GraphDataModel; page: PageSettings } {
  const xml = exportModelToDrawioXml(model, { page });
  const restored = new GraphDataModel();
  const settings = importDrawioXmlIntoModel(xml, restored);
  expect(exportModelToDrawioXml(restored, { page: settings })).toBe(xml);
  return { xml, model: restored, page: settings };
}

/** A model with root and default layer "1", plus a helper to add cells. */
function newModel(): { model: GraphDataModel; layer: Cell; add: (cell: Cell, parent?: Cell) => Cell } {
  const model = new GraphDataModel();
  const layer = model.getRoot()!.getChildAt(0);
  const add = (cell: Cell, parent: Cell = layer): Cell => {
    model.add(parent, cell);
    return cell;
  };
  return { model, layer, add };
}

function vertex(id: string, value: unknown, style: CellStyle, x = 0, y = 0, w = 80, h = 40): Cell {
  const cell = new Cell(value, new Geometry(x, y, w, h), style);
  cell.setId(id);
  cell.setVertex(true);
  return cell;
}

function edge(id: string, value: unknown, style: CellStyle, source: Cell | null, target: Cell | null): Cell {
  const geo = new Geometry();
  geo.relative = true;
  const cell = new Cell(value, geo, style);
  cell.setId(id);
  cell.setEdge(true);
  if (source) cell.setTerminal(source, true);
  if (target) cell.setTerminal(target, false);
  return cell;
}

describe('drawio-xml', () => {
  beforeAll(() => {
    registerDrawioCodecs();
    registerErtmsShapes();
  });

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writer and reader round trip', () => {
    it('writes the draw.io structure: mxGraphModel, root, cells 0 and 1, no namespaces', () => {
      const { model, add } = newModel();
      add(vertex('v', 'A', { fillColor: '#ffffff' }, 10, 20, 30, 40));
      const { xml } = roundTrip(model);

      expect(xml.startsWith('<mxGraphModel ')).toBe(true);
      expect(xml).not.toContain('xmlns');
      expect(xml).toContain('<root><mxCell id="0"/><mxCell id="1" parent="0"/>');
      expect(xml).toContain(
        '<mxCell id="v" value="A" style="fillColor=#ffffff;" vertex="1" parent="1">' +
          '<mxGeometry x="10" y="20" width="30" height="40" as="geometry"/></mxCell>'
      );
    });

    it('keeps labels with newlines, quotes, ampersands and markup', () => {
      const label = 'Line 1\nLine "2" & <b>bold</b>';
      const { model, add } = newModel();
      add(vertex('v', label, {}));
      const { xml, model: restored } = roundTrip(model);

      // Newlines in attributes must be escaped, or parsers turn them into spaces
      expect(xml).toMatch(/value="Line 1&#x[aA];Line/);
      expect(restored.getCell('v')?.getValue()).toBe(label);
    });

    it('round-trips edges with terminals, an edge label with relative geometry and offset', () => {
      const { model, add } = newModel();
      const a = add(vertex('a', 'A', {}, 0, 0));
      const b = add(vertex('b', 'B', {}, 200, 0));
      const e = add(edge('e', 'A to B', { endArrow: 'block' }, a, b));
      const labelGeo = new Geometry(-0.5, 1, 0, 0);
      labelGeo.relative = true;
      labelGeo.offset = new Point(4, -6);
      const label = new Cell('mid', labelGeo, { baseStyleNames: ['edgeLabel'], html: true } as CellStyle);
      label.setId('lbl');
      label.setVertex(true);
      label.setConnectable(false);
      add(label, e);

      const { xml, model: restored } = roundTrip(model);
      const cells = cellElements(xml);
      expect(cells.get('e')?.getAttribute('source')).toBe('a');
      expect(cells.get('e')?.getAttribute('target')).toBe('b');
      expect(cells.get('lbl')?.getAttribute('parent')).toBe('e');
      expect(cells.get('lbl')?.getAttribute('connectable')).toBe('0');
      expect(cells.get('lbl')?.getAttribute('style')).toBe('edgeLabel;html=1;');

      const restoredEdge = restored.getCell('e')!;
      expect(restoredEdge.isEdge()).toBe(true);
      expect(restoredEdge.getTerminal(true)?.getId()).toBe('a');
      expect(restoredEdge.getTerminal(false)?.getId()).toBe('b');
      const restoredLabel = restored.getCell('lbl')!;
      expect(restoredLabel.getParent()).toBe(restoredEdge);
      expect(restoredLabel.isConnectable()).toBe(false);
      expect(restoredLabel.getGeometry()?.relative).toBe(true);
      expect(restoredLabel.getGeometry()?.x).toBe(-0.5);
      expect(restoredLabel.getGeometry()?.offset).toEqual(new Point(4, -6));
    });

    it('decodes forward references to terminals defined later in the file', () => {
      const xml =
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
        '<mxCell id="e" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>' +
        '<mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell>' +
        '<mxCell id="b" value="B" vertex="1" parent="1"><mxGeometry x="50" width="10" height="10" as="geometry"/></mxCell>' +
        '</root></mxGraphModel>';
      const model = new GraphDataModel();
      importDrawioXmlIntoModel(xml, model);
      expect(model.getCell('e')?.getTerminal(true)).toBe(model.getCell('a'));
      expect(model.getCell('e')?.getTerminal(false)).toBe(model.getCell('b'));
    });

    it('round-trips a dangling edge with source/target points and waypoints', () => {
      const { model, add } = newModel();
      const e = add(edge('track', '', { endArrow: 'none' }, null, null));
      const geo = e.getGeometry()!;
      geo.setTerminalPoint(new Point(10, 20), true);
      geo.setTerminalPoint(new Point(300, 20.5), false);
      geo.points = [new Point(100, 60), new Point(200, 60)];

      const { xml, model: restored } = roundTrip(model);
      expect(xml).toContain('<mxPoint x="10" y="20" as="sourcePoint"/>');
      expect(xml).toContain('<Array as="points"><mxPoint x="100" y="60"/><mxPoint x="200" y="60"/></Array>');
      const g = restored.getCell('track')!.getGeometry()!;
      expect(g.sourcePoint).toEqual(new Point(10, 20));
      expect(g.targetPoint).toEqual(new Point(300, 20.5));
      expect(g.points).toEqual([new Point(100, 60), new Point(200, 60)]);
      expect(g.points![0]).toBeInstanceOf(Point);
    });

    it('round-trips groups with collapsed state and alternateBounds', () => {
      const { model, add } = newModel();
      const group = add(vertex('g', 'Group', { baseStyleNames: ['swimlane'] }, 10, 10, 300, 200));
      group.setCollapsed(true);
      group.getGeometry()!.alternateBounds = new Rectangle(10, 10, 120, 23);
      add(vertex('child', 'Child', {}, 20, 40), group);

      const { xml, model: restored } = roundTrip(model);
      expect(xml).toContain('<mxRectangle x="10" y="10" width="120" height="23" as="alternateBounds"/>');
      const g = restored.getCell('g')!;
      expect(g.isCollapsed()).toBe(true);
      expect(g.getGeometry()!.alternateBounds).toBeInstanceOf(Rectangle);
      expect(g.getGeometry()!.alternateBounds).toEqual(new Rectangle(10, 10, 120, 23));
      expect(restored.getCell('child')!.getParent()).toBe(g);
    });

    it('round-trips connectable, visible and movable flags and the app layer id', () => {
      const { model, add } = newModel();
      const v = add(vertex('v', 'V', { movable: false }));
      v.setConnectable(false);
      v.setVisible(false);
      (v as unknown as { __layerId: string }).__layerId = 'layer-7';

      const { xml, model: restored } = roundTrip(model);
      const el = cellElements(xml).get('v')!;
      expect(el.getAttribute('connectable')).toBe('0');
      expect(el.getAttribute('visible')).toBe('0');
      expect(el.getAttribute('style')).toBe('movable=0;rdLayerId=layer-7;');

      const r = restored.getCell('v')!;
      expect(r.isConnectable()).toBe(false);
      expect(r.isVisible()).toBe(false);
      expect(r.isVertex()).toBe(true);
      expect(r.getStyle()).toEqual({ movable: false });
      expect((r as unknown as { __layerId: string }).__layerId).toBe('layer-7');
    });

    it('round-trips page settings', () => {
      const page: PageSettings = {
        dx: 1426,
        dy: 797,
        grid: false,
        gridSize: 20,
        page: true,
        pageScale: 1.5,
        pageWidth: 1169,
        pageHeight: 827,
        background: '#F0F0F0',
        math: true,
        shadow: false,
      };
      const { model } = newModel();
      const { xml, page: restored } = roundTrip(model, page);
      expect(xml).toMatch(/^<mxGraphModel dx="1426" dy="797" grid="0" gridSize="20" guides="1"/);
      expect(restored).toMatchObject(page);
    });
  });

  describe('styles', () => {
    it.each<[string, CellStyle, string]>([
      ['base style names first, in order', { baseStyleNames: ['text', 'edgeLabel'], fontSize: 11 }, 'text;edgeLabel;fontSize=11;'],
      ['booleans as 1/0', { rounded: true, dashed: false }, 'rounded=1;dashed=0;'],
      ['autoSize as autosize', { autoSize: true }, 'autosize=1;'],
      ['hex colours without # as strings', { fontColor: '000000', fillColor: '774400' }, 'fontColor=000000;fillColor=774400;'],
      ['links with = and ?', { link: 'http://x/?a=b&c=d' } as CellStyle, 'link=http://x/?a=b&c=d;'],
      ['values with ;', { fontFamily: 'Arial;Helvetica' }, 'fontFamily=Arial%3BHelvetica;'],
      ['empty style', {}, ''],
    ])('writes and reads %s', (_name, style, text) => {
      expect(styleToString(style)).toBe(text);
      expect(parseStyleString(text)).toEqual(style);
    });

    it('writes data URIs in draw.io form and restores ;base64 on import', () => {
      const { model, add } = newModel();
      add(vertex('img', '', { shape: 'image', image: 'data:image/png;base64,AAA=' }));
      const { xml, model: restored } = roundTrip(model);
      expect(cellElements(xml).get('img')?.getAttribute('style')).toBe('shape=image;image=data:image/png,AAA=;');
      expect(restored.getCell('img')?.getStyle()).toEqual({ shape: 'image', image: 'data:image/png;base64,AAA=' });
    });

    it('splits on the first = only (base64 padding in stencils)', () => {
      expect(parseStyleString('shape=stencil(PHN2Zz4=);vsdxID=229;')).toEqual({ shape: 'stencil(PHN2Zz4=)', vsdxID: 229 });
    });

    it('keeps a leading ; (no default style)', () => {
      const style = parseStyleString(';fillColor=red;');
      expect(style).toEqual({ ignoreDefaultStyle: true, fillColor: 'red' });
      expect(styleToString(style)).toBe(';fillColor=red;');
    });

    it('writes string styles verbatim and no style attribute for empty ones', () => {
      const { model, add } = newModel();
      add(vertex('s', '', 'opacity=0;' as unknown as CellStyle));
      add(vertex('n', '', {}));
      const xml = exportModelToDrawioXml(model);
      expect(cellElements(xml).get('s')?.getAttribute('style')).toBe('opacity=0;');
      expect(cellElements(xml).get('n')?.hasAttribute('style')).toBe(false);
    });

    it("fills in the app's default colours and arrows that draw.io would replace", () => {
      const graph = createTestGraph();
      try {
        const a = graph.insertVertex(graph.getDefaultParent(), 'a', 'A', 0, 0, 40, 40, { fillColor: 'none' });
        const b = graph.insertVertex(graph.getDefaultParent(), 'b', 'B', 100, 0, 40, 40);
        graph.insertEdge(graph.getDefaultParent(), 'e', '', a, b);
        const xml = exportModelToDrawioXml(graph.getDataModel(), { stylesheet: graph.getStylesheet() });
        const cells = cellElements(xml);
        expect(parseStyleString(cells.get('a')!.getAttribute('style')!)).toEqual({
          fillColor: 'none',
          strokeColor: '#6482B9',
          fontColor: '#774400',
        });
        expect(parseStyleString(cells.get('e')!.getAttribute('style')!)).toMatchObject({
          endArrow: 'classic',
          rounded: false,
        });
      } finally {
        cleanupTestGraph(graph);
      }
    });
  });

  describe('custom shapes', () => {
    it.each(Object.keys(DRAWIO_SHAPE_MAP))('exports %s as a draw.io shape and restores it', (shape) => {
      const { model, add } = newModel();
      const original: CellStyle = { shape, fillColor: '#ffffff', strokeColor: '#000000' };
      add(vertex('v', 'X', { ...original }));
      const { xml, model: restored } = roundTrip(model);

      const written = parseStyleString(cellElements(xml).get('v')!.getAttribute('style')!) as Record<string, unknown>;
      expect(written.rdShape).toBe(shape);
      expect(written.shape).not.toBe(shape);
      expect(written).toMatchObject(parseStyleString(DRAWIO_SHAPE_MAP[shape]) as Record<string, unknown>);
      expect(restored.getCell('v')!.getStyle()).toEqual(original);
    });

    it.each(IMAGE_FALLBACK_SHAPES)('exports %s as an SVG image and restores the app shape', (shape) => {
      const { model, add } = newModel();
      const original: CellStyle = { shape, fillColor: 'none', strokeColor: '#404040' };
      add(vertex('v', '', { ...original }, 0, 0, 30, 60));
      const { xml, model: restored } = roundTrip(model);

      const written = parseStyleString(cellElements(xml).get('v')!.getAttribute('style')!) as Record<string, unknown>;
      expect(written.shape).toBe('image');
      expect(written.rdShape).toBe(shape);
      const image = String(written.image);
      expect(image.startsWith('data:image/svg+xml,')).toBe(true);
      const svg = atob(image.slice('data:image/svg+xml,'.length));
      expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]*width="30"/);
      expect(svg).toMatch(/<(rect|ellipse|path)/);
      // Must be well-formed: a duplicated xmlns attribute made browsers (and draw.io) show nothing
      const svgDoc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(svgDoc.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(svg.match(/\sxmlns=/g)).toHaveLength(1);
      expect(restored.getCell('v')!.getStyle()).toEqual(original);
    });
  });

  describe('UserObject values', () => {
    it('writes the id on the wrapper and shows/edits the label attribute', () => {
      const xml =
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
        '<UserObject label="%name% at km %km%" placeholders="1" name="B12" km="1.5" tags="ertms" id="u">' +
        '<mxCell style="rounded=1;" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell>' +
        '</UserObject></root></mxGraphModel>';
      const graph = createTestGraph();
      try {
        installUserObjectLabels(graph);
        importDrawioXmlIntoModel(xml, graph.getDataModel());
        const cell = graph.getDataModel().getCell('u')!;
        expect(getUserObjectLabel(cell)).toBe('B12 at km 1.5');
        expect(graph.convertValueToString(cell)).toBe('B12 at km 1.5');

        const out = exportModelToDrawioXml(graph.getDataModel());
        const wrapper = cellElements(out).get('u')!;
        expect(wrapper.nodeName).toBe('UserObject');
        expect(wrapper.getAttribute('tags')).toBe('ertms');
        expect(innerCell(wrapper).hasAttribute('id')).toBe(false);
        expect(innerCell(wrapper).getAttribute('style')).toBe('rounded=1;');
        expect(out).toBe(xml.replace('<mxGraphModel>', out.slice(0, out.indexOf('>') + 1)));

        graph.cellLabelChanged(cell, 'Renamed', false);
        const value = cell.getValue() as Element;
        expect(value.getAttribute('label')).toBe('Renamed');
        expect(value.getAttribute('name')).toBe('B12');
      } finally {
        cleanupTestGraph(graph);
      }
    });
  });

  describe('robustness', () => {
    it('ignores extra children of mxGraphModel instead of recursing forever', () => {
      const model = new GraphDataModel();
      importDrawioXmlIntoModel(
        '<mxGraphModel><foo/><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
          '<mxCell id="v" value="ok" vertex="1" parent="1"><mxGeometry as="geometry"/></mxCell></root><bar/></mxGraphModel>',
        model
      );
      expect(model.getCell('v')?.getValue()).toBe('ok');
    });

    it('reports duplicate ids clearly', () => {
      expect(() =>
        importDrawioXmlIntoModel(
          '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
            '<mxCell id="x" vertex="1" parent="1"/><mxCell id="x" vertex="1" parent="1"/></root></mxGraphModel>',
          new GraphDataModel()
        )
      ).toThrow('"x"');
    });

    it('rejects wrappers: callers pass the bare model', () => {
      expect(() => importDrawioXmlIntoModel('<mxfile><diagram/></mxfile>', new GraphDataModel())).toThrow('<mxfile>');
    });
  });

  describe('project files', () => {
    it('writes one mxfile with the shown page and preserved pages (plain and compressed), without namespaces', async () => {
      const service = new ProjectService();
      const plainPage =
        '<diagram id="2" name="Plain"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
        '<mxCell id="p" value="Line&#xa;two" vertex="1" parent="1"><mxGeometry as="geometry"/></mxCell></root></mxGraphModel></diagram>';
      const compressedPage = '<diagram id="3" name="Packed">jVBJDsIwDHyN7yGhiHPDcuIRFrWa</diagram>';
      service.setExtraPages([plainPage, compressedPage]);

      const { model, add } = newModel();
      add(vertex('v', 'Shown', {}));
      const modelXml = exportModelToDrawioXml(model) + '\n<!-- PLANTUML_METADATA_UTF8:e30= -->';
      const projectXml = service.generateProjectXml(modelXml);

      expect(projectXml).not.toContain('xmlns');
      const doc = parseXml(projectXml);
      const diagrams = Array.from(doc.documentElement.children);
      expect(doc.documentElement.nodeName).toBe('mxfile');
      expect(diagrams.map((d) => d.nodeName)).toEqual(['diagram', 'diagram', 'diagram']);
      expect(diagrams[0].firstElementChild?.nodeName).toBe('mxGraphModel');
      expect(diagrams[0].getAttribute('id')).toMatch(/^[\w-]{20}$/);
      expect(diagrams[0].lastChild?.nodeType).toBe(Node.COMMENT_NODE);

      const parsed = await service.parseProjectXml(projectXml);
      expect(parsed.graphXml).toContain('PLANTUML_METADATA_UTF8:e30=');
      expect(parsed.extraPageNames).toEqual(['Plain', 'Packed']);
      expect(parsed.extraPages[1]).toBe(compressedPage);
      expect(parseXml(parsed.extraPages[0]).getElementsByTagName('mxCell')[2].getAttribute('value')).toBe('Line\ntwo');

      // The page id is kept between saves
      expect(parseXml(service.generateProjectXml(modelXml)).documentElement.firstElementChild?.getAttribute('id')).toBe(
        diagrams[0].getAttribute('id')
      );
    });
  });
});

describe('golden fixtures and legacy files', () => {
  let graph: Graph;
  let controller: SaveLoadController;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    graph = createTestGraph();
    // As TabManager.createTab() sets up every graph
    registerDrawioNamedStyles(graph.getStylesheet());
    installUserObjectLabels(graph);
    controller = new SaveLoadController(graph);
  });

  afterEach(() => {
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  async function openFixture(name: string) {
    const parsed = await new ProjectService().parseProjectXml(fixture(name));
    controller.load(parsed.graphXml);
    return parsed;
  }

  /**
   * Semantic comparison with the draw.io original: same cells, attributes, geometry, and every
   * original style entry still present (the export may add the app's default colours).
   */
  function expectSameDiagram(originalModelXml: string, exportedXml: string): void {
    const original = cellElements(originalModelXml);
    const exported = cellElements(exportedXml);
    expect([...exported.keys()].sort()).toEqual([...original.keys()].sort());
    for (const [id, origEl] of original) {
      const outEl = exported.get(id)!;
      expect(outEl.nodeName, id).toBe(origEl.nodeName);
      if (origEl.nodeName !== 'mxCell') {
        // UserObject wrapper: every custom attribute is kept
        for (const attr of Array.from(origEl.attributes)) {
          expect(outEl.getAttribute(attr.name), `${id}@${attr.name}`).toBe(attr.value);
        }
      }
      const o = innerCell(origEl);
      const e = innerCell(outEl);
      for (const name of ['value', 'vertex', 'edge', 'parent', 'source', 'target', 'connectable']) {
        expect(e.getAttribute(name), `${id} ${name}`).toBe(o.getAttribute(name) === '' && name !== 'value' ? null : o.getAttribute(name));
      }
      const oStyle = parseStyleString(o.getAttribute('style') ?? '') as Record<string, unknown>;
      const eStyle = parseStyleString(e.getAttribute('style') ?? '') as Record<string, unknown>;
      expect(eStyle, `${id} style`).toMatchObject(oStyle);
      const oGeo = o.getElementsByTagName('mxGeometry')[0];
      const eGeo = e.getElementsByTagName('mxGeometry')[0];
      if (oGeo) {
        for (const name of ['x', 'y', 'width', 'height']) {
          expect(parseFloat(eGeo.getAttribute(name) ?? '0'), `${id} ${name}`).toBeCloseTo(parseFloat(oGeo.getAttribute(name) ?? '0'), 3);
        }
        expect(eGeo.getElementsByTagName('mxPoint').length, `${id} points`).toBe(oGeo.getElementsByTagName('mxPoint').length);
      }
    }
  }

  it('loads a draw.io desktop file and writes it back equivalently', async () => {
    const parsed = await openFixture('native-desktop.drawio');
    const model = graph.getDataModel();

    expect(parsed.metadata.name).toBe('Station');
    expect(parsed.pageId).toBe('Kq8bW3nR2xZ9tYc4mLpA');
    expect(parsed.extraPageNames).toEqual(['Notes']);
    expect(Object.keys(model.cells!)).toHaveLength(11);
    expect(model.getCell('ell')?.getValue()).toBe('Signal<br>S1');
    expect(model.getCell('ell')?.getStyle()).toMatchObject({ baseStyleNames: ['ellipse'], aspect: 'fixed', html: true });
    expect(model.getCell('rho')?.getStyle()).toMatchObject({ fontColor: '000000' });
    expect(graph.convertValueToString(model.getCell('uo')!)).toBe('Balise B12 (12.345)');
    expect(model.getCell('e1-label')?.getValue()).toBe('route\nR1');
    expect(model.getCell('e1')?.getTerminal(false)).toBe(model.getCell('uo'));
    expect(model.getCell('e1')?.getGeometry()?.points).toHaveLength(3);
    expect(model.getCell('lane')?.getGeometry()?.alternateBounds).toEqual(new Rectangle(40, 40, 120, 23));
    expect(model.getCell('img')?.getStyle().image).toBe(
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4='
    );
    expect(graph.gridSize).toBe(10);

    const originalModel = new XMLSerializer().serializeToString(
      parseXml(fixture('native-desktop.drawio')).getElementsByTagName('mxGraphModel')[0]
    );
    const exported = controller.serializeToXml();
    expectSameDiagram(originalModel, exported);
    expect(exported).toMatch(/^<mxGraphModel dx="1426" dy="797" grid="1" gridSize="10"[^>]* page="1"[^>]* background="#FFFFFF"/);

    // Stable from the first save on
    const again = createTestGraph();
    registerDrawioNamedStyles(again.getStylesheet());
    try {
      const second = new SaveLoadController(again);
      second.load(exported);
      expect(second.serializeToXml()).toBe(exported);
    } finally {
      cleanupTestGraph(again);
    }
  });

  it('loads the compressed save of the same diagram identically', async () => {
    await openFixture('native-desktop.drawio');
    const plain = controller.serializeToXml();
    const parsed = await openFixture('native-compressed.drawio');
    expect(parsed.extraPageNames).toEqual(['Notes']);
    expect(controller.serializeToXml()).toBe(plain);
  });

  it('round-trips real draw.io XML from the ERTMS library (UserObjects, stencils, groups)', async () => {
    const source = fixture('ertms-library.drawio');
    const parsed = await openFixture('ertms-library.drawio');
    const models = parseXml(source).getElementsByTagName('mxGraphModel');
    const serializer = new XMLSerializer();

    expectSameDiagram(serializer.serializeToString(models[0]), controller.serializeToXml());
    const userObject = graph.getDataModel().getCell('6')!;
    expect((userObject.getValue() as Element).getAttribute('tags')).toBe('Background');
    expect(userObject.isEdge()).toBe(true);
    expect(String(graph.getDataModel().getCell('3')?.getStyle().shape)).toMatch(/^stencil\(.+\)$/);

    // Page 2 is kept for saving; it also loads on its own
    expect(parsed.extraPageNames).toEqual(['TC']);
    const page2 = parseXml(parsed.extraPages[0]).getElementsByTagName('mxGraphModel')[0];
    const page2Xml = serializer.serializeToString(page2);
    controller.load(page2Xml);
    expectSameDiagram(page2Xml, controller.serializeToXml());
  });

  it('loads a legacy <GraphDataModel> project and saves it as draw.io XML', async () => {
    const source = fixture('legacy-graphdatamodel.railwaydrawer');
    expect(source).toContain('<GraphDataModel');
    await openFixture('legacy-graphdatamodel.railwaydrawer');
    const model = graph.getDataModel();

    expect(model.getCell('a')?.getValue()).toBe('Signal\nA1');
    expect(model.getCell('a')?.isVertex()).toBe(true);
    expect((model.getCell('a') as unknown as { __layerId: string }).__layerId).toBe('layer-2');
    expect(model.getCell('grp')?.getGeometry()?.alternateBounds).toEqual(new Rectangle(20, 20, 120, 30));
    expect(model.getCell('ab')?.getTerminal(false)).toBe(model.getCell('b'));
    expect(model.getCell('ab')?.getGeometry()?.points).toEqual([new Point(140, 100)]);
    expect(model.getCell('b')?.getStyle().image).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(new PlantUmlGroupManager(graph).getPlantUmlMetadata(model.getCell('grp'))).toMatchObject({
      diagramType: 'sequence',
      plantumlSource: '@startuml\nA -> B\n@enduml',
    });

    const saved = controller.serializeToXml();
    expect(saved.startsWith('<mxGraphModel')).toBe(true);
    expect(isLegacyModelXml(saved)).toBe(false);
    const cells = cellElements(saved);
    expect(parseStyleString(cells.get('a')!.getAttribute('style')!)).toMatchObject({
      baseStyleNames: ['ellipse'],
      rdShape: 'ellipse-shape',
      rdLayerId: 'layer-2',
    });
    expect(saved).toContain('PLANTUML_METADATA_UTF8:');

    // Reload of the converted file gives the same diagram back
    const again = createTestGraph();
    registerDrawioNamedStyles(again.getStylesheet());
    try {
      new SaveLoadController(again).load(saved);
      const m = again.getDataModel();
      expect(m.getCell('a')?.getStyle()).toMatchObject({ shape: 'ellipse-shape', strokeColor: '#000000' });
      expect((m.getCell('a') as unknown as { __layerId: string }).__layerId).toBe('layer-2');
      expect(m.getCell('grp')?.getGeometry()?.alternateBounds).toEqual(new Rectangle(20, 20, 120, 30));
      expect(new PlantUmlGroupManager(again).getPlantUmlMetadata(m.getCell('grp'))?.diagramType).toBe('sequence');
    } finally {
      cleanupTestGraph(again);
    }
  });

  it('reads a legacy model directly', () => {
    const legacy = (JSON.parse(fixture('legacy-cache.json')) as { data: { tabs: Array<{ graphXml: string }> } }).data
      .tabs[0].graphXml;
    expect(isLegacyModelXml(legacy)).toBe(true);
    const model = new GraphDataModel();
    importLegacyXmlIntoModel(legacy, model);
    expect(model.getCell('ab')?.isEdge()).toBe(true);
    expect(model.getCell('grp')?.getGeometry()?.alternateBounds).toBeInstanceOf(Rectangle);
  });
});
