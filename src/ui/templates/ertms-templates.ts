/**
 * @file ertms-templates.ts
 * @brief Splits the ERTMS library (public/libraries/ertms.xml) into simple elements (palette tiles)
 *        and complex scenario diagrams (built-in "ERTMS templates").
 *
 * Classification rule (by content, not by position or title): an entry is a template when its
 * model has more than TEMPLATE_CELL_THRESHOLD drawable cells (mxCell with vertex="1" or edge="1",
 * nested group children included). In the shipped library the simple elements have 1..44 such
 * cells (largest: "Train Connected", 44) and the scenarios 102..265, so the threshold of 80 has a
 * wide margin on both sides. Image (`data`) entries are always elements.
 *
 * Built-in templates are named "ERTMS scenario <n>" (n in library order) with a subtitle made of
 * the scenario's most distinctive labels: the labels that occur in the fewest scenarios (phrases
 * before ids among equally rare ones), in document order (e.g. "S2_Exit, S4_Entry, Entrance Route").
 * All labels become search tags.
 */
import type { LibraryEntry } from '../drawio-palette/contracts';
import type { DiagramTemplate } from './template-types';

/** More drawable cells than this makes a library entry a template. */
export const TEMPLATE_CELL_THRESHOLD = 80;
/** Labels in the subtitle. */
const SUBTITLE_LABELS = 3;
/** Labels longer than this are sentences, not names (still searchable). */
const MAX_SUBTITLE_LABEL = 24;

function parseModel(xml: string): Document | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc;
}

/** Number of vertices and edges (mxCell vertex="1"/edge="1") in a model XML. */
export function countDrawableCells(xml: string): number {
  const doc = parseModel(xml);
  if (!doc) return 0;
  let n = 0;
  for (const cell of Array.from(doc.getElementsByTagName('mxCell'))) {
    if (cell.getAttribute('vertex') === '1' || cell.getAttribute('edge') === '1') n++;
  }
  return n;
}

/** True for complex scenario diagrams (see the file comment for the rule). */
export function isTemplateLibraryEntry(entry: LibraryEntry): boolean {
  if (!entry.xml) return false;
  return countDrawableCells(entry.xml) > TEMPLATE_CELL_THRESHOLD;
}

/** Plain text of a (possibly HTML) label, whitespace collapsed. */
function plainLabel(value: string): string {
  let text = value;
  if (/[<&]/.test(value)) {
    const html = new DOMParser().parseFromString(`<body>${value}</body>`, 'text/html');
    text = html.body.textContent ?? '';
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Distinct non-empty labels of a model XML in document order (cell values and UserObject labels). */
export function modelLabels(xml: string): string[] {
  const doc = parseModel(xml);
  if (!doc) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null): void => {
    if (!raw) return;
    const label = plainLabel(raw);
    if (!label || seen.has(label)) return;
    seen.add(label);
    labels.push(label);
  };
  const all = doc.getElementsByTagName('*');
  for (const el of Array.from(all)) {
    if (el.nodeName === 'mxCell') add(el.getAttribute('value'));
    else if (el.nodeName === 'UserObject' || el.nodeName === 'object') add(el.getAttribute('label'));
  }
  return labels;
}

function isNameLike(label: string): boolean {
  return label.length >= 2 && label.length <= MAX_SUBTITLE_LABEL && !/^[\d\s.,:/-]+$/.test(label) && !/km\/h$/i.test(label);
}

export interface ErtmsLibrarySplit {
  /** Simple elements with their library index (palette ids stay `ertms-<index>-<slug>`). */
  elements: Array<{ index: number; entry: LibraryEntry }>;
  templates: DiagramTemplate[];
}

/** Splits parsed ERTMS library entries into palette elements and named built-in templates. */
export function splitErtmsLibrary(entries: LibraryEntry[]): ErtmsLibrarySplit {
  const elements: ErtmsLibrarySplit['elements'] = [];
  const complex: Array<{ index: number; entry: LibraryEntry; labels: string[] }> = [];
  entries.forEach((entry, index) => {
    if (isTemplateLibraryEntry(entry)) complex.push({ index, entry, labels: modelLabels(entry.xml!) });
    else elements.push({ index, entry });
  });

  // How many scenarios use each label: rare labels describe a scenario best
  const docFreq = new Map<string, number>();
  for (const c of complex) for (const label of c.labels) docFreq.set(label, (docFreq.get(label) ?? 0) + 1);

  const templates = complex.map((c, n): DiagramTemplate => {
    const candidates = c.labels
      .map((label, order) => ({ label, order, freq: docFreq.get(label) ?? 0, words: /\s/.test(label) ? 0 : 1 }))
      .filter((x) => isNameLike(x.label));
    // rarest first; among equally rare labels, phrases ("Exit Route") before ids ("S4")
    candidates.sort((a, b) => a.freq - b.freq || a.words - b.words || a.order - b.order);
    const subtitle = candidates
      .slice(0, SUBTITLE_LABELS)
      .sort((a, b) => a.order - b.order)
      .map((x) => x.label)
      .join(', ');
    const title = c.entry.title?.trim();
    const tags = ['ertms', 'etcs', 'template', 'scenario', ...c.labels].join(' ').toLowerCase();
    return {
      id: `ertms-tpl-${c.index}`,
      name: title || `ERTMS scenario ${n + 1}`,
      ...(subtitle ? { description: subtitle } : {}),
      xml: c.entry.xml!,
      width: c.entry.w,
      height: c.entry.h,
      tags,
      builtIn: true,
    };
  });
  return { elements, templates };
}
