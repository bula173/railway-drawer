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
 * Built-in templates get a display name derived from their labels (`templateDisplayName`: the
 * ERTMS concept the drawing shows, e.g. "Level transition L0 → L1" or "Section timer (L1)", see
 * TOPICS) and keep "ERTMS scenario <n>" (n in library order) as `originalName` (tooltip, search).
 * The subtitle is made of the scenario's most distinctive labels: the labels that occur in the
 * fewest scenarios (phrases before ids among equally rare ones), in document order (e.g. "S2_Exit,
 * S4_Entry, Entrance Route"). All labels become search tags.
 *
 * The app's copy of the library is the user's ERTMS.xml export without scenarios 14, 15 and 18
 * (removed on the user's request, REMOVED_ERTMS_SCENARIOS); the remaining scenarios keep their
 * original numbers ("ERTMS scenario 16" stays 16), so the tooltips still match the user's file.
 */
import type { LibraryEntry } from '../drawio-palette/contracts';
import type { DiagramTemplate } from './template-types';

/** More drawable cells than this makes a library entry a template. */
export const TEMPLATE_CELL_THRESHOLD = 80;
/**
 * Scenario numbers (1-based, order of the user's original ERTMSDrawioTemplate/ERTMS.xml) removed
 * from the app's public/libraries/ertms.xml; skipped when numbering "ERTMS scenario <n>".
 */
export const REMOVED_ERTMS_SCENARIOS: readonly number[] = [14, 15, 18];

/** Original scenario number of the n-th (0-based) template of the app library. */
export function originalScenarioNumber(n: number): number {
  let number = 0;
  for (let left = n + 1; left > 0;) {
    number++;
    if (!REMOVED_ERTMS_SCENARIOS.includes(number)) left--;
  }
  return number;
}

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

/**
 * ERTMS concepts recognised in a scenario's labels, most specific first: the first whose test
 * matches names the template. Tests see every label (trimmed), case-insensitive.
 */
const TOPICS: ReadonlyArray<{ test: (has: (re: RegExp) => boolean) => boolean; name: string }> = [
  { test: (has) => has(/powerless section/i), name: 'Powerless section' },
  { test: (has) => has(/dynamic speed profile/i), name: 'Dynamic speed profile' },
  { test: (has) => has(/pca window/i) || has(/^berth$/i), name: 'PCA window and berth' },
  { test: (has) => has(/external ixl route/i), name: 'External interlocking route' },
  { test: (has) => has(/section timer/i), name: 'Section timer' },
  { test: (has) => has(/\bTSR\b/i), name: 'Temporary speed restrictions' },
  { test: (has) => has(/acknowledgement area/i), name: 'On-sight acknowledgement area' },
  { test: (has) => has(/^OS (MA|route|profile)$/i), name: 'On-sight movement authority' },
  { test: (has) => has(/^L0 area$/i) && has(/shortened route/i), name: 'Level transition L0 → L1, shortened route' },
  { test: (has) => has(/^L0 area$/i), name: 'Level transition L0 → L1' },
  { test: (has) => has(/L1\/L2 area border/i) && has(/^SR$/i), name: 'Level transition L1 → L2, staff responsible' },
  { test: (has) => has(/L1\/L2 area border/i), name: 'Level transition L1 → L2' },
  { test: (has) => has(/^EOA$/i), name: 'End of authority' },
  { test: (has) => has(/^conventional$/i), name: 'Conventional block' },
  { test: (has) => has(/^MA length$/i), name: 'MA length and speed' },
  { test: (has) => has(/\bstation\b/i), name: 'Train routes to a station' },
  { test: (has) => has(/shortened route/i), name: 'Shortened route' },
  { test: (has) => has(/^FS MA$/i), name: 'Full supervision MA' },
];

/**
 * Display name of a scenario from its labels: the first matching TOPICS name, plus the ETCS level
 * shown in the drawing ("ETCS L1"/"ETCS L2" label) when the name has none; else the most
 * distinctive labels (`fallback`), else null.
 */
export function templateDisplayName(labels: string[], fallback = ''): string | null {
  const has = (re: RegExp): boolean => labels.some((l) => re.test(l.trim()));
  const topic = TOPICS.find((t) => t.test(has))?.name;
  if (!topic) return fallback.trim() || null;
  if (/\bL[0-3]\b/.test(topic)) return topic;
  const level = has(/^ETCS L2$/i) ? 'L2' : has(/^ETCS L1$/i) ? 'L1' : '';
  return level ? `${topic} (${level})` : topic;
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

  const usedNames = new Map<string, number>();
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
    const originalName = title || `ERTMS scenario ${originalScenarioNumber(n)}`;
    let name = title || templateDisplayName(c.labels, candidates.slice(0, 2).map((x) => x.label).join(', ')) || originalName;
    // same concept drawn more than once: "Section timer (L1) 2"
    const seen = (usedNames.get(name) ?? 0) + 1;
    usedNames.set(name, seen);
    if (seen > 1) name = `${name} ${seen}`;
    const tags = ['ertms', 'etcs', 'template', 'scenario', originalName, ...c.labels].join(' ').toLowerCase();
    return {
      id: `ertms-tpl-${c.index}`,
      name,
      originalName,
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
