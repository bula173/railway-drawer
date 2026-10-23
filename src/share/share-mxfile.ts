/**
 * @file share-mxfile.ts
 * @brief All open tabs as one draw.io `<mxfile>` (one `<diagram>` page per tab, plus the pages a
 *        tab keeps from its opened file) and the reverse: a shared file split into one file per page,
 *        each opened in its own tab by the normal loader.
 */
import { xmlUtils } from '@maxgraph/core';
import { buildMxfile, generatePageId, sanitizeXmlText } from '../services/drawio-xml';
import type { MxfilePage, MxfileRawPage } from '../services/drawio-xml';
import { projectSections } from '../services/project-sections';

/** One tab of the sender. */
export interface SharePageSource {
  /** Tab name, written as the page name. */
  name: string;
  /** The tab's `<mxGraphModel>` (optionally followed by comments such as the PlantUML metadata). */
  modelXml: string;
  /** Id of the shown page's `<diagram>` (kept when unique). */
  pageId?: string | null;
  /** Pages 2..n of the file the tab opened, as serialized `<diagram>` elements. */
  extraPages?: string[];
  /** Extra attributes of the shown page's `<diagram>` (the project sections': scenario index `rdScenarios`, Railway Script). */
  pageAttributes?: Record<string, string>;
  /** The tab's project section pages (scenario steps; serialized `<diagram>` elements), written right after its page. */
  sectionPages?: string[];
}

/** Largest number of pages a shared file may open as tabs. */
export const MAX_SHARED_PAGES = 50;

const SHARE_HOST = 'railway-drawer';
const SHARE_AGENT = 'railway-drawer/1.0';

function parse(xml: string): Document | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement) return null;
  return doc;
}

/** Whether a project section (scenarios: the step pages) claims the page: it belongs to the page before it. */
function claimedBySection(page: Element): boolean {
  return projectSections().some((section) => section.claimsPage?.(page) ?? false);
}

/** Builds one `<mxfile>` with a page per tab (and the tabs' preserved pages after each). */
export function buildShareMxfile(sources: SharePageSource[], modified: string = new Date().toISOString()): string {
  const usedIds = new Set<string>();
  const uniqueId = (wanted: string): string => {
    let id = wanted && !usedIds.has(wanted) ? wanted : generatePageId();
    while (usedIds.has(id)) id = generatePageId();
    usedIds.add(id);
    return id;
  };

  const pages: Array<MxfilePage | MxfileRawPage> = [];
  for (const source of sources) {
    const modelDoc = parse(source.modelXml);
    const model = modelDoc?.documentElement;
    if (!modelDoc || !model || model.nodeName !== 'mxGraphModel') {
      console.error('[Share] Skipping a tab whose diagram is not a draw.io model:', source.name);
    } else {
      const comments: string[] = [];
      modelDoc.childNodes.forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) comments.push(node.nodeValue ?? '');
      });
      pages.push({ id: source.pageId ?? '', name: source.name || 'Page', model, comments, attributes: source.pageAttributes });
    }
    // Section (step) pages right after their tab's page: splitSharedFile keeps them with it
    for (const xml of [...(source.sectionPages ?? []), ...(source.extraPages ?? [])]) pages.push({ xml });
  }
  return buildMxfile(pages, [], { host: SHARE_HOST, modified, agent: SHARE_AGENT, version: '1.0' }, { pageId: uniqueId });
}

/**
 * One page of a shared file (with the scenario step pages that follow it), as a file for
 * SaveLoadController.loadProjectXml.
 */
export interface SharedPage {
  name: string;
  fileXml: string;
}

/**
 * Splits a shared `<mxfile>` into one file per tab (a bare `<mxGraphModel>` is one page): every page
 * that is not a scenario step starts a tab, step pages stay with the page before them.
 * Throws a user-readable error for anything else.
 */
export function splitSharedFile(xml: string, fallbackName = 'Shared diagram'): SharedPage[] {
  const doc = parse(sanitizeXmlText(xml));
  if (!doc) throw new Error('The shared diagram is not valid XML');
  const root = doc.documentElement;
  if (root.nodeName === 'mxGraphModel') {
    return [{ name: fallbackName, fileXml: xml }];
  }
  if (root.nodeName !== 'mxfile') {
    throw new Error(`The link does not contain a draw.io diagram (<${root.nodeName}>)`);
  }
  const pages = Array.from(root.children).filter((el) => el.nodeName === 'diagram');
  if (pages.length === 0) throw new Error('The shared file has no pages');
  const groups: Element[][] = [];
  for (const page of pages) {
    const last = groups[groups.length - 1];
    if (last && claimedBySection(page)) last.push(page);
    else groups.push([page]);
  }
  if (groups.length > MAX_SHARED_PAGES) {
    throw new Error(`The shared file has ${groups.length} pages; at most ${MAX_SHARED_PAGES} can be opened`);
  }
  return groups.map((group, index) => {
    const single = doc.implementation.createDocument(null, null, null);
    const file = single.createElement('mxfile');
    for (const attr of Array.from(root.attributes)) file.setAttribute(attr.name, attr.value);
    for (const page of group) file.appendChild(single.importNode(page, true));
    single.appendChild(file);
    return {
      name: group[0].getAttribute('name') || (groups.length > 1 ? `Page ${index + 1}` : fallbackName),
      fileXml: xmlUtils.getXml(file),
    };
  });
}
