/**
 * Regressions in file open / save:
 * - compressed draw.io pages opened as an empty diagram,
 * - a failed open had already cleared the canvas,
 * - PlantUML metadata with non-Latin-1 text (e.g. Polish) was dropped by btoa(),
 * - pages 2..n of a multi-page .drawio were silently dropped (and lost on save),
 * - a draw.io file's app version (mxfile@version) was written back as this app's format version.
 */
import { on } from '../../core/event-bus';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@maxgraph/core';
import { createTabDocument, SaveLoadController } from '../../ui/saveload';
import { GraphCommandService } from '../../services/graph-command-service';
import { PlantUmlGroupManager } from '../../services/plantuml-group-manager';
import { ProjectService, PROJECT_FORMAT_VERSION } from '../../services/project-service';
import { globalNotificationManager } from '../../ui/notification';
import { createTestGraph, cleanupTestGraph } from '../setup';

const MODEL_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="v1" value="Żółta stacja" vertex="1" parent="1">' +
  '<mxGeometry x="40" y="60" width="120" height="50" as="geometry"/></mxCell>' +
  '</root></mxGraphModel>';

/**
 * MODEL_XML as draw.io stores a compressed page: base64(rawDeflate(encodeURIComponent(xml))).
 * Generated with Node: zlib.deflateRawSync(Buffer.from(encodeURIComponent(MODEL_XML))).toString('base64')
 */
const COMPRESSED_MODEL =
  'jVBJDsIwDHyN7yGhiHPDcuIRFrWaopRUqSnt7wmNoeJQiYOlGXvGGxjbjueInbuEijyYIxgbQ+CM2tGS96BVU4E5gNYqBejTSnUzV1WHke78j2EQx4D+QTkFtoCyBGugNG+814xJ0TNebyhqikzj6sg5JfPOFFriOCWJGLZ5IzVluhP6bCp24pellaOmdtK0kBz2mdffxst5CciFH7p8cq79PPoF';

const PAGE_2_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="p2v" value="Second" vertex="1" parent="1">' +
  '<mxGeometry x="1" y="2" width="3" height="4" as="geometry"/></mxCell>' +
  '</root></mxGraphModel>';

/** Opens `file` in `controller`, saves it, and returns the saved project XML as a document. */
async function openAndSave(controller: SaveLoadController, file: File): Promise<Document> {
  const exportSpy = vi.spyOn(ProjectService.prototype, 'exportToFile').mockImplementation(() => {});
  await controller.loadProjectFromFile(file);
  controller.saveProject();
  expect(exportSpy).toHaveBeenCalledTimes(1);
  return new DOMParser().parseFromString(exportSpy.mock.calls[0][0], 'text/xml');
}

const vertexLabels = (graph: Graph) =>
  graph.getChildVertices(graph.getDefaultParent()).map((cell) => cell.getValue());

describe('SaveLoadController', () => {
  let graph: Graph;
  let commandService: GraphCommandService;
  let controller: SaveLoadController;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    graph = createTestGraph();
    commandService = new GraphCommandService(graph);
    controller = new SaveLoadController(createTabDocument(graph, commandService));
  });

  afterEach(() => {
    commandService.destroy();
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  it('opens a compressed .drawio file', async () => {
    expect(await ProjectService.decompressDiagram(COMPRESSED_MODEL)).toBe(MODEL_XML);

    const file = new File(
      [`<mxfile host="app.diagrams.net"><diagram id="p1" name="Strona 1">${COMPRESSED_MODEL}</diagram></mxfile>`],
      'compressed.drawio',
      { type: 'application/xml' }
    );

    await controller.loadProjectFromFile(file);

    expect(vertexLabels(graph)).toEqual(['Żółta stacja']);
    expect(graph.getDataModel().getCell('v1')?.getGeometry()?.x).toBe(40);
    // The load itself is not undoable
    expect(commandService.canUndo()).toBe(false);
  });

  it('keeps the current diagram when an invalid file is opened', async () => {
    graph.insertVertex(graph.getDefaultParent(), null, 'Keep me', 0, 0, 50, 50);

    const notXml = new File(['this is not a diagram <<<'], 'broken.drawio');
    await expect(controller.loadProjectFromFile(notXml)).rejects.toThrow();

    const wrongRoot = new File(['<mxfile><diagram name="x"><svg/></diagram></mxfile>'], 'svg.drawio');
    await expect(controller.loadProjectFromFile(wrongRoot)).rejects.toThrow();

    const corrupt = new File(['<mxfile><diagram name="x">bm90IGRlZmxhdGU=</diagram></mxfile>'], 'corrupt.drawio');
    await expect(controller.loadProjectFromFile(corrupt)).rejects.toThrow();

    expect(vertexLabels(graph)).toEqual(['Keep me']);
  });

  it('round-trips UTF-8 PlantUML metadata through save and load', () => {
    const manager = new PlantUmlGroupManager(graph);
    const group = graph.insertVertex(graph.getDefaultParent(), 'g1', 'Łódź', 10, 10, 200, 100);
    const source = '@startuml\nAlicja -> Paweł: zażółć gęślą jaźń\n@enduml';
    manager.setPlantUmlMetadata(group, {
      plantumlSource: source,
      diagramType: 'sequence',
      createdAt: 1,
      lastModified: 2,
    });

    const xml = controller.document.serializeToXml();
    expect(xml).toContain('PLANTUML_METADATA_UTF8:');

    const target = createTestGraph();
    try {
      createTabDocument(target).load(xml);
      const restored = target.getDataModel().getCell('g1');
      expect(restored?.getValue()).toBe('Łódź');
      expect(new PlantUmlGroupManager(target).getPlantUmlMetadata(restored)).toEqual({
        plantumlSource: source,
        diagramType: 'sequence',
        createdAt: 1,
        lastModified: 2,
      });
    } finally {
      cleanupTestGraph(target);
    }
  });

  it('warns about and keeps the extra pages of a multi-page .drawio file', async () => {
    const warning = vi.spyOn(globalNotificationManager, 'warning').mockReturnValue('');
    const success = vi.spyOn(globalNotificationManager, 'success').mockReturnValue('');
    const file = new File(
      [
        '<mxfile host="app.diagrams.net" version="24.7.17">' +
          `<diagram id="1" name="Plan">${COMPRESSED_MODEL}</diagram>` +
          `<diagram id="2" name="Szczegóły">${PAGE_2_XML}</diagram>` +
          `<diagram id="3">${COMPRESSED_MODEL}</diagram>` +
          '</mxfile>',
      ],
      'plan.drawio',
      { type: 'application/xml' }
    );

    const saved = await openAndSave(controller, file);

    // Page 1 is loaded
    expect(vertexLabels(graph)).toEqual(['Żółta stacja']);
    // The user is told which pages were not loaded instead of a plain success
    expect(success).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toContain('"Szczegóły", "Page 3"');

    // Pages 2 and 3 are written back unchanged, after the shown page, with unique ids
    const diagrams = Array.from(saved.documentElement.children).filter((el) => el.nodeName === 'diagram');
    expect(diagrams.map((el) => el.getAttribute('name'))).toEqual(['Plan', 'Szczegóły', null]);
    const ids = diagrams.map((el) => el.getAttribute('id'));
    expect(new Set(ids).size).toBe(3);
    expect(diagrams[1].getElementsByTagName('mxCell')[2]?.getAttribute('value')).toBe('Second');
    expect(diagrams[2].textContent).toBe(COMPRESSED_MODEL);
    // The shown page holds the current model, in draw.io's native format
    expect(diagrams[0].firstElementChild?.nodeName).toBe('mxGraphModel');
    expect(diagrams[0].getAttribute('id')).toBe('1');
  });

  it('opens a single-page .drawio file with a plain success message and saves one page', async () => {
    const warning = vi.spyOn(globalNotificationManager, 'warning').mockReturnValue('');
    const success = vi.spyOn(globalNotificationManager, 'success').mockReturnValue('');
    const file = new File(
      [`<mxfile host="app.diagrams.net"><diagram id="p1" name="Only">${MODEL_XML}</diagram></mxfile>`],
      'single.drawio'
    );

    const saved = await openAndSave(controller, file);

    expect(warning).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('Opened single.drawio');
    expect(saved.getElementsByTagName('diagram').length).toBe(1);
  });

  it("writes this app's format version, not draw.io's, when re-saving a draw.io file", async () => {
    vi.spyOn(globalNotificationManager, 'success').mockReturnValue('');
    const file = new File(
      [`<mxfile host="app.diagrams.net" version="24.7.17"><diagram name="d">${MODEL_XML}</diagram></mxfile>`],
      'foreign.drawio'
    );

    const saved = await openAndSave(controller, file);

    expect(saved.documentElement.getAttribute('host')).toBe('railway-drawer');
    expect(saved.documentElement.getAttribute('version')).toBe(PROJECT_FORMAT_VERSION);
  });

  it('keeps the version of a file saved by this app', async () => {
    const result = await new ProjectService().parseProjectXml(
      `<mxfile host="railway-drawer" version="2.0"><diagram name="d">${MODEL_XML}</diagram></mxfile>`
    );
    expect(result.metadata.version).toBe('2.0');
    expect(result.extraPages).toEqual([]);
  });

  it('applies the page grid (grid / gridSize on <mxGraphModel>) to the tab and writes it back', () => {
    const events: unknown[] = [];
    const offGrid = on('rd-grid-settings', ({ graph: g }) => {
      events.push(g);
    });
    controller.document.load(MODEL_XML.replace('<mxGraphModel>', '<mxGraphModel grid="0" gridSize="20">'));
    expect(graph.gridEnabled).toBe(false);
    expect(graph.gridSize).toBe(20);
    expect(events).toEqual([graph]);
    let model = new DOMParser().parseFromString(controller.document.serializeToXml(), 'text/xml').documentElement;
    expect(model.getAttribute('grid')).toBe('0');
    expect(model.getAttribute('gridSize')).toBe('20');
    // View > Grid on -> saved as grid="1"
    graph.gridEnabled = true;
    model = new DOMParser().parseFromString(controller.document.serializeToXml(), 'text/xml').documentElement;
    expect(model.getAttribute('grid')).toBe('1');
    // no attributes: draw.io's defaults (grid on, 10)
    graph.gridEnabled = false;
    controller.document.load(MODEL_XML);
    expect(graph.gridEnabled).toBe(true);
    expect(graph.gridSize).toBe(10);
    offGrid();
  });
});
