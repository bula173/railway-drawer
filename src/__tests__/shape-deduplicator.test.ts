import { ShapeDeduplicator } from '../shapes/shape-deduplicator';
import { ShapeDefinition } from '../shapes/shapes-library';

describe('ShapeDeduplicator', () => {
  const createShape = (
    name: string,
    label: string,
    category: string,
    shape: string = 'rectangle'
  ): ShapeDefinition => ({
    name,
    label,
    category,
    shape,
    width: 80,
    height: 60,
  });

  it('should identify no duplicates when all shapes are unique', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
      createShape('triangle', 'Triangle', 'Basic', 'triangle'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBe(0);
  });

  it('should find name variants (rectangle vs rect)', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rect', 'Rect', 'Basic', 'rectangle'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].reason).toBe('name-variant');
  });

  it('should find shape variants (ellipse vs circle)', () => {
    const shapes: ShapeDefinition[] = [
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
      createShape('circle', 'Circle', 'Basic', 'ellipse'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(0);
  });

  it('should find category-only duplicates', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rectangle', 'Rect', 'General', 'rectangle'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(0);
  });

  it('should deduplicate shapes keeping canonical only', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rect', 'Rect', 'Basic', 'rectangle'),
      createShape('box', 'Box', 'Shapes', 'rectangle'),
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
      createShape('circle', 'Circle', 'Basic', 'ellipse'),
    ];

    const deduped = ShapeDeduplicator.deduplicateShapes(shapes);

    // Should keep some shapes but remove duplicates
    expect(deduped.length).toBeLessThan(shapes.length);
  });

  it('should handle rhombus/diamond aliases', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rhombus', 'Rhombus', 'Basic', 'rhombus'),
      createShape('diamond', 'Diamond', 'Shapes', 'rhombus'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(0);
  });

  it('should handle cylinder/database aliases', () => {
    const shapes: ShapeDefinition[] = [
      createShape('cylinder', 'Cylinder', 'Basic', 'cylinder'),
      createShape('database', 'Database', 'Flowchart', 'cylinder'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(0);
  });

  it('should generate deduplication report', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rect', 'Rect', 'Basic', 'rectangle'),
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
      createShape('circle', 'Circle', 'Shapes', 'ellipse'),
    ];

    const report = ShapeDeduplicator.generateReport(shapes);

    expect(report).toContain('Found');
    expect(report).toContain('duplicate');
    expect(report).toContain('Canonical');
  });

  it('should report no duplicates when none exist', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
    ];

    const report = ShapeDeduplicator.generateReport(shapes);

    expect(report).toContain('No duplicates found');
  });

  it('should suggest canonical shape preferring standard categories', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Other', 'rectangle'),
      createShape('rect', 'Rect', 'General', 'rectangle'),
      createShape('box', 'Box', 'Advanced', 'rectangle'),
    ];

    const canonical = ShapeDeduplicator.suggestCanonical(shapes);

    expect(canonical.category).toBe('General');
  });

  it('should suggest canonical shape by name length', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rect', 'Rect', 'Basic', 'rectangle'),
      createShape('r', 'R', 'Basic', 'rectangle'),
    ];

    const canonical = ShapeDeduplicator.suggestCanonical(shapes);

    expect(canonical.name.length).toBeLessThanOrEqual(shapes[0].name.length);
  });

  it('should handle visual matches across same shape type', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('box', 'Box', 'Basic', 'rectangle'),
      createShape('square', 'Square', 'Basic', 'rectangle'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(0);
  });

  it('should not flag different shape types as duplicates', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rectangle2', 'Rectangle2', 'Basic', 'ellipse'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    // Different shape types, so should not be duplicates
    expect(duplicates.length).toBe(0);
  });

  it('should handle multiple duplicate groups', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rect', 'Rect', 'Basic', 'rectangle'),
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
      createShape('circle', 'Circle', 'Basic', 'ellipse'),
      createShape('triangle', 'Triangle', 'Basic', 'triangle'),
      createShape('tri', 'Tri', 'Basic', 'triangle'),
    ];

    const duplicates = ShapeDeduplicator.findDuplicates(shapes);

    expect(duplicates.length).toBeGreaterThan(1);
  });

  it('should count total duplicates correctly in report', () => {
    const shapes: ShapeDefinition[] = [
      createShape('rectangle', 'Rectangle', 'Basic', 'rectangle'),
      createShape('rect', 'Rect', 'Basic', 'rectangle'),
      createShape('box', 'Box', 'Basic', 'rectangle'),
      createShape('ellipse', 'Ellipse', 'Basic', 'ellipse'),
      createShape('circle', 'Circle', 'Basic', 'ellipse'),
    ];

    const report = ShapeDeduplicator.generateReport(shapes);

    expect(report).toContain('Total duplicates');
  });
});
