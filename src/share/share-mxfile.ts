/**
 * @file share-mxfile.ts
 * @brief All open tabs as one draw.io `<mxfile>` (one `<diagram>` page per tab, plus the pages a
 *        tab keeps from its opened file) and the reverse: a shared file split into one file per page,
 *        each opened in its own tab by the normal loader.
 */
import { xmlUtils } from '@maxgraph/core';
import { generatePageId, sanitizeXmlText } from '../services/drawio-xml';

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

/** Builds one `<mxfile>` with a page per tab (and the tabs' preserved pages after each). */
export function buildShareMxfile(sources: SharePageSource[], modified: string = new Date().toISOString()): string {
  const doc = document.implementation.createDocument(null, null, null);
  const mxfile = doc.createElement('mxfile');
  mxfile.setAttribute('host', SHARE_HOST);
  mxfile.setAttribute('modified', modified);
  mxfile.setAttribute('agent', SHARE_AGENT);
  mxfile.setAttribute('version', '1.0');
  doc.appendChild(mxfile);

  const usedIds = new Set<string>();
  const uniqueId = (wanted: string | null | undefined): string => {
    let id = wanted && !usedIds.has(wanted) ? wanted : generatePageId();
    while (usedIds.has(id)) id = generatePageId();
    usedIds.add(id);
    return id;
  };

  for (const source of sources) {
    const modelDoc = parse(source.modelXml);
    const model = modelDoc?.documentElement;
    if (!modelDoc || !model || model.nodeName !== 'mxGraphModel') {
      console.error('[Share] Skipping a tab whose diagram is not a draw.io model:', source.name);
    } else {
      const diagram = doc.createElement('diagram');
      diagram.setAttribute('id', uniqueId(source.pageId));
      diagram.setAttribute('name', source.name || 'Page');
      diagram.appendChild(doc.importNode(model, true));
      modelDoc.childNodes.forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) diagram.appendChild(doc.createComment(node.nodeValue ?? ''));
      });
      mxfile.appendChild(diagram);
    }
    for (const pageXml of source.extraPages ?? []) {
      const page = parse(pageXml)?.documentElement;
      if (!page || page.nodeName !== 'diagram') continue;
      const imported = doc.importNode(page, true) as Element;
      imported.setAttribute('id', uniqueId(imported.getAttribute('id')));
      mxfile.appendChild(imported);
    }
  }
  // getXml: newlines in attribute values (multi-line labels) must stay escaped
  return sanitizeXmlText(xmlUtils.getXml(mxfile));
}

/** One page of a shared file, as a single-page file for SaveLoadController.loadProjectXml. */
export interface SharedPage {
  name: string;
  fileXml: string;
}

/**
 * Splits a shared `<mxfile>` into single-page files (a bare `<mxGraphModel>` is one page).
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
  if (pages.length > MAX_SHARED_PAGES) {
    throw new Error(`The shared file has ${pages.length} pages; at most ${MAX_SHARED_PAGES} can be opened`);
  }
  return pages.map((page, index) => {
    const single = doc.implementation.createDocument(null, null, null);
    const file = single.createElement('mxfile');
    for (const attr of Array.from(root.attributes)) file.setAttribute(attr.name, attr.value);
    file.appendChild(single.importNode(page, true));
    single.appendChild(file);
    return {
      name: page.getAttribute('name') || (pages.length > 1 ? `Page ${index + 1}` : fallbackName),
      fileXml: xmlUtils.getXml(file),
    };
  });
}
