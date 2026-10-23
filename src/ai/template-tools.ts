/**
 * @file template-tools.ts
 * @brief Templates for the AI ("template first" drawing): list_templates (display name, original
 *        name, topic, ETCS level, object counts and ids, size; PL/EN keyword search with ranking),
 *        describe_template (the template as a generated Railway Script) and insert_template (new tab
 *        or into the active tab, with the map of renumbered object ids).
 */
import { GraphDataModel } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import { collectObjects } from '../railway/validation';
import type { RailObject } from '../railway/validation';
import { generateScript } from '../railway-script/generate';
import { importDrawioXmlIntoModel } from '../services/drawio-xml';
import { getViewCenter } from '../ui/drawio-palette/entry-cells';
import { modelLabels } from '../ui/templates/ertms-templates';
import { insertTemplate } from '../ui/templates/template-actions';
import type { DiagramTemplate } from '../ui/templates/template-types';
import type { AiTarget } from './target';
import { fail, idsByKind, ok } from './tool-kit';
import type { Executor } from './tool-kit';

/** Facts about one template, derived from its cells and labels (cached per template). */
export interface TemplateInfo {
  id: string;
  name: string;
  originalName?: string;
  builtIn: boolean;
  /** "Level transition L1 → L2: 2 tracks, 4 signals (S1, S2, S3, S4), 6 sections…" */
  summary: string;
  /** ETCS levels shown in the drawing ("L1", "L2", "L1 → L2"); '' = none. */
  etcsLevel: string;
  counts: { tracks: number; signals: number; sections: number; points: number; baliseGroups: number; other: number };
  ids: Partial<Record<KindId, string[]>>;
  size: { width: number; height: number };
  labels: string[];
  /** Lower-case, accent-free search text: name (weight 3), description (2), labels/tags (1). */
  search: { name: string; description: string; rest: string };
}

const infoCache = new Map<string, TemplateInfo>();

/** The template's cells in a scratch model (for its railway objects). */
export function templateModel(template: DiagramTemplate): GraphDataModel {
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(template.xml, model);
  return model;
}

/** Lower case without diacritics (ł -> l), for PL/EN matching. */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function etcsLevelOf(name: string, labels: string[]): string {
  const fromName = /\bL([0-3])\b(?:\s*→\s*L([0-3])\b)?/.exec(name);
  if (fromName) return fromName[2] ? `L${fromName[1]} → L${fromName[2]}` : `L${fromName[1]}`;
  const levels = new Set<string>();
  for (const l of labels) {
    const m = /^ETCS\s*L(?:evel)?\s*([0-3])$/i.exec(l.trim());
    if (m) levels.add(`L${m[1]}`);
  }
  return [...levels].sort().join(', ');
}

export function analyzeTemplate(template: DiagramTemplate): TemplateInfo {
  const key = `${template.id}:${template.xml.length}:${template.name}`;
  const hit = infoCache.get(key);
  if (hit) return hit;
  let objects: RailObject[] = [];
  try {
    objects = collectObjects(templateModel(template));
  } catch {
    objects = [];
  }
  const labels = modelLabels(template.xml);
  const ids = idsByKind(objects);
  const n = (k: KindId): number => objects.filter((o) => o.kind.id === k).length;
  const counts = {
    tracks: n('track'),
    signals: n('signal'),
    sections: n('trackSection'),
    points: n('points'),
    baliseGroups: n('baliseGroup'),
    other: objects.length - n('track') - n('signal') - n('trackSection') - n('points') - n('baliseGroup'),
  };
  const etcsLevel = etcsLevelOf(template.name, labels);
  const parts: string[] = [];
  if (counts.tracks) parts.push(`${counts.tracks} track${counts.tracks === 1 ? '' : 's'}`);
  if (counts.signals) parts.push(`${counts.signals} signal${counts.signals === 1 ? '' : 's'} (${(ids.signal ?? []).join(', ')})`);
  if (counts.sections) parts.push(`${counts.sections} section${counts.sections === 1 ? '' : 's'}`);
  if (counts.points) parts.push(`${counts.points} points (${(ids.points ?? []).join(', ')})`);
  if (counts.baliseGroups) parts.push(`${counts.baliseGroups} balise group${counts.baliseGroups === 1 ? '' : 's'}`);
  const topic = template.builtIn ? `ERTMS ${template.name}` : template.name;
  const summary = `${topic}${etcsLevel && !template.name.includes(etcsLevel) ? ` (ETCS ${etcsLevel})` : ''}: ${parts.join(', ') || 'no railway objects'}${template.description ? `; labels: ${template.description}` : ''}`;
  const info: TemplateInfo = {
    id: template.id,
    name: template.name,
    ...(template.originalName ? { originalName: template.originalName } : {}),
    builtIn: template.builtIn,
    summary: summary.slice(0, 300),
    etcsLevel,
    counts,
    ids,
    size: { width: Math.round(template.width), height: Math.round(template.height) },
    labels,
    search: {
      name: foldText(`${template.name} ${template.originalName ?? ''} ${etcsLevel}`),
      description: foldText(template.description ?? ''),
      rest: foldText(`${template.tags ?? ''} ${labels.join(' ')} ${Object.values(ids).flat().join(' ')}`),
    },
  };
  infoCache.set(key, info);
  return info;
}

/**
 * Polish (accent-free stems) and English words -> English terms used in the templates' names and
 * labels. A query word matches an entry when it starts with the key.
 */
const SYNONYMS: ReadonlyArray<[string, string[]]> = [
  ['wjazd', ['entry', 'entrance', 'route', 'station']],
  ['wjezd', ['entry', 'entrance', 'route']],
  ['wyjazd', ['exit', 'route']],
  ['wyjezd', ['exit', 'route']],
  ['przebieg', ['route']],
  ['droga', ['route']],
  ['stacj', ['station']],
  ['peron', ['station', 'berth', 'platform']],
  ['semafor', ['signal']],
  ['sygnal', ['signal']],
  ['tarcz', ['shunting', 'signal']],
  ['wskaznik', ['marker', 'board']],
  ['zwrotnic', ['points', 'switch']],
  ['rozjazd', ['points', 'switch']],
  ['odcin', ['section']],
  ['izol', ['section', 'joint']],
  ['sekcj', ['section']],
  ['balis', ['balise']],
  ['przejazd', ['level crossing']],
  ['pociag', ['train']],
  ['poziom', ['level']],
  ['przejsc', ['transition', 'level']],
  ['granic', ['border', 'transition']],
  ['zezwol', ['authority', 'ma']],
  ['ograniczen', ['restriction', 'tsr', 'speed']],
  ['predkos', ['speed']],
  ['dorazn', ['temporary', 'tsr']],
  ['tymczas', ['temporary', 'tsr']],
  ['koniec', ['end', 'eoa']],
  ['manewr', ['shunting']],
  ['skrocon', ['shortened']],
  ['blokad', ['block']],
  ['konwencjonal', ['conventional']],
  ['nadzor', ['supervision']],
  ['peln', ['full']],
  ['beznapiec', ['powerless']],
  ['neutral', ['powerless', 'neutral']],
  ['zegar', ['timer']],
  ['czasomierz', ['timer']],
  ['czas', ['timer']],
  ['okno', ['window']],
  ['dynamicz', ['dynamic']],
  ['profil', ['profile']],
  ['zewnetrz', ['external']],
  ['uzaleznien', ['interlocking', 'ixl']],
  ['nastawni', ['interlocking', 'ixl']],
  ['personel', ['staff']],
  ['widoczn', ['sight']],
  ['potwierdz', ['acknowledgement']],
  ['obszar', ['area']],
  ['switch', ['points']],
  ['turnout', ['points']],
  ['entrance', ['entry']],
  ['entry', ['entrance']],
  ['movement', ['ma', 'authority']],
  ['restriction', ['tsr']],
  ['neutral', ['powerless']],
  ['crossing', ['level crossing']],
];

const STOPWORDS = new Set(
  (
    'a an the of for to in on at and or with by from into scenario scenarios template templates drawing diagram draw prepare make create please new ' +
    'i w we z ze na do dla od po przez oraz lub albo jak jaki jest sa to ten ta te przygotuj narysuj zrob stworz utworz pokaz prosze scenariusz scenariusza scenariusze rysunek schemat szablon szablonu nowy nowa nowe'
  ).split(' ')
);

/** Query words with their expansions (accent-free, lower case). */
export function expandQuery(query: string): Array<{ word: string; terms: string[] }> {
  const words = foldText(query).split(/[^a-z0-9→]+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return words.map((word) => {
    const terms = new Set<string>([word]);
    for (const [key, list] of SYNONYMS) if (word.startsWith(key)) list.forEach((t) => terms.add(t));
    // Polish inflection: also match the stem (first 5 letters) of longer words
    if (word.length > 6 && /^[a-z]+$/.test(word)) terms.add(word.slice(0, 5));
    return { word, terms: [...terms] };
  });
}

function wordMatch(text: string, term: string): boolean {
  if (term.length <= 3) return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text);
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text);
}

/** Relevance of a template for the expanded query (0 = no word matches). */
export function scoreTemplate(info: TemplateInfo, query: ReturnType<typeof expandQuery>): number {
  let score = 0;
  for (const { terms } of query) {
    let best = 0;
    for (const term of terms) {
      if (wordMatch(info.search.name, term)) best = Math.max(best, 3);
      else if (wordMatch(info.search.description, term)) best = Math.max(best, 2);
      else if (wordMatch(info.search.rest, term)) best = Math.max(best, 1);
    }
    score += best;
  }
  return score;
}

/** Templates ranked for `query` (all, in their order, when the query has no words). */
export function rankTemplates(templates: DiagramTemplate[], query: string): Array<{ template: DiagramTemplate; info: TemplateInfo; score: number }> {
  const expanded = expandQuery(query);
  const rows = templates.map((template, order) => ({ template, info: analyzeTemplate(template), score: 0, order }));
  if (expanded.length === 0) return rows;
  for (const r of rows) r.score = scoreTemplate(r.info, expanded);
  return rows.filter((r) => r.score > 0).sort((a, b) => b.score - a.score || a.order - b.order);
}

async function allTemplates(target: AiTarget): Promise<DiagramTemplate[]> {
  if (!target.templates) fail('templates are not available here');
  return target.templates!();
}

function templateRow(info: TemplateInfo, score?: number): Record<string, unknown> {
  return {
    id: info.id,
    name: info.name,
    ...(info.originalName && info.originalName !== info.name ? { originalName: info.originalName } : {}),
    summary: info.summary,
    ...(info.etcsLevel ? { etcsLevel: info.etcsLevel } : {}),
    counts: info.counts,
    signals: info.ids.signal ?? [],
    size: info.size,
    builtIn: info.builtIn,
    ...(score !== undefined ? { score } : {}),
  };
}

export const listTemplates: Executor = async (target, input) => {
  const query = typeof input.query === 'string' ? input.query : '';
  const limit = typeof input.limit === 'number' ? input.limit : 20;
  const templates = await allTemplates(target);
  const ranked = rankTemplates(templates, query);
  const searched = expandQuery(query).length > 0;
  if (searched && ranked.length === 0) {
    return ok(`No template matches "${query}" (${templates.length} available)`, {
      matches: 0,
      note: 'No template matched; all templates are listed by name. Pick the closest one or build from scratch.',
      templates: templates.slice(0, 60).map((t) => ({ id: t.id, name: t.name })),
    });
  }
  return ok(searched ? `Found ${ranked.length} template(s) for "${query}"${ranked[0] ? `: best "${ranked[0].info.name}"` : ''}` : `Listed ${ranked.length} template(s)`, {
    matches: ranked.length,
    templates: ranked.slice(0, limit).map((r) => templateRow(r.info, searched ? r.score : undefined)),
  });
};

async function findTemplate(target: AiTarget, id: string): Promise<DiagramTemplate> {
  const templates = await allTemplates(target);
  const folded = foldText(id.trim());
  return (
    templates.find((t) => t.id === id) ??
    templates.find((t) => foldText(t.name) === folded) ??
    fail(`template ${id} not found — use list_templates (ids look like ${templates.slice(0, 3).map((t) => t.id).join(', ')})`)
  );
}

export const describeTemplate: Executor = async (target, input) => {
  const template = await findTemplate(target, String(input.id));
  const info = analyzeTemplate(template);
  let script = '';
  try {
    script = generateScript(templateModel(template), template.name).text;
  } catch (error) {
    script = `# could not generate: ${error instanceof Error ? error.message : String(error)}`;
  }
  const idSet = new Set(Object.values(info.ids).flat().map((x) => x!.toUpperCase()));
  const otherLabels = info.labels.filter((l) => !idSet.has(l.toUpperCase())).slice(0, 60);
  return ok(`Described template "${template.name}"`, {
    ...templateRow(info),
    ids: info.ids,
    labels: otherLabels,
    railwayScript: script.length > 20_000 ? `${script.slice(0, 20_000)}\n# … cut` : script,
    note: 'railwayScript is generated from the template drawing (ids, kinds, km). After insert_template the drawing keeps the template look; edit it with set_states/routes/delete_cells/add_shapes, or apply_railway_script to redraw the layout from a script.',
  });
};

function cellsUnder(cells: Cell[]): Set<Cell> {
  const out = new Set<Cell>();
  const walk = (c: Cell): void => {
    out.add(c);
    for (const ch of c.children ?? []) walk(ch);
  };
  cells.forEach(walk);
  return out;
}

/** "S2→S5, TC1→TC7" (first `max` pairs). */
export function renamedText(renamed: Record<string, string>, max = 4): string {
  const pairs = Object.entries(renamed);
  return pairs.slice(0, max).map(([a, b]) => `${a}→${b}`).join(', ') + (pairs.length > max ? ' …' : '');
}

export const insertTemplateTool: Executor = async (target, input) => {
  const template = await findTemplate(target, String(input.id));
  const info = analyzeTemplate(template);
  const mode = input.mode === 'intoTab' || input.mode === 'newTab' ? input.mode : target.openTemplateInNewTab ? 'newTab' : 'intoTab';
  if (mode === 'newTab') {
    if (!target.openTemplateInNewTab) fail('new tabs are not available here: use mode "intoTab"');
    const name = target.openTemplateInNewTab!(template);
    const sig = info.ids.signal ?? [];
    return ok(`Inserted template "${template.name}" as new tab${sig.length ? ` (${sig.slice(0, 4).join(', ')}${sig.length > 4 ? ' …' : ''})` : ''}`, {
      mode,
      tab: name,
      objects: info.ids,
      renamed: {},
      note: 'The new tab is now the active tab; later tool calls act on it. Object ids are the template ids.',
    });
  }
  const at = input.at && typeof input.at === 'object' ? (input.at as { x: number; y: number }) : getViewCenter(target.graph);
  let renamedMap = new Map<KindId, Map<string, string>>();
  const cells = insertTemplate(target.graph, template, { x: Number(at.x), y: Number(at.y) }, (m) => {
    renamedMap = m;
  });
  const renamed: Record<string, string> = {};
  for (const [kind, map] of renamedMap) {
    for (const [oldUpper, newId] of map) {
      const original = (info.ids[kind] ?? []).find((x) => x.toUpperCase() === oldUpper) ?? oldUpper;
      renamed[original] = newId;
    }
  }
  const inside = cellsUnder(cells);
  const objects = idsByKind(collectObjects(target.graph.getDataModel()).filter((o) => inside.has(o.cell)));
  return ok(`Inserted template "${template.name}" into "${target.tabName()}"${Object.keys(renamed).length ? ` (${renamedText(renamed)})` : ''}`, {
    mode,
    tab: target.tabName(),
    insertedCells: cells.length,
    objects,
    renamed,
    ...(Object.keys(renamed).length ? { note: 'Ids already used in the drawing were renumbered: use the new ids (renamed: template id -> new id).' } : {}),
  });
};
