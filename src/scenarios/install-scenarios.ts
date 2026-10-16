/**
 * @file install-scenarios.ts
 * @brief Wires scenarios into the legacy editor (called once from legacy-main.ts): the right
 *        panel's "Properties | Scenarios" switch, the Scenarios panel for the active tab, the
 *        read-only scenario view on the canvas, and the keyboard while that view is open.
 */
import type { TabData, TabManager } from '../ui/tabs';
import { getDrawioThumbnailRenderer } from '../ui/drawio-palette/drawio-palette-view';
import { confirmTemplateDialog } from '../ui/templates/template-dialogs';
import { captureDrawing, replaceDrawingWithSnapshot } from './scenario-actions';
import { scenarioKeyAction } from './scenario-keys';
import { ScenarioViewer } from './scenario-view';
import type { RightPanelView, ScenarioNotifier, ScenariosPanel, ScenarioThumbnails } from './scenarios-panel';
import { createScenariosPanel, installRightPanelSwitch } from './scenarios-panel';

export interface ScenariosHandle {
  viewer: ScenarioViewer;
  panel: ScenariosPanel;
  /**
   * For the global keydown dispatcher: while a step is shown, handles the key (navigation, Escape,
   * blocked editing shortcuts) and returns true, so no graph shortcut reaches the hidden drawing.
   */
  handleKeydown(e: KeyboardEvent): boolean;
  /** Shows a view of the right panel (Properties, Data, Checks, Scenarios). */
  showPanel(view: RightPanelView): void;
  /** Removes the view, the panel and the window listeners (tests). */
  destroy(): void;
}

export interface InstallScenariosOptions {
  /** Step thumbnails (default: the palette's shared renderer); null: none (tests). */
  thumbnails?: ScenarioThumbnails | null;
}

export function installScenarios(
  tabManager: TabManager,
  notify: ScenarioNotifier,
  graphContainer: HTMLElement,
  installOptions: InstallScenariosOptions = {}
): ScenariosHandle {
  const tabById = (id: string): TabData | null => tabManager.getAllTabs().find((t) => t.id === id) ?? null;

  const viewer = new ScenarioViewer({
    graphContainer,
    getActiveTabId: () => tabManager.getActiveTab()?.id ?? null,
    getScenarios: (id) => tabById(id)?.saveLoadController.getScenarios() ?? null,
    getLiveGraph: (id) => tabById(id)?.graph ?? null,
    onStateChange: (state) => panel.setViewState(state),
    onReplaceDrawing: (state, step) => {
      void (async () => {
        const scenario = tabById(state.tabId)?.saveLoadController.getScenarios().get(state.scenarioId);
        const ok = await confirmTemplateDialog(
          `Replace the drawing with step ${state.index + 1} "${step.name}"${scenario ? ` of "${scenario.name}"` : ''}? ` +
            'You can undo this with Ctrl+Z.',
          'Replace drawing'
        );
        const tab = tabById(state.tabId);
        if (!ok || !tab) return;
        viewer.close();
        try {
          replaceDrawingWithSnapshot(tab.graph, step.xml);
          notify.success(`Drawing replaced with step ${state.index + 1} "${step.name}" (Ctrl+Z undoes it)`);
        } catch (error) {
          notify.error(`Could not replace the drawing: ${error instanceof Error ? error.message : String(error)}`);
        }
      })();
    },
  });

  const panel: ScenariosPanel = createScenariosPanel({
    container: document.getElementById('scenarios-panel')!,
    getActiveTab: () => {
      const tab = tabManager.getActiveTab();
      if (!tab) return null;
      return {
        id: tab.id,
        name: tab.name,
        scenarios: tab.saveLoadController.getScenarios(),
        captureDrawing: () => captureDrawing(tab.saveLoadController),
      };
    },
    viewer,
    notify,
    thumbnails: installOptions.thumbnails === undefined ? getDrawioThumbnailRenderer() : installOptions.thumbnails,
    onStepsChanged: () => {
      // Steps hold whole drawings: write the cache now so a full storage is reported right away
      if (!tabManager.flushCache()) {
        notify.warning(
          'The step is kept for this session, but browser storage is full: save the diagram to a file (Ctrl+S) to keep it.'
        );
      }
    },
  });

  const showPanel = installRightPanelSwitch((view) => {
    if (view === 'scenarios') panel.refresh();
  });

  // The panel and the view follow the active tab
  const onTabChanged = (): void => {
    const state = viewer.getState();
    if (state && state.tabId !== tabManager.getActiveTab()?.id) viewer.close();
    panel.refresh();
  };
  const onTabClosed = (evt: Event): void => {
    const closedId = (evt as CustomEvent<{ tabId: string }>).detail?.tabId;
    if (viewer.getState()?.tabId === closedId) viewer.close();
    panel.refresh();
  };
  window.addEventListener('tab-changed', onTabChanged);
  window.addEventListener('tab-closed', onTabClosed);

  const handleKeydown = (e: KeyboardEvent): boolean => {
    if (!viewer.isActive()) return false;
    const action = scenarioKeyAction(e);
    if (action === 'pass') return false;
    e.stopPropagation();
    if (action === 'swallow') return true;
    e.preventDefault();
    if (action === 'prev') viewer.go(-1);
    else if (action === 'next') viewer.go(1);
    else if (action === 'first') viewer.first();
    else if (action === 'last') viewer.last();
    else if (action === 'exit') viewer.close();
    return true;
  };

  const destroy = (): void => {
    window.removeEventListener('tab-changed', onTabChanged);
    window.removeEventListener('tab-closed', onTabClosed);
    viewer.destroy();
    panel.destroy();
  };

  return { viewer, panel, handleKeydown, showPanel, destroy };
}
