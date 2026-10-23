/**
 * @file install-railml.ts
 * @brief Wires railML 3.2 import/export into the main editor (called once from main-editor.ts).
 *        Everything heavy (export/import/dialogs) is the lazy chunk `railml-ui.ts`, loaded on the
 *        first railML action, so the main chunk only carries this file and the tiny root sniffing.
 *
 * Menu items: File > Import railML… (`data-action="importRailml"`) and File > Export railML 3.2…
 * (`data-action="exportRailml"`); MenuController dispatches the window event `railml-request`
 * with `{ action }`. File > Open and files dropped on the canvas whose root is `<railML>` (also
 * `.railml`/`.xml`) are imported into a new tab the same way (`{ action: 'open', text, name }`).
 */
import { emit, on } from '../core/event-bus';
import type { TabManager } from '../ui/tabs';
import { looksLikeRailml } from './xml';

export const RAILML_REQUEST_EVENT = 'railml-request' as const;

export type RailmlRequest = { action: 'export' } | { action: 'import' } | { action: 'open'; text: string; name: string };

export interface RailmlNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

/** True when the file is railML (by content); the caller then leaves it to the railML import. */
export async function isRailmlFile(file: File): Promise<string | null> {
  if (!/\.(railml|xml)$/i.test(file.name) && file.type !== 'application/xml' && file.type !== 'text/xml') return null;
  try {
    const text = await file.text();
    return looksLikeRailml(text) ? text : null;
  } catch {
    return null;
  }
}

/** Opens railML text in a new tab (dispatches the request handled by installRailml). */
export function requestRailmlOpen(text: string, name: string): void {
  emit(RAILML_REQUEST_EVENT, { action: 'open', text, name });
}

export function installRailml(tabManager: TabManager, notify: RailmlNotifier): () => void {
  const onRequest = (req: RailmlRequest): void => {
    import('./railml-ui')
      .then(async (ui): Promise<void> => {
        if (req.action === 'export') ui.exportActiveTab(tabManager, notify);
        else if (req.action === 'import') ui.chooseAndImport(tabManager, notify);
        else await ui.importIntoNewTab(tabManager, notify, req.text, req.name);
      })
      .catch((error: unknown) => {
        console.error('[railML]', error);
        notify.error(`railML: ${error instanceof Error ? error.message : String(error)}`);
      });
  };
  return on(RAILML_REQUEST_EVENT, onRequest);
}
