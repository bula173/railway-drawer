import { Graph, ModelXmlSerializer } from '@maxgraph/core';
import { ProjectService } from '../services/project-service';

export class SaveLoadController {
  private graph: Graph;
  private projectService: ProjectService;

  constructor(graph: Graph) {
    this.graph = graph;
    this.projectService = new ProjectService();
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveProject();
      }
    });
  }

  saveProject(): void {
    const graphXml = this.serializeToXml();
    const projectXml = this.projectService.generateProjectXml(graphXml);
    const filename = `${this.projectService.getProjectName() || 'diagram'}.drawio`;
    this.projectService.exportToFile(projectXml, filename);
    console.log('[SaveLoad] Project saved as', filename);
  }

  async loadProjectFromFile(file: File): Promise<void> {
    try {
      const result = await this.projectService.importFromFile(file);
      this.projectService.setProjectName(result.metadata.name);
      this.projectService.deserializeGraphFromXml(this.graph, result.graphXml);
      this.updateProjectNameUI(result.metadata.name);
      console.log('[SaveLoad] Project loaded:', result.metadata.name);
    } catch (error) {
      console.error('[SaveLoad] Failed to load project:', error);
      alert('Failed to load project file');
    }
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

  load(xml: string): void {
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

  setProjectName(name: string): void {
    this.projectService.setProjectName(name);
    this.updateProjectNameUI(name);
  }

  getProjectName(): string {
    return this.projectService.getProjectName();
  }

  private updateProjectNameUI(name: string): void {
    const titleElement = document.querySelector('.document-title') as HTMLElement;
    if (titleElement) {
      titleElement.textContent = name;
    }
  }
}
