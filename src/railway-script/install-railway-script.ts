/**
 * @file install-railway-script.ts
 * @brief Wires the Railway Script into the main editor (called once from main-editor.ts). The
 *        parser, generator, sync and panel are the lazy chunk `script-ui.ts`, loaded when the
 *        "Railway Script" tab is shown, a File > Import/Export Railway Script action runs, or a
 *        tab has a script (so its drawing edits update the script even with the panel closed).
 *
 * Menu items `data-action="importRailwayScript" | "exportRailwayScript"`: MenuController
 * dispatches the window event `railway-script-request` with `{ action: 'import' | 'export' }`.
 */
import { on } from '../core/event-bus';
import type { LeftPanelTabs } from '../ui/left-panel-tabs';
import type { TabData, TabManager } from '../ui/tabs';

export const RAILWAY_SCRIPT_REQUEST_EVENT = 'railway-script-request' as const;
export const RAILWAY_SCRIPT_TAB = 'railwayScript';

export interface RailwayScriptRequest {
  action: 'import' | 'export';
}

export interface RailwayScriptNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

type UiModule = typeof import('./script-ui');

let uiPromise: Promise<UiModule> | null = null;
function loadUi(): Promise<UiModule> {
  uiPromise ??= import('./script-ui');
  return uiPromise;
}

export function installRailwayScript(tabManager: TabManager, notify: RailwayScriptNotifier, leftPanelTabs: LeftPanelTabs, panelContainer: HTMLElement): void {
  const fail = (error: unknown): void => {
    console.error('[Railway Script]', error);
    notify.error(`Railway Script: ${error instanceof Error ? error.message : String(error)}`);
  };

  // sessions for tabs with a script (drawing -> text works without the panel)
  const watched = new WeakSet<TabData>();
  const attach = (tab: TabData | null): void => {
    if (!tab) return;
    if (!watched.has(tab)) {
      watched.add(tab);
      tab.document.railwayScript.subscribe(() => attach(tab));
    }
    if (tab.document.railwayScript.has()) {
      loadUi()
        .then((ui) => {
          if (tabManager.getAllTabs().includes(tab)) ui.ensureSession(tab);
        })
        .catch(fail);
    }
  };
  tabManager.getAllTabs().forEach(attach);
  on('tab-changed', () => attach(tabManager.getActiveTab()));
  on('tab-closed', ({ tabId }) => {
    if (tabId && uiPromise) void uiPromise.then((ui) => ui.destroySession(tabId));
  });

  // the panel, created when the tab is first shown
  const showPanel = (): void => {
    loadUi()
      .then((ui) => ui.mountPanel(panelContainer, tabManager, notify).bind())
      .catch(fail);
  };
  leftPanelTabs.onTabSwitch((tabId) => {
    if (tabId === RAILWAY_SCRIPT_TAB) showPanel();
  });
  if (leftPanelTabs.getActiveTab() === RAILWAY_SCRIPT_TAB) showPanel();

  on(RAILWAY_SCRIPT_REQUEST_EVENT, (detail) => {
    const req: RailwayScriptRequest | undefined = detail;
    loadUi()
      .then((ui) => {
        if (req?.action === 'import') {
          leftPanelTabs.switchTab(RAILWAY_SCRIPT_TAB);
          ui.chooseAndImport(tabManager, notify);
        } else if (req?.action === 'export') ui.exportActiveTab(tabManager, notify);
      })
      .catch(fail);
  });
}
