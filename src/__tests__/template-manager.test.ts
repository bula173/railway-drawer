import { TemplateManager } from '../template-manager';

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      insertVertex: jest.fn().mockReturnValue({
        id: 'new-vertex',
        geometry: { x: 0, y: 0, width: 80, height: 60 },
        value: 'Vertex',
      }),
      insertEdge: jest.fn().mockReturnValue({
        id: 'new-edge',
        value: 'Edge',
      }),
      removeCells: jest.fn(),
      getDefaultParent: jest.fn().mockReturnValue({
        children: [],
      }),
    };

    templateManager = new TemplateManager(mockGraph);
  });

  it('should initialize with built-in templates', () => {
    const templates = templateManager.getTemplates();

    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(templates.find((t) => t.id === 'flowchart-basic')).toBeDefined();
  });

  it('should get template by ID', () => {
    const template = templateManager.getTemplate('flowchart-basic');

    expect(template).toBeDefined();
    expect(template?.name).toBe('Basic Flowchart');
    expect(template?.cells.length).toBeGreaterThan(0);
  });

  it('should return null for non-existent template', () => {
    const template = templateManager.getTemplate('nonexistent');

    expect(template).toBeNull();
  });

  it('should get templates by category', () => {
    const templates = templateManager.getTemplatesByCategory('diagrams');

    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.metadata.category === 'diagrams')).toBe(true);
  });

  it('should get templates by tags', () => {
    const templates = templateManager.getTemplatesByTags(['flowchart']);

    expect(templates.length).toBeGreaterThan(0);
  });

  it('should create template from current diagram', () => {
    const templateId = templateManager.createTemplateFromDiagram(
      'My Template',
      'Test template',
      'test',
      ['test']
    );

    expect(templateId).toBeDefined();
    const template = templateManager.getTemplate(templateId);
    expect(template?.name).toBe('My Template');
  });

  it('should load template into graph', () => {
    const loaded = templateManager.loadTemplate('flowchart-basic');

    expect(loaded).toBe(true);
    expect(mockGraph.removeCells).toHaveBeenCalled();
    expect(mockGraph.insertVertex).toHaveBeenCalled();
  });

  it('should fail to load non-existent template', () => {
    const loaded = templateManager.loadTemplate('nonexistent');

    expect(loaded).toBe(false);
  });

  it('should update template', () => {
    const templateId = templateManager.createTemplateFromDiagram('Original', '', 'test', []);

    const updated = templateManager.updateTemplate(templateId, { name: 'Updated' });

    expect(updated).toBe(true);
    const template = templateManager.getTemplate(templateId);
    expect(template?.name).toBe('Updated');
  });

  it('should not update non-existent template', () => {
    const updated = templateManager.updateTemplate('nonexistent', { name: 'Updated' });

    expect(updated).toBe(false);
  });

  it('should delete custom template', () => {
    const templateId = templateManager.createTemplateFromDiagram('Temp', '', 'test', []);

    const deleted = templateManager.deleteTemplate(templateId);

    expect(deleted).toBe(true);
    expect(templateManager.getTemplate(templateId)).toBeNull();
  });

  it('should not delete built-in templates', () => {
    const deleted = templateManager.deleteTemplate('flowchart-basic');

    expect(deleted).toBe(false);
  });

  it('should export template as JSON', () => {
    const json = templateManager.exportTemplate('flowchart-basic');

    expect(json).toBeDefined();
    const parsed = JSON.parse(json!);
    expect(parsed.name).toBe('Basic Flowchart');
  });

  it('should return null for non-existent template export', () => {
    const json = templateManager.exportTemplate('nonexistent');

    expect(json).toBeNull();
  });

  it('should import template from JSON', () => {
    const templateData = {
      id: 'import-test',
      name: 'Imported',
      cells: [{ value: 'Test', geometry: { x: 0, y: 0, width: 80, height: 60 } }],
      edges: [],
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags: [],
        category: 'test',
      },
    };

    const result = templateManager.importTemplate(JSON.stringify(templateData));

    expect(result).toBe(true);
    const template = templateManager.getTemplate('import-test');
    expect(template?.name).toBe('Imported');
  });

  it('should handle invalid JSON on import', () => {
    const result = templateManager.importTemplate('invalid json');

    expect(result).toBe(false);
  });

  it('should export all templates', () => {
    const json = templateManager.exportAllTemplates();

    expect(json).toBeDefined();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('should import all templates', () => {
    const json = templateManager.exportAllTemplates();

    const newManager = new TemplateManager(mockGraph);
    const result = newManager.importAllTemplates(json);

    expect(result).toBe(true);
  });

  it('should generate thumbnail for template', () => {
    const thumbnail = templateManager.generateThumbnail('flowchart-basic');

    expect(thumbnail).toBeDefined();
    expect(thumbnail).toContain('data:image/svg+xml;base64');
  });

  it('should return null for thumbnail of non-existent template', () => {
    const thumbnail = templateManager.generateThumbnail('nonexistent');

    expect(thumbnail).toBeNull();
  });

  it('should have metadata with timestamps', () => {
    const templateId = templateManager.createTemplateFromDiagram('Test', '', 'test', []);
    const template = templateManager.getTemplate(templateId);

    expect(template?.metadata.created).toBeDefined();
    expect(template?.metadata.updated).toBeDefined();
    expect(typeof template?.metadata.created).toBe('number');
  });

  it('should update timestamp when updating template', () => {
    const templateId = templateManager.createTemplateFromDiagram('Test', '', 'test', []);
    const before = templateManager.getTemplate(templateId)!.metadata.updated;

    // Small delay to ensure timestamp difference
    setTimeout(() => {
      templateManager.updateTemplate(templateId, { name: 'Updated' });
      const after = templateManager.getTemplate(templateId)!.metadata.updated;

      expect(after).toBeGreaterThanOrEqual(before);
    }, 10);
  });

  it('should preserve template structure on export/import', () => {
    const originalId = templateManager.createTemplateFromDiagram('Test', 'Description', 'test', ['tag1']);
    const json = templateManager.exportTemplate(originalId);

    const newManager = new TemplateManager(mockGraph);
    newManager.importTemplate(json!);
    const imported = newManager.getTemplate(originalId);

    expect(imported?.name).toBe('Test');
    expect(imported?.description).toBe('Description');
  });

  it('should handle empty diagram serialization', () => {
    mockGraph.getDefaultParent().children = [];

    const templateId = templateManager.createTemplateFromDiagram('Empty', '', 'test', []);
    const template = templateManager.getTemplate(templateId);

    expect(template?.cells.length).toBe(0);
    expect(template?.edges.length).toBe(0);
  });

  it('should load template with edges', () => {
    const loaded = templateManager.loadTemplate('network-basic');

    expect(loaded).toBe(true);
    expect(mockGraph.insertEdge).toHaveBeenCalled();
  });
});
