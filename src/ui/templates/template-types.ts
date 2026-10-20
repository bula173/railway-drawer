/**
 * @file template-types.ts
 * @brief Diagram templates (built-in ERTMS scenarios and user templates) and their palette entries.
 */
import type { PaletteEntry } from '../drawio-palette/contracts';
import { extractShapeNames } from '../drawio-palette/library-adapter';

export interface DiagramTemplate {
  /** Stable id: `ertms-tpl-<library index>` (built-in) or `tpl-<random>` (user). */
  id: string;
  name: string;
  /** Name before display naming (built-in: "ERTMS scenario <n>"), shown in the tooltip. */
  originalName?: string;
  /** Short subtitle (built-in: distinctive labels of the diagram) or the user's description. */
  description?: string;
  /** Native draw.io `<mxGraphModel>` XML, styles verbatim. */
  xml: string;
  width: number;
  height: number;
  /** Extra search terms (lower case). */
  tags?: string;
  builtIn: boolean;
  /** ms since epoch (user templates). */
  created?: number;
  updated?: number;
}

/** Palette entry for a template, so insertion, thumbnails and drag use the palette code. */
export function templateToPaletteEntry(template: DiagramTemplate): PaletteEntry {
  const tags = [template.tags, template.description].filter((t): t is string => !!t && t.trim() !== '').join(' ');
  return {
    id: `template-${template.id}`,
    title: template.name,
    kind: 'cells',
    width: template.width,
    height: template.height,
    xml: template.xml,
    shapeNames: extractShapeNames(template.xml),
    cls: 'a',
    source: template.builtIn ? 'ertms-template' : 'user-template',
    ...(tags ? { tags } : {}),
  };
}

/** Lower-case text matched by the template search (name, description, tags). */
export function templateSearchText(template: DiagramTemplate): string {
  return `${template.name} ${template.description ?? ''} ${template.tags ?? ''}`.toLowerCase();
}

/** True when every whitespace-separated term of `query` occurs in the template's search text. */
export function templateMatches(template: DiagramTemplate, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = templateSearchText(template);
  return terms.every((t) => text.includes(t));
}
