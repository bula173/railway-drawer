/**
 * Shape Deduplicator
 * Identify and merge duplicate shapes across categories
 */

import { ShapeDefinition } from './shapes-library';

export interface DuplicateGroup {
  canonical: ShapeDefinition;
  duplicates: ShapeDefinition[];
  reason: 'visual-match' | 'name-variant' | 'category-only';
}

export class ShapeDeduplicator {
  /**
   * Find duplicate shapes by visual similarity and naming
   */
  static findDuplicates(shapes: ShapeDefinition[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    shapes.forEach((shape) => {
      if (processed.has(shape.name)) return;

      // Find visually similar shapes (same shape type)
      const similar = shapes.filter((s) => s.shape === shape.shape && s.name !== shape.name);

      // Find name variants (e.g., 'rectangle' vs 'rect', 'ellipse' vs 'circle')
      const nameVariants = this.findNameVariants(shape.name, shapes);

      // Find category-only duplicates (same exact name, different category)
      const categoryDups = this.findCategoryDuplicates(shape, shapes);

      const allDups = [...new Set([...similar, ...nameVariants, ...categoryDups])];

      if (allDups.length > 0) {
        const group: DuplicateGroup = {
          canonical: shape,
          duplicates: allDups,
          reason: this.determineReason(shape, allDups),
        };
        groups.push(group);

        // Mark all as processed
        processed.add(shape.name);
        allDups.forEach((dup) => processed.add(dup.name));
      }
    });

    return groups;
  }

  /**
   * Find name variants of a shape
   */
  private static findNameVariants(name: string, shapes: ShapeDefinition[]): ShapeDefinition[] {
    const variants = new Map<string, Set<string>>();

    // Common shape aliases - bidirectional
    variants.set('rectangle', new Set(['rect', 'box']));
    variants.set('rect', new Set(['rectangle', 'box']));
    variants.set('box', new Set(['rectangle', 'rect']));
    variants.set('ellipse', new Set(['circle']));
    variants.set('circle', new Set(['ellipse']));
    variants.set('rhombus', new Set(['diamond']));
    variants.set('diamond', new Set(['rhombus']));
    variants.set('doubleellipse', new Set(['circle', 'ellipse']));
    variants.set('cylinder', new Set(['database', 'db']));
    variants.set('database', new Set(['cylinder', 'db']));
    variants.set('db', new Set(['cylinder', 'database']));
    variants.set('hexagon', new Set(['hex']));
    variants.set('hex', new Set(['hexagon']));
    variants.set('triangle', new Set(['tri']));
    variants.set('tri', new Set(['triangle']));

    const normalized = name.toLowerCase();
    const variantNames = variants.get(normalized) || new Set<string>();

    return shapes.filter((s) => variantNames.has(s.name.toLowerCase()) && s.name !== name);
  }

  /**
   * Find duplicates in different categories
   */
  private static findCategoryDuplicates(shape: ShapeDefinition, shapes: ShapeDefinition[]): ShapeDefinition[] {
    return shapes.filter(
      (s) =>
        s.name.toLowerCase() === shape.name.toLowerCase() &&
        s.category !== shape.category &&
        s.shape === shape.shape
    );
  }

  /**
   * Determine the reason for duplication
   */
  private static determineReason(
    canonical: ShapeDefinition,
    duplicates: ShapeDefinition[]
  ): 'visual-match' | 'name-variant' | 'category-only' {
    if (duplicates.every((d) => d.category === canonical.category)) {
      return 'name-variant';
    }

    if (duplicates.every((d) => d.name.toLowerCase() === canonical.name.toLowerCase())) {
      return 'category-only';
    }

    return 'visual-match';
  }

  /**
   * Merge duplicate shapes, keeping only canonical
   */
  static deduplicateShapes(shapes: ShapeDefinition[]): ShapeDefinition[] {
    const duplicates = this.findDuplicates(shapes);
    const toRemove = new Set<string>();

    duplicates.forEach((group) => {
      group.duplicates.forEach((dup) => {
        toRemove.add(dup.name);
      });
    });

    return shapes.filter((s) => !toRemove.has(s.name));
  }

  /**
   * Get deduplication report
   */
  static generateReport(shapes: ShapeDefinition[]): string {
    const duplicates = this.findDuplicates(shapes);

    if (duplicates.length === 0) {
      return 'No duplicates found. All shapes are unique.';
    }

    let report = `Found ${duplicates.length} duplicate groups:\n\n`;

    duplicates.forEach((group, index) => {
      report += `${index + 1}. Canonical: "${group.canonical.name}" (${group.canonical.category})\n`;
      report += `   Reason: ${group.reason}\n`;
      report += `   Duplicates:\n`;
      group.duplicates.forEach((dup) => {
        report += `     - "${dup.name}" (${dup.category})\n`;
      });
      report += '\n';
    });

    const duplicateCount = duplicates.reduce((sum, g) => sum + g.duplicates.length, 0);
    report += `Total duplicates: ${duplicateCount}/${shapes.length} shapes`;

    return report;
  }

  /**
   * Suggest canonical shape for a group
   */
  static suggestCanonical(shapes: ShapeDefinition[]): ShapeDefinition {
    // Prefer by: shortest name, standard category, native shape
    return shapes.sort((a, b) => {
      // Prefer 'General' or 'Basic' category
      const categoryA = a.category === 'General' || a.category === 'Basic' ? 0 : 1;
      const categoryB = b.category === 'General' || b.category === 'Basic' ? 0 : 1;

      if (categoryA !== categoryB) return categoryA - categoryB;

      // Prefer native shapes (starts with lowercase single word)
      const isNativeA = /^[a-z]+$/.test(a.name) ? 0 : 1;
      const isNativeB = /^[a-z]+$/.test(b.name) ? 0 : 1;

      if (isNativeA !== isNativeB) return isNativeA - isNativeB;

      // Prefer shorter names
      return a.name.length - b.name.length;
    })[0];
  }
}
