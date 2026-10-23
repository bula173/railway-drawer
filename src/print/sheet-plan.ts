/**
 * @file sheet-plan.ts
 * @brief The sheets of a document: for each drawing page its model XML, sheet setup, title-block
 *        values (sheet x of n), legend and layout, and the sheet numbers the continuation markers
 *        print. Pure data (no rendering): the exports, Print… and the AI tool build on it.
 */
import type { DiagramDocument, DrawingPage } from '../document/diagram-document';
import type { PageSettings } from '../format/drawio-xml';
import { buildLegend, type LegendEntry } from './legend';
import { sheetGeometry, type SheetGeometry } from './sheet-geometry';
import { refreshSheetRefsInXml, type SheetNumberOf } from './sheet-refs';
import { sheetSetupFrom, type SheetSetup } from './sheet-setup';
import { sheetTitleValues, type SheetTitleValues } from './title-block';
import './project-section';

export interface SheetPlan {
  page: DrawingPage;
  /** The page's `<mxGraphModel>` with the continuation markers' labels resolved. */
  modelXml: string;
  setup: SheetSetup;
  values: SheetTitleValues;
  legend: LegendEntry[];
  geometry: SheetGeometry;
}

/** Library titles the legend recognises (style key -> title), set by the UI once the ERTMS library is loaded. */
let legendLibrary: ReadonlyMap<string, string> = new Map();

export function setLegendLibrary(index: ReadonlyMap<string, string>): void {
  legendLibrary = index;
}

export function getLegendLibrary(): ReadonlyMap<string, string> {
  return legendLibrary;
}

/** Page settings and root-cell attributes of a page's `<mxGraphModel>` XML. */
export function readModelSheetSetup(modelXml: string): SheetSetup {
  const doc = new DOMParser().parseFromString(modelXml.replace(/(\s*<!--[\s\S]*?-->)+\s*$/, ''), 'text/xml');
  const model = doc.documentElement;
  const page: PageSettings = {};
  if (model?.nodeName === 'mxGraphModel') {
    for (const name of ['pageWidth', 'pageHeight', 'pageScale'] as const) {
      const n = Number(model.getAttribute(name));
      if (model.hasAttribute(name) && Number.isFinite(n) && n > 0) page[name] = n;
    }
  }
  // the root cell "0": <mxCell id="0"/> or <object id="0" ...><mxCell/></object>
  const rootEl = doc.getElementsByTagName('root')[0];
  const first = rootEl ? Array.from(rootEl.children).find((c) => c.getAttribute('id') === '0') : undefined;
  const attrs = first && first.nodeName !== 'mxCell' ? first : null;
  return sheetSetupFrom(page, (name) => (attrs?.hasAttribute(name) ? attrs.getAttribute(name) : null));
}

/** The sheet number a page prints (its override, else its position). */
function sheetNumberOfSetup(setup: SheetSetup, index: number): string {
  return setup.sheetNumber.trim() || String(index + 1);
}

/**
 * The sheets of `doc` (all drawing pages, or the given indexes), in file order. Pages that cannot
 * be read are left out.
 */
export async function planSheets(doc: DiagramDocument, pages?: readonly number[]): Promise<SheetPlan[]> {
  const all = doc.listPages();
  const xmls = await Promise.all(all.map((p) => doc.getPageModelXml(p.index).catch(() => null)));
  const setups = xmls.map((xml) => (xml ? readModelSheetSetup(xml) : null));
  const numbers = new Map<string, string>();
  all.forEach((p, i) => {
    if (p.id && setups[i]) numbers.set(p.id, sheetNumberOfSetup(setups[i]!, i));
  });
  const sheetNumberOf: SheetNumberOf = (id) => numbers.get(id) ?? null;
  const store = doc.titleBlock;
  const titleBlock = store.get();
  const revisions = store.revisions();
  const wanted = pages ? new Set(pages) : null;
  const out: SheetPlan[] = [];
  all.forEach((page, i) => {
    const xml = xmls[i];
    const setup = setups[i];
    if (!xml || !setup || (wanted && !wanted.has(page.index))) return;
    const modelXml = refreshSheetRefsInXml(xml, sheetNumberOf, titleBlock.lang);
    const legend = setup.legend ? buildLegend(modelXml, legendLibrary) : [];
    out.push({
      page,
      modelXml,
      setup,
      values: sheetTitleValues(titleBlock, revisions, setup, i, all.length),
      legend,
      geometry: sheetGeometry(setup, { revisionRows: revisions.length, legendEntries: legend.length }),
    });
  });
  return out;
}

/** Sheet numbers of the document's pages by page id (for the canvas markers). */
export async function sheetNumbers(doc: DiagramDocument): Promise<SheetNumberOf> {
  const all = doc.listPages();
  const numbers = new Map<string, string>();
  for (const page of all) {
    let setup: SheetSetup | null = null;
    try {
      const xml = await doc.getPageModelXml(page.index);
      setup = xml ? readModelSheetSetup(xml) : null;
    } catch {
      setup = null;
    }
    if (page.id) numbers.set(page.id, setup ? sheetNumberOfSetup(setup, page.index) : String(page.index + 1));
  }
  return (id) => numbers.get(id) ?? null;
}
