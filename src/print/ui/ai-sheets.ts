/**
 * @file ai-sheets.ts
 * @brief The AI tools `set_title_block` and `export_sheets` on a tab (src/ai/app-target.ts; input
 *        already checked against the tool schema in src/ai/tool-defs.ts).
 */
import type { DiagramSession } from '../../ui/session';
import { pageSettingsFor, readSheetSetup, sheetAttributesFor, writeRootAttributes, type SheetFormatId, type SheetOrientation } from '../sheet-setup';
import { TITLE_FIELDS, type RevisionRow } from '../title-block';
import { exportSheets } from './sheet-export';

export async function aiSetTitleBlock(session: DiagramSession, input: Record<string, unknown>): Promise<object> {
  const { document: doc, graph } = session;
  const store = doc.titleBlock;
  const patch: Record<string, string> = {};
  for (const f of TITLE_FIELDS) if (typeof input[f] === 'string') patch[f] = input[f] as string;
  if (input.lang === 'pl' || input.lang === 'en') patch.lang = input.lang;
  if (Object.keys(patch).length > 0) store.set(patch);
  if (Array.isArray(input.revisions)) store.setRevisions(input.revisions as RevisionRow[]);
  const sheet = input.sheet as Record<string, unknown> | undefined;
  if (sheet) {
    const current = readSheetSetup(doc.getPageSettings(), graph.getDataModel());
    const format = (typeof sheet.format === 'string' ? sheet.format : current.format === 'custom' ? 'A4' : current.format) as SheetFormatId;
    const orientation = (typeof sheet.orientation === 'string' ? sheet.orientation : current.orientation) as SheetOrientation;
    const scale = typeof sheet.scale === 'number' ? sheet.scale : current.scaleMode === 'fixed' ? current.scale : 0;
    const next = {
      ...current,
      format,
      orientation,
      scaleMode: scale > 0 ? ('fixed' as const) : ('fit' as const),
      scale: scale > 0 ? scale : 1,
      sheetTitle: typeof sheet.sheetTitle === 'string' ? sheet.sheetTitle : current.sheetTitle,
      sheetNumber: typeof sheet.sheetNumber === 'string' ? sheet.sheetNumber : current.sheetNumber,
    };
    const model = graph.getDataModel();
    model.beginUpdate();
    try {
      doc.setPageSettings({ ...pageSettingsFor(next), page: sheet.showBorder !== false });
      writeRootAttributes(model, sheetAttributesFor(next));
    } finally {
      model.endUpdate();
    }
  }
  const setup = readSheetSetup(doc.getPageSettings(), graph.getDataModel());
  const { logo: _logo, ...values } = store.get();
  return {
    titleBlock: values,
    revisions: store.revisions(),
    shownPage: { index: doc.shownPageIndex() + 1, format: setup.format, orientation: setup.orientation, scale: setup.scaleMode === 'fixed' ? `1:${setup.scale}` : 'fit' },
  };
}

export async function aiExportSheets(session: DiagramSession, pages: number[]): Promise<{ fileName: string; sheets: number }> {
  const all = session.document.listPages();
  const chosen = pages.length > 0 ? pages.map((n) => n - 1).filter((i) => i >= 0 && i < all.length) : undefined;
  if (chosen && chosen.length === 0) throw new Error(`no such page (the file has ${all.length})`);
  const sheets = await exportSheets(session, 'pdf', chosen);
  return { fileName: `${session.document.getProjectName() || 'diagram'} - sheets.pdf`, sheets };
}
