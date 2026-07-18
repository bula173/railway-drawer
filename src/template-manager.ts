/**
 * Template Manager
 * Save and load diagram templates
 */

export interface DiagramTemplate {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  cells: any[];
  edges: any[];
  metadata: {
    created: number;
    updated: number;
    tags: string[];
    category: string;
  };
}

export class TemplateManager {
  private templates: Map<string, DiagramTemplate> = new Map();

  constructor(private graph: any) {
    this.initializeBuiltInTemplates();
  }

  /**
   * Initialize built-in templates
   */
  private initializeBuiltInTemplates(): void {
    const flowchartTemplate: DiagramTemplate = {
      id: 'flowchart-basic',
      name: 'Basic Flowchart',
      description: 'Start with a simple flowchart structure',
      cells: [
        {
          value: 'Start',
          geometry: { x: 250, y: 20, width: 100, height: 40 },
          style: { shape: 'ellipse', fillColor: '#90ee90' },
        },
        {
          value: 'Process',
          geometry: { x: 250, y: 100, width: 100, height: 40 },
          style: { shape: 'rectangle', fillColor: '#87ceeb' },
        },
        {
          value: 'Decision',
          geometry: { x: 250, y: 200, width: 100, height: 60 },
          style: { shape: 'diamond', fillColor: '#ffd700' },
        },
        {
          value: 'End',
          geometry: { x: 250, y: 300, width: 100, height: 40 },
          style: { shape: 'ellipse', fillColor: '#ff6b6b' },
        },
      ],
      edges: [
        { sourceIdx: 0, targetIdx: 1, value: '' },
        { sourceIdx: 1, targetIdx: 2, value: 'Yes' },
        { sourceIdx: 2, targetIdx: 3, value: '' },
      ],
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags: ['flowchart', 'basic'],
        category: 'diagrams',
      },
    };

    const umlClassTemplate: DiagramTemplate = {
      id: 'uml-class',
      name: 'UML Class Diagram',
      description: 'Template for UML class diagrams',
      cells: [
        {
          value: 'Class1\n---\nattribute: String\n---\nmethod()',
          geometry: { x: 50, y: 50, width: 150, height: 100 },
          style: { shape: 'rectangle', fillColor: '#fff5e6' },
        },
        {
          value: 'Class2\n---\nattribute: int\n---\nmethod()',
          geometry: { x: 300, y: 50, width: 150, height: 100 },
          style: { shape: 'rectangle', fillColor: '#fff5e6' },
        },
      ],
      edges: [{ sourceIdx: 0, targetIdx: 1, value: 'inherits' }],
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags: ['uml', 'class', 'oop'],
        category: 'diagrams',
      },
    };

    const networkTemplate: DiagramTemplate = {
      id: 'network-basic',
      name: 'Network Diagram',
      description: 'Basic network topology',
      cells: [
        {
          value: 'Server',
          geometry: { x: 200, y: 50, width: 80, height: 80 },
          style: { shape: 'rectangle', fillColor: '#ccccff' },
        },
        {
          value: 'Client 1',
          geometry: { x: 50, y: 200, width: 80, height: 60 },
          style: { shape: 'ellipse', fillColor: '#ccffcc' },
        },
        {
          value: 'Client 2',
          geometry: { x: 200, y: 200, width: 80, height: 60 },
          style: { shape: 'ellipse', fillColor: '#ccffcc' },
        },
        {
          value: 'Client 3',
          geometry: { x: 350, y: 200, width: 80, height: 60 },
          style: { shape: 'ellipse', fillColor: '#ccffcc' },
        },
      ],
      edges: [
        { sourceIdx: 0, targetIdx: 1, value: '' },
        { sourceIdx: 0, targetIdx: 2, value: '' },
        { sourceIdx: 0, targetIdx: 3, value: '' },
      ],
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags: ['network', 'topology'],
        category: 'infrastructure',
      },
    };

    this.templates.set('flowchart-basic', flowchartTemplate);
    this.templates.set('uml-class', umlClassTemplate);
    this.templates.set('network-basic', networkTemplate);
  }

  /**
   * Get all templates
   */
  getTemplates(): DiagramTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): DiagramTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): DiagramTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.metadata.category === category);
  }

  /**
   * Get templates by tags
   */
  getTemplatesByTags(tags: string[]): DiagramTemplate[] {
    return Array.from(this.templates.values()).filter((t) =>
      tags.some((tag) => t.metadata.tags.includes(tag))
    );
  }

  /**
   * Create template from current diagram
   */
  createTemplateFromDiagram(name: string, description: string, category: string, tags: string[]): string {
    const id = `template-${Date.now()}`;
    const cells = this.serializeCells();

    const template: DiagramTemplate = {
      id,
      name,
      description,
      cells: cells.vertices,
      edges: cells.edges,
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags,
        category,
      },
    };

    this.templates.set(id, template);
    return id;
  }

  /**
   * Load template into graph
   */
  loadTemplate(templateId: string): boolean {
    const template = this.getTemplate(templateId);
    if (!template) return false;

    // Clear current diagram
    const parent = this.graph.getDefaultParent();
    if (parent?.children) {
      this.graph.removeCells([...parent.children]);
    }

    // Create cells from template
    const cellMap = new Map<number, any>();

    template.cells.forEach((cellData, index) => {
      const cell = this.graph.insertVertex({
        position: [cellData.geometry.x, cellData.geometry.y],
        size: [cellData.geometry.width, cellData.geometry.height],
        value: cellData.value,
        style: cellData.style,
      });

      cellMap.set(index, cell);
    });

    // Create edges
    template.edges.forEach((edgeData) => {
      const sourceCell = cellMap.get(edgeData.sourceIdx);
      const targetCell = cellMap.get(edgeData.targetIdx);

      if (sourceCell && targetCell) {
        this.graph.insertEdge({
          source: sourceCell,
          target: targetCell,
          value: edgeData.value,
          style: edgeData.style || {},
        });
      }
    });

    this.graph.view.refresh();
    return true;
  }

  /**
   * Update template
   */
  updateTemplate(templateId: string, updates: Partial<DiagramTemplate>): boolean {
    const template = this.getTemplate(templateId);
    if (!template) return false;

    const updated = {
      ...template,
      ...updates,
      metadata: {
        ...template.metadata,
        updated: Date.now(),
      },
    };

    this.templates.set(templateId, updated);
    return true;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    // Don't allow deleting built-in templates
    if (templateId.startsWith('flowchart-') || templateId.startsWith('uml-') || templateId.startsWith('network-')) {
      return false;
    }

    return this.templates.delete(templateId);
  }

  /**
   * Export template as JSON
   */
  exportTemplate(templateId: string): string | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;
    return JSON.stringify(template);
  }

  /**
   * Import template from JSON
   */
  importTemplate(jsonData: string): boolean {
    try {
      const template = JSON.parse(jsonData) as DiagramTemplate;
      if (template.id && template.name && Array.isArray(template.cells)) {
        template.metadata.updated = Date.now();
        this.templates.set(template.id, template);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Export all templates as JSON
   */
  exportAllTemplates(): string {
    const templatesArray = Array.from(this.templates.values());
    return JSON.stringify(templatesArray);
  }

  /**
   * Import all templates from JSON
   */
  importAllTemplates(jsonData: string): boolean {
    try {
      const templatesArray = JSON.parse(jsonData) as DiagramTemplate[];
      templatesArray.forEach((template) => {
        template.metadata.updated = Date.now();
        this.templates.set(template.id, template);
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate thumbnail (base64 SVG)
   */
  generateThumbnail(templateId: string): string | null {
    const template = this.getTemplate(templateId);
    if (!template || template.cells.length === 0) return null;

    // Calculate bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    template.cells.forEach((cell) => {
      minX = Math.min(minX, cell.geometry.x);
      minY = Math.min(minY, cell.geometry.y);
      maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
      maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
    });

    const width = maxX - minX + 40;
    const height = maxY - minY + 40;

    // Create SVG
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;

    template.cells.forEach((cell) => {
      const x = cell.geometry.x - minX + 20;
      const y = cell.geometry.y - minY + 20;
      const w = cell.geometry.width;
      const h = cell.geometry.height;
      const fill = cell.style?.fillColor || '#ffffff';

      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="black" stroke-width="1"/>`;
      svg += `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-size="10">${cell.value}</text>`;
    });

    svg += '</svg>';

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Serialize current diagram
   */
  private serializeCells(): { vertices: any[]; edges: any[] } {
    const parent = this.graph.getDefaultParent();
    if (!parent?.children) return { vertices: [], edges: [] };

    const vertices: any[] = [];
    const edges: any[] = [];
    const cellMap = new Map<string, number>();

    parent.children.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        cellMap.set(cell.id, vertices.length);
        vertices.push({
          value: cell.value,
          geometry: {
            x: cell.geometry?.x,
            y: cell.geometry?.y,
            width: cell.geometry?.width,
            height: cell.geometry?.height,
          },
          style: { ...cell.style },
        });
      }
    });

    parent.children.forEach((cell: any) => {
      if (cell.isEdge?.()) {
        const sourceIdx = cellMap.get(cell.source?.id);
        const targetIdx = cellMap.get(cell.target?.id);

        if (sourceIdx !== undefined && targetIdx !== undefined) {
          edges.push({
            sourceIdx,
            targetIdx,
            value: cell.value,
            style: { ...cell.style },
          });
        }
      }
    });

    return { vertices, edges };
  }
}
