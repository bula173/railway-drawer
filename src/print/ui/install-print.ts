/**
 * @file install-print.ts
 * @brief Boot step of the print sheets (boot/features.ts): the sheet overlay of the shown page
 *        (View > Show Sheet Border), continuation markers that go to their page on click (a
 *        click without drag and without Shift / Alt; dragging still moves them), and the markers'
 *        labels refreshed when the pages change. Dialogs and exports are lazy chunks
 *        (sheet-dialogs.ts, sheet-export.ts) opened by the commands in ui/commands/print.ts.
 */
import { InternalEvent, type Cell, type EventObject } from '@maxgraph/core';
import { on } from '../../core/event-bus';
import { onGraphEvent, type Disposers } from '../../core/graph-events';
import { ActiveSessionBinding, type DiagramSession } from '../../ui/session';
import { refreshSheetRefsInModel, sheetRefTarget } from '../sheet-refs';
import { sheetNumbers } from '../sheet-plan';
import { installSheetOverlay, isSheetBorderShown } from './sheet-overlay';
import { ensureLegendLibrary } from './legend-library';

/** Goes to the page a continuation marker points to (lazy dialogs chunk for the notification). */
export async function followSheetRef(session: DiagramSession, cell: Cell): Promise<boolean> {
  const target = sheetRefTarget(cell);
  if (!target) return false;
  const page = session.document.listPages().find((p) => p.id === target);
  const { goToPage } = await import('./sheet-dialogs');
  if (!page) {
    const { globalNotificationManager } = await import('../../ui/notification');
    globalNotificationManager.warning('The page this reference points to is not in this file any more.');
    return false;
  }
  await goToPage(session, page.index);
  return true;
}

async function refreshMarkers(session: DiagramSession): Promise<void> {
  const numberOf = await sheetNumbers(session.document);
  refreshSheetRefsInModel(session.graph.getDataModel(), numberOf, session.document.titleBlock.get().lang);
}

export function installPrintSheets(): () => void {
  const overlay = installSheetOverlay();
  const binding = new ActiveSessionBinding<DiagramSession>((session: DiagramSession, disposers: Disposers) => {
    if (isSheetBorderShown(session)) void ensureLegendLibrary();
    disposers.add(
      onGraphEvent(session.graph, InternalEvent.CLICK, (_sender, evt: EventObject) => {
        const cell = evt.getProperty('cell') as Cell | null;
        const event = evt.getProperty('event') as MouseEvent | undefined;
        if (!cell || !sheetRefTarget(cell) || event?.shiftKey || event?.altKey) return;
        void followSheetRef(session, cell);
      })
    );
    disposers.add(
      on('rd-pages-changed', ({ graph }) => {
        if (graph === session.graph) void refreshMarkers(session);
      })
    );
    disposers.add(
      on('rd-page-settings', ({ graph }) => {
        if (graph === session.graph && isSheetBorderShown(session)) void ensureLegendLibrary();
      })
    );
  });
  return () => {
    binding.dispose();
    overlay.dispose();
  };
}
