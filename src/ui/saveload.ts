import { Graph, ModelXmlSerializer } from '@maxgraph/core';
import { ProjectService } from '../services/project-service';
import { PlantUmlGroupManager } from '../services/plantuml-group-manager';

export class SaveLoadController {
  private graph: Graph;
  private projectService: ProjectService;
  private plantumlGroupManager: PlantUmlGroupManager;
  private isSavedToDisk = false;

  constructor(graph: Graph) {
    this.graph = graph;
    this.projectService = new ProjectService();
    this.plantumlGroupManager = new PlantUmlGroupManager(graph);
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

      // Restore PlantUML metadata
      this.restorePlantUmlMetadata(xml);

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

      // Temporarily remove large SVG data URLs to reduce file/cache size
      const svgShapes = this.stripSvgDataUrls();

      // ModelXmlSerializer.export() returns a string
      const encoder = new ModelXmlSerializer(model);
      let xml = encoder.export();

      // Restore SVG data URLs to cells
      this.restoreSvgDataUrls(svgShapes);

      // Embed PlantUML metadata
      xml = this.embedPlantUmlMetadata(xml);

      console.log('[SaveLoad] Serialized, length:', xml.length);
      return xml;
    } catch (e) {
      console.error('[SaveLoad] Serialization error:', e);
      return '<mxGraphModel><root></root></mxGraphModel>';
    }
  }

  private stripSvgDataUrls(): Map<string, string> {
    // Temporarily remove SVG data URLs from cells to reduce serialization size
    const model = (this.graph as any).model;
    const cells = (model as any).cells || {};
    const svgShapes = new Map<string, string>();

    for (const cellId in cells) {
      const cell = cells[cellId];
      if (cell && cell.style && typeof cell.style === 'string') {
        // Check if this cell has an SVG data URL
        // Pattern: image=data:image/svg+xml;base64,...; (matches the entire image property)
        const match = cell.style.match(/image=data:image\/svg\+xml[^;]*;?/);
        if (match) {
          svgShapes.set(cellId, match[0]);
          // Remove the image property from the style
          cell.style = cell.style.replace(match[0], '');
        }
      }
    }

    if (svgShapes.size > 0) {
      console.log(`[SaveLoad] Stripped ${svgShapes.size} SVG data URLs for serialization`);
    }

    return svgShapes;
  }

  private restoreSvgDataUrls(svgShapes: Map<string, string>): void {
    // Restore SVG data URLs to cells after serialization
    const model = (this.graph as any).model;
    const cells = (model as any).cells || {};

    for (const [cellId, imageProp] of svgShapes) {
      const cell = cells[cellId];
      if (cell && cell.style && typeof cell.style === 'string') {
        // Add back the image property
        cell.style = imageProp + cell.style;
      }
    }

    if (svgShapes.size > 0) {
      console.log(`[SaveLoad] Restored ${svgShapes.size} SVG data URLs after serialization`);
    }
  }

  exportAsJson(): string {
    const model = (this.graph as any).model;
    const children = (model as any).children || [];
    const data = children.map((cell: any) => {
      // Clone style and remove large SVG data URLs to reduce export size
      const style = cell.style ? { ...cell.style } : null;
      if (style && style.image && style.image.startsWith('data:image/svg+xml')) {
        // Remove SVG data URL - will be regenerated from shape registry on load
        delete style.image;
      }

      return {
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
        style: style,
        isVertex: cell.isVertex?.(),
        isEdge: cell.isEdge?.(),
      };
    });

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

  /**
   * Embed PlantUML metadata into XML before serialization
   */
  private embedPlantUmlMetadata(xml: string): string {
    try {
      const plantumlGroups = this.plantumlGroupManager.getAllPlantUmlGroups();
      if (plantumlGroups.length === 0) return xml;

      console.log('[SaveLoad] Embedding PlantUML metadata for', plantumlGroups.length, 'groups');

      // Create a root element to hold PlantUML data
      const plantumlData = plantumlGroups.map((group) => {
        const metadata = this.plantumlGroupManager.getPlantUmlMetadata(group);
        return {
          cellId: group.getId(),
          cellLabel: group.getValue(),
          plantumlSource: metadata?.plantumlSource || '',
          diagramType: metadata?.diagramType || '',
          createdAt: metadata?.createdAt || 0,
          lastModified: metadata?.lastModified || 0,
        };
      });

      // Store PlantUML metadata as JSON in a comment at the end
      const comment = `\n<!-- PLANTUML_METADATA:${btoa(JSON.stringify(plantumlData))} -->`;
      return xml + comment;
    } catch (e) {
      console.warn('[SaveLoad] Failed to embed PlantUML metadata:', e);
      return xml; // Return original XML on failure
    }
  }

  /**
   * Extract and restore PlantUML metadata from XML after deserialization
   */
  private restorePlantUmlMetadata(xml: string): void {
    try {
      const match = xml.match(/<!-- PLANTUML_METADATA:(.+?) -->/);
      if (!match || !match[1]) {
        console.log('[SaveLoad] No PlantUML metadata found in XML');
        return;
      }

      const plantumlData = JSON.parse(atob(match[1]));
      console.log('[SaveLoad] Restoring PlantUML metadata for', plantumlData.length, 'groups');

      const model = (this.graph as any).model;
      const cells = (model as any).cells || {};

      plantumlData.forEach((data: any) => {
        const cell = cells[data.cellId];
        if (cell) {
          this.plantumlGroupManager.setPlantUmlMetadata(cell, {
            plantumlSource: data.plantumlSource,
            diagramType: data.diagramType,
            createdAt: data.createdAt,
            lastModified: data.lastModified,
          });
          console.log('[SaveLoad] Restored PlantUML metadata for:', data.cellLabel);
        }
      });
    } catch (e) {
      console.warn('[SaveLoad] Failed to restore PlantUML metadata:', e);
    }
  }
}
