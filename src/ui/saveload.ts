import { Graph, ModelXmlSerializer } from '@maxgraph/core';

export class SaveLoadController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
      }
    });
  }

  save(): string {
    const xml = this.serializeToXml();
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('[SaveLoad] Diagram saved');
    return xml;
  }

  load(xml: string) {
    try {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const root = doc.documentElement;

      if (root.nodeName === 'parsererror') {
        throw new Error('Invalid XML');
      }

      this.graph.batchUpdate(() => {
        (this.graph as any).model.clear();
        const encoder = new (ModelXmlSerializer as any)();
        const cells = encoder.import(root);
        this.graph.importCells(cells);
      });

      console.log('[SaveLoad] Diagram loaded');
    } catch (e) {
      console.error('[SaveLoad] Failed to load diagram:', e);
    }
  }

  serializeToXml(): string {
    const model = (this.graph as any).model;
    const encoder = new ModelXmlSerializer(model);
    const xml = (encoder as any).export(model);
    return new XMLSerializer().serializeToString(xml);
  }

  exportAsJson(): string {
    const model = (this.graph as any).model;
    const children = (model as any).children || [];
    const data = children.map((cell: any) => ({
      id: cell.id,
      label: cell.value,
      geometry: cell.geometry
        ? {
            x: cell.geometry.x,
            y: cell.geometry.y,
            width: cell.geometry.width,
            height: cell.geometry.height,
          }
        : null,
      style: cell.style,
      isVertex: cell.isVertex?.(),
      isEdge: cell.isEdge?.(),
    }));

    return JSON.stringify(data, null, 2);
  }
}
