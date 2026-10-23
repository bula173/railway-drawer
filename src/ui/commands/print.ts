/**
 * @file print.ts
 * @brief Print sheet commands (src/print): File > Page Setup… / Title Block… / Revisions… /
 *        Print…, File > Export > Sheets…, View > Show Sheet Border / Pages… / Next Page /
 *        Previous Page / Insert Sheet Reference…. Dialogs and exports load on first use.
 */
import { isSheetBorderShown, setSheetBorderShown } from '../../print/ui/sheet-overlay';
import type { TabData } from '../tabs';
import type { Command, CommandContext } from './types';

const dialogs = (): Promise<typeof import('../../print/ui/sheet-dialogs')> => import('../../print/ui/sheet-dialogs');
const exporter = (): Promise<typeof import('../../print/ui/sheet-export')> => import('../../print/ui/sheet-export');

function withTab(run: (tab: TabData) => unknown): (ctx: CommandContext) => void {
  return (ctx) => {
    if (ctx.tab) void run(ctx.tab);
  };
}

const hasOtherPages = (ctx: CommandContext): boolean => (ctx.tab?.document.listPages().length ?? 0) > 1;

/** File > Print…: the sheets of the chosen pages (sheet-export.ts). */
export function openPrintSheets(tab: TabData): void {
  void exporter().then((m) => m.openExportSheetsDialog(tab, 'print'));
}

export const printCommands: readonly Command[] = [
  { id: 'pageSetup', label: 'Page Setup…', run: withTab((tab) => dialogs().then((m) => m.openSheetSetupDialog(tab))) },
  { id: 'titleBlock', label: 'Title Block…', run: withTab((tab) => dialogs().then((m) => m.openTitleBlockDialog(tab))) },
  { id: 'revisions', label: 'Revisions…', run: withTab((tab) => dialogs().then((m) => m.openRevisionsDialog(tab))) },
  { id: 'exportSheets', label: 'Sheets (PDF / SVG / PNG)…', run: withTab((tab) => exporter().then((m) => m.openExportSheetsDialog(tab, 'export'))) },
  {
    id: 'toggleSheetBorder',
    label: 'Sheet Border',
    // draw.io's page view of the shown page (sheet-overlay.ts)
    isChecked: (ctx) => isSheetBorderShown(ctx.tab),
    run: withTab((tab) => setSheetBorderShown(tab, !isSheetBorderShown(tab))),
  },
  { id: 'pages', label: 'Pages…', run: withTab((tab) => dialogs().then((m) => m.openPagesDialog(tab))) },
  {
    id: 'nextPage',
    label: 'Next Page',
    isEnabled: hasOtherPages,
    run: withTab((tab) => {
      const n = tab.document.listPages().length;
      return n > 1 ? dialogs().then((m) => m.goToPage(tab, (tab.document.shownPageIndex() + 1) % n)) : undefined;
    }),
  },
  {
    id: 'previousPage',
    label: 'Previous Page',
    isEnabled: hasOtherPages,
    run: withTab((tab) => {
      const n = tab.document.listPages().length;
      return n > 1 ? dialogs().then((m) => m.goToPage(tab, (tab.document.shownPageIndex() + n - 1) % n)) : undefined;
    }),
  },
  { id: 'insertSheetRef', label: 'Insert Sheet Reference…', run: withTab((tab) => dialogs().then((m) => m.openSheetRefDialog(tab))) },
];
