/**
 * @file shape-search.ts
 * @brief Search and name resolution over the shape catalogue (target.ts `ShapeCatalog`): word
 *        matching on title, tags, shape names and palette, a few basic aliases, and draw.io style
 *        strings as ad-hoc shapes. Pure (no DOM).
 */
import type { PaletteEntry } from '../drawio-shapes/palettes';
import type { CatalogShape } from './target';

/** Common words -> draw.io style of a basic vertex, used when no catalogue entry matches. */
const BASIC_STYLES: Record<string, { style: string; width: number; height: number; value?: string }> = {
  rectangle: { style: 'rounded=0;whiteSpace=wrap;html=1;', width: 120, height: 60 },
  box: { style: 'rounded=0;whiteSpace=wrap;html=1;', width: 120, height: 60 },
  'rounded rectangle': { style: 'rounded=1;whiteSpace=wrap;html=1;', width: 120, height: 60 },
  ellipse: { style: 'ellipse;whiteSpace=wrap;html=1;', width: 120, height: 80 },
  circle: { style: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;', width: 80, height: 80 },
  text: { style: 'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;', width: 60, height: 30, value: 'Text' },
  rhombus: { style: 'rhombus;whiteSpace=wrap;html=1;', width: 80, height: 80 },
  diamond: { style: 'rhombus;whiteSpace=wrap;html=1;', width: 80, height: 80 },
  note: { style: 'shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;size=14;', width: 100, height: 80 },
  cylinder: { style: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;', width: 60, height: 80 },
  hexagon: { style: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;', width: 120, height: 80 },
  triangle: { style: 'triangle;whiteSpace=wrap;html=1;', width: 60, height: 80 },
  cloud: { style: 'ellipse;shape=cloud;whiteSpace=wrap;html=1;', width: 120, height: 80 },
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9ąćęłńóśźż]+/)
    .filter(Boolean);
}

function haystack(s: CatalogShape): string {
  return [s.title, s.entry.tags ?? '', s.entry.shapeNames.join(' '), s.palette, s.name].join(' ').toLowerCase();
}

/** Best matches for `query` (all words must match; title matches rank first). */
export function searchShapes(shapes: CatalogShape[], query: string, limit = 12): CatalogShape[] {
  const terms = words(query);
  if (terms.length === 0) return [];
  const scored: Array<{ s: CatalogShape; score: number }> = [];
  const seen = new Set<string>();
  for (const s of shapes) {
    const text = haystack(s);
    if (!terms.every((t) => text.includes(t))) continue;
    const sig = `${s.entry.style ?? ''}\u0000${s.entry.xml ?? ''}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const title = s.title.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title === t) score += 10;
      else if (words(title).includes(t)) score += 5;
      else if (title.includes(t)) score += 3;
      else score += 1;
    }
    score -= title.length / 100;
    scored.push({ s, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

/** An entry for a raw draw.io style string. */
function styleEntry(style: string): PaletteEntry {
  return { id: 'style', title: 'Custom', kind: 'vertex', width: 120, height: 60, style, shapeNames: [], cls: 'a', source: 'ai' };
}

/**
 * The entry for an add_shapes `shape`: a catalogue name, an exact title, a draw.io style string
 * (contains `=` or ends with `;`), a basic word ("rectangle", "ellipse", "text"...), else the best
 * search hit. Null when nothing fits.
 */
export function resolveShape(shapes: CatalogShape[], shape: string): PaletteEntry | null {
  const q = shape.trim();
  if (!q) return null;
  const byName = shapes.find((s) => s.name === q);
  if (byName) return byName.entry;
  if (/[=;]/.test(q)) return styleEntry(q.endsWith(';') ? q : `${q};`);
  const lower = q.toLowerCase();
  const basic = BASIC_STYLES[lower];
  const byTitle = shapes.find((s) => s.title.toLowerCase() === lower);
  if (byTitle) return byTitle.entry;
  if (basic) return { ...styleEntry(basic.style), title: q, width: basic.width, height: basic.height, value: basic.value };
  return searchShapes(shapes, q, 1)[0]?.entry ?? null;
}
