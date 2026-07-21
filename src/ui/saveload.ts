import { Graph, ModelXmlSerializer } from '@maxgraph/core';
import { ProjectService } from '../services/project-service';

export class SaveLoadController {
  private graph: Graph;
  private projectService: ProjectService;
  private isSavedToDisk = false;

  constructor(graph: Graph) {
    this.graph = graph;
    this.projectService = new ProjectService();
    this.setupKeyboardShortcuts();
    this.updateSaveStatus();
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
    try {
      console.log('[SaveLoad] Starting save...');
      const graphXml = this.serializeToXml();
      console.log('[SaveLoad] Graph serialized, length:', graphXml.length);
      const projectXml = this.projectService.generateProjectXml(graphXml);
      console.log('[SaveLoad] Project XML generated, length:', projectXml.length);
      const filename = `${this.projectService.getProjectName() || 'diagram'}.railwaydrawer`;
      console.log('[SaveLoad] Filename:', filename);
      this.projectService.exportToFile(projectXml, filename);
      this.markAsSavedToDisk();
      console.log('[SaveLoad] Project saved as', filename);
    } catch (error) {
      console.error('[SaveLoad] Save failed:', error);
    }
  }

  async loadProjectFromFile(file: File): Promise<void> {
    try {
      console.log('[SaveLoad] Starting file import:', file.name);
      const result = await this.projectService.importFromFile(file);
      console.log('[SaveLoad] File imported, metadata:', result.metadata);
      this.projectService.setProjectName(result.metadata.name);
      console.log('[SaveLoad] Deserializing graph...');

      // Use the same load method that works for cache
      this.load(result.graphXml);

      console.log('[SaveLoad] Graph deserialized');
      this.updateProjectNameUI(result.metadata.name);
      this.markAsSavedToDisk();
      console.log('[SaveLoad] Project loaded:', result.metadata.name);
    } catch (error) {
      console.error('[SaveLoad] Failed to load project:', error);
      alert('Failed to load project file: ' + error);
      throw error;
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
      if (!xml || xml.trim().length === 0) {
        console.warn('[SaveLoad] Empty XML, skipping load');
        return;
      }

      console.log('[SaveLoad] Loading XML, length:', xml.length);

      // ModelXmlSerializer.import(xml) expects a string and modifies the model in-place
      const model = (this.graph as any).model;
      const encoder = new ModelXmlSerializer(model);

      // Clear model before importing
      model.clear();

      // import() takes a string and returns void (modifies model)
      encoder.import(xml);

      this.graph.refresh();
      console.log('[SaveLoad] Diagram loaded');
    } catch (e) {
      console.error('[SaveLoad] Failed to load diagram:', e);
      console.error('[SaveLoad] Stack:', (e as any).stack);
    }
  }


  serializeToXml(): string {
    try {
      console.log('[SaveLoad] Serializing graph...');
      const model = (this.graph as any).model;

      // ModelXmlSerializer.export() returns a string
      const encoder = new ModelXmlSerializer(model);
      const xml = encoder.export();

      console.log('[SaveLoad] Serialized, length:', xml.length);
      return xml;
    } catch (e) {
      console.error('[SaveLoad] Serialization error:', e);
      return '<mxGraphModel><root></root></mxGraphModel>';
    }
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

  private updateSaveStatus(): void {
    const statusElement = document.querySelector('.save-status') as HTMLElement;
    if (statusElement) {
      if (this.isSavedToDisk) {
        statusElement.textContent = '✓ Saved to disk';
        statusElement.style.color = '#4caf50';
      } else {
        statusElement.textContent = '💾 Auto-saving to cache...';
        statusElement.style.color = '#ff9800';
      }
    }
  }

  markAsSavedToDisk(): void {
    this.isSavedToDisk = true;
    this.updateSaveStatus();
    setTimeout(() => {
      this.isSavedToDisk = false;
      this.updateSaveStatus();
    }, 2000);
  }

  markAsChanged(): void {
    this.isSavedToDisk = false;
    this.updateSaveStatus();
  }
}
