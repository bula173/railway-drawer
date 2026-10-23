/**
 * The AI tools of the print sheets (src/print/ui/ai-sheets.ts): set_title_block (title block,
 * revisions, sheet setup of the shown page) and export_sheets (page numbers -> sheet export).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createTestGraph, cleanupTestGraph } from '../../__tests__/setup';
import { DiagramDocument } from '../../document/diagram-document';
import { registerDrawioCodecs } from '../../services/drawio-xml';
import { getToolDef } from '../../ai/tool-defs';
import { checkInput } from '../../ai/schema-check';
import { readSheetSetup } from '../sheet-setup';

const exportSheets = vi.fn(async (_session: unknown, _output: string, pages?: number[]) => pages?.length ?? 1);
vi.mock('../ui/sheet-export', () => ({ exportSheets: (...args: [unknown, string, number[] | undefined]) => exportSheets(...args) }));

describe('AI print sheet tools', () => {
  beforeAll(() => registerDrawioCodecs());

  it('validates and applies set_title_block, exports the chosen pages', async () => {
    const def = getToolDef('set_title_block')!;
    const input = {
      project: 'Linia 1 — Łódź',
      designed: 'Ż. Ółć',
      lang: 'en',
      revisions: [{ rev: 'A', date: '2026-10-24', description: 'Issue', author: 'ŻÓ' }],
      sheet: { format: 'A3', orientation: 'landscape', scale: 2, sheetNumber: '5' },
    };
    expect(checkInput(input, def.input_schema)).toEqual([]);
    expect(checkInput({ sheet: { format: 'B5' } }, def.input_schema)).not.toEqual([]);
    const graph = createTestGraph();
    try {
      const doc = new DiagramDocument(graph);
      const session = { id: 't', graph, document: doc } as never;
      const { aiSetTitleBlock, aiExportSheets } = await import('../ui/ai-sheets');
      const out = (await aiSetTitleBlock(session, input)) as { titleBlock: { project: string; lang: string }; shownPage: { format: string; scale: string } };
      expect(out.titleBlock).toMatchObject({ project: 'Linia 1 — Łódź', lang: 'en' });
      expect(out.shownPage).toMatchObject({ format: 'A3', scale: '1:2' });
      expect(doc.titleBlock.revisions()).toHaveLength(1);
      expect(readSheetSetup(doc.getPageSettings(), graph.getDataModel())).toMatchObject({ orientation: 'landscape', scaleMode: 'fixed', sheetNumber: '5' });
      expect(doc.getPageSettings().page).toBe(true);
      expect(await aiExportSheets(session, [])).toMatchObject({ sheets: 1 });
      expect(exportSheets).toHaveBeenLastCalledWith(session, 'pdf', undefined);
      await expect(aiExportSheets(session, [3])).rejects.toThrow(/no such page/);
    } finally {
      cleanupTestGraph(graph);
    }
  });
});
