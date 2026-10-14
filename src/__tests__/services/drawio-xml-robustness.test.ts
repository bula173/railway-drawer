/**
 * Regressions in the draw.io reader/writer:
 * - mapped shape keys the cell had itself (`rounded`, `aspect`, `size`) were dropped on import,
 * - <mxGraphModel> attributes other than the 16 known page settings were lost,
 * - PlantUML metadata lived only in an XML comment, which draw.io drops when it re-saves,
 * - colour keys not ending in "color" lost leading zeros; some 0/1 flags came back as numbers,
 * - a dangling parent reference silently replaced the whole diagram with one cell,
 * - XML-forbidden control characters in labels made the saved file unreadable,
 * - deeply nested XML and compressed "deflate bombs" could freeze the tab,
 * - duplicate ids inside UserObject wrappers / a second <root> gave maxGraph's raw message.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { deflateRawSync } from 'zlib';
import { Cell, Geometry, GraphDataModel } from '@maxgraph/core';
import type { CellStyle } from '@maxgraph/core';
import {
  MAX_MODEL_XML_DEPTH,
  exportModelToDrawioXml,
  importDrawioXmlIntoModel,
  importModelXml,
  parseStyleString,
  registerDrawioCodecs,
  sanitizeXmlText,
  styleToString,
  type PageSettings,
} from '../../services/drawio-xml';
import { ProjectService } from '../../services/project-service';
import { SaveLoadController } from '../../ui/saveload';
import { PlantUmlGroupManager } from '../../services/plantuml-group-manager';
import { createTestGraph, cleanupTestGraph } from '../setup';

function modelWith(...cells: Array<[string, unknown, CellStyle]>): GraphDataModel {
  const model = new GraphDataModel();
  const layer = model.getRoot()!.getChildAt(0);
  for (const [id, value, style] of cells) {
    const cell = new Cell(value, new Geometry(0, 0, 80, 40), style);
    cell.setId(id);
    cell.setVertex(true);
    model.add(layer, cell);
  }
  return model;
}

/** Export, import, export again: returns the restored model and checks the exports match. */
function roundTrip(model: GraphDataModel, page?: PageSettings): { xml: string; model: GraphDataModel; page: PageSettings } {
  const xml = exportModelToDrawioXml(model, { page });
  const restored = new GraphDataModel();
  const settings = importDrawioXmlIntoModel(xml, restored);
  expect(exportModelToDrawioXml(restored, { page: settings })).toBe(xml);
  return { xml, model: restored, page: settings };
}

const wrap = (cells: string): string =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;

describe('drawio-xml robustness', () => {
  beforeAll(() => registerDrawioCodecs());
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  describe('app shape mapping keeps the cell\'s own keys', () => {
    it.each([
      [{ shape: 'rounded-rectangle-shape', rounded: true, arcSize: 20 }],
      [{ shape: 'circle-shape', aspect: 'fixed' }],
      [{ shape: 'hexagon-shape', size: 0.25 }],
      [{ baseStyleNames: ['ellipse'], shape: 'circle-shape' }],
    ] as Array<[CellStyle]>)('round-trips %j unchanged', (style) => {
      const { model } = roundTrip(modelWith(['v', 'A', style]));
      expect(model.getCell('v')?.getStyle()).toEqual(style);
    });

    it('still removes the keys the mapping added', () => {
      const { xml, model } = roundTrip(modelWith(['v', 'A', { shape: 'rounded-rectangle-shape', arcSize: 20 }]));
      expect(xml).toContain('rounded=1');
      expect(xml).not.toContain('rdOwn');
      expect(model.getCell('v')?.getStyle()).toEqual({ arcSize: 20, shape: 'rounded-rectangle-shape' });
    });
  });

  it('keeps <mxGraphModel> attributes beyond the known page settings', () => {
    const backgroundImage = '{"src":"data:image/png;base64,AAAA","width":"10","height":"10"}';
    const xml =
      `<mxGraphModel dx="10" background="#ff0000" backgroundImage="${backgroundImage.replace(/"/g, '&quot;')}" ` +
      'extFonts="Roboto^https://fonts.googleapis.com/css?family=Roboto" adaptiveColors="auto">' +
      '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
    const settings = importDrawioXmlIntoModel(xml, new GraphDataModel());
    expect(settings.extra).toEqual({
      backgroundImage,
      extFonts: 'Roboto^https://fonts.googleapis.com/css?family=Roboto',
      adaptiveColors: 'auto',
    });

    const out = new DOMParser()
      .parseFromString(exportModelToDrawioXml(new GraphDataModel(), { page: settings }), 'text/xml')
      .documentElement;
    expect(out.getAttribute('background')).toBe('#ff0000');
    expect(out.getAttribute('backgroundImage')).toBe(backgroundImage);
    expect(out.getAttribute('extFonts')).toBe('Roboto^https://fonts.googleapis.com/css?family=Roboto');
    expect(out.getAttribute('adaptiveColors')).toBe('auto');
  });

  it('keeps imageBorder/imageBackground colours as strings and reads 0/1 flags as booleans', () => {
    const style = parseStyleString('imageBorder=000000;imageBackground=001100;imageFlipH=1;stencilFlipV=1;container=1;fontColor=000000');
    expect(style).toEqual({
      imageBorder: '000000',
      imageBackground: '001100',
      imageFlipH: true,
      stencilFlipV: true,
      container: true,
      fontColor: '000000',
    });
    expect(styleToString(style)).toBe('imageBorder=000000;imageBackground=001100;imageFlipH=1;stencilFlipV=1;container=1;fontColor=000000;');
  });

  describe('cell structure', () => {
    it('rejects a cell whose parent does not exist instead of dropping the diagram', () => {
      const xml = wrap('<mxCell id="2" vertex="1" parent="99"/><mxCell id="3" vertex="1" parent="1"/>');
      expect(() => importDrawioXmlIntoModel(xml, new GraphDataModel())).toThrow(
        'The diagram is damaged: cell "2" refers to the missing parent "99"'
      );
    });

    it('rejects a parent cycle cut off from the root', () => {
      const xml = wrap('<mxCell id="2" vertex="1" parent="3"/><mxCell id="3" vertex="1" parent="2"/>');
      expect(() => importDrawioXmlIntoModel(xml, new GraphDataModel())).toThrow(/parent cycle/);
    });

    it('rejects a second root cell', () => {
      const xml = wrap('<mxCell id="2"/>');
      expect(() => importDrawioXmlIntoModel(xml, new GraphDataModel())).toThrow(/2 root cells/);
    });

    it('keeps an edge whose terminal is missing (only that connection is lost)', () => {
      const model = new GraphDataModel();
      importDrawioXmlIntoModel(
        wrap('<mxCell id="2" vertex="1" parent="1"/><mxCell id="3" edge="1" parent="1" source="2" target="77"><mxGeometry relative="1" as="geometry"/></mxCell>'),
        model
      );
      expect(model.getCell('2')).toBeTruthy();
      expect(model.getCell('3')?.getTerminal(true)).toBe(model.getCell('2'));
    });

    it('reports duplicate ids inside UserObject wrappers and a second <root> readably', () => {
      const inWrapper = wrap(
        '<object label="a"><mxCell id="2" vertex="1" parent="1"/></object><mxCell id="2" vertex="1" parent="1"/>'
      );
      expect(() => importDrawioXmlIntoModel(inWrapper, new GraphDataModel())).toThrow(
        'The diagram contains the cell id "2" more than once'
      );
      const twoRoots =
        '<mxGraphModel><root><mxCell id="0"/></root><root><mxCell id="0"/></root></mxGraphModel>';
      expect(() => importDrawioXmlIntoModel(twoRoots, new GraphDataModel())).toThrow(
        'The diagram contains more than one <root> element'
      );
    });

    it('still reads a UserObject with its id on the inner <mxCell>', () => {
      const model = new GraphDataModel();
      importDrawioXmlIntoModel(wrap('<object label="a"><mxCell id="2" vertex="1" parent="1"/></object>'), model);
      expect(model.getCell('2')?.isVertex()).toBe(true);
    });
  });

  describe('XML-forbidden characters', () => {
    it.each([
      ['vt\u000bx', 'vtx'],
      ['nul\u0001x', 'nulx'],
      ['ff\u000cx', 'ffx'],
      ['bad\uFFFFx', 'badx'],
      ['tab\tnl\ncr', 'tab\tnl\ncr'],
    ])('writes a reloadable file for label %j', (label, expected) => {
      const xml = exportModelToDrawioXml(modelWith(['v', label, {}]));
      const restored = new GraphDataModel();
      importDrawioXmlIntoModel(xml, restored);
      expect(restored.getCell('v')?.getValue()).toBe(expected);
    });

    it('sanitizes UserObject attributes and keeps valid surrogate pairs', () => {
      const doc = new DOMParser().parseFromString('<UserObject/>', 'text/xml');
      const value = doc.documentElement;
      value.setAttribute('label', 'a\u0002b 🚆');
      value.setAttribute('note', 'x\u0008');
      const xml = exportModelToDrawioXml(modelWith(['v', value, {}]));
      const restored = new GraphDataModel();
      importDrawioXmlIntoModel(xml, restored);
      const out = restored.getCell('v')?.getValue() as Element;
      expect(out.getAttribute('label')).toBe('ab 🚆');
      expect(out.getAttribute('note')).toBe('x');
    });

    it('replaces lone surrogates and opens caches written before the fix', () => {
      expect(sanitizeXmlText('a\ud800b\udc00c🚆')).toBe('a\uFFFDb\uFFFDc🚆');
      const graph = createTestGraph();
      try {
        new SaveLoadController(graph).load(wrap('<mxCell id="2" value="v\u000bt" vertex="1" parent="1"/>'));
        expect(graph.getDataModel().getCell('2')?.getValue()).toBe('vt');
      } finally {
        cleanupTestGraph(graph);
      }
    });
  });

  describe('input limits', () => {
    it('rejects deeply nested XML instead of decoding it', () => {
      let nested = '';
      for (let i = 0; i < 1000; i++) nested += '<Array as="points">';
      for (let i = 0; i < 1000; i++) nested += '</Array>';
      const xml = wrap(`<mxCell id="2" edge="1" parent="1"><mxGeometry relative="1" as="geometry">${nested}</mxGeometry></mxCell>`);
      // Before the limit this decoded (super-linear time); 50k levels froze the tab
      expect(() => importModelXml(xml, new GraphDataModel())).toThrow(`nested too deeply (more than ${MAX_MODEL_XML_DEPTH} levels)`);
      const legacy = `<GraphDataModel><root>${nested}</root></GraphDataModel>`;
      expect(() => importModelXml(legacy, new GraphDataModel())).toThrow(/nested too deeply/);
    });

    it('stops inflating a compressed page past the size limit', async () => {
      const saved = ProjectService.maxInflatedBytes;
      ProjectService.maxInflatedBytes = 1024 * 1024;
      try {
        const bomb = deflateRawSync(Buffer.alloc(8 * 1024 * 1024, 0x61)).toString('base64');
        await expect(ProjectService.decompressDiagram(bomb)).rejects.toThrow(/too large to open/);
        const small = deflateRawSync(Buffer.from(encodeURIComponent(wrap('')))).toString('base64');
        await expect(ProjectService.decompressDiagram(small)).resolves.toBe(wrap(''));
      } finally {
        ProjectService.maxInflatedBytes = saved;
      }
    });
  });
});

describe('PlantUML metadata survives a draw.io re-save', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('stores the metadata in the group cell style, which draw.io keeps', async () => {
    const graph = createTestGraph();
    const target = createTestGraph();
    try {
      const manager = new PlantUmlGroupManager(graph);
      const group = manager.createPlantUmlGroup(graph.getDefaultParent(), 'Sekwencja', '@startuml\nA -> B: żółw\n@enduml', 'sequence');
      const metadata = manager.getPlantUmlMetadata(group);
      const projectXml = new ProjectService().generateProjectXml(new SaveLoadController(graph).serializeToXml());

      // draw.io re-encodes <diagram> from its model: comments are gone, style keys stay
      const doc = new DOMParser().parseFromString(projectXml, 'text/xml');
      const diagram = doc.getElementsByTagName('diagram')[0];
      Array.from(diagram.childNodes)
        .filter((node) => node.nodeType === Node.COMMENT_NODE)
        .forEach((node) => diagram.removeChild(node));
      const resaved = new XMLSerializer().serializeToString(doc);
      expect(resaved).not.toContain('PLANTUML_METADATA');
      expect(resaved).toContain('rdPlantUml=');

      const parsed = await new ProjectService().parseProjectXml(resaved);
      new SaveLoadController(target).load(parsed.graphXml);
      const restored = target.getDataModel().getCell(group.getId()!);
      expect(new PlantUmlGroupManager(target).getPlantUmlMetadata(restored)).toEqual(metadata);
      // The key is internal: it does not stay in the cell style
      expect((restored?.getStyle() as Record<string, unknown>).rdPlantUml).toBeUndefined();
    } finally {
      cleanupTestGraph(graph);
      cleanupTestGraph(target);
    }
  });
});
